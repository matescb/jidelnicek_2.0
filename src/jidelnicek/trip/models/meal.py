"""
Trip meal model.

This module defines the TripMeal model for managing meals in trip days.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Text
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .day import TripDay
    from jidelnicek.recipe.models.recipe import Recipe
    from .meal_slot import TripMealSlot


class TripMeal(Base):
    """
    Trip meal model.
    
    Represents a meal assignment for a specific meal slot on a trip day.
    """
    __tablename__ = "trip_meals"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    day_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_days.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    recipe_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Meal details
    meal_slot: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    
    servings_override: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Override recipe servings for this meal"
    )
    
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Recipe snapshot (for track_changes mode)
    recipe_snapshot: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        comment="Snapshot of recipe data at time of assignment"
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
    day: Mapped["TripDay"] = relationship(
        "TripDay",
        back_populates="meals",
        lazy="select"
    )
    
    recipe: Mapped["Recipe"] = relationship(
        "Recipe",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('servings_override IS NULL OR servings_override > 0', 
                       name='servings_override_positive_check'),
        UniqueConstraint('day_id', 'meal_slot', name='unique_meal_slot_per_day'),
    )
    
    @validates('meal_slot')
    def validate_meal_slot(self, key, meal_slot):
        """Validate meal slot is not empty."""
        if not meal_slot or not meal_slot.strip():
            raise ValueError("Meal slot cannot be empty")
        return meal_slot.strip()
    
    @validates('servings_override')
    def validate_servings_override(self, key, servings_override):
        """Validate servings override is positive if provided."""
        if servings_override is not None and servings_override <= 0:
            raise ValueError("Servings override must be positive")
        return servings_override
    
    @property
    def effective_servings(self) -> int:
        """Get effective servings (override or recipe default)."""
        if self.servings_override is not None:
            return self.servings_override
        return self.recipe.servings if self.recipe else 0
    
    def __repr__(self):
        return f"<TripMeal(id={self.id}, day_id={self.day_id}, meal_slot={self.meal_slot}, recipe_id={self.recipe_id})>"