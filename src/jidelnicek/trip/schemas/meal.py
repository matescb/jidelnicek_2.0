"""
Trip meal assignment schemas.

This module defines Pydantic schemas for meal assignment validation and serialization.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class MealAssignmentBase(BaseModel):
    """Base schema for meal assignment data."""
    recipe_id: UUID = Field(..., description="ID of the recipe to assign")
    meal_slot: str = Field(..., min_length=1, max_length=50, description="Meal slot identifier (e.g., Breakfast, Lunch)")
    servings_override: Optional[int] = Field(None, ge=1, description="Override recipe servings for this meal")
    notes: Optional[str] = Field(None, description="Additional notes for this meal assignment")
    
    @field_validator('meal_slot')
    @classmethod
    def validate_meal_slot(cls, v: str) -> str:
        """Ensure meal slot is not empty."""
        if not v or not v.strip():
            raise ValueError("Meal slot cannot be empty")
        return v.strip()
    
    @field_validator('notes')
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        """Clean up notes."""
        if v and not v.strip():
            return None
        return v.strip() if v else None


class MealAssignmentCreate(MealAssignmentBase):
    """Schema for creating a meal assignment."""
    day_id: UUID = Field(..., description="ID of the trip day to assign the meal to")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "day_id": "550e8400-e29b-41d4-a716-446655440002",
                "recipe_id": "550e8400-e29b-41d4-a716-446655440003",
                "meal_slot": "Breakfast",
                "servings_override": 6,
                "notes": "Extra portion for hikers"
            }
        }
    )


class MealAssignmentUpdate(BaseModel):
    """Schema for updating a meal assignment."""
    recipe_id: Optional[UUID] = Field(None, description="New recipe ID")
    servings_override: Optional[int] = Field(None, ge=1, description="New servings override")
    notes: Optional[str] = Field(None, description="Updated notes")
    
    @field_validator('notes')
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        """Clean up notes."""
        if v and not v.strip():
            return None
        return v.strip() if v else None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "servings_override": 8,
                "notes": "Increased portions due to extra guests"
            }
        }
    )


class RecipeSnapshot(BaseModel):
    """Schema for recipe snapshot stored with meal assignment."""
    id: UUID
    name: str
    servings: int
    total_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    ingredients: List[Dict[str, Any]] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)
    version: int = Field(1, description="Version of snapshot schema")
    
    model_config = ConfigDict(from_attributes=True)


class MealAssignment(MealAssignmentBase):
    """Schema for complete meal assignment response."""
    id: UUID
    day_id: UUID
    recipe_snapshot: Optional[RecipeSnapshot] = None
    created_at: datetime
    updated_at: datetime
    
    # Computed fields from relationships
    recipe_name: Optional[str] = Field(None, description="Current recipe name")
    recipe_servings: Optional[int] = Field(None, description="Default recipe servings")
    effective_servings: int = Field(..., description="Actual servings (override or default)")
    day_number: Optional[int] = Field(None, description="Day number in trip")
    day_date: Optional[str] = Field(None, description="Date of the day (ISO format)")
    
    @model_validator(mode='after')
    def set_effective_servings(self):
        """Calculate effective servings."""
        if hasattr(self, 'servings_override') and self.servings_override is not None:
            self.effective_servings = self.servings_override
        elif hasattr(self, 'recipe_servings') and self.recipe_servings is not None:
            self.effective_servings = self.recipe_servings
        elif self.recipe_snapshot and hasattr(self.recipe_snapshot, 'servings'):
            self.effective_servings = self.recipe_snapshot.servings
        else:
            self.effective_servings = 0
        return self
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "day_id": "550e8400-e29b-41d4-a716-446655440002",
                "recipe_id": "550e8400-e29b-41d4-a716-446655440003",
                "meal_slot": "Breakfast",
                "servings_override": 6,
                "notes": "Extra portion for hikers",
                "recipe_snapshot": None,
                "created_at": "2024-01-01T12:00:00Z",
                "updated_at": "2024-01-01T12:00:00Z",
                "recipe_name": "Pancakes",
                "recipe_servings": 4,
                "effective_servings": 6,
                "day_number": 1,
                "day_date": "2024-01-01"
            }
        }
    )


class MealAssignmentBulkCreate(BaseModel):
    """Schema for bulk meal assignment creation."""
    assignments: List[MealAssignmentCreate] = Field(..., min_length=1, description="List of meal assignments to create")
    
    @model_validator(mode='after')
    def validate_assignments(self):
        """Validate bulk assignments."""
        # Check for duplicate meal slots per day
        seen = set()
        for assignment in self.assignments:
            key = (assignment.day_id, assignment.meal_slot.lower())
            if key in seen:
                raise ValueError(f"Duplicate meal slot '{assignment.meal_slot}' for day {assignment.day_id}")
            seen.add(key)
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "assignments": [
                    {
                        "day_id": "550e8400-e29b-41d4-a716-446655440002",
                        "recipe_id": "550e8400-e29b-41d4-a716-446655440003",
                        "meal_slot": "Breakfast",
                        "servings_override": 6
                    },
                    {
                        "day_id": "550e8400-e29b-41d4-a716-446655440002",
                        "recipe_id": "550e8400-e29b-41d4-a716-446655440004",
                        "meal_slot": "Lunch"
                    }
                ]
            }
        }
    )


class MealAssignmentBulkUpdate(BaseModel):
    """Schema for bulk meal assignment updates."""
    meal_ids: List[UUID] = Field(..., min_length=1, description="List of meal IDs to update")
    update_data: MealAssignmentUpdate = Field(..., description="Update data to apply to all meals")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "meal_ids": [
                    "550e8400-e29b-41d4-a716-446655440000",
                    "550e8400-e29b-41d4-a716-446655440001"
                ],
                "update_data": {
                    "servings_override": 8,
                    "notes": "Increased portions for all meals"
                }
            }
        }
    )


class MealAssignmentSwap(BaseModel):
    """Schema for swapping two meal assignments."""
    meal_id_1: UUID = Field(..., description="First meal ID")
    meal_id_2: UUID = Field(..., description="Second meal ID")
    
    @model_validator(mode='after')
    def validate_different_meals(self):
        """Ensure meals are different."""
        if self.meal_id_1 == self.meal_id_2:
            raise ValueError("Cannot swap a meal with itself")
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "meal_id_1": "550e8400-e29b-41d4-a716-446655440000",
                "meal_id_2": "550e8400-e29b-41d4-a716-446655440001"
            }
        }
    )


class PortionCalculation(BaseModel):
    """Schema for portion calculation details."""
    meal_id: UUID
    recipe_id: UUID
    recipe_name: str
    base_servings: int = Field(..., description="Original recipe servings")
    required_servings: int = Field(..., description="Required servings (override or calculated)")
    scaling_factor: Decimal = Field(..., description="Multiplier for ingredients")
    participant_count: int = Field(..., description="Number of participants")
    meal_coefficients: Dict[str, float] = Field(..., description="Meal type coefficients applied")
    
    @property
    def is_scaled(self) -> bool:
        """Check if portions need scaling."""
        return self.scaling_factor != Decimal('1.0')
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "meal_id": "550e8400-e29b-41d4-a716-446655440000",
                "recipe_id": "550e8400-e29b-41d4-a716-446655440003",
                "recipe_name": "Pancakes",
                "base_servings": 4,
                "required_servings": 8,
                "scaling_factor": "2.0",
                "participant_count": 8,
                "meal_coefficients": {
                    "breakfast": 1.0,
                    "child": 0.5
                }
            }
        }
    )


class DayMealAssignments(BaseModel):
    """Schema for meal assignments grouped by day."""
    day_id: UUID
    day_number: int
    date: str  # ISO format date string
    meal_assignments: List[MealAssignment] = Field(default_factory=list)
    total_meals: int = Field(0, description="Total number of assigned meals")
    
    @model_validator(mode='after')
    def calculate_totals(self):
        """Calculate summary statistics."""
        self.total_meals = len(self.meal_assignments)
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "day_id": "550e8400-e29b-41d4-a716-446655440002",
                "day_number": 1,
                "date": "2024-01-01",
                "meal_assignments": [],
                "total_meals": 0
            }
        }
    )


class TripMealPlan(BaseModel):
    """Schema for complete trip meal plan."""
    trip_id: UUID
    trip_name: str
    start_date: str
    end_date: str
    days: List[DayMealAssignments] = Field(default_factory=list)
    total_days: int
    total_meals: int
    total_unique_recipes: int
    
    @model_validator(mode='after')
    def calculate_statistics(self):
        """Calculate trip-wide statistics."""
        self.total_days = len(self.days)
        self.total_meals = sum(day.total_meals for day in self.days)
        
        # Count unique recipes
        unique_recipes = set()
        for day in self.days:
            for meal in day.meal_assignments:
                unique_recipes.add(meal.recipe_id)
        self.total_unique_recipes = len(unique_recipes)
        
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trip_id": "550e8400-e29b-41d4-a716-446655440001",
                "trip_name": "Summer Camp 2024",
                "start_date": "2024-07-01",
                "end_date": "2024-07-07",
                "days": [],
                "total_days": 7,
                "total_meals": 21,
                "total_unique_recipes": 15
            }
        }
    )


class MealPlanningStatus(BaseModel):
    """Schema for meal planning status summary."""
    trip_id: UUID
    total_meal_slots: int = Field(..., description="Total number of meal slots in trip")
    assigned_meals: int = Field(..., description="Number of assigned meals")
    unassigned_slots: int = Field(..., description="Number of unassigned meal slots")
    completion_percentage: float = Field(..., description="Percentage of meal slots with assignments")
    unassigned_details: List[Dict[str, Any]] = Field(default_factory=list, description="Details of unassigned slots")
    
    @model_validator(mode='after')
    def calculate_completion(self):
        """Calculate completion percentage."""
        if self.total_meal_slots > 0:
            self.completion_percentage = (self.assigned_meals / self.total_meal_slots) * 100
        else:
            self.completion_percentage = 0.0
        
        self.unassigned_slots = self.total_meal_slots - self.assigned_meals
        return self
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trip_id": "550e8400-e29b-41d4-a716-446655440001",
                "total_meal_slots": 21,
                "assigned_meals": 18,
                "unassigned_slots": 3,
                "completion_percentage": 85.7,
                "unassigned_details": [
                    {"day_number": 3, "meal_slot": "Dinner", "day_id": "..."},
                    {"day_number": 5, "meal_slot": "Breakfast", "day_id": "..."},
                    {"day_number": 7, "meal_slot": "Lunch", "day_id": "..."}
                ]
            }
        }
    )