"""
Comprehensive tests for Trip Service functionality.

This module provides complete test coverage for the TripService class,
including CRUD operations, trip validation, authorization checks,
duplicate functionality, and share link generation.
"""

import pytest
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4, UUID
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.trip.services.trip_service import TripService
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.schemas.trip import (
    TripCreate, TripUpdate, TripSearchFilters,
    TripParticipantCreate, TripParticipantUpdate,
    TripDuplicateRequest, TripTemplateRequest
)
from jidelnicek.core.exceptions import (
    NotFoundError as TripNotFoundError, 
    PermissionError as TripPermissionError, 
    ValidationError as TripValidationError,
    ValidationError as TripParticipantLimitError,
    ValidationError as TripDateRangeError,
    ValidationError as TripShareLinkExpiredError,
    ValidationError as TripArchiveError
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def trip_owner(db_session: AsyncSession) -> AuthUser:
    """Create a user who owns trips."""
    user = AuthUser(
        email="trip_owner@example.com",
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
async def other_user(db_session: AsyncSession) -> AuthUser:
    """Create another user for permission testing."""
    user = AuthUser(
        email="other_user@example.com",
        password_hash=PasswordHasher.hash_password("OtherUser123!"),
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
async def sample_trip_data() -> TripCreate:
    """Create sample trip data for testing."""
    return TripCreate(
        name="Summer Alpine Trek 2024",
        start_date=date(2024, 7, 15),
        end_date=date(2024, 7, 22),
        meal_slots=["Breakfast", "Lunch", "Dinner", "Snack"],
        participants=[
            TripParticipantCreate(name="Alice", coefficient=Decimal("100.00")),
            TripParticipantCreate(name="Bob", coefficient=Decimal("120.00")),
            TripParticipantCreate(number=3, coefficient=Decimal("80.00"))
        ]
    )


@pytest.fixture
async def trip_service(db_session: AsyncSession) -> TripService:
    """Create TripService instance."""
    return TripService(db_session)


@pytest.fixture
async def sample_trip(
    db_session: AsyncSession,
    trip_owner: AuthUser,
    sample_trip_data: TripCreate,
    trip_service: TripService
) -> Trip:
    """Create a sample trip in the database."""
    trip = await trip_service.create_trip(trip_owner.id, sample_trip_data)
    return trip


class TestTripCreation:
    """Test trip creation functionality."""
    
    async def test_create_basic_trip(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test creating a basic trip without participants."""
        trip_data = TripCreate(
            name="Weekend Hike",
            start_date=date(2024, 8, 10),
            end_date=date(2024, 8, 11),
            meal_slots=["Breakfast", "Dinner"]
        )
        
        trip = await trip_service.create_trip(trip_owner.id, trip_data)
        
        assert trip.id is not None
        assert trip.name == "Weekend Hike"
        assert trip.user_id == trip_owner.id
        assert trip.start_date == date(2024, 8, 10)
        assert trip.end_date == date(2024, 8, 11)
        assert trip.duration_days == 2
        assert trip.meal_slots == ["Breakfast", "Dinner"]
        assert trip.is_archived is False
        assert trip.participant_count == 0
        
    async def test_create_trip_with_participants(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        sample_trip_data: TripCreate,
        trip_service: TripService
    ):
        """Test creating a trip with participants."""
        trip = await trip_service.create_trip(trip_owner.id, sample_trip_data)
        
        assert trip.name == "Summer Alpine Trek 2024"
        assert trip.duration_days == 8
        assert len(trip.participants) == 3
        
        # Check participants
        alice = next(p for p in trip.participants if p.name == "Alice")
        assert alice.coefficient == Decimal("100.00")
        
        bob = next(p for p in trip.participants if p.name == "Bob")
        assert bob.coefficient == Decimal("120.00")
        
        participant_3 = next(p for p in trip.participants if p.number == 3)
        assert participant_3.coefficient == Decimal("80.00")
        assert participant_3.name is None
        
        # Check total coefficient
        assert trip.total_coefficient == Decimal("300.00")
        
    async def test_create_trip_validation_errors(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test trip creation with validation errors."""
        # Test empty name
        with pytest.raises(TripValidationError, match="Trip name cannot be empty"):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name="",
                    start_date=date(2024, 7, 1),
                    end_date=date(2024, 7, 5)
                )
            )
        
        # Test invalid date range
        with pytest.raises(TripDateRangeError, match="End date cannot be before start date"):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name="Invalid Dates",
                    start_date=date(2024, 7, 10),
                    end_date=date(2024, 7, 5)
                )
            )
        
        # Test empty meal slots
        with pytest.raises(TripValidationError, match="At least one meal slot is required"):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name="No Meals",
                    start_date=date(2024, 7, 1),
                    end_date=date(2024, 7, 5),
                    meal_slots=[]
                )
            )
        
    async def test_create_trip_participant_limit(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test trip participant limit (max 20)."""
        # Create trip data with 21 participants
        participants = [
            TripParticipantCreate(
                name=f"Participant {i}",
                coefficient=Decimal("100.00")
            )
            for i in range(21)
        ]
        
        with pytest.raises(TripParticipantLimitError, match="Maximum 20 participants allowed"):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name="Too Many Participants",
                    start_date=date(2024, 7, 1),
                    end_date=date(2024, 7, 5),
                    participants=participants
                )
            )
        
    async def test_create_trip_duplicate_participants(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test creating trip with duplicate participant names/numbers."""
        # Duplicate names
        with pytest.raises(TripValidationError, match="Participant names must be unique"):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name="Duplicate Names",
                    start_date=date(2024, 7, 1),
                    end_date=date(2024, 7, 5),
                    participants=[
                        TripParticipantCreate(name="Alice", coefficient=Decimal("100")),
                        TripParticipantCreate(name="Alice", coefficient=Decimal("100"))
                    ]
                )
            )
        
        # Duplicate numbers
        with pytest.raises(TripValidationError, match="Participant numbers must be unique"):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name="Duplicate Numbers",
                    start_date=date(2024, 7, 1),
                    end_date=date(2024, 7, 5),
                    participants=[
                        TripParticipantCreate(number=1, coefficient=Decimal("100")),
                        TripParticipantCreate(number=1, coefficient=Decimal("100"))
                    ]
                )
            )


