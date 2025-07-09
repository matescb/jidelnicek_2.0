"""
Trip schemas package.

This package contains all Pydantic schemas for the trip module.
"""

from .trip import (
    TripBase,
    TripCreate,
    TripUpdate,
    TripResponse,
    TripListItem,
    TripListResponse,
    TripSearchFilters
)

from .participant import (
    ParticipantBase,
    ParticipantCreate,
    ParticipantUpdate,
    Participant,
    ParticipantSummary,
    DayParticipants,
    MealCoefficients
)

from .meal_slot import (
    MealSlotBase,
    MealSlotCreate,
    MealSlotUpdate,
    MealSlot,
    DayMealSlots,
    TripMealPattern,
    MealSlotBulkCreate
)

from .meal import (
    MealAssignmentBase,
    MealAssignmentCreate,
    MealAssignmentUpdate,
    MealAssignment,
    MealAssignmentBulkCreate,
    MealAssignmentBulkUpdate,
    MealAssignmentSwap,
    RecipeSnapshot,
    PortionCalculation,
    DayMealAssignments,
    TripMealPlan,
    MealPlanningStatus
)

from .day_plan import (
    ParticipantAttendance,
    MealIngredientSummary,
    MealNutritionalSummary,
    MealSlotPlan,
    DayShoppingItem,
    DayShoppingList,
    DayPlanSummary,
    TripDayByDayPlan,
    MealSlotAssignmentRequest,
    DayPlanUpdateRequest
)

from .template import (
    ParticipantTemplate,
    MealAssignmentTemplate,
    TripTemplateBase,
    TripTemplateCreate,
    TripTemplateUpdate,
    TripTemplate,
    TripTemplateList,
    TripTemplatePreview,
    CreateTripFromTemplate,
    TripTemplateSearchFilters
)

__all__ = [
    # Trip schemas
    "TripBase",
    "TripCreate", 
    "TripUpdate",
    "TripResponse",
    "TripListItem",
    "TripListResponse",
    "TripSearchFilters",
    # Participant schemas
    "ParticipantBase",
    "ParticipantCreate",
    "ParticipantUpdate",
    "Participant",
    "ParticipantSummary",
    "DayParticipants",
    "MealCoefficients",
    # Meal slot schemas
    "MealSlotBase",
    "MealSlotCreate",
    "MealSlotUpdate",
    "MealSlot",
    "DayMealSlots",
    "TripMealPattern",
    "MealSlotBulkCreate",
    # Meal assignment schemas
    "MealAssignmentBase",
    "MealAssignmentCreate",
    "MealAssignmentUpdate",
    "MealAssignment",
    "MealAssignmentBulkCreate",
    "MealAssignmentBulkUpdate",
    "MealAssignmentSwap",
    "RecipeSnapshot",
    "PortionCalculation",
    "DayMealAssignments",
    "TripMealPlan",
    "MealPlanningStatus",
    # Day plan schemas
    "ParticipantAttendance",
    "MealIngredientSummary",
    "MealNutritionalSummary",
    "MealSlotPlan",
    "DayShoppingItem",
    "DayShoppingList",
    "DayPlanSummary",
    "TripDayByDayPlan",
    "MealSlotAssignmentRequest",
    "DayPlanUpdateRequest",
    # Template schemas
    "ParticipantTemplate",
    "MealAssignmentTemplate",
    "TripTemplateBase",
    "TripTemplateCreate",
    "TripTemplateUpdate",
    "TripTemplate",
    "TripTemplateList",
    "TripTemplatePreview",
    "CreateTripFromTemplate",
    "TripTemplateSearchFilters"
]