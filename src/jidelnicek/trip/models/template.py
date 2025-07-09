"""
Trip template model for Jidelnicek 2.0.

This module defines the TripTemplate model for saving and reusing
trip configurations across multiple trips.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, String, Integer, ForeignKey, 
    CheckConstraint, Index, Text, JSON, text
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

# Import for forward reference
if TYPE_CHECKING:
    from jidelnicek.auth.models import AuthUser


class TripTemplate(Base):
    """
    Trip template for saving and reusing trip configurations.
    
    Stores reusable trip structures including:
    - Participant configurations
    - Meal slot definitions
    - Day/meal assignments
    - Default settings
    
    Templates can be:
    - Private (user-specific)
    - Public (available to all users)
    - Categorized and tagged for organization
    """
    __tablename__ = "trip_templates"
    
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
    
    # Template details
    name: Mapped[str] = mapped_column(
        String(200), 
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, 
        nullable=True
    )
    
    # Trip configuration
    duration_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of days in the trip template"
    )
    
    meal_slots: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
        server_default=text('\'["Breakfast", "Lunch", "Dinner"]\'::jsonb'),
        comment="Array of meal slot names for the trip"
    )
    
    participants: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        server_default=text('\'[]\'::jsonb'),
        comment="Array of participant templates with name and coefficient"
    )
    
    meal_assignments: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        server_default=text('\'{}\'::jsonb'),
        comment="Object mapping days and meal slots to recipe/meal configurations"
    )
    
    # Visibility and categorization
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text('false'),
        index=True,
        comment="Whether this template is available to all users"
    )
    
    category: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Template category (e.g., Family, Sports, School)"
    )
    
    tags: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
        server_default=text('\'[]\'::jsonb'),
        comment="Array of tags for template organization"
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
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        back_populates="trip_templates",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('duration_days > 0', name='template_duration_check'),
        CheckConstraint('LENGTH(name) > 0', name='template_name_not_empty'),
        CheckConstraint(
            'jsonb_array_length(meal_slots) > 0', 
            name='template_meal_slots_not_empty'
        ),
        Index('idx_templates_user', 'user_id'),
        Index('idx_templates_public', 'is_public', 'category', postgresql_where=text('is_public')),
        Index('idx_templates_category', 'category', postgresql_where=text('category IS NOT NULL')),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate template name is not empty."""
        if not name or not name.strip():
            raise ValueError("Template name cannot be empty")
        if len(name.strip()) > 200:
            raise ValueError("Template name cannot exceed 200 characters")
        return name.strip()
    
    @validates('duration_days')
    def validate_duration(self, key, duration):
        """Validate duration is positive."""
        if duration <= 0:
            raise ValueError("Duration must be at least 1 day")
        if duration > 365:
            raise ValueError("Duration cannot exceed 365 days")
        return duration
    
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
    
    @validates('participants')
    def validate_participants(self, key, participants):
        """Validate participants configuration."""
        if not isinstance(participants, list):
            raise ValueError("Participants must be a list")
        
        # Validate each participant entry
        for idx, participant in enumerate(participants):
            if not isinstance(participant, dict):
                raise ValueError(f"Participant {idx} must be a dictionary")
            
            if 'name' not in participant or not participant['name']:
                raise ValueError(f"Participant {idx} must have a name")
            
            if 'coefficient' not in participant:
                raise ValueError(f"Participant {idx} must have a coefficient")
            
            # Validate coefficient is a valid number
            try:
                coeff = float(participant['coefficient'])
                if coeff <= 0 or coeff > 2:
                    raise ValueError(f"Participant {idx} coefficient must be between 0 and 2")
            except (TypeError, ValueError):
                raise ValueError(f"Participant {idx} coefficient must be a valid number")
        
        return participants
    
    @validates('category')
    def validate_category(self, key, category):
        """Validate category if provided."""
        if category:
            category = category.strip()
            if len(category) > 50:
                raise ValueError("Category cannot exceed 50 characters")
            return category
        return None
    
    @validates('tags')
    def validate_tags(self, key, tags):
        """Validate tags list."""
        if not isinstance(tags, list):
            raise ValueError("Tags must be a list")
        
        # Clean and validate each tag
        clean_tags = []
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                tag_clean = tag.strip().lower()
                if len(tag_clean) <= 30:  # Reasonable tag length
                    clean_tags.append(tag_clean)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in clean_tags:
            if tag not in seen:
                seen.add(tag)
                unique_tags.append(tag)
        
        return unique_tags
    
    def to_dict(self) -> dict:
        """Convert template to dictionary format."""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "description": self.description,
            "duration_days": self.duration_days,
            "meal_slots": self.meal_slots,
            "participants": self.participants,
            "meal_assignments": self.meal_assignments,
            "is_public": self.is_public,
            "category": self.category,
            "tags": self.tags,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    def create_trip_data(self) -> dict:
        """Create trip initialization data from template."""
        return {
            "duration_days": self.duration_days,
            "meal_slots": self.meal_slots.copy(),
            "participants": [p.copy() for p in self.participants],
            "meal_assignments": self.meal_assignments.copy() if self.meal_assignments else {}
        }
    
    def __repr__(self):
        return f"<TripTemplate(id={self.id}, name={self.name}, user_id={self.user_id}, public={self.is_public})>"