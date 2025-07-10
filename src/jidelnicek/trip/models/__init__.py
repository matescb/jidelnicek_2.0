"""
Trip models package.

This package contains all database models related to trip management.
"""

from .trip import Trip
from .participant import TripParticipant
from .day import TripDay
from .meal import TripMeal
from .stove import TripStove
from .meal_slot import TripMealSlot
from .template import TripTemplate
from .invitation import TripInvitation, TripInvitationLink

__all__ = [
    "Trip",
    "TripParticipant",
    "TripDay", 
    "TripMeal",
    "TripStove",
    "TripMealSlot",
    "TripTemplate",
    "TripInvitation",
    "TripInvitationLink",
    # Additional models will be added here as they are created:
    # "TripRecipeSnapshot",
    # "TripDaySnack",
    # "TripDayDrink",
]