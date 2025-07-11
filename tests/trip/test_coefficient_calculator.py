"""
Tests for the coefficient calculation engine.

This module tests the coefficient calculator functionality including:
- Basic coefficient calculations
- Meal-specific coefficients
- Partial attendance scenarios
- Shopping list aggregations
"""

import pytest
import pytest_asyncio
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.trip.utils.coefficient_calculator import (
    CoefficientCalculator,
    ParticipantCoefficient,
    MealParticipantSummary,
    DailyParticipantSummary,
    TripCoefficientSummary
)
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.models.day import TripDay
from jidelnicek.trip.models.meal import TripMeal


@pytest_asyncio.fixture(scope="function")
async def sample_trip(db_session: AsyncSession, test_user):
    """Create a sample trip with participants and days."""
    # Create trip
    trip = Trip(
        user_id=test_user.id,
        name="Test Camping Trip",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=3),
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    await db_session.flush()
    
    # Add participants with different coefficients
    participants = [
        TripParticipant(
            trip_id=trip.id,
            name="Adult 1",
            coefficient=Decimal("100.00")  # 100%
        ),
        TripParticipant(
            trip_id=trip.id,
            name="Adult 2",
            coefficient=Decimal("150.00")  # 150% - larger portions
        ),
        TripParticipant(
            trip_id=trip.id,
            name="Child 1",
            coefficient=Decimal("75.00")   # 75% - smaller portions
        ),
        TripParticipant(
            trip_id=trip.id,
            name="Child 2",
            coefficient=Decimal("50.00")   # 50% - toddler portions
        )
    ]
    
    for participant in participants:
        db_session.add(participant)
    
    # Add days
    days = []
    for i in range(4):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=trip.start_date + timedelta(days=i)
        )
        db_session.add(day)
        days.append(day)
    
    await db_session.commit()
    
    return {
        "trip": trip,
        "participants": participants,
        "days": days
    }


@pytest.mark.asyncio
async def test_basic_coefficient_calculation(db_session: AsyncSession, sample_trip):
    """Test basic coefficient calculations for a meal."""
    calculator = CoefficientCalculator(db_session)
    
    # Calculate for breakfast on day 1
    summary = await calculator.calculate_meal_participants(
        trip_id=sample_trip["trip"].id,
        day_id=sample_trip["days"][0].id,
        meal_slot="Breakfast"
    )
    
    assert summary.participant_count == 4
    # Total effective count: 1.0 + 1.5 + 0.75 + 0.5 = 3.75
    assert summary.effective_count == Decimal("3.75")
    assert len(summary.participants) == 4
    
    # Check individual participants
    participants_by_name = {p["name"]: p for p in summary.participants}
    
    assert participants_by_name["Adult 1"]["coefficient"] == 100.0
    assert participants_by_name["Adult 1"]["effective_portion"] == 1.0
    
    assert participants_by_name["Adult 2"]["coefficient"] == 150.0
    assert participants_by_name["Adult 2"]["effective_portion"] == 1.5
    
    assert participants_by_name["Child 1"]["coefficient"] == 75.0
    assert participants_by_name["Child 1"]["effective_portion"] == 0.75
    
    assert participants_by_name["Child 2"]["coefficient"] == 50.0
    assert participants_by_name["Child 2"]["effective_portion"] == 0.5


@pytest.mark.asyncio
async def test_daily_participant_summary(db_session: AsyncSession, sample_trip):
    """Test daily participant summary calculations."""
    calculator = CoefficientCalculator(db_session)
    
    # Calculate for day 1
    summary = await calculator.calculate_daily_participants(
        trip_id=sample_trip["trip"].id,
        day_id=sample_trip["days"][0].id
    )
    
    assert summary.total_participants == 4
    assert len(summary.meal_summaries) == 3  # Breakfast, Lunch, Dinner
    
    # Check each meal has the same effective count
    for meal_slot in ["Breakfast", "Lunch", "Dinner"]:
        meal_summary = summary.meal_summaries[meal_slot]
        assert meal_summary.effective_count == Decimal("3.75")
    
    # Average effective count should be 3.75
    assert summary.average_effective_count == Decimal("3.75")


