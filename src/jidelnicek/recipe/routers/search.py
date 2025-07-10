"""
Advanced search endpoints for recipes.

This module provides comprehensive search functionality including:
- Advanced search with multiple filters
- Search suggestions and autocomplete
- Popular searches and trending recipes
- Filter options and aggregations
- Similar recipe recommendations
- Search analytics tracking
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
import logging
from datetime import datetime, timedelta
from decimal import Decimal
import time
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, desc, asc, distinct, case, text
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.sql import exists

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.cache import cache_key_wrapper
from jidelnicek.core.dependencies import RedisClient
from jidelnicek.auth.dependencies.auth import get_current_user_optional
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.models.recipe_image import RecipeImage
from jidelnicek.recipe.models.categorization import (
    Category, Tag, RecipeCategory, RecipeTag
)
from jidelnicek.recipe.schemas.search import (
    AdvancedSearchRequest, SearchResponse, SearchResultItem, SearchFacet,
    SearchHighlight, SearchSuggestion, SearchSuggestionsRequest,
    SearchSuggestionsResponse, PopularSearchesResponse, PopularSearch,
    TrendingRecipe, SearchFiltersResponse, FilterGroup, FilterOption,
    SimilarRecipeRequest, SimilarRecipesResponse, SimilarRecipe,
    SearchAnalyticsEvent
)
from jidelnicek.recipe.schemas.categorization import generate_slug

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/recipes/search",
    tags=["recipe-search"],
    responses={404: {"description": "Not found"}},
)

# Cache TTLs
SEARCH_CACHE_TTL = 300  # 5 minutes
SUGGESTIONS_CACHE_TTL = 600  # 10 minutes
POPULAR_CACHE_TTL = 3600  # 1 hour
FILTERS_CACHE_TTL = 3600  # 1 hour
SIMILAR_CACHE_TTL = 1800  # 30 minutes


async def track_search_analytics(
    event: SearchAnalyticsEvent,
    db: AsyncSession,
    background_tasks: BackgroundTasks
):
    """Track search analytics in background."""
    try:
        # In production, this would send to analytics service
        logger.info(f"Search analytics: query='{event.query}', results={event.result_count}")
        
        # Update search term popularity
        if event.query:
            async with RedisClient() as redis_client:
                if redis_client:
                    key = f"search:popular:{datetime.utcnow().strftime('%Y%m%d')}"
                    await redis_client.zincrby(key, 1, event.query.lower())
                    await redis_client.expire(key, 86400 * 7)  # Keep for 7 days
    except Exception as e:
        logger.error(f"Error tracking search analytics: {e}")


async def build_advanced_search_query(
    request: AdvancedSearchRequest,
    user: Optional[AuthUser],
    db: AsyncSession
):
    """Build advanced search query with all filters."""
    stmt = select(Recipe).where(Recipe.is_archived == False)
    
    # Base visibility filter
    if user:
        stmt = stmt.where(
            or_(
                Recipe.user_id == user.id,
                Recipe.is_public == True
            )
        )
    else:
        stmt = stmt.where(Recipe.is_public == True)
    
    # Text search with field specification
    if request.query:
        search_term = f"%{request.query}%"
        search_conditions = []
        
        if not request.search_fields or "name" in request.search_fields:
            search_conditions.append(Recipe.name.ilike(search_term))
        if not request.search_fields or "description" in request.search_fields:
            search_conditions.append(Recipe.description.ilike(search_term))
        if not request.search_fields or "instructions" in request.search_fields:
            search_conditions.append(Recipe.instructions.ilike(search_term))
        
        if search_conditions:
            stmt = stmt.where(or_(*search_conditions))
    
    # Difficulty filter (multiple values)
    if request.difficulty_level:
        stmt = stmt.where(Recipe.difficulty_level.in_(request.difficulty_level))
    
    # Time filters
    if request.max_prep_time:
        stmt = stmt.where(Recipe.prep_time_minutes <= request.max_prep_time)
    if request.max_cook_time:
        stmt = stmt.where(Recipe.cook_time_minutes <= request.max_cook_time)
    if request.max_total_time:
        stmt = stmt.where(
            (Recipe.prep_time_minutes + Recipe.cook_time_minutes) <= request.max_total_time
        )
    
    # Servings filters
    if request.min_servings:
        stmt = stmt.where(Recipe.servings >= request.min_servings)
    if request.max_servings:
        stmt = stmt.where(Recipe.servings <= request.max_servings)
    
    # Status filters
    if request.is_public is not None:
        stmt = stmt.where(Recipe.is_public == request.is_public)
    if request.is_published is not None:
        stmt = stmt.where(Recipe.is_published == request.is_published)
    if request.is_forked is not None:
        stmt = stmt.where(Recipe.is_forked == request.is_forked)
    
    # Category filters
    if request.category_ids or request.category_slugs:
        category_conditions = []
        if request.category_ids:
            category_conditions.append(RecipeCategory.category_id.in_(request.category_ids))
        if request.category_slugs:
            cat_subquery = select(Category.id).where(Category.slug.in_(request.category_slugs))
            category_conditions.append(RecipeCategory.category_id.in_(cat_subquery))
        
        stmt = stmt.join(RecipeCategory).where(or_(*category_conditions))
    
    # Tag filters
    if request.tag_names or request.tag_slugs:
        tag_conditions = []
        if request.tag_names:
            tag_slugs = [generate_slug(tag) for tag in request.tag_names]
            tag_conditions.append(Tag.slug.in_(tag_slugs))
        if request.tag_slugs:
            tag_conditions.append(Tag.slug.in_(request.tag_slugs))
        
        stmt = stmt.join(RecipeTag).join(Tag).where(or_(*tag_conditions))
    
    # Ingredient filters
    if request.include_ingredients:
        for ingredient_name in request.include_ingredients:
            ingredient_subquery = (
                select(RecipeIngredient.recipe_id)
                .join(Ingredient)
                .where(Ingredient.name.ilike(f"%{ingredient_name}%"))
            )
            stmt = stmt.where(Recipe.id.in_(ingredient_subquery))
    
    if request.exclude_ingredients:
        for ingredient_name in request.exclude_ingredients:
            ingredient_subquery = (
                select(RecipeIngredient.recipe_id)
                .join(Ingredient)
                .where(Ingredient.name.ilike(f"%{ingredient_name}%"))
            )
            stmt = stmt.where(~Recipe.id.in_(ingredient_subquery))
    
    # Ingredient count filters
    if request.ingredient_count_min or request.ingredient_count_max:
        ingredient_count_subquery = (
            select(
                RecipeIngredient.recipe_id,
                func.count(RecipeIngredient.id).label('ingredient_count')
            )
            .group_by(RecipeIngredient.recipe_id)
            .subquery()
        )
        stmt = stmt.join(
            ingredient_count_subquery,
            Recipe.id == ingredient_count_subquery.c.recipe_id
        )
        
        if request.ingredient_count_min:
            stmt = stmt.where(
                ingredient_count_subquery.c.ingredient_count >= request.ingredient_count_min
            )
        if request.ingredient_count_max:
            stmt = stmt.where(
                ingredient_count_subquery.c.ingredient_count <= request.ingredient_count_max
            )
    
    # Author filters
    if request.author_id:
        stmt = stmt.where(Recipe.user_id == request.author_id)
    if request.author_username:
        user_subquery = select(AuthUser.id).where(
            AuthUser.username.ilike(f"%{request.author_username}%")
        )
        stmt = stmt.where(Recipe.user_id.in_(user_subquery))
    
    # Social filters
    if request.has_images is not None:
        if request.has_images:
            stmt = stmt.join(RecipeImage)
        else:
            stmt = stmt.outerjoin(RecipeImage).where(RecipeImage.id.is_(None))
    
    if request.min_rating:
        stmt = stmt.where(Recipe.rating_average >= request.min_rating)
    if request.min_view_count:
        stmt = stmt.where(Recipe.view_count >= request.min_view_count)
    if request.min_fork_count:
        stmt = stmt.where(Recipe.fork_count >= request.min_fork_count)
    
    # Date filters
    if request.created_after:
        stmt = stmt.where(Recipe.created_at >= request.created_after)
    if request.created_before:
        stmt = stmt.where(Recipe.created_at <= request.created_before)
    if request.updated_after:
        stmt = stmt.where(Recipe.updated_at >= request.updated_after)
    if request.updated_before:
        stmt = stmt.where(Recipe.updated_at <= request.updated_before)
    if request.published_after:
        stmt = stmt.where(Recipe.published_at >= request.published_after)
    if request.published_before:
        stmt = stmt.where(Recipe.published_at <= request.published_before)
    
    # Make query distinct to avoid duplicates from joins
    stmt = stmt.distinct()
    
    return stmt


async def calculate_search_facets(
    base_query,
    db: AsyncSession
) -> Dict[str, SearchFacet]:
    """Calculate facets for search results."""
    facets = {}
    
    # Category facet
    category_facet_query = (
        select(
            Category.id,
            Category.name,
            Category.slug,
            func.count(distinct(Recipe.id)).label('count')
        )
        .select_from(base_query.subquery())
        .join(RecipeCategory, Recipe.id == RecipeCategory.recipe_id)
        .join(Category, RecipeCategory.category_id == Category.id)
        .group_by(Category.id, Category.name, Category.slug)
        .order_by(desc('count'))
        .limit(10)
    )
    category_result = await db.execute(category_facet_query)
    category_values = [
        {
            "id": str(row.id),
            "name": row.name,
            "slug": row.slug,
            "count": row.count
        }
        for row in category_result
    ]
    
    if category_values:
        facets["categories"] = SearchFacet(
            name="categories",
            values=category_values,
            total=len(category_values)
        )
    
    # Difficulty facet
    difficulty_facet_query = (
        select(
            Recipe.difficulty_level,
            func.count(distinct(Recipe.id)).label('count')
        )
        .select_from(base_query.subquery())
        .where(Recipe.difficulty_level.isnot(None))
        .group_by(Recipe.difficulty_level)
        .order_by(desc('count'))
    )
    difficulty_result = await db.execute(difficulty_facet_query)
    difficulty_values = [
        {
            "value": row.difficulty_level,
            "count": row.count
        }
        for row in difficulty_result
    ]
    
    if difficulty_values:
        facets["difficulty_level"] = SearchFacet(
            name="difficulty_level",
            values=difficulty_values,
            total=len(difficulty_values)
        )
    
    # Tag facet (top 20)
    tag_facet_query = (
        select(
            Tag.name,
            Tag.slug,
            func.count(distinct(Recipe.id)).label('count')
        )
        .select_from(base_query.subquery())
        .join(RecipeTag, Recipe.id == RecipeTag.recipe_id)
        .join(Tag, RecipeTag.tag_id == Tag.id)
        .group_by(Tag.name, Tag.slug)
        .order_by(desc('count'))
        .limit(20)
    )
    tag_result = await db.execute(tag_facet_query)
    tag_values = [
        {
            "name": row.name,
            "slug": row.slug,
            "count": row.count
        }
        for row in tag_result
    ]
    
    if tag_values:
        facets["tags"] = SearchFacet(
            name="tags",
            values=tag_values,
            total=len(tag_values)
        )
    
    return facets


def calculate_relevance_score(recipe: Recipe, request: AdvancedSearchRequest) -> float:
    """Calculate relevance score for a recipe."""
    score = 0.0
    
    if request.query:
        query_lower = request.query.lower()
        # Name match (highest weight)
        if query_lower in recipe.name.lower():
            score += 10.0
            if recipe.name.lower().startswith(query_lower):
                score += 5.0
        
        # Description match
        if recipe.description and query_lower in recipe.description.lower():
            score += 3.0
        
        # Instructions match
        if recipe.instructions and query_lower in recipe.instructions.lower():
            score += 1.0
    
    # Boost by popularity
    if recipe.rating_average:
        score += float(recipe.rating_average) * 0.5
    
    if recipe.view_count > 0:
        score += min(recipe.view_count / 1000, 2.0)  # Cap at 2 points
    
    if recipe.fork_count > 0:
        score += min(recipe.fork_count / 10, 1.0)  # Cap at 1 point
    
    # Boost recent recipes if enabled
    if request.boost_recent:
        days_old = (datetime.utcnow() - recipe.created_at).days
        if days_old < 7:
            score += 2.0
        elif days_old < 30:
            score += 1.0
    
    return score


# =============================================================================
# Main Search Endpoints
# =============================================================================

@router.post("/", response_model=SearchResponse)
async def advanced_search(
    request: AdvancedSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Advanced recipe search with comprehensive filtering.
    
    Features:
    - Full-text search across multiple fields
    - Multiple filter combinations
    - Faceted search results
    - Relevance scoring
    - Search analytics tracking
    - Result caching for performance
    """
    start_time = time.time()
    
    try:
        # Build search query
        stmt = await build_advanced_search_query(request, current_user, db)
        
        # Apply sorting
        if request.sort_by == "relevance" and request.query:
            # For relevance sorting, we'll calculate scores after fetching
            stmt = stmt.order_by(desc(Recipe.view_count))
        else:
            sort_field = getattr(Recipe, request.sort_by.value, Recipe.created_at)
            if request.sort_order.value == "asc":
                stmt = stmt.order_by(asc(sort_field))
            else:
                stmt = stmt.order_by(desc(sort_field))
        
        # Get total count
        count_stmt = select(func.count(distinct(Recipe.id))).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0
        
        # Calculate facets if requested
        facets = None
        if request.include_facets and total > 0:
            facets = await calculate_search_facets(stmt, db)
        
        # Apply pagination
        offset = (request.page - 1) * request.page_size
        paginated_stmt = stmt.offset(offset).limit(request.page_size)
        
        # Load related data efficiently
        paginated_stmt = paginated_stmt.options(
            selectinload(Recipe.images),
            selectinload(Recipe.ingredients),
            selectinload(Recipe.recipe_categories).selectinload(RecipeCategory.category),
            selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag),
            joinedload(Recipe.user)
        )
        
        result = await db.execute(paginated_stmt)
        recipes = result.unique().scalars().all()
        
        # Build search results
        items = []
        for recipe in recipes:
            # Calculate relevance score if sorting by relevance
            score = None
            if request.sort_by == "relevance" and request.query:
                score = calculate_relevance_score(recipe, request)
            
            # Get primary image
            primary_image = next(
                (img for img in recipe.images if img.is_primary),
                recipe.images[0] if recipe.images else None
            )
            
            # Get categories (top 3)
            categories = [
                {
                    "id": str(rc.category.id),
                    "name": rc.category.name,
                    "slug": rc.category.slug,
                    "is_primary": rc.is_primary
                }
                for rc in sorted(
                    recipe.recipe_categories,
                    key=lambda x: (not x.is_primary, x.created_at)
                )[:3]
            ]
            
            # Get tags (top 5)
            tags = [
                rt.tag.name
                for rt in sorted(
                    recipe.recipe_tags,
                    key=lambda x: x.created_at
                )[:5]
            ]
            
            # Build highlights if requested
            highlights = None
            if request.highlight_fields and request.query:
                highlights = []
                query_lower = request.query.lower()
                
                if query_lower in recipe.name.lower():
                    highlights.append(SearchHighlight(
                        field="name",
                        snippet=recipe.name,
                        highlights=[request.query]
                    ))
                
                if recipe.description and query_lower in recipe.description.lower():
                    # Extract snippet around match
                    idx = recipe.description.lower().find(query_lower)
                    start = max(0, idx - 50)
                    end = min(len(recipe.description), idx + len(request.query) + 50)
                    snippet = recipe.description[start:end]
                    if start > 0:
                        snippet = "..." + snippet
                    if end < len(recipe.description):
                        snippet = snippet + "..."
                    
                    highlights.append(SearchHighlight(
                        field="description",
                        snippet=snippet,
                        highlights=[request.query]
                    ))
            
            item = SearchResultItem(
                id=recipe.id,
                score=score,
                name=recipe.name,
                description=recipe.description,
                difficulty_level=recipe.difficulty_level,
                prep_time_minutes=recipe.prep_time_minutes,
                cook_time_minutes=recipe.cook_time_minutes,
                total_time_minutes=recipe.total_time_minutes,
                servings=recipe.servings,
                rating_average=recipe.rating_average,
                rating_count=recipe.rating_count,
                view_count=recipe.view_count,
                fork_count=recipe.fork_count,
                is_public=recipe.is_public,
                is_published=recipe.is_published,
                is_forked=recipe.is_forked,
                created_at=recipe.created_at,
                updated_at=recipe.updated_at,
                author_id=recipe.user_id,
                author_username=recipe.user.username if recipe.user else "Unknown",
                author_avatar_url=recipe.user.avatar_url if recipe.user else None,
                primary_image_url=primary_image.image_url if primary_image else None,
                primary_image_thumbnail_url=primary_image.thumbnail_url if primary_image else None,
                ingredient_count=len(recipe.ingredients),
                image_count=len(recipe.images),
                category_count=len(recipe.recipe_categories),
                tag_count=len(recipe.recipe_tags),
                categories=categories,
                tags=tags,
                calories_per_serving=None,  # TODO: Calculate from nutrition
                highlights=highlights
            )
            items.append(item)
        
        # Sort by relevance score if needed
        if request.sort_by == "relevance" and request.query:
            items.sort(key=lambda x: x.score or 0, reverse=True)
        
        # Calculate search time
        search_time_ms = int((time.time() - start_time) * 1000)
        
        # Track analytics
        if current_user or request.query:
            analytics_event = SearchAnalyticsEvent(
                session_id="session_" + str(current_user.id if current_user else "anonymous"),
                user_id=current_user.id if current_user else None,
                query=request.query,
                filters=request.model_dump(exclude={"page", "page_size", "sort_by", "sort_order"}),
                result_count=total,
                search_time_ms=search_time_ms
            )
            background_tasks.add_task(track_search_analytics, analytics_event, db, background_tasks)
        
        # Calculate pagination
        total_pages = (total + request.page_size - 1) // request.page_size
        
        return SearchResponse(
            items=items,
            total=total,
            page=request.page,
            page_size=request.page_size,
            total_pages=total_pages,
            has_next=request.page < total_pages,
            has_prev=request.page > 1,
            query=request.query,
            search_time_ms=search_time_ms,
            facets=facets,
            did_you_mean=None,  # TODO: Implement spell checking
            related_searches=None  # TODO: Implement related searches
        )
        
    except Exception as e:
        logger.error(f"Error in advanced search: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed"
        )


