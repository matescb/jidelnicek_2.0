"""
Recipe Pydantic schemas for API request/response validation.

This module contains all schemas for recipe CRUD operations including:
- Recipe creation with ingredients and images
- Recipe list with pagination and filtering
- Recipe detailed view with all relationships
- Recipe updating and publishing
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, validator, model_validator
from pydantic.config import ConfigDict


class RecipeImageBase(BaseModel):
    """Base schema for recipe images."""
    image_url: str = Field(..., max_length=500, description="URL to full-size image")
    thumbnail_url: Optional[str] = Field(None, max_length=500, description="URL to thumbnail image")
    alt_text: Optional[str] = Field(None, max_length=200, description="Alternative text for accessibility")
    display_order: int = Field(0, ge=0, le=9, description="Order of display (0 = first)")
    is_primary: bool = Field(False, description="Whether this is the primary/featured image")


class RecipeImageCreate(RecipeImageBase):
    """Schema for creating recipe images."""
    pass


class RecipeImageUpdate(BaseModel):
    """Schema for updating recipe images."""
    image_url: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    alt_text: Optional[str] = Field(None, max_length=200)
    display_order: Optional[int] = Field(None, ge=0, le=9)
    is_primary: Optional[bool] = None


class RecipeImageResponse(RecipeImageBase):
    """Schema for recipe image responses."""
    id: UUID
    recipe_id: UUID
    file_size_bytes: Optional[int]
    width: Optional[int]
    height: Optional[int]
    mime_type: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecipeIngredientBase(BaseModel):
    """Base schema for recipe ingredients."""
    ingredient_id: UUID = Field(..., description="ID of the ingredient")
    quantity: Decimal = Field(..., gt=0, description="Quantity in specified unit")
    unit: str = Field(..., description="Unit of measurement")
    preparation_notes: Optional[str] = Field(None, max_length=200, description="Optional preparation instructions")
    is_optional: bool = Field(False, description="Whether this ingredient is optional")
    display_order: int = Field(0, ge=0, description="Order of display in ingredient list")

    @validator('unit')
    def validate_unit(cls, v):
        allowed_units = ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece']
        if v not in allowed_units:
            raise ValueError(f"Unit must be one of: {', '.join(allowed_units)}")
        return v


class RecipeIngredientCreate(RecipeIngredientBase):
    """Schema for creating recipe ingredients."""
    pass


class RecipeIngredientUpdate(BaseModel):
    """Schema for updating recipe ingredients."""
    ingredient_id: Optional[UUID] = None
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = None
    preparation_notes: Optional[str] = Field(None, max_length=200)
    is_optional: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)

    @validator('unit')
    def validate_unit(cls, v):
        if v is not None:
            allowed_units = ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece']
            if v not in allowed_units:
                raise ValueError(f"Unit must be one of: {', '.join(allowed_units)}")
        return v


class RecipeIngredientResponse(RecipeIngredientBase):
    """Schema for recipe ingredient responses."""
    id: UUID
    recipe_id: UUID
    ingredient: Optional[Dict[str, Any]] = None  # Ingredient details when loaded

    model_config = ConfigDict(from_attributes=True)


class RecipeBase(BaseModel):
    """Base schema for recipes."""
    name: str = Field(..., min_length=1, max_length=100, description="Recipe name")
    description: Optional[str] = Field(None, description="Recipe description")
    instructions: Optional[str] = Field(None, max_length=2000, description="Recipe instructions")
    difficulty_level: Optional[str] = Field(None, description="Recipe difficulty: easy, medium, hard")
    prep_time_minutes: Optional[int] = Field(None, ge=0, description="Preparation time in minutes")
    cook_time_minutes: Optional[int] = Field(None, ge=0, description="Cooking time in minutes")
    water_ml: int = Field(0, ge=0, description="Water required in ml")
    servings: int = Field(1, gt=0, description="Number of servings")
    is_public: bool = Field(False, description="Whether recipe is public")

    @validator('difficulty_level')
    def validate_difficulty(cls, v):
        if v is not None:
            allowed_levels = ['easy', 'medium', 'hard']
            if v not in allowed_levels:
                raise ValueError(f"Difficulty level must be one of: {', '.join(allowed_levels)}")
        return v

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Recipe name cannot be empty")
        return v.strip()


class RecipeCreate(RecipeBase):
    """Schema for creating recipes."""
    ingredients: List[RecipeIngredientCreate] = Field(default_factory=list, description="Recipe ingredients")
    images: List[RecipeImageCreate] = Field(default_factory=list, description="Recipe images")

    @validator('images')
    def validate_images(cls, v):
        if len(v) > 10:
            raise ValueError("Maximum 10 images allowed per recipe")
        
        # Check for multiple primary images
        primary_count = sum(1 for img in v if img.is_primary)
        if primary_count > 1:
            raise ValueError("Only one primary image allowed per recipe")
        
        return v

    @validator('ingredients')
    def validate_ingredients_length(cls, v):
        if len(v) > 50:
            raise ValueError("Maximum 50 ingredients allowed per recipe")
        return v


class RecipeUpdate(BaseModel):
    """Schema for updating recipes."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    instructions: Optional[str] = Field(None, max_length=2000)
    difficulty_level: Optional[str] = None
    prep_time_minutes: Optional[int] = Field(None, ge=0)
    cook_time_minutes: Optional[int] = Field(None, ge=0)
    water_ml: Optional[int] = Field(None, ge=0)
    servings: Optional[int] = Field(None, gt=0)
    is_public: Optional[bool] = None
    ingredients: Optional[List[RecipeIngredientUpdate]] = None
    images: Optional[List[RecipeImageUpdate]] = None

    @validator('difficulty_level')
    def validate_difficulty(cls, v):
        if v is not None:
            allowed_levels = ['easy', 'medium', 'hard']
            if v not in allowed_levels:
                raise ValueError(f"Difficulty level must be one of: {', '.join(allowed_levels)}")
        return v

    @validator('name')
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Recipe name cannot be empty")
        return v.strip() if v else v

    @validator('images')
    def validate_images(cls, v):
        if v is not None:
            if len(v) > 10:
                raise ValueError("Maximum 10 images allowed per recipe")
            
            # Check for multiple primary images
            primary_count = sum(1 for img in v if img.is_primary)
            if primary_count > 1:
                raise ValueError("Only one primary image allowed per recipe")
        
        return v

    @validator('ingredients')
    def validate_ingredients_length(cls, v):
        if v is not None and len(v) > 50:
            raise ValueError("Maximum 50 ingredients allowed per recipe")
        return v


