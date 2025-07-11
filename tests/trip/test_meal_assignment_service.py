"""
Tests for trip meal assignment service.
"""

import pytest
import pytest_asyncio
from uuid import uuid4, UUID
from datetime import datetime, date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.trip.models import Trip, TripDay, TripMeal, TripMealSlot, TripParticipant
from jidelnicek.trip.services.meal_assignment_service import MealAssignmentService
from jidelnicek.trip.schemas.meal import (
    MealAssignmentCreate,
    MealAssignmentUpdate,
    MealAssignmentBulkCreate,
    MealAssignmentBulkUpdate,
    MealAssignmentSwap,
    PortionCalculation,
    DayMealAssignments,
    TripMealPlan,
    MealPlanningStatus
)


# Mock Recipe model since it doesn't exist yet
class MockRecipe:
    """Mock Recipe model for testing."""
    def __init__(self, id: UUID, name: str, servings: int = 4, total_time_minutes: int = 30,
                 difficulty_level: str = "medium", instructions: str = "", ingredients: list = None):
        self.id = id
        self.name = name
        self.servings = servings
        self.total_time_minutes = total_time_minutes
        self.difficulty_level = difficulty_level
        self.instructions = instructions
        self.ingredients = ingredients or []


class MockIngredient:
    """Mock Ingredient model for testing."""
    def __init__(self, name: str, amount: float = 1.0, unit: str = "pcs", 
                 category: str = "other", is_required: bool = True):
        self.name = name
        self.amount = amount
        self.unit = unit
        self.category = category
        self.is_required = is_required


@pytest_asyncio.fixture(scope="function")
async def trip_with_meal_slots(db_session: AsyncSession, test_user):
    """Create a test trip with days and meal slots."""
    trip = Trip(
        user_id=test_user.id,
        name="Test Trip",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 3),
        meal_slots=["Breakfast", "Lunch", "Dinner"],
        track_changes=True
    )
    db_session.add(trip)
    await db_session.commit()
    
    # Add days and meal slots
    for i in range(3):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=date(2024, 1, i + 1)
        )
        db_session.add(day)
        await db_session.commit()
        
        # Add meal slots
        for j, meal in enumerate(["Breakfast", "Lunch", "Dinner"]):
            slot = TripMealSlot(
                trip_id=trip.id,
                day_id=day.id,
                day_number=day.day_number,
                meal_type=meal,
                is_active=True,
                display_order=j + 1
            )
            db_session.add(slot)
    
    # Add participants
    participant1 = TripParticipant(
        trip_id=trip.id,
        name="Adult 1",
        age_group="adult",
        participant_type="standard"
    )
    participant2 = TripParticipant(
        trip_id=trip.id,
        name="Child 1",
        age_group="child",
        participant_type="standard"
    )
    db_session.add_all([participant1, participant2])
    
    await db_session.commit()
    await db_session.refresh(trip)
    return trip


@pytest_asyncio.fixture(scope="function")
async def mock_recipes():
    """Create mock recipes for testing."""
    return [
        MockRecipe(
            id=uuid4(),
            name="Scrambled Eggs",
            servings=4,
            total_time_minutes=15,
            difficulty_level="easy",
            instructions="Beat eggs.\nCook in pan.",
            ingredients=[
                MockIngredient("Eggs", 8, "pcs", "dairy"),
                MockIngredient("Butter", 20, "g", "dairy"),
                MockIngredient("Salt", 1, "pinch", "spices")
            ]
        ),
        MockRecipe(
            id=uuid4(),
            name="Pasta Carbonara",
            servings=4,
            total_time_minutes=30,
            difficulty_level="medium",
            instructions="Cook pasta.\nMix with eggs and bacon.",
            ingredients=[
                MockIngredient("Pasta", 400, "g", "grains"),
                MockIngredient("Bacon", 200, "g", "meat"),
                MockIngredient("Eggs", 4, "pcs", "dairy"),
                MockIngredient("Parmesan", 100, "g", "dairy")
            ]
        ),
        MockRecipe(
            id=uuid4(),
            name="Grilled Chicken",
            servings=4,
            total_time_minutes=45,
            difficulty_level="medium",
            instructions="Season chicken.\nGrill until done.",
            ingredients=[
                MockIngredient("Chicken breast", 800, "g", "meat"),
                MockIngredient("Olive oil", 30, "ml", "oils"),
                MockIngredient("Herbs", 2, "tbsp", "spices")
            ]
        )
    ]


