"""
Recipe schemas and DTOs for Jidelnicek 2.0.

This module contains all Pydantic models for request/response validation
in the recipe system, implementing comprehensive validation rules.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class RecipeIngredientBase(BaseModel):
    """Base schema for recipe ingredients."""
    
    ingredient_id: UUID = Field(
        ...,
        description="ID of the ingredient from common_ingredients table"
    )
    quantity_g: Decimal = Field(
        ...,
        gt=0,
        decimal_places=1,
        description="Quantity in grams (must be positive)"
    )
    display_order: int = Field(
        default=0,
        ge=0,
        description="Order for displaying ingredients in UI"
    )
    
    @field_validator('quantity_g')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        """Ensure quantity is positive and has reasonable precision."""
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        # Round to 1 decimal place
        return round(v, 1)


class RecipeIngredientCreate(RecipeIngredientBase):
    """Schema for creating recipe ingredients."""
    pass


class RecipeIngredientUpdate(BaseModel):
    """Schema for updating recipe ingredients."""
    
    quantity_g: Optional[Decimal] = Field(
        None,
        gt=0,
        decimal_places=1,
        description="New quantity in grams"
    )
    display_order: Optional[int] = Field(
        None,
        ge=0,
        description="New display order"
    )
    
    model_config = ConfigDict(extra='forbid')
    
    @field_validator('quantity_g')
    @classmethod
    def validate_quantity_if_provided(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """Ensure quantity is positive if provided."""
        if v is not None and v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return round(v, 1) if v is not None else None


class RecipeIngredientResponse(RecipeIngredientBase):
    """Schema for recipe ingredient responses with full details."""
    
    id: UUID
    recipe_id: UUID
    # Additional fields from ingredient relationship will be added here
    # when the common module is implemented
    
    model_config = ConfigDict(from_attributes=True)


class RecipeBase(BaseModel):
    """Base schema for recipes."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Recipe name (1-100 characters)"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Recipe description (max 500 characters)"
    )
    instructions: Optional[str] = Field(
        None,
        max_length=2000,
        description="Cooking instructions (max 2000 characters)"
    )
    prep_time_minutes: Optional[int] = Field(
        None,
        ge=0,
        le=1440,  # Max 24 hours
        description="Preparation time in minutes"
    )
    cook_time_minutes: Optional[int] = Field(
        None,
        ge=0,
        le=1440,  # Max 24 hours
        description="Cooking time in minutes"
    )
    water_ml: int = Field(
        default=0,
        ge=0,
        le=10000,  # Max 10 liters
        description="Water required in milliliters (for camping)"
    )
    servings: int = Field(
        default=1,
        ge=1,
        le=100,
        description="Number of servings (1-100)"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize recipe name."""
        v = v.strip()
        if not v:
            raise ValueError("Recipe name cannot be empty")
        return v
    
    @field_validator('description', 'instructions')
    @classmethod
    def strip_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace from text fields."""
        return v.strip() if v else None


class RecipeCreate(RecipeBase):
    """Schema for creating recipes."""
    
    ingredients: List[RecipeIngredientCreate] = Field(
        default=[],
        description="List of ingredients with quantities"
    )
    is_public: bool = Field(
        default=False,
        description="Whether recipe is visible to others when published"
    )
    
    @field_validator('ingredients')
    @classmethod
    def validate_ingredients(cls, v: List[RecipeIngredientCreate]) -> List[RecipeIngredientCreate]:
        """Validate ingredients list."""
        # Check for duplicate ingredients
        ingredient_ids = [ing.ingredient_id for ing in v]
        if len(ingredient_ids) != len(set(ingredient_ids)):
            raise ValueError("Recipe cannot contain duplicate ingredients")
        
        # Ensure display orders are unique or auto-assign
        if v:
            orders = [ing.display_order for ing in v]
            if len(set(orders)) != len(orders):
                # Auto-assign display orders if duplicates exist
                for i, ing in enumerate(v):
                    ing.display_order = i
        
        return v


class RecipeUpdate(BaseModel):
    """Schema for updating recipes."""
    
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Recipe name"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Recipe description"
    )
    instructions: Optional[str] = Field(
        None,
        max_length=2000,
        description="Cooking instructions"
    )
    prep_time_minutes: Optional[int] = Field(
        None,
        ge=0,
        le=1440,
        description="Preparation time in minutes"
    )
    cook_time_minutes: Optional[int] = Field(
        None,
        ge=0,
        le=1440,
        description="Cooking time in minutes"
    )
    water_ml: Optional[int] = Field(
        None,
        ge=0,
        le=10000,
        description="Water required in milliliters"
    )
    servings: Optional[int] = Field(
        None,
        ge=1,
        le=100,
        description="Number of servings"
    )
    is_public: Optional[bool] = Field(
        None,
        description="Whether recipe is visible to others"
    )
    
    model_config = ConfigDict(extra='forbid')
    
    @field_validator('name')
    @classmethod
    def validate_name_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Recipe name cannot be empty")
        return v
    
    @field_validator('description', 'instructions')
    @classmethod
    def strip_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace from text fields."""
        return v.strip() if v else None


class RecipeResponse(RecipeBase):
    """Schema for recipe responses (basic info without ingredients)."""
    
    id: UUID
    user_id: UUID
    is_public: bool
    is_published: bool
    published_at: Optional[datetime]
    is_archived: bool
    fork_count: int
    original_recipe_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    # Computed properties
    total_time_minutes: Optional[int] = Field(
        None,
        description="Total time (prep + cook)"
    )
    is_forked: bool = Field(
        False,
        description="Whether recipe was forked from another"
    )
    can_be_unpublished: bool = Field(
        True,
        description="Whether recipe can be unpublished (fork_count <= 5)"
    )
    
    model_config = ConfigDict(from_attributes=True)


class RecipeDetail(RecipeResponse):
    """Schema for detailed recipe response including ingredients."""
    
    ingredients: List[RecipeIngredientResponse] = Field(
        default=[],
        description="List of ingredients with full details"
    )
    
    # Nutritional information (will be computed)
    nutrition_per_serving: Optional[Dict[str, Any]] = Field(
        None,
        description="Nutritional values per serving"
    )
    nutrition_total: Optional[Dict[str, Any]] = Field(
        None,
        description="Total nutritional values for all servings"
    )


class RecipeSearch(BaseModel):
    """Schema for recipe search filters."""
    
    query: Optional[str] = Field(
        None,
        max_length=100,
        description="Search query for name/description"
    )
    user_id: Optional[UUID] = Field(
        None,
        description="Filter by user ID"
    )
    is_public: Optional[bool] = Field(
        None,
        description="Filter by public/private status"
    )
    is_published: Optional[bool] = Field(
        None,
        description="Filter by published status"
    )
    is_archived: Optional[bool] = Field(
        default=False,
        description="Include archived recipes"
    )
    has_ingredients: Optional[List[UUID]] = Field(
        None,
        description="Filter recipes containing these ingredients"
    )
    max_prep_time: Optional[int] = Field(
        None,
        gt=0,
        description="Maximum preparation time in minutes"
    )
    max_cook_time: Optional[int] = Field(
        None,
        gt=0,
        description="Maximum cooking time in minutes"
    )
    max_total_time: Optional[int] = Field(
        None,
        gt=0,
        description="Maximum total time in minutes"
    )
    min_servings: Optional[int] = Field(
        None,
        ge=1,
        description="Minimum number of servings"
    )
    max_servings: Optional[int] = Field(
        None,
        ge=1,
        description="Maximum number of servings"
    )
    
    @model_validator(mode='after')
    def validate_serving_range(self) -> 'RecipeSearch':
        """Ensure min_servings <= max_servings if both provided."""
        if self.min_servings and self.max_servings:
            if self.min_servings > self.max_servings:
                raise ValueError("min_servings cannot be greater than max_servings")
        return self
    
    @field_validator('query')
    @classmethod
    def normalize_query(cls, v: Optional[str]) -> Optional[str]:
        """Normalize search query."""
        return v.strip() if v else None


class RecipeList(BaseModel):
    """Schema for paginated recipe list response."""
    
    items: List[RecipeResponse] = Field(
        ...,
        description="List of recipes"
    )
    total: int = Field(
        ...,
        ge=0,
        description="Total number of recipes matching filters"
    )
    page: int = Field(
        ...,
        ge=1,
        description="Current page number"
    )
    per_page: int = Field(
        ...,
        ge=1,
        le=100,
        description="Items per page"
    )
    pages: int = Field(
        ...,
        ge=0,
        description="Total number of pages"
    )
    
    model_config = ConfigDict(from_attributes=True)


class RecipePublish(BaseModel):
    """Schema for publishing/unpublishing recipes."""
    
    publish: bool = Field(
        ...,
        description="True to publish, False to unpublish"
    )


class RecipeFork(BaseModel):
    """Schema for forking a recipe."""
    
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Name for the forked recipe (defaults to original + ' (fork)')"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Recipe name cannot be empty")
        return v


class RecipeBulkDelete(BaseModel):
    """Schema for bulk deleting (archiving) recipes."""
    
    recipe_ids: List[UUID] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of recipe IDs to archive (max 100)"
    )
    
    @field_validator('recipe_ids')
    @classmethod
    def validate_unique_ids(cls, v: List[UUID]) -> List[UUID]:
        """Ensure recipe IDs are unique."""
        if len(v) != len(set(v)):
            raise ValueError("Recipe IDs must be unique")
        return v


class RecipeImport(BaseModel):
    """Schema for importing recipes from external sources."""
    
    source: str = Field(
        ...,
        description="Source of the recipe (e.g., 'web', 'json', 'xml')"
    )
    data: Dict[str, Any] = Field(
        ...,
        description="Recipe data in source format"
    )
    
    model_config = ConfigDict(extra='allow')


class RecipeExport(BaseModel):
    """Schema for exporting recipes."""
    
    format: str = Field(
        ...,
        pattern='^(json|xml|pdf)$',
        description="Export format"
    )
    include_nutrition: bool = Field(
        default=True,
        description="Include nutritional information"
    )
    include_images: bool = Field(
        default=False,
        description="Include recipe images (if any)"
    )


# Version tracking schemas
class RecipeVersionBase(BaseModel):
    """Base schema for recipe versions."""
    
    version_number: str = Field(
        ...,
        pattern=r'^\d+\.\d+$',
        description="Version number in format 'major.minor' (e.g., '1.0', '1.1')"
    )
    change_description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Description of what changed in this version"
    )
    change_type: str = Field(
        ...,
        pattern=r'^(major|minor|nutritional|ingredient|metadata)$',
        description="Type of change"
    )
    nutritional_change_percentage: Optional[Decimal] = Field(
        None,
        ge=0,
        decimal_places=2,
        description="Percentage change in nutritional values from previous version"
    )
    is_significant: bool = Field(
        default=False,
        description="Whether this version represents a significant change"
    )
    
    @field_validator('change_description')
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace from description."""
        return v.strip() if v else None


