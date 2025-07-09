"""
Trip participant model.

This module defines the TripParticipant model for managing trip participants.
"""

from datetime import datetime, date
from typing import Optional, TYPE_CHECKING, Dict
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Numeric, Date, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .trip import Trip


class TripParticipant(Base):
    """
    Trip participant model.
    
    Represents a participant in a trip with their portion coefficient.
    """
    __tablename__ = "trip_participants"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    trip_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Participant details
    name: Mapped[Optional[str]] = mapped_column(String(100))
    number: Mapped[Optional[int]] = mapped_column(Integer)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Default meal coefficient (as percentage, 100 = 1.0)
    coefficient: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default=text("100.00")
    )
    
    # Meal-specific coefficients stored as JSON
    # Format: {"breakfast": 80, "lunch": 100, "dinner": 120}
    meal_coefficients: Mapped[Optional[Dict]] = mapped_column(
        JSON,
        nullable=True
    )
    
    # Partial attendance dates
    arrival_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    departure_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        onupdate=get_utc_now,
        nullable=False
    )
    
    # Relationships
    trip: Mapped["Trip"] = relationship(
        "Trip",
        back_populates="participants",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('(name IS NOT NULL AND number IS NULL) OR (name IS NULL AND number IS NOT NULL)', 
                       name='participant_name_or_number_check'),
        CheckConstraint('coefficient >= 0.01 AND coefficient <= 999.99', 
                       name='participant_coefficient_check'),
        UniqueConstraint('trip_id', 'name', name='unique_participant_name_per_trip'),
        UniqueConstraint('trip_id', 'number', name='unique_participant_number_per_trip'),
    )
    
    @validates('name', 'number')
    def validate_name_or_number(self, key, value):
        """Validate that either name or number is provided, but not both."""
        if key == 'name' and value is not None:
            if hasattr(self, 'number') and self.number is not None:
                raise ValueError("Provide either name or number, not both")
        elif key == 'number' and value is not None:
            if hasattr(self, 'name') and self.name is not None:
                raise ValueError("Provide either name or number, not both")
        
        # Check that at least one is provided
        if key == 'name' and value is None:
            if not hasattr(self, 'number') or self.number is None:
                raise ValueError("Either name or number must be provided")
        elif key == 'number' and value is None:
            if not hasattr(self, 'name') or self.name is None:
                raise ValueError("Either name or number must be provided")
                
        return value
    
    @validates('coefficient')
    def validate_coefficient(self, key, coefficient):
        """Validate coefficient is within allowed range."""
        if coefficient < Decimal('0.01') or coefficient > Decimal('999.99'):
            raise ValueError("Coefficient must be between 0.01 and 999.99")
        return coefficient
    
    @validates('email')
    def validate_email(self, key, email):
        """Validate email format."""
        if email is not None and '@' not in email:
            raise ValueError("Invalid email format")
        return email
    
    @validates('meal_coefficients')
    def validate_meal_coefficients(self, key, meal_coefficients):
        """Validate meal coefficients structure and values."""
        if meal_coefficients is None:
            return meal_coefficients
            
        valid_meal_types = {'breakfast', 'lunch', 'dinner', 'snack'}
        
        for meal_type, coefficient in meal_coefficients.items():
            if meal_type not in valid_meal_types:
                raise ValueError(f"Invalid meal type: {meal_type}")
            
            try:
                coef_decimal = Decimal(str(coefficient))
                if coef_decimal < Decimal('0.01') or coef_decimal > Decimal('999.99'):
                    raise ValueError(f"Meal coefficient for {meal_type} must be between 0.01 and 999.99")
            except (ValueError, TypeError):
                raise ValueError(f"Invalid coefficient value for {meal_type}: {coefficient}")
                
        return meal_coefficients
    
    @validates('arrival_date', 'departure_date')
    def validate_attendance_dates(self, key, value):
        """Validate arrival and departure dates logic."""
        if value is None:
            return value
            
        # If both dates are set, ensure arrival is before departure
        if key == 'arrival_date' and hasattr(self, 'departure_date') and self.departure_date:
            if value > self.departure_date:
                raise ValueError("Arrival date must be before departure date")
        elif key == 'departure_date' and hasattr(self, 'arrival_date') and self.arrival_date:
            if value < self.arrival_date:
                raise ValueError("Departure date must be after arrival date")
                
        return value
    
    @property
    def display_name(self) -> str:
        """Get display name for the participant."""
        if self.name:
            return self.name
        return f"Participant {self.number}"
    
    def is_present_on_date(self, check_date: date) -> bool:
        """
        Check if participant is present on a specific date.
        
        Args:
            check_date: The date to check
            
        Returns:
            True if participant is present on the date, False otherwise
        """
        # If no arrival/departure dates specified, participant is present for whole trip
        if not self.arrival_date and not self.departure_date:
            return True
            
        # Check arrival constraint
        if self.arrival_date and check_date < self.arrival_date:
            return False
            
        # Check departure constraint  
        if self.departure_date and check_date > self.departure_date:
            return False
            
        return True
    
    def get_meal_coefficient(self, meal_type: str) -> Decimal:
        """
        Get the effective coefficient for a specific meal type.
        
        Args:
            meal_type: Type of meal (breakfast, lunch, dinner, snack)
            
        Returns:
            The coefficient for the meal as a Decimal
        """
        # Check if meal-specific coefficients are defined
        if self.meal_coefficients and meal_type in self.meal_coefficients:
            return Decimal(str(self.meal_coefficients[meal_type]))
        
        # Return default coefficient
        return self.coefficient
    
    def get_effective_coefficient(self, meal_type: str, meal_date: date) -> Decimal:
        """
        Get the effective coefficient for a meal on a specific date.
        
        Args:
            meal_type: Type of meal (breakfast, lunch, dinner, snack)
            meal_date: Date of the meal
            
        Returns:
            The coefficient if present on date, 0 if not present
        """
        if not self.is_present_on_date(meal_date):
            return Decimal('0')
            
        return self.get_meal_coefficient(meal_type)
    
    def __repr__(self):
        return f"<TripParticipant(id={self.id}, trip_id={self.trip_id}, display_name={self.display_name}, coefficient={self.coefficient})>"