class TestTripRetrieval:
    """Test trip retrieval functionality."""
    
    async def test_get_trip_by_id(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test retrieving a trip by ID."""
        retrieved_trip = await trip_service.get_trip_by_id(
            sample_trip.id,
            trip_owner.id
        )
        
        assert retrieved_trip.id == sample_trip.id
        assert retrieved_trip.name == sample_trip.name
        assert len(retrieved_trip.participants) == 3
        
    async def test_get_trip_not_found(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test retrieving non-existent trip."""
        fake_id = uuid4()
        
        with pytest.raises(TripNotFoundError):
            await trip_service.get_trip_by_id(fake_id, trip_owner.id)
            
    async def test_get_trip_permission_denied(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test retrieving trip without permission."""
        with pytest.raises(TripPermissionError):
            await trip_service.get_trip_by_id(sample_trip.id, other_user.id)
            
    async def test_list_user_trips(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test listing trips for a user."""
        # Create multiple trips
        for i in range(5):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name=f"Trip {i+1}",
                    start_date=date(2024, 7, i+1),
                    end_date=date(2024, 7, i+5)
                )
            )
        
        # List trips
        result = await trip_service.list_trips(
            trip_owner.id,
            page=1,
            page_size=10
        )
        
        assert result.total == 5
        assert len(result.items) == 5
        assert result.total_pages == 1
        assert result.has_next is False
        assert result.has_prev is False
        
    async def test_list_trips_pagination(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test trip list pagination."""
        # Create 15 trips
        for i in range(15):
            await trip_service.create_trip(
                trip_owner.id,
                TripCreate(
                    name=f"Trip {i+1}",
                    start_date=date(2024, 7, 1),
                    end_date=date(2024, 7, 5)
                )
            )
        
        # Get first page
        page1 = await trip_service.list_trips(
            trip_owner.id,
            page=1,
            page_size=10
        )
        
        assert page1.total == 15
        assert len(page1.items) == 10
        assert page1.total_pages == 2
        assert page1.has_next is True
        assert page1.has_prev is False
        
        # Get second page
        page2 = await trip_service.list_trips(
            trip_owner.id,
            page=2,
            page_size=10
        )
        
        assert len(page2.items) == 5
        assert page2.has_next is False
        assert page2.has_prev is True
        
    async def test_search_trips(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test trip search functionality."""
        # Create trips with different attributes
        await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Winter Ski Trip",
                start_date=date(2024, 1, 10),
                end_date=date(2024, 1, 15),
                participants=[
                    TripParticipantCreate(name="Skier1", coefficient=Decimal("100"))
                ]
            )
        )
        
        await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Summer Beach Vacation",
                start_date=date(2024, 7, 1),
                end_date=date(2024, 7, 14),
                participants=[
                    TripParticipantCreate(name="Person1", coefficient=Decimal("100")),
                    TripParticipantCreate(name="Person2", coefficient=Decimal("100"))
                ]
            )
        )
        
        # Search by name
        results = await trip_service.search_trips(
            trip_owner.id,
            TripSearchFilters(query="Winter")
        )
        assert len(results.items) == 1
        assert results.items[0].name == "Winter Ski Trip"
        
        # Search by date range
        results = await trip_service.search_trips(
            trip_owner.id,
            TripSearchFilters(
                start_date_from=date(2024, 6, 1),
                start_date_to=date(2024, 8, 1)
            )
        )
        assert len(results.items) == 1
        assert results.items[0].name == "Summer Beach Vacation"
        
        # Search by participant count
        results = await trip_service.search_trips(
            trip_owner.id,
            TripSearchFilters(min_participants=2)
        )
        assert len(results.items) == 1
        assert results.items[0].participant_count == 2