class RecipeVersionCreate(RecipeVersionBase):
    """Schema for creating recipe versions."""
    
    recipe_snapshot: Optional[Dict[str, Any]] = Field(
        None,
        description="Snapshot of recipe data at this version"
    )


class RecipeVersionResponse(RecipeVersionBase):
    """Schema for recipe version responses."""
    
    id: UUID
    recipe_id: UUID
    changed_by: UUID
    recipe_snapshot: Optional[Dict[str, Any]]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RecipeVersionHistory(BaseModel):
    """Schema for recipe version history."""
    
    recipe_id: UUID
    current_version: Optional[str] = Field(
        None,
        description="Current version number"
    )
    versions: List[RecipeVersionResponse] = Field(
        default=[],
        description="List of all versions ordered by creation date (newest first)"
    )
    total_versions: int = Field(
        ...,
        ge=0,
        description="Total number of versions"
    )
    
    model_config = ConfigDict(from_attributes=True)


class RecipeVersionSummary(BaseModel):
    """Schema for recipe version summary."""
    
    version_number: str
    change_type: str
    change_description: Optional[str]
    nutritional_change_percentage: Optional[Decimal]
    is_significant: bool
    changed_by: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RecipeDuplicateRequest(BaseModel):
    """Schema for duplicating a recipe."""
    
    new_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Name for the duplicated recipe (defaults to original + ' (Copy)')"
    )
    
    @field_validator('new_name')
    @classmethod
    def validate_name_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Validate name if provided."""
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Recipe name cannot be empty")
        return v


class RecipeDuplicateResponse(BaseModel):
    """Schema for recipe duplication response."""
    
    original_recipe_id: UUID
    duplicated_recipe_id: UUID
    message: str = Field(
        ...,
        description="Success message"
    )
    
    model_config = ConfigDict(from_attributes=True)


class RecipeDetail(RecipeResponse):
    """Schema for detailed recipe response including ingredients and nutrition."""
    
    ingredients: List[RecipeIngredientResponse] = Field(
        default=[],
        description="List of ingredients with full details"
    )
    
    # Nutritional information (will be computed)
    nutrition_per_serving: Optional[Dict[str, Any]] = Field(
        None,
        description="Nutritional values per serving"
    )
    nutrition_total: Optional[Dict[str, Any]] = Field(
        None,
        description="Total nutritional values for all servings"
    )