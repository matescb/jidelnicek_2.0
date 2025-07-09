"""
Tests for trip cloning functionality.
"""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from jidelnicek.trip.services.trip_service import TripService
from jidelnicek.trip.schemas.trip import TripCloneRequest
from jidelnicek.trip.schemas.participant import ParticipantCreate
from jidelnicek.core.exceptions import NotFoundError, PermissionError


class TestTripCloning:
    """Test cases for trip cloning functionality."""
    
    async def test_clone_trip_basic(self, db_session, sample_user, sample_trip_with_participants):
        """Test basic trip cloning with all options enabled."""
        service = TripService(db_session)
        
        # Prepare clone data
        new_start_date = date.today() + timedelta(days=30)
        clone_data = TripCloneRequest(
            new_name="Summer Expedition 2025",
            start_date=new_start_date,
            clone_participants=True,
            clone_meal_slots=True,
            clone_meal_assignments=True
        )
        
        # Clone the trip
        cloned_trip = await service.clone_trip(
            trip_id=sample_trip_with_participants.id,
            user_id=sample_user.id,
            clone_data=clone_data
        )
        
        # Verify basic properties
        assert cloned_trip.name == "Summer Expedition 2025"
        assert cloned_trip.start_date == new_start_date
        assert cloned_trip.duration_days == sample_trip_with_participants.duration_days
        assert cloned_trip.user_id == sample_user.id
        
        # Verify meal slots were cloned
        assert cloned_trip.meal_slots == sample_trip_with_participants.meal_slots
        
        # Verify participants were cloned
        assert len(cloned_trip.participants) == len(sample_trip_with_participants.participants)
        
    async def test_clone_trip_with_participant_overrides(self, db_session, sample_user, sample_trip):
        """Test cloning with participant overrides."""
        service = TripService(db_session)
        
        # Prepare clone data with participant overrides
        participant_overrides = [
            ParticipantCreate(
                name="Alice",
                coefficient=Decimal("120.00"),
                email="alice@example.com"
            ),
            ParticipantCreate(
                name="Bob", 
                coefficient=Decimal("80.00"),
                meal_coefficients={"breakfast": 60, "lunch": 80, "dinner": 100}
            )
        ]
        
        clone_data = TripCloneRequest(
            new_name="Custom Participants Trip",
            start_date=date.today() + timedelta(days=10),
            clone_participants=True,  # Should be ignored when overrides provided
            clone_meal_slots=True,
            clone_meal_assignments=False,
            participant_overrides=participant_overrides
        )
        
        # Clone the trip
        cloned_trip = await service.clone_trip(
            trip_id=sample_trip.id,
            user_id=sample_user.id,
            clone_data=clone_data
        )
        
        # Verify participants match overrides
        assert len(cloned_trip.participants) == 2
        assert cloned_trip.participants[0].name == "Alice"
        assert cloned_trip.participants[0].coefficient == Decimal("120.00")
        assert cloned_trip.participants[1].name == "Bob"
        assert cloned_trip.participants[1].meal_coefficients == {"breakfast": 60, "lunch": 80, "dinner": 100}
        
    async def test_clone_trip_no_permissions(self, db_session, sample_trip):
        """Test cloning fails without permissions."""
        service = TripService(db_session)
        other_user_id = uuid4()
        
        clone_data = TripCloneRequest(
            new_name="Unauthorized Clone",
            start_date=date.today() + timedelta(days=10)
        )
        
        with pytest.raises(PermissionError):
            await service.clone_trip(
                trip_id=sample_trip.id,
                user_id=other_user_id,
                clone_data=clone_data
            )
            
    async def test_clone_trip_not_found(self, db_session, sample_user):
        """Test cloning non-existent trip."""
        service = TripService(db_session)
        non_existent_id = uuid4()
        
        clone_data = TripCloneRequest(
            new_name="Clone of Nothing",
            start_date=date.today() + timedelta(days=10)
        )
        
        with pytest.raises(NotFoundError):
            await service.clone_trip(
                trip_id=non_existent_id,
                user_id=sample_user.id,
                clone_data=clone_data
            )
            
    async def test_clone_shared_trip(self, db_session, sample_trip_with_share):
        """Test cloning a shared trip by non-owner."""
        service = TripService(db_session)
        other_user_id = uuid4()
        
        clone_data = TripCloneRequest(
            new_name="Clone of Shared Trip",
            start_date=date.today() + timedelta(days=10)
        )
        
        # Should succeed because trip is shareable
        cloned_trip = await service.clone_trip(
            trip_id=sample_trip_with_share.id,
            user_id=other_user_id,
            clone_data=clone_data
        )
        
        # Verify ownership
        assert cloned_trip.user_id == other_user_id
        assert cloned_trip.name == "Clone of Shared Trip"