"""
Search-related schemas for recipes.

This module provides comprehensive schemas for:
- Advanced search requests and responses
- Search suggestions and autocomplete
- Popular searches and trending recipes
- Filter options and aggregations
- Search analytics tracking
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict, validator, model_validator


class SearchSortBy(str, Enum):
    """Available sort options for search results."""
    RELEVANCE = "relevance"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    RATING = "rating_average"
    VIEW_COUNT = "view_count"
    FORK_COUNT = "fork_count"
    PREP_TIME = "prep_time_minutes"
    COOK_TIME = "cook_time_minutes"
    TOTAL_TIME = "total_time_minutes"
    NAME = "name"


class SearchSortOrder(str, Enum):
    """Sort order options."""
    ASC = "asc"
    DESC = "desc"


class NutritionFilter(BaseModel):
    """Nutrition-based search filters."""
    max_calories: Optional[int] = Field(None, gt=0, description="Maximum calories per serving")
    min_calories: Optional[int] = Field(None, gt=0, description="Minimum calories per serving")
    max_protein_g: Optional[Decimal] = Field(None, gt=0, description="Maximum protein in grams")
    min_protein_g: Optional[Decimal] = Field(None, gt=0, description="Minimum protein in grams")
    max_carbs_g: Optional[Decimal] = Field(None, gt=0, description="Maximum carbohydrates in grams")
    min_carbs_g: Optional[Decimal] = Field(None, gt=0, description="Minimum carbohydrates in grams")
    max_fat_g: Optional[Decimal] = Field(None, gt=0, description="Maximum fat in grams")
    min_fat_g: Optional[Decimal] = Field(None, gt=0, description="Minimum fat in grams")
    max_fiber_g: Optional[Decimal] = Field(None, gt=0, description="Maximum fiber in grams")
    min_fiber_g: Optional[Decimal] = Field(None, gt=0, description="Minimum fiber in grams")
    max_sugar_g: Optional[Decimal] = Field(None, gt=0, description="Maximum sugar in grams")
    max_sodium_mg: Optional[Decimal] = Field(None, gt=0, description="Maximum sodium in milligrams")

    @model_validator(mode='after')
    def validate_ranges(self):
        """Validate min/max ranges."""
        if self.min_calories and self.max_calories:
            if self.min_calories > self.max_calories:
                raise ValueError("min_calories cannot be greater than max_calories")
        
        if self.min_protein_g and self.max_protein_g:
            if self.min_protein_g > self.max_protein_g:
                raise ValueError("min_protein_g cannot be greater than max_protein_g")
        
        if self.min_carbs_g and self.max_carbs_g:
            if self.min_carbs_g > self.max_carbs_g:
                raise ValueError("min_carbs_g cannot be greater than max_carbs_g")
        
        if self.min_fat_g and self.max_fat_g:
            if self.min_fat_g > self.max_fat_g:
                raise ValueError("min_fat_g cannot be greater than max_fat_g")
        
        if self.min_fiber_g and self.max_fiber_g:
            if self.min_fiber_g > self.max_fiber_g:
                raise ValueError("min_fiber_g cannot be greater than max_fiber_g")
        
        return self


class AdvancedSearchRequest(BaseModel):
    """Advanced search request with all filter options."""
    # Text search
    query: Optional[str] = Field(None, description="Search query for name, description, instructions")
    search_fields: Optional[List[str]] = Field(
        None, 
        description="Specific fields to search in",
        example=["name", "description", "instructions", "ingredients"]
    )
    
    # Basic filters
    difficulty_level: Optional[List[str]] = Field(None, description="Filter by difficulty levels")
    max_prep_time: Optional[int] = Field(None, ge=0, description="Maximum prep time in minutes")
    max_cook_time: Optional[int] = Field(None, ge=0, description="Maximum cook time in minutes")
    max_total_time: Optional[int] = Field(None, ge=0, description="Maximum total time in minutes")
    min_servings: Optional[int] = Field(None, gt=0, description="Minimum servings")
    max_servings: Optional[int] = Field(None, gt=0, description="Maximum servings")
    
    # Status filters
    is_public: Optional[bool] = Field(None, description="Filter by public/private status")
    is_published: Optional[bool] = Field(None, description="Filter by published status")
    is_forked: Optional[bool] = Field(None, description="Filter by forked status")
    
    # Categorization filters
    category_ids: Optional[List[UUID]] = Field(None, description="Filter by category IDs")
    category_slugs: Optional[List[str]] = Field(None, description="Filter by category slugs")
    tag_names: Optional[List[str]] = Field(None, description="Filter by tag names")
    tag_slugs: Optional[List[str]] = Field(None, description="Filter by tag slugs")
    
    # Ingredient filters
    include_ingredients: Optional[List[str]] = Field(None, description="Must include these ingredients")
    exclude_ingredients: Optional[List[str]] = Field(None, description="Must not include these ingredients")
    ingredient_count_min: Optional[int] = Field(None, gt=0, description="Minimum number of ingredients")
    ingredient_count_max: Optional[int] = Field(None, gt=0, description="Maximum number of ingredients")
    
    # Nutrition filters
    nutrition: Optional[NutritionFilter] = Field(None, description="Nutrition-based filters")
    
    # Author and social filters
    author_id: Optional[UUID] = Field(None, description="Filter by author ID")
    author_username: Optional[str] = Field(None, description="Filter by author username")
    has_images: Optional[bool] = Field(None, description="Filter by presence of images")
    min_rating: Optional[Decimal] = Field(None, ge=0, le=5, description="Minimum average rating")
    min_view_count: Optional[int] = Field(None, ge=0, description="Minimum view count")
    min_fork_count: Optional[int] = Field(None, ge=0, description="Minimum fork count")
    
    # Date filters
    created_after: Optional[datetime] = Field(None, description="Filter by creation date (after)")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date (before)")
    updated_after: Optional[datetime] = Field(None, description="Filter by update date (after)")
    updated_before: Optional[datetime] = Field(None, description="Filter by update date (before)")
    published_after: Optional[datetime] = Field(None, description="Filter by publish date (after)")
    published_before: Optional[datetime] = Field(None, description="Filter by publish date (before)")
    
    # Dietary preference filters
    dietary_preferences: Optional[List[str]] = Field(
        None,
        description="Dietary preferences",
        example=["vegan", "vegetarian", "gluten-free", "dairy-free", "keto", "paleo"]
    )
    
    # Pagination and sorting
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100, description="Items per page")
    sort_by: SearchSortBy = Field(SearchSortBy.RELEVANCE, description="Sort field")
    sort_order: SearchSortOrder = Field(SearchSortOrder.DESC, description="Sort order")
    
    # Search options
    include_facets: bool = Field(True, description="Include facet counts in response")
    highlight_fields: bool = Field(True, description="Highlight matching text in results")
    boost_recent: bool = Field(True, description="Boost recently created/updated recipes")
    fuzzy_search: bool = Field(True, description="Enable fuzzy matching for typos")

    @validator('difficulty_level')
    def validate_difficulty(cls, v):
        if v is not None:
            allowed_levels = ['easy', 'medium', 'hard']
            for level in v:
                if level not in allowed_levels:
                    raise ValueError(f"Difficulty level must be one of: {', '.join(allowed_levels)}")
        return v

    @model_validator(mode='after')
    def validate_ranges(self):
        """Validate various range constraints."""
        if self.min_servings and self.max_servings:
            if self.min_servings > self.max_servings:
                raise ValueError("min_servings cannot be greater than max_servings")
        
        if self.ingredient_count_min and self.ingredient_count_max:
            if self.ingredient_count_min > self.ingredient_count_max:
                raise ValueError("ingredient_count_min cannot be greater than ingredient_count_max")
        
        if self.created_after and self.created_before:
            if self.created_after > self.created_before:
                raise ValueError("created_after cannot be after created_before")
        
        if self.updated_after and self.updated_before:
            if self.updated_after > self.updated_before:
                raise ValueError("updated_after cannot be after updated_before")
        
        if self.published_after and self.published_before:
            if self.published_after > self.published_before:
                raise ValueError("published_after cannot be after published_before")
        
        return self


class SearchHighlight(BaseModel):
    """Highlighted text from search results."""
    field: str = Field(..., description="Field name where match was found")
    snippet: str = Field(..., description="Text snippet with highlighted match")
    highlights: List[str] = Field(..., description="Highlighted portions")


class SearchResultItem(BaseModel):
    """Individual search result item."""
    id: UUID
    score: Optional[float] = Field(None, description="Relevance score")
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
    fork_count: int
    is_public: bool
    is_published: bool
    is_forked: bool
    created_at: datetime
    updated_at: datetime
    
    # Author info
    author_id: UUID
    author_username: str
    author_avatar_url: Optional[str]
    
    # Primary image
    primary_image_url: Optional[str]
    primary_image_thumbnail_url: Optional[str]
    
    # Counts
    ingredient_count: int
    image_count: int
    category_count: int
    tag_count: int
    
    # Categories and tags (limited)
    categories: List[Dict[str, Any]] = Field(default_factory=list, description="Top 3 categories")
    tags: List[str] = Field(default_factory=list, description="Top 5 tags")
    
    # Nutrition summary
    calories_per_serving: Optional[int]
    
    # Search highlights
    highlights: Optional[List[SearchHighlight]] = None
    
    model_config = ConfigDict(from_attributes=True)


class SearchFacet(BaseModel):
    """Facet information for filtering."""
    name: str = Field(..., description="Facet name")
    values: List[Dict[str, Any]] = Field(..., description="Facet values with counts")
    total: int = Field(..., description="Total unique values")


class SearchResponse(BaseModel):
    """Advanced search response with results and metadata."""
    # Results
    items: List[SearchResultItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
    
    # Search metadata
    query: Optional[str]
    search_time_ms: int = Field(..., description="Search execution time in milliseconds")
    
    # Facets for filtering
    facets: Optional[Dict[str, SearchFacet]] = Field(
        None,
        description="Available facets for filtering",
        example={
            "categories": {"name": "categories", "values": [{"id": "uuid", "name": "Breakfast", "count": 42}]},
            "difficulty_level": {"name": "difficulty_level", "values": [{"value": "easy", "count": 120}]},
            "tags": {"name": "tags", "values": [{"value": "vegan", "count": 89}]}
        }
    )
    
    # Search suggestions
    did_you_mean: Optional[str] = Field(None, description="Spelling correction suggestion")
    related_searches: Optional[List[str]] = Field(None, description="Related search suggestions")


class SearchSuggestion(BaseModel):
    """Search suggestion item."""
    type: str = Field(..., description="Suggestion type", example="recipe")
    id: Optional[UUID] = Field(None, description="ID for direct navigation")
    text: str = Field(..., description="Display text")
    highlight: Optional[str] = Field(None, description="Text with matching parts highlighted")
    category: Optional[str] = Field(None, description="Category for grouping")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class SearchSuggestionsRequest(BaseModel):
    """Request for search suggestions."""
    query: str = Field(..., min_length=1, description="Partial search query")
    limit: int = Field(10, ge=1, le=50, description="Maximum suggestions per type")
    types: Optional[List[str]] = Field(
        None,
        description="Types to include",
        example=["recipe", "ingredient", "tag", "category", "author"]
    )
    include_popular: bool = Field(True, description="Include popular items if query is short")


class SearchSuggestionsResponse(BaseModel):
    """Response with search suggestions."""
    suggestions: List[SearchSuggestion]
    query: str
    total: int


class PopularSearch(BaseModel):
    """Popular search term."""
    term: str
    count: int = Field(..., description="Number of times searched")
    trend: Optional[str] = Field(None, description="Trend direction", example="up")
    trend_percentage: Optional[float] = Field(None, description="Trend percentage change")


class TrendingRecipe(BaseModel):
    """Trending recipe item."""
    id: UUID
    name: str
    description: Optional[str]
    author_username: str
    primary_image_url: Optional[str]
    rating_average: Optional[Decimal]
    view_count: int
    view_growth: float = Field(..., description="View growth percentage")
    fork_count: int
    created_at: datetime
    trending_score: float = Field(..., description="Calculated trending score")


class PopularSearchesResponse(BaseModel):
    """Response with popular searches and trending recipes."""
    popular_searches: List[PopularSearch]
    trending_recipes: List[TrendingRecipe]
    trending_tags: List[Dict[str, Any]]
    trending_categories: List[Dict[str, Any]]
    time_period: str = Field(..., description="Time period for trends", example="last_24_hours")
    generated_at: datetime


class FilterOption(BaseModel):
    """Individual filter option."""
    value: Any = Field(..., description="Filter value")
    label: str = Field(..., description="Display label")
    count: Optional[int] = Field(None, description="Number of recipes matching this filter")
    description: Optional[str] = Field(None, description="Additional description")


class FilterGroup(BaseModel):
    """Group of related filter options."""
    name: str = Field(..., description="Filter group name")
    type: str = Field(..., description="Filter type", example="select")
    options: List[FilterOption]
    multiple: bool = Field(False, description="Allow multiple selections")
    required: bool = Field(False, description="Is this filter required")


class SearchFiltersResponse(BaseModel):
    """Available search filters and options."""
    filter_groups: List[FilterGroup]
    total_recipes: int = Field(..., description="Total searchable recipes")
    
    # Quick stats
    stats: Dict[str, Any] = Field(
        ...,
        description="Quick statistics",
        example={
            "avg_prep_time": 25,
            "avg_cook_time": 35,
            "avg_rating": 4.2,
            "total_categories": 15,
            "total_tags": 250
        }
    )


class SimilarRecipeRequest(BaseModel):
    """Request for similar recipes."""
    limit: int = Field(10, ge=1, le=50, description="Maximum number of similar recipes")
    include_same_author: bool = Field(False, description="Include recipes from same author")
    boost_same_category: bool = Field(True, description="Boost recipes in same category")
    min_similarity_score: float = Field(0.5, ge=0, le=1, description="Minimum similarity score")


class SimilarRecipe(BaseModel):
    """Similar recipe item."""
    id: UUID
    name: str
    description: Optional[str]
    similarity_score: float = Field(..., ge=0, le=1, description="Similarity score (0-1)")
    similarity_reasons: List[str] = Field(..., description="Why this recipe is similar")
    author_username: str
    primary_image_url: Optional[str]
    rating_average: Optional[Decimal]
    difficulty_level: Optional[str]
    total_time_minutes: Optional[int]
    common_ingredients: int = Field(..., description="Number of common ingredients")
    common_tags: List[str] = Field(default_factory=list, description="Common tags")


class SimilarRecipesResponse(BaseModel):
    """Response with similar recipe recommendations."""
    original_recipe_id: UUID
    similar_recipes: List[SimilarRecipe]
    total: int
    
    # Recommendation metadata
    based_on: List[str] = Field(
        ...,
        description="Factors used for recommendations",
        example=["ingredients", "tags", "category", "cooking_method"]
    )


class SearchAnalyticsEvent(BaseModel):
    """Search analytics event for tracking."""
    session_id: str = Field(..., description="User session ID")
    user_id: Optional[UUID] = Field(None, description="User ID if authenticated")
    query: Optional[str] = Field(None, description="Search query")
    filters: Optional[Dict[str, Any]] = Field(None, description="Applied filters")
    result_count: int = Field(..., description="Number of results returned")
    clicked_position: Optional[int] = Field(None, description="Position of clicked result")
    clicked_recipe_id: Optional[UUID] = Field(None, description="ID of clicked recipe")
    search_time_ms: int = Field(..., description="Search execution time")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_agent: Optional[str] = Field(None, description="User agent string")
    ip_address: Optional[str] = Field(None, description="User IP address")