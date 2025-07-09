"""
Tests for trip meal assignment API endpoints.

Note: These tests are prepared for the meal assignment endpoints that will be implemented.
The endpoints follow the expected RESTful patterns based on the service implementation.
"""

import pytest
from uuid import uuid4, UUID
from unittest.mock import MagicMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.trip.models import Trip, TripDay, TripMealSlot, TripMeal, TripParticipant
from jidelnicek.trip.schemas.meal import (
    MealAssignment,
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
                 difficulty_level: str = "medium", instructions: str = "", user_id: UUID = None):
        self.id = id
        self.name = name
        self.servings = servings
        self.total_time_minutes = total_time_minutes
        self.difficulty_level = difficulty_level
        self.instructions = instructions
        self.user_id = user_id or uuid4()


@pytest.fixture
async def trip_with_meal_slots(db_session: AsyncSession, existing_user):
    """Create a test trip with days and meal slots."""
    trip = Trip(
        user_id=existing_user.id,
        name="Test Trip",
        start_date="2024-01-01",
        end_date="2024-01-03",
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    await db_session.commit()
    
    # Add days and meal slots
    for i in range(3):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=f"2024-01-0{i + 1}"
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


@pytest.fixture
async def mock_recipes(existing_user):
    """Create mock recipes for testing."""
    return [
        MockRecipe(
            id=uuid4(),
            name="Scrambled Eggs",
            servings=4,
            total_time_minutes=15,
            difficulty_level="easy",
            user_id=existing_user.id
        ),
        MockRecipe(
            id=uuid4(),
            name="Pasta Carbonara",
            servings=4,
            total_time_minutes=30,
            difficulty_level="medium",
            user_id=existing_user.id
        ),
        MockRecipe(
            id=uuid4(),
            name="Grilled Chicken",
            servings=4,
            total_time_minutes=45,
            difficulty_level="medium",
            user_id=existing_user.id
        )
    ]


@pytest.fixture
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


@pytest.fixture
async def authenticated_client(async_client: AsyncClient, auth_headers: dict) -> AsyncClient:
    """Create an authenticated client."""
    async_client.headers.update(auth_headers)
    return async_client


class TestAssignRecipeEndpoint:
    """Test POST /trips/{trip_id}/meals endpoint."""
    
    async def test_assign_recipe_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test successful recipe assignment."""
        # Get first day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        # Mock the Recipe query
        with patch('jidelnicek.recipe.models.recipe.Recipe') as MockRecipeModel:
            MockRecipeModel.query = MagicMock()
            MockRecipeModel.query.get = MagicMock(return_value=mock_recipes[0])
            
            response = await authenticated_client.post(
                f"/trips/{trip_with_meal_slots.id}/meals",
                json={
                    "day_id": str(day.id),
                    "recipe_id": str(mock_recipes[0].id),
                    "meal_slot": "Breakfast",
                    "servings_override": 6,
                    "notes": "Test meal"
                }
            )
            
            assert response.status_code == 201
            data = response.json()
            assert data["day_id"] == str(day.id)
            assert data["recipe_id"] == str(mock_recipes[0].id)
            assert data["meal_slot"] == "Breakfast"
            assert data["servings_override"] == 6
            assert data["notes"] == "Test meal"
    
    async def test_assign_recipe_unauthorized(
        self,
        async_client: AsyncClient,
        trip_with_meal_slots: Trip,
        mock_recipes: list
    ):
        """Test assignment without authentication."""
        response = await async_client.post(
            f"/trips/{trip_with_meal_slots.id}/meals",
            json={
                "day_id": str(uuid4()),
                "recipe_id": str(mock_recipes[0].id),
                "meal_slot": "Breakfast"
            }
        )
        
        assert response.status_code == 401
    
    async def test_assign_recipe_trip_not_found(
        self,
        authenticated_client: AsyncClient,
        mock_recipes: list
    ):
        """Test assignment to non-existent trip."""
        response = await authenticated_client.post(
            f"/trips/{uuid4()}/meals",
            json={
                "day_id": str(uuid4()),
                "recipe_id": str(mock_recipes[0].id),
                "meal_slot": "Breakfast"
            }
        )
        
        assert response.status_code == 404
    
    async def test_assign_recipe_invalid_day(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip,
        mock_recipes: list
    ):
        """Test assignment with invalid day ID."""
        response = await authenticated_client.post(
            f"/trips/{trip_with_meal_slots.id}/meals",
            json={
                "day_id": str(uuid4()),  # Non-existent day
                "recipe_id": str(mock_recipes[0].id),
                "meal_slot": "Breakfast"
            }
        )
        
        assert response.status_code == 404
        assert "Day" in response.json()["detail"]
    
    async def test_assign_recipe_slot_already_assigned(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple,
        mock_recipes: list
    ):
        """Test assignment to already assigned slot."""
        trip, existing_meals = trip_with_assignments
        
        response = await authenticated_client.post(
            f"/trips/{trip.id}/meals",
            json={
                "day_id": str(existing_meals[0].day_id),
                "recipe_id": str(mock_recipes[2].id),
                "meal_slot": existing_meals[0].meal_slot  # Already assigned
            }
        )
        
        assert response.status_code == 409
        assert "already has an assignment" in response.json()["detail"]


class TestUpdateAssignmentEndpoint:
    """Test PATCH /trips/{trip_id}/meals/{meal_id} endpoint."""
    
    async def test_update_assignment_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple,
        mock_recipes: list
    ):
        """Test successful assignment update."""
        trip, existing_meals = trip_with_assignments
        meal_to_update = existing_meals[0]
        
        response = await authenticated_client.patch(
            f"/trips/{trip.id}/meals/{meal_to_update.id}",
            json={
                "recipe_id": str(mock_recipes[2].id),
                "servings_override": 8,
                "notes": "Updated notes"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(meal_to_update.id)
        assert data["servings_override"] == 8
        assert data["notes"] == "Updated notes"
    
    async def test_update_assignment_partial(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test partial update (only servings)."""
        trip, existing_meals = trip_with_assignments
        meal_to_update = existing_meals[0]
        
        response = await authenticated_client.patch(
            f"/trips/{trip.id}/meals/{meal_to_update.id}",
            json={"servings_override": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["servings_override"] == 10
        # Other fields should remain unchanged
        assert data["meal_slot"] == meal_to_update.meal_slot
    
    async def test_update_assignment_not_found(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip
    ):
        """Test updating non-existent assignment."""
        response = await authenticated_client.patch(
            f"/trips/{trip_with_meal_slots.id}/meals/{uuid4()}",
            json={"servings_override": 10}
        )
        
        assert response.status_code == 404
    
    async def test_update_assignment_wrong_trip(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple,
        existing_user,
        db_session: AsyncSession
    ):
        """Test updating meal from different trip."""
        trip1, existing_meals = trip_with_assignments
        
        # Create another trip
        trip2 = Trip(
            user_id=existing_user.id,
            name="Another Trip",
            start_date="2024-02-01",
            end_date="2024-02-02"
        )
        db_session.add(trip2)
        await db_session.commit()
        
        response = await authenticated_client.patch(
            f"/trips/{trip2.id}/meals/{existing_meals[0].id}",
            json={"servings_override": 10}
        )
        
        assert response.status_code == 404


class TestRemoveAssignmentEndpoint:
    """Test DELETE /trips/{trip_id}/meals/{meal_id} endpoint."""
    
    async def test_remove_assignment_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test successful assignment removal."""
        trip, existing_meals = trip_with_assignments
        meal_to_remove = existing_meals[0]
        
        response = await authenticated_client.delete(
            f"/trips/{trip.id}/meals/{meal_to_remove.id}"
        )
        
        assert response.status_code == 204
    
    async def test_remove_assignment_not_found(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip
    ):
        """Test removing non-existent assignment."""
        response = await authenticated_client.delete(
            f"/trips/{trip_with_meal_slots.id}/meals/{uuid4()}"
        )
        
        assert response.status_code == 404
    
    async def test_remove_assignment_unauthorized(
        self,
        async_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test removal without authentication."""
        trip, existing_meals = trip_with_assignments
        
        response = await async_client.delete(
            f"/trips/{trip.id}/meals/{existing_meals[0].id}"
        )
        
        assert response.status_code == 401


class TestBulkOperationsEndpoints:
    """Test bulk operation endpoints."""
    
    async def test_bulk_assign_recipes(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test POST /trips/{trip_id}/meals/bulk endpoint."""
        # Get days
        day_stmt = select(TripDay).where(
            TripDay.trip_id == trip_with_meal_slots.id
        ).order_by(TripDay.day_number)
        result = await db_session.execute(day_stmt)
        days = result.scalars().all()
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_meal_slots.id}/meals/bulk",
            json={
                "assignments": [
                    {
                        "day_id": str(days[0].id),
                        "recipe_id": str(mock_recipes[0].id),
                        "meal_slot": "Breakfast"
                    },
                    {
                        "day_id": str(days[0].id),
                        "recipe_id": str(mock_recipes[1].id),
                        "meal_slot": "Lunch"
                    },
                    {
                        "day_id": str(days[1].id),
                        "recipe_id": str(mock_recipes[2].id),
                        "meal_slot": "Dinner"
                    }
                ]
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 3
        assert data[0]["meal_slot"] == "Breakfast"
        assert data[1]["meal_slot"] == "Lunch"
        assert data[2]["meal_slot"] == "Dinner"
    
    async def test_bulk_update_assignments(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test PATCH /trips/{trip_id}/meals/bulk endpoint."""
        trip, existing_meals = trip_with_assignments
        
        response = await authenticated_client.patch(
            f"/trips/{trip.id}/meals/bulk",
            json={
                "meal_ids": [str(meal.id) for meal in existing_meals],
                "update_data": {
                    "servings_override": 10,
                    "notes": "Bulk updated"
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(meal["servings_override"] == 10 for meal in data)
        assert all(meal["notes"] == "Bulk updated" for meal in data)


class TestMealSwappingEndpoint:
    """Test POST /trips/{trip_id}/meals/swap endpoint."""
    
    async def test_swap_meals_success(
        self,
        authenticated_client: AsyncClient,
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
            meal_slot="Breakfast"
        )
        db_session.add(meal3)
        await db_session.commit()
        
        response = await authenticated_client.post(
            f"/trips/{trip.id}/meals/swap",
            json={
                "meal_id_1": str(existing_meals[0].id),
                "meal_id_2": str(meal3.id)
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Meals should be swapped
        assert data[0]["id"] == str(existing_meals[0].id)
        assert data[1]["id"] == str(meal3.id)
    
    async def test_swap_meals_not_found(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test swapping with non-existent meal."""
        trip, existing_meals = trip_with_assignments
        
        response = await authenticated_client.post(
            f"/trips/{trip.id}/meals/swap",
            json={
                "meal_id_1": str(existing_meals[0].id),
                "meal_id_2": str(uuid4())  # Non-existent
            }
        )
        
        assert response.status_code == 404


class TestPortionCalculationEndpoint:
    """Test GET /trips/{trip_id}/meals/{meal_id}/portions endpoint."""
    
    async def test_calculate_portions_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test successful portion calculation."""
        trip, existing_meals = trip_with_assignments
        meal = existing_meals[0]
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meals/{meal.id}/portions"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["meal_id"] == str(meal.id)
        assert "base_servings" in data
        assert "required_servings" in data
        assert "scaling_factor" in data
        assert "participant_count" in data
        assert "meal_coefficients" in data
    
    async def test_calculate_portions_not_found(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip
    ):
        """Test portion calculation for non-existent meal."""
        response = await authenticated_client.get(
            f"/trips/{trip_with_meal_slots.id}/meals/{uuid4()}/portions"
        )
        
        assert response.status_code == 404


class TestMealListingEndpoints:
    """Test meal listing endpoints."""
    
    async def test_get_meal_assignment(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test GET /trips/{trip_id}/meals/{meal_id} endpoint."""
        trip, existing_meals = trip_with_assignments
        meal = existing_meals[0]
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meals/{meal.id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(meal.id)
        assert data["meal_slot"] == meal.meal_slot
    
    async def test_list_trip_meals(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test GET /trips/{trip_id}/meals endpoint."""
        trip, existing_meals = trip_with_assignments
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meals"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        assert any(meal["meal_slot"] == "Breakfast" for meal in data)
        assert any(meal["meal_slot"] == "Lunch" for meal in data)
    
    async def test_list_trip_meals_filtered_by_day(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test listing meals filtered by day."""
        trip, existing_meals = trip_with_assignments
        day_id = existing_meals[0].day_id
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meals",
            params={"day_id": str(day_id)}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(meal["day_id"] == str(day_id) for meal in data)
    
    async def test_list_trip_meals_filtered_by_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test listing meals filtered by meal slot."""
        trip, existing_meals = trip_with_assignments
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meals",
            params={"meal_slot": "Breakfast"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(meal["meal_slot"] == "Breakfast" for meal in data)


class TestMealPlanEndpoints:
    """Test meal plan and status endpoints."""
    
    async def test_get_meals_by_day(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test GET /trips/{trip_id}/meals/by-day endpoint."""
        trip, _ = trip_with_assignments
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meals/by-day"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "day_id" in data[0]
        assert "day_number" in data[0]
        assert "date" in data[0]
        assert "meal_assignments" in data[0]
        assert "total_meals" in data[0]
    
    async def test_get_trip_meal_plan(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test GET /trips/{trip_id}/meal-plan endpoint."""
        trip, _ = trip_with_assignments
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meal-plan"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["trip_id"] == str(trip.id)
        assert data["trip_name"] == trip.name
        assert "start_date" in data
        assert "end_date" in data
        assert "days" in data
        assert "total_days" in data
        assert "total_meals" in data
        assert "total_unique_recipes" in data
    
    async def test_get_planning_status(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test GET /trips/{trip_id}/meal-plan/status endpoint."""
        trip, _ = trip_with_assignments
        
        response = await authenticated_client.get(
            f"/trips/{trip.id}/meal-plan/status"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["trip_id"] == str(trip.id)
        assert "total_meal_slots" in data
        assert "assigned_meals" in data
        assert "unassigned_slots" in data
        assert "completion_percentage" in data
        assert "unassigned_details" in data
        assert isinstance(data["unassigned_details"], list)


class TestMealAssignmentValidation:
    """Test validation for meal assignment endpoints."""
    
    async def test_create_assignment_invalid_servings(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test creating assignment with invalid servings."""
        # Get day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_meal_slots.id}/meals",
            json={
                "day_id": str(day.id),
                "recipe_id": str(mock_recipes[0].id),
                "meal_slot": "Breakfast",
                "servings_override": 0  # Invalid
            }
        )
        
        assert response.status_code == 422
        assert "servings_override" in response.text
    
    async def test_create_assignment_empty_meal_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_meal_slots: Trip,
        mock_recipes: list,
        db_session: AsyncSession
    ):
        """Test creating assignment with empty meal slot."""
        # Get day
        day_stmt = select(TripDay).where(TripDay.trip_id == trip_with_meal_slots.id)
        result = await db_session.execute(day_stmt)
        day = result.scalars().first()
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_meal_slots.id}/meals",
            json={
                "day_id": str(day.id),
                "recipe_id": str(mock_recipes[0].id),
                "meal_slot": ""  # Empty
            }
        )
        
        assert response.status_code == 422
        assert "meal_slot" in response.text
    
    async def test_update_assignment_invalid_data(
        self,
        authenticated_client: AsyncClient,
        trip_with_assignments: tuple
    ):
        """Test updating assignment with invalid data."""
        trip, existing_meals = trip_with_assignments
        
        response = await authenticated_client.patch(
            f"/trips/{trip.id}/meals/{existing_meals[0].id}",
            json={
                "servings_override": -1  # Invalid
            }
        )
        
        assert response.status_code == 422


class TestMealAssignmentPermissions:
    """Test permission checks for meal assignment endpoints."""
    
    async def test_assign_recipe_other_user_trip(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        mock_recipes: list
    ):
        """Test assigning to another user's trip."""
        # Create another user's trip
        other_user_id = uuid4()
        other_trip = Trip(
            user_id=other_user_id,
            name="Other User Trip",
            start_date="2024-01-01",
            end_date="2024-01-02"
        )
        db_session.add(other_trip)
        await db_session.commit()
        
        response = await authenticated_client.post(
            f"/trips/{other_trip.id}/meals",
            json={
                "day_id": str(uuid4()),
                "recipe_id": str(mock_recipes[0].id),
                "meal_slot": "Breakfast"
            }
        )
        
        assert response.status_code == 404  # Trip not found for this user
    
    async def test_update_assignment_other_user_trip(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test updating meal in another user's trip."""
        # Create another user's trip with meal
        other_user_id = uuid4()
        other_trip = Trip(
            user_id=other_user_id,
            name="Other User Trip",
            start_date="2024-01-01",
            end_date="2024-01-02"
        )
        db_session.add(other_trip)
        await db_session.commit()
        
        day = TripDay(
            trip_id=other_trip.id,
            day_number=1,
            date="2024-01-01"
        )
        db_session.add(day)
        await db_session.commit()
        
        meal = TripMeal(
            day_id=day.id,
            recipe_id=uuid4(),
            meal_slot="Breakfast"
        )
        db_session.add(meal)
        await db_session.commit()
        
        response = await authenticated_client.patch(
            f"/trips/{other_trip.id}/meals/{meal.id}",
            json={"servings_override": 8}
        )
        
        assert response.status_code == 404