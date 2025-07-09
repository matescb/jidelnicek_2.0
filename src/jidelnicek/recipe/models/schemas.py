"""
Recipe module Pydantic schemas.

This module defines the data validation and serialization schemas
for recipe-related operations.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict, validator


class DietaryRestriction(str, Enum):
    """Dietary restriction types."""
    VEGAN = "vegan"
    VEGETARIAN = "vegetarian"
    GLUTEN_FREE = "gluten_free"
    DAIRY_FREE = "dairy_free"
    NUT_FREE = "nut_free"
    EGG_FREE = "egg_free"
    SOY_FREE = "soy_free"
    LOW_CARB = "low_carb"
    KETO = "keto"
    PALEO = "paleo"
    WHOLE30 = "whole30"


class Difficulty(str, Enum):
    """Recipe difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class SortOption(str, Enum):
    """Search result sorting options."""
    RELEVANCE = "relevance"
    RATING = "rating"
    NEWEST = "newest"
    POPULARITY = "popularity"
    PREP_TIME = "prep_time"
    CALORIES = "calories"


class TimeFilter(str, Enum):
    """Time range filter options."""
    UNDER_15_MIN = "under_15"
    UNDER_30_MIN = "under_30"
    UNDER_60_MIN = "under_60"
    OVER_60_MIN = "over_60"


# Base schemas
class RecipeIngredientBase(BaseModel):
    """Base schema for recipe ingredients."""
    ingredient_id: int
    amount: Decimal = Field(..., decimal_places=2)
    unit: str
    notes: Optional[str] = None
    is_optional: bool = False
    

class RecipeNutritionBase(BaseModel):
    """Base schema for recipe nutrition."""
    calories: int = Field(..., ge=0)
    protein: Decimal = Field(..., decimal_places=1, ge=0)
    carbs: Decimal = Field(..., decimal_places=1, ge=0)
    fat: Decimal = Field(..., decimal_places=1, ge=0)
    fiber: Decimal = Field(..., decimal_places=1, ge=0)
    sugar: Decimal = Field(..., decimal_places=1, ge=0)
    sodium: int = Field(..., ge=0)
    cholesterol: int = Field(..., ge=0)
    

class RecipeBase(BaseModel):
    """Base schema for recipes."""
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    prep_time: int = Field(..., ge=0)
    cook_time: int = Field(..., ge=0)
    servings: int = Field(..., ge=1)
    difficulty: Difficulty
    cooking_instructions: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_url: Optional[str] = None
    

# Create schemas
class RecipeIngredientCreate(RecipeIngredientBase):
    """Schema for creating recipe ingredients."""
    pass
    

class RecipeNutritionCreate(RecipeNutritionBase):
    """Schema for creating recipe nutrition."""
    pass
    

class RecipeCreate(RecipeBase):
    """Schema for creating recipes."""
    ingredients: List[RecipeIngredientCreate]
    nutrition: Optional[RecipeNutritionCreate] = None
    category_ids: List[int] = []
    tag_ids: List[int] = []
    is_vegan: bool = False
    is_vegetarian: bool = False
    is_gluten_free: bool = False
    is_dairy_free: bool = False
    

