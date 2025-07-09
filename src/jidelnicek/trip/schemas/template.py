"""
Trip template Pydantic schemas for API request/response validation.

This module contains all schemas for trip template CRUD operations including:
- Template creation with participant and meal configurations
- Template list with pagination and filtering
- Template detailed view with all configurations
- Creating trips from templates
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, validator, model_validator
from pydantic.config import ConfigDict


class ParticipantTemplate(BaseModel):
    """Schema for participant configuration in templates."""
    name: str = Field(..., min_length=1, max_length=100, description="Participant name")
    coefficient: Decimal = Field(
        Decimal("100.00"), 
        ge=Decimal("10.00"), 
        le=Decimal("200.00"),
        description="Portion coefficient percentage (10-200%)"
    )

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Participant name cannot be empty")
        return v.strip()


class MealAssignmentTemplate(BaseModel):
    """Schema for meal assignment patterns in templates."""
    day_number: int = Field(..., ge=1, description="Day number (1-based)")
    meal_slot: str = Field(..., description="Meal slot name")
    recipe_id: Optional[UUID] = Field(None, description="Pre-assigned recipe ID")
    meal_type: Optional[str] = Field(None, description="Meal type hint (e.g., 'hot', 'cold', 'snack')")
    notes: Optional[str] = Field(None, max_length=500, description="Notes for this meal slot")

    @validator('meal_slot')
    def validate_meal_slot(cls, v):
        if not v.strip():
            raise ValueError("Meal slot name cannot be empty")
        return v.strip()


class TripTemplateBase(BaseModel):
    """Base schema for trip templates."""
    name: str = Field(..., min_length=1, max_length=200, description="Template name")
    description: Optional[str] = Field(None, max_length=2000, description="Template description")
    duration_days: int = Field(..., ge=1, le=365, description="Number of days in the trip")
    meal_slots: List[str] = Field(
        default=["Breakfast", "Lunch", "Dinner"],
        min_items=1,
        max_items=10,
        description="Configured meal slots for the trip"
    )
    participants: List[ParticipantTemplate] = Field(
        default_factory=list,
        max_items=20,
        description="Participant configurations"
    )
    is_public: bool = Field(False, description="Whether template is available to all users")
    category: Optional[str] = Field(None, max_length=50, description="Template category")
    tags: List[str] = Field(
        default_factory=list,
        max_items=10,
        description="Tags for template organization"
    )

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Template name cannot be empty")
        return v.strip()

    @validator('meal_slots')
    def validate_meal_slots(cls, v):
        if not v:
            raise ValueError("At least one meal slot is required")
        
        # Check for duplicates
        if len(v) != len(set(v)):
            raise ValueError("Meal slot names must be unique")
        
        # Validate each slot name
        for slot in v:
            if not slot.strip():
                raise ValueError("Meal slot names cannot be empty")
            if len(slot) > 50:
                raise ValueError("Meal slot names cannot exceed 50 characters")
        
        return [slot.strip() for slot in v]

    @validator('category')
    def validate_category(cls, v):
        if v and not v.strip():
            raise ValueError("Category cannot be empty")
        return v.strip() if v else v

    @validator('tags')
    def validate_tags(cls, v):
        if not v:
            return v
        
        # Clean and validate each tag
        clean_tags = []
        for tag in v:
            if not isinstance(tag, str):
                raise ValueError("Tags must be strings")
            tag_clean = tag.strip().lower()
            if not tag_clean:
                continue
            if len(tag_clean) > 30:
                raise ValueError(f"Tag '{tag_clean}' exceeds 30 characters")
            clean_tags.append(tag_clean)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in clean_tags:
            if tag not in seen:
                seen.add(tag)
                unique_tags.append(tag)
        
        return unique_tags

    @validator('participants')
    def validate_participants(cls, v):
        if len(v) > 20:
            raise ValueError("Maximum 20 participants allowed per template")
        
        # Check for duplicate names
        names = [p.name for p in v]
        if len(names) != len(set(names)):
            raise ValueError("Participant names must be unique")
        
        return v


class TripTemplateCreate(TripTemplateBase):
    """Schema for creating trip templates."""
    meal_assignments: List[MealAssignmentTemplate] = Field(
        default_factory=list,
        description="Optional pre-configured meal assignments"
    )

    @model_validator(mode='after')
    def validate_meal_assignments(self):
        """Validate meal assignments against template configuration."""
        if not self.meal_assignments:
            return self
        
        # Validate day numbers are within duration
        for assignment in self.meal_assignments:
            if assignment.day_number > self.duration_days:
                raise ValueError(
                    f"Meal assignment day {assignment.day_number} exceeds template duration {self.duration_days}"
                )
        
        # Validate meal slots exist in template
        valid_slots = set(self.meal_slots)
        for assignment in self.meal_assignments:
            if assignment.meal_slot not in valid_slots:
                raise ValueError(
                    f"Meal slot '{assignment.meal_slot}' not found in template meal slots"
                )
        
        return self


class TripTemplateUpdate(BaseModel):
    """Schema for updating trip templates."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    duration_days: Optional[int] = Field(None, ge=1, le=365)
    meal_slots: Optional[List[str]] = Field(None, min_items=1, max_items=10)
    participants: Optional[List[ParticipantTemplate]] = Field(None, max_items=20)
    meal_assignments: Optional[List[MealAssignmentTemplate]] = None
    is_public: Optional[bool] = None
    category: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = Field(None, max_items=10)

    @validator('name')
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Template name cannot be empty")
        return v.strip() if v else v

    @validator('meal_slots')
    def validate_meal_slots(cls, v):
        if v is not None:
            if not v:
                raise ValueError("At least one meal slot is required")
            
            # Check for duplicates
            if len(v) != len(set(v)):
                raise ValueError("Meal slot names must be unique")
            
            # Validate each slot name
            for slot in v:
                if not slot.strip():
                    raise ValueError("Meal slot names cannot be empty")
                if len(slot) > 50:
                    raise ValueError("Meal slot names cannot exceed 50 characters")
            
            return [slot.strip() for slot in v]
        return v

    @validator('category')
    def validate_category(cls, v):
        if v and not v.strip():
            raise ValueError("Category cannot be empty")
        return v.strip() if v else v

    @validator('tags')
    def validate_tags(cls, v):
        if v is None:
            return v
        
        # Clean and validate each tag
        clean_tags = []
        for tag in v:
            if not isinstance(tag, str):
                raise ValueError("Tags must be strings")
            tag_clean = tag.strip().lower()
            if not tag_clean:
                continue
            if len(tag_clean) > 30:
                raise ValueError(f"Tag '{tag_clean}' exceeds 30 characters")
            clean_tags.append(tag_clean)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in clean_tags:
            if tag not in seen:
                seen.add(tag)
                unique_tags.append(tag)
        
        return unique_tags

    @validator('participants')
    def validate_participants(cls, v):
        if v is not None:
            if len(v) > 20:
                raise ValueError("Maximum 20 participants allowed per template")
            
            # Check for duplicate names
            names = [p.name for p in v]
            if len(names) != len(set(names)):
                raise ValueError("Participant names must be unique")
        
        return v


