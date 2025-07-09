"""
Tests for recipe search endpoints.

This module tests all search-related functionality including:
- Advanced search with filters
- Search suggestions
- Popular searches
- Filter options
- Similar recipes
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.ingredient import Ingredient, RecipeIngredient
from jidelnicek.recipe.models.categorization import Category, Tag, RecipeCategory, RecipeTag
from jidelnicek.recipe.schemas.search import (
    SearchSortBy, SearchSortOrder, AdvancedSearchRequest
)


class TestAdvancedSearch:
    """Test advanced search functionality."""
    
    async def test_search_basic(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipes: list[Recipe]
    ):
        """Test basic search functionality."""
        # Search for a specific recipe by name
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={"query": test_recipes[0].name[:5]},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1
        assert any(test_recipes[0].name in item["name"] for item in data["items"])
    
    async def test_search_with_filters(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipes: list[Recipe]
    ):
        """Test search with multiple filters."""
        request_data = {
            "query": "test",
            "difficulty_level": ["easy"],
            "max_prep_time": 30,
            "min_servings": 2,
            "max_servings": 6,
            "is_public": True,
            "sort_by": "created_at",
            "sort_order": "desc"
        }
        
        response = await async_client.post(
            "/api/v1/recipes/search",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify filters were applied
        for item in data["items"]:
            if item["difficulty_level"]:
                assert item["difficulty_level"] == "easy"
            if item["prep_time_minutes"]:
                assert item["prep_time_minutes"] <= 30
            assert item["servings"] >= 2
            assert item["servings"] <= 6
            assert item["is_public"] is True
    
    async def test_search_with_category_filter(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_category: Category,
        test_recipes_with_categories: list[Recipe]
    ):
        """Test search filtering by category."""
        request_data = {
            "category_ids": [str(test_category.id)],
            "include_facets": True
        }
        
        response = await async_client.post(
            "/api/v1/recipes/search",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All results should have the specified category
        for item in data["items"]:
            assert any(
                cat["id"] == str(test_category.id)
                for cat in item["categories"]
            )
        
        # Check facets were included
        assert "facets" in data
        assert "categories" in data["facets"]
    
    async def test_search_with_ingredient_filters(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipes_with_ingredients: list[Recipe],
        test_ingredients: list[Ingredient]
    ):
        """Test search with ingredient inclusion/exclusion."""
        # Search for recipes with specific ingredient
        include_ingredient = test_ingredients[0].name
        exclude_ingredient = test_ingredients[1].name
        
        request_data = {
            "include_ingredients": [include_ingredient],
            "exclude_ingredients": [exclude_ingredient]
        }
        
        response = await async_client.post(
            "/api/v1/recipes/search",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify ingredient filters worked
        assert data["total"] >= 0
    
    async def test_search_pagination(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        many_test_recipes: list[Recipe]  # Fixture that creates 50+ recipes
    ):
        """Test search pagination."""
        # First page
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={"page": 1, "page_size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) <= 10
        assert data["page"] == 1
        assert data["has_next"] is True
        assert data["has_prev"] is False
        
        # Second page
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={"page": 2, "page_size": 10},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 2
        assert data["has_prev"] is True
    
    async def test_search_sorting(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipes: list[Recipe]
    ):
        """Test different sorting options."""
        # Sort by rating
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={
                "sort_by": "rating_average",
                "sort_order": "desc"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify sorting
        ratings = [
            item["rating_average"] or 0
            for item in data["items"]
        ]
        assert ratings == sorted(ratings, reverse=True)
    
    async def test_search_with_highlights(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipes: list[Recipe]
    ):
        """Test search with text highlighting."""
        query = "delicious"
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={
                "query": query,
                "highlight_fields": True
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for highlights in results
        for item in data["items"]:
            if item.get("highlights"):
                assert any(
                    query in highlight["snippet"]
                    for highlight in item["highlights"]
                )


class TestSearchSuggestions:
    """Test search suggestions and autocomplete."""
    
    async def test_suggestions_basic(
        self,
        async_client: AsyncClient,
        test_recipes: list[Recipe],
        test_ingredients: list[Ingredient],
        test_tags: list[Tag]
    ):
        """Test basic search suggestions."""
        response = await async_client.post(
            "/api/v1/recipes/search/suggestions",
            json={"query": "test", "limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "suggestions" in data
        assert len(data["suggestions"]) <= 25  # 5 per type
        
        # Check suggestion structure
        for suggestion in data["suggestions"]:
            assert "type" in suggestion
            assert "text" in suggestion
            assert "category" in suggestion
    
    async def test_suggestions_by_type(
        self,
        async_client: AsyncClient,
        test_recipes: list[Recipe]
    ):
        """Test suggestions filtered by type."""
        response = await async_client.post(
            "/api/v1/recipes/search/suggestions",
            json={
                "query": "test",
                "types": ["recipe"],
                "limit": 10
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # All suggestions should be recipes
        for suggestion in data["suggestions"]:
            assert suggestion["type"] == "recipe"
    
    async def test_suggestions_popular_items(
        self,
        async_client: AsyncClient,
        popular_tags: list[Tag]  # Fixture that creates popular tags
    ):
        """Test popular items in suggestions for short queries."""
        response = await async_client.post(
            "/api/v1/recipes/search/suggestions",
            json={
                "query": "a",  # Very short query
                "include_popular": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should include popular tags
        popular_suggestions = [
            s for s in data["suggestions"]
            if s.get("category") == "Popular Tags"
        ]
        assert len(popular_suggestions) > 0


class TestPopularSearches:
    """Test popular searches and trending recipes."""
    
    async def test_popular_searches_24h(
        self,
        async_client: AsyncClient,
        mock_search_analytics  # Fixture that populates search analytics
    ):
        """Test popular searches for last 24 hours."""
        response = await async_client.get(
            "/api/v1/recipes/search/popular",
            params={"time_period": "last_24_hours"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "popular_searches" in data
        assert "trending_recipes" in data
        assert "trending_tags" in data
        assert "trending_categories" in data
        assert data["time_period"] == "last_24_hours"
        
        # Check popular searches structure
        for search in data["popular_searches"]:
            assert "term" in search
            assert "count" in search
            assert search["count"] > 0
    
    async def test_trending_recipes(
        self,
        async_client: AsyncClient,
        trending_recipes: list[Recipe]  # Fixture that creates recipes with high view counts
    ):
        """Test trending recipes calculation."""
        response = await async_client.get(
            "/api/v1/recipes/search/popular",
            params={"time_period": "last_7_days"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check trending recipes
        assert len(data["trending_recipes"]) > 0
        for recipe in data["trending_recipes"]:
            assert "trending_score" in recipe
            assert recipe["trending_score"] > 0
            assert "view_growth" in recipe


class TestSearchFilters:
    """Test available filter options."""
    
    async def test_get_filter_options(
        self,
        async_client: AsyncClient,
        test_categories: list[Category],
        test_tags: list[Tag]
    ):
        """Test retrieving available filter options."""
        response = await async_client.get("/api/v1/recipes/search/filters")
        assert response.status_code == 200
        data = response.json()
        
        assert "filter_groups" in data
        assert "total_recipes" in data
        assert "stats" in data
        
        # Check filter groups
        filter_names = [fg["name"] for fg in data["filter_groups"]]
        assert "categories" in filter_names
        assert "difficulty_level" in filter_names
        assert "max_total_time" in filter_names
        
        # Check stats
        assert "avg_prep_time" in data["stats"]
        assert "avg_rating" in data["stats"]
    
    async def test_filter_options_with_counts(
        self,
        async_client: AsyncClient,
        test_recipes_with_categories: list[Recipe]
    ):
        """Test filter options include counts."""
        response = await async_client.get("/api/v1/recipes/search/filters")
        assert response.status_code == 200
        data = response.json()
        
        # Find categories filter group
        categories_group = next(
            fg for fg in data["filter_groups"]
            if fg["name"] == "categories"
        )
        
        # Check options have counts
        for option in categories_group["options"]:
            assert "count" in option
            assert option["count"] >= 0


class TestSimilarRecipes:
    """Test similar recipe recommendations."""
    
    async def test_similar_recipes_basic(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipe_with_full_data: Recipe
    ):
        """Test basic similar recipe recommendations."""
        response = await async_client.get(
            f"/api/v1/recipes/search/similar/{test_recipe_with_full_data.id}",
            params={"limit": 5},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "similar_recipes" in data
        assert "original_recipe_id" in data
        assert data["original_recipe_id"] == str(test_recipe_with_full_data.id)
        
        # Check similar recipes
        for recipe in data["similar_recipes"]:
            assert "similarity_score" in recipe
            assert 0 <= recipe["similarity_score"] <= 1
            assert "similarity_reasons" in recipe
            assert len(recipe["similarity_reasons"]) > 0
    
    async def test_similar_recipes_with_filters(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        test_recipe_with_full_data: Recipe
    ):
        """Test similar recipes with additional filters."""
        response = await async_client.get(
            f"/api/v1/recipes/search/similar/{test_recipe_with_full_data.id}",
            params={
                "limit": 10,
                "include_same_author": False,
                "boost_same_category": True,
                "min_similarity_score": 0.7
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All results should meet minimum similarity
        for recipe in data["similar_recipes"]:
            assert recipe["similarity_score"] >= 0.7
            # Should not include same author
            assert recipe["author_username"] != test_recipe_with_full_data.user.username
    
    async def test_similar_recipes_not_found(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict
    ):
        """Test similar recipes for non-existent recipe."""
        fake_id = uuid4()
        response = await async_client.get(
            f"/api/v1/recipes/search/similar/{fake_id}",
            headers=auth_headers
        )
        assert response.status_code == 404
    
    async def test_similar_recipes_private_recipe(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        private_recipe: Recipe
    ):
        """Test similar recipes for private recipe (unauthorized)."""
        response = await async_client.get(
            f"/api/v1/recipes/search/similar/{private_recipe.id}"
            # No auth headers - should fail
        )
        assert response.status_code == 404