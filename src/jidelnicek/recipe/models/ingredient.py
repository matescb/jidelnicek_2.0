"""
Ingredient models for Jidelnicek 2.0.

This module defines models for ingredients and recipe-ingredient relationships
with support for nutritional data and unit conversions.
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

if TYPE_CHECKING:
    from .recipe import Recipe


class Ingredient(Base):
    """
    Ingredient model with nutritional data as per task 3.2.
    
    Features:
    - Nutritional data storage (JSON) for 99.9% accuracy
    - Unit conversions for flexible measurements
    - Allergen tracking
    - Dietary flags (vegan, gluten_free, etc)
    - Optional brand and barcode
    """
    __tablename__ = "recipe_ingredients"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Basic information
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True
    )
    
    brand: Mapped[Optional[str]] = mapped_column(
        String(100),
        comment="Optional brand name"
    )
    
    barcode: Mapped[Optional[str]] = mapped_column(
        String(50),
        index=True,
        comment="Optional barcode (EAN/UPC)"
    )
    
    # Nutritional data per 100g as JSON
    nutritional_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default={},
        comment="Nutritional values per 100g: calories, proteins, carbs, fats, fiber, sodium, vitamins"
    )
    
    # Unit conversions as JSON
    unit_conversions: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default={},
        comment="Conversion factors: g/ml/cup/tbsp/tsp"
    )
    
    # Allergens array (using JSON for SQLite compatibility)
    allergens: Mapped[Optional[List[str]]] = mapped_column(
        JSON,
        default=list,
        comment="List of allergens present (stored as JSON array)"
    )
    
    # Dietary flags JSON
    dietary_flags: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default={},
        comment="Dietary flags: vegan, gluten_free, kosher, halal, etc"
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
        cascade="all, delete-orphan",
        lazy="select",
        passive_deletes=True
    )
    
    @validates('nutritional_data')
    def validate_nutritional_data(self, key, nutritional_data):
        """Validate nutritional data for accuracy."""
        required_fields = ['calories', 'proteins', 'carbs', 'fats']
        for field in required_fields:
            if field not in nutritional_data:
                raise ValueError(f"Nutritional data must include {field}")
            if not isinstance(nutritional_data[field], (int, float)):
                raise ValueError(f"{field} must be a number")
            if nutritional_data[field] < 0:
                raise ValueError(f"{field} cannot be negative")
        return nutritional_data
    
    @validates('unit_conversions')
    def validate_unit_conversions(self, key, unit_conversions):
        """Validate unit conversion data."""
        for unit, factor in unit_conversions.items():
            if not isinstance(factor, (int, float)):
                raise ValueError(f"Conversion factor for {unit} must be a number")
            if factor <= 0:
                raise ValueError(f"Conversion factor for {unit} must be positive")
        return unit_conversions
    
    def __repr__(self):
        return f"<Ingredient(id={self.id}, name={self.name}, brand={self.brand})>"


class RecipeIngredient(Base):
    """
    Recipe ingredient model linking recipes to ingredients with quantities and units.
    
    Features as per task 3.3:
    - Quantity tracking with flexible units
    - Unit enum (g, kg, ml, l, cup, tbsp, tsp, piece)
    - Preparation notes (optional)
    - Optional ingredient flag
    - Unit conversion methods
    - Nutritional calculation support
    """
    __tablename__ = "recipe_recipe_ingredients"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    recipe_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    ingredient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recipe_ingredients.id"),
        nullable=False,
        index=True
    )
    
    # Quantity and unit
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=3),
        nullable=False,
        comment="Quantity in specified unit"
    )
    
    unit: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="g",
        comment="Unit of measurement: g, kg, ml, l, cup, tbsp, tsp, piece"
    )
    
    # Optional fields
    preparation_notes: Mapped[Optional[str]] = mapped_column(
        String(200),
        comment="Optional preparation instructions (e.g., 'diced', 'minced')"
    )
    
    is_optional: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text('false'),
        nullable=False,
        comment="Whether this ingredient is optional in the recipe"
    )
    
    # Display order
    display_order: Mapped[int] = mapped_column(
        Integer,
        server_default='0',
        nullable=False
    )
    
    # Relationships
    recipe: Mapped["Recipe"] = relationship(
        "Recipe",
        back_populates="ingredients",
        lazy="select"
    )
    
    # Ingredient relationship
    ingredient: Mapped["Ingredient"] = relationship(
        "Ingredient",
        back_populates="recipe_ingredients",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('quantity > 0', name='recipe_recipe_ingredients_quantity_check'),
        CheckConstraint("unit IN ('g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece')", 
                       name='recipe_recipe_ingredients_unit_check'),
        UniqueConstraint('recipe_id', 'ingredient_id'),
    )
    
    # Unit conversion constants
    UNIT_CONVERSIONS = {
        'g': {'g': 1, 'kg': 0.001},
        'kg': {'g': 1000, 'kg': 1},
        'ml': {'ml': 1, 'l': 0.001},
        'l': {'ml': 1000, 'l': 1},
        'cup': {'ml': 240, 'g': None},  # Depends on ingredient
        'tbsp': {'ml': 15, 'g': None},
        'tsp': {'ml': 5, 'g': None},
        'piece': {'piece': 1}
    }
    
    @validates('quantity')
    def validate_quantity(self, key, quantity):
        """Validate quantity is positive."""
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0")
        return quantity
    
    @validates('unit')
    def validate_unit(self, key, unit):
        """Validate unit is allowed."""
        allowed_units = ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece']
        if unit not in allowed_units:
            raise ValueError(f"Unit must be one of: {', '.join(allowed_units)}")
        return unit
    
    def convert_to_grams(self) -> Decimal:
        """Convert quantity to grams for nutritional calculation."""
        if self.unit in ['g']:
            return self.quantity
        elif self.unit == 'kg':
            return self.quantity * 1000
        elif self.unit == 'piece':
            # Need ingredient's unit weight
            if hasattr(self.ingredient, 'unit_weight_g') and self.ingredient.unit_weight_g:
                return self.quantity * self.ingredient.unit_weight_g
            raise ValueError(f"Cannot convert pieces to grams without unit weight for {self.ingredient.name}")
        elif self.unit in ['ml', 'l']:
            # Use ingredient's density if available
            if hasattr(self.ingredient, 'unit_conversions') and 'ml_to_g' in self.ingredient.unit_conversions:
                ml_amount = self.quantity * 1000 if self.unit == 'l' else self.quantity
                return Decimal(str(ml_amount * self.ingredient.unit_conversions['ml_to_g']))
            # Default to water density (1g/ml)
            return self.quantity * 1000 if self.unit == 'l' else self.quantity
        elif self.unit in ['cup', 'tbsp', 'tsp']:
            # Convert to ml first, then to grams
            ml_conversions = {'cup': 240, 'tbsp': 15, 'tsp': 5}
            ml_amount = self.quantity * ml_conversions[self.unit]
            if hasattr(self.ingredient, 'unit_conversions') and 'ml_to_g' in self.ingredient.unit_conversions:
                return Decimal(str(ml_amount * self.ingredient.unit_conversions['ml_to_g']))
            return Decimal(str(ml_amount))  # Default to water density
        else:
            raise ValueError(f"Unknown unit: {self.unit}")
    
    def calculate_nutrition(self) -> dict:
        """Calculate nutritional values for this ingredient quantity."""
        grams = self.convert_to_grams()
        if not hasattr(self.ingredient, 'nutritional_data') or not self.ingredient.nutritional_data:
            return {}
        
        # Calculate nutrition based on grams (nutritional_data is per 100g)
        factor = grams / 100
        nutrition = {}
        for nutrient, value in self.ingredient.nutritional_data.items():
            if isinstance(value, (int, float)):
                nutrition[nutrient] = float(value) * float(factor)
        
        return nutrition
    
    def __repr__(self):
        return f"<RecipeIngredient(id={self.id}, recipe_id={self.recipe_id}, ingredient_id={self.ingredient_id}, quantity={self.quantity} {self.unit})>"