@router.post("/suggestions", response_model=SearchSuggestionsResponse)
@cache_key_wrapper(prefix="search:suggestions", ttl=SUGGESTIONS_CACHE_TTL)
async def search_suggestions(
    request: SearchSuggestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get search suggestions and autocomplete.
    
    Returns suggestions for:
    - Recipe names
    - Ingredients
    - Tags
    - Categories
    - Authors
    
    Includes popular items for short queries.
    """
    suggestions = []
    query_lower = request.query.lower()
    
    # Include all types if not specified
    if not request.types:
        request.types = ["recipe", "ingredient", "tag", "category", "author"]
    
    # Recipe suggestions
    if "recipe" in request.types:
        recipe_stmt = (
            select(Recipe.id, Recipe.name)
            .where(
                and_(
                    Recipe.is_archived == False,
                    Recipe.is_public == True,
                    Recipe.name.ilike(f"{query_lower}%")
                )
            )
            .order_by(desc(Recipe.view_count))
            .limit(request.limit)
        )
        
        recipe_result = await db.execute(recipe_stmt)
        for recipe_id, recipe_name in recipe_result:
            suggestions.append(SearchSuggestion(
                type="recipe",
                id=recipe_id,
                text=recipe_name,
                highlight=recipe_name,  # TODO: Implement highlighting
                category="Recipes"
            ))
    
    # Ingredient suggestions
    if "ingredient" in request.types:
        ingredient_stmt = (
            select(Ingredient.id, Ingredient.name)
            .where(Ingredient.name.ilike(f"{query_lower}%"))
            .order_by(Ingredient.name)
            .limit(request.limit)
        )
        
        ingredient_result = await db.execute(ingredient_stmt)
        for ing_id, ing_name in ingredient_result:
            suggestions.append(SearchSuggestion(
                type="ingredient",
                id=ing_id,
                text=ing_name,
                highlight=ing_name,
                category="Ingredients"
            ))
    
    # Tag suggestions
    if "tag" in request.types:
        tag_stmt = (
            select(Tag.name, Tag.slug, Tag.usage_count)
            .where(Tag.name.ilike(f"{query_lower}%"))
            .order_by(desc(Tag.usage_count))
            .limit(request.limit)
        )
        
        tag_result = await db.execute(tag_stmt)
        for tag_name, tag_slug, usage_count in tag_result:
            suggestions.append(SearchSuggestion(
                type="tag",
                text=tag_name,
                highlight=tag_name,
                category="Tags",
                metadata={"slug": tag_slug, "usage_count": usage_count}
            ))
    
    # Category suggestions
    if "category" in request.types:
        category_stmt = (
            select(Category.id, Category.name, Category.slug)
            .where(Category.name.ilike(f"{query_lower}%"))
            .order_by(Category.display_order, Category.name)
            .limit(request.limit)
        )
        
        category_result = await db.execute(category_stmt)
        for cat_id, cat_name, cat_slug in category_result:
            suggestions.append(SearchSuggestion(
                type="category",
                id=cat_id,
                text=cat_name,
                highlight=cat_name,
                category="Categories",
                metadata={"slug": cat_slug}
            ))
    
    # Author suggestions
    if "author" in request.types and len(query_lower) >= 2:
        author_stmt = (
            select(AuthUser.id, AuthUser.username)
            .join(Recipe, Recipe.user_id == AuthUser.id)
            .where(
                and_(
                    AuthUser.username.ilike(f"{query_lower}%"),
                    Recipe.is_public == True
                )
            )
            .group_by(AuthUser.id, AuthUser.username)
            .having(func.count(Recipe.id) > 0)
            .order_by(desc(func.count(Recipe.id)))
            .limit(request.limit)
        )
        
        author_result = await db.execute(author_stmt)
        for author_id, username in author_result:
            suggestions.append(SearchSuggestion(
                type="author",
                id=author_id,
                text=username,
                highlight=username,
                category="Authors"
            ))
    
    # Include popular items for short queries
    if request.include_popular and len(query_lower) < 3:
        # Add popular tags
        popular_tags_stmt = (
            select(Tag.name, Tag.slug, Tag.usage_count)
            .where(Tag.usage_count > 10)
            .order_by(desc(Tag.usage_count))
            .limit(5)
        )
        
        popular_tags_result = await db.execute(popular_tags_stmt)
        for tag_name, tag_slug, usage_count in popular_tags_result:
            if not any(s.text == tag_name for s in suggestions):
                suggestions.append(SearchSuggestion(
                    type="tag",
                    text=tag_name,
                    highlight=tag_name,
                    category="Popular Tags",
                    metadata={"slug": tag_slug, "usage_count": usage_count}
                ))
    
    return SearchSuggestionsResponse(
        suggestions=suggestions[:request.limit * len(request.types)],
        query=request.query,
        total=len(suggestions)
    )


@router.get("/popular", response_model=PopularSearchesResponse)
@cache_key_wrapper(prefix="search:popular", ttl=POPULAR_CACHE_TTL)
async def get_popular_searches(
    time_period: str = Query("last_24_hours", regex="^(last_24_hours|last_7_days|last_30_days)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get popular searches and trending recipes.
    
    Returns:
    - Popular search terms
    - Trending recipes based on views and forks
    - Trending tags
    - Trending categories
    """
    # Calculate time window
    time_windows = {
        "last_24_hours": timedelta(days=1),
        "last_7_days": timedelta(days=7),
        "last_30_days": timedelta(days=30)
    }
    time_window = time_windows[time_period]
    cutoff_date = datetime.utcnow() - time_window
    
    # Get popular search terms from Redis
    popular_searches = []
    async with RedisClient() as redis_client:
        if redis_client:
            try:
                # Get search terms for the period
                date_keys = []
                current_date = datetime.utcnow()
                for i in range(time_window.days):
                    date = current_date - timedelta(days=i)
                    date_keys.append(f"search:popular:{date.strftime('%Y%m%d')}")
                
                # Aggregate search counts
                search_counts = Counter()
                for key in date_keys:
                    terms = await redis_client.zrevrange(key, 0, 50, withscores=True)
                    for term, count in terms:
                        search_counts[term.decode()] += int(count)
                
                # Get top search terms
                for term, count in search_counts.most_common(10):
                    popular_searches.append(PopularSearch(
                        term=term,
                        count=count,
                        trend="up" if count > 10 else "stable",
                        trend_percentage=None  # TODO: Calculate trend
                    ))
            except Exception as e:
                logger.error(f"Error getting popular searches from Redis: {e}")
    
    # Get trending recipes
    trending_recipes_stmt = (
        select(
            Recipe,
            func.count(distinct(RecipeImage.id)).label('image_count')
        )
        .outerjoin(RecipeImage)
        .where(
            and_(
                Recipe.is_archived == False,
                Recipe.is_public == True,
                Recipe.created_at >= cutoff_date
            )
        )
        .group_by(Recipe.id)
        .order_by(
            desc(Recipe.view_count + Recipe.fork_count * 10)  # Weight forks higher
        )
        .limit(10)
    )
    
    trending_result = await db.execute(trending_recipes_stmt)
    trending_recipes = []
    
    for row in trending_result:
        recipe = row.Recipe
        
        # Calculate trending score
        age_hours = (datetime.utcnow() - recipe.created_at).total_seconds() / 3600
        trending_score = (recipe.view_count + recipe.fork_count * 10) / max(age_hours, 1)
        
        # Get primary image
        primary_image_stmt = select(RecipeImage).where(
            and_(
                RecipeImage.recipe_id == recipe.id,
                RecipeImage.is_primary == True
            )
        ).limit(1)
        image_result = await db.execute(primary_image_stmt)
        primary_image = image_result.scalar_one_or_none()
        
        trending_recipes.append(TrendingRecipe(
            id=recipe.id,
            name=recipe.name,
            description=recipe.description,
            author_username="Unknown",  # TODO: Load author
            primary_image_url=primary_image.image_url if primary_image else None,
            rating_average=recipe.rating_average,
            view_count=recipe.view_count,
            view_growth=0.0,  # TODO: Calculate growth
            fork_count=recipe.fork_count,
            created_at=recipe.created_at,
            trending_score=trending_score
        ))
    
    # Get trending tags
    trending_tags_stmt = (
        select(
            Tag.name,
            Tag.slug,
            func.count(RecipeTag.recipe_id).label('recipe_count')
        )
        .join(RecipeTag)
        .join(Recipe)
        .where(
            and_(
                Recipe.created_at >= cutoff_date,
                Recipe.is_public == True
            )
        )
        .group_by(Tag.id, Tag.name, Tag.slug)
        .order_by(desc('recipe_count'))
        .limit(10)
    )
    
    trending_tags_result = await db.execute(trending_tags_stmt)
    trending_tags = [
        {
            "name": row.name,
            "slug": row.slug,
            "recipe_count": row.recipe_count
        }
        for row in trending_tags_result
    ]
    
    # Get trending categories
    trending_categories_stmt = (
        select(
            Category.id,
            Category.name,
            Category.slug,
            func.count(RecipeCategory.recipe_id).label('recipe_count')
        )
        .join(RecipeCategory)
        .join(Recipe)
        .where(
            and_(
                Recipe.created_at >= cutoff_date,
                Recipe.is_public == True
            )
        )
        .group_by(Category.id, Category.name, Category.slug)
        .order_by(desc('recipe_count'))
        .limit(5)
    )
    
    trending_categories_result = await db.execute(trending_categories_stmt)
    trending_categories = [
        {
            "id": str(row.id),
            "name": row.name,
            "slug": row.slug,
            "recipe_count": row.recipe_count
        }
        for row in trending_categories_result
    ]
    
    return PopularSearchesResponse(
        popular_searches=popular_searches,
        trending_recipes=trending_recipes,
        trending_tags=trending_tags,
        trending_categories=trending_categories,
        time_period=time_period,
        generated_at=datetime.utcnow()
    )


@router.get("/filters", response_model=SearchFiltersResponse)
@cache_key_wrapper(prefix="search:filters", ttl=FILTERS_CACHE_TTL)
async def get_search_filters(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get available filter options for search.
    
    Returns:
    - Categories with counts
    - Difficulty levels with counts
    - Time ranges
    - Dietary preferences
    - Other filter options
    """
    filter_groups = []
    
    # Base query for public recipes
    base_query = select(Recipe).where(
        and_(
            Recipe.is_archived == False,
            Recipe.is_public == True
        )
    )
    
    # Get total recipe count
    total_stmt = select(func.count(Recipe.id)).select_from(base_query.subquery())
    total_result = await db.execute(total_stmt)
    total_recipes = total_result.scalar() or 0
    
    # Categories filter group
    category_stmt = (
        select(
            Category.id,
            Category.name,
            Category.slug,
            Category.description,
            func.count(distinct(RecipeCategory.recipe_id)).label('count')
        )
        .join(RecipeCategory)
        .join(Recipe)
        .where(
            and_(
                Recipe.is_archived == False,
                Recipe.is_public == True
            )
        )
        .group_by(Category.id, Category.name, Category.slug, Category.description)
        .order_by(Category.display_order, Category.name)
    )
    
    category_result = await db.execute(category_stmt)
    category_options = [
        FilterOption(
            value=str(row.id),
            label=row.name,
            count=row.count,
            description=row.description
        )
        for row in category_result
    ]
    
    if category_options:
        filter_groups.append(FilterGroup(
            name="categories",
            type="select",
            options=category_options,
            multiple=True,
            required=False
        ))
    
    # Difficulty level filter group
    difficulty_stmt = (
        select(
            Recipe.difficulty_level,
            func.count(Recipe.id).label('count')
        )
        .where(
            and_(
                Recipe.is_archived == False,
                Recipe.is_public == True,
                Recipe.difficulty_level.isnot(None)
            )
        )
        .group_by(Recipe.difficulty_level)
        .order_by(Recipe.difficulty_level)
    )
    
    difficulty_result = await db.execute(difficulty_stmt)
    difficulty_options = [
        FilterOption(
            value=row.difficulty_level,
            label=row.difficulty_level.capitalize(),
            count=row.count
        )
        for row in difficulty_result
    ]
    
    if difficulty_options:
        filter_groups.append(FilterGroup(
            name="difficulty_level",
            type="select",
            options=difficulty_options,
            multiple=True,
            required=False
        ))
    
    # Time ranges filter group
    time_ranges = [
        FilterOption(value=15, label="Under 15 minutes"),
        FilterOption(value=30, label="Under 30 minutes"),
        FilterOption(value=60, label="Under 1 hour"),
        FilterOption(value=120, label="Under 2 hours")
    ]
    
    filter_groups.append(FilterGroup(
        name="max_total_time",
        type="select",
        options=time_ranges,
        multiple=False,
        required=False
    ))
    
    # Serving size filter group
    serving_ranges = [
        FilterOption(value={"min": 1, "max": 2}, label="1-2 servings"),
        FilterOption(value={"min": 3, "max": 4}, label="3-4 servings"),
        FilterOption(value={"min": 5, "max": 8}, label="5-8 servings"),
        FilterOption(value={"min": 9, "max": None}, label="9+ servings")
    ]
    
    filter_groups.append(FilterGroup(
        name="servings",
        type="range",
        options=serving_ranges,
        multiple=False,
        required=False
    ))
    
    # Dietary preferences filter group
    dietary_tags = ["vegan", "vegetarian", "gluten-free", "dairy-free", "keto", "paleo", "sugar-free"]
    dietary_stmt = (
        select(
            Tag.name,
            Tag.slug,
            func.count(distinct(RecipeTag.recipe_id)).label('count')
        )
        .join(RecipeTag)
        .join(Recipe)
        .where(
            and_(
                Recipe.is_archived == False,
                Recipe.is_public == True,
                Tag.slug.in_([generate_slug(tag) for tag in dietary_tags])
            )
        )
        .group_by(Tag.name, Tag.slug)
        .order_by(Tag.name)
    )
    
    dietary_result = await db.execute(dietary_stmt)
    dietary_options = [
        FilterOption(
            value=row.slug,
            label=row.name,
            count=row.count
        )
        for row in dietary_result
    ]
    
    if dietary_options:
        filter_groups.append(FilterGroup(
            name="dietary_preferences",
            type="checkbox",
            options=dietary_options,
            multiple=True,
            required=False
        ))
    
    # Calculate statistics
    stats_stmt = (
        select(
            func.avg(Recipe.prep_time_minutes).label('avg_prep_time'),
            func.avg(Recipe.cook_time_minutes).label('avg_cook_time'),
            func.avg(Recipe.rating_average).label('avg_rating'),
            func.count(distinct(Category.id)).label('total_categories'),
            func.count(distinct(Tag.id)).label('total_tags')
        )
        .select_from(Recipe)
        .outerjoin(RecipeCategory)
        .outerjoin(Category)
        .outerjoin(RecipeTag)
        .outerjoin(Tag)
        .where(
            and_(
                Recipe.is_archived == False,
                Recipe.is_public == True
            )
        )
    )
    
    stats_result = await db.execute(stats_stmt)
    stats_row = stats_result.one()
    
    stats = {
        "avg_prep_time": int(stats_row.avg_prep_time or 0),
        "avg_cook_time": int(stats_row.avg_cook_time or 0),
        "avg_rating": float(stats_row.avg_rating or 0),
        "total_categories": stats_row.total_categories or 0,
        "total_tags": stats_row.total_tags or 0
    }
    
    return SearchFiltersResponse(
        filter_groups=filter_groups,
        total_recipes=total_recipes,
        stats=stats
    )


@router.get("/similar/{recipe_id}", response_model=SimilarRecipesResponse)
@cache_key_wrapper(prefix="search:similar", ttl=SIMILAR_CACHE_TTL)
async def get_similar_recipes(
    recipe_id: UUID,
    request: SimilarRecipeRequest = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get similar recipe recommendations.
    
    Similarity is based on:
    - Common ingredients
    - Common tags
    - Same category
    - Similar difficulty level
    - Similar cooking time
    """
    # Get the original recipe with all data
    original_stmt = (
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
            selectinload(Recipe.recipe_categories).selectinload(RecipeCategory.category),
            selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag)
        )
    )
    
    original_result = await db.execute(original_stmt)
    original_recipe = original_result.scalar_one_or_none()
    
    if not original_recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check access permissions
    if not original_recipe.is_public and (not current_user or original_recipe.user_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Get ingredient IDs
    original_ingredient_ids = [ri.ingredient_id for ri in original_recipe.ingredients]
    
    # Get tag slugs
    original_tag_slugs = [rt.tag.slug for rt in original_recipe.recipe_tags]
    
    # Get category IDs
    original_category_ids = [rc.category_id for rc in original_recipe.recipe_categories]
    
    # Build similar recipes query
    similar_stmt = (
        select(
            Recipe,
            func.count(distinct(RecipeIngredient.ingredient_id)).label('common_ingredients')
        )
        .outerjoin(RecipeIngredient)
        .where(
            and_(
                Recipe.id != recipe_id,
                Recipe.is_archived == False,
                Recipe.is_public == True,
                or_(
                    request.include_same_author,
                    Recipe.user_id != original_recipe.user_id
                )
            )
        )
        .group_by(Recipe.id)
    )
    
    # Filter by common ingredients
    if original_ingredient_ids:
        similar_stmt = similar_stmt.where(
            RecipeIngredient.ingredient_id.in_(original_ingredient_ids)
        )
    
    # Load related data
    similar_stmt = similar_stmt.options(
        selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag),
        selectinload(Recipe.recipe_categories).selectinload(RecipeCategory.category),
        selectinload(Recipe.images),
        joinedload(Recipe.user)
    )
    
    similar_result = await db.execute(similar_stmt)
    similar_recipes_data = list(similar_result)
    
    # Calculate similarity scores and build results
    scored_recipes = []
    
    for row in similar_recipes_data:
        recipe = row.Recipe
        common_ingredients = row.common_ingredients
        
        # Calculate similarity score
        score = 0.0
        reasons = []
        
        # Ingredient similarity (40% weight)
        if original_ingredient_ids:
            ingredient_similarity = common_ingredients / len(original_ingredient_ids)
            score += ingredient_similarity * 0.4
            if common_ingredients > 0:
                reasons.append(f"{common_ingredients} common ingredients")
        
        # Tag similarity (30% weight)
        recipe_tag_slugs = [rt.tag.slug for rt in recipe.recipe_tags]
        common_tags = set(original_tag_slugs) & set(recipe_tag_slugs)
        if original_tag_slugs:
            tag_similarity = len(common_tags) / len(original_tag_slugs)
            score += tag_similarity * 0.3
            if common_tags:
                reasons.append(f"Similar tags: {', '.join(list(common_tags)[:3])}")
        
        # Category similarity (20% weight)
        recipe_category_ids = [rc.category_id for rc in recipe.recipe_categories]
        if request.boost_same_category and original_category_ids:
            if any(cat_id in recipe_category_ids for cat_id in original_category_ids):
                score += 0.2
                reasons.append("Same category")
        
        # Difficulty similarity (5% weight)
        if original_recipe.difficulty_level == recipe.difficulty_level:
            score += 0.05
            reasons.append("Same difficulty level")
        
        # Time similarity (5% weight)
        if original_recipe.total_time_minutes and recipe.total_time_minutes:
            time_diff = abs(original_recipe.total_time_minutes - recipe.total_time_minutes)
            if time_diff <= 15:
                score += 0.05
                reasons.append("Similar cooking time")
        
        # Only include if score meets threshold
        if score >= request.min_similarity_score:
            # Get primary image
            primary_image = next(
                (img for img in recipe.images if img.is_primary),
                recipe.images[0] if recipe.images else None
            )
            
            scored_recipes.append({
                "recipe": recipe,
                "score": score,
                "reasons": reasons,
                "common_ingredients": common_ingredients,
                "common_tags": list(common_tags),
                "primary_image": primary_image
            })
    
    # Sort by similarity score
    scored_recipes.sort(key=lambda x: x["score"], reverse=True)
    
    # Build response
    similar_recipes = []
    for item in scored_recipes[:request.limit]:
        recipe = item["recipe"]
        
        similar_recipes.append(SimilarRecipe(
            id=recipe.id,
            name=recipe.name,
            description=recipe.description,
            similarity_score=round(item["score"], 2),
            similarity_reasons=item["reasons"],
            author_username=recipe.user.username if recipe.user else "Unknown",
            primary_image_url=item["primary_image"].image_url if item["primary_image"] else None,
            rating_average=recipe.rating_average,
            difficulty_level=recipe.difficulty_level,
            total_time_minutes=recipe.total_time_minutes,
            common_ingredients=item["common_ingredients"],
            common_tags=item["common_tags"]
        ))
    
    return SimilarRecipesResponse(
        original_recipe_id=recipe_id,
        similar_recipes=similar_recipes,
        total=len(similar_recipes),
        based_on=["ingredients", "tags", "category", "difficulty", "cooking_time"]
    )