"""
Recipe image model for handling recipe photos.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, String, Integer, ForeignKey,
    CheckConstraint, UniqueConstraint, text, Index
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now


class RecipeImage(Base):
    """
    Recipe image model for storing recipe photos.
    
    Features:
    - Multiple images per recipe
    - Thumbnail generation support
    - Display ordering
    - Primary image designation
    - Alt text for accessibility
    """
    __tablename__ = "recipe_images"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign key to recipe
    recipe_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Image URLs
    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="URL to full-size image"
    )
    
    thumbnail_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        comment="URL to thumbnail image"
    )
    
    # Image metadata
    alt_text: Mapped[Optional[str]] = mapped_column(
        String(200),
        comment="Alternative text for accessibility"
    )
    
    display_order: Mapped[int] = mapped_column(
        Integer,
        server_default='0',
        nullable=False,
        comment="Order of display (0 = first)"
    )
    
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
        nullable=False,
        comment="Whether this is the primary/featured image"
    )
    
    # File metadata
    file_size_bytes: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Original file size in bytes"
    )
    
    width: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Image width in pixels"
    )
    
    height: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Image height in pixels"
    )
    
    mime_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="MIME type (e.g., image/jpeg)"
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
    recipe: Mapped["Recipe"] = relationship(
        "Recipe",
        back_populates="images"
    )
    
    # Table constraints
    __table_args__ = (
        # Only one primary image per recipe
        Index('idx_recipe_primary_image', 'recipe_id', 'is_primary',
              unique=True, postgresql_where=text('is_primary = true')),
        # Ensure display order is unique per recipe
        UniqueConstraint('recipe_id', 'display_order'),
        # File size constraint (5MB max)
        CheckConstraint('file_size_bytes <= 5242880', 
                       name='recipe_images_file_size_check'),
    )
    
    @validates('mime_type')
    def validate_mime_type(self, key, mime_type):
        """Validate image format is allowed."""
        if mime_type:
            allowed_types = ['image/jpeg', 'image/png', 'image/webp']
            if mime_type not in allowed_types:
                raise ValueError(f"Image format must be one of: {', '.join(allowed_types)}")
        return mime_type
    
    @validates('display_order')
    def validate_display_order(self, key, display_order):
        """Validate display order is non-negative."""
        if display_order < 0:
            raise ValueError("Display order must be non-negative")
        if display_order > 9:
            raise ValueError("Display order must be less than 10 (max 10 images)")
        return display_order
    
    def __repr__(self):
        return f"<RecipeImage(id={self.id}, recipe_id={self.recipe_id}, is_primary={self.is_primary})>"