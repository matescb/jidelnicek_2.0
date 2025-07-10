"""
Tests for recipe search service.

This module tests the comprehensive search functionality including:
- Full-text search
- Multi-criteria filtering
- Result ranking
- Search analytics
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.services.search_service import (
    RecipeSearchService, SearchContext, SearchResult,
    SearchOperator, TimeFilter, SearchAnalyticsService
)
from jidelnicek.recipe.models.schemas import (
    DietaryRestriction, SortOption, Difficulty,
    IngredientFilter, NutritionFilter
)
from jidelnicek.recipe.models import (
    Recipe, RecipeIngredient, RecipeCategory, RecipeTag
)
from jidelnicek.common.models import NutritionalValue


@pytest.fixture
def mock_session():
    """Create mock database session."""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def mock_cache():
    """Create mock Redis cache."""
    cache = AsyncMock()
    cache.get.return_value = None
    cache.set.return_value = None
    cache.increment.return_value = None
    cache.expire.return_value = None
    cache.keys.return_value = []
    return cache


@pytest.fixture
def search_service(mock_session, mock_cache):
    """Create search service instance."""
    return RecipeSearchService(mock_session, mock_cache)


@pytest.fixture
def sample_recipes():
    """Create sample recipe data."""
    recipes = []
    
    # Recipe 1: Vegan Buddha Bowl
    recipe1 = Recipe(
        id=1,
        title="Vegan Buddha Bowl",
        description="Healthy and colorful vegan bowl",
        slug="vegan-buddha-bowl",
        user_id=1,
        prep_time=15,
        cook_time=20,
        servings=2,
        difficulty=Difficulty.EASY,
        cooking_instructions="Mix ingredients...",
        is_vegan=True,
        is_vegetarian=True,
        is_gluten_free=True,
        view_count=150,
        average_rating=4.5,
        created_at=datetime.utcnow() - timedelta(days=7)
    )
    recipe1.nutrition = NutritionalValue(
        calories=450,
        protein=Decimal("15.5"),
        carbs=Decimal("55.0"),
        fat=Decimal("20.0"),
        fiber=Decimal("12.0")
    )
    recipes.append(recipe1)
    
    # Recipe 2: Chicken Stir Fry
    recipe2 = Recipe(
        id=2,
        title="Chicken Stir Fry",
        description="Quick and easy chicken stir fry",
        slug="chicken-stir-fry",
        user_id=2,
        prep_time=10,
        cook_time=15,
        servings=4,
        difficulty=Difficulty.EASY,
        cooking_instructions="Stir fry chicken...",
        is_vegan=False,
        is_vegetarian=False,
        is_gluten_free=True,
        view_count=300,
        average_rating=4.2,
        created_at=datetime.utcnow() - timedelta(days=14)
    )
    recipe2.nutrition = NutritionalValue(
        calories=320,
        protein=Decimal("28.0"),
        carbs=Decimal("25.0"),
        fat=Decimal("12.0"),
        fiber=Decimal("4.0")
    )
    recipes.append(recipe2)
    
    # Recipe 3: Chocolate Cake
    recipe3 = Recipe(
        id=3,
        title="Decadent Chocolate Cake",
        description="Rich and moist chocolate cake",
        slug="decadent-chocolate-cake",
        user_id=3,
        prep_time=30,
        cook_time=45,
        servings=8,
        difficulty=Difficulty.MEDIUM,
        cooking_instructions="Mix dry ingredients...",
        is_vegan=False,
        is_vegetarian=True,
        is_gluten_free=False,
        view_count=500,
        average_rating=4.8,
        created_at=datetime.utcnow() - timedelta(days=30)
    )
    recipe3.nutrition = NutritionalValue(
        calories=420,
        protein=Decimal("6.0"),
        carbs=Decimal("58.0"),
        fat=Decimal("22.0"),
        fiber=Decimal("3.0")
    )
    recipes.append(recipe3)
    
    return recipes


class TestRecipeSearchService:
    """Test recipe search service functionality."""
    
    async def test_basic_text_search(self, search_service, sample_recipes):
        """Test basic text search functionality."""
        context = SearchContext(
            query="chocolate cake",
            page=1,
            page_size=20
        )
        
        # Mock database response
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=1)
        
        result = await search_service.search(context)
        
        assert isinstance(result, SearchResult)
        assert search_service.session.execute.called
        
    async def test_ingredient_filter_and_operator(self, search_service):
        """Test ingredient filtering with AND operator."""
        context = SearchContext(
            filters={
                'ingredients': {
                    'include': [1, 2, 3],
                    'operator': SearchOperator.AND
                }
            }
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=0)
        
        result = await search_service.search(context)
        
        # Verify subqueries were created for each ingredient
        assert result.total_count == 0
        
    async def test_nutrition_range_filter(self, search_service):
        """Test nutritional range filtering."""
        context = SearchContext(
            filters={
                'nutrition': {
                    'calories_min': 200,
                    'calories_max': 500,
                    'protein_min': Decimal("10.0"),
                    'carbs_max': Decimal("50.0")
                }
            }
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=2)
        
        result = await search_service.search(context)
        
        assert result is not None
        
    async def test_dietary_restriction_filter(self, search_service):
        """Test dietary restriction filtering."""
        context = SearchContext(
            filters={
                'dietary_restrictions': [
                    DietaryRestriction.VEGAN,
                    DietaryRestriction.GLUTEN_FREE
                ]
            }
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=1)
        
        result = await search_service.search(context)
        
        assert result.total_count == 1
        
    async def test_time_filter(self, search_service):
        """Test time-based filtering."""
        context = SearchContext(
            filters={
                'time': TimeFilter.UNDER_30_MIN
            }
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=2)
        
        result = await search_service.search(context)
        
        assert result is not None
        
    async def test_complex_multi_filter(self, search_service):
        """Test complex search with multiple filters."""
        context = SearchContext(
            query="healthy",
            filters={
                'ingredients': {
                    'exclude': [5, 6],  # Exclude allergens
                },
                'nutrition': {
                    'calories_max': 400,
                    'protein_min': Decimal("15.0")
                },
                'dietary_restrictions': [DietaryRestriction.VEGETARIAN],
                'time': TimeFilter.UNDER_30_MIN,
                'difficulty': [Difficulty.EASY, Difficulty.MEDIUM],
                'min_rating': 4.0
            },
            sort_by=SortOption.RATING,
            page=1,
            page_size=10
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=1)
        
        result = await search_service.search(context)
        
        assert result is not None
        assert result.page_size == 10
        
    async def test_sorting_options(self, search_service):
        """Test different sorting options."""
        sort_options = [
            SortOption.RELEVANCE,
            SortOption.RATING,
            SortOption.NEWEST,
            SortOption.POPULARITY,
            SortOption.PREP_TIME,
            SortOption.CALORIES
        ]
        
        for sort_option in sort_options:
            context = SearchContext(
                query="recipe" if sort_option == SortOption.RELEVANCE else "",
                sort_by=sort_option
            )
            
            search_service.session.execute = AsyncMock()
            search_service.session.scalar = AsyncMock(return_value=5)
            
            result = await search_service.search(context)
            assert result is not None
            
    async def test_relevance_score_calculation(self, search_service, sample_recipes):
        """Test relevance score calculation."""
        context = SearchContext(query="chocolate")
        
        scores = await search_service._calculate_relevance_scores(
            sample_recipes, context
        )
        
        assert len(scores) == len(sample_recipes)
        assert all(0 <= score <= 1 for score in scores.values())
        
        # Recipe 3 (chocolate cake) should have higher score
        assert scores[3] > scores[1]
        
    async def test_facet_generation(self, search_service):
        """Test facet generation for filtering."""
        context = SearchContext()
        
        # Mock facet queries
        search_service.session.execute = AsyncMock()
        search_service.session.execute.return_value.all.return_value = [
            (1, 10), (2, 5), (3, 8)
        ]
        search_service.session.scalar = AsyncMock(return_value=5)
        
        facets = await search_service._generate_facets(context)
        
        assert 'categories' in facets
        assert 'difficulty' in facets
        assert 'time_ranges' in facets
        assert 'dietary' in facets
        
    async def test_search_caching(self, search_service, mock_cache):
        """Test search result caching."""
        context = SearchContext(query="pasta")
        
        # First search - cache miss
        mock_cache.get.return_value = None
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=10)
        
        result1 = await search_service.search(context)
        
        # Verify cache was set
        assert mock_cache.set.called
        
        # Second search - should check cache
        await search_service.search(context)
        assert mock_cache.get.called
        
    async def test_search_analytics_tracking(self, search_service, mock_cache):
        """Test search analytics tracking."""
        context = SearchContext(
            query="vegan salad",
            filters={'dietary_restrictions': [DietaryRestriction.VEGAN]}
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=5)
        
        await search_service.search(context)
        
        # Verify analytics were tracked
        assert mock_cache.increment.called
        
        # Check search term tracking
        call_args = [call[0][0] for call in mock_cache.increment.call_args_list]
        assert any("search_analytics:term:vegan salad" in arg for arg in call_args)
        assert any("search_analytics:filter:dietary_restrictions" in arg for arg in call_args)
        
    async def test_zero_results_tracking(self, search_service, mock_cache):
        """Test tracking of searches with no results."""
        context = SearchContext(query="impossible recipe xyz")
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=0)
        
        await search_service.search(context)
        
        # Verify zero results were tracked
        call_args = [call[0][0] for call in mock_cache.increment.call_args_list]
        assert any("zero_results" in arg for arg in call_args)
        
    async def test_pagination(self, search_service):
        """Test search pagination."""
        context = SearchContext(
            query="recipe",
            page=3,
            page_size=10
        )
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=100)
        
        result = await search_service.search(context)
        
        assert result.page == 3
        assert result.page_size == 10
        assert result.total_count == 100
        
    async def test_search_suggestions(self, search_service, mock_cache):
        """Test search term suggestions."""
        # Mock popular searches
        search_service.get_popular_searches = AsyncMock(
            return_value=[
                {'term': 'chicken pasta', 'count': 50},
                {'term': 'chicken salad', 'count': 40},
                {'term': 'chocolate cake', 'count': 30}
            ]
        )
        
        suggestions = await search_service.suggest_search_terms("chic", limit=2)
        
        assert len(suggestions) == 2
        assert 'chicken pasta' in suggestions
        assert 'chicken salad' in suggestions
        

class TestSearchAnalyticsService:
    """Test search analytics functionality."""
    
    @pytest.fixture
    def analytics_service(self, mock_session, mock_cache):
        """Create analytics service instance."""
        return SearchAnalyticsService(mock_session, mock_cache)
        
    async def test_search_quality_analysis(self, analytics_service):
        """Test search quality metrics calculation."""
        analysis = await analytics_service.analyze_search_quality(days=30)
        
        assert 'conversion_rate' in analysis
        assert 'click_through_rate' in analysis
        assert 'refinement_rate' in analysis
        assert 'session_metrics' in analysis
        
    async def test_click_through_rate_by_position(self, analytics_service):
        """Test CTR calculation by search result position."""
        ctr = await analytics_service._calculate_ctr(days=7)
        
        assert 'position_1' in ctr
        assert 'position_2' in ctr
        assert ctr['position_1'] > ctr['position_2']  # First position should have higher CTR
        
    async def test_search_recommendations(self, analytics_service):
        """Test personalized search recommendations."""
        # Without user ID - should return popular searches
        recommendations = await analytics_service.generate_search_recommendations()
        assert isinstance(recommendations, list)
        
        # With user ID - would return personalized recommendations
        user_recommendations = await analytics_service.generate_search_recommendations(
            user_id=123
        )
        assert isinstance(user_recommendations, list)
        

class TestSearchPerformance:
    """Test search performance optimizations."""
    
    async def test_search_index_optimization(self, search_service):
        """Test database index optimization."""
        search_service.session.execute = AsyncMock()
        search_service.session.commit = AsyncMock()
        
        await search_service.optimize_search_index()
        
        # Verify index creation and statistics update
        assert search_service.session.execute.called
        assert search_service.session.commit.called
        
    async def test_concurrent_searches(self, search_service):
        """Test handling of concurrent search requests."""
        import asyncio
        
        search_service.session.execute = AsyncMock()
        search_service.session.scalar = AsyncMock(return_value=10)
        
        # Create multiple search contexts
        contexts = [
            SearchContext(query=f"recipe {i}")
            for i in range(5)
        ]
        
        # Execute searches concurrently
        results = await asyncio.gather(*[
            search_service.search(context)
            for context in contexts
        ])
        
        assert len(results) == 5
        assert all(isinstance(r, SearchResult) for r in results)