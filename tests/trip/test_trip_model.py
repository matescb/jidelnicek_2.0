"""
Tests for the Trip model.
"""

import pytest
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from jidelnicek.core.database import Base
from jidelnicek.auth.models import AuthUser
from jidelnicek.trip.models import Trip


@pytest.fixture
def db_engine():
    """Create a test database engine."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    """Create a test database session."""
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = AuthUser(
        email="test@example.com",
        password_hash="hashed_password",
        email_verified=True,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user


class TestTripModel:
    """Test Trip model functionality."""
    
    def test_create_trip(self, db_session, test_user):
        """Test creating a basic trip."""
        trip = Trip(
            user_id=test_user.id,
            name="Summer Hike 2024",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 7)
        )
        
        db_session.add(trip)
        db_session.commit()
        
        assert trip.id is not None
        assert trip.name == "Summer Hike 2024"
        assert trip.duration_days == 7
        assert trip.meal_slots == ["Breakfast", "Lunch", "Dinner"]
        assert trip.is_archived is False
        
    def test_trip_validation(self, db_session, test_user):
        """Test trip validation rules."""
        # Test empty name validation
        with pytest.raises(ValueError, match="Trip name cannot be empty"):
            trip = Trip(
                user_id=test_user.id,
                name="",
                start_date=date(2024, 7, 1),
                end_date=date(2024, 7, 7)
            )
            
        # Test date validation
        with pytest.raises(ValueError, match="End date must be after or equal to start date"):
            trip = Trip(
                user_id=test_user.id,
                name="Invalid Trip",
                start_date=date(2024, 7, 7),
                end_date=date(2024, 7, 1)
            )
            
    def test_meal_slots_validation(self, db_session, test_user):
        """Test meal slots validation and normalization."""
        # Test custom meal slots
        trip = Trip(
            user_id=test_user.id,
            name="Custom Meals Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 3),
            meal_slots=["Morning", "Noon", "Evening", "Snack"]
        )
        
        assert len(trip.meal_slots) == 4
        assert trip.meal_slots == ["Morning", "Noon", "Evening", "Snack"]
        
        # Test duplicate removal
        trip2 = Trip(
            user_id=test_user.id,
            name="Duplicate Slots Trip",
            start_date=date(2024, 8, 1),
            end_date=date(2024, 8, 3),
            meal_slots=["Breakfast", "breakfast", "BREAKFAST", "Lunch"]
        )
        
        assert len(trip2.meal_slots) == 2
        assert trip2.meal_slots == ["Breakfast", "Lunch"]
        
        # Test empty meal slots validation
        with pytest.raises(ValueError, match="At least one meal slot is required"):
            trip3 = Trip(
                user_id=test_user.id,
                name="No Meals Trip",
                start_date=date(2024, 9, 1),
                end_date=date(2024, 9, 3),
                meal_slots=[]
            )
            
    def test_sharing_functionality(self, db_session, test_user):
        """Test trip sharing features."""
        trip = Trip(
            user_id=test_user.id,
            name="Shared Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 5),
            share_token="abc123",
            share_expires_at=datetime.now(timezone.utc) + timedelta(days=30)
        )
        
        assert trip.is_shareable is True
        
        # Test expired share
        trip.share_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        assert trip.is_shareable is False
        
    def test_trip_properties(self, db_session, test_user):
        """Test computed properties."""
        trip = Trip(
            user_id=test_user.id,
            name="Property Test Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 10)
        )
        
        assert trip.duration_days == 10
        assert trip.participant_count == 0  # No participants yet
        assert trip.total_coefficient == Decimal('0.00')
        assert trip.can_add_participants is True
        
    def test_format_display(self, db_session, test_user):
        """Test display formatting."""
        trip = Trip(
            user_id=test_user.id,
            name="Display Test Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 5)
        )
        db_session.add(trip)
        db_session.commit()
        
        display = trip.format_display()
        
        assert display["name"] == "Display Test Trip"
        assert display["duration_days"] == 5
        assert display["participant_count"] == 0
        assert display["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]
        assert display["is_shareable"] is False
        assert display["is_archived"] is False
        assert "id" in display
        assert "created_at" in display
        assert "updated_at" in display
        
    def test_template_data(self, db_session, test_user):
        """Test template data conversion."""
        trip = Trip(
            user_id=test_user.id,
            name="Template Test Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 3),
            meal_slots=["Morning", "Evening"]
        )
        
        template_data = trip.to_template_data()
        
        assert template_data["meal_slots"] == ["Morning", "Evening"]
        assert template_data["days"] == []  # No days yet
        assert template_data["participant_count"] == 0
        assert template_data["duration_days"] == 3