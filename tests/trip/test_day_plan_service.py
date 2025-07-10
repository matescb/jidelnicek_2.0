"""
Comprehensive tests for Day Plan Service functionality.

This module provides complete test coverage for the DayPlanService class,
including meal planning, shopping list aggregation, nutritional calculations,
participant attendance tracking, and export functionality.
"""

import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4, UUID
from typing import List, Dict, Any, Optional
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.trip.services.day_plan_service import DayPlanService
from jidelnicek.trip.models import Trip, TripDay, TripMeal, TripMealSlot, TripParticipant
from jidelnicek.trip.schemas.day_plan import (
    ParticipantAttendance, MealIngredientSummary, MealNutritionalSummary,
    MealSlotPlan, DayShoppingItem, DayShoppingList, DayPlanSummary,
    TripDayByDayPlan, MealSlotAssignmentRequest, DayPlanUpdateRequest
)
from jidelnicek.trip.schemas.meal import (
    MealAssignment, MealAssignmentCreate, RecipeSnapshot
)
from jidelnicek.trip.schemas.trip import TripCreate
from jidelnicek.trip.schemas.participant import ParticipantCreate
from jidelnicek.core.exceptions import (
    NotFoundError, ValidationError, ConflictError
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.trip.services.trip_service import TripService


pytestmark = pytest.mark.asyncio


class MockRecipe:
    """Mock Recipe model for testing."""
    def __init__(self, id: UUID, name: str, servings: int = 4, 
                 ingredients: Optional[List[Dict]] = None,
                 nutritional_info: Optional[Dict] = None):
        self.id = id
        self.name = name
        self.servings = servings
        self.ingredients = ingredients or []
        self.nutritional_info = nutritional_info or {}
        
    def to_snapshot(self) -> Dict[str, Any]:
        """Convert to snapshot format."""
        return {
            'id': str(self.id),
            'name': self.name,
            'servings': self.servings,
            'ingredients': self.ingredients,
            'nutritional_info': self.nutritional_info
        }


@pytest.fixture
async def trip_owner(db_session: AsyncSession) -> AuthUser:
    """Create a user who owns trips."""
    user = AuthUser(
        email="day_plan_owner@example.com",
        password_hash=PasswordHasher.hash_password("TripOwner123!"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="UTC",
        role="user",
        is_active=True,
        is_archived=False
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def sample_recipes() -> List[MockRecipe]:
    """Create sample recipes for testing."""
    return [
        MockRecipe(
            id=uuid4(),
            name="Oatmeal Porridge",
            servings=4,
            ingredients=[
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Oats',
                    'quantity': '200',
                    'unit': 'g',
                    'category': 'Grains'
                },
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Milk',
                    'quantity': '800',
                    'unit': 'ml',
                    'category': 'Dairy'
                }
            ],
            nutritional_info={
                'calories_per_serving': 250,
                'protein_per_serving_g': 10,
                'carbs_per_serving_g': 40,
                'fat_per_serving_g': 6
            }
        ),
        MockRecipe(
            id=uuid4(),
            name="Vegetable Soup",
            servings=6,
            ingredients=[
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Carrots',
                    'quantity': '300',
                    'unit': 'g',
                    'category': 'Vegetables'
                },
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Potatoes',
                    'quantity': '500',
                    'unit': 'g',
                    'category': 'Vegetables'
                },
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Onion',
                    'quantity': '200',
                    'unit': 'g',
                    'category': 'Vegetables'
                }
            ],
            nutritional_info={
                'calories_per_serving': 150,
                'protein_per_serving_g': 5,
                'carbs_per_serving_g': 30,
                'fat_per_serving_g': 2
            }
        ),
        MockRecipe(
            id=uuid4(),
            name="Pasta Bolognese",
            servings=4,
            ingredients=[
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Pasta',
                    'quantity': '400',
                    'unit': 'g',
                    'category': 'Grains'
                },
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Ground Beef',
                    'quantity': '500',
                    'unit': 'g',
                    'category': 'Meat'
                },
                {
                    'ingredient_id': str(uuid4()),
                    'name': 'Tomato Sauce',
                    'quantity': '400',
                    'unit': 'ml',
                    'category': 'Sauces'
                }
            ],
            nutritional_info={
                'calories_per_serving': 450,
                'protein_per_serving_g': 25,
                'carbs_per_serving_g': 50,
                'fat_per_serving_g': 15
            }
        )
    ]


