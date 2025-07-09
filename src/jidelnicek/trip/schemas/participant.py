"""
Trip participant schemas.

This module defines Pydantic schemas for trip participant validation and serialization.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, Union
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class MealCoefficients(BaseModel):
    """Schema for meal-specific coefficients."""
    breakfast: Optional[Decimal] = Field(None, ge=Decimal('10'), le=Decimal('300'))
    lunch: Optional[Decimal] = Field(None, ge=Decimal('10'), le=Decimal('300'))
    dinner: Optional[Decimal] = Field(None, ge=Decimal('10'), le=Decimal('300'))
    snack: Optional[Decimal] = Field(None, ge=Decimal('10'), le=Decimal('300'))


class ParticipantBase(BaseModel):
    """Base schema for trip participants."""
    name: Optional[str] = Field(None, max_length=100)
    number: Optional[int] = Field(None, ge=1)
    email: Optional[str] = Field(None, max_length=255)
    coefficient: Decimal = Field(
        default=Decimal('100.00'),
        ge=Decimal('10'),
        le=Decimal('300'),
        description="Default meal coefficient as percentage (100 = 1.0)"
    )
    meal_coefficients: Optional[Dict[str, Decimal]] = Field(
        None,
        description="Meal-specific coefficients"
    )
    arrival_date: Optional[date] = Field(None, description="Date participant arrives")
    departure_date: Optional[date] = Field(None, description="Date participant departs")
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format."""
        if v is not None and '@' not in v:
            raise ValueError("Invalid email format")
        return v
    
    @field_validator('meal_coefficients')
    @classmethod
    def validate_meal_coefficients(cls, v: Optional[Dict[str, Decimal]]) -> Optional[Dict[str, Decimal]]:
        """Validate meal coefficients."""
        if v is None:
            return v
            
        valid_meal_types = {'breakfast', 'lunch', 'dinner', 'snack'}
        
        for meal_type, coefficient in v.items():
            if meal_type not in valid_meal_types:
                raise ValueError(f"Invalid meal type: {meal_type}")
            if coefficient < Decimal('10') or coefficient > Decimal('300'):
                raise ValueError(f"Meal coefficient for {meal_type} must be between 10 and 300")
                
        return v
    
    @model_validator(mode='after')
    def validate_name_or_number(self) -> 'ParticipantBase':
        """Validate that either name or number is provided, but not both."""
        if self.name is not None and self.number is not None:
            raise ValueError("Provide either name or number, not both")
        if self.name is None and self.number is None:
            raise ValueError("Either name or number must be provided")
        return self
    
    @model_validator(mode='after')
    def validate_attendance_dates(self) -> 'ParticipantBase':
        """Validate arrival and departure date logic."""
        if self.arrival_date and self.departure_date:
            if self.arrival_date > self.departure_date:
                raise ValueError("Arrival date must be before departure date")
        return self


class ParticipantCreate(ParticipantBase):
    """Schema for creating a trip participant."""
    pass


class ParticipantUpdate(BaseModel):
    """Schema for updating a trip participant."""
    name: Optional[str] = Field(None, max_length=100)
    number: Optional[int] = Field(None, ge=1)
    email: Optional[str] = Field(None, max_length=255)
    coefficient: Optional[Decimal] = Field(
        None,
        ge=Decimal('0.01'),
        le=Decimal('999.99')
    )
    meal_coefficients: Optional[Dict[str, Decimal]] = None
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format."""
        if v is not None and v != "" and '@' not in v:
            raise ValueError("Invalid email format")
        return v
    
    @field_validator('meal_coefficients')
    @classmethod
    def validate_meal_coefficients(cls, v: Optional[Dict[str, Decimal]]) -> Optional[Dict[str, Decimal]]:
        """Validate meal coefficients."""
        if v is None:
            return v
            
        valid_meal_types = {'breakfast', 'lunch', 'dinner', 'snack'}
        
        for meal_type, coefficient in v.items():
            if meal_type not in valid_meal_types:
                raise ValueError(f"Invalid meal type: {meal_type}")
            if coefficient < Decimal('10') or coefficient > Decimal('300'):
                raise ValueError(f"Meal coefficient for {meal_type} must be between 10 and 300")
                
        return v


class Participant(ParticipantBase):
    """Schema for trip participant with all fields."""
    id: UUID
    trip_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def display_name(self) -> str:
        """Get display name for the participant."""
        if self.name:
            return self.name
        return f"Participant {self.number}"
    
    def is_present_on_date(self, check_date: date) -> bool:
        """Check if participant is present on a specific date."""
        if not self.arrival_date and not self.departure_date:
            return True
        if self.arrival_date and check_date < self.arrival_date:
            return False
        if self.departure_date and check_date > self.departure_date:
            return False
        return True
    
    def get_meal_coefficient(self, meal_type: str) -> Decimal:
        """Get the effective coefficient for a specific meal type."""
        if self.meal_coefficients and meal_type in self.meal_coefficients:
            return self.meal_coefficients[meal_type]
        return self.coefficient
    
    def get_effective_coefficient(self, meal_type: str, meal_date: date) -> Decimal:
        """Get the effective coefficient for a meal on a specific date."""
        if not self.is_present_on_date(meal_date):
            return Decimal('0')
        return self.get_meal_coefficient(meal_type)


class ParticipantSummary(BaseModel):
    """Summary information about a participant."""
    id: UUID
    display_name: str
    coefficient: Decimal
    is_partial: bool = Field(description="True if participant has arrival/departure dates")
    email: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def from_participant(cls, participant: Participant) -> 'ParticipantSummary':
        """Create summary from full participant."""
        return cls(
            id=participant.id,
            display_name=participant.display_name,
            coefficient=participant.coefficient,
            is_partial=bool(participant.arrival_date or participant.departure_date),
            email=participant.email
        )


class DayParticipants(BaseModel):
    """Schema for participants present on a specific day."""
    day_number: int
    date: date
    total_participants: int
    total_coefficient: Decimal
    participants: list[Participant]