class TestTripUpdate:
    """Test trip update functionality."""
    
    async def test_update_trip_basic_info(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test updating basic trip information."""
        update_data = TripUpdate(
            name="Updated Alpine Adventure",
            start_date=date(2024, 8, 1),
            end_date=date(2024, 8, 10),
            meal_slots=["Morning", "Afternoon", "Evening"]
        )
        
        updated_trip = await trip_service.update_trip(
            sample_trip.id,
            trip_owner.id,
            update_data
        )
        
        assert updated_trip.name == "Updated Alpine Adventure"
        assert updated_trip.start_date == date(2024, 8, 1)
        assert updated_trip.end_date == date(2024, 8, 10)
        assert updated_trip.duration_days == 10
        assert updated_trip.meal_slots == ["Morning", "Afternoon", "Evening"]
        
    async def test_update_trip_participants(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test updating trip participants."""
        # Get participant IDs
        alice = next(p for p in sample_trip.participants if p.name == "Alice")
        bob = next(p for p in sample_trip.participants if p.name == "Bob")
        
        update_data = TripUpdate(
            participants=[
                TripParticipantUpdate(
                    id=alice.id,
                    coefficient=Decimal("150.00")
                ),
                TripParticipantUpdate(
                    id=bob.id,
                    name="Robert"
                )
            ]
        )
        
        updated_trip = await trip_service.update_trip(
            sample_trip.id,
            trip_owner.id,
            update_data
        )
        
        # Check updates
        updated_alice = next(p for p in updated_trip.participants if p.id == alice.id)
        assert updated_alice.coefficient == Decimal("150.00")
        
        updated_bob = next(p for p in updated_trip.participants if p.id == bob.id)
        assert updated_bob.name == "Robert"
        
    async def test_update_trip_validation(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test trip update validation."""
        # Test invalid date range
        with pytest.raises(TripDateRangeError):
            await trip_service.update_trip(
                sample_trip.id,
                trip_owner.id,
                TripUpdate(
                    start_date=date(2024, 8, 10),
                    end_date=date(2024, 8, 5)
                )
            )
        
        # Test empty name
        with pytest.raises(TripValidationError):
            await trip_service.update_trip(
                sample_trip.id,
                trip_owner.id,
                TripUpdate(name="")
            )
            
    async def test_update_trip_permission_denied(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test updating trip without permission."""
        with pytest.raises(TripPermissionError):
            await trip_service.update_trip(
                sample_trip.id,
                other_user.id,
                TripUpdate(name="Unauthorized Update")
            )


class TestTripArchiving:
    """Test trip archiving functionality."""
    
    async def test_archive_trip(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test archiving a trip."""
        await trip_service.archive_trip(sample_trip.id, trip_owner.id)
        
        # Verify trip is archived
        archived_trip = await trip_service.get_trip_by_id(
            sample_trip.id,
            trip_owner.id,
            include_archived=True
        )
        
        assert archived_trip.is_archived is True
        
    async def test_unarchive_trip(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test unarchiving a trip."""
        # First archive the trip
        await trip_service.archive_trip(sample_trip.id, trip_owner.id)
        
        # Then unarchive it
        await trip_service.unarchive_trip(sample_trip.id, trip_owner.id)
        
        # Verify trip is not archived
        unarchived_trip = await trip_service.get_trip_by_id(
            sample_trip.id,
            trip_owner.id
        )
        
        assert unarchived_trip.is_archived is False
        
    async def test_archive_trip_permission_denied(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test archiving trip without permission."""
        with pytest.raises(TripPermissionError):
            await trip_service.archive_trip(sample_trip.id, other_user.id)
            
    async def test_list_trips_exclude_archived(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test that archived trips are excluded from normal listing."""
        # Create trips
        active_trip = await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Active Trip",
                start_date=date(2024, 7, 1),
                end_date=date(2024, 7, 5)
            )
        )
        
        archived_trip = await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Archived Trip",
                start_date=date(2024, 8, 1),
                end_date=date(2024, 8, 5)
            )
        )
        
        # Archive one trip
        await trip_service.archive_trip(archived_trip.id, trip_owner.id)
        
        # List trips (should exclude archived)
        result = await trip_service.list_trips(trip_owner.id)
        
        assert result.total == 1
        assert result.items[0].name == "Active Trip"
        
        # List with archived included
        result_with_archived = await trip_service.list_trips(
            trip_owner.id,
            include_archived=True
        )
        
        assert result_with_archived.total == 2


