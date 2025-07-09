"""
Trip meal coefficient model.

This module defines the TripMealCoefficient model for managing meal-specific
participant coefficients. This allows participants to have different portions
for different meal types (e.g., larger dinner portions, smaller breakfast).

Note: This is a future enhancement. Currently, the system uses the base
coefficient from TripParticipant for all meals.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, String, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Numeric
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .participant import TripParticipant
    from .trip import Trip


class TripMealCoefficient(Base):
    """
    Trip meal coefficient model.
    
    Represents a meal-specific coefficient override for a participant.
    If not specified, the system uses the base coefficient from TripParticipant.
    """
    __tablename__ = "trip_meal_coefficients"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    participant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    trip_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Coefficient details
    meal_slot: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    
    coefficient: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default=text("100.00")
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
    participant: Mapped["TripParticipant"] = relationship(
        "TripParticipant",
        back_populates="meal_coefficients",
        lazy="select"
    )
    
    trip: Mapped["Trip"] = relationship(
        "Trip",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('coefficient >= 10 AND coefficient <= 300', 
                       name='meal_coefficient_check'),
        UniqueConstraint('participant_id', 'meal_slot', 
                        name='unique_participant_meal_coefficient'),
    )
    
    @validates('meal_slot')
    def validate_meal_slot(self, key, meal_slot):
        """Validate meal slot is not empty."""
        if not meal_slot or not meal_slot.strip():
            raise ValueError("Meal slot cannot be empty")
        return meal_slot.strip()
    
    @validates('coefficient')
    def validate_coefficient(self, key, coefficient):
        """Validate coefficient is within allowed range."""
        if coefficient < Decimal('10') or coefficient > Decimal('300'):
            raise ValueError("Coefficient must be between 10 and 300")
        return coefficient
    
    def __repr__(self):
        return f"<TripMealCoefficient(id={self.id}, participant_id={self.participant_id}, meal_slot={self.meal_slot}, coefficient={self.coefficient})>"