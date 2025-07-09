"""
Example usage of the trip cloning functionality.
"""

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from jidelnicek.trip.services import TripService
from jidelnicek.trip.schemas.trip import TripCloneRequest
from jidelnicek.trip.schemas.participant import ParticipantCreate


async def clone_trip_example(session, user_id: UUID, trip_id: UUID):
    """Example of cloning a trip with various options."""
    
    service = TripService(session)
    
    # Example 1: Clone everything from the original trip
    clone_data = TripCloneRequest(
        new_name="Winter Trek 2025",
        start_date=date(2025, 1, 15),
        clone_participants=True,
        clone_meal_slots=True,
        clone_meal_assignments=True
    )
    
    cloned_trip = await service.clone_trip(
        trip_id=trip_id,
        user_id=user_id,
        clone_data=clone_data
    )
    
    print(f"Cloned trip: {cloned_trip.name}")
    print(f"Duration: {cloned_trip.duration_days} days")
    print(f"Participants: {len(cloned_trip.participants)}")
    
    
    # Example 2: Clone with custom participants
    custom_participants = [
        ParticipantCreate(
            name="John Doe",
            coefficient=Decimal("100.00"),
            email="john@example.com"
        ),
        ParticipantCreate(
            name="Jane Smith",
            coefficient=Decimal("80.00"),
            email="jane@example.com",
            meal_coefficients={
                "breakfast": 60,
                "lunch": 80,
                "dinner": 100
            }
        )
    ]
    
    clone_data_custom = TripCloneRequest(
        new_name="Family Adventure 2025",
        start_date=date(2025, 3, 1),
        clone_participants=False,  # Will be overridden by participant_overrides
        clone_meal_slots=True,
        clone_meal_assignments=False,
        participant_overrides=custom_participants
    )
    
    cloned_trip_custom = await service.clone_trip(
        trip_id=trip_id,
        user_id=user_id,
        clone_data=clone_data_custom
    )
    
    print(f"\nCustom cloned trip: {cloned_trip_custom.name}")
    print(f"Custom participants: {[p.display_name for p in cloned_trip_custom.participants]}")
    
    
    # Example 3: Minimal clone (just the basic structure)
    minimal_clone_data = TripCloneRequest(
        new_name="Minimal Clone",
        start_date=date(2025, 6, 1),
        clone_participants=False,
        clone_meal_slots=False,  # Will use default meal slots
        clone_meal_assignments=False
    )
    
    minimal_clone = await service.clone_trip(
        trip_id=trip_id,
        user_id=user_id,
        clone_data=minimal_clone_data
    )
    
    print(f"\nMinimal clone: {minimal_clone.name}")
    print(f"Meal slots: {minimal_clone.meal_slots}")  # Should be default ["Breakfast", "Lunch", "Dinner"]