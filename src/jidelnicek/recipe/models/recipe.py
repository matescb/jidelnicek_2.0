"""
Recipe model for Jidelnicek 2.0.

This module defines the main Recipe model with comprehensive features
for meal planning, publishing, and forking support.
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Index, Text, Numeric, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates
from sqlalchemy.ext.hybrid import hybrid_property

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

# Import for forward reference
if TYPE_CHECKING:
    from .recipe_image import RecipeImage
    from .categorization import RecipeCategory, RecipeTag
    from .ingredient import RecipeIngredient
    from .recipe_version import RecipeVersion


class Recipe(Base):
    """
    Recipe model with comprehensive features for meal planning.
    
    Supports:
    - Recipe creation and editing
    - Publishing to community library
    - Forking from public recipes
    - Ingredient management
    - Nutritional calculations
    - Water tracking for camping
    - Serving size adjustments
    - Soft delete with archival
    """
    __tablename__ = "recipe_recipes"
    
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
    # Note: created_by is an alias for user_id (for task compatibility)
    
    # Recipe details
    name: Mapped[str] = mapped_column(
        String(100), 
        nullable=False,
        index=True
    )
    # Note: title is an alias for name (for task compatibility)
    description: Mapped[Optional[str]] = mapped_column(Text)
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    
    # Task 3.1 additional fields
    difficulty_level: Mapped[Optional[str]] = mapped_column(
        String(20),
        comment="Recipe difficulty: easy, medium, hard"
    )
    view_count: Mapped[int] = mapped_column(
        Integer,
        server_default='0',
        nullable=False,
        comment="Number of times recipe has been viewed"
    )
    rating_average: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2),
        comment="Average rating from 0.00 to 5.00"
    )
    rating_count: Mapped[int] = mapped_column(
        Integer,
        server_default='0',
        nullable=False,
        comment="Number of ratings received"
    )
    
    # Time requirements
    prep_time_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    cook_time_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Additional requirements
    water_ml: Mapped[int] = mapped_column(
        Integer, 
        server_default='0',
        nullable=False
    )
    servings: Mapped[int] = mapped_column(
        Integer, 
        server_default='1',
        nullable=False
    )
    
    # Publishing features
    is_public: Mapped[bool] = mapped_column(
        Boolean, 
        server_default=text('false'),
        nullable=False
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, 
        server_default=text('false'),
        nullable=False,
        index=True
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Forking features
    fork_count: Mapped[int] = mapped_column(
        Integer, 
        server_default='0',
        nullable=False
    )
    original_recipe_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id"),
        index=True
    )
    
    # Soft delete
    is_archived: Mapped[bool] = mapped_column(
        Boolean, 
        server_default=text('false'),
        nullable=False,
        index=True
    )
    
    # Version tracking
    current_version: Mapped[int] = mapped_column(
        Integer,
        server_default='1',
        nullable=False,
        comment="Current version number of the recipe"
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
    ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeIngredient.display_order",
        lazy="select",
        passive_deletes=True
    )
    
    images: Mapped[List["RecipeImage"]] = relationship(
        "RecipeImage",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeImage.display_order",
        lazy="select",
        passive_deletes=True
    )
    
    original_recipe: Mapped[Optional["Recipe"]] = relationship(
        "Recipe",
        remote_side=[id],
        back_populates="forks",
        lazy="select"
    )
    
    # Forks of this recipe
    forks: Mapped[List["Recipe"]] = relationship(
        "Recipe",
        foreign_keys=[original_recipe_id],
        back_populates="original_recipe",
        lazy="select"
    )
    
    # Categorization relationships
    recipe_categories: Mapped[List["RecipeCategory"]] = relationship(
        "RecipeCategory",
        back_populates="recipe",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True
    )
    
    recipe_tags: Mapped[List["RecipeTag"]] = relationship(
        "RecipeTag",
        back_populates="recipe",
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True
    )
    
    # Version tracking
    versions: Mapped[List["RecipeVersion"]] = relationship(
        "RecipeVersion",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeVersion.version_number.desc()",
        lazy="select",
        passive_deletes=True
    )
    
    # Forward declaration for relationships that will be defined in other modules
    # reviews: Mapped[List["Review"]] = relationship() - defined in sharing module
    # fork_records: Mapped[List["Fork"]] = relationship() - defined in sharing module
    # trip_snapshots: Mapped[List["TripRecipeSnapshot"]] = relationship() - defined in trip module
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('LENGTH(instructions) <= 2000', name='recipe_recipes_instructions_check'),
        CheckConstraint('NOT is_published OR fork_count <= 5 OR fork_count IS NULL', name='unpublish_protection'),
        CheckConstraint('servings > 0', name='recipe_servings_positive'),
        CheckConstraint('water_ml >= 0', name='recipe_water_non_negative'),
        CheckConstraint('current_version > 0', name='recipe_current_version_positive'),
        Index('idx_recipes_user', 'user_id', postgresql_where=text('NOT is_archived')),
        Index('idx_recipes_public', 'is_published', postgresql_where=text('is_published AND NOT is_archived')),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate recipe name is not empty."""
        if not name or not name.strip():
            raise ValueError("Recipe name cannot be empty")
        return name.strip()
    
    @validates('servings')
    def validate_servings(self, key, servings):
        """Validate servings is positive."""
        if servings <= 0:
            raise ValueError("Servings must be greater than 0")
        return servings
    
    @validates('current_version')
    def validate_current_version(self, key, current_version):
        """Validate current_version is positive."""
        if current_version <= 0:
            raise ValueError("Current version must be greater than 0")
        return current_version
    
    @hybrid_property
    def total_time_minutes(self) -> Optional[int]:
        """Calculate total time for recipe preparation."""
        if self.prep_time_minutes is None and self.cook_time_minutes is None:
            return None
        return (self.prep_time_minutes or 0) + (self.cook_time_minutes or 0)
    
    # Note: total_time is an alias for total_time_minutes (for task compatibility)
    
    @hybrid_property
    def is_forked(self) -> bool:
        """Check if this recipe was forked from another."""
        return self.original_recipe_id is not None
    
    @hybrid_property
    def can_be_unpublished(self) -> bool:
        """Check if recipe can be unpublished (fork_count <= 5)."""
        return self.fork_count <= 5
    
    def format_display(self) -> dict:
        """Format recipe for display with calculated fields."""
        return {
            "id": str(self.id),
            "title": self.name,
            "description": self.description,
            "difficulty_level": self.difficulty_level,
            "prep_time": self.prep_time_minutes,
            "cook_time": self.cook_time_minutes,
            "total_time": self.total_time_minutes,
            "servings": self.servings,
            "rating": {
                "average": float(self.rating_average) if self.rating_average else None,
                "count": self.rating_count
            },
            "is_public": self.is_public,
            "is_published": self.is_published,
            "view_count": self.view_count
        }
    
    def calculate_totals(self) -> dict:
        """Calculate recipe totals including time and nutrition."""
        return {
            "total_time_minutes": self.total_time_minutes,
            "ingredient_count": len(self.ingredients),
            "is_complete": bool(self.name and self.instructions and self.ingredients),
            "can_publish": self.is_public and not self.is_published,
            "can_unpublish": self.is_published and self.can_be_unpublished
        }
    
    def __repr__(self):
        return f"<Recipe(id={self.id}, name={self.name}, user_id={self.user_id})>"