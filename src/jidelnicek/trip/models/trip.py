"""
Trip model for Jidelnicek 2.0.

This module defines the main Trip model with comprehensive features
for multi-day expedition planning with meal organization.
"""

from datetime import datetime, date, timezone
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Index, Text, Date, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates
from sqlalchemy.ext.hybrid import hybrid_property

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

# Import for forward reference
if TYPE_CHECKING:
    from jidelnicek.auth.models import AuthUser
    from .participant import TripParticipant
    from .day import TripDay
    from .stove import TripStove
    from .template import TripTemplate
    from .meal_slot import TripMealSlot
    from .invitation import TripInvitation


class Trip(Base):
    """
    Trip model for planning multi-day expeditions.
    
    Supports:
    - Multi-day trip planning with flexible date ranges
    - Up to 20 participants with individual coefficients
    - Customizable meal slots (default: Breakfast, Lunch, Dinner)
    - Recipe storage as snapshots or live tracking
    - Fuel and water requirement calculations
    - Export functionality for shopping and packing lists
    - Template creation for reusable trip structures
    - Soft delete with archival
    """
    __tablename__ = "trip_trips"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Trip details
    name: Mapped[str] = mapped_column(
        String(100), 
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Trip description and notes"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'planned'"),
        comment="Trip status: planned, active, completed, cancelled"
    )
    start_date: Mapped[date] = mapped_column(
        Date, 
        nullable=False
    )
    end_date: Mapped[date] = mapped_column(
        Date, 
        nullable=False
    )
    
    # Configuration
    meal_slots: Mapped[Optional[List[str]]] = mapped_column(
        JSON,
        server_default=text('\'["Breakfast", "Lunch", "Dinner"]\''),
        comment="Customizable meal slot names for the trip"
    )
    
    # Sharing
    share_token: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        index=True,
        comment="Token for sharing trip with others"
    )
    share_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        comment="When the share link expires"
    )
    
    # Trip metadata
    is_archived: Mapped[bool] = mapped_column(
        Boolean, 
        server_default=text('false'),
        nullable=False,
        index=True
    )
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
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        back_populates="trips",
        lazy="select"
    )
    
    participants: Mapped[List["TripParticipant"]] = relationship(
        "TripParticipant",
        back_populates="trip",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True,
        order_by="TripParticipant.id"
    )
    
    days: Mapped[List["TripDay"]] = relationship(
        "TripDay",
        back_populates="trip",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True,
        order_by="TripDay.day_number"
    )
    
    stove: Mapped[Optional["TripStove"]] = relationship(
        "TripStove",
        back_populates="trip",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="select",
        passive_deletes=True
    )
    
    meal_slot_configs: Mapped[List["TripMealSlot"]] = relationship(
        "TripMealSlot",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripMealSlot.day_number, TripMealSlot.display_order",
        lazy="select",
        passive_deletes=True
    )
    
    # Forward declaration for relationships defined in other modules
    # share_links: Mapped[List["ShareLink"]] = relationship() - defined in sharing module
    invitations: Mapped[List["TripInvitation"]] = relationship(
        "TripInvitation",
        back_populates="trip",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('end_date >= start_date', name='trip_dates_check'),
        CheckConstraint('LENGTH(name) > 0', name='trip_name_not_empty'),
        CheckConstraint("status IN ('planned', 'active', 'completed', 'cancelled')", name='trip_status_check'),
        Index('idx_trips_user', 'user_id', postgresql_where=text('NOT is_archived')),
        Index('idx_trips_dates', 'start_date', 'end_date', postgresql_where=text('NOT is_archived')),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate trip name is not empty."""
        if not name or not name.strip():
            raise ValueError("Trip name cannot be empty")
        return name.strip()
    
    @validates('description')
    def validate_description(self, key, description):
        """Validate trip description."""
        if description is not None:
            description = description.strip()
            if len(description) > 2000:
                raise ValueError("Trip description cannot exceed 2000 characters")
            return description if description else None
        return None
    
    @validates('status')
    def validate_status(self, key, status):
        """Validate trip status."""
        valid_statuses = {'planned', 'active', 'completed', 'cancelled'}
        if status not in valid_statuses:
            raise ValueError(f"Trip status must be one of: {', '.join(valid_statuses)}")
        return status
    
    @validates('start_date', 'end_date')
    def validate_dates(self, key, value):
        """Validate trip dates."""
        if key == 'end_date' and hasattr(self, 'start_date') and self.start_date:
            if value < self.start_date:
                raise ValueError("End date must be after or equal to start date")
        return value
    
    @validates('meal_slots')
    def validate_meal_slots(self, key, meal_slots):
        """Validate meal slots configuration."""
        if not meal_slots or not isinstance(meal_slots, list) or len(meal_slots) == 0:
            raise ValueError("At least one meal slot is required")
        
        # Ensure all slots are non-empty strings
        for slot in meal_slots:
            if not isinstance(slot, str) or not slot.strip():
                raise ValueError("Meal slot names must be non-empty strings")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_slots = []
        for slot in meal_slots:
            slot_cleaned = slot.strip()
            if slot_cleaned.lower() not in seen:
                seen.add(slot_cleaned.lower())
                unique_slots.append(slot_cleaned)
        
        return unique_slots
    
    @property
    def owner_id(self) -> UUID:
        """Get the owner ID (alias for user_id for compatibility)."""
        return self.user_id
    
    @hybrid_property
    def duration_days(self) -> int:
        """Calculate trip duration in days."""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0
    
    @hybrid_property
    def participant_count(self) -> int:
        """Get the number of participants."""
        return len(self.participants) if self.participants else 0
    
    @hybrid_property
    def total_coefficient(self) -> Decimal:
        """Calculate total coefficient sum for all participants."""
        if not self.participants:
            return Decimal('0.00')
        return sum(p.coefficient for p in self.participants)
    
    @hybrid_property
    def is_shareable(self) -> bool:
        """Check if trip has an active share link."""
        if not self.share_token or not self.share_expires_at:
            return False
        return datetime.now(timezone.utc) < self.share_expires_at
    
    @hybrid_property
    def can_add_participants(self) -> bool:
        """Check if more participants can be added (max 20)."""
        return self.participant_count < 20
    
    def get_day_by_number(self, day_number: int) -> Optional["TripDay"]:
        """Get a specific day by its number."""
        # TODO: Enable when days relationship is available
        # if self.days:
        #     for day in self.days:
        #         if day.day_number == day_number:
        #             return day
        return None
    
    def get_day_by_date(self, target_date: date) -> Optional["TripDay"]:
        """Get a specific day by its date."""
        # TODO: Enable when days relationship is available
        # if self.days:
        #     for day in self.days:
        #         if day.date == target_date:
        #             return day
        return None
    
    def calculate_total_calories_target(self) -> Decimal:
        """Calculate total calorie target for the entire trip."""
        # TODO: Enable when days relationship is available
        # total = Decimal('0.00')
        # if self.days:
        #     for day in self.days:
        #         total += day.calculate_daily_calories_target()
        # return total
        return Decimal('0.00')
    
    def calculate_total_water_requirement(self) -> int:
        """Calculate total water requirement for cooking (in ml)."""
        # TODO: Enable when days relationship is available
        # total = 0
        # if self.days:
        #     for day in self.days:
        #         total += day.calculate_water_requirement()
        # return total
        return 0
    
    def format_display(self) -> dict:
        """Format trip for display with calculated fields."""
        return {
            "id": str(self.id),
            "name": self.name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "duration_days": self.duration_days,
            "participant_count": self.participant_count,
            "meal_slots": self.meal_slots,
            "is_shareable": self.is_shareable,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    def to_template_data(self) -> dict:
        """Convert trip to template data format."""
        return {
            "meal_slots": self.meal_slots,
            # TODO: Enable when days relationship is available
            # "days": [day.to_template_data() for day in self.days] if self.days else [],
            "days": [],
            "participant_count": self.participant_count,
            "duration_days": self.duration_days
        }
    
    def __repr__(self):
        return f"<Trip(id={self.id}, name={self.name}, user_id={self.user_id}, duration={self.duration_days} days)>"