"""
Trip day plan service.

This module provides comprehensive day-by-day meal planning functionality,
aggregating data from meal assignments, participants, and meal slots to provide
complete planning views and shopping lists.
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID
from decimal import Decimal
from collections import defaultdict
import json
from io import StringIO
import csv

from sqlalchemy import select, func, and_, or_, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.core.utils import get_utc_now
from jidelnicek.trip.models import (
    Trip, TripDay, TripMeal, TripMealSlot, TripParticipant
)
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.trip.schemas.day_plan import (
    ParticipantAttendance,
    MealIngredientSummary,
    MealNutritionalSummary,
    MealSlotPlan,
    DayShoppingItem,
    DayShoppingList,
    DayPlanSummary,
    TripDayByDayPlan,
    MealSlotAssignmentRequest,
    DayPlanUpdateRequest
)
from jidelnicek.trip.schemas.meal import (
    MealAssignment,
    MealAssignmentCreate,
    RecipeSnapshot
)
from jidelnicek.trip.utils.coefficient_calculator import CoefficientCalculator
from .meal_assignment_service import MealAssignmentService
from .participant_service import ParticipantService
from .meal_slot_service import MealSlotService


class DayPlanService:
    """
    Service for comprehensive day-by-day trip meal planning.
    
    Provides functionality for:
    - Aggregating meal data by day with participant attendance
    - Calculating shopping lists with proper scaling
    - Managing nutritional information
    - Handling complex participant scenarios (mid-trip arrivals/departures)
    - Exporting plans in various formats
    - Bulk meal assignment operations
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize day plan service.
        
        Args:
            session: Database session
        """
        self.session = session
        self.coefficient_calculator = CoefficientCalculator(session)
        self.meal_assignment_service = MealAssignmentService(session)
        self.participant_service = ParticipantService(session)
        self.meal_slot_service = MealSlotService(session)
    
    async def get_day_plan(
        self,
        trip_id: UUID,
        day_id: UUID,
        include_shopping: bool = True,
        include_nutrition: bool = True
    ) -> DayPlanSummary:
        """
        Get complete meal plan for a single day.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            include_shopping: Include shopping list aggregation
            include_nutrition: Include nutritional calculations
            
        Returns:
            Complete day plan summary
            
        Raises:
            NotFoundError: If trip or day not found
        """
        # Get day with all related data
        day_query = select(TripDay).where(
            and_(
                TripDay.id == day_id,
                TripDay.trip_id == trip_id
            )
        ).options(
            selectinload(TripDay.trip).selectinload(Trip.participants),
            selectinload(TripDay.meal_slots).selectinload(TripMealSlot.meal)
        )
        
        result = await self.session.execute(day_query)
        day = result.scalar_one_or_none()
        
        if not day:
            raise NotFoundError(f"Day {day_id} not found in trip {trip_id}")
        
        # Get participant attendance for this day
        attendance_dates = await self._get_participant_attendance_dates(trip_id)
        
        # Calculate daily participant summary
        daily_summary = await self.coefficient_calculator.calculate_daily_participants(
            trip_id=trip_id,
            day_id=day_id,
            attendance_dates=attendance_dates
        )
        
        # Build meal slot plans
        meal_slot_plans = []
        for slot in sorted(day.meal_slots, key=lambda s: s.display_order):
            meal_plan = await self._build_meal_slot_plan(
                slot=slot,
                day=day,
                attendance_dates=attendance_dates,
                include_nutrition=include_nutrition
            )
            meal_slot_plans.append(meal_plan)
        
        # Calculate unique participants for the day
        unique_participants = set()
        for plan in meal_slot_plans:
            for attendance in plan.participant_attendance:
                if attendance.is_present:
                    unique_participants.add(attendance.participant_id)
        
        # Build day plan summary
        day_plan = DayPlanSummary(
            day_id=day.id,
            day_number=day.day_number,
            date=day.date.isoformat(),
            total_participants=len(unique_participants),
            average_effective_count=daily_summary.average_effective_count,
            meal_slots=meal_slot_plans
        )
        
        # Add shopping list if requested
        if include_shopping:
            day_plan.shopping_list = await self._aggregate_day_shopping(
                day=day,
                meal_plans=meal_slot_plans
            )
        
        return day_plan
    
    async def get_trip_day_by_day_plan(
        self,
        trip_id: UUID,
        include_shopping: bool = True,
        include_nutrition: bool = True,
        start_day: Optional[int] = None,
        end_day: Optional[int] = None
    ) -> TripDayByDayPlan:
        """
        Get complete day-by-day plan for entire trip or date range.
        
        Args:
            trip_id: Trip ID
            include_shopping: Include shopping lists
            include_nutrition: Include nutritional info
            start_day: Optional start day number
            end_day: Optional end day number
            
        Returns:
            Complete trip plan with all days
            
        Raises:
            NotFoundError: If trip not found
        """
        # Get trip with participants
        trip_query = select(Trip).where(Trip.id == trip_id).options(
            selectinload(Trip.participants),
            selectinload(Trip.days)
        )
        
        result = await self.session.execute(trip_query)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Filter days if range specified
        days = sorted(trip.days, key=lambda d: d.day_number)
        if start_day is not None:
            days = [d for d in days if d.day_number >= start_day]
        if end_day is not None:
            days = [d for d in days if d.day_number <= end_day]
        
        # Get plan for each day
        day_plans = []
        for day in days:
            try:
                day_plan = await self.get_day_plan(
                    trip_id=trip_id,
                    day_id=day.id,
                    include_shopping=include_shopping,
                    include_nutrition=include_nutrition
                )
                day_plans.append(day_plan)
            except Exception as e:
                # Log error but continue with other days
                print(f"Error getting plan for day {day.day_number}: {e}")
                continue
        
        # Build trip plan
        trip_plan = TripDayByDayPlan(
            trip_id=trip.id,
            trip_name=trip.name,
            start_date=trip.start_date.isoformat(),
            end_date=trip.end_date.isoformat(),
            total_days=len(days),
            total_participants=len(trip.participants),
            total_meal_slots=0,  # Will be calculated by validator
            total_assigned_meals=0,  # Will be calculated by validator
            overall_completion_percentage=0.0,  # Will be calculated by validator
            days=day_plans
        )
        
        return trip_plan
    
    async def get_day_shopping_list(
        self,
        trip_id: UUID,
        day_id: UUID,
        group_by_category: bool = True
    ) -> DayShoppingList:
        """
        Get aggregated shopping list for a specific day.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            group_by_category: Group items by category
            
        Returns:
            Aggregated shopping list
            
        Raises:
            NotFoundError: If trip or day not found
        """
        # Get day plan with shopping
        day_plan = await self.get_day_plan(
            trip_id=trip_id,
            day_id=day_id,
            include_shopping=True,
            include_nutrition=False
        )
        
        if not day_plan.shopping_list:
            # Build empty shopping list
            return DayShoppingList(
                day_id=day_id,
                day_number=day_plan.day_number,
                date=day_plan.date,
                total_items=0,
                categories={}
            )
        
        return day_plan.shopping_list
    
    async def get_participants_for_meal(
        self,
        trip_id: UUID,
        day_id: UUID,
        meal_slot: str
    ) -> List[ParticipantAttendance]:
        """
        Get participant attendance for a specific meal.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            meal_slot: Meal slot name
            
        Returns:
            List of participant attendance records
            
        Raises:
            NotFoundError: If trip, day or meal slot not found
        """
        # Get day to validate
        day_query = select(TripDay).where(
            and_(
                TripDay.id == day_id,
                TripDay.trip_id == trip_id
            )
        ).options(
            selectinload(TripDay.trip).selectinload(Trip.participants)
        )
        
        result = await self.session.execute(day_query)
        day = result.scalar_one_or_none()
        
        if not day:
            raise NotFoundError(f"Day {day_id} not found in trip {trip_id}")
        
        # Get attendance dates
        attendance_dates = await self._get_participant_attendance_dates(trip_id)
        
        # Calculate meal participants
        meal_summary = await self.coefficient_calculator.calculate_meal_participants(
            trip_id=trip_id,
            day_id=day_id,
            meal_slot=meal_slot,
            attendance_dates=attendance_dates
        )
        
        # Build attendance records
        attendance_records = []
        for participant in day.trip.participants:
            # Check if participant is present
            is_present = True
            if attendance_dates and participant.id in attendance_dates:
                start_date, end_date = attendance_dates[participant.id]
                is_present = start_date <= day.date <= end_date
            
            # Get coefficients
            base_coefficient = participant.coefficient
            meal_coefficient = await self.coefficient_calculator._get_meal_coefficient(
                participant.id,
                trip_id,
                meal_slot
            )
            
            attendance = ParticipantAttendance(
                participant_id=participant.id,
                participant_name=participant.display_name,
                is_present=is_present,
                base_coefficient=base_coefficient,
                meal_coefficient=meal_coefficient if meal_coefficient != base_coefficient else None,
                effective_coefficient=meal_coefficient if is_present else Decimal('0')
            )
            attendance_records.append(attendance)
        
        return attendance_records
    
    async def update_day_meals(
        self,
        trip_id: UUID,
        day_id: UUID,
        update_data: DayPlanUpdateRequest
    ) -> DayPlanSummary:
        """
        Bulk update meal assignments for a day.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            update_data: Bulk update request
            
        Returns:
            Updated day plan
            
        Raises:
            NotFoundError: If trip or day not found
            ValidationError: If invalid meal types or recipes
        """
        # Validate day exists
        day_query = select(TripDay).where(
            and_(
                TripDay.id == day_id,
                TripDay.trip_id == trip_id
            )
        )
        
        result = await self.session.execute(day_query)
        day = result.scalar_one_or_none()
        
        if not day:
            raise NotFoundError(f"Day {day_id} not found in trip {trip_id}")
        
        # Process each meal assignment
        errors = []
        for meal_type, assignment_request in update_data.meal_assignments.items():
            try:
                # Create assignment data
                assignment_data = MealAssignmentCreate(
                    day_id=day_id,
                    meal_slot=meal_type,
                    recipe_id=assignment_request.recipe_id,
                    servings_override=assignment_request.servings_override,
                    notes=assignment_request.notes
                )
                
                # Use meal assignment service
                await self.meal_assignment_service.assign_recipe(
                    trip_id=trip_id,
                    assignment_data=assignment_data
                )
            except Exception as e:
                errors.append(f"{meal_type}: {str(e)}")
        
        if errors:
            raise ValidationError(f"Errors updating meals: {'; '.join(errors)}")
        
        # Return updated day plan
        return await self.get_day_plan(trip_id, day_id)
    
    async def calculate_day_nutrition(
        self,
        trip_id: UUID,
        day_id: UUID,
        per_person: bool = False
    ) -> Optional[MealNutritionalSummary]:
        """
        Calculate nutritional totals for a day.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            per_person: Calculate per person averages
            
        Returns:
            Nutritional summary or None if no data
            
        Raises:
            NotFoundError: If trip or day not found
        """
        # Get day plan with nutrition
        day_plan = await self.get_day_plan(
            trip_id=trip_id,
            day_id=day_id,
            include_shopping=False,
            include_nutrition=True
        )
        
        if per_person and day_plan.nutrition_per_person:
            return day_plan.nutrition_per_person
        elif day_plan.nutrition_totals:
            return day_plan.nutrition_totals
        else:
            return None
    
    async def export_day_plan(
        self,
        trip_id: UUID,
        day_id: UUID,
        format: str = "json",
        include_details: bool = True
    ) -> str:
        """
        Export day plan in various formats.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            format: Export format (json, csv, markdown)
            include_details: Include detailed information
            
        Returns:
            Exported data as string
            
        Raises:
            NotFoundError: If trip or day not found
            ValidationError: If invalid format
        """
        # Get day plan
        day_plan = await self.get_day_plan(
            trip_id=trip_id,
            day_id=day_id,
            include_shopping=True,
            include_nutrition=True
        )
        
        if format == "json":
            return json.dumps(day_plan.model_dump(), indent=2, default=str)
        
        elif format == "csv":
            return self._export_day_plan_csv(day_plan, include_details)
        
        elif format == "markdown":
            return self._export_day_plan_markdown(day_plan, include_details)
        
        else:
            raise ValidationError(f"Invalid export format: {format}")
    
    # Private helper methods
    
    async def _get_participant_attendance_dates(
        self,
        trip_id: UUID
    ) -> Dict[UUID, Tuple[date, date]]:
        """Get attendance date ranges for all participants."""
        # Get trip with participants
        trip_query = select(Trip).where(Trip.id == trip_id).options(
            selectinload(Trip.participants)
        )
        result = await self.session.execute(trip_query)
        trip = result.scalar_one_or_none()
        
        if not trip:
            return {}
        
        attendance_dates = {}
        for participant in trip.participants:
            # Use arrival/departure dates if set, otherwise full trip
            start = participant.arrival_date or trip.start_date
            end = participant.departure_date or trip.end_date
            attendance_dates[participant.id] = (start, end)
        
        return attendance_dates
    
    async def _build_meal_slot_plan(
        self,
        slot: TripMealSlot,
        day: TripDay,
        attendance_dates: Dict[UUID, Tuple[date, date]],
        include_nutrition: bool
    ) -> MealSlotPlan:
        """Build detailed meal slot plan."""
        # Get meal participants
        meal_summary = await self.coefficient_calculator.calculate_meal_participants(
            trip_id=day.trip_id,
            day_id=day.id,
            meal_slot=slot.meal_type,
            attendance_dates=attendance_dates
        )
        
        # Build participant attendance
        attendance_records = []
        for participant in day.trip.participants:
            is_present = True
            if attendance_dates and participant.id in attendance_dates:
                start_date, end_date = attendance_dates[participant.id]
                is_present = start_date <= day.date <= end_date
            
            base_coefficient = participant.coefficient
            meal_coefficient = await self.coefficient_calculator._get_meal_coefficient(
                participant.id,
                day.trip_id,
                slot.meal_type
            )
            
            attendance = ParticipantAttendance(
                participant_id=participant.id,
                participant_name=participant.display_name,
                is_present=is_present,
                base_coefficient=base_coefficient,
                meal_coefficient=meal_coefficient if meal_coefficient != base_coefficient else None,
                effective_coefficient=meal_coefficient if is_present else Decimal('0')
            )
            attendance_records.append(attendance)
        
        # Build meal slot plan
        meal_plan = MealSlotPlan(
            meal_slot_id=slot.id,
            meal_type=slot.meal_type,
            meal_slot_name=slot.custom_name or slot.meal_type,
            is_active=slot.is_active,
            display_order=slot.display_order,
            participant_count=meal_summary.participant_count,
            effective_participant_count=meal_summary.effective_count,
            participant_attendance=attendance_records
        )
        
        # Add meal assignment info if exists
        if slot.meal:
            meal_assignment = await self._convert_meal_to_assignment(slot.meal)
            meal_plan.meal_assignment = meal_assignment
            
            # Get recipe snapshot if exists
            if slot.meal.recipe_snapshot:
                meal_plan.recipe_snapshot = RecipeSnapshot.model_validate(
                    slot.meal.recipe_snapshot
                )
            
            # Calculate ingredients with scaling
            if meal_plan.recipe_snapshot:
                meal_plan.ingredients = await self._calculate_scaled_ingredients(
                    recipe_snapshot=meal_plan.recipe_snapshot,
                    scaling_factor=meal_plan.scaling_factor
                )
            
            # Add nutrition if requested
            if include_nutrition and meal_plan.recipe_snapshot:
                meal_plan.nutrition_per_serving = self._extract_recipe_nutrition(
                    meal_plan.recipe_snapshot
                )
                if meal_plan.nutrition_per_serving:
                    meal_plan.nutrition_total = self._calculate_total_nutrition(
                        meal_plan.nutrition_per_serving,
                        meal_plan.effective_servings
                    )
        
        return meal_plan
    
    async def _convert_meal_to_assignment(self, meal: TripMeal) -> MealAssignment:
        """Convert TripMeal model to MealAssignment schema."""
        return MealAssignment(
            id=meal.id,
            trip_id=meal.trip_id,
            day_id=meal.day_id,
            meal_slot_id=meal.meal_slot_id,
            meal_slot=meal.meal_slot.meal_type if meal.meal_slot else None,
            recipe_id=meal.recipe_id,
            recipe_name=meal.recipe_snapshot.get('name', 'Unknown') if meal.recipe_snapshot else 'Unknown',
            recipe_servings=meal.recipe_snapshot.get('servings', 0) if meal.recipe_snapshot else 0,
            servings_override=meal.servings_override,
            effective_servings=meal.effective_servings,
            notes=meal.notes,
            created_at=meal.created_at,
            updated_at=meal.updated_at
        )
    
    async def _calculate_scaled_ingredients(
        self,
        recipe_snapshot: RecipeSnapshot,
        scaling_factor: Decimal
    ) -> List[MealIngredientSummary]:
        """Calculate scaled ingredient quantities."""
        ingredients = []
        
        for ing_data in recipe_snapshot.ingredients:
            # Get ingredient details
            ing_query = select(Ingredient).where(
                Ingredient.id == ing_data['ingredient_id']
            )
            result = await self.session.execute(ing_query)
            ingredient = result.scalar_one_or_none()
            
            if ingredient:
                scaled_quantity = Decimal(str(ing_data['quantity'])) * scaling_factor
                
                ingredients.append(MealIngredientSummary(
                    ingredient_id=ingredient.id,
                    name=ingredient.name,
                    quantity=scaled_quantity,
                    unit=ing_data['unit'],
                    category=ingredient.category,
                    notes=ing_data.get('notes'),
                    scaling_factor=scaling_factor
                ))
        
        return ingredients
    
    def _extract_recipe_nutrition(
        self,
        recipe_snapshot: RecipeSnapshot
    ) -> Optional[MealNutritionalSummary]:
        """Extract nutritional info from recipe snapshot."""
        nutrition_data = recipe_snapshot.model_extra.get('nutritional_info')
        if not nutrition_data:
            return None
        
        return MealNutritionalSummary(
            calories=nutrition_data.get('calories_per_serving'),
            protein_g=nutrition_data.get('protein_per_serving_g'),
            carbs_g=nutrition_data.get('carbs_per_serving_g'),
            fat_g=nutrition_data.get('fat_per_serving_g'),
            fiber_g=nutrition_data.get('fiber_per_serving_g'),
            sugar_g=nutrition_data.get('sugar_per_serving_g'),
            sodium_mg=nutrition_data.get('sodium_per_serving_mg')
        )
    
    def _calculate_total_nutrition(
        self,
        per_serving: MealNutritionalSummary,
        servings: int
    ) -> MealNutritionalSummary:
        """Calculate total nutrition for all servings."""
        total = MealNutritionalSummary()
        servings_decimal = Decimal(str(servings))
        
        for field in ['calories', 'protein_g', 'carbs_g', 'fat_g', 
                      'fiber_g', 'sugar_g', 'sodium_mg']:
            value = getattr(per_serving, field)
            if value is not None:
                setattr(total, field, value * servings_decimal)
        
        return total
    
    async def _aggregate_day_shopping(
        self,
        day: TripDay,
        meal_plans: List[MealSlotPlan]
    ) -> DayShoppingList:
        """Aggregate shopping list for the day."""
        # Aggregate ingredients by ID
        ingredient_totals: Dict[UUID, Dict[str, Any]] = {}
        
        for meal_plan in meal_plans:
            if not meal_plan.ingredients:
                continue
            
            for ingredient in meal_plan.ingredients:
                ing_id = ingredient.ingredient_id
                
                if ing_id not in ingredient_totals:
                    ingredient_totals[ing_id] = {
                        'ingredient_id': ing_id,
                        'name': ingredient.name,
                        'unit': ingredient.unit,
                        'category': ingredient.category or 'Uncategorized',
                        'total_quantity': Decimal('0'),
                        'meal_sources': set()
                    }
                
                # Add quantity and meal source
                ingredient_totals[ing_id]['total_quantity'] += ingredient.quantity
                ingredient_totals[ing_id]['meal_sources'].add(meal_plan.meal_slot_name)
        
        # Group by category
        categories: Dict[str, List[DayShoppingItem]] = defaultdict(list)
        
        for ing_data in ingredient_totals.values():
            item = DayShoppingItem(
                ingredient_id=ing_data['ingredient_id'],
                name=ing_data['name'],
                total_quantity=ing_data['total_quantity'],
                unit=ing_data['unit'],
                category=ing_data['category'],
                meal_sources=sorted(list(ing_data['meal_sources']))
            )
            categories[ing_data['category']].append(item)
        
        # Sort items within categories
        for category_items in categories.values():
            category_items.sort(key=lambda x: x.name)
        
        return DayShoppingList(
            day_id=day.id,
            day_number=day.day_number,
            date=day.date.isoformat(),
            total_items=len(ingredient_totals),
            categories=dict(categories)
        )
    
    def _export_day_plan_csv(
        self,
        day_plan: DayPlanSummary,
        include_details: bool
    ) -> str:
        """Export day plan as CSV."""
        output = StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            f"Day {day_plan.day_number} - {day_plan.date}",
            f"Participants: {day_plan.total_participants}",
            f"Completion: {day_plan.completion_percentage:.1f}%"
        ])
        writer.writerow([])
        
        # Meal slots
        writer.writerow(['Meal', 'Recipe', 'Servings', 'Participants', 'Status'])
        for slot in day_plan.meal_slots:
            recipe_name = slot.meal_assignment.recipe_name if slot.meal_assignment else "Not assigned"
            servings = slot.effective_servings if slot.meal_assignment else "-"
            status = "Active" if slot.is_active else "Inactive"
            
            writer.writerow([
                slot.meal_slot_name,
                recipe_name,
                servings,
                slot.participant_count,
                status
            ])
        
        if include_details and day_plan.shopping_list:
            writer.writerow([])
            writer.writerow(['Shopping List'])
            writer.writerow(['Category', 'Item', 'Quantity', 'Unit', 'Used In'])
            
            for category, items in day_plan.shopping_list.categories.items():
                for item in items:
                    writer.writerow([
                        category,
                        item.name,
                        f"{item.total_quantity:.2f}",
                        item.unit,
                        ', '.join(item.meal_sources)
                    ])
        
        return output.getvalue()
    
    def _export_day_plan_markdown(
        self,
        day_plan: DayPlanSummary,
        include_details: bool
    ) -> str:
        """Export day plan as Markdown."""
        lines = []
        
        # Header
        lines.append(f"# Day {day_plan.day_number} - {day_plan.date}")
        lines.append("")
        lines.append(f"**Participants:** {day_plan.total_participants}")
        lines.append(f"**Completion:** {day_plan.completion_percentage:.1f}%")
        lines.append("")
        
        # Meal slots
        lines.append("## Meals")
        lines.append("")
        
        for slot in day_plan.meal_slots:
            lines.append(f"### {slot.meal_slot_name}")
            
            if slot.meal_assignment:
                lines.append(f"- **Recipe:** {slot.meal_assignment.recipe_name}")
                lines.append(f"- **Servings:** {slot.effective_servings}")
                lines.append(f"- **Participants:** {slot.participant_count}")
                
                if slot.is_scaled:
                    lines.append(f"- **Scaling Factor:** {slot.scaling_factor:.2f}x")
                
                if include_details and slot.participant_attendance:
                    lines.append("")
                    lines.append("**Attendance:**")
                    for att in slot.participant_attendance:
                        if att.is_present:
                            lines.append(f"- {att.participant_name}: {att.effective_coefficient}%")
            else:
                lines.append("- *Not assigned*")
            
            lines.append("")
        
        # Shopping list
        if include_details and day_plan.shopping_list and day_plan.shopping_list.total_items > 0:
            lines.append("## Shopping List")
            lines.append("")
            
            for category, items in sorted(day_plan.shopping_list.categories.items()):
                lines.append(f"### {category}")
                lines.append("")
                
                for item in items:
                    lines.append(
                        f"- {item.name}: {item.total_quantity:.2f} {item.unit} "
                        f"({', '.join(item.meal_sources)})"
                    )
                lines.append("")
        
        # Nutrition
        if include_details and day_plan.nutrition_totals and day_plan.nutrition_totals.has_data:
            lines.append("## Nutrition Summary")
            lines.append("")
            
            if day_plan.nutrition_totals.calories:
                lines.append(f"- **Calories:** {day_plan.nutrition_totals.calories:.0f}")
            if day_plan.nutrition_totals.protein_g:
                lines.append(f"- **Protein:** {day_plan.nutrition_totals.protein_g:.1f}g")
            if day_plan.nutrition_totals.carbs_g:
                lines.append(f"- **Carbs:** {day_plan.nutrition_totals.carbs_g:.1f}g")
            if day_plan.nutrition_totals.fat_g:
                lines.append(f"- **Fat:** {day_plan.nutrition_totals.fat_g:.1f}g")
            
            lines.append("")
        
        return "\n".join(lines)