@pytest_asyncio.fixture(scope="function")
async def meal_assignment_service(db_session: AsyncSession):
    """Create meal assignment service instance."""
    return MealAssignmentService(db_session)


@pytest_asyncio.fixture(scope="function")
async def trip_with_assignments(db_session: AsyncSession, trip_with_meal_slots, mock_recipes):
    """Create a trip with some meal assignments."""
    trip = trip_with_meal_slots
    
    # Get first day
    day_stmt = select(TripDay).where(TripDay.trip_id == trip.id).order_by(TripDay.day_number)
    result = await db_session.execute(day_stmt)
    days = result.scalars().all()
    
    # Create some assignments
    meal1 = TripMeal(
        day_id=days[0].id,
        recipe_id=mock_recipes[0].id,
        meal_slot="Breakfast",
        servings_override=6,
        notes="Extra portions for hikers"
    )
    meal2 = TripMeal(
        day_id=days[0].id,
        recipe_id=mock_recipes[1].id,
        meal_slot="Lunch"
    )
    
    db_session.add_all([meal1, meal2])
    await db_session.commit()
    
    return trip, [meal1, meal2]


class TestAssignRecipe:
    """Test assigning recipes to meal slots."""
    
    @patch('jidelnicek.trip.services.meal_assignment_service.select')
    async def test_assign_recipe_success(
        self,
        mock_select,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test successful recipe assignment."""
        # Get trip day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        # Mock recipe query
        recipe_id = mock_recipes[0].id
        with patch.object(db_session, 'execute') as mock_execute:
            # Setup mocks for various queries
            mock_execute.side_effect = [
                # Day query
                MagicMock(scalar_one_or_none=MagicMock(return_value=day)),
                # Meal slot query
                MagicMock(scalar_one_or_none=MagicMock(return_value=MagicMock(
                    is_active=True,
                    meal_type="Breakfast"
                ))),
                # Exists query
                MagicMock(scalar=MagicMock(return_value=False)),
                # Recipe query
                MagicMock(scalar_one_or_none=MagicMock(return_value=mock_recipes[0]))
            ]
            
            # Create assignment
            assignment_data = MealAssignmentCreate(
                day_id=day.id,
                recipe_id=recipe_id,
                meal_slot="Breakfast",
                servings_override=6,
                notes="Test meal"
            )
            
            with patch.object(db_session, 'add'), \
                 patch.object(db_session, 'commit'), \
                 patch.object(db_session, 'refresh') as mock_refresh:
                
                # Mock the created meal
                created_meal = MagicMock(
                    id=uuid4(),
                    day_id=day.id,
                    recipe_id=recipe_id,
                    meal_slot="Breakfast",
                    servings_override=6,
                    notes="Test meal",
                    recipe_snapshot=None,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    effective_servings=6,
                    recipe=mock_recipes[0],
                    day=day
                )
                mock_refresh.return_value = None
                
                # Patch the response builder
                with patch.object(
                    meal_assignment_service,
                    '_build_meal_assignment_response',
                    return_value=MagicMock(id=created_meal.id)
                ):
                    result = await meal_assignment_service.assign_recipe(
                        trip_with_meal_slots.id,
                        assignment_data
                    )
                    
                    assert result.id == created_meal.id
    
    async def test_assign_recipe_day_not_found(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list
    ):
        """Test assignment with non-existent day."""
        assignment_data = MealAssignmentCreate(
            day_id=uuid4(),  # Non-existent day
            recipe_id=mock_recipes[0].id,
            meal_slot="Breakfast"
        )
        
        with pytest.raises(NotFoundError) as exc_info:
            await meal_assignment_service.assign_recipe(
                trip_with_meal_slots.id,
                assignment_data
            )
        
        assert "Day" in str(exc_info.value)
        assert "not found" in str(exc_info.value)
    
    async def test_assign_recipe_slot_not_active(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test assignment to inactive meal slot."""
        # Get day and deactivate a slot
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        slot_stmt = select(TripMealSlot).where(
            TripMealSlot.day_id == day.id,
            TripMealSlot.meal_type == "Breakfast"
        )
        result = await db_session.execute(slot_stmt)
        slot = result.scalar_one()
        slot.is_active = False
        await db_session.commit()
        
        assignment_data = MealAssignmentCreate(
            day_id=day.id,
            recipe_id=mock_recipes[0].id,
            meal_slot="Breakfast"
        )
        
        with pytest.raises(ValidationError) as exc_info:
            await meal_assignment_service.assign_recipe(
                trip_with_meal_slots.id,
                assignment_data
            )
        
        assert "not active" in str(exc_info.value)
    
    async def test_assign_recipe_slot_already_assigned(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        mock_recipes: list
    ):
        """Test assignment to already assigned slot."""
        trip, existing_meals = trip_with_assignments
        existing_meal = existing_meals[0]
        
        assignment_data = MealAssignmentCreate(
            day_id=existing_meal.day_id,
            recipe_id=mock_recipes[2].id,  # Different recipe
            meal_slot=existing_meal.meal_slot  # Same slot
        )
        
        with pytest.raises(ConflictError) as exc_info:
            await meal_assignment_service.assign_recipe(
                trip.id,
                assignment_data
            )
        
        assert "already has an assignment" in str(exc_info.value)


class TestUpdateAssignment:
    """Test updating meal assignments."""
    
    async def test_update_assignment_success(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test successful assignment update."""
        trip, existing_meals = trip_with_assignments
        meal_to_update = existing_meals[0]
        
        with patch.object(db_session, 'execute') as mock_execute:
            # Mock the meal query
            mock_execute.return_value = MagicMock(
                scalar_one_or_none=MagicMock(return_value=meal_to_update)
            )
            
            update_data = MealAssignmentUpdate(
                recipe_id=mock_recipes[2].id,
                servings_override=8,
                notes="Updated notes"
            )
            
            # Mock recipe lookup
            with patch('jidelnicek.trip.services.meal_assignment_service.select') as mock_select:
                mock_execute.side_effect = [
                    # Meal query
                    MagicMock(scalar_one_or_none=MagicMock(return_value=meal_to_update)),
                    # Recipe query
                    MagicMock(scalar_one_or_none=MagicMock(return_value=mock_recipes[2]))
                ]
                
                with patch.object(db_session, 'commit'), \
                     patch.object(db_session, 'refresh'), \
                     patch.object(
                         meal_assignment_service,
                         '_build_meal_assignment_response',
                         return_value=MagicMock(
                             id=meal_to_update.id,
                             servings_override=8
                         )
                     ):
                    
                    result = await meal_assignment_service.update_assignment(
                        trip.id,
                        meal_to_update.id,
                        update_data
                    )
                    
                    assert result.id == meal_to_update.id
                    assert result.servings_override == 8
    
    async def test_update_assignment_not_found(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip
    ):
        """Test updating non-existent assignment."""
        update_data = MealAssignmentUpdate(servings_override=10)
        
        with pytest.raises(NotFoundError) as exc_info:
            await meal_assignment_service.update_assignment(
                trip_with_meal_slots.id,
                uuid4(),  # Non-existent meal ID
                update_data
            )
        
        assert "Meal assignment" in str(exc_info.value)
        assert "not found" in str(exc_info.value)
    
    async def test_update_assignment_recipe_not_found(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test updating with non-existent recipe."""
        trip, existing_meals = trip_with_assignments
        meal_to_update = existing_meals[0]
        
        with patch.object(db_session, 'execute') as mock_execute:
            # Mock queries
            mock_execute.side_effect = [
                # Meal query - success
                MagicMock(scalar_one_or_none=MagicMock(return_value=meal_to_update)),
                # Recipe query - not found
                MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            ]
            
            update_data = MealAssignmentUpdate(recipe_id=uuid4())
            
            with pytest.raises(NotFoundError) as exc_info:
                await meal_assignment_service.update_assignment(
                    trip.id,
                    meal_to_update.id,
                    update_data
                )
            
            assert "Recipe" in str(exc_info.value)


class TestRemoveAssignment:
    """Test removing meal assignments."""
    
    async def test_remove_assignment_success(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test successful assignment removal."""
        trip, existing_meals = trip_with_assignments
        meal_to_remove = existing_meals[0]
        
        # Remove the assignment
        await meal_assignment_service.remove_assignment(trip.id, meal_to_remove.id)
        
        # Verify it's removed
        stmt = select(TripMeal).where(TripMeal.id == meal_to_remove.id)
        result = await db_session.execute(stmt)
        assert result.scalar_one_or_none() is None
    
    async def test_remove_assignment_not_found(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip
    ):
        """Test removing non-existent assignment."""
        with pytest.raises(NotFoundError):
            await meal_assignment_service.remove_assignment(
                trip_with_meal_slots.id,
                uuid4()  # Non-existent meal ID
            )


class TestBulkOperations:
    """Test bulk meal assignment operations."""
    
    async def test_bulk_assign_recipes_success(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test successful bulk assignment."""
        # Get days
        day_stmt = select(TripDay).where(
            TripDay.trip_id == trip_with_meal_slots.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(day_stmt)
        days = result.scalars().all()
        
        bulk_data = MealAssignmentBulkCreate(
            assignments=[
                MealAssignmentCreate(
                    day_id=days[0].id,
                    recipe_id=mock_recipes[0].id,
                    meal_slot="Breakfast"
                ),
                MealAssignmentCreate(
                    day_id=days[0].id,
                    recipe_id=mock_recipes[1].id,
                    meal_slot="Lunch"
                ),
                MealAssignmentCreate(
                    day_id=days[1].id,
                    recipe_id=mock_recipes[2].id,
                    meal_slot="Dinner"
                )
            ]
        )
        
        # Mock the assign_recipe method
        mock_assignments = [
            MagicMock(id=uuid4(), meal_slot=assignment.meal_slot)
            for assignment in bulk_data.assignments
        ]
        
        with patch.object(
            meal_assignment_service,
            'assign_recipe',
            side_effect=mock_assignments
        ):
            results = await meal_assignment_service.bulk_assign_recipes(
                trip_with_meal_slots.id,
                bulk_data
            )
            
            assert len(results) == 3
            assert results[0].meal_slot == "Breakfast"
            assert results[1].meal_slot == "Lunch"
            assert results[2].meal_slot == "Dinner"
    
    async def test_bulk_assign_recipes_rollback_on_error(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test bulk assignment rollback on error."""
        # Get day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        bulk_data = MealAssignmentBulkCreate(
            assignments=[
                MealAssignmentCreate(
                    day_id=day.id,
                    recipe_id=mock_recipes[0].id,
                    meal_slot="Breakfast"
                ),
                MealAssignmentCreate(
                    day_id=uuid4(),  # Invalid day ID
                    recipe_id=mock_recipes[1].id,
                    meal_slot="Lunch"
                )
            ]
        )
        
        with patch.object(
            meal_assignment_service,
            'assign_recipe',
            side_effect=[MagicMock(), NotFoundError("Day not found")]
        ), patch.object(db_session, 'rollback') as mock_rollback:
            
            with pytest.raises(NotFoundError):
                await meal_assignment_service.bulk_assign_recipes(
                    trip_with_meal_slots.id,
                    bulk_data
                )
            
            mock_rollback.assert_called_once()
    
    async def test_bulk_update_assignments_success(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test successful bulk update."""
        trip, existing_meals = trip_with_assignments
        
        bulk_data = MealAssignmentBulkUpdate(
            meal_ids=[meal.id for meal in existing_meals],
            update_data=MealAssignmentUpdate(
                servings_override=10,
                notes="Bulk updated"
            )
        )
        
        # Mock the update_assignment method
        mock_updates = [
            MagicMock(id=meal.id, servings_override=10)
            for meal in existing_meals
        ]
        
        with patch.object(
            meal_assignment_service,
            'update_assignment',
            side_effect=mock_updates
        ):
            results = await meal_assignment_service.bulk_update_assignments(
                trip.id,
                bulk_data
            )
            
            assert len(results) == 2
            assert all(r.servings_override == 10 for r in results)


class TestMealSwapping:
    """Test meal swapping functionality."""
    
    async def test_swap_meals_success(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test successful meal swap."""
        trip, existing_meals = trip_with_assignments
        
        # Create another meal to swap with
        day_stmt = select(TripDay).where(
            TripDay.trip_id == trip.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(day_stmt)
        days = result.scalars().all()
        
        meal3 = TripMeal(
            day_id=days[1].id,
            recipe_id=mock_recipes[2].id,
            meal_slot="Breakfast",
            servings_override=5,
            notes="Original meal 3"
        )
        db_session.add(meal3)
        await db_session.commit()
        
        # Store original values
        meal1 = existing_meals[0]
        meal1_original_recipe = meal1.recipe_id
        meal3_original_recipe = meal3.recipe_id
        
        swap_data = MealAssignmentSwap(
            meal_id_1=meal1.id,
            meal_id_2=meal3.id
        )
        
        # Mock the database queries and response building
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[meal1, meal3])))
            )
            
            with patch.object(db_session, 'commit'), \
                 patch.object(db_session, 'refresh'), \
                 patch.object(
                     meal_assignment_service,
                     '_build_meal_assignment_response',
                     side_effect=[
                         MagicMock(id=meal1.id, recipe_id=meal3_original_recipe),
                         MagicMock(id=meal3.id, recipe_id=meal1_original_recipe)
                     ]
                 ):
                
                result1, result2 = await meal_assignment_service.swap_meals(
                    trip.id,
                    swap_data
                )
                
                # Verify swapped IDs
                assert result1.recipe_id == meal3_original_recipe
                assert result2.recipe_id == meal1_original_recipe
    
    async def test_swap_meals_not_found(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test swapping with non-existent meal."""
        trip, existing_meals = trip_with_assignments
        
        swap_data = MealAssignmentSwap(
            meal_id_1=existing_meals[0].id,
            meal_id_2=uuid4()  # Non-existent
        )
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[existing_meals[0]])))
            )
            
            with pytest.raises(NotFoundError) as exc_info:
                await meal_assignment_service.swap_meals(trip.id, swap_data)
            
            assert "One or both meal assignments not found" in str(exc_info.value)
    
    async def test_swap_meals_different_trip(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession,
        test_user
    ):
        """Test swapping meals from different trips."""
        trip1, existing_meals = trip_with_assignments
        
        # Create another trip
        trip2 = Trip(
            user_id=test_user.id,
            name="Another Trip",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 2, 2)
        )
        db_session.add(trip2)
        await db_session.commit()
        
        # Create day and meal for trip2
        day = TripDay(trip_id=trip2.id, day_number=1, date=date(2024, 2, 1))
        db_session.add(day)
        await db_session.commit()
        
        meal_other_trip = TripMeal(
            day_id=day.id,
            recipe_id=uuid4(),
            meal_slot="Breakfast"
        )
        db_session.add(meal_other_trip)
        await db_session.commit()
        
        # Mock day relationship
        meal_other_trip.day = day
        
        swap_data = MealAssignmentSwap(
            meal_id_1=existing_meals[0].id,
            meal_id_2=meal_other_trip.id
        )
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(
                    all=MagicMock(return_value=[existing_meals[0], meal_other_trip])
                ))
            )
            
            with pytest.raises(NotFoundError) as exc_info:
                await meal_assignment_service.swap_meals(trip1.id, swap_data)
            
            assert "not in the specified trip" in str(exc_info.value)


