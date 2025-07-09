"""
Recipe schemas submodule for Jidelnicek 2.0.

This module exports all schemas from individual schema files.
"""

from .categorization import (
    # Category schemas
    CategoryBase,
    CategoryCreate,
    CategoryUpdate,
    CategoryInDB,
    CategoryTree,
    CategoryWithRecipes,
    
    # Tag schemas
    TagBase,
    TagCreate,
    TagUpdate,
    TagInDB,
    TagWithCount,
    TagCloud,
    
    # Assignment schemas
    RecipeCategoryAssignment,
    RecipeTagAssignment,
    RecipeCategorization,
    
    # Utility functions
    generate_slug,
)

from .recipe import (
    # Recipe image schemas
    RecipeImageBase,
    RecipeImageCreate,
    RecipeImageUpdate,
    RecipeImageResponse,
    
    # Recipe ingredient schemas
    RecipeIngredientBase,
    RecipeIngredientCreate,
    RecipeIngredientUpdate,
    RecipeIngredientResponse,
    
    # Recipe schemas
    RecipeBase,
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeListItem,
    RecipeListResponse,
    
    # Search and filter schemas
    RecipeSearchFilters,
    
    # Action schemas
    RecipeDuplicateRequest,
    RecipePublishRequest,
    RecipeForkRequest,
    RecipeStatsResponse,
)

from .search import (
    # Search enums
    SearchSortBy,
    SearchSortOrder,
    
    # Filter schemas
    NutritionFilter,
    FilterOption,
    FilterGroup,
    
    # Search request/response schemas
    AdvancedSearchRequest,
    SearchResponse,
    SearchResultItem,
    SearchFacet,
    SearchHighlight,
    
    # Suggestions schemas
    SearchSuggestion,
    SearchSuggestionsRequest,
    SearchSuggestionsResponse,
    
    # Popular/trending schemas
    PopularSearch,
    TrendingRecipe,
    PopularSearchesResponse,
    
    # Filter options schema
    SearchFiltersResponse,
    
    # Similar recipes schemas
    SimilarRecipeRequest,
    SimilarRecipe,
    SimilarRecipesResponse,
    
    # Analytics schema
    SearchAnalyticsEvent,
)

# Import additional schemas from the main schemas module
from .. import schemas as main_schemas

# Additional schemas that might be needed
RecipeSearch = getattr(main_schemas, 'RecipeSearch', None)
RecipeDetail = getattr(main_schemas, 'RecipeDetail', None)
RecipeVersionCreate = getattr(main_schemas, 'RecipeVersionCreate', None)
RecipeVersionResponse = getattr(main_schemas, 'RecipeVersionResponse', None)
RecipeVersionHistory = getattr(main_schemas, 'RecipeVersionHistory', None)
RecipeDuplicateResponse = getattr(main_schemas, 'RecipeDuplicateResponse', None)

__all__ = [
    # Category schemas
    "CategoryBase",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryInDB",
    "CategoryTree",
    "CategoryWithRecipes",
    
    # Tag schemas
    "TagBase",
    "TagCreate",
    "TagUpdate",
    "TagInDB",
    "TagWithCount",
    "TagCloud",
    
    # Assignment schemas
    "RecipeCategoryAssignment",
    "RecipeTagAssignment",
    "RecipeCategorization",
    
    # Utility functions
    "generate_slug",
    
    # Recipe image schemas
    "RecipeImageBase",
    "RecipeImageCreate",
    "RecipeImageUpdate",
    "RecipeImageResponse",
    
    # Recipe ingredient schemas
    "RecipeIngredientBase",
    "RecipeIngredientCreate",
    "RecipeIngredientUpdate",
    "RecipeIngredientResponse",
    
    # Recipe schemas
    "RecipeBase",
    "RecipeCreate",
    "RecipeUpdate",
    "RecipeResponse",
    "RecipeListItem",
    "RecipeListResponse",
    
    # Search and filter schemas
    "RecipeSearchFilters",
    
    # Action schemas
    "RecipeDuplicateRequest",
    "RecipePublishRequest",
    "RecipeForkRequest",
    "RecipeStatsResponse",
    
    # Search enums
    "SearchSortBy",
    "SearchSortOrder",
    
    # Filter schemas
    "NutritionFilter",
    "FilterOption",
    "FilterGroup",
    
    # Search request/response schemas
    "AdvancedSearchRequest",
    "SearchResponse",
    "SearchResultItem",
    "SearchFacet",
    "SearchHighlight",
    
    # Suggestions schemas
    "SearchSuggestion",
    "SearchSuggestionsRequest",
    "SearchSuggestionsResponse",
    
    # Popular/trending schemas
    "PopularSearch",
    "TrendingRecipe",
    "PopularSearchesResponse",
    
    # Filter options schema
    "SearchFiltersResponse",
    
    # Similar recipes schemas
    "SimilarRecipeRequest",
    "SimilarRecipe",
    "SimilarRecipesResponse",
    
    # Analytics schema
    "SearchAnalyticsEvent",
    
    # Additional schemas from main schemas module
    "RecipeSearch",
    "RecipeDetail",
    "RecipeVersionCreate",
    "RecipeVersionResponse", 
    "RecipeVersionHistory",
    "RecipeDuplicateResponse",
]