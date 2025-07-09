

"""
Ingredient model for food items used in recipes.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, String, ForeignKey,
    UniqueConstraint, text, Index
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from jidelnicek.recipe.models import RecipeIngredient


class Ingredient(Base):
    """
    Ingredient model for food items used in recipes.
    
    Features:
    - User-specific and global ingredients
    - Nutritional data stored as JSON
    - Unit conversions and allergen information
    - Soft delete with archival
    """
    __tablename__ = "common_ingredients"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship (null for global ingredients)
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        index=True
    )
    
    # Ingredient details
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    
    brand: Mapped[Optional[str]] = mapped_column(
        String(100),
        comment="Brand of the ingredient, if applicable"
    )

    barcode: Mapped[Optional[str]] = mapped_column(
        String(50),
        unique=True,
        index=True,
        comment="Barcode (EAN/UPC) of the ingredient"
    )
    
    category: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Nutritional data stored as JSON
    nutritional_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        comment="Nutritional values per 100g (e.g., calories, proteins)"
    )

    # Unit conversions stored as JSON
    unit_conversions: Mapped[Optional[Dict[str, float]]] = mapped_column(
        JSONB,
        comment="Conversion factors to grams (e.g., {\"cup\": 120, \"tbsp\": 15})"
    )

    # Allergens stored as an array of strings
    allergens: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String),
        comment="List of allergens present in the ingredient"
    )

    # Dietary flags stored as JSON
    dietary_flags: Mapped[Optional[Dict[str, bool]]] = mapped_column(
        JSONB,
        comment="Dietary flags (e.g., {\"vegan\": true, \"gluten_free\": false})"
    )
    
    # Flags
    is_global: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
        nullable=False,
        index=True
    )
    
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
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
    recipe_ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        "RecipeIngredient",
        back_populates="ingredient",
        cascade="all, delete-orphan"
    )
    
    # Table constraints
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_user_ingredient_name'),
        Index('idx_ingredients_name', 'name'),
    )
    
    @validates('name')
    def validate_name(self, key, name):
        """Validate ingredient name is not empty."""
        if not name or not name.strip():
            raise ValueError("Ingredient name cannot be empty")
        return name.strip()
    
    @validates('is_global')
    def validate_global_user_constraint(self, key, is_global):
        """Validate that global ingredients don't have a user_id."""
        if is_global and self.user_id is not None:
            raise ValueError("Global ingredients cannot have a user_id")
        return is_global
    
    def __repr__(self):
        return f"<Ingredient(id={self.id}, name='{self.name}', is_global={self.is_global})>"