class TestTripDuplication:
    """Test trip duplication functionality."""
    
    async def test_duplicate_trip_basic(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test basic trip duplication."""
        duplicate_request = TripDuplicateRequest(
            new_name="Summer Alpine Trek 2025",
            include_meals=False,
            include_participants=True,
            new_start_date=date(2025, 7, 15)
        )
        
        duplicated_trip = await trip_service.duplicate_trip(
            sample_trip.id,
            trip_owner.id,
            duplicate_request
        )
        
        assert duplicated_trip.id != sample_trip.id
        assert duplicated_trip.name == "Summer Alpine Trek 2025"
        assert duplicated_trip.start_date == date(2025, 7, 15)
        assert duplicated_trip.end_date == date(2025, 7, 22)  # Same duration
        assert duplicated_trip.meal_slots == sample_trip.meal_slots
        assert len(duplicated_trip.participants) == 3
        
    async def test_duplicate_trip_with_auto_name(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test trip duplication with automatic naming."""
        duplicate_request = TripDuplicateRequest(
            include_meals=True,
            include_participants=True
        )
        
        duplicated_trip = await trip_service.duplicate_trip(
            sample_trip.id,
            trip_owner.id,
            duplicate_request
        )
        
        assert duplicated_trip.name == "Summer Alpine Trek 2024 (Copy)"
        assert duplicated_trip.start_date == sample_trip.start_date
        assert duplicated_trip.end_date == sample_trip.end_date
        
    async def test_duplicate_trip_without_participants(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test duplicating trip without participants."""
        duplicate_request = TripDuplicateRequest(
            new_name="Solo Trek",
            include_participants=False
        )
        
        duplicated_trip = await trip_service.duplicate_trip(
            sample_trip.id,
            trip_owner.id,
            duplicate_request
        )
        
        assert duplicated_trip.name == "Solo Trek"
        assert len(duplicated_trip.participants) == 0
        
    async def test_duplicate_trip_permission_denied(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test duplicating trip without permission."""
        with pytest.raises(TripPermissionError):
            await trip_service.duplicate_trip(
                sample_trip.id,
                other_user.id,
                TripDuplicateRequest()
            )


class TestTripSharing:
    """Test trip sharing functionality."""
    
    async def test_generate_share_link(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test generating a share link."""
        share_link = await trip_service.generate_share_link(
            sample_trip.id,
            trip_owner.id,
            expires_in_days=7
        )
        
        assert share_link.trip_id == sample_trip.id
        assert share_link.share_token is not None
        assert len(share_link.share_token) >= 32
        assert share_link.expires_at > datetime.now(timezone.utc)
        
        # Verify trip is shareable
        updated_trip = await trip_service.get_trip_by_id(
            sample_trip.id,
            trip_owner.id
        )
        assert updated_trip.is_shareable is True
        
    async def test_generate_share_link_custom_expiry(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test generating share link with custom expiry."""
        share_link = await trip_service.generate_share_link(
            sample_trip.id,
            trip_owner.id,
            expires_in_days=30
        )
        
        expected_expiry = datetime.now(timezone.utc) + timedelta(days=30)
        actual_expiry = share_link.expires_at
        
        # Allow 1 minute tolerance for test execution time
        assert abs((expected_expiry - actual_expiry).total_seconds()) < 60
        
    async def test_access_trip_by_share_token(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test accessing trip via share token."""
        # Generate share link
        share_link = await trip_service.generate_share_link(
            sample_trip.id,
            trip_owner.id
        )
        
        # Access trip with share token (as different user)
        shared_trip = await trip_service.get_trip_by_share_token(
            share_link.share_token,
            other_user.id
        )
        
        assert shared_trip.id == sample_trip.id
        assert shared_trip.name == sample_trip.name
        
    async def test_access_expired_share_link(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test accessing trip with expired share link."""
        # Generate share link with very short expiry
        share_link = await trip_service.generate_share_link(
            sample_trip.id,
            trip_owner.id,
            expires_in_days=0.0001  # Expires in ~8 seconds
        )
        
        # Manually expire the link
        sample_trip.share_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        await db_session.commit()
        
        # Try to access with expired token
        with pytest.raises(TripShareLinkExpiredError):
            await trip_service.get_trip_by_share_token(
                share_link.share_token,
                other_user.id
            )
            
    async def test_revoke_share_link(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test revoking a share link."""
        # Generate share link
        share_link = await trip_service.generate_share_link(
            sample_trip.id,
            trip_owner.id
        )
        
        # Revoke the link
        await trip_service.revoke_share_link(
            sample_trip.id,
            trip_owner.id
        )
        
        # Verify trip is no longer shareable
        updated_trip = await trip_service.get_trip_by_id(
            sample_trip.id,
            trip_owner.id
        )
        assert updated_trip.is_shareable is False
        assert updated_trip.share_token is None
        assert updated_trip.share_expires_at is None
        
        # Try to access with revoked token
        with pytest.raises(TripNotFoundError):
            await trip_service.get_trip_by_share_token(
                share_link.share_token,
                other_user.id
            )


class TestTripDeletion:
    """Test trip deletion functionality."""
    
    async def test_delete_trip(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test deleting a trip."""
        trip_id = sample_trip.id
        
        # Delete the trip
        await trip_service.delete_trip(trip_id, trip_owner.id)
        
        # Verify trip is deleted
        with pytest.raises(TripNotFoundError):
            await trip_service.get_trip_by_id(trip_id, trip_owner.id)
            
        # Verify participants are also deleted (cascade)
        stmt = select(TripParticipant).where(TripParticipant.trip_id == trip_id)
        result = await db_session.execute(stmt)
        participants = result.scalars().all()
        assert len(participants) == 0
        
    async def test_delete_trip_permission_denied(
        self,
        db_session: AsyncSession,
        sample_trip: Trip,
        other_user: AuthUser,
        trip_service: TripService
    ):
        """Test deleting trip without permission."""
        with pytest.raises(TripPermissionError):
            await trip_service.delete_trip(sample_trip.id, other_user.id)
            
    async def test_delete_nonexistent_trip(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test deleting non-existent trip."""
        fake_id = uuid4()
        
        with pytest.raises(TripNotFoundError):
            await trip_service.delete_trip(fake_id, trip_owner.id)


class TestTripStatistics:
    """Test trip statistics functionality."""
    
    async def test_get_user_trip_statistics(
        self,
        db_session: AsyncSession,
        trip_owner: AuthUser,
        trip_service: TripService
    ):
        """Test getting user trip statistics."""
        # Create multiple trips with different characteristics
        await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Trip 1",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 5),
                participants=[
                    TripParticipantCreate(name="P1", coefficient=Decimal("100")),
                    TripParticipantCreate(name="P2", coefficient=Decimal("100"))
                ]
            )
        )
        
        trip2 = await trip_service.create_trip(
            trip_owner.id,
            TripCreate(
                name="Trip 2",
                start_date=date(2024, 2, 1),
                end_date=date(2024, 2, 10),
                meal_slots=["Morning", "Evening"],
                participants=[
                    TripParticipantCreate(name="P1", coefficient=Decimal("100"))
                ]
            )
        )
        
        # Archive one trip
        await trip_service.archive_trip(trip2.id, trip_owner.id)
        
        # Get statistics
        stats = await trip_service.get_user_trip_statistics(trip_owner.id)
        
        assert stats.total_trips == 2
        assert stats.active_trips == 1
        assert stats.archived_trips == 1
        assert stats.total_trip_days == 15  # 5 + 10 days
        assert stats.average_trip_duration == 7.5
        assert stats.average_participants == 1.5  # (2 + 1) / 2
        
        # Check most common meal slots
        assert len(stats.most_common_meal_slots) > 0
        assert stats.most_common_meal_slots[0]["meal_slot"] in ["Breakfast", "Morning"]