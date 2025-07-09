"""
Trip meal slot schemas.

This module defines Pydantic schemas for meal slot validation and serialization.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class MealSlotBase(BaseModel):
    """Base schema for meal slot data."""
    meal_type: str = Field(..., min_length=1, max_length=50, description="Type of meal (e.g., Breakfast, Lunch, Dinner)")
    is_active: bool = Field(True, description="Whether this meal slot is active")
    custom_name: Optional[str] = Field(None, max_length=100, description="Custom name for the meal slot")
    display_order: int = Field(0, ge=0, description="Order for display purposes")
    
    @field_validator('meal_type')
    @classmethod
    def validate_meal_type(cls, v: str) -> str:
        """Ensure meal type is not empty."""
        if not v or not v.strip():
            raise ValueError("Meal type cannot be empty")
        return v.strip()
    
    @field_validator('custom_name')
    @classmethod
    def validate_custom_name(cls, v: Optional[str]) -> Optional[str]:
        """Clean up custom name."""
        if v and not v.strip():
            return None
        return v.strip() if v else None


class MealSlotCreate(MealSlotBase):
    """Schema for creating a meal slot."""
    day_number: int = Field(..., ge=1, description="Day number in the trip")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "day_number": 1,
                "meal_type": "Breakfast",
                "is_active": True,
                "display_order": 1
            }
        }
    )


class MealSlotUpdate(BaseModel):
    """Schema for updating a meal slot."""
    is_active: Optional[bool] = None
    custom_name: Optional[str] = Field(None, max_length=100)
    display_order: Optional[int] = Field(None, ge=0)
    
    @field_validator('custom_name')
    @classmethod
    def validate_custom_name(cls, v: Optional[str]) -> Optional[str]:
        """Clean up custom name."""
        if v and not v.strip():
            return None
        return v.strip() if v else None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "is_active": False,
                "custom_name": "Brunch",
                "display_order": 2
            }
        }
    )


class MealSlot(MealSlotBase):
    """Schema for meal slot with all fields."""
    id: UUID
    trip_id: UUID
    day_id: UUID
    day_number: int
    created_at: datetime
    updated_at: datetime
    
    @property
    def display_name(self) -> str:
        """Get display name for the meal slot."""
        return self.custom_name or self.meal_type
    
    @property
    def is_standard_meal(self) -> bool:
        """Check if this is a standard meal type."""
        standard_meals = {'breakfast', 'lunch', 'dinner'}
        return self.meal_type.lower() in standard_meals
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "trip_id": "550e8400-e29b-41d4-a716-446655440001",
                "day_id": "550e8400-e29b-41d4-a716-446655440002",
                "day_number": 1,
                "meal_type": "Breakfast",
                "is_active": True,
                "custom_name": None,
                "display_order": 1,
                "created_at": "2024-01-01T12:00:00Z",
                "updated_at": "2024-01-01T12:00:00Z"
            }
        }
    )


class DayMealSlots(BaseModel):
    """Schema for meal slots grouped by day."""
    day_number: int
    day_id: UUID
    date: str  # ISO format date string
    meal_slots: List[MealSlot]
    active_count: int
    
    @model_validator(mode='after')
    def calculate_active_count(self):
        """Calculate number of active meal slots."""
        self.active_count = sum(1 for slot in self.meal_slots if slot.is_active)
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "day_number": 1,
                "day_id": "550e8400-e29b-41d4-a716-446655440002",
                "date": "2024-01-01",
                "meal_slots": [],
                "active_count": 0
            }
        }
    )


class TripMealPattern(BaseModel):
    """Schema for trip-wide meal pattern configuration."""
    trip_id: UUID
    default_meal_types: List[str] = Field(
        default_factory=lambda: ["Breakfast", "Lunch", "Dinner"],
        description="Default meal types for new days"
    )
    total_days: int
    total_meal_slots: int
    active_meal_slots: int
    meal_slot_summary: dict[str, int]  # meal_type -> count
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trip_id": "550e8400-e29b-41d4-a716-446655440001",
                "default_meal_types": ["Breakfast", "Lunch", "Dinner"],
                "total_days": 5,
                "total_meal_slots": 15,
                "active_meal_slots": 14,
                "meal_slot_summary": {
                    "Breakfast": 5,
                    "Lunch": 5,
                    "Dinner": 4,
                    "Snack": 1
                }
            }
        }
    )


class MealSlotBulkCreate(BaseModel):
    """Schema for creating meal slots in bulk."""
    meal_slots: List[MealSlotCreate]
    
    @field_validator('meal_slots')
    @classmethod
    def validate_meal_slots(cls, v: List[MealSlotCreate]) -> List[MealSlotCreate]:
        """Validate bulk meal slots."""
        if not v:
            raise ValueError("At least one meal slot must be provided")
        
        # Check for duplicates
        seen = set()
        for slot in v:
            key = (slot.day_number, slot.meal_type.lower())
            if key in seen:
                raise ValueError(f"Duplicate meal slot: Day {slot.day_number}, {slot.meal_type}")
            seen.add(key)
        
        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "meal_slots": [
                    {
                        "day_number": 1,
                        "meal_type": "Breakfast",
                        "is_active": True,
                        "display_order": 1
                    },
                    {
                        "day_number": 1,
                        "meal_type": "Lunch",
                        "is_active": True,
                        "display_order": 2
                    }
                ]
            }
        }
    )