"""
Tests for trip meal slot API endpoints.
"""

import pytest
import pytest_asyncio
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.trip.models import Trip, TripDay, TripMealSlot


@pytest_asyncio.fixture(scope="function")
async def trip_with_days(db_session: AsyncSession, test_user):
    """Create a test trip with days."""
    trip = Trip(
        user_id=test_user.id,
        name="Test Trip",
        start_date="2024-01-01",
        end_date="2024-01-03",
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    await db_session.commit()
    
    # Add days
    for i in range(3):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=f"2024-01-0{i + 1}"
        )
        db_session.add(day)
    
    await db_session.commit()
    await db_session.refresh(trip)
    return trip


@pytest_asyncio.fixture(scope="function")
async def source_trip_with_meal_slots(db_session: AsyncSession, test_user):
    """Create a source trip with meal slots configured."""
    trip = Trip(
        user_id=test_user.id,
        name="Source Trip",
        start_date="2024-02-01",
        end_date="2024-02-02",
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    await db_session.commit()
    
    # Add days and meal slots
    for i in range(2):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=f"2024-02-0{i + 1}"
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
    
    await db_session.commit()
    await db_session.refresh(trip)
    return trip


class TestCreateDefaultMealSlotsEndpoint:
    """Test POST /trips/{trip_id}/meal-slots/default endpoint."""
    
    async def test_create_default_meal_slots(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating default meal slots."""
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default",
            json=None
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 9  # 3 meals x 3 days
        
        # Check meal types
        meal_types = {slot["meal_type"] for slot in data}
        assert meal_types == {"Breakfast", "Lunch", "Dinner"}
    
    async def test_create_custom_meal_slots(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating custom meal slots."""
        meal_types = ["Breakfast", "Snack", "Lunch", "Dinner"]
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default",
            json=meal_types
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 12  # 4 meals x 3 days
        
        # Check meal types
        created_types = {slot["meal_type"] for slot in data}
        assert created_types == {"Breakfast", "Snack", "Lunch", "Dinner"}
    
    async def test_create_default_meal_slots_unauthorized(
        self,
        client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating meal slots without authentication."""
        response = await client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default"
        )
        
        assert response.status_code == 401


class TestCreateMealSlotEndpoint:
    """Test POST /trips/{trip_id}/meal-slots endpoint."""
    
    async def test_create_single_meal_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating a single meal slot."""
        meal_slot_data = {
            "day_number": 1,
            "meal_type": "Breakfast",
            "is_active": True,
            "display_order": 1
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json=meal_slot_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["day_number"] == 1
        assert data["meal_type"] == "Breakfast"
        assert data["is_active"] is True
        assert data["display_order"] == 1
    
    async def test_create_meal_slot_with_custom_name(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating meal slot with custom name."""
        meal_slot_data = {
            "day_number": 2,
            "meal_type": "Lunch",
            "custom_name": "Brunch",
            "is_active": True,
            "display_order": 2
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json=meal_slot_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["meal_type"] == "Lunch"
        assert data["custom_name"] == "Brunch"
        assert data["display_name"] == "Brunch"
    
    async def test_create_duplicate_meal_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating duplicate meal slot fails."""
        meal_slot_data = {
            "day_number": 1,
            "meal_type": "Breakfast"
        }
        
        # Create first
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json=meal_slot_data
        )
        assert response.status_code == 201
        
        # Try duplicate
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json=meal_slot_data
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]


class TestBulkCreateMealSlotsEndpoint:
    """Test POST /trips/{trip_id}/meal-slots/bulk endpoint."""
    
    async def test_create_meal_slots_bulk(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test creating multiple meal slots."""
        bulk_data = {
            "meal_slots": [
                {"day_number": 1, "meal_type": "Breakfast", "display_order": 1},
                {"day_number": 1, "meal_type": "Lunch", "display_order": 2},
                {"day_number": 1, "meal_type": "Dinner", "display_order": 3},
                {"day_number": 2, "meal_type": "Breakfast", "display_order": 1},
                {"day_number": 2, "meal_type": "Snack", "display_order": 2},
            ]
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/bulk",
            json=bulk_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 5
        
        # Check day 1 meals
        day1_meals = [s for s in data if s["day_number"] == 1]
        assert len(day1_meals) == 3
        
        # Check day 2 meals
        day2_meals = [s for s in data if s["day_number"] == 2]
        assert len(day2_meals) == 2
        assert any(s["meal_type"] == "Snack" for s in day2_meals)


class TestListMealSlotsEndpoint:
    """Test GET /trips/{trip_id}/meal-slots endpoint."""
    
    async def test_list_all_meal_slots(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test listing all meal slots."""
        # Create some meal slots first
        await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default"
        )
        
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/meal-slots"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 9  # 3 meals x 3 days
    
    async def test_list_meal_slots_by_day(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test listing meal slots filtered by day."""
        # Create meal slots
        await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default"
        )
        
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/meal-slots",
            params={"day_number": 1}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all(slot["day_number"] == 1 for slot in data)
    
    async def test_list_active_meal_slots(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test listing only active meal slots."""
        # Create meal slots
        await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default"
        )
        
        # Deactivate some directly in DB
        result = await db_session.execute(
            f"UPDATE trip_meal_slots SET is_active = false WHERE trip_id = '{trip_with_days.id}' AND meal_type = 'Breakfast'"
        )
        await db_session.commit()
        
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/meal-slots",
            params={"is_active": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 6  # 9 total - 3 breakfast slots
        assert all(slot["is_active"] for slot in data)


class TestMealSlotsByDayEndpoint:
    """Test GET /trips/{trip_id}/meal-slots/by-day endpoint."""
    
    async def test_get_meal_slots_by_day(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test getting meal slots grouped by day."""
        # Create meal slots
        await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default"
        )
        
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/meal-slots/by-day"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # 3 days
        
        for i, day_group in enumerate(data):
            assert day_group["day_number"] == i + 1
            assert day_group["date"] == f"2024-01-0{i + 1}"
            assert len(day_group["meal_slots"]) == 3
            assert day_group["active_count"] == 3


class TestMealPatternEndpoint:
    """Test GET /trips/{trip_id}/meal-slots/pattern endpoint."""
    
    async def test_get_trip_meal_pattern(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test getting trip meal pattern analysis."""
        # Create meal slots
        await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/default"
        )
        
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/meal-slots/pattern"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["trip_id"] == str(trip_with_days.id)
        assert data["total_days"] == 3
        assert data["total_meal_slots"] == 9
        assert data["active_meal_slots"] == 9
        assert data["meal_slot_summary"] == {
            "Breakfast": 3,
            "Lunch": 3,
            "Dinner": 3
        }


class TestUpdateMealSlotEndpoint:
    """Test PUT /trips/{trip_id}/meal-slots/{meal_slot_id} endpoint."""
    
    async def test_update_meal_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test updating a meal slot."""
        # Create meal slot
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json={"day_number": 1, "meal_type": "Breakfast"}
        )
        meal_slot_id = response.json()["id"]
        
        # Update it
        update_data = {
            "is_active": False,
            "custom_name": "Early Meal",
            "display_order": 10
        }
        
        response = await authenticated_client.put(
            f"/trips/{trip_with_days.id}/meal-slots/{meal_slot_id}",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert data["custom_name"] == "Early Meal"
        assert data["display_order"] == 10
        assert data["meal_type"] == "Breakfast"  # Unchanged


class TestToggleMealSlotEndpoint:
    """Test POST /trips/{trip_id}/meal-slots/{meal_slot_id}/toggle endpoint."""
    
    async def test_toggle_meal_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test toggling meal slot active status."""
        # Create active meal slot
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json={"day_number": 1, "meal_type": "Breakfast", "is_active": True}
        )
        meal_slot_id = response.json()["id"]
        assert response.json()["is_active"] is True
        
        # Toggle to inactive
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/{meal_slot_id}/toggle"
        )
        
        assert response.status_code == 200
        assert response.json()["is_active"] is False
        
        # Toggle back to active
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/{meal_slot_id}/toggle"
        )
        
        assert response.status_code == 200
        assert response.json()["is_active"] is True


class TestDeleteMealSlotEndpoint:
    """Test DELETE /trips/{trip_id}/meal-slots/{meal_slot_id} endpoint."""
    
    async def test_delete_meal_slot(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test deleting a meal slot."""
        # Create meal slot
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json={"day_number": 1, "meal_type": "Snack"}
        )
        meal_slot_id = response.json()["id"]
        
        # Delete it
        response = await authenticated_client.delete(
            f"/trips/{trip_with_days.id}/meal-slots/{meal_slot_id}"
        )
        
        assert response.status_code == 204
        
        # Verify it's gone
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/meal-slots"
        )
        assert response.status_code == 200
        assert len(response.json()) == 0


class TestCopyMealPatternEndpoint:
    """Test POST /trips/{trip_id}/meal-slots/copy-from/{source_trip_id} endpoint."""
    
    async def test_copy_meal_pattern(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        source_trip_with_meal_slots: Trip
    ):
        """Test copying meal pattern from another trip."""
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/copy-from/{source_trip_with_meal_slots.id}"
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 9  # 3 meals x 3 days in target
        
        # Verify pattern matches source (first 2 days)
        meal_types = {slot["meal_type"] for slot in data}
        assert meal_types == {"Breakfast", "Lunch", "Dinner"}
    
    async def test_copy_pattern_unauthorized_source(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test copying from another user's trip fails."""
        # Create another user's trip
        other_user_trip = Trip(
            user_id=uuid4(),  # Different user
            name="Other Trip",
            start_date="2024-03-01",
            end_date="2024-03-01"
        )
        db_session.add(other_user_trip)
        await db_session.commit()
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/copy-from/{other_user_trip.id}"
        )
        
        assert response.status_code == 404  # Should not find other user's trip
    
    async def test_copy_pattern_target_has_slots(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        source_trip_with_meal_slots: Trip
    ):
        """Test copying fails if target already has slots."""
        # Add one slot to target
        await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots",
            json={"day_number": 1, "meal_type": "Breakfast"}
        )
        
        # Try to copy
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/meal-slots/copy-from/{source_trip_with_meal_slots.id}"
        )
        
        assert response.status_code == 409
        assert "already has meal slots" in response.json()["detail"]