@pytest.mark.asyncio
async def test_trip_coefficient_summary(db_session: AsyncSession, sample_trip):
    """Test trip-wide coefficient summary."""
    calculator = CoefficientCalculator(db_session)
    
    summary = await calculator.calculate_trip_summary(
        trip_id=sample_trip["trip"].id
    )
    
    assert summary.total_participants == 4
    assert len(summary.daily_summaries) == 4  # 4 days
    
    # Check meal slot totals
    # Each meal slot: 3.75 effective count * 4 days = 15.0
    assert summary.meal_slot_totals["Breakfast"] == Decimal("15.0")
    assert summary.meal_slot_totals["Lunch"] == Decimal("15.0")
    assert summary.meal_slot_totals["Dinner"] == Decimal("15.0")
    
    # Total effective days: 3.75 average * 4 days = 15.0
    assert summary.total_effective_days == Decimal("15.0")


@pytest.mark.asyncio
async def test_partial_attendance(db_session: AsyncSession, sample_trip):
    """Test calculations with partial trip attendance."""
    calculator = CoefficientCalculator(db_session)
    
    # Define attendance dates - Adult 2 arrives day 2, leaves day 3
    attendance_dates = {
        sample_trip["participants"][0].id: (
            sample_trip["trip"].start_date,
            sample_trip["trip"].end_date
        ),
        sample_trip["participants"][1].id: (
            sample_trip["trip"].start_date + timedelta(days=1),
            sample_trip["trip"].start_date + timedelta(days=2)
        ),
        sample_trip["participants"][2].id: (
            sample_trip["trip"].start_date,
            sample_trip["trip"].end_date
        ),
        sample_trip["participants"][3].id: (
            sample_trip["trip"].start_date,
            sample_trip["trip"].end_date
        )
    }
    
    summary = await calculator.calculate_trip_summary(
        trip_id=sample_trip["trip"].id,
        attendance_dates=attendance_dates
    )
    
    # Day 1: No Adult 2 (1.0 + 0.75 + 0.5 = 2.25)
    assert summary.daily_summaries[0].average_effective_count == Decimal("2.25")
    
    # Day 2 & 3: With Adult 2 (1.0 + 1.5 + 0.75 + 0.5 = 3.75)
    assert summary.daily_summaries[1].average_effective_count == Decimal("3.75")
    assert summary.daily_summaries[2].average_effective_count == Decimal("3.75")
    
    # Day 4: No Adult 2 again
    assert summary.daily_summaries[3].average_effective_count == Decimal("2.25")
    
    # Check meal slot totals
    # Breakfast: 2.25 + 3.75 + 3.75 + 2.25 = 12.0
    assert summary.meal_slot_totals["Breakfast"] == Decimal("12.0")


@pytest.mark.asyncio
async def test_shopping_quantity_calculation(db_session: AsyncSession, sample_trip):
    """Test shopping quantity calculations based on coefficients."""
    calculator = CoefficientCalculator(db_session)
    
    # Calculate quantities for 100g base amount
    quantities = await calculator.calculate_shopping_quantities(
        trip_id=sample_trip["trip"].id,
        base_quantity=Decimal("100"),
        meal_slots=["Breakfast", "Lunch"]
    )
    
    # Each meal slot: 3.75 effective count * 4 days * 100g = 1500g
    assert quantities["Breakfast"] == Decimal("1500")
    assert quantities["Lunch"] == Decimal("1500")
    assert "Dinner" not in quantities  # Not requested


@pytest.mark.asyncio
async def test_cache_functionality(db_session: AsyncSession, sample_trip):
    """Test that coefficient caching works correctly."""
    calculator = CoefficientCalculator(db_session)
    
    # First call - should populate cache
    await calculator.get_participant_coefficients(
        trip_id=sample_trip["trip"].id
    )
    
    # Check cache is populated
    assert len(calculator._coefficient_cache) > 0
    
    # Clear cache
    calculator.clear_cache()
    assert len(calculator._coefficient_cache) == 0
    
    # Second call - should repopulate cache
    coefficients = await calculator.get_participant_coefficients(
        trip_id=sample_trip["trip"].id
    )
    
    assert len(coefficients) == 12  # 4 participants * 3 meal slots


@pytest.mark.asyncio
async def test_empty_trip(db_session: AsyncSession, test_user):
    """Test calculations for a trip with no participants."""
    # Create empty trip
    trip = Trip(
        user_id=test_user.id,
        name="Empty Trip",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=1),
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    
    day = TripDay(
        trip_id=trip.id,
        day_number=1,
        date=trip.start_date
    )
    db_session.add(day)
    
    await db_session.commit()
    
    calculator = CoefficientCalculator(db_session)
    
    # Calculate for empty trip
    summary = await calculator.calculate_meal_participants(
        trip_id=trip.id,
        day_id=day.id,
        meal_slot="Breakfast"
    )
    
    assert summary.participant_count == 0
    assert summary.effective_count == Decimal("0")
    assert len(summary.participants) == 0