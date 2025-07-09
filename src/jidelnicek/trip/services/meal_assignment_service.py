"""
Trip meal assignment service.

This module provides business logic for managing recipe assignments to meal slots in trips.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import select, func, and_, or_, exists, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.trip.models import (
    Trip, TripDay, TripMeal, TripMealSlot, TripParticipant
)
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.trip.schemas.meal import (
    MealAssignmentCreate,
    MealAssignmentUpdate,
    MealAssignment,
    MealAssignmentBulkCreate,
    MealAssignmentBulkUpdate,
    MealAssignmentSwap,
    PortionCalculation,
    DayMealAssignments,
    TripMealPlan,
    MealPlanningStatus,
    RecipeSnapshot
)
from jidelnicek.trip.utils.coefficient_calculator import CoefficientCalculator


class MealAssignmentService:
    """
    Service for managing meal assignments in trips.
    
    Provides functionality for:
    - Assigning recipes to meal slots
    - Managing meal portions and servings
    - Calculating portions based on participant coefficients
    - Creating recipe snapshots for change tracking
    - Bulk operations and meal swapping
    - Meal planning analytics
    """
    
    def __init__(self, session: AsyncSession):
        """Initialize meal assignment service."""
        self.session = session
        self.coefficient_calculator = CoefficientCalculator(session)
    
    async def assign_recipe(
        self,
        trip_id: UUID,
        assignment_data: MealAssignmentCreate
    ) -> MealAssignment:
        """
        Assign a recipe to a meal slot.
        
        Args:
            trip_id: Trip ID
            assignment_data: Assignment data
            
        Returns:
            Created meal assignment
            
        Raises:
            NotFoundError: If trip, day, recipe or meal slot not found
            ConflictError: If meal slot already has an assignment
            ValidationError: If meal slot is not active
        """
        # Validate trip and day
        day_stmt = select(TripDay).where(
            and_(
                TripDay.id == assignment_data.day_id,
                TripDay.trip_id == trip_id
            )
        ).options(selectinload(TripDay.trip))
        
        result = await self.session.execute(day_stmt)
        day = result.scalar_one_or_none()
        
        if not day:
            raise NotFoundError(f"Day {assignment_data.day_id} not found in trip {trip_id}")
        
        # Validate meal slot exists and is active
        slot_stmt = select(TripMealSlot).where(
            and_(
                TripMealSlot.trip_id == trip_id,
                TripMealSlot.day_id == assignment_data.day_id,
                func.lower(TripMealSlot.meal_type) == assignment_data.meal_slot.lower()
            )
        )
        
        result = await self.session.execute(slot_stmt)
        meal_slot = result.scalar_one_or_none()
        
        if not meal_slot:
            raise NotFoundError(
                f"Meal slot '{assignment_data.meal_slot}' not found for day {day.day_number}"
            )
        
        if not meal_slot.is_active:
            raise ValidationError(
                f"Meal slot '{assignment_data.meal_slot}' is not active for day {day.day_number}"
            )
        
        # Check if slot already has assignment
        exists_stmt = select(exists().where(
            and_(
                TripMeal.day_id == assignment_data.day_id,
                func.lower(TripMeal.meal_slot) == assignment_data.meal_slot.lower()
            )
        ))
        
        result = await self.session.execute(exists_stmt)
        if result.scalar():
            raise ConflictError(
                f"Meal slot '{assignment_data.meal_slot}' already has an assignment "
                f"for day {day.day_number}"
            )
        
        # Validate recipe exists
        recipe_stmt = select(Recipe).where(Recipe.id == assignment_data.recipe_id)
        result = await self.session.execute(recipe_stmt)
        recipe = result.scalar_one_or_none()
        
        if not recipe:
            raise NotFoundError(f"Recipe {assignment_data.recipe_id} not found")
        
        # Create recipe snapshot if track_changes mode is enabled
        recipe_snapshot = None
        if hasattr(day.trip, 'track_changes') and day.trip.track_changes:
            recipe_snapshot = await self._create_recipe_snapshot(recipe)
        
        # Create meal assignment
        meal = TripMeal(
            day_id=assignment_data.day_id,
            recipe_id=assignment_data.recipe_id,
            meal_slot=assignment_data.meal_slot,
            servings_override=assignment_data.servings_override,
            notes=assignment_data.notes,
            recipe_snapshot=recipe_snapshot
        )
        
        self.session.add(meal)
        await self.session.commit()
        await self.session.refresh(meal, ['recipe', 'day'])
        
        # Build response with computed fields
        return await self._build_meal_assignment_response(meal)
    
    async def update_assignment(
        self,
        trip_id: UUID,
        meal_id: UUID,
        update_data: MealAssignmentUpdate
    ) -> MealAssignment:
        """
        Update a meal assignment.
        
        Args:
            trip_id: Trip ID
            meal_id: Meal assignment ID
            update_data: Update data
            
        Returns:
            Updated meal assignment
            
        Raises:
            NotFoundError: If meal assignment or new recipe not found
        """
        # Get meal assignment with relationships
        stmt = select(TripMeal).where(TripMeal.id == meal_id).options(
            joinedload(TripMeal.day).joinedload(TripDay.trip),
            joinedload(TripMeal.recipe)
        )
        
        result = await self.session.execute(stmt)
        meal = result.scalar_one_or_none()
        
        if not meal or meal.day.trip_id != trip_id:
            raise NotFoundError(f"Meal assignment {meal_id} not found in trip {trip_id}")
        
        # Update recipe if provided
        if update_data.recipe_id is not None:
            # Validate new recipe exists
            recipe_stmt = select(Recipe).where(Recipe.id == update_data.recipe_id)
            result = await self.session.execute(recipe_stmt)
            recipe = result.scalar_one_or_none()
            
            if not recipe:
                raise NotFoundError(f"Recipe {update_data.recipe_id} not found")
            
            meal.recipe_id = update_data.recipe_id
            
            # Update snapshot if track_changes enabled
            if hasattr(meal.day.trip, 'track_changes') and meal.day.trip.track_changes:
                meal.recipe_snapshot = await self._create_recipe_snapshot(recipe)
        
        # Update other fields
        if update_data.servings_override is not None:
            meal.servings_override = update_data.servings_override
        
        if update_data.notes is not None:
            meal.notes = update_data.notes
        
        await self.session.commit()
        await self.session.refresh(meal, ['recipe', 'day'])
        
        return await self._build_meal_assignment_response(meal)
    
    async def remove_assignment(
        self,
        trip_id: UUID,
        meal_id: UUID
    ) -> None:
        """
        Remove a meal assignment.
        
        Args:
            trip_id: Trip ID
            meal_id: Meal assignment ID
            
        Raises:
            NotFoundError: If meal assignment not found
        """
        # Get meal assignment
        stmt = select(TripMeal).where(TripMeal.id == meal_id).options(
            joinedload(TripMeal.day)
        )
        
        result = await self.session.execute(stmt)
        meal = result.scalar_one_or_none()
        
        if not meal or meal.day.trip_id != trip_id:
            raise NotFoundError(f"Meal assignment {meal_id} not found in trip {trip_id}")
        
        await self.session.delete(meal)
        await self.session.commit()
    
    async def bulk_assign_recipes(
        self,
        trip_id: UUID,
        bulk_data: MealAssignmentBulkCreate
    ) -> List[MealAssignment]:
        """
        Create multiple meal assignments at once.
        
        Args:
            trip_id: Trip ID
            bulk_data: Bulk assignment data
            
        Returns:
            List of created meal assignments
            
        Raises:
            NotFoundError: If any resources not found
            ConflictError: If any meal slots already have assignments
            ValidationError: If any meal slots are not active
        """
        created_meals = []
        
        # Process each assignment
        for assignment_data in bulk_data.assignments:
            try:
                meal = await self.assign_recipe(trip_id, assignment_data)
                created_meals.append(meal)
            except Exception as e:
                # Rollback all if any fails
                await self.session.rollback()
                raise e
        
        return created_meals
    
    async def bulk_update_assignments(
        self,
        trip_id: UUID,
        bulk_data: MealAssignmentBulkUpdate
    ) -> List[MealAssignment]:
        """
        Update multiple meal assignments at once.
        
        Args:
            trip_id: Trip ID
            bulk_data: Bulk update data
            
        Returns:
            List of updated meal assignments
            
        Raises:
            NotFoundError: If any meal assignments not found
        """
        updated_meals = []
        
        # Process each update
        for meal_id in bulk_data.meal_ids:
            try:
                meal = await self.update_assignment(trip_id, meal_id, bulk_data.update_data)
                updated_meals.append(meal)
            except Exception as e:
                # Rollback all if any fails
                await self.session.rollback()
                raise e
        
        return updated_meals
    
    async def swap_meals(
        self,
        trip_id: UUID,
        swap_data: MealAssignmentSwap
    ) -> Tuple[MealAssignment, MealAssignment]:
        """
        Swap two meal assignments.
        
        Args:
            trip_id: Trip ID
            swap_data: Swap data containing two meal IDs
            
        Returns:
            Tuple of the two swapped meal assignments
            
        Raises:
            NotFoundError: If either meal assignment not found
        """
        # Get both meals
        stmt = select(TripMeal).where(
            TripMeal.id.in_([swap_data.meal_id_1, swap_data.meal_id_2])
        ).options(
            joinedload(TripMeal.day),
            joinedload(TripMeal.recipe)
        )
        
        result = await self.session.execute(stmt)
        meals = list(result.scalars().all())
        
        if len(meals) != 2:
            raise NotFoundError("One or both meal assignments not found")
        
        meal1 = next((m for m in meals if m.id == swap_data.meal_id_1), None)
        meal2 = next((m for m in meals if m.id == swap_data.meal_id_2), None)
        
        if meal1.day.trip_id != trip_id or meal2.day.trip_id != trip_id:
            raise NotFoundError("One or both meals not in the specified trip")
        
        # Swap recipe IDs and snapshots
        meal1.recipe_id, meal2.recipe_id = meal2.recipe_id, meal1.recipe_id
        meal1.recipe_snapshot, meal2.recipe_snapshot = meal2.recipe_snapshot, meal1.recipe_snapshot
        
        # Optionally swap servings overrides and notes
        meal1.servings_override, meal2.servings_override = meal2.servings_override, meal1.servings_override
        meal1.notes, meal2.notes = meal2.notes, meal1.notes
        
        await self.session.commit()
        await self.session.refresh(meal1, ['recipe', 'day'])
        await self.session.refresh(meal2, ['recipe', 'day'])
        
        return (
            await self._build_meal_assignment_response(meal1),
            await self._build_meal_assignment_response(meal2)
        )
    
    async def calculate_portions(
        self,
        trip_id: UUID,
        meal_id: UUID
    ) -> PortionCalculation:
        """
        Calculate portions for a meal based on participant count and coefficients.
        
        Args:
            trip_id: Trip ID
            meal_id: Meal assignment ID
            
        Returns:
            Portion calculation details
            
        Raises:
            NotFoundError: If meal assignment not found
        """
        # Get meal with all relationships
        stmt = select(TripMeal).where(TripMeal.id == meal_id).options(
            joinedload(TripMeal.day).joinedload(TripDay.trip).joinedload(Trip.participants),
            joinedload(TripMeal.recipe)
        )
        
        result = await self.session.execute(stmt)
        meal = result.scalar_one_or_none()
        
        if not meal or meal.day.trip_id != trip_id:
            raise NotFoundError(f"Meal assignment {meal_id} not found in trip {trip_id}")
        
        # Calculate effective participant count for this meal
        meal_summary = await self.coefficient_calculator.calculate_meal_participants(
            trip_id=trip_id,
            day_id=meal.day_id,
            meal_slot=meal.meal_slot
        )
        
        # Get base servings
        base_servings = meal.recipe.servings if meal.recipe else 4
        required_servings = meal.servings_override or int(meal_summary.effective_count.quantize(Decimal('1')))
        
        # Calculate scaling factor
        scaling_factor = Decimal(str(required_servings)) / Decimal(str(base_servings))
        
        # Get meal coefficients applied
        meal_coefficients = {}
        for participant_data in meal_summary.participants:
            coeff_key = f"participant_{participant_data['id']}"
            meal_coefficients[coeff_key] = participant_data['coefficient']
        
        return PortionCalculation(
            meal_id=meal_id,
            recipe_id=meal.recipe_id,
            recipe_name=meal.recipe.name if meal.recipe else "Unknown",
            base_servings=base_servings,
            required_servings=required_servings,
            scaling_factor=scaling_factor,
            participant_count=meal_summary.participant_count,
            meal_coefficients=meal_coefficients
        )
    
    async def get_meal_assignment(
        self,
        trip_id: UUID,
        meal_id: UUID
    ) -> MealAssignment:
        """
        Get a single meal assignment.
        
        Args:
            trip_id: Trip ID
            meal_id: Meal assignment ID
            
        Returns:
            Meal assignment
            
        Raises:
            NotFoundError: If meal assignment not found
        """
        stmt = select(TripMeal).where(TripMeal.id == meal_id).options(
            joinedload(TripMeal.day),
            joinedload(TripMeal.recipe)
        )
        
        result = await self.session.execute(stmt)
        meal = result.scalar_one_or_none()
        
        if not meal or meal.day.trip_id != trip_id:
            raise NotFoundError(f"Meal assignment {meal_id} not found in trip {trip_id}")
        
        return await self._build_meal_assignment_response(meal)
    
    async def list_trip_meals(
        self,
        trip_id: UUID,
        day_id: Optional[UUID] = None,
        meal_slot: Optional[str] = None
    ) -> List[MealAssignment]:
        """
        List meal assignments for a trip.
        
        Args:
            trip_id: Trip ID
            day_id: Optional filter by day
            meal_slot: Optional filter by meal slot
            
        Returns:
            List of meal assignments
        """
        # Build query
        stmt = select(TripMeal).join(TripDay).where(
            TripDay.trip_id == trip_id
        ).options(
            joinedload(TripMeal.day),
            joinedload(TripMeal.recipe)
        ).order_by(
            TripDay.day_number,
            TripMeal.meal_slot
        )
        
        if day_id is not None:
            stmt = stmt.where(TripMeal.day_id == day_id)
        
        if meal_slot is not None:
            stmt = stmt.where(func.lower(TripMeal.meal_slot) == meal_slot.lower())
        
        result = await self.session.execute(stmt)
        meals = result.scalars().unique().all()
        
        return [await self._build_meal_assignment_response(meal) for meal in meals]
    
    async def get_meals_by_day(
        self,
        trip_id: UUID
    ) -> List[DayMealAssignments]:
        """
        Get meal assignments grouped by day.
        
        Args:
            trip_id: Trip ID
            
        Returns:
            List of day meal assignments
        """
        # Get all days with their meals
        stmt = select(TripDay).where(
            TripDay.trip_id == trip_id
        ).options(
            selectinload(TripDay.meals).joinedload(TripMeal.recipe)
        ).order_by(TripDay.day_number)
        
        result = await self.session.execute(stmt)
        days = result.scalars().unique().all()
        
        # Build response
        day_assignments = []
        for day in days:
            meal_responses = []
            for meal in sorted(day.meals, key=lambda m: m.meal_slot):
                meal_responses.append(await self._build_meal_assignment_response(meal))
            
            day_assignments.append(DayMealAssignments(
                day_id=day.id,
                day_number=day.day_number,
                date=day.date.isoformat(),
                meal_assignments=meal_responses,
                total_meals=len(meal_responses)
            ))
        
        return day_assignments
    
    async def get_trip_meal_plan(
        self,
        trip_id: UUID
    ) -> TripMealPlan:
        """
        Get complete meal plan for a trip.
        
        Args:
            trip_id: Trip ID
            
        Returns:
            Trip meal plan
            
        Raises:
            NotFoundError: If trip not found
        """
        # Get trip
        trip_stmt = select(Trip).where(Trip.id == trip_id)
        result = await self.session.execute(trip_stmt)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Get meals by day
        days = await self.get_meals_by_day(trip_id)
        
        return TripMealPlan(
            trip_id=trip_id,
            trip_name=trip.name,
            start_date=trip.start_date.isoformat(),
            end_date=trip.end_date.isoformat(),
            days=days,
            total_days=len(days),
            total_meals=sum(day.total_meals for day in days),
            total_unique_recipes=0  # Will be calculated by validator
        )
    
    async def get_planning_status(
        self,
        trip_id: UUID
    ) -> MealPlanningStatus:
        """
        Get meal planning status for a trip.
        
        Args:
            trip_id: Trip ID
            
        Returns:
            Meal planning status
        """
        # Count total meal slots
        total_slots_stmt = select(func.count(TripMealSlot.id)).where(
            and_(
                TripMealSlot.trip_id == trip_id,
                TripMealSlot.is_active == True
            )
        )
        
        result = await self.session.execute(total_slots_stmt)
        total_slots = result.scalar() or 0
        
        # Count assigned meals
        assigned_stmt = select(func.count(TripMeal.id)).join(TripDay).where(
            TripDay.trip_id == trip_id
        )
        
        result = await self.session.execute(assigned_stmt)
        assigned_meals = result.scalar() or 0
        
        # Get unassigned slot details
        unassigned_stmt = select(
            TripMealSlot.meal_type,
            TripDay.day_number,
            TripDay.id
        ).join(TripDay).outerjoin(
            TripMeal,
            and_(
                TripMeal.day_id == TripMealSlot.day_id,
                func.lower(TripMeal.meal_slot) == func.lower(TripMealSlot.meal_type)
            )
        ).where(
            and_(
                TripMealSlot.trip_id == trip_id,
                TripMealSlot.is_active == True,
                TripMeal.id.is_(None)
            )
        ).order_by(TripDay.day_number, TripMealSlot.display_order)
        
        result = await self.session.execute(unassigned_stmt)
        unassigned = result.all()
        
        unassigned_details = [
            {
                "day_number": row.day_number,
                "meal_slot": row.meal_type,
                "day_id": str(row.id)
            }
            for row in unassigned
        ]
        
        return MealPlanningStatus(
            trip_id=trip_id,
            total_meal_slots=total_slots,
            assigned_meals=assigned_meals,
            unassigned_slots=total_slots - assigned_meals,
            completion_percentage=0.0,  # Will be calculated by validator
            unassigned_details=unassigned_details
        )
    
    async def _create_recipe_snapshot(self, recipe: Recipe) -> dict:
        """
        Create a snapshot of recipe data.
        
        Args:
            recipe: Recipe to snapshot
            
        Returns:
            Recipe snapshot data
        """
        # Load ingredients if not already loaded
        if not hasattr(recipe, 'ingredients') or recipe.ingredients is None:
            stmt = select(Recipe).where(Recipe.id == recipe.id).options(
                selectinload(Recipe.ingredients)
            )
            result = await self.session.execute(stmt)
            recipe = result.scalar_one()
        
        # Build ingredient list
        ingredients = []
        for ing in recipe.ingredients:
            ingredients.append({
                "name": ing.name,
                "amount": float(ing.amount) if ing.amount else None,
                "unit": ing.unit,
                "category": ing.category,
                "is_required": ing.is_required
            })
        
        # Build snapshot
        snapshot = RecipeSnapshot(
            id=recipe.id,
            name=recipe.name,
            servings=recipe.servings,
            total_time_minutes=recipe.total_time_minutes,
            difficulty=recipe.difficulty_level,
            ingredients=ingredients,
            instructions=recipe.instructions.split('\n') if recipe.instructions else [],
            version=1
        )
        
        return snapshot.model_dump()
    
    async def _build_meal_assignment_response(self, meal: TripMeal) -> MealAssignment:
        """
        Build a complete meal assignment response.
        
        Args:
            meal: TripMeal model instance
            
        Returns:
            MealAssignment schema
        """
        # Build response data
        response_data = {
            "id": meal.id,
            "day_id": meal.day_id,
            "recipe_id": meal.recipe_id,
            "meal_slot": meal.meal_slot,
            "servings_override": meal.servings_override,
            "notes": meal.notes,
            "recipe_snapshot": RecipeSnapshot(**meal.recipe_snapshot) if meal.recipe_snapshot else None,
            "created_at": meal.created_at,
            "updated_at": meal.updated_at,
            "effective_servings": meal.effective_servings
        }
        
        # Add recipe info if loaded
        if hasattr(meal, 'recipe') and meal.recipe:
            response_data.update({
                "recipe_name": meal.recipe.name,
                "recipe_servings": meal.recipe.servings
            })
        
        # Add day info if loaded
        if hasattr(meal, 'day') and meal.day:
            response_data.update({
                "day_number": meal.day.day_number,
                "day_date": meal.day.date.isoformat()
            })
        
        return MealAssignment(**response_data)