class RecipeListItem(BaseModel):
    """Schema for recipe list items (simplified view)."""
    id: UUID
    name: str
    description: Optional[str]
    difficulty_level: Optional[str]
    prep_time_minutes: Optional[int]
    cook_time_minutes: Optional[int]
    total_time_minutes: Optional[int]
    servings: int
    rating_average: Optional[Decimal]
    rating_count: int
    view_count: int
    is_public: bool
    is_published: bool
    fork_count: int
    is_forked: bool
    created_at: datetime
    updated_at: datetime
    primary_image: Optional[RecipeImageResponse] = None
    ingredient_count: int = 0
    author: Optional[Dict[str, Any]] = None  # Author details when loaded

    model_config = ConfigDict(from_attributes=True)


class RecipeResponse(RecipeBase):
    """Schema for detailed recipe responses."""
    id: UUID
    user_id: UUID
    rating_average: Optional[Decimal]
    rating_count: int
    view_count: int
    is_published: bool
    published_at: Optional[datetime]
    fork_count: int
    original_recipe_id: Optional[UUID]
    is_forked: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    total_time_minutes: Optional[int]
    can_be_unpublished: bool
    ingredients: List[RecipeIngredientResponse] = Field(default_factory=list)
    images: List[RecipeImageResponse] = Field(default_factory=list)
    author: Optional[Dict[str, Any]] = None
    original_recipe: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class RecipeListResponse(BaseModel):
    """Schema for paginated recipe list responses."""
    items: List[RecipeListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class RecipeSearchFilters(BaseModel):
    """Schema for recipe search filters."""
    query: Optional[str] = Field(None, description="Search query for name, description, or ingredients")
    difficulty_level: Optional[str] = Field(None, description="Filter by difficulty level")
    max_prep_time: Optional[int] = Field(None, ge=0, description="Maximum prep time in minutes")
    max_cook_time: Optional[int] = Field(None, ge=0, description="Maximum cook time in minutes")
    max_total_time: Optional[int] = Field(None, ge=0, description="Maximum total time in minutes")
    min_servings: Optional[int] = Field(None, gt=0, description="Minimum servings")
    max_servings: Optional[int] = Field(None, gt=0, description="Maximum servings")
    is_public: Optional[bool] = Field(None, description="Filter by public/private status")
    is_published: Optional[bool] = Field(None, description="Filter by published status")
    category_ids: Optional[List[UUID]] = Field(None, description="Filter by category IDs")
    tag_names: Optional[List[str]] = Field(None, description="Filter by tag names")
    author_id: Optional[UUID] = Field(None, description="Filter by author ID")
    has_images: Optional[bool] = Field(None, description="Filter by presence of images")
    min_rating: Optional[Decimal] = Field(None, ge=0, le=5, description="Minimum average rating")
    created_after: Optional[datetime] = Field(None, description="Filter by creation date (after)")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date (before)")

    @validator('difficulty_level')
    def validate_difficulty(cls, v):
        if v is not None:
            allowed_levels = ['easy', 'medium', 'hard']
            if v not in allowed_levels:
                raise ValueError(f"Difficulty level must be one of: {', '.join(allowed_levels)}")
        return v

    @model_validator(mode='after')
    def validate_time_ranges(self):
        if self.min_servings and self.max_servings:
            if self.min_servings > self.max_servings:
                raise ValueError("min_servings cannot be greater than max_servings")
        
        if self.created_after and self.created_before:
            if self.created_after > self.created_before:
                raise ValueError("created_after cannot be after created_before")
        
        return self


class RecipeDuplicateRequest(BaseModel):
    """Schema for recipe duplication request."""
    new_name: Optional[str] = Field(None, min_length=1, max_length=100, description="New name for duplicated recipe")
    make_private: bool = Field(True, description="Make the duplicated recipe private")


class RecipePublishRequest(BaseModel):
    """Schema for recipe publishing request."""
    make_public: bool = Field(True, description="Make recipe public when publishing")


class RecipeForkRequest(BaseModel):
    """Schema for recipe forking request."""
    new_name: Optional[str] = Field(None, min_length=1, max_length=100, description="New name for forked recipe")


class RecipeStatsResponse(BaseModel):
    """Schema for recipe statistics response."""
    total_recipes: int
    published_recipes: int
    private_recipes: int
    forked_recipes: int
    total_views: int
    average_rating: Optional[Decimal]
    most_viewed_recipe: Optional[Dict[str, Any]]
    most_rated_recipe: Optional[Dict[str, Any]]