@pytest.fixture
async def sample_trip_with_meals(
    db_session: AsyncSession,
    trip_owner: AuthUser,
    sample_recipes: List[MockRecipe]
) -> Trip:
    """Create a sample trip with participants and meal assignments."""
    trip_service = TripService(db_session)
    
    # Create trip with participants
    trip_data = TripCreate(
        name="Test Trip with Meals",
        start_date=date(2024, 7, 15),
        end_date=date(2024, 7, 17),  # 3 days
        meal_slots=["Breakfast", "Lunch", "Dinner"],
        participants=[
            ParticipantCreate(name="Alice", coefficient=Decimal("100.00")),
            ParticipantCreate(name="Bob", coefficient=Decimal("120.00")),
            ParticipantCreate(name="Charlie", coefficient=Decimal("80.00")),  # Child
            ParticipantCreate(
                name="Dave", 
                coefficient=Decimal("100.00"),
                arrival_date=date(2024, 7, 16),  # Arrives day 2
                departure_date=date(2024, 7, 16)  # Leaves day 2
            )
        ]
    )
    
    trip = await trip_service.create_trip(trip_owner.id, trip_data)
    
    # Get days and meal slots
    days_query = select(TripDay).where(TripDay.trip_id == trip.id).order_by(TripDay.day_number)
    days_result = await db_session.execute(days_query)
    days = days_result.scalars().all()
    
    # Assign meals for each day
    for day_idx, day in enumerate(days):
        slots_query = select(TripMealSlot).where(TripMealSlot.day_id == day.id).order_by(TripMealSlot.display_order)
        slots_result = await db_session.execute(slots_query)
        slots = slots_result.scalars().all()
        
        for slot_idx, slot in enumerate(slots):
            recipe_idx = (day_idx + slot_idx) % len(sample_recipes)
            recipe = sample_recipes[recipe_idx]
            
            # Create meal assignment
            meal = TripMeal(
                trip_id=trip.id,
                day_id=day.id,
                meal_slot_id=slot.id,
                recipe_id=recipe.id,
                recipe_snapshot=recipe.to_snapshot(),
                servings_override=None,  # Use automatic calculation
                effective_servings=4,  # Will be recalculated
                notes=f"Day {day.day_number} {slot.meal_type}"
            )
            db_session.add(meal)
            
            # Link to meal slot
            slot.meal_id = meal.id
            slot.meal = meal
    
    await db_session.commit()
    await db_session.refresh(trip)
    
    return trip


@pytest.fixture
async def day_plan_service(db_session: AsyncSession) -> DayPlanService:
    """Create DayPlanService instance."""
    return DayPlanService(db_session)


