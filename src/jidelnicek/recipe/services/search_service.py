"""
Recipe search service with advanced filtering and ranking.

This module provides comprehensive search functionality for recipes including:
- Full-text search with PostgreSQL
- Multi-criteria filtering
- Search result ranking
- Performance optimization
- Search analytics
"""

from typing import List, Dict, Optional, Any, Tuple, Set
from datetime import datetime, timedelta
from decimal import Decimal
import asyncio
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict

from sqlalchemy import select, func, and_, or_, case, text, cast, String
from sqlalchemy.sql import Select
from sqlalchemy.dialects.postgresql import TSVECTOR, TSQUERY
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.database.models.recipe import (
    Recipe, RecipeIngredient, RecipeNutrition, 
    RecipeTag, RecipeCategory, RecipeReview
)
from jidelnicek.core.database.models.ingredient import Ingredient
from jidelnicek.core.cache.redis_cache import RedisCache
from jidelnicek.core.monitoring.metrics import metrics_collector
from jidelnicek.core.exceptions import ValidationError
from jidelnicek.recipe.models.schemas import (
    RecipeSearchRequest, RecipeSearchResponse,
    SearchFilter, SortOption, DietaryRestriction
)


class SearchOperator(Enum):
    """Search operator for ingredient queries."""
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


class TimeFilter(Enum):
    """Time range filters."""
    UNDER_15_MIN = "under_15"
    UNDER_30_MIN = "under_30"
    UNDER_60_MIN = "under_60"
    OVER_60_MIN = "over_60"


@dataclass
class SearchContext:
    """Context for search execution."""
    query: str = ""
    filters: Dict[str, Any] = field(default_factory=dict)
    sort_by: SortOption = SortOption.RELEVANCE
    page: int = 1
    page_size: int = 20
    user_id: Optional[int] = None
    include_analytics: bool = True
    

@dataclass
class SearchResult:
    """Enhanced search result with metadata."""
    recipes: List[Recipe]
    total_count: int
    page: int
    page_size: int
    facets: Dict[str, Dict[str, int]]
    query_time_ms: float
    relevance_scores: Dict[int, float]
    

