"""
Trip meal slot model.

This module defines the TripMealSlot model for managing flexible meal configurations.
Each trip can have different meal patterns per day (e.g., no breakfast on day 1).
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Column, DateTime, String, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Boolean, Integer
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .trip import Trip
    from .day import TripDay
    from .meal import TripMeal


class TripMealSlot(Base):
    """
    Trip meal slot model.
    
    Represents a meal slot configuration for a specific day in a trip.
    Allows flexible meal patterns - each day can have different meal types enabled.
    """
    __tablename__ = "trip_meal_slots"
    
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
    
    day_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_days.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Meal slot details
    day_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    
    meal_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true")
    )
    
    # Optional customization
    custom_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    
    # Order for display (e.g., Breakfast=1, Lunch=2, Dinner=3)
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0")
    )
    
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
        back_populates="meal_slot_configs",
        lazy="select"
    )
    
    day: Mapped["TripDay"] = relationship(
        "TripDay",
        back_populates="meal_slots",
        lazy="select"
    )
    
    meals: Mapped[list["TripMeal"]] = relationship(
        "TripMeal",
        back_populates="meal_slot",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('day_number >= 1', name='meal_slot_day_number_check'),
        CheckConstraint('display_order >= 0', name='meal_slot_display_order_check'),
        UniqueConstraint('trip_id', 'day_number', 'meal_type', 
                        name='unique_trip_day_meal_type'),
    )
    
    @validates('meal_type')
    def validate_meal_type(self, key, meal_type):
        """Validate meal type is not empty."""
        if not meal_type or not meal_type.strip():
            raise ValueError("Meal type cannot be empty")
        return meal_type.strip()
    
    @validates('custom_name')
    def validate_custom_name(self, key, custom_name):
        """Validate custom name if provided."""
        if custom_name and len(custom_name.strip()) == 0:
            return None
        return custom_name.strip() if custom_name else None
    
    @property
    def display_name(self) -> str:
        """Get display name for the meal slot."""
        return self.custom_name or self.meal_type
    
    @property
    def is_standard_meal(self) -> bool:
        """Check if this is a standard meal type."""
        standard_meals = {'breakfast', 'lunch', 'dinner'}
        return self.meal_type.lower() in standard_meals
    
    def __repr__(self):
        return f"<TripMealSlot(id={self.id}, trip_id={self.trip_id}, day={self.day_number}, meal={self.meal_type}, active={self.is_active})>"