class TestDayPlanRetrieval:
    """Test day plan retrieval functionality."""
    
    async def test_get_day_plan_basic(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test getting basic day plan."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Get day plan
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            include_shopping=True,
            include_nutrition=True
        )
        
        assert day_plan.day_id == first_day.id
        assert day_plan.day_number == 1
        assert day_plan.date == "2024-07-15"
        assert day_plan.total_participants == 3  # Alice, Bob, Charlie (Dave not yet arrived)
        assert len(day_plan.meal_slots) == 3  # Breakfast, Lunch, Dinner
        
        # Check meal slots
        for meal_slot in day_plan.meal_slots:
            assert meal_slot.is_active is True
            assert meal_slot.participant_count == 3
            assert meal_slot.meal_assignment is not None
            assert meal_slot.recipe_snapshot is not None
            
        # Check completion
        assert day_plan.completion_percentage == 100.0  # All meals assigned
        
    async def test_get_day_plan_with_participant_attendance(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test day plan with mid-trip participant changes."""
        # Get second day (when Dave is present)
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        days = result.scalars().all()
        second_day = days[1]
        
        # Get day plan
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=second_day.id
        )
        
        assert day_plan.total_participants == 4  # Alice, Bob, Charlie, Dave
        
        # Check participant attendance in meal slots
        for meal_slot in day_plan.meal_slots:
            assert meal_slot.participant_count == 4
            assert len(meal_slot.participant_attendance) == 4
            
            # Verify Dave is present
            dave_attendance = next(
                (p for p in meal_slot.participant_attendance if p.participant_name == "Dave"),
                None
            )
            assert dave_attendance is not None
            assert dave_attendance.is_present is True
            assert dave_attendance.effective_coefficient == Decimal("100.00")
            
    async def test_get_day_plan_shopping_list(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test shopping list aggregation."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Get day plan with shopping
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            include_shopping=True
        )
        
        assert day_plan.shopping_list is not None
        assert day_plan.shopping_list.day_id == first_day.id
        assert day_plan.shopping_list.total_items > 0
        
        # Check categories
        assert len(day_plan.shopping_list.categories) > 0
        
        # Check items are properly aggregated
        for category, items in day_plan.shopping_list.categories.items():
            for item in items:
                assert isinstance(item, DayShoppingItem)
                assert item.total_quantity > 0
                assert item.unit is not None
                assert len(item.meal_sources) > 0
                
    async def test_get_day_plan_nutrition(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test nutritional calculations."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Get day plan with nutrition
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            include_nutrition=True
        )
        
        # Check meal slot nutrition
        for meal_slot in day_plan.meal_slots:
            if meal_slot.meal_assignment:
                assert meal_slot.nutrition_per_serving is not None
                assert meal_slot.nutrition_total is not None
                
        # Check day totals
        assert day_plan.nutrition_totals is not None
        assert day_plan.nutrition_totals.calories > 0
        assert day_plan.nutrition_totals.protein_g > 0
        
        # Check per person
        assert day_plan.nutrition_per_person is not None
        assert day_plan.nutrition_per_person.calories > 0
        
    async def test_get_day_plan_not_found(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test getting day plan for non-existent day."""
        fake_day_id = uuid4()
        
        with pytest.raises(NotFoundError):
            await day_plan_service.get_day_plan(
                trip_id=sample_trip_with_meals.id,
                day_id=fake_day_id
            )


class TestTripDayByDayPlan:
    """Test trip-wide day-by-day planning."""
    
    async def test_get_trip_day_by_day_plan(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test getting complete trip plan."""
        trip_plan = await day_plan_service.get_trip_day_by_day_plan(
            trip_id=sample_trip_with_meals.id,
            include_shopping=True,
            include_nutrition=True
        )
        
        assert trip_plan.trip_id == sample_trip_with_meals.id
        assert trip_plan.trip_name == sample_trip_with_meals.name
        assert trip_plan.total_days == 3
        assert trip_plan.total_participants == 4  # Including Dave
        assert len(trip_plan.days) == 3
        
        # Check calculated fields
        assert trip_plan.total_meal_slots == 9  # 3 days * 3 meal slots
        assert trip_plan.total_assigned_meals == 9  # All assigned
        assert trip_plan.overall_completion_percentage == 100.0
        
        # Check unique recipes
        assert len(trip_plan.unique_recipes) > 0
        
        # Check meal type distribution
        assert trip_plan.meal_type_distribution["Breakfast"] == 3
        assert trip_plan.meal_type_distribution["Lunch"] == 3
        assert trip_plan.meal_type_distribution["Dinner"] == 3
        
    async def test_get_trip_day_by_day_plan_date_range(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test getting trip plan for specific date range."""
        # Get days 1-2 only
        trip_plan = await day_plan_service.get_trip_day_by_day_plan(
            trip_id=sample_trip_with_meals.id,
            start_day=1,
            end_day=2
        )
        
        assert len(trip_plan.days) == 2
        assert trip_plan.days[0].day_number == 1
        assert trip_plan.days[1].day_number == 2
        
        # Stats should reflect partial trip
        assert trip_plan.total_meal_slots == 6  # 2 days * 3 meal slots
        
    async def test_get_trip_plan_not_found(
        self,
        db_session: AsyncSession,
        day_plan_service: DayPlanService
    ):
        """Test getting plan for non-existent trip."""
        fake_trip_id = uuid4()
        
        with pytest.raises(NotFoundError):
            await day_plan_service.get_trip_day_by_day_plan(fake_trip_id)


class TestShoppingListAggregation:
    """Test shopping list functionality."""
    
    async def test_get_day_shopping_list(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test getting shopping list for a day."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        shopping_list = await day_plan_service.get_day_shopping_list(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            group_by_category=True
        )
        
        assert shopping_list.day_id == first_day.id
        assert shopping_list.day_number == 1
        assert shopping_list.total_items > 0
        
        # Check grouping by category
        assert len(shopping_list.categories) > 0
        assert all(isinstance(items, list) for items in shopping_list.categories.values())
        
        # Verify aggregation (items from multiple meals should be combined)
        all_items = []
        for items in shopping_list.categories.values():
            all_items.extend(items)
        
        # Check for proper scaling based on participants
        for item in all_items:
            assert item.total_quantity > 0
            assert len(item.meal_sources) >= 1
            
    async def test_shopping_list_empty_day(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        day_plan_service: DayPlanService
    ):
        """Test shopping list for day with no meals."""
        # Create trip without meals
        trip_service = TripService(db_session)
        trip = await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Empty Trip",
                start_date=date(2024, 8, 1),
                end_date=date(2024, 8, 2)
            )
        )
        
        # Get first day
        days_query = select(TripDay).where(TripDay.trip_id == trip.id)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        shopping_list = await day_plan_service.get_day_shopping_list(
            trip_id=trip.id,
            day_id=first_day.id
        )
        
        assert shopping_list.total_items == 0
        assert len(shopping_list.categories) == 0


