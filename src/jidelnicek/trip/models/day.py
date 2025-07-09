"""
Trip day model.

This module defines the TripDay model for managing individual days in a trip.
"""

from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Date, Text
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .trip import Trip
    from .meal import TripMeal
    from .meal_slot import TripMealSlot


class TripDay(Base):
    """
    Trip day model.
    
    Represents a single day in a trip with its meals and activities.
    """
    __tablename__ = "trip_days"
    
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
    
    # Day details
    day_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
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
        back_populates="days",
        lazy="select"
    )
    
    meals: Mapped[List["TripMeal"]] = relationship(
        "TripMeal",
        back_populates="day",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True,
        order_by="TripMeal.meal_slot"
    )
    
    meal_slots: Mapped[List["TripMealSlot"]] = relationship(
        "TripMealSlot",
        back_populates="day",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True,
        order_by="TripMealSlot.display_order"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('day_number >= 1', name='day_number_positive_check'),
        UniqueConstraint('trip_id', 'day_number', name='unique_day_number_per_trip'),
        UniqueConstraint('trip_id', 'date', name='unique_date_per_trip'),
    )
    
    @validates('day_number')
    def validate_day_number(self, key, day_number):
        """Validate day number is positive."""
        if day_number < 1:
            raise ValueError("Day number must be at least 1")
        return day_number
    
    @property
    def total_meals(self) -> int:
        """Get total number of meals planned for this day."""
        return len(self.meals) if self.meals else 0
    
    @property
    def has_all_meals(self) -> bool:
        """Check if all meal slots are filled for this day."""
        if not self.trip or not self.meals:
            return False
        return len(self.meals) >= len(self.trip.meal_slots)
    
    def calculate_total_calories(self) -> Decimal:
        """Calculate total calories for all meals on this day."""
        if not self.meals:
            return Decimal("0.00")
        # TODO: Implement when meal nutrition data is available
        return Decimal("0.00")
    
    def calculate_total_weight(self) -> Decimal:
        """Calculate total weight of all meals on this day."""
        if not self.meals:
            return Decimal("0.00")
        # TODO: Implement when meal weight data is available
        return Decimal("0.00")
    
    def calculate_water_requirement(self) -> int:
        """Calculate total water requirement for cooking on this day (in ml)."""
        if not self.meals:
            return 0
        # TODO: Implement when meal water data is available
        return 0
    
    def __repr__(self):
        return f"<TripDay(id={self.id}, trip_id={self.trip_id}, day_number={self.day_number}, date={self.date})>"