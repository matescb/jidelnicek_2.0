"""
Trip planning Pydantic schemas for API request/response validation.

This module contains all schemas for trip CRUD operations including:
- Trip creation with meal slot configuration
- Trip participant management
- Trip date management and validation
- Trip list with pagination
- Trip updating and archiving
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, validator, model_validator
from pydantic.config import ConfigDict


class TripParticipantBase(BaseModel):
    """Base schema for trip participants."""
    name: Optional[str] = Field(None, max_length=100, description="Participant name")
    number: Optional[int] = Field(None, ge=1, description="Participant number (if not using name)")
    coefficient: Decimal = Field(
        Decimal("100.00"), 
        ge=Decimal("10"), 
        le=Decimal("300"),
        description="Portion coefficient percentage (100 = 100%)"
    )

    @model_validator(mode='after')
    def validate_name_or_number(self):
        """Ensure either name or number is provided."""
        if not self.name and self.number is None:
            raise ValueError("Either name or number must be provided for participant")
        if self.name and self.number is not None:
            raise ValueError("Provide either name or number, not both")
        return self


class TripParticipantCreate(TripParticipantBase):
    """Schema for creating trip participants."""
    pass


class TripParticipantUpdate(BaseModel):
    """Schema for updating trip participants."""
    name: Optional[str] = Field(None, max_length=100)
    number: Optional[int] = Field(None, ge=1)
    coefficient: Optional[Decimal] = Field(None, ge=Decimal("10"), le=Decimal("300"))


class TripParticipantResponse(TripParticipantBase):
    """Schema for trip participant responses."""
    id: UUID
    trip_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TripBase(BaseModel):
    """Base schema for trips."""
    name: str = Field(..., min_length=1, max_length=100, description="Trip name")
    description: Optional[str] = Field(None, max_length=2000, description="Trip description and notes")
    status: str = Field(
        default="planned",
        description="Trip status: planned, active, completed, cancelled"
    )
    start_date: date = Field(..., description="Trip start date")
    end_date: date = Field(..., description="Trip end date")
    meal_slots: List[str] = Field(
        default=["Breakfast", "Lunch", "Dinner"],
        min_items=1,
        max_items=10,
        description="Configured meal slots for the trip"
    )
    recipe_storage_mode: str = Field(
        default="snapshot",
        description="Recipe storage mode: 'snapshot' or 'track_changes'"
    )
    notes: Optional[str] = Field(None, max_length=2000, description="Trip notes")

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Trip name cannot be empty")
        return v.strip()
    
    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) > 2000:
                raise ValueError("Trip description cannot exceed 2000 characters")
            return v if v else None
        return None
    
    @validator('status')
    def validate_status(cls, v):
        valid_statuses = {'planned', 'active', 'completed', 'cancelled'}
        if v not in valid_statuses:
            raise ValueError(f"Trip status must be one of: {', '.join(valid_statuses)}")
        return v

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

    @validator('recipe_storage_mode')
    def validate_storage_mode(cls, v):
        allowed_modes = ['snapshot', 'track_changes']
        if v not in allowed_modes:
            raise ValueError(f"Recipe storage mode must be one of: {', '.join(allowed_modes)}")
        return v

    @model_validator(mode='after')
    def validate_dates(self):
        """Ensure end date is not before start date."""
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        
        # Check reasonable trip duration (e.g., max 365 days)
        duration = (self.end_date - self.start_date).days
        if duration > 365:
            raise ValueError("Trip duration cannot exceed 365 days")
        
        return self


class TripCreate(TripBase):
    """Schema for creating trips."""
    participants: List[TripParticipantCreate] = Field(
        default_factory=list,
        max_items=20,
        description="Trip participants (max 20)"
    )

    @validator('participants')
    def validate_participants(cls, v):
        if len(v) > 20:
            raise ValueError("Maximum 20 participants allowed per trip")
        
        # Check for duplicate names
        names = [p.name for p in v if p.name]
        if len(names) != len(set(names)):
            raise ValueError("Participant names must be unique")
        
        # Check for duplicate numbers
        numbers = [p.number for p in v if p.number is not None]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Participant numbers must be unique")
        
        return v


class TripUpdate(BaseModel):
    """Schema for updating trips."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    meal_slots: Optional[List[str]] = Field(None, min_items=1, max_items=10)
    recipe_storage_mode: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)
    participants: Optional[List[TripParticipantUpdate]] = None

    @validator('name')
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Trip name cannot be empty")
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

    @validator('recipe_storage_mode')
    def validate_storage_mode(cls, v):
        if v is not None:
            allowed_modes = ['snapshot', 'track_changes']
            if v not in allowed_modes:
                raise ValueError(f"Recipe storage mode must be one of: {', '.join(allowed_modes)}")
        return v

    @model_validator(mode='after')
    def validate_dates(self):
        """Ensure date updates maintain consistency."""
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("End date cannot be before start date")
            
            # Check reasonable trip duration
            duration = (self.end_date - self.start_date).days
            if duration > 365:
                raise ValueError("Trip duration cannot exceed 365 days")
        
        return self


