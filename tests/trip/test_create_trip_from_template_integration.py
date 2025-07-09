"""
Integration test to verify create trip from template functionality.

This test ensures the complete flow works end-to-end.
"""

import pytest
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.trip.services.template_service import TripTemplateService
from jidelnicek.trip.services.trip_service import TripService
from jidelnicek.trip.schemas.template import (
    TripTemplateCreate, CreateTripFromTemplate, ParticipantTemplate
)


@pytest.mark.asyncio
async def test_complete_create_trip_from_template_flow(
    db_session: AsyncSession,
    test_user
):
    """Test the complete flow of creating a trip from a template."""
    template_service = TripTemplateService(db_session)
    
    # Step 1: Create a template
    template_data = TripTemplateCreate(
        name="Weekend Camping Template",
        description="Perfect for a weekend getaway",
        duration_days=3,
        meal_slots=["Breakfast", "Lunch", "Dinner", "Snack"],
        participants=[
            ParticipantTemplate(name="Adult 1", coefficient=Decimal("100.00")),
            ParticipantTemplate(name="Adult 2", coefficient=Decimal("100.00")),
            ParticipantTemplate(name="Child", coefficient=Decimal("75.00"))
        ],
        is_public=True,
        category="camping",
        tags=["weekend", "family", "outdoor"]
    )
    
    template = await template_service.create_template(test_user.id, template_data)
    
    # Verify template was created correctly
    assert template.id is not None
    assert template.name == "Weekend Camping Template"
    assert template.duration_days == 3
    assert len(template.meal_slots) == 4
    assert len(template.participants) == 3
    
    # Step 2: Create a trip from the template
    create_trip_data = CreateTripFromTemplate(
        template_id=template.id,
        trip_name="Family Camping Trip July 2024",
        start_date=date(2024, 7, 19),  # Friday
        include_meal_assignments=True,
        notes="Don't forget the marshmallows!"
    )
    
    trip = await template_service.create_trip_from_template(
        template_id=template.id,
        user_id=test_user.id,
        create_data=create_trip_data
    )
    
    # Verify trip was created correctly
    assert trip.id is not None
    assert trip.name == "Family Camping Trip July 2024"
    assert trip.start_date == date(2024, 7, 19)
    assert trip.end_date == date(2024, 7, 21)  # Sunday (3 days)
    assert trip.meal_slots == ["Breakfast", "Lunch", "Dinner", "Snack"]
    assert trip.notes == "Don't forget the marshmallows!"
    assert trip.user_id == test_user.id
    
    # Step 3: Verify the trip can be retrieved
    trip_service = TripService(db_session)
    retrieved_trip = await trip_service.get_trip(trip.id, test_user.id)
    
    assert retrieved_trip.id == trip.id
    assert retrieved_trip.name == trip.name
    
    # Step 4: Create another trip with overrides
    create_trip_data_2 = CreateTripFromTemplate(
        template_id=template.id,
        trip_name="Couples Camping Trip",
        start_date=date(2024, 8, 10),
        participant_overrides=[
            ParticipantTemplate(name="John", coefficient=Decimal("100.00")),
            ParticipantTemplate(name="Jane", coefficient=Decimal("90.00"))
        ],
        meal_slot_overrides=["Brunch", "Dinner"]
    )
    
    trip_2 = await template_service.create_trip_from_template(
        template_id=template.id,
        user_id=test_user.id,
        create_data=create_trip_data_2
    )
    
    # Verify overrides were applied
    assert trip_2.name == "Couples Camping Trip"
    assert trip_2.meal_slots == ["Brunch", "Dinner"]
    
    # Note: Participant verification would require fetching through participant service
    
    print("✅ Complete create trip from template flow works correctly!")