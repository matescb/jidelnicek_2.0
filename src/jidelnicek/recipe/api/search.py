"""
Recipe search API endpoints.

This module provides REST API endpoints for recipe search functionality.
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.database.session import get_db
from jidelnicek.core.cache.redis_cache import get_redis_cache, RedisCache
from jidelnicek.core.auth.dependencies import get_current_user_optional
from jidelnicek.core.database.models.user import User
from jidelnicek.recipe.services.search_service import (
    RecipeSearchService, SearchContext, SearchAnalyticsService
)
from jidelnicek.recipe.models.schemas import (
    RecipeSearchRequest, RecipeSearchResponse,
    DietaryRestriction, SortOption, TimeFilter, Difficulty,
    SearchInsights, SearchQualityMetrics
)


router = APIRouter(prefix="/api/v1/recipes", tags=["recipe-search"])


@router.post("/search", response_model=RecipeSearchResponse)
async def search_recipes(
    request: RecipeSearchRequest,
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Search recipes with advanced filtering and ranking.
    
    Features:
    - Full-text search across title, description, and instructions
    - Filter by ingredients (include/exclude with AND/OR logic)
    - Filter by nutritional ranges (calories, macros)
    - Filter by dietary restrictions
    - Filter by categories and tags
    - Filter by time and difficulty
    - Multiple sorting options
    - Faceted search results for filtering UI
    
    Returns paginated results with relevance scores and facets.
    """
    search_service = RecipeSearchService(db, cache)
    
    # Build search context
    context = SearchContext(
        query=request.query,
        filters={},
        sort_by=request.sort_by,
        page=request.page,
        page_size=request.page_size,
        user_id=current_user.id if current_user else None
    )
    
    # Add filters
    if request.ingredients:
        context.filters['ingredients'] = {
            'include': request.ingredients.include,
            'exclude': request.ingredients.exclude,
            'operator': request.ingredients.operator
        }
        
    if request.nutrition:
        nutrition_filter = {}
        for field in ['calories', 'protein', 'carbs', 'fat', 'fiber']:
            min_val = getattr(request.nutrition, f'{field}_min', None)
            max_val = getattr(request.nutrition, f'{field}_max', None)
            if min_val is not None:
                nutrition_filter[f'{field}_min'] = min_val
            if max_val is not None:
                nutrition_filter[f'{field}_max'] = max_val
        if nutrition_filter:
            context.filters['nutrition'] = nutrition_filter
            
    if request.dietary_restrictions:
        context.filters['dietary_restrictions'] = request.dietary_restrictions
        
    if request.categories:
        context.filters['categories'] = request.categories
        
    if request.tags:
        context.filters['tags'] = request.tags
        
    if request.time_filter:
        context.filters['time'] = request.time_filter
        
    if request.difficulty:
        context.filters['difficulty'] = request.difficulty
        
    if request.min_rating:
        context.filters['min_rating'] = request.min_rating
        
    # Execute search
    result = await search_service.search(context)
    
    # Build response
    total_pages = (result.total_count + result.page_size - 1) // result.page_size
    
    return RecipeSearchResponse(
        recipes=result.recipes,
        total_count=result.total_count,
        page=result.page,
        page_size=result.page_size,
        total_pages=total_pages,
        facets=result.facets,
        query_time_ms=result.query_time_ms
    )


@router.get("/search/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=2, description="Partial search query"),
    limit: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache)
):
    """
    Get search term suggestions based on partial input.
    
    Returns popular search terms that match the partial query.
    """
    search_service = RecipeSearchService(db, cache)
    suggestions = await search_service.suggest_search_terms(q, limit)
    
    return {"suggestions": suggestions}


@router.get("/search/popular")
async def get_popular_searches(
    limit: int = Query(10, ge=1, le=20),
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache)
):
    """
    Get popular search terms.
    
    Returns the most frequently searched terms over the specified time period.
    """
    search_service = RecipeSearchService(db, cache)
    popular_searches = await search_service.get_popular_searches(limit, days)
    
    return {"popular_searches": popular_searches}


@router.get("/search/insights", response_model=SearchInsights)
async def get_search_insights(
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache)
):
    """
    Get comprehensive search analytics insights.
    
    Includes:
    - Popular search terms
    - Searches with no results
    - Popular filters used
    - Search performance metrics
    
    This endpoint is typically restricted to admin users.
    """
    search_service = RecipeSearchService(db, cache)
    insights = await search_service.get_search_insights()
    
    return SearchInsights(**insights)


@router.get("/search/quality", response_model=SearchQualityMetrics)
async def get_search_quality_metrics(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache)
):
    """
    Get search quality metrics for optimization.
    
    Analyzes:
    - Search to action conversion rates
    - Click-through rates by position
    - Search refinement patterns
    - Session success metrics
    """
    analytics_service = SearchAnalyticsService(db, cache)
    metrics = await analytics_service.analyze_search_quality(days)
    
    return SearchQualityMetrics(**metrics)


@router.post("/search/optimize-index")
async def optimize_search_index(
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache)
):
    """
    Optimize database search indices.
    
    This should be run periodically to maintain search performance.
    Typically restricted to admin users.
    """
    search_service = RecipeSearchService(db, cache)
    await search_service.optimize_search_index()
    
    return {"message": "Search index optimization completed"}


# Advanced search examples
@router.get("/search/examples")
async def get_search_examples():
    """
    Get example search queries demonstrating advanced features.
    """
    examples = [
        {
            "description": "Quick vegan dinners under 400 calories",
            "query": {
                "query": "dinner",
                "dietary_restrictions": ["vegan"],
                "time_filter": "under_30",
                "nutrition": {
                    "calories_max": 400
                },
                "sort_by": "prep_time"
            }
        },
        {
            "description": "High-protein meals without chicken",
            "query": {
                "nutrition": {
                    "protein_min": 30
                },
                "ingredients": {
                    "exclude": [1],  # Assuming chicken ID is 1
                    "operator": "AND"
                },
                "sort_by": "calories"
            }
        },
        {
            "description": "Gluten-free breakfast recipes rated 4+ stars",
            "query": {
                "categories": [1],  # Assuming breakfast category ID is 1
                "dietary_restrictions": ["gluten_free"],
                "min_rating": 4.0,
                "sort_by": "rating"
            }
        },
        {
            "description": "Recipes with broccoli AND rice, excluding nuts",
            "query": {
                "ingredients": {
                    "include": [2, 3],  # Broccoli and rice IDs
                    "exclude": [4, 5],  # Various nut IDs
                    "operator": "AND"
                }
            }
        }
    ]
    
    return {"examples": examples}


# Personalized search
@router.get("/search/recommendations")
async def get_search_recommendations(
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis_cache),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get personalized search recommendations.
    
    Based on:
    - User's search history
    - Dietary preferences
    - Saved recipes
    - Popular searches (for anonymous users)
    """
    analytics_service = SearchAnalyticsService(db, cache)
    recommendations = await analytics_service.generate_search_recommendations(
        user_id=current_user.id if current_user else None
    )
    
    return {"recommendations": recommendations}