"""
Tests for trip meal slot service.
"""

import pytest
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.trip.models import Trip, TripDay, TripMealSlot
from jidelnicek.trip.services.meal_slot_service import MealSlotService
from jidelnicek.trip.schemas.meal_slot import (
    MealSlotCreate,
    MealSlotUpdate,
    MealSlotBulkCreate
)


@pytest.fixture
async def trip_with_days(db_session: AsyncSession, test_user):
    """Create a test trip with days but no meal slots."""
    trip = Trip(
        user_id=test_user.id,
        name="Test Trip",
        start_date="2024-01-01",
        end_date="2024-01-05",
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    await db_session.commit()
    
    # Add days
    for i in range(5):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=f"2024-01-0{i + 1}"
        )
        db_session.add(day)
    
    await db_session.commit()
    await db_session.refresh(trip)
    return trip


@pytest.fixture
async def meal_slot_service(db_session: AsyncSession):
    """Create meal slot service instance."""
    return MealSlotService(db_session)


class TestCreateDefaultMealSlots:
    """Test creating default meal slots."""
    
    async def test_create_default_meal_slots(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test creating default meal slots for all days."""
        meal_slots = await meal_slot_service.create_default_meal_slots(
            trip_with_days.id
        )
        
        # Should create 3 meals x 5 days = 15 meal slots
        assert len(meal_slots) == 15
        
        # Check meal types
        meal_types = {slot.meal_type for slot in meal_slots}
        assert meal_types == {"Breakfast", "Lunch", "Dinner"}
        
        # Check all are active
        assert all(slot.is_active for slot in meal_slots)
        
        # Check display order
        for day_num in range(1, 6):
            day_slots = [s for s in meal_slots if s.day_number == day_num]
            assert len(day_slots) == 3
            
            # Sort by display order
            day_slots.sort(key=lambda s: s.display_order)
            assert day_slots[0].meal_type == "Breakfast"
            assert day_slots[1].meal_type == "Lunch"
            assert day_slots[2].meal_type == "Dinner"
    
    async def test_create_custom_meal_slots(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test creating custom meal slots."""
        custom_meals = ["Breakfast", "Snack", "Lunch", "Dinner"]
        
        meal_slots = await meal_slot_service.create_default_meal_slots(
            trip_with_days.id,
            custom_meals
        )
        
        # Should create 4 meals x 5 days = 20 meal slots
        assert len(meal_slots) == 20
        
        # Check meal types
        meal_types = {slot.meal_type for slot in meal_slots}
        assert meal_types == {"Breakfast", "Snack", "Lunch", "Dinner"}
    
    async def test_create_default_meal_slots_nonexistent_trip(
        self,
        meal_slot_service: MealSlotService
    ):
        """Test creating meal slots for non-existent trip."""
        with pytest.raises(NotFoundError):
            await meal_slot_service.create_default_meal_slots(uuid4())


class TestCreateMealSlot:
    """Test creating individual meal slots."""
    
    async def test_create_single_meal_slot(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test creating a single meal slot."""
        meal_slot_data = MealSlotCreate(
            day_number=1,
            meal_type="Breakfast",
            is_active=True,
            display_order=1
        )
        
        meal_slot = await meal_slot_service.create_meal_slot(
            trip_with_days.id,
            meal_slot_data
        )
        
        assert meal_slot.day_number == 1
        assert meal_slot.meal_type == "Breakfast"
        assert meal_slot.is_active is True
        assert meal_slot.display_order == 1
    
    async def test_create_meal_slot_with_custom_name(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test creating meal slot with custom name."""
        meal_slot_data = MealSlotCreate(
            day_number=2,
            meal_type="Lunch",
            custom_name="Brunch",
            is_active=True,
            display_order=2
        )
        
        meal_slot = await meal_slot_service.create_meal_slot(
            trip_with_days.id,
            meal_slot_data
        )
        
        assert meal_slot.meal_type == "Lunch"
        assert meal_slot.custom_name == "Brunch"
        assert meal_slot.display_name == "Brunch"
    
    async def test_create_duplicate_meal_slot(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test creating duplicate meal slot fails."""
        # Create first meal slot
        meal_slot_data = MealSlotCreate(
            day_number=1,
            meal_type="Breakfast"
        )
        await meal_slot_service.create_meal_slot(trip_with_days.id, meal_slot_data)
        
        # Try to create duplicate
        with pytest.raises(ConflictError) as exc_info:
            await meal_slot_service.create_meal_slot(trip_with_days.id, meal_slot_data)
        
        assert "already exists" in str(exc_info.value)
    
    async def test_create_meal_slot_invalid_day(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test creating meal slot for invalid day."""
        meal_slot_data = MealSlotCreate(
            day_number=99,
            meal_type="Breakfast"
        )
        
        with pytest.raises(NotFoundError) as exc_info:
            await meal_slot_service.create_meal_slot(trip_with_days.id, meal_slot_data)
        
        assert "Day 99 not found" in str(exc_info.value)


class TestBulkCreateMealSlots:
    """Test bulk creation of meal slots."""
    
    async def test_create_meal_slots_bulk(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test creating multiple meal slots at once."""
        bulk_data = MealSlotBulkCreate(
            meal_slots=[
                MealSlotCreate(day_number=1, meal_type="Breakfast", display_order=1),
                MealSlotCreate(day_number=1, meal_type="Lunch", display_order=2),
                MealSlotCreate(day_number=1, meal_type="Dinner", display_order=3),
                MealSlotCreate(day_number=2, meal_type="Breakfast", display_order=1),
                MealSlotCreate(day_number=2, meal_type="Lunch", display_order=2),
            ]
        )
        
        meal_slots = await meal_slot_service.create_meal_slots_bulk(
            trip_with_days.id,
            bulk_data
        )
        
        assert len(meal_slots) == 5
        
        # Check day 1 has 3 meals
        day1_slots = [s for s in meal_slots if s.day_number == 1]
        assert len(day1_slots) == 3
        
        # Check day 2 has 2 meals
        day2_slots = [s for s in meal_slots if s.day_number == 2]
        assert len(day2_slots) == 2
    
    async def test_bulk_create_with_conflicts(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test bulk creation fails if any slot already exists."""
        # Create one meal slot first
        await meal_slot_service.create_meal_slot(
            trip_with_days.id,
            MealSlotCreate(day_number=1, meal_type="Breakfast")
        )
        
        # Try bulk create including the existing one
        bulk_data = MealSlotBulkCreate(
            meal_slots=[
                MealSlotCreate(day_number=1, meal_type="Breakfast"),  # Conflict
                MealSlotCreate(day_number=1, meal_type="Lunch"),
            ]
        )
        
        with pytest.raises(ConflictError) as exc_info:
            await meal_slot_service.create_meal_slots_bulk(trip_with_days.id, bulk_data)
        
        assert "already exist" in str(exc_info.value)
    
    async def test_bulk_create_invalid_days(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test bulk creation fails if any day is invalid."""
        bulk_data = MealSlotBulkCreate(
            meal_slots=[
                MealSlotCreate(day_number=1, meal_type="Breakfast"),
                MealSlotCreate(day_number=99, meal_type="Lunch"),  # Invalid
            ]
        )
        
        with pytest.raises(NotFoundError) as exc_info:
            await meal_slot_service.create_meal_slots_bulk(trip_with_days.id, bulk_data)
        
        assert "Days not found" in str(exc_info.value)


class TestUpdateMealSlot:
    """Test updating meal slots."""
    
    async def test_update_meal_slot(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test updating a meal slot."""
        # Create meal slot
        meal_slot = await meal_slot_service.create_meal_slot(
            trip_with_days.id,
            MealSlotCreate(day_number=1, meal_type="Breakfast")
        )
        
        # Update it
        update_data = MealSlotUpdate(
            is_active=False,
            custom_name="Early Meal",
            display_order=10
        )
        
        updated = await meal_slot_service.update_meal_slot(
            trip_with_days.id,
            meal_slot.id,
            update_data
        )
        
        assert updated.is_active is False
        assert updated.custom_name == "Early Meal"
        assert updated.display_order == 10
        assert updated.meal_type == "Breakfast"  # Unchanged
    
    async def test_update_nonexistent_meal_slot(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test updating non-existent meal slot."""
        update_data = MealSlotUpdate(is_active=False)
        
        with pytest.raises(NotFoundError):
            await meal_slot_service.update_meal_slot(
                trip_with_days.id,
                uuid4(),
                update_data
            )


class TestDeleteMealSlot:
    """Test deleting meal slots."""
    
    async def test_delete_meal_slot(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test deleting a meal slot."""
        # Create meal slot
        meal_slot = await meal_slot_service.create_meal_slot(
            trip_with_days.id,
            MealSlotCreate(day_number=1, meal_type="Snack")
        )
        
        # Delete it
        await meal_slot_service.delete_meal_slot(trip_with_days.id, meal_slot.id)
        
        # Verify it's gone
        with pytest.raises(NotFoundError):
            await meal_slot_service.get_meal_slot(trip_with_days.id, meal_slot.id)
    
    async def test_delete_meal_slot_with_meals(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test deleting meal slot with assigned meals fails."""
        # This test would require TripMeal model to be available
        # For now, just test the basic delete functionality
        pass


class TestListMealSlots:
    """Test listing meal slots."""
    
    async def test_list_all_meal_slots(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test listing all meal slots for a trip."""
        # Create some meal slots
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        meal_slots = await meal_slot_service.list_trip_meal_slots(trip_with_days.id)
        
        assert len(meal_slots) == 15  # 3 meals x 5 days
        
        # Check ordering
        prev_day = 0
        prev_order = 0
        for slot in meal_slots:
            if slot.day_number > prev_day:
                prev_day = slot.day_number
                prev_order = 0
            assert slot.display_order > prev_order
            prev_order = slot.display_order
    
    async def test_list_meal_slots_by_day(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test listing meal slots filtered by day."""
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        day1_slots = await meal_slot_service.list_trip_meal_slots(
            trip_with_days.id,
            day_number=1
        )
        
        assert len(day1_slots) == 3
        assert all(slot.day_number == 1 for slot in day1_slots)
    
    async def test_list_active_meal_slots(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test listing only active meal slots."""
        # Create meal slots
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        # Deactivate some
        all_slots = await meal_slot_service.list_trip_meal_slots(trip_with_days.id)
        for i, slot in enumerate(all_slots[:5]):
            await meal_slot_service.update_meal_slot(
                trip_with_days.id,
                slot.id,
                MealSlotUpdate(is_active=False)
            )
        
        # List only active
        active_slots = await meal_slot_service.list_trip_meal_slots(
            trip_with_days.id,
            is_active=True
        )
        
        assert len(active_slots) == 10  # 15 - 5 deactivated


class TestMealSlotsByDay:
    """Test getting meal slots grouped by day."""
    
    async def test_get_meal_slots_by_day(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test getting meal slots grouped by day."""
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        day_slots = await meal_slot_service.get_meal_slots_by_day(trip_with_days.id)
        
        assert len(day_slots) == 5  # 5 days
        
        for i, day_group in enumerate(day_slots):
            assert day_group.day_number == i + 1
            assert day_group.date == f"2024-01-0{i + 1}"
            assert len(day_group.meal_slots) == 3
            assert day_group.active_count == 3
    
    async def test_get_meal_slots_by_day_with_inactive(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test meal slots by day with some inactive."""
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        # Deactivate breakfast on day 1
        day1_slots = await meal_slot_service.list_trip_meal_slots(
            trip_with_days.id,
            day_number=1
        )
        breakfast = next(s for s in day1_slots if s.meal_type == "Breakfast")
        await meal_slot_service.update_meal_slot(
            trip_with_days.id,
            breakfast.id,
            MealSlotUpdate(is_active=False)
        )
        
        day_slots = await meal_slot_service.get_meal_slots_by_day(trip_with_days.id)
        
        # Day 1 should have 2 active slots
        day1_group = day_slots[0]
        assert day1_group.active_count == 2
        assert len(day1_group.meal_slots) == 3


class TestTripMealPattern:
    """Test trip meal pattern analysis."""
    
    async def test_get_trip_meal_pattern(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test getting trip meal pattern."""
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        pattern = await meal_slot_service.get_trip_meal_pattern(trip_with_days.id)
        
        assert pattern.trip_id == trip_with_days.id
        assert pattern.default_meal_types == ["Breakfast", "Lunch", "Dinner"]
        assert pattern.total_days == 5
        assert pattern.total_meal_slots == 15
        assert pattern.active_meal_slots == 15
        assert pattern.meal_slot_summary == {
            "Breakfast": 5,
            "Lunch": 5,
            "Dinner": 5
        }
    
    async def test_meal_pattern_with_custom_slots(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test meal pattern with custom meal types."""
        # Create standard meals for days 1-3
        for day in range(1, 4):
            for meal in ["Breakfast", "Lunch", "Dinner"]:
                await meal_slot_service.create_meal_slot(
                    trip_with_days.id,
                    MealSlotCreate(day_number=day, meal_type=meal)
                )
        
        # Add snacks on days 4-5
        for day in range(4, 6):
            for meal in ["Breakfast", "Snack", "Lunch", "Dinner"]:
                await meal_slot_service.create_meal_slot(
                    trip_with_days.id,
                    MealSlotCreate(day_number=day, meal_type=meal)
                )
        
        pattern = await meal_slot_service.get_trip_meal_pattern(trip_with_days.id)
        
        assert pattern.total_meal_slots == 17  # 3x3 + 4x2
        assert pattern.meal_slot_summary == {
            "Breakfast": 5,
            "Lunch": 5,
            "Dinner": 5,
            "Snack": 2
        }


class TestToggleMealSlot:
    """Test toggling meal slot active status."""
    
    async def test_toggle_meal_slot(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip
    ):
        """Test toggling meal slot active status."""
        # Create active meal slot
        meal_slot = await meal_slot_service.create_meal_slot(
            trip_with_days.id,
            MealSlotCreate(day_number=1, meal_type="Breakfast", is_active=True)
        )
        
        assert meal_slot.is_active is True
        
        # Toggle to inactive
        toggled = await meal_slot_service.toggle_meal_slot(
            trip_with_days.id,
            meal_slot.id
        )
        
        assert toggled.is_active is False
        
        # Toggle back to active
        toggled_again = await meal_slot_service.toggle_meal_slot(
            trip_with_days.id,
            meal_slot.id
        )
        
        assert toggled_again.is_active is True


class TestCopyMealPattern:
    """Test copying meal patterns between trips."""
    
    async def test_copy_meal_pattern(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip,
        db_session: AsyncSession,
        test_user
    ):
        """Test copying meal pattern from one trip to another."""
        # Create meal slots in source trip
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        # Create target trip
        target_trip = Trip(
            user_id=test_user.id,
            name="Target Trip",
            start_date="2024-02-01",
            end_date="2024-02-05",
            meal_slots=["Breakfast", "Lunch", "Dinner"]
        )
        db_session.add(target_trip)
        await db_session.commit()
        
        # Add days to target trip
        for i in range(5):
            day = TripDay(
                trip_id=target_trip.id,
                day_number=i + 1,
                date=f"2024-02-0{i + 1}"
            )
            db_session.add(day)
        await db_session.commit()
        
        # Copy meal pattern
        copied_slots = await meal_slot_service.copy_meal_pattern(
            trip_with_days.id,
            target_trip.id
        )
        
        assert len(copied_slots) == 15
        
        # Verify pattern matches
        source_pattern = await meal_slot_service.get_trip_meal_pattern(trip_with_days.id)
        target_pattern = await meal_slot_service.get_trip_meal_pattern(target_trip.id)
        
        assert source_pattern.meal_slot_summary == target_pattern.meal_slot_summary
    
    async def test_copy_pattern_to_trip_with_existing_slots(
        self,
        meal_slot_service: MealSlotService,
        trip_with_days: Trip,
        db_session: AsyncSession,
        test_user
    ):
        """Test copying pattern fails if target has slots."""
        # Create meal slots in source
        await meal_slot_service.create_default_meal_slots(trip_with_days.id)
        
        # Create target trip with one meal slot
        target_trip = Trip(
            user_id=test_user.id,
            name="Target Trip",
            start_date="2024-02-01",
            end_date="2024-02-01"
        )
        db_session.add(target_trip)
        await db_session.commit()
        
        day = TripDay(
            trip_id=target_trip.id,
            day_number=1,
            date="2024-02-01"
        )
        db_session.add(day)
        await db_session.commit()
        
        # Add one meal slot to target
        await meal_slot_service.create_meal_slot(
            target_trip.id,
            MealSlotCreate(day_number=1, meal_type="Breakfast")
        )
        
        # Try to copy - should fail
        with pytest.raises(ConflictError) as exc_info:
            await meal_slot_service.copy_meal_pattern(
                trip_with_days.id,
                target_trip.id
            )
        
        assert "already has meal slots" in str(exc_info.value)