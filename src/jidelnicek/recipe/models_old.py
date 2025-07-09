"""
Recipe models for Jidelnicek 2.0.

This module defines all recipe-related database models including:
- Recipes with publishing and forking support
- Recipe ingredients with quantity tracking
- Nutritional calculations and serving management
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
    # Alias for task compatibility
    created_by = user_id
    
    # Recipe details
    name: Mapped[str] = mapped_column(
        String(100), 
        nullable=False,
        index=True
    )
    # Alias for task compatibility - points to same column as name
    title = name
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
        order_by="RecipeIngredient.display_order"
    )
    
    images: Mapped[List["RecipeImage"]] = relationship(
        "RecipeImage",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeImage.display_order"
    )
    
    original_recipe: Mapped[Optional["Recipe"]] = relationship(
        "Recipe",
        remote_side=[id],
        backref="forks"
    )
    
    # Categorization relationships
    recipe_categories: Mapped[List["RecipeCategory"]] = relationship(
        "RecipeCategory",
        back_populates="recipe",
        cascade="all, delete-orphan"
    )
    
    recipe_tags: Mapped[List["RecipeTag"]] = relationship(
        "RecipeTag",
        back_populates="recipe",
        cascade="all, delete-orphan"
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
    
    @hybrid_property
    def total_time_minutes(self) -> Optional[int]:
        """Calculate total time for recipe preparation."""
        if self.prep_time_minutes is None and self.cook_time_minutes is None:
            return None
        return (self.prep_time_minutes or 0) + (self.cook_time_minutes or 0)
    
    # Alias for task compatibility
    total_time = total_time_minutes
    
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
    
    # Allergens array
    allergens: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String),
        default=[],
        comment="List of allergens present"
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
        cascade="all, delete-orphan"
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
        back_populates="ingredients"
    )
    
    # Ingredient relationship
    ingredient: Mapped["Ingredient"] = relationship(
        "Ingredient",
        back_populates="recipe_ingredients"
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