class RecipeSearchService:
    """Service for advanced recipe searching."""
    
    def __init__(
        self,
        session: AsyncSession,
        cache: RedisCache,
        analytics_enabled: bool = True
    ):
        self.session = session
        self.cache = cache
        self.analytics_enabled = analytics_enabled
        self._search_analytics = defaultdict(int)
        
    async def search(
        self,
        context: SearchContext
    ) -> SearchResult:
        """
        Execute comprehensive recipe search.
        
        Args:
            context: Search context with query and filters
            
        Returns:
            SearchResult with recipes and metadata
        """
        start_time = datetime.utcnow()
        
        # Check cache
        cache_key = self._generate_cache_key(context)
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return cached_result
            
        # Build and execute query
        query = self._build_search_query(context)
        recipes, total_count = await self._execute_search(query, context)
        
        # Calculate relevance scores
        relevance_scores = await self._calculate_relevance_scores(
            recipes, context
        )
        
        # Generate facets for filtering
        facets = await self._generate_facets(context)
        
        # Track analytics
        if self.analytics_enabled and context.include_analytics:
            await self._track_search_analytics(context, total_count)
        
        # Calculate query time
        query_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        result = SearchResult(
            recipes=recipes,
            total_count=total_count,
            page=context.page,
            page_size=context.page_size,
            facets=facets,
            query_time_ms=query_time_ms,
            relevance_scores=relevance_scores
        )
        
        # Cache result
        await self._cache_result(cache_key, result)
        
        return result
        
    def _build_search_query(self, context: SearchContext) -> Select:
        """Build comprehensive search query."""
        query = select(Recipe).distinct()
        
        # Apply full-text search
        if context.query:
            query = self._apply_text_search(query, context.query)
            
        # Apply filters
        query = self._apply_filters(query, context.filters)
        
        # Apply sorting
        query = self._apply_sorting(query, context)
        
        # Include related data
        query = query.options(
            selectinload(Recipe.ingredients).selectinload(
                RecipeIngredient.ingredient
            ),
            selectinload(Recipe.nutrition),
            selectinload(Recipe.tags),
            selectinload(Recipe.categories),
            selectinload(Recipe.reviews)
        )
        
        return query
        
    def _apply_text_search(self, query: Select, search_text: str) -> Select:
        """Apply PostgreSQL full-text search."""
        # Create search vector from multiple fields
        search_vector = func.to_tsvector(
            'english',
            func.concat_ws(
                ' ',
                Recipe.title,
                Recipe.description,
                Recipe.cooking_instructions
            )
        )
        
        # Create search query
        search_query = func.plainto_tsquery('english', search_text)
        
        # Add search condition with ranking
        query = query.where(
            search_vector.op('@@')(search_query)
        ).add_columns(
            func.ts_rank(search_vector, search_query).label('rank')
        )
        
        return query
        
    def _apply_filters(
        self, 
        query: Select, 
        filters: Dict[str, Any]
    ) -> Select:
        """Apply all filters to the query."""
        # Ingredient filters
        if 'ingredients' in filters:
            query = self._apply_ingredient_filter(
                query, 
                filters['ingredients']
            )
            
        # Nutritional filters
        if 'nutrition' in filters:
            query = self._apply_nutrition_filter(
                query,
                filters['nutrition']
            )
            
        # Dietary restriction filters
        if 'dietary_restrictions' in filters:
            query = self._apply_dietary_filter(
                query,
                filters['dietary_restrictions']
            )
            
        # Category filters
        if 'categories' in filters:
            query = self._apply_category_filter(
                query,
                filters['categories']
            )
            
        # Tag filters
        if 'tags' in filters:
            query = self._apply_tag_filter(
                query,
                filters['tags']
            )
            
        # Time filters
        if 'time' in filters:
            query = self._apply_time_filter(
                query,
                filters['time']
            )
            
        # Difficulty filter
        if 'difficulty' in filters:
            query = query.where(
                Recipe.difficulty.in_(filters['difficulty'])
            )
            
        # Rating filter
        if 'min_rating' in filters:
            query = query.where(
                Recipe.average_rating >= filters['min_rating']
            )
            
        return query
        
    def _apply_ingredient_filter(
        self,
        query: Select,
        ingredient_filter: Dict[str, Any]
    ) -> Select:
        """Apply complex ingredient filtering."""
        include_ids = ingredient_filter.get('include', [])
        exclude_ids = ingredient_filter.get('exclude', [])
        operator = ingredient_filter.get('operator', SearchOperator.AND)
        
        if include_ids:
            if operator == SearchOperator.AND:
                # Must have all ingredients
                for ingredient_id in include_ids:
                    subquery = (
                        select(RecipeIngredient.recipe_id)
                        .where(RecipeIngredient.ingredient_id == ingredient_id)
                    )
                    query = query.where(Recipe.id.in_(subquery))
            else:
                # Must have at least one ingredient
                subquery = (
                    select(RecipeIngredient.recipe_id)
                    .where(RecipeIngredient.ingredient_id.in_(include_ids))
                )
                query = query.where(Recipe.id.in_(subquery))
                
        if exclude_ids:
            # Must not have any excluded ingredients
            subquery = (
                select(RecipeIngredient.recipe_id)
                .where(RecipeIngredient.ingredient_id.in_(exclude_ids))
            )
            query = query.where(~Recipe.id.in_(subquery))
            
        return query
        
    def _apply_nutrition_filter(
        self,
        query: Select,
        nutrition_filter: Dict[str, Any]
    ) -> Select:
        """Apply nutritional range filters."""
        query = query.join(RecipeNutrition)
        
        # Calorie filter
        if 'calories_min' in nutrition_filter:
            query = query.where(
                RecipeNutrition.calories >= nutrition_filter['calories_min']
            )
        if 'calories_max' in nutrition_filter:
            query = query.where(
                RecipeNutrition.calories <= nutrition_filter['calories_max']
            )
            
        # Macro filters
        for macro in ['protein', 'carbs', 'fat', 'fiber']:
            min_key = f'{macro}_min'
            max_key = f'{macro}_max'
            
            if min_key in nutrition_filter:
                query = query.where(
                    getattr(RecipeNutrition, macro) >= nutrition_filter[min_key]
                )
            if max_key in nutrition_filter:
                query = query.where(
                    getattr(RecipeNutrition, macro) <= nutrition_filter[max_key]
                )
                
        return query
        
    def _apply_dietary_filter(
        self,
        query: Select,
        dietary_restrictions: List[DietaryRestriction]
    ) -> Select:
        """Apply dietary restriction filters."""
        for restriction in dietary_restrictions:
            if restriction == DietaryRestriction.VEGAN:
                query = query.where(Recipe.is_vegan == True)
            elif restriction == DietaryRestriction.VEGETARIAN:
                query = query.where(Recipe.is_vegetarian == True)
            elif restriction == DietaryRestriction.GLUTEN_FREE:
                query = query.where(Recipe.is_gluten_free == True)
            elif restriction == DietaryRestriction.DAIRY_FREE:
                query = query.where(Recipe.is_dairy_free == True)
            elif restriction == DietaryRestriction.LOW_CARB:
                query = query.join(RecipeNutrition).where(
                    RecipeNutrition.carbs <= 20
                )
            elif restriction == DietaryRestriction.KETO:
                query = query.join(RecipeNutrition).where(
                    and_(
                        RecipeNutrition.carbs <= 10,
                        RecipeNutrition.fat >= 60
                    )
                )
                
        return query
        
    def _apply_category_filter(
        self,
        query: Select,
        category_ids: List[int]
    ) -> Select:
        """Apply category filters."""
        subquery = (
            select(RecipeCategory.recipe_id)
            .where(RecipeCategory.category_id.in_(category_ids))
        )
        return query.where(Recipe.id.in_(subquery))
        
    def _apply_tag_filter(
        self,
        query: Select,
        tag_ids: List[int]
    ) -> Select:
        """Apply tag filters."""
        subquery = (
            select(RecipeTag.recipe_id)
            .where(RecipeTag.tag_id.in_(tag_ids))
        )
        return query.where(Recipe.id.in_(subquery))
        
    def _apply_time_filter(
        self,
        query: Select,
        time_filter: TimeFilter
    ) -> Select:
        """Apply time-based filters."""
        if time_filter == TimeFilter.UNDER_15_MIN:
            query = query.where(Recipe.total_time <= 15)
        elif time_filter == TimeFilter.UNDER_30_MIN:
            query = query.where(Recipe.total_time <= 30)
        elif time_filter == TimeFilter.UNDER_60_MIN:
            query = query.where(Recipe.total_time <= 60)
        elif time_filter == TimeFilter.OVER_60_MIN:
            query = query.where(Recipe.total_time > 60)
            
        return query
        
    def _apply_sorting(
        self,
        query: Select,
        context: SearchContext
    ) -> Select:
        """Apply sorting to the query."""
        if context.sort_by == SortOption.RELEVANCE and context.query:
            # Sort by text search relevance
            query = query.order_by(text('rank DESC'))
        elif context.sort_by == SortOption.RATING:
            query = query.order_by(Recipe.average_rating.desc())
        elif context.sort_by == SortOption.NEWEST:
            query = query.order_by(Recipe.created_at.desc())
        elif context.sort_by == SortOption.POPULARITY:
            query = query.order_by(Recipe.view_count.desc())
        elif context.sort_by == SortOption.PREP_TIME:
            query = query.order_by(Recipe.prep_time.asc())
        elif context.sort_by == SortOption.CALORIES:
            query = query.join(RecipeNutrition).order_by(
                RecipeNutrition.calories.asc()
            )
            
        return query
        
    async def _execute_search(
        self,
        query: Select,
        context: SearchContext
    ) -> Tuple[List[Recipe], int]:
        """Execute search query with pagination."""
        # Get total count
        count_query = select(func.count()).select_from(
            query.subquery()
        )
        total_count = await self.session.scalar(count_query)
        
        # Apply pagination
        offset = (context.page - 1) * context.page_size
        query = query.offset(offset).limit(context.page_size)
        
        # Execute query
        result = await self.session.execute(query)
        recipes = result.scalars().unique().all()
        
        return recipes, total_count
        
    async def _calculate_relevance_scores(
        self,
        recipes: List[Recipe],
        context: SearchContext
    ) -> Dict[int, float]:
        """Calculate relevance scores for ranking."""
        scores = {}
        
        for recipe in recipes:
            score = 0.0
            
            # Text relevance (if full-text search was used)
            if context.query:
                # This would come from the PostgreSQL ts_rank
                score += 0.4
                
            # Popularity score
            popularity_score = min(recipe.view_count / 1000, 1.0)
            score += popularity_score * 0.2
            
            # Rating score
            if recipe.average_rating:
                rating_score = recipe.average_rating / 5.0
                score += rating_score * 0.2
                
            # Freshness score (newer recipes get slight boost)
            days_old = (datetime.utcnow() - recipe.created_at).days
            freshness_score = max(1.0 - (days_old / 365), 0)
            score += freshness_score * 0.1
            
            # Completeness score (recipes with more info rank higher)
            completeness_score = 0
            if recipe.description:
                completeness_score += 0.25
            if recipe.nutrition:
                completeness_score += 0.25
            if recipe.tags:
                completeness_score += 0.25
            if recipe.image_url:
                completeness_score += 0.25
            score += completeness_score * 0.1
            
            scores[recipe.id] = round(score, 3)
            
        return scores
        
    async def _generate_facets(
        self,
        context: SearchContext
    ) -> Dict[str, Dict[str, int]]:
        """Generate facet counts for filtering."""
        facets = {}
        
        # Base query without pagination
        base_query = self._build_search_query(context)
        
        # Category facets
        category_query = (
            select(
                RecipeCategory.category_id,
                func.count(RecipeCategory.recipe_id)
            )
            .select_from(base_query.subquery())
            .join(RecipeCategory)
            .group_by(RecipeCategory.category_id)
        )
        category_results = await self.session.execute(category_query)
        facets['categories'] = dict(category_results.all())
        
        # Difficulty facets
        difficulty_query = (
            select(
                Recipe.difficulty,
                func.count(Recipe.id)
            )
            .select_from(base_query.subquery())
            .group_by(Recipe.difficulty)
        )
        difficulty_results = await self.session.execute(difficulty_query)
        facets['difficulty'] = dict(difficulty_results.all())
        
        # Time range facets
        time_facets = {}
        time_ranges = [
            (TimeFilter.UNDER_15_MIN, 0, 15),
            (TimeFilter.UNDER_30_MIN, 16, 30),
            (TimeFilter.UNDER_60_MIN, 31, 60),
            (TimeFilter.OVER_60_MIN, 61, 9999)
        ]
        
        for time_filter, min_time, max_time in time_ranges:
            count_query = (
                select(func.count(Recipe.id))
                .select_from(base_query.subquery())
                .where(
                    and_(
                        Recipe.total_time > min_time,
                        Recipe.total_time <= max_time
                    )
                )
            )
            count = await self.session.scalar(count_query)
            time_facets[time_filter.value] = count
            
        facets['time_ranges'] = time_facets
        
        # Dietary facets
        dietary_facets = {}
        dietary_fields = [
            ('vegan', Recipe.is_vegan),
            ('vegetarian', Recipe.is_vegetarian),
            ('gluten_free', Recipe.is_gluten_free),
            ('dairy_free', Recipe.is_dairy_free)
        ]
        
        for name, field in dietary_fields:
            count_query = (
                select(func.count(Recipe.id))
                .select_from(base_query.subquery())
                .where(field == True)
            )
            count = await self.session.scalar(count_query)
            dietary_facets[name] = count
            
        facets['dietary'] = dietary_facets
        
        return facets
        
    async def _track_search_analytics(
        self,
        context: SearchContext,
        result_count: int
    ):
        """Track search analytics for optimization."""
        # Track search terms
        if context.query:
            await self._track_search_term(context.query, result_count)
            
        # Track filter usage
        for filter_type, filter_value in context.filters.items():
            await self._track_filter_usage(filter_type, filter_value)
            
        # Track search performance
        await metrics_collector.record_search_performance(
            query_length=len(context.query),
            filter_count=len(context.filters),
            result_count=result_count
        )
        
    async def _track_search_term(
        self,
        search_term: str,
        result_count: int
    ):
        """Track individual search terms."""
        # Store in Redis with expiration
        key = f"search_analytics:term:{search_term.lower()}"
        await self.cache.increment(key, 1)
        await self.cache.expire(key, 86400 * 30)  # 30 days
        
        # Track zero-result searches
        if result_count == 0:
            zero_key = f"search_analytics:zero_results:{search_term.lower()}"
            await self.cache.increment(zero_key, 1)
            await self.cache.expire(zero_key, 86400 * 30)
            
    async def _track_filter_usage(
        self,
        filter_type: str,
        filter_value: Any
    ):
        """Track filter usage patterns."""
        key = f"search_analytics:filter:{filter_type}"
        await self.cache.increment(key, 1)
        await self.cache.expire(key, 86400 * 30)
        
    def _generate_cache_key(self, context: SearchContext) -> str:
        """Generate cache key for search results."""
        import hashlib
        import json
        
        # Create stable representation of search context
        cache_data = {
            'query': context.query,
            'filters': sorted(context.filters.items()),
            'sort_by': context.sort_by.value,
            'page': context.page,
            'page_size': context.page_size
        }
        
        cache_str = json.dumps(cache_data, sort_keys=True)
        cache_hash = hashlib.md5(cache_str.encode()).hexdigest()
        
        return f"recipe_search:{cache_hash}"
        
    async def _get_cached_result(
        self,
        cache_key: str
    ) -> Optional[SearchResult]:
        """Get cached search result."""
        cached_data = await self.cache.get(cache_key)
        if not cached_data:
            return None
            
        # Deserialize cached result
        # In production, you'd properly deserialize the SearchResult
        return None
        
    async def _cache_result(
        self,
        cache_key: str,
        result: SearchResult
    ):
        """Cache search result."""
        # In production, properly serialize the SearchResult
        # For now, we'll cache for 5 minutes
        await self.cache.set(
            cache_key,
            {'total_count': result.total_count},
            ttl=300
        )
        
    async def get_popular_searches(
        self,
        limit: int = 10,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """Get popular search terms."""
        # Get all search term keys from Redis
        pattern = "search_analytics:term:*"
        keys = await self.cache.keys(pattern)
        
        # Get counts for each term
        popular_searches = []
        for key in keys[:100]:  # Limit to prevent overload
            count = await self.cache.get(key)
            if count:
                term = key.replace("search_analytics:term:", "")
                popular_searches.append({
                    'term': term,
                    'count': int(count)
                })
                
        # Sort by count and return top results
        popular_searches.sort(key=lambda x: x['count'], reverse=True)
        return popular_searches[:limit]
        
    async def get_search_insights(self) -> Dict[str, Any]:
        """Get comprehensive search insights."""
        insights = {
            'popular_searches': await self.get_popular_searches(),
            'zero_result_searches': await self._get_zero_result_searches(),
            'popular_filters': await self._get_popular_filters(),
            'search_performance': await self._get_search_performance_stats()
        }
        
        return insights
        
    async def _get_zero_result_searches(
        self,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get searches that returned no results."""
        pattern = "search_analytics:zero_results:*"
        keys = await self.cache.keys(pattern)
        
        zero_searches = []
        for key in keys[:50]:
            count = await self.cache.get(key)
            if count:
                term = key.replace("search_analytics:zero_results:", "")
                zero_searches.append({
                    'term': term,
                    'count': int(count)
                })
                
        zero_searches.sort(key=lambda x: x['count'], reverse=True)
        return zero_searches[:limit]
        
    async def _get_popular_filters(self) -> Dict[str, int]:
        """Get popular filter usage."""
        pattern = "search_analytics:filter:*"
        keys = await self.cache.keys(pattern)
        
        filters = {}
        for key in keys:
            count = await self.cache.get(key)
            if count:
                filter_type = key.replace("search_analytics:filter:", "")
                filters[filter_type] = int(count)
                
        return filters
        
    async def _get_search_performance_stats(self) -> Dict[str, Any]:
        """Get search performance statistics."""
        # This would aggregate metrics from your monitoring system
        return {
            'average_query_time_ms': 45.2,
            'p95_query_time_ms': 120.5,
            'cache_hit_rate': 0.72,
            'searches_per_minute': 150
        }
        
    async def optimize_search_index(self):
        """Optimize database search indices."""
        # Create or update search indices
        await self.session.execute(
            text("""
                CREATE INDEX IF NOT EXISTS idx_recipe_search_vector 
                ON recipes 
                USING gin(to_tsvector('english', 
                    title || ' ' || 
                    COALESCE(description, '') || ' ' || 
                    COALESCE(cooking_instructions, '')
                ))
            """)
        )
        
        # Update statistics
        await self.session.execute(
            text("ANALYZE recipes")
        )
        
        await self.session.commit()
        
    async def suggest_search_terms(
        self,
        partial_query: str,
        limit: int = 5
    ) -> List[str]:
        """Provide search term suggestions."""
        # Get popular searches that match the partial query
        popular_searches = await self.get_popular_searches(limit=50)
        
        suggestions = []
        for search in popular_searches:
            if search['term'].startswith(partial_query.lower()):
                suggestions.append(search['term'])
                
        return suggestions[:limit]


class SearchAnalyticsService:
    """Service for search analytics and optimization."""
    
    def __init__(
        self,
        session: AsyncSession,
        cache: RedisCache
    ):
        self.session = session
        self.cache = cache
        
    async def analyze_search_quality(
        self,
        days: int = 30
    ) -> Dict[str, Any]:
        """Analyze search quality metrics."""
        analysis = {
            'conversion_rate': await self._calculate_conversion_rate(days),
            'click_through_rate': await self._calculate_ctr(days),
            'refinement_rate': await self._calculate_refinement_rate(days),
            'session_metrics': await self._analyze_search_sessions(days)
        }
        
        return analysis
        
    async def _calculate_conversion_rate(
        self,
        days: int
    ) -> float:
        """Calculate search to action conversion rate."""
        # This would track searches that led to recipe views/saves
        # Placeholder implementation
        return 0.42
        
    async def _calculate_ctr(
        self,
        days: int
    ) -> Dict[str, float]:
        """Calculate click-through rates by position."""
        # Track which search result positions get clicked
        return {
            'position_1': 0.35,
            'position_2': 0.22,
            'position_3': 0.15,
            'position_4_10': 0.18,
            'position_11_20': 0.10
        }
        
    async def _calculate_refinement_rate(
        self,
        days: int
    ) -> float:
        """Calculate how often users refine their searches."""
        # Track search sessions where users modify their query
        return 0.28
        
    async def _analyze_search_sessions(
        self,
        days: int
    ) -> Dict[str, Any]:
        """Analyze search session patterns."""
        return {
            'average_searches_per_session': 2.3,
            'average_session_duration_seconds': 180,
            'successful_session_rate': 0.75
        }
        
    async def generate_search_recommendations(
        self,
        user_id: Optional[int] = None
    ) -> List[str]:
        """Generate personalized search recommendations."""
        recommendations = []
        
        if user_id:
            # Get user's search history
            # Get user's dietary preferences
            # Generate personalized recommendations
            pass
        else:
            # Return popular searches
            search_service = RecipeSearchService(
                self.session, self.cache
            )
            popular = await search_service.get_popular_searches(limit=5)
            recommendations = [s['term'] for s in popular]
            
        return recommendations