class TestPortionCalculations:
    """Test portion calculation functionality."""
    
    async def test_calculate_portions_success(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test successful portion calculation."""
        trip, existing_meals = trip_with_assignments
        meal = existing_meals[0]
        
        # Mock the meal query and coefficient calculator
        with patch.object(db_session, 'execute') as mock_execute:
            # Create a mock meal with all necessary attributes
            mock_meal = MagicMock(
                id=meal.id,
                day_id=meal.day_id,
                recipe_id=meal.recipe_id,
                meal_slot=meal.meal_slot,
                servings_override=6,
                day=MagicMock(
                    trip_id=trip.id,
                    trip=MagicMock(
                        participants=[]
                    )
                ),
                recipe=mock_recipes[0]
            )
            
            mock_execute.return_value = MagicMock(
                scalar_one_or_none=MagicMock(return_value=mock_meal)
            )
            
            # Mock coefficient calculator
            mock_meal_summary = MagicMock(
                effective_count=Decimal("5.5"),
                participant_count=2,
                participants=[
                    {"id": uuid4(), "coefficient": Decimal("1.0")},
                    {"id": uuid4(), "coefficient": Decimal("0.5")}
                ]
            )
            
            with patch.object(
                meal_assignment_service.coefficient_calculator,
                'calculate_meal_participants',
                return_value=mock_meal_summary
            ):
                result = await meal_assignment_service.calculate_portions(
                    trip.id,
                    meal.id
                )
                
                assert result.meal_id == meal.id
                assert result.recipe_id == meal.recipe_id
                assert result.recipe_name == "Scrambled Eggs"
                assert result.base_servings == 4
                assert result.required_servings == 6  # servings_override
                assert result.scaling_factor == Decimal("1.5")  # 6/4
                assert result.participant_count == 2
                assert len(result.meal_coefficients) == 2
    
    async def test_calculate_portions_not_found(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip
    ):
        """Test portion calculation for non-existent meal."""
        with pytest.raises(NotFoundError):
            await meal_assignment_service.calculate_portions(
                trip_with_meal_slots.id,
                uuid4()  # Non-existent meal
            )


class TestMealListingAndRetrieval:
    """Test meal listing and retrieval operations."""
    
    async def test_get_meal_assignment(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test getting a single meal assignment."""
        trip, existing_meals = trip_with_assignments
        meal = existing_meals[0]
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalar_one_or_none=MagicMock(return_value=meal)
            )
            
            with patch.object(
                meal_assignment_service,
                '_build_meal_assignment_response',
                return_value=MagicMock(id=meal.id, meal_slot=meal.meal_slot)
            ):
                result = await meal_assignment_service.get_meal_assignment(
                    trip.id,
                    meal.id
                )
                
                assert result.id == meal.id
                assert result.meal_slot == meal.meal_slot
    
    async def test_list_trip_meals(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test listing all trip meals."""
        trip, existing_meals = trip_with_assignments
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(
                    unique=MagicMock(return_value=MagicMock(
                        all=MagicMock(return_value=existing_meals)
                    ))
                ))
            )
            
            with patch.object(
                meal_assignment_service,
                '_build_meal_assignment_response',
                side_effect=[
                    MagicMock(id=meal.id, meal_slot=meal.meal_slot)
                    for meal in existing_meals
                ]
            ):
                results = await meal_assignment_service.list_trip_meals(trip.id)
                
                assert len(results) == 2
                assert results[0].meal_slot == "Breakfast"
                assert results[1].meal_slot == "Lunch"
    
    async def test_list_trip_meals_filtered_by_day(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test listing meals filtered by day."""
        trip, existing_meals = trip_with_assignments
        day_id = existing_meals[0].day_id
        
        # Only meals from the same day
        day_meals = [m for m in existing_meals if m.day_id == day_id]
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(
                    unique=MagicMock(return_value=MagicMock(
                        all=MagicMock(return_value=day_meals)
                    ))
                ))
            )
            
            with patch.object(
                meal_assignment_service,
                '_build_meal_assignment_response',
                side_effect=[
                    MagicMock(id=meal.id, meal_slot=meal.meal_slot)
                    for meal in day_meals
                ]
            ):
                results = await meal_assignment_service.list_trip_meals(
                    trip.id,
                    day_id=day_id
                )
                
                assert len(results) == len(day_meals)
                assert all(m.id in [meal.id for meal in day_meals] for m in results)
    
    async def test_list_trip_meals_filtered_by_slot(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test listing meals filtered by meal slot."""
        trip, existing_meals = trip_with_assignments
        
        # Only breakfast meals
        breakfast_meals = [m for m in existing_meals if m.meal_slot == "Breakfast"]
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(
                    unique=MagicMock(return_value=MagicMock(
                        all=MagicMock(return_value=breakfast_meals)
                    ))
                ))
            )
            
            with patch.object(
                meal_assignment_service,
                '_build_meal_assignment_response',
                side_effect=[
                    MagicMock(id=meal.id, meal_slot=meal.meal_slot)
                    for meal in breakfast_meals
                ]
            ):
                results = await meal_assignment_service.list_trip_meals(
                    trip.id,
                    meal_slot="Breakfast"
                )
                
                assert len(results) == len(breakfast_meals)
                assert all(m.meal_slot == "Breakfast" for m in results)


class TestMealPlanAndStatus:
    """Test meal plan and status operations."""
    
    async def test_get_meals_by_day(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test getting meals grouped by day."""
        trip, existing_meals = trip_with_assignments
        
        # Get days with meals
        day_stmt = select(TripDay).where(
            TripDay.trip_id == trip.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(day_stmt)
        days = result.scalars().all()
        
        # Set up meals for the first day
        days[0].meals = existing_meals
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalars=MagicMock(return_value=MagicMock(
                    unique=MagicMock(return_value=MagicMock(
                        all=MagicMock(return_value=[days[0]])
                    ))
                ))
            )
            
            with patch.object(
                meal_assignment_service,
                '_build_meal_assignment_response',
                side_effect=[
                    MagicMock(
                        id=meal.id,
                        meal_slot=meal.meal_slot,
                        day_id=meal.day_id
                    )
                    for meal in existing_meals
                ]
            ):
                results = await meal_assignment_service.get_meals_by_day(trip.id)
                
                assert len(results) >= 1
                assert results[0].day_number == 1
                assert results[0].total_meals == 2
                assert len(results[0].meal_assignments) == 2
    
    async def test_get_trip_meal_plan(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test getting complete trip meal plan."""
        trip, existing_meals = trip_with_assignments
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalar_one_or_none=MagicMock(return_value=trip)
            )
            
            # Mock get_meals_by_day
            mock_days = [
                DayMealAssignments(
                    day_id=uuid4(),
                    day_number=1,
                    date="2024-01-01",
                    meal_assignments=[],
                    total_meals=2
                ),
                DayMealAssignments(
                    day_id=uuid4(),
                    day_number=2,
                    date="2024-01-02",
                    meal_assignments=[],
                    total_meals=0
                ),
                DayMealAssignments(
                    day_id=uuid4(),
                    day_number=3,
                    date="2024-01-03",
                    meal_assignments=[],
                    total_meals=1
                )
            ]
            
            with patch.object(
                meal_assignment_service,
                'get_meals_by_day',
                return_value=mock_days
            ):
                result = await meal_assignment_service.get_trip_meal_plan(trip.id)
                
                assert result.trip_id == trip.id
                assert result.trip_name == trip.name
                assert result.total_days == 3
                assert result.total_meals == 3
                assert len(result.days) == 3
    
    async def test_get_planning_status(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test getting meal planning status."""
        trip, existing_meals = trip_with_assignments
        
        with patch.object(db_session, 'execute') as mock_execute:
            # Mock the queries
            mock_execute.side_effect = [
                # Total slots count
                MagicMock(scalar=MagicMock(return_value=9)),  # 3 meals x 3 days
                # Assigned meals count
                MagicMock(scalar=MagicMock(return_value=2)),  # 2 existing meals
                # Unassigned slots details
                MagicMock(all=MagicMock(return_value=[
                    MagicMock(meal_type="Dinner", day_number=1, id=uuid4()),
                    MagicMock(meal_type="Breakfast", day_number=2, id=uuid4()),
                    MagicMock(meal_type="Lunch", day_number=2, id=uuid4()),
                    MagicMock(meal_type="Dinner", day_number=2, id=uuid4()),
                    MagicMock(meal_type="Breakfast", day_number=3, id=uuid4()),
                    MagicMock(meal_type="Lunch", day_number=3, id=uuid4()),
                    MagicMock(meal_type="Dinner", day_number=3, id=uuid4()),
                ]))
            ]
            
            result = await meal_assignment_service.get_planning_status(trip.id)
            
            assert result.trip_id == trip.id
            assert result.total_meal_slots == 9
            assert result.assigned_meals == 2
            assert result.unassigned_slots == 7
            assert len(result.unassigned_details) == 7


class TestRecipeSnapshot:
    """Test recipe snapshot functionality."""
    
    async def test_create_recipe_snapshot(
        self,
        meal_assignment_service: MealAssignmentService,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test creating a recipe snapshot."""
        recipe = mock_recipes[0]
        
        # Mock recipe with ingredients loaded
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalar_one=MagicMock(return_value=recipe)
            )
            
            snapshot = await meal_assignment_service._create_recipe_snapshot(recipe)
            
            assert snapshot["id"] == recipe.id
            assert snapshot["name"] == recipe.name
            assert snapshot["servings"] == recipe.servings
            assert snapshot["total_time_minutes"] == recipe.total_time_minutes
            assert snapshot["difficulty"] == recipe.difficulty_level
            assert len(snapshot["ingredients"]) == 3
            assert snapshot["ingredients"][0]["name"] == "Eggs"
            assert snapshot["version"] == 1
    
    async def test_assign_recipe_with_snapshot(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test recipe assignment creates snapshot when track_changes is enabled."""
        # Ensure track_changes is True
        trip_with_meal_slots.track_changes = True
        
        # Get day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        day.trip = trip_with_meal_slots
        
        assignment_data = MealAssignmentCreate(
            day_id=day.id,
            recipe_id=mock_recipes[0].id,
            meal_slot="Breakfast"
        )
        
        with patch.object(db_session, 'execute') as mock_execute:
            # Mock queries
            mock_execute.side_effect = [
                # Day query
                MagicMock(scalar_one_or_none=MagicMock(return_value=day)),
                # Meal slot query
                MagicMock(scalar_one_or_none=MagicMock(return_value=MagicMock(
                    is_active=True,
                    meal_type="Breakfast"
                ))),
                # Exists query
                MagicMock(scalar=MagicMock(return_value=False)),
                # Recipe query
                MagicMock(scalar_one_or_none=MagicMock(return_value=mock_recipes[0]))
            ]
            
            with patch.object(
                meal_assignment_service,
                '_create_recipe_snapshot',
                return_value={"snapshot": "data"}
            ) as mock_snapshot:
                
                with patch.object(db_session, 'add'), \
                     patch.object(db_session, 'commit'), \
                     patch.object(db_session, 'refresh'), \
                     patch.object(
                         meal_assignment_service,
                         '_build_meal_assignment_response',
                         return_value=MagicMock(recipe_snapshot={"snapshot": "data"})
                     ):
                    
                    result = await meal_assignment_service.assign_recipe(
                        trip_with_meal_slots.id,
                        assignment_data
                    )
                    
                    mock_snapshot.assert_called_once()
                    assert result.recipe_snapshot == {"snapshot": "data"}


class TestMealAssignmentEdgeCases:
    """Test edge cases and error conditions."""
    
    async def test_assign_recipe_case_insensitive_meal_slot(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test meal slot matching is case-insensitive."""
        # Get day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        assignment_data = MealAssignmentCreate(
            day_id=day.id,
            recipe_id=mock_recipes[0].id,
            meal_slot="bReAkFaSt"  # Mixed case
        )
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.side_effect = [
                # Day query
                MagicMock(scalar_one_or_none=MagicMock(return_value=day)),
                # Meal slot query - should find it despite case difference
                MagicMock(scalar_one_or_none=MagicMock(return_value=MagicMock(
                    is_active=True,
                    meal_type="Breakfast"
                ))),
                # Exists query
                MagicMock(scalar=MagicMock(return_value=False)),
                # Recipe query
                MagicMock(scalar_one_or_none=MagicMock(return_value=mock_recipes[0]))
            ]
            
            with patch.object(db_session, 'add'), \
                 patch.object(db_session, 'commit'), \
                 patch.object(db_session, 'refresh'), \
                 patch.object(
                     meal_assignment_service,
                     '_build_meal_assignment_response',
                     return_value=MagicMock(meal_slot="bReAkFaSt")
                 ):
                
                result = await meal_assignment_service.assign_recipe(
                    trip_with_meal_slots.id,
                    assignment_data
                )
                
                assert result.meal_slot == "bReAkFaSt"
    
    async def test_update_assignment_clear_notes(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        db_session: AsyncSession
    ):
        """Test clearing notes by setting to empty string."""
        trip, existing_meals = trip_with_assignments
        meal = existing_meals[0]
        meal.notes = "Original notes"
        
        update_data = MealAssignmentUpdate(notes="")
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_execute.return_value = MagicMock(
                scalar_one_or_none=MagicMock(return_value=meal)
            )
            
            with patch.object(db_session, 'commit'), \
                 patch.object(db_session, 'refresh'), \
                 patch.object(
                     meal_assignment_service,
                     '_build_meal_assignment_response',
                     return_value=MagicMock(notes=None)
                 ):
                
                result = await meal_assignment_service.update_assignment(
                    trip.id,
                    meal.id,
                    update_data
                )
                
                assert meal.notes is None  # Should be cleared
    
    async def test_portion_calculation_without_servings_override(
        self,
        meal_assignment_service: MealAssignmentService,
        trip_with_assignments: tuple,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test portion calculation uses effective count when no override."""
        trip, existing_meals = trip_with_assignments
        meal = existing_meals[1]  # This one has no servings_override
        meal.servings_override = None
        
        with patch.object(db_session, 'execute') as mock_execute:
            mock_meal = MagicMock(
                id=meal.id,
                day_id=meal.day_id,
                recipe_id=meal.recipe_id,
                meal_slot=meal.meal_slot,
                servings_override=None,
                day=MagicMock(
                    trip_id=trip.id,
                    trip=MagicMock(participants=[])
                ),
                recipe=mock_recipes[1]
            )
            
            mock_execute.return_value = MagicMock(
                scalar_one_or_none=MagicMock(return_value=mock_meal)
            )
            
            # Mock coefficient calculator
            mock_meal_summary = MagicMock(
                effective_count=Decimal("5.5"),
                participant_count=2,
                participants=[
                    {"id": uuid4(), "coefficient": Decimal("1.0")},
                    {"id": uuid4(), "coefficient": Decimal("0.5")}
                ]
            )
            
            with patch.object(
                meal_assignment_service.coefficient_calculator,
                'calculate_meal_participants',
                return_value=mock_meal_summary
            ):
                result = await meal_assignment_service.calculate_portions(
                    trip.id,
                    meal.id
                )
                
                # Should use effective count rounded
                assert result.required_servings == 6  # 5.5 rounded up


# Alias for pytest compatibility
test_user = pytest.fixture(lambda existing_user: existing_user)