class TestParticipantAttendance:
    """Test participant attendance tracking."""
    
    async def test_get_participants_for_meal(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test getting participant attendance for specific meal."""
        # Get second day (when Dave is present)
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        days = result.scalars().all()
        second_day = days[1]
        
        participants = await day_plan_service.get_participants_for_meal(
            trip_id=sample_trip_with_meals.id,
            day_id=second_day.id,
            meal_slot="Lunch"
        )
        
        assert len(participants) == 4
        
        # Check each participant
        alice = next(p for p in participants if p.participant_name == "Alice")
        assert alice.is_present is True
        assert alice.base_coefficient == Decimal("100.00")
        assert alice.effective_coefficient == Decimal("100.00")
        
        charlie = next(p for p in participants if p.participant_name == "Charlie")
        assert charlie.is_present is True
        assert charlie.base_coefficient == Decimal("80.00")  # Child coefficient
        assert charlie.effective_coefficient == Decimal("80.00")
        
        dave = next(p for p in participants if p.participant_name == "Dave")
        assert dave.is_present is True  # Present on day 2
        
    async def test_participants_with_meal_coefficients(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        day_plan_service: DayPlanService
    ):
        """Test participants with meal-specific coefficients."""
        # Create trip with meal-specific coefficients
        trip_service = TripService(db_session)
        trip = await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Trip with Meal Coefficients",
                start_date=date(2024, 8, 1),
                end_date=date(2024, 8, 1),
                participants=[
                    ParticipantCreate(
                        name="Alice",
                        coefficient=Decimal("100.00"),
                        meal_coefficients={
                            "Breakfast": Decimal("50.00"),  # Light breakfast
                            "Dinner": Decimal("120.00")      # Larger dinner
                        }
                    )
                ]
            )
        )
        
        # Get day
        days_query = select(TripDay).where(TripDay.trip_id == trip.id)
        result = await db_session.execute(days_query)
        day = result.scalars().first()
        
        # Check breakfast coefficient
        breakfast_participants = await day_plan_service.get_participants_for_meal(
            trip_id=trip.id,
            day_id=day.id,
            meal_slot="Breakfast"
        )
        
        alice_breakfast = breakfast_participants[0]
        assert alice_breakfast.base_coefficient == Decimal("100.00")
        assert alice_breakfast.meal_coefficient == Decimal("50.00")
        assert alice_breakfast.effective_coefficient == Decimal("50.00")
        
        # Check dinner coefficient
        dinner_participants = await day_plan_service.get_participants_for_meal(
            trip_id=trip.id,
            day_id=day.id,
            meal_slot="Dinner"
        )
        
        alice_dinner = dinner_participants[0]
        assert alice_dinner.meal_coefficient == Decimal("120.00")
        assert alice_dinner.effective_coefficient == Decimal("120.00")


class TestBulkMealUpdates:
    """Test bulk meal update functionality."""
    
    async def test_update_day_meals(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        sample_recipes: List[MockRecipe],
        day_plan_service: DayPlanService
    ):
        """Test bulk updating meals for a day."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Prepare update data
        update_data = DayPlanUpdateRequest(
            meal_assignments={
                "Breakfast": MealSlotAssignmentRequest(
                    recipe_id=sample_recipes[2].id,  # Change to Pasta
                    servings_override=6,
                    notes="Changed breakfast"
                ),
                "Lunch": MealSlotAssignmentRequest(
                    recipe_id=sample_recipes[0].id,  # Change to Oatmeal
                    notes="Light lunch"
                )
            }
        )
        
        # Update meals
        updated_plan = await day_plan_service.update_day_meals(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            update_data=update_data
        )
        
        # Verify updates
        breakfast = next(m for m in updated_plan.meal_slots if m.meal_type == "Breakfast")
        assert breakfast.meal_assignment.recipe_name == "Pasta Bolognese"
        assert breakfast.meal_assignment.servings_override == 6
        assert breakfast.meal_assignment.notes == "Changed breakfast"
        
        lunch = next(m for m in updated_plan.meal_slots if m.meal_type == "Lunch")
        assert lunch.meal_assignment.recipe_name == "Oatmeal Porridge"
        assert lunch.meal_assignment.notes == "Light lunch"
        
    async def test_update_meals_validation_error(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test bulk update with invalid data."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Invalid meal slot
        update_data = DayPlanUpdateRequest(
            meal_assignments={
                "InvalidMealSlot": MealSlotAssignmentRequest(
                    recipe_id=uuid4()
                )
            }
        )
        
        with pytest.raises(ValidationError):
            await day_plan_service.update_day_meals(
                trip_id=sample_trip_with_meals.id,
                day_id=first_day.id,
                update_data=update_data
            )


class TestNutritionalCalculations:
    """Test nutritional calculation functionality."""
    
    async def test_calculate_day_nutrition(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test calculating nutritional totals for a day."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Get total nutrition
        total_nutrition = await day_plan_service.calculate_day_nutrition(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            per_person=False
        )
        
        assert total_nutrition is not None
        assert total_nutrition.calories > 0
        assert total_nutrition.protein_g > 0
        assert total_nutrition.carbs_g > 0
        assert total_nutrition.fat_g > 0
        
        # Get per person nutrition
        per_person_nutrition = await day_plan_service.calculate_day_nutrition(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            per_person=True
        )
        
        assert per_person_nutrition is not None
        assert per_person_nutrition.calories < total_nutrition.calories
        
    async def test_nutrition_no_data(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        day_plan_service: DayPlanService
    ):
        """Test nutrition calculation with no meal data."""
        # Create trip without meals
        trip_service = TripService(db_session)
        trip = await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="No Meals Trip",
                start_date=date(2024, 8, 1),
                end_date=date(2024, 8, 1)
            )
        )
        
        # Get day
        days_query = select(TripDay).where(TripDay.trip_id == trip.id)
        result = await db_session.execute(days_query)
        day = result.scalars().first()
        
        nutrition = await day_plan_service.calculate_day_nutrition(
            trip_id=trip.id,
            day_id=day.id
        )
        
        assert nutrition is None


class TestExportFunctionality:
    """Test plan export functionality."""
    
    async def test_export_day_plan_json(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test exporting day plan as JSON."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        json_export = await day_plan_service.export_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            format="json"
        )
        
        # Verify it's valid JSON
        data = json.loads(json_export)
        assert data["day_id"] == str(first_day.id)
        assert data["day_number"] == 1
        assert len(data["meal_slots"]) == 3
        
    async def test_export_day_plan_csv(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test exporting day plan as CSV."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        csv_export = await day_plan_service.export_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            format="csv"
        )
        
        # Verify CSV format
        assert "Day 1" in csv_export
        assert "Meal,Recipe,Servings" in csv_export
        assert "Breakfast" in csv_export
        
    async def test_export_day_plan_markdown(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test exporting day plan as Markdown."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        md_export = await day_plan_service.export_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id,
            format="markdown",
            include_details=True
        )
        
        # Verify Markdown format
        assert "# Day 1" in md_export
        assert "## Meals" in md_export
        assert "### Breakfast" in md_export
        assert "**Participants:**" in md_export
        
        # Should include shopping list if details enabled
        assert "## Shopping List" in md_export
        
    async def test_export_invalid_format(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test export with invalid format."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        with pytest.raises(ValidationError):
            await day_plan_service.export_day_plan(
                trip_id=sample_trip_with_meals.id,
                day_id=first_day.id,
                format="invalid"
            )


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    async def test_inactive_meal_slots(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test handling of inactive meal slots."""
        # Deactivate a meal slot
        slots_query = select(TripMealSlot).where(
            TripMealSlot.trip_id == sample_trip_with_meals.id
        ).limit(1)
        result = await db_session.execute(slots_query)
        slot = result.scalar_one()
        
        slot.is_active = False
        await db_session.commit()
        
        # Get day plan
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=slot.day_id
        )
        
        # Find the inactive slot
        inactive_slot = next(
            (s for s in day_plan.meal_slots if s.meal_slot_id == slot.id),
            None
        )
        
        assert inactive_slot is not None
        assert inactive_slot.is_active is False
        assert inactive_slot.participant_count == 0  # No participants for inactive slots
        
    async def test_partial_attendance(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test handling of partial participant attendance."""
        # Get third day (Dave has left)
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        days = result.scalars().all()
        third_day = days[2]
        
        # Get day plan
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=third_day.id
        )
        
        # Dave should not be present
        assert day_plan.total_participants == 3  # Only Alice, Bob, Charlie
        
        # Check Dave's attendance in meal slots
        for meal_slot in day_plan.meal_slots:
            dave_attendance = next(
                (p for p in meal_slot.participant_attendance if p.participant_name == "Dave"),
                None
            )
            assert dave_attendance is not None
            assert dave_attendance.is_present is False
            assert dave_attendance.effective_coefficient == Decimal("0")
            
    async def test_scaling_factor_calculation(
        self,
        db_session: AsyncSession,
        sample_trip_with_meals: Trip,
        day_plan_service: DayPlanService
    ):
        """Test recipe scaling factor calculation."""
        # Get first day
        days_query = select(TripDay).where(
            TripDay.trip_id == sample_trip_with_meals.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(days_query)
        first_day = result.scalars().first()
        
        # Get day plan
        day_plan = await day_plan_service.get_day_plan(
            trip_id=sample_trip_with_meals.id,
            day_id=first_day.id
        )
        
        # Check scaling factors
        for meal_slot in day_plan.meal_slots:
            if meal_slot.meal_assignment:
                # Effective count: 1.0 (Alice) + 1.2 (Bob) + 0.8 (Charlie) = 3.0
                # Recipe servings vary, so scaling will differ
                assert meal_slot.scaling_factor > 0
                assert meal_slot.is_scaled == (meal_slot.scaling_factor != 1.0)
                
                # Verify ingredients are scaled
                if meal_slot.ingredients:
                    for ingredient in meal_slot.ingredients:
                        assert ingredient.scaling_factor == meal_slot.scaling_factor