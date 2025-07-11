"""
Tests for trip participant service.
"""

import pytest
import pytest_asyncio
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.trip.models import Trip, TripParticipant, TripDay
from jidelnicek.trip.services.participant_service import ParticipantService
from jidelnicek.trip.schemas.participant import (
    ParticipantCreate,
    ParticipantUpdate
)


@pytest_asyncio.fixture(scope="function")
async def trip(db_session: AsyncSession, test_user):
    """Create a test trip."""
    trip = Trip(
        user_id=test_user.id,
        name="Test Trip",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=5),
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    
    # Add days
    for i in range(6):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=trip.start_date + timedelta(days=i)
        )
        db_session.add(day)
    
    await db_session.commit()
    await db_session.refresh(trip)
    return trip


@pytest_asyncio.fixture(scope="function")
async def participant_service(db_session: AsyncSession):
    """Create participant service instance."""
    return ParticipantService(db_session)


class TestAddParticipant:
    """Test adding participants to trips."""
    
    async def test_add_participant_with_name(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test adding a participant with name."""
        participant_data = ParticipantCreate(
            name="John Doe",
            coefficient=Decimal("100.00"),
            email="john@example.com"
        )
        
        participant = await participant_service.add_participant(
            trip.id,
            participant_data
        )
        
        assert participant.name == "John Doe"
        assert participant.number is None
        assert participant.coefficient == Decimal("100.00")
        assert participant.email == "john@example.com"
        assert participant.trip_id == trip.id
    
    async def test_add_participant_with_number(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test adding a participant with number."""
        participant_data = ParticipantCreate(
            number=1,
            coefficient=Decimal("80.00")
        )
        
        participant = await participant_service.add_participant(
            trip.id,
            participant_data
        )
        
        assert participant.name is None
        assert participant.number == 1
        assert participant.coefficient == Decimal("80.00")
        assert participant.display_name == "Participant 1"
    
    async def test_add_participant_with_meal_coefficients(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test adding a participant with meal-specific coefficients."""
        participant_data = ParticipantCreate(
            name="Jane Doe",
            coefficient=Decimal("100.00"),
            meal_coefficients={
                "breakfast": Decimal("50.00"),
                "lunch": Decimal("100.00"),
                "dinner": Decimal("120.00")
            }
        )
        
        participant = await participant_service.add_participant(
            trip.id,
            participant_data
        )
        
        assert participant.meal_coefficients["breakfast"] == Decimal("50.00")
        assert participant.meal_coefficients["lunch"] == Decimal("100.00")
        assert participant.meal_coefficients["dinner"] == Decimal("120.00")
    
    async def test_add_participant_with_partial_attendance(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test adding a participant with arrival/departure dates."""
        participant_data = ParticipantCreate(
            name="Partial Participant",
            coefficient=Decimal("100.00"),
            arrival_date=trip.start_date + timedelta(days=1),
            departure_date=trip.end_date - timedelta(days=1)
        )
        
        participant = await participant_service.add_participant(
            trip.id,
            participant_data
        )
        
        assert participant.arrival_date == trip.start_date + timedelta(days=1)
        assert participant.departure_date == trip.end_date - timedelta(days=1)
    
    async def test_add_participant_limit_exceeded(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test that adding more than 20 participants fails."""
        # Add 20 participants
        for i in range(20):
            p = TripParticipant(
                trip_id=trip.id,
                number=i + 1,
                coefficient=Decimal("100.00")
            )
            db_session.add(p)
        await db_session.commit()
        
        # Try to add 21st participant
        participant_data = ParticipantCreate(
            name="Extra Participant",
            coefficient=Decimal("100.00")
        )
        
        with pytest.raises(ConflictError) as exc_info:
            await participant_service.add_participant(trip.id, participant_data)
        
        assert "Cannot add more than 20 participants" in str(exc_info.value)
    
    async def test_add_participant_invalid_arrival_date(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test that arrival date before trip start fails."""
        participant_data = ParticipantCreate(
            name="Invalid Arrival",
            coefficient=Decimal("100.00"),
            arrival_date=trip.start_date - timedelta(days=1)
        )
        
        with pytest.raises(ValidationError) as exc_info:
            await participant_service.add_participant(trip.id, participant_data)
        
        assert "Arrival date cannot be before trip start date" in str(exc_info.value)
    
    async def test_add_participant_to_nonexistent_trip(
        self,
        participant_service: ParticipantService
    ):
        """Test adding participant to non-existent trip."""
        participant_data = ParticipantCreate(
            name="Test",
            coefficient=Decimal("100.00")
        )
        
        with pytest.raises(NotFoundError):
            await participant_service.add_participant(uuid4(), participant_data)


class TestUpdateParticipant:
    """Test updating participants."""
    
    async def test_update_participant_fields(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test updating participant fields."""
        # Create participant
        participant = TripParticipant(
            trip_id=trip.id,
            name="Original Name",
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        await db_session.commit()
        await db_session.refresh(participant)
        
        # Update participant
        update_data = ParticipantUpdate(
            email="new@example.com",
            coefficient=Decimal("80.00"),
            meal_coefficients={
                "breakfast": Decimal("50.00")
            }
        )
        
        updated = await participant_service.update_participant(
            trip.id,
            participant.id,
            update_data
        )
        
        assert updated.name == "Original Name"  # Unchanged
        assert updated.email == "new@example.com"
        assert updated.coefficient == Decimal("80.00")
        assert updated.meal_coefficients["breakfast"] == Decimal("50.00")
    
    async def test_update_participant_attendance_dates(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test updating participant attendance dates."""
        # Create participant
        participant = TripParticipant(
            trip_id=trip.id,
            name="Test Participant",
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        await db_session.commit()
        await db_session.refresh(participant)
        
        # Update with attendance dates
        update_data = ParticipantUpdate(
            arrival_date=trip.start_date + timedelta(days=1),
            departure_date=trip.end_date - timedelta(days=1)
        )
        
        updated = await participant_service.update_participant(
            trip.id,
            participant.id,
            update_data
        )
        
        assert updated.arrival_date == trip.start_date + timedelta(days=1)
        assert updated.departure_date == trip.end_date - timedelta(days=1)
    
    async def test_update_nonexistent_participant(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test updating non-existent participant."""
        update_data = ParticipantUpdate(email="test@example.com")
        
        with pytest.raises(NotFoundError):
            await participant_service.update_participant(
                trip.id,
                uuid4(),
                update_data
            )


class TestRemoveParticipant:
    """Test removing participants."""
    
    async def test_remove_participant(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test removing a participant."""
        # Create participant
        participant = TripParticipant(
            trip_id=trip.id,
            name="To Remove",
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        await db_session.commit()
        await db_session.refresh(participant)
        
        # Remove participant
        await participant_service.remove_participant(trip.id, participant.id)
        
        # Verify removed
        with pytest.raises(NotFoundError):
            await participant_service.get_participant(trip.id, participant.id)
    
    async def test_remove_nonexistent_participant(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test removing non-existent participant."""
        with pytest.raises(NotFoundError):
            await participant_service.remove_participant(trip.id, uuid4())


class TestGetParticipantsForDay:
    """Test getting participants for specific days."""
    
    async def test_get_all_participants_for_day(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test getting participants when all are present."""
        # Add participants
        participants = []
        for i in range(3):
            p = TripParticipant(
                trip_id=trip.id,
                number=i + 1,
                coefficient=Decimal("100.00")
            )
            db_session.add(p)
            participants.append(p)
        await db_session.commit()
        
        # Get participants for day 1
        day_participants = await participant_service.get_participants_for_day(
            trip.id, 1
        )
        
        assert day_participants.day_number == 1
        assert day_participants.date == trip.start_date
        assert day_participants.total_participants == 3
        assert day_participants.total_coefficient == Decimal("300.00")
        assert len(day_participants.participants) == 3
    
    async def test_get_partial_participants_for_day(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test getting participants with partial attendance."""
        # Add participants with different attendance
        # Full attendance
        p1 = TripParticipant(
            trip_id=trip.id,
            name="Full Timer",
            coefficient=Decimal("100.00")
        )
        # Arrives day 2
        p2 = TripParticipant(
            trip_id=trip.id,
            name="Late Arrival",
            coefficient=Decimal("100.00"),
            arrival_date=trip.start_date + timedelta(days=1)
        )
        # Departs day 3
        p3 = TripParticipant(
            trip_id=trip.id,
            name="Early Departure",
            coefficient=Decimal("100.00"),
            departure_date=trip.start_date + timedelta(days=2)
        )
        
        db_session.add_all([p1, p2, p3])
        await db_session.commit()
        
        # Day 1: Only p1 and p3
        day1 = await participant_service.get_participants_for_day(trip.id, 1)
        assert day1.total_participants == 2
        assert day1.total_coefficient == Decimal("200.00")
        
        # Day 2: All three
        day2 = await participant_service.get_participants_for_day(trip.id, 2)
        assert day2.total_participants == 3
        assert day2.total_coefficient == Decimal("300.00")
        
        # Day 4: Only p1 and p2
        day4 = await participant_service.get_participants_for_day(trip.id, 4)
        assert day4.total_participants == 2
        assert day4.total_coefficient == Decimal("200.00")
    
    async def test_get_participants_invalid_day(
        self,
        participant_service: ParticipantService,
        trip: Trip
    ):
        """Test getting participants for invalid day number."""
        with pytest.raises(NotFoundError) as exc_info:
            await participant_service.get_participants_for_day(trip.id, 99)
        
        assert "Day 99 not found" in str(exc_info.value)


class TestCalculateMealParticipants:
    """Test calculating meal participants."""
    
    async def test_calculate_meal_participants_with_coefficients(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test calculating meal participants with meal-specific coefficients."""
        # Add participants with different meal coefficients
        p1 = TripParticipant(
            trip_id=trip.id,
            name="Normal Eater",
            coefficient=Decimal("100.00")
        )
        p2 = TripParticipant(
            trip_id=trip.id,
            name="Light Breakfast",
            coefficient=Decimal("100.00"),
            meal_coefficients={
                "breakfast": Decimal("50.00"),
                "lunch": Decimal("100.00"),
                "dinner": Decimal("100.00")
            }
        )
        p3 = TripParticipant(
            trip_id=trip.id,
            name="Big Dinner",
            coefficient=Decimal("100.00"),
            meal_coefficients={
                "breakfast": Decimal("100.00"),
                "lunch": Decimal("100.00"),
                "dinner": Decimal("150.00")
            }
        )
        
        db_session.add_all([p1, p2, p3])
        await db_session.commit()
        
        # Calculate breakfast participants
        count, total = await participant_service.calculate_meal_participants(
            trip.id, 1, "breakfast"
        )
        assert count == 3
        assert total == Decimal("250.00")  # 100 + 50 + 100
        
        # Calculate dinner participants
        count, total = await participant_service.calculate_meal_participants(
            trip.id, 1, "dinner"
        )
        assert count == 3
        assert total == Decimal("350.00")  # 100 + 100 + 150
    
    async def test_calculate_meal_participants_with_partial_attendance(
        self,
        participant_service: ParticipantService,
        trip: Trip,
        db_session: AsyncSession
    ):
        """Test calculating meal participants with partial attendance."""
        # Add participants
        p1 = TripParticipant(
            trip_id=trip.id,
            name="Full Timer",
            coefficient=Decimal("100.00")
        )
        p2 = TripParticipant(
            trip_id=trip.id,
            name="Late Arrival",
            coefficient=Decimal("100.00"),
            arrival_date=trip.start_date + timedelta(days=2)
        )
        
        db_session.add_all([p1, p2])
        await db_session.commit()
        
        # Day 1: Only p1
        count, total = await participant_service.calculate_meal_participants(
            trip.id, 1, "lunch"
        )
        assert count == 1
        assert total == Decimal("100.00")
        
        # Day 3: Both participants
        count, total = await participant_service.calculate_meal_participants(
            trip.id, 3, "lunch"
        )
        assert count == 2
        assert total == Decimal("200.00")