class TripTemplate(TripTemplateBase):
    """Schema for trip template responses."""
    id: UUID
    user_id: UUID
    meal_assignments: Dict[str, Any] = Field(
        default_factory=dict,
        description="Stored meal assignments configuration"
    )
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = Field(None, description="Name of template creator (for public templates)")
    usage_count: int = Field(0, description="Number of trips created from this template")

    model_config = ConfigDict(from_attributes=True)


class TripTemplatePreview(BaseModel):
    """Schema for trip template preview in listings."""
    id: UUID
    name: str
    description: Optional[str]
    duration_days: int
    participant_count: int
    meal_slot_count: int
    is_public: bool
    category: Optional[str]
    tags: List[str]
    created_by_name: Optional[str]
    usage_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TripTemplateList(BaseModel):
    """Schema for paginated trip template list responses."""
    items: List[TripTemplatePreview]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class CreateTripFromTemplate(BaseModel):
    """Schema for creating a trip from a template."""
    template_id: UUID = Field(..., description="ID of the template to use")
    trip_name: str = Field(..., min_length=1, max_length=100, description="Name for the new trip")
    start_date: date = Field(..., description="Start date for the new trip")
    include_meal_assignments: bool = Field(
        True, 
        description="Whether to copy meal assignments from template"
    )
    participant_overrides: Optional[List[ParticipantTemplate]] = Field(
        None,
        description="Override template participants with custom list"
    )
    meal_slot_overrides: Optional[List[str]] = Field(
        None,
        min_items=1,
        max_items=10,
        description="Override template meal slots with custom list"
    )
    notes: Optional[str] = Field(None, max_length=2000, description="Initial trip notes")

    @validator('trip_name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Trip name cannot be empty")
        return v.strip()

    @validator('meal_slot_overrides')
    def validate_meal_slots(cls, v):
        if v is not None:
            if not v:
                raise ValueError("At least one meal slot is required")
            
            # Check for duplicates
            if len(v) != len(set(v)):
                raise ValueError("Meal slot names must be unique")
            
            # Validate each slot name
            for slot in v:
                if not slot.strip():
                    raise ValueError("Meal slot names cannot be empty")
                if len(slot) > 50:
                    raise ValueError("Meal slot names cannot exceed 50 characters")
            
            return [slot.strip() for slot in v]
        return v

    @validator('participant_overrides')
    def validate_participants(cls, v):
        if v is not None:
            if len(v) > 20:
                raise ValueError("Maximum 20 participants allowed per trip")
            
            # Check for duplicate names
            names = [p.name for p in v]
            if len(names) != len(set(names)):
                raise ValueError("Participant names must be unique")
        
        return v


class TripTemplateSearchFilters(BaseModel):
    """Schema for trip template search filters."""
    query: Optional[str] = Field(None, description="Search query for template name or description")
    is_public: Optional[bool] = Field(None, description="Filter by public/private status")
    category: Optional[str] = Field(None, description="Filter by category")
    tags: Optional[List[str]] = Field(None, description="Filter by tags (OR condition)")
    min_duration_days: Optional[int] = Field(None, ge=1, description="Minimum duration in days")
    max_duration_days: Optional[int] = Field(None, ge=1, description="Maximum duration in days")
    min_participants: Optional[int] = Field(None, ge=0, description="Minimum number of participants")
    max_participants: Optional[int] = Field(None, ge=0, description="Maximum number of participants")
    created_by_me: Optional[bool] = Field(None, description="Filter templates created by current user")
    created_after: Optional[datetime] = Field(None, description="Filter by creation date (after)")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date (before)")

    @model_validator(mode='after')
    def validate_filters(self):
        """Validate filter combinations."""
        if self.min_duration_days and self.max_duration_days:
            if self.min_duration_days > self.max_duration_days:
                raise ValueError("min_duration_days cannot be greater than max_duration_days")
        
        if self.min_participants and self.max_participants:
            if self.min_participants > self.max_participants:
                raise ValueError("min_participants cannot be greater than max_participants")
        
        if self.created_after and self.created_before:
            if self.created_after > self.created_before:
                raise ValueError("created_after cannot be after created_before")
        
        return self