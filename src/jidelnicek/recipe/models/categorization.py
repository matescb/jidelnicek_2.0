"""
Category and Tag models for recipe organization.

This module defines models for categorizing and tagging recipes:
- Categories with hierarchical structure (parent-child relationships)
- Tags for flexible labeling (dietary, cuisine, etc.)
- Junction tables for many-to-many relationships
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, Column, DateTime, String, Integer, ForeignKey, 
    UniqueConstraint, text, Index, Text
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates
from sqlalchemy.ext.hybrid import hybrid_property

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from jidelnicek.recipe.models import Recipe


class Category(Base):
    """
    Category model with hierarchical structure for recipe organization.
    
    Features:
    - Tree structure with parent-child relationships
    - Slug for URL-friendly identifiers
    - Display order for UI organization
    - Icon support for visual representation
    """
    __tablename__ = "recipe_categories"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Category details
    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    
    slug: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True
    )
    
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Category description for tooltips/help"
    )
    
    icon: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="Icon name or emoji for UI display"
    )
    
    # Hierarchical structure
    parent_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_categories.id", ondelete="CASCADE"),
        index=True
    )
    
    # Display order
    display_order: Mapped[int] = mapped_column(
        Integer,
        server_default='0',
        nullable=False
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
    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        remote_side=[id],
        backref="children"
    )
    
    recipe_categories: Mapped[List["RecipeCategory"]] = relationship(
        "RecipeCategory",
        back_populates="category",
        cascade="all, delete-orphan"
    )
    
    # Table constraints
    __table_args__ = (
        Index('idx_categories_parent', 'parent_id'),
        Index('idx_categories_order', 'display_order'),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate category name is not empty."""
        if not name or not name.strip():
            raise ValueError("Category name cannot be empty")
        return name.strip()
    
    @validates('slug')
    def validate_slug(self, key, slug):
        """Validate slug format."""
        import re
        if not slug or not re.match(r'^[a-z0-9-]+$', slug):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return slug
    
    @hybrid_property
    def is_root(self) -> bool:
        """Check if this is a root category (no parent)."""
        return self.parent_id is None
    
    @hybrid_property
    def level(self) -> int:
        """Calculate the depth level of this category in the tree."""
        if self.is_root:
            return 0
        # This would need a recursive query in practice
        return 1  # Simplified for now
    
    def get_path(self) -> List["Category"]:
        """Get the full path from root to this category."""
        path = []
        current = self
        while current:
            path.insert(0, current)
            current = current.parent
        return path
    
    def get_breadcrumb(self) -> str:
        """Get breadcrumb string for this category."""
        path = self.get_path()
        return " > ".join(cat.name for cat in path)
    
    def __repr__(self):
        return f"<Category(id={self.id}, name={self.name}, slug={self.slug})>"


class Tag(Base):
    """
    Tag model for flexible recipe labeling.
    
    Features:
    - Flat structure for flexible tagging
    - Usage count for popular tags
    - Slug for URL-friendly identifiers
    - Support for dietary tags and general tags
    """
    __tablename__ = "recipe_tags"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Tag details
    name: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True
    )
    
    slug: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Usage tracking
    usage_count: Mapped[int] = mapped_column(
        Integer,
        server_default='0',
        nullable=False,
        index=True,
        comment="Number of recipes using this tag"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False
    )
    
    # Relationships
    recipe_tags: Mapped[List["RecipeTag"]] = relationship(
        "RecipeTag",
        back_populates="tag",
        cascade="all, delete-orphan"
    )
    
    # Table constraints
    __table_args__ = (
        Index('idx_tags_usage', 'usage_count'),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate tag name is not empty."""
        if not name or not name.strip():
            raise ValueError("Tag name cannot be empty")
        return name.strip()
    
    @validates('slug')
    def validate_slug(self, key, slug):
        """Validate slug format."""
        import re
        if not slug or not re.match(r'^[a-z0-9-]+$', slug):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return slug
    
    @hybrid_property
    def is_popular(self) -> bool:
        """Check if this is a popular tag (usage_count > 10)."""
        return self.usage_count > 10
    
    @hybrid_property
    def is_dietary(self) -> bool:
        """Check if this is a dietary tag based on common patterns."""
        dietary_keywords = [
            'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 
            'nut-free', 'kosher', 'halal', 'paleo', 'keto', 
            'low-carb', 'sugar-free'
        ]
        return any(keyword in self.slug for keyword in dietary_keywords)
    
    def __repr__(self):
        return f"<Tag(id={self.id}, name={self.name}, usage_count={self.usage_count})>"


class RecipeCategory(Base):
    """
    Junction table linking recipes to categories.
    
    Features:
    - Many-to-many relationship between recipes and categories
    - Primary category flag for main categorization
    - Timestamps for tracking when categorization was added
    """
    __tablename__ = "recipe_recipe_categories"
    
    # Foreign keys as composite primary key
    recipe_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id", ondelete="CASCADE"),
        primary_key=True
    )
    
    category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_categories.id", ondelete="CASCADE"),
        primary_key=True
    )
    
    # Primary category flag
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
        nullable=False,
        comment="Whether this is the primary category for the recipe"
    )
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False
    )
    
    # Relationships
    recipe: Mapped["Recipe"] = relationship(
        "Recipe",
        back_populates="recipe_categories"
    )
    
    category: Mapped["Category"] = relationship(
        "Category",
        back_populates="recipe_categories"
    )
    
    # Table constraints
    __table_args__ = (
        Index('idx_recipe_categories_recipe', 'recipe_id'),
        Index('idx_recipe_categories_category', 'category_id'),
        Index('idx_recipe_categories_primary', 'recipe_id', 'is_primary',
              postgresql_where=text('is_primary')),
    )
    
    def __repr__(self):
        return f"<RecipeCategory(recipe_id={self.recipe_id}, category_id={self.category_id}, is_primary={self.is_primary})>"


class RecipeTag(Base):
    """
    Junction table linking recipes to tags.
    
    Features:
    - Many-to-many relationship between recipes and tags
    - Timestamp tracking when tag was added
    - Support for tag clouds and filtering
    """
    __tablename__ = "recipe_recipe_tags"
    
    # Foreign keys as composite primary key
    recipe_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id", ondelete="CASCADE"),
        primary_key=True
    )
    
    tag_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_tags.id", ondelete="CASCADE"),
        primary_key=True
    )
    
    # Timestamp
    tagged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False,
        comment="When this tag was added to the recipe"
    )
    
    # Relationships
    recipe: Mapped["Recipe"] = relationship(
        "Recipe",
        back_populates="recipe_tags"
    )
    
    tag: Mapped["Tag"] = relationship(
        "Tag",
        back_populates="recipe_tags"
    )
    
    # Table constraints
    __table_args__ = (
        Index('idx_recipe_tags_recipe', 'recipe_id'),
        Index('idx_recipe_tags_tag', 'tag_id'),
        Index('idx_recipe_tags_tagged', 'tagged_at'),
    )
    
    def __repr__(self):
        return f"<RecipeTag(recipe_id={self.recipe_id}, tag_id={self.tag_id})>"