class TripListItem(BaseModel):
    """Schema for trip list items (simplified view)."""
    id: UUID
    name: str
    start_date: date
    end_date: date
    duration_days: int
    participant_count: int
    meal_slot_count: int
    recipe_storage_mode: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    has_stove: bool = False
    total_meals_planned: int = 0
    completion_percentage: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class TripDaySummary(BaseModel):
    """Schema for trip day summary."""
    id: UUID
    day_number: int
    date: date
    meals_planned: int
    total_calories: Optional[Decimal]
    total_weight_g: Optional[Decimal]
    has_all_meals: bool
    notes: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class TripResponse(TripBase):
    """Schema for detailed trip responses."""
    id: UUID
    user_id: UUID
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    duration_days: int
    participants: List[TripParticipantResponse] = Field(default_factory=list)
    days: List[TripDaySummary] = Field(default_factory=list)
    has_stove: bool = False
    stove_efficiency: Optional[Decimal] = None
    total_meals_planned: int = 0
    completion_percentage: float = 0.0
    total_calories: Optional[Decimal] = None
    total_weight_g: Optional[Decimal] = None
    total_water_ml: Optional[int] = None
    total_fuel_g: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class TripListResponse(BaseModel):
    """Schema for paginated trip list responses."""
    items: List[TripListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class TripSearchFilters(BaseModel):
    """Schema for trip search filters."""
    query: Optional[str] = Field(None, description="Search query for trip name")
    start_date_from: Optional[date] = Field(None, description="Filter trips starting from this date")
    start_date_to: Optional[date] = Field(None, description="Filter trips starting until this date")
    end_date_from: Optional[date] = Field(None, description="Filter trips ending from this date")
    end_date_to: Optional[date] = Field(None, description="Filter trips ending until this date")
    min_duration_days: Optional[int] = Field(None, ge=1, description="Minimum trip duration in days")
    max_duration_days: Optional[int] = Field(None, ge=1, description="Maximum trip duration in days")
    min_participants: Optional[int] = Field(None, ge=1, le=20, description="Minimum number of participants")
    max_participants: Optional[int] = Field(None, ge=1, le=20, description="Maximum number of participants")
    is_archived: Optional[bool] = Field(None, description="Filter by archived status")
    has_stove: Optional[bool] = Field(None, description="Filter by stove configuration")
    recipe_storage_mode: Optional[str] = Field(None, description="Filter by recipe storage mode")
    created_after: Optional[datetime] = Field(None, description="Filter by creation date (after)")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date (before)")

    @validator('recipe_storage_mode')
    def validate_storage_mode(cls, v):
        if v is not None:
            allowed_modes = ['snapshot', 'track_changes']
            if v not in allowed_modes:
                raise ValueError(f"Recipe storage mode must be one of: {', '.join(allowed_modes)}")
        return v

    @model_validator(mode='after')
    def validate_date_ranges(self):
        """Validate date range filters."""
        if self.start_date_from and self.start_date_to:
            if self.start_date_from > self.start_date_to:
                raise ValueError("start_date_from cannot be after start_date_to")
        
        if self.end_date_from and self.end_date_to:
            if self.end_date_from > self.end_date_to:
                raise ValueError("end_date_from cannot be after end_date_to")
        
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


class TripDuplicateRequest(BaseModel):
    """Schema for trip duplication request."""
    new_name: Optional[str] = Field(None, min_length=1, max_length=100, description="New name for duplicated trip")
    include_meals: bool = Field(True, description="Include meal assignments in duplicate")
    include_participants: bool = Field(True, description="Include participants in duplicate")
    new_start_date: Optional[date] = Field(None, description="New start date for duplicated trip")


class TripTemplateRequest(BaseModel):
    """Schema for creating trip template."""
    template_name: str = Field(..., min_length=1, max_length=100, description="Template name")
    is_day_template: bool = Field(False, description="Whether this is a day template or full trip template")


class TripCloneRequest(BaseModel):
    """Schema for cloning an existing trip with configurable options."""
    new_name: str = Field(..., min_length=1, max_length=100, description="Name for the cloned trip")
    start_date: date = Field(..., description="Start date for the cloned trip")
    clone_participants: bool = Field(True, description="Clone participants from the original trip")
    clone_meal_slots: bool = Field(True, description="Clone meal slot configuration from the original trip")
    clone_meal_assignments: bool = Field(True, description="Clone meal assignments from the original trip")
    participant_overrides: Optional[List[TripParticipantCreate]] = Field(
        None, 
        max_items=20,
        description="Override participants (if provided, replaces cloned participants)"
    )
    notes: Optional[str] = Field(None, max_length=2000, description="Notes for the cloned trip")

    @validator('new_name')
    def validate_name(cls, v):
        """Ensure trip name is not empty."""
        if not v.strip():
            raise ValueError("Trip name cannot be empty")
        return v.strip()

    @validator('start_date')
    def validate_start_date(cls, v):
        """Ensure start date is not in the past."""
        if v < date.today():
            raise ValueError("Start date cannot be in the past")
        return v

    @validator('participant_overrides')
    def validate_participant_overrides(cls, v):
        """Validate participant overrides if provided."""
        if v is not None and len(v) > 0:
            # Check for duplicate names
            names = [p.name for p in v if p.name]
            if len(names) != len(set(names)):
                raise ValueError("Participant names must be unique")
            
            # Check for duplicate numbers
            numbers = [p.number for p in v if p.number is not None]
            if len(numbers) != len(set(numbers)):
                raise ValueError("Participant numbers must be unique")
        
        return v


class TripStatsResponse(BaseModel):
    """Schema for trip statistics response."""
    total_trips: int
    active_trips: int
    archived_trips: int
    total_trip_days: int
    average_trip_duration: Optional[float]
    average_participants: Optional[float]
    most_common_meal_slots: List[Dict[str, Any]]
    trips_with_stoves: int
    snapshot_mode_trips: int
    track_changes_mode_trips: int


class ParticipantInfo(BaseModel):
    """Schema for participant info in coefficient calculations."""
    id: UUID
    name: str
    coefficient: float
    effective_portion: float


class MealParticipantSummaryResponse(BaseModel):
    """Schema for meal participant summary response."""
    day_id: UUID
    day_number: int
    date: date
    meal_slot: str
    participant_count: int
    effective_count: Decimal
    participants: List[ParticipantInfo]


class DailyParticipantSummaryResponse(BaseModel):
    """Schema for daily participant summary response."""
    day_id: UUID
    day_number: int
    date: date
    total_participants: int
    meal_summaries: Dict[str, MealParticipantSummaryResponse]
    average_effective_count: Decimal


class TripCoefficientSummaryResponse(BaseModel):
    """Schema for trip coefficient summary response."""
    trip_id: UUID
    total_participants: int
    daily_summaries: List[DailyParticipantSummaryResponse]
    meal_slot_totals: Dict[str, Decimal]
    total_effective_days: Decimal