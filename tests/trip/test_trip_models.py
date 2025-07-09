"""
Comprehensive tests for Trip models.

This module provides complete test coverage for all trip-related models,
including validation, relationships, computed properties, and database constraints.
"""

import pytest
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from typing import List

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from jidelnicek.core.database import Base
from jidelnicek.auth.models import AuthUser
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.models.day import TripDay
from jidelnicek.trip.models.meal import TripMeal
from jidelnicek.trip.models.stove import TripStove
from jidelnicek.recipe.models.recipe import Recipe


pytestmark = pytest.mark.asyncio


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
def test_user(db_session) -> AuthUser:
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


@pytest.fixture
def sample_trip(db_session, test_user) -> Trip:
    """Create a sample trip with participants."""
    trip = Trip(
        user_id=test_user.id,
        name="Test Mountain Trek",
        start_date=date(2024, 7, 15),
        end_date=date(2024, 7, 20),
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    db_session.commit()
    
    # Add participants
    participants = [
        TripParticipant(
            trip_id=trip.id,
            name="Alice",
            coefficient=Decimal("100.00")
        ),
        TripParticipant(
            trip_id=trip.id,
            name="Bob",
            coefficient=Decimal("120.00")
        ),
        TripParticipant(
            trip_id=trip.id,
            number=3,
            coefficient=Decimal("80.00")
        )
    ]
    
    for participant in participants:
        db_session.add(participant)
    
    db_session.commit()
    db_session.refresh(trip)
    
    return trip


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
        assert trip.created_at is not None
        assert trip.updated_at is not None
        
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
            
        # Test whitespace-only name
        with pytest.raises(ValueError, match="Trip name cannot be empty"):
            trip = Trip(
                user_id=test_user.id,
                name="   ",
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
        
        # Test duplicate removal (case-insensitive)
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
            
        # Test invalid meal slot names
        with pytest.raises(ValueError, match="Meal slot names must be non-empty strings"):
            trip4 = Trip(
                user_id=test_user.id,
                name="Invalid Slot Names",
                start_date=date(2024, 9, 1),
                end_date=date(2024, 9, 3),
                meal_slots=["Breakfast", "", "Dinner"]
            )
            
    def test_trip_properties(self, db_session, sample_trip):
        """Test computed properties."""
        assert sample_trip.duration_days == 6
        assert sample_trip.participant_count == 3
        assert sample_trip.total_coefficient == Decimal("300.00")
        assert sample_trip.can_add_participants is True
        
    def test_sharing_functionality(self, db_session, test_user):
        """Test trip sharing features."""
        trip = Trip(
            user_id=test_user.id,
            name="Shared Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 5),
            share_token="abc123def456",
            share_expires_at=datetime.now(timezone.utc) + timedelta(days=30)
        )
        
        assert trip.is_shareable is True
        
        # Test expired share
        trip.share_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        assert trip.is_shareable is False
        
        # Test no share token
        trip.share_token = None
        assert trip.is_shareable is False
        
    def test_participant_limit(self, db_session, test_user):
        """Test participant limit constraint."""
        trip = Trip(
            user_id=test_user.id,
            name="Full Trip",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 5)
        )
        db_session.add(trip)
        db_session.commit()
        
        # Add 20 participants (maximum allowed)
        for i in range(20):
            participant = TripParticipant(
                trip_id=trip.id,
                name=f"Participant {i+1}",
                coefficient=Decimal("100.00")
            )
            db_session.add(participant)
        
        db_session.commit()
        db_session.refresh(trip)
        
        assert trip.participant_count == 20
        assert trip.can_add_participants is False
        
    def test_format_display(self, db_session, sample_trip):
        """Test display formatting."""
        display = sample_trip.format_display()
        
        assert display["id"] == str(sample_trip.id)
        assert display["name"] == "Test Mountain Trek"
        assert display["start_date"] == "2024-07-15"
        assert display["end_date"] == "2024-07-20"
        assert display["duration_days"] == 6
        assert display["participant_count"] == 3
        assert display["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]
        assert display["is_shareable"] is False
        assert display["is_archived"] is False
        assert "created_at" in display
        assert "updated_at" in display
        
    def test_template_data(self, db_session, sample_trip):
        """Test template data conversion."""
        template_data = sample_trip.to_template_data()
        
        assert template_data["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]
        assert template_data["days"] == []  # No days created yet
        assert template_data["participant_count"] == 3
        assert template_data["duration_days"] == 6
        
    def test_trip_constraints(self, db_session, test_user):
        """Test database constraints."""
        # Test unique share token constraint
        trip1 = Trip(
            user_id=test_user.id,
            name="Trip 1",
            start_date=date(2024, 7, 1),
            end_date=date(2024, 7, 5),
            share_token="unique_token_123"
        )
        db_session.add(trip1)
        db_session.commit()
        
        trip2 = Trip(
            user_id=test_user.id,
            name="Trip 2",
            start_date=date(2024, 8, 1),
            end_date=date(2024, 8, 5),
            share_token="unique_token_123"  # Same token
        )
        db_session.add(trip2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()


class TestTripParticipantModel:
    """Test TripParticipant model functionality."""
    
    def test_create_participant_with_name(self, db_session, sample_trip):
        """Test creating participant with name."""
        participant = TripParticipant(
            trip_id=sample_trip.id,
            name="Charlie",
            coefficient=Decimal("110.00")
        )
        db_session.add(participant)
        db_session.commit()
        
        assert participant.id is not None
        assert participant.name == "Charlie"
        assert participant.number is None
        assert participant.coefficient == Decimal("110.00")
        assert participant.display_name == "Charlie"
        
    def test_create_participant_with_number(self, db_session, sample_trip):
        """Test creating participant with number."""
        participant = TripParticipant(
            trip_id=sample_trip.id,
            number=5,
            coefficient=Decimal("90.00")
        )
        db_session.add(participant)
        db_session.commit()
        
        assert participant.name is None
        assert participant.number == 5
        assert participant.coefficient == Decimal("90.00")
        assert participant.display_name == "Participant 5"
        
    def test_participant_validation(self, db_session, sample_trip):
        """Test participant validation rules."""
        # Test both name and number provided
        with pytest.raises(ValueError, match="Provide either name or number, not both"):
            participant = TripParticipant(
                trip_id=sample_trip.id,
                name="Invalid",
                number=10,
                coefficient=Decimal("100.00")
            )
            
        # Test neither name nor number provided
        with pytest.raises(ValueError, match="Either name or number must be provided"):
            participant = TripParticipant(
                trip_id=sample_trip.id,
                coefficient=Decimal("100.00")
            )
            
        # Test invalid coefficient (too low)
        with pytest.raises(ValueError, match="Coefficient must be between 0.01 and 999.99"):
            participant = TripParticipant(
                trip_id=sample_trip.id,
                name="Invalid",
                coefficient=Decimal("0.00")
            )
            
        # Test invalid coefficient (too high)
        with pytest.raises(ValueError, match="Coefficient must be between 0.01 and 999.99"):
            participant = TripParticipant(
                trip_id=sample_trip.id,
                name="Invalid",
                coefficient=Decimal("1000.00")
            )
            
    def test_participant_uniqueness(self, db_session, sample_trip):
        """Test participant uniqueness constraints."""
        # Test duplicate name
        participant = TripParticipant(
            trip_id=sample_trip.id,
            name="Alice",  # Already exists
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
        
        db_session.rollback()
        
        # Test duplicate number
        participant = TripParticipant(
            trip_id=sample_trip.id,
            number=3,  # Already exists
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
            
    def test_participant_cascade_delete(self, db_session, sample_trip):
        """Test participant cascade deletion when trip is deleted."""
        trip_id = sample_trip.id
        
        # Verify participants exist
        stmt = select(TripParticipant).where(TripParticipant.trip_id == trip_id)
        result = db_session.execute(stmt)
        participants = result.scalars().all()
        assert len(participants) == 3
        
        # Delete trip
        db_session.delete(sample_trip)
        db_session.commit()
        
        # Verify participants are deleted
        stmt = select(TripParticipant).where(TripParticipant.trip_id == trip_id)
        result = db_session.execute(stmt)
        participants = result.scalars().all()
        assert len(participants) == 0


class TestTripDayModel:
    """Test TripDay model functionality."""
    
    @pytest.fixture
    def trip_with_days(self, db_session, sample_trip):
        """Create a trip with days."""
        # Create days for the trip
        start_date = sample_trip.start_date
        for i in range(sample_trip.duration_days):
            day = TripDay(
                trip_id=sample_trip.id,
                day_number=i + 1,
                date=start_date + timedelta(days=i),
                notes=f"Day {i+1} notes" if i == 0 else None
            )
            db_session.add(day)
        
        db_session.commit()
        db_session.refresh(sample_trip)
        return sample_trip
        
    def test_create_trip_day(self, db_session, sample_trip):
        """Test creating a trip day."""
        day = TripDay(
            trip_id=sample_trip.id,
            day_number=1,
            date=sample_trip.start_date,
            notes="First day of the trek"
        )
        db_session.add(day)
        db_session.commit()
        
        assert day.id is not None
        assert day.day_number == 1
        assert day.date == sample_trip.start_date
        assert day.notes == "First day of the trek"
        
    def test_day_validation(self, db_session, sample_trip):
        """Test trip day validation."""
        # Test invalid day number (0)
        with pytest.raises(ValueError, match="Day number must be at least 1"):
            day = TripDay(
                trip_id=sample_trip.id,
                day_number=0,
                date=sample_trip.start_date
            )
            
        # Test invalid day number (negative)
        with pytest.raises(ValueError, match="Day number must be at least 1"):
            day = TripDay(
                trip_id=sample_trip.id,
                day_number=-1,
                date=sample_trip.start_date
            )
            
    def test_day_uniqueness(self, db_session, sample_trip):
        """Test trip day uniqueness constraints."""
        # Create first day
        day1 = TripDay(
            trip_id=sample_trip.id,
            day_number=1,
            date=sample_trip.start_date
        )
        db_session.add(day1)
        db_session.commit()
        
        # Try to create duplicate day number
        day2 = TripDay(
            trip_id=sample_trip.id,
            day_number=1,  # Same day number
            date=sample_trip.start_date + timedelta(days=1)
        )
        db_session.add(day2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
            
    def test_day_meal_calculations(self, db_session, trip_with_days):
        """Test trip day meal calculations."""
        day = trip_with_days.days[0]
        
        # Initially no meals
        assert day.total_meals == 0
        assert day.has_all_meals is False
        assert day.calculate_total_calories() == Decimal("0.00")
        assert day.calculate_total_weight() == Decimal("0.00")
        assert day.calculate_water_requirement() == 0
        
    def test_day_cascade_delete(self, db_session, trip_with_days):
        """Test day cascade deletion when trip is deleted."""
        trip_id = trip_with_days.id
        
        # Verify days exist
        stmt = select(TripDay).where(TripDay.trip_id == trip_id)
        result = db_session.execute(stmt)
        days = result.scalars().all()
        assert len(days) == 6
        
        # Delete trip
        db_session.delete(trip_with_days)
        db_session.commit()
        
        # Verify days are deleted
        stmt = select(TripDay).where(TripDay.trip_id == trip_id)
        result = db_session.execute(stmt)
        days = result.scalars().all()
        assert len(days) == 0


class TestTripMealModel:
    """Test TripMeal model functionality."""
    
    @pytest.fixture
    def trip_day(self, db_session, sample_trip):
        """Create a trip day for meal testing."""
        day = TripDay(
            trip_id=sample_trip.id,
            day_number=1,
            date=sample_trip.start_date
        )
        db_session.add(day)
        db_session.commit()
        return day
        
    @pytest.fixture
    def sample_recipe(self, db_session, test_user):
        """Create a sample recipe."""
        recipe = Recipe(
            user_id=test_user.id,
            name="Test Oatmeal",
            prep_time_minutes=10,
            cook_time_minutes=5,
            servings=2,
            water_ml_per_serving=250,
            weight_g_per_serving=Decimal("150.00"),
            difficulty="easy",
            is_published=False
        )
        db_session.add(recipe)
        db_session.commit()
        return recipe
        
    def test_create_trip_meal(self, db_session, trip_day, sample_recipe):
        """Test creating a trip meal."""
        meal = TripMeal(
            day_id=trip_day.id,
            meal_slot="Breakfast",
            recipe_id=sample_recipe.id,
            servings_override=4
        )
        db_session.add(meal)
        db_session.commit()
        
        assert meal.id is not None
        assert meal.meal_slot == "Breakfast"
        assert meal.servings_override == 4
        assert meal.recipe_id == sample_recipe.id
        
    def test_meal_validation(self, db_session, trip_day, sample_recipe):
        """Test trip meal validation."""
        # Test empty meal slot
        with pytest.raises(ValueError, match="Meal slot cannot be empty"):
            meal = TripMeal(
                day_id=trip_day.id,
                meal_slot="",
                recipe_id=sample_recipe.id
            )
            
        # Test invalid servings override
        with pytest.raises(ValueError, match="Servings override must be positive"):
            meal = TripMeal(
                day_id=trip_day.id,
                meal_slot="Breakfast",
                recipe_id=sample_recipe.id,
                servings_override=0
            )
            
    def test_meal_uniqueness(self, db_session, trip_day, sample_recipe):
        """Test meal slot uniqueness per day."""
        # Create first meal
        meal1 = TripMeal(
            day_id=trip_day.id,
            meal_slot="Breakfast",
            recipe_id=sample_recipe.id
        )
        db_session.add(meal1)
        db_session.commit()
        
        # Try to create duplicate meal slot
        meal2 = TripMeal(
            day_id=trip_day.id,
            meal_slot="Breakfast",  # Same slot
            recipe_id=sample_recipe.id
        )
        db_session.add(meal2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
            
    def test_meal_cascade_delete(self, db_session, trip_day, sample_recipe):
        """Test meal cascade deletion when day is deleted."""
        # Create meal
        meal = TripMeal(
            day_id=trip_day.id,
            meal_slot="Breakfast",
            recipe_id=sample_recipe.id
        )
        db_session.add(meal)
        db_session.commit()
        
        day_id = trip_day.id
        
        # Delete day
        db_session.delete(trip_day)
        db_session.commit()
        
        # Verify meal is deleted
        stmt = select(TripMeal).where(TripMeal.day_id == day_id)
        result = db_session.execute(stmt)
        meals = result.scalars().all()
        assert len(meals) == 0


class TestTripStoveModel:
    """Test TripStove model functionality."""
    
    def test_create_trip_stove(self, db_session, sample_trip):
        """Test creating a trip stove configuration."""
        stove = TripStove(
            trip_id=sample_trip.id,
            stove_type="gas_canister",
            fuel_type="isobutane",
            efficiency_percentage=Decimal("85.00"),
            notes="MSR PocketRocket 2"
        )
        db_session.add(stove)
        db_session.commit()
        
        assert stove.id is not None
        assert stove.stove_type == "gas_canister"
        assert stove.fuel_type == "isobutane"
        assert stove.efficiency_percentage == Decimal("85.00")
        assert stove.notes == "MSR PocketRocket 2"
        
    def test_stove_validation(self, db_session, sample_trip):
        """Test stove validation rules."""
        # Test invalid stove type
        with pytest.raises(ValueError, match="Invalid stove type"):
            stove = TripStove(
                trip_id=sample_trip.id,
                stove_type="invalid_type",
                fuel_type="isobutane"
            )
            
        # Test invalid fuel type
        with pytest.raises(ValueError, match="Invalid fuel type"):
            stove = TripStove(
                trip_id=sample_trip.id,
                stove_type="gas_canister",
                fuel_type="invalid_fuel"
            )
            
        # Test mismatched fuel type
        with pytest.raises(ValueError, match="Fuel type .* not compatible with stove type"):
            stove = TripStove(
                trip_id=sample_trip.id,
                stove_type="gas_canister",
                fuel_type="white_gas"  # Not compatible with gas canister
            )
            
        # Test invalid efficiency (too low)
        with pytest.raises(ValueError, match="Efficiency must be between 1 and 100"):
            stove = TripStove(
                trip_id=sample_trip.id,
                stove_type="gas_canister",
                fuel_type="isobutane",
                efficiency_percentage=Decimal("0.00")
            )
            
        # Test invalid efficiency (too high)
        with pytest.raises(ValueError, match="Efficiency must be between 1 and 100"):
            stove = TripStove(
                trip_id=sample_trip.id,
                stove_type="gas_canister",
                fuel_type="isobutane",
                efficiency_percentage=Decimal("101.00")
            )
            
    def test_stove_fuel_calculations(self, db_session, sample_trip):
        """Test stove fuel calculations."""
        stove = TripStove(
            trip_id=sample_trip.id,
            stove_type="gas_canister",
            fuel_type="isobutane",
            efficiency_percentage=Decimal("80.00")
        )
        
        # Test fuel calculation
        water_ml = 1000  # 1 liter
        fuel_g = stove.calculate_fuel_needed(water_ml)
        
        # For gas canister with isobutane at 80% efficiency:
        # Base: 1000ml * 0.1g/ml = 100g
        # With efficiency: 100g / 0.8 = 125g
        assert fuel_g == Decimal("125.00")
        
        # Test with different stove type
        stove.stove_type = "alcohol"
        stove.fuel_type = "ethanol"
        fuel_g = stove.calculate_fuel_needed(water_ml)
        
        # For alcohol stove with ethanol at 80% efficiency:
        # Base: 1000ml * 0.15g/ml = 150g
        # With efficiency: 150g / 0.8 = 187.5g
        assert fuel_g == Decimal("187.50")
        
    def test_stove_uniqueness(self, db_session, sample_trip):
        """Test one stove per trip constraint."""
        # Create first stove
        stove1 = TripStove(
            trip_id=sample_trip.id,
            stove_type="gas_canister",
            fuel_type="isobutane"
        )
        db_session.add(stove1)
        db_session.commit()
        
        # Try to create second stove for same trip
        stove2 = TripStove(
            trip_id=sample_trip.id,
            stove_type="alcohol",
            fuel_type="ethanol"
        )
        db_session.add(stove2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
            
    def test_stove_cascade_delete(self, db_session, sample_trip):
        """Test stove cascade deletion when trip is deleted."""
        # Create stove
        stove = TripStove(
            trip_id=sample_trip.id,
            stove_type="gas_canister",
            fuel_type="isobutane"
        )
        db_session.add(stove)
        db_session.commit()
        
        trip_id = sample_trip.id
        
        # Delete trip
        db_session.delete(sample_trip)
        db_session.commit()
        
        # Verify stove is deleted
        stmt = select(TripStove).where(TripStove.trip_id == trip_id)
        result = db_session.execute(stmt)
        stoves = result.scalars().all()
        assert len(stoves) == 0


class TestTripRelationships:
    """Test relationships between trip models."""
    
    def test_trip_to_participants_relationship(self, db_session, sample_trip):
        """Test trip to participants relationship."""
        # Access participants through relationship
        participants = sample_trip.participants
        assert len(participants) == 3
        
        # Check ordering (by ID)
        assert participants[0].name == "Alice"
        assert participants[1].name == "Bob"
        assert participants[2].number == 3
        
        # Test back reference
        for participant in participants:
            assert participant.trip == sample_trip
            
    def test_trip_to_days_relationship(self, db_session, sample_trip):
        """Test trip to days relationship."""
        # Create days
        for i in range(3):
            day = TripDay(
                trip_id=sample_trip.id,
                day_number=i + 1,
                date=sample_trip.start_date + timedelta(days=i)
            )
            db_session.add(day)
        
        db_session.commit()
        db_session.refresh(sample_trip)
        
        # Access days through relationship
        days = sample_trip.days
        assert len(days) == 3
        
        # Check ordering (by day_number)
        assert days[0].day_number == 1
        assert days[1].day_number == 2
        assert days[2].day_number == 3
        
        # Test back reference
        for day in days:
            assert day.trip == sample_trip
            
    def test_trip_to_stove_relationship(self, db_session, sample_trip):
        """Test trip to stove relationship."""
        # Create stove
        stove = TripStove(
            trip_id=sample_trip.id,
            stove_type="gas_canister",
            fuel_type="isobutane"
        )
        db_session.add(stove)
        db_session.commit()
        db_session.refresh(sample_trip)
        
        # Access stove through relationship
        assert sample_trip.stove is not None
        assert sample_trip.stove.stove_type == "gas_canister"
        
        # Test back reference
        assert sample_trip.stove.trip == sample_trip
        
    def test_day_to_meals_relationship(self, db_session, sample_trip, test_user):
        """Test day to meals relationship."""
        # Create day
        day = TripDay(
            trip_id=sample_trip.id,
            day_number=1,
            date=sample_trip.start_date
        )
        db_session.add(day)
        
        # Create recipes
        recipes = []
        for i, meal_slot in enumerate(["Breakfast", "Lunch", "Dinner"]):
            recipe = Recipe(
                user_id=test_user.id,
                name=f"{meal_slot} Recipe",
                prep_time_minutes=10,
                cook_time_minutes=10,
                servings=2
            )
            db_session.add(recipe)
            recipes.append(recipe)
        
        db_session.commit()
        
        # Create meals
        for i, (meal_slot, recipe) in enumerate(zip(["Breakfast", "Lunch", "Dinner"], recipes)):
            meal = TripMeal(
                day_id=day.id,
                meal_slot=meal_slot,
                recipe_id=recipe.id
            )
            db_session.add(meal)
        
        db_session.commit()
        db_session.refresh(day)
        
        # Access meals through relationship
        meals = day.meals
        assert len(meals) == 3
        
        # Check ordering (by meal_slot)
        assert meals[0].meal_slot == "Breakfast"
        assert meals[1].meal_slot == "Dinner"
        assert meals[2].meal_slot == "Lunch"
        
        # Test back reference
        for meal in meals:
            assert meal.day == day