# Update schemas
class RecipeUpdate(BaseModel):
    """Schema for updating recipes."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    prep_time: Optional[int] = Field(None, ge=0)
    cook_time: Optional[int] = Field(None, ge=0)
    servings: Optional[int] = Field(None, ge=1)
    difficulty: Optional[Difficulty] = None
    cooking_instructions: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_url: Optional[str] = None
    

# Response schemas
class IngredientInfo(BaseModel):
    """Ingredient information in responses."""
    id: int
    name: str
    category: str
    
    model_config = ConfigDict(from_attributes=True)
    

class RecipeIngredientResponse(RecipeIngredientBase):
    """Response schema for recipe ingredients."""
    id: int
    ingredient: IngredientInfo
    
    model_config = ConfigDict(from_attributes=True)
    

class RecipeNutritionResponse(RecipeNutritionBase):
    """Response schema for recipe nutrition."""
    id: int
    recipe_id: int
    
    model_config = ConfigDict(from_attributes=True)
    

class CategoryResponse(BaseModel):
    """Response schema for categories."""
    id: int
    name: str
    slug: str
    
    model_config = ConfigDict(from_attributes=True)
    

class TagResponse(BaseModel):
    """Response schema for tags."""
    id: int
    name: str
    slug: str
    
    model_config = ConfigDict(from_attributes=True)
    

class RecipeReviewResponse(BaseModel):
    """Response schema for recipe reviews."""
    id: int
    user_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    

class RecipeResponse(RecipeBase):
    """Response schema for recipes."""
    id: int
    slug: str
    user_id: int
    ingredients: List[RecipeIngredientResponse]
    nutrition: Optional[RecipeNutritionResponse]
    categories: List[CategoryResponse]
    tags: List[TagResponse]
    reviews: List[RecipeReviewResponse]
    average_rating: Optional[float]
    total_reviews: int
    view_count: int
    save_count: int
    is_vegan: bool
    is_vegetarian: bool
    is_gluten_free: bool
    is_dairy_free: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def total_time(self) -> int:
        """Calculate total time."""
        return self.prep_time + self.cook_time
        

# Search schemas
class SearchFilter(BaseModel):
    """Base search filter schema."""
    pass
    

class IngredientFilter(SearchFilter):
    """Ingredient-based search filter."""
    include: List[int] = []
    exclude: List[int] = []
    operator: str = "AND"  # AND, OR
    

class NutritionFilter(SearchFilter):
    """Nutrition-based search filter."""
    calories_min: Optional[int] = None
    calories_max: Optional[int] = None
    protein_min: Optional[Decimal] = None
    protein_max: Optional[Decimal] = None
    carbs_min: Optional[Decimal] = None
    carbs_max: Optional[Decimal] = None
    fat_min: Optional[Decimal] = None
    fat_max: Optional[Decimal] = None
    fiber_min: Optional[Decimal] = None
    fiber_max: Optional[Decimal] = None
    

class RecipeSearchRequest(BaseModel):
    """Request schema for recipe search."""
    query: str = ""
    ingredients: Optional[IngredientFilter] = None
    nutrition: Optional[NutritionFilter] = None
    dietary_restrictions: List[DietaryRestriction] = []
    categories: List[int] = []
    tags: List[int] = []
    time_filter: Optional[TimeFilter] = None
    difficulty: List[Difficulty] = []
    min_rating: Optional[float] = None
    sort_by: SortOption = SortOption.RELEVANCE
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    

class SearchFacet(BaseModel):
    """Search facet information."""
    name: str
    count: int
    

class SearchFacets(BaseModel):
    """Collection of search facets."""
    categories: Dict[str, int]
    difficulty: Dict[str, int]
    time_ranges: Dict[str, int]
    dietary: Dict[str, int]
    

class RecipeSearchResponse(BaseModel):
    """Response schema for recipe search."""
    recipes: List[RecipeResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    facets: SearchFacets
    query_time_ms: float
    
    @property
    def has_next(self) -> bool:
        """Check if there's a next page."""
        return self.page < self.total_pages
        
    @property
    def has_previous(self) -> bool:
        """Check if there's a previous page."""
        return self.page > 1
        

# Analytics schemas
class SearchTermAnalytics(BaseModel):
    """Analytics for search terms."""
    term: str
    count: int
    conversion_rate: float
    avg_results: int
    

class SearchInsights(BaseModel):
    """Comprehensive search insights."""
    popular_searches: List[Dict[str, Any]]
    zero_result_searches: List[Dict[str, Any]]
    popular_filters: Dict[str, int]
    search_performance: Dict[str, Any]
    

class SearchQualityMetrics(BaseModel):
    """Search quality metrics."""
    conversion_rate: float
    click_through_rate: Dict[str, float]
    refinement_rate: float
    session_metrics: Dict[str, Any]
    

# Meal planning schemas
class MealPlanRecipe(BaseModel):
    """Recipe in a meal plan."""
    recipe_id: int
    day_of_week: int = Field(..., ge=0, le=6)
    meal_type: str  # breakfast, lunch, dinner, snack
    servings: int = Field(..., ge=1)
    notes: Optional[str] = None
    

class MealPlanCreate(BaseModel):
    """Schema for creating meal plans."""
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    recipes: List[MealPlanRecipe]
    
    @validator('end_date')
    def validate_dates(cls, end_date, values):
        """Validate date range."""
        if 'start_date' in values and end_date < values['start_date']:
            raise ValueError('End date must be after start date')
        return end_date
        

class MealPlanResponse(BaseModel):
    """Response schema for meal plans."""
    id: int
    user_id: int
    name: str
    description: Optional[str]
    start_date: datetime
    end_date: datetime
    recipes: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    

# Shopping list schemas
class ShoppingListItem(BaseModel):
    """Item in a shopping list."""
    ingredient_id: int
    amount: Decimal
    unit: str
    checked: bool = False
    notes: Optional[str] = None
    

class ShoppingListCreate(BaseModel):
    """Schema for creating shopping lists."""
    name: str = Field(..., min_length=3, max_length=100)
    meal_plan_id: Optional[int] = None
    items: List[ShoppingListItem] = []
    

class ShoppingListResponse(BaseModel):
    """Response schema for shopping lists."""
    id: int
    user_id: int
    name: str
    meal_plan_id: Optional[int]
    items: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)