"""
Integration tests for recipe search endpoints.

Tests the complete search flow including:
- Creating test data
- Performing searches
- Verifying results
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.models.categorization import Category, Tag, RecipeCategory, RecipeTag


@pytest.mark.integration
class TestSearchIntegration:
    """Integration tests for search functionality."""
    
    async def test_full_search_flow(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        auth_headers: dict,
        db_session: AsyncSession
    ):
        """Test complete search flow from data creation to search."""
        # 1. Create test category
        category = Category(
            name="Search Test Category",
            slug="search-test-category",
            description="Category for search testing",
            display_order=100,
            is_active=True
        )
        db_session.add(category)
        
        # 2. Create test tags
        tags = [
            Tag(name="searchable", slug="searchable", usage_count=0),
            Tag(name="test-tag", slug="test-tag", usage_count=0),
            Tag(name="integration", slug="integration", usage_count=0)
        ]
        for tag in tags:
            db_session.add(tag)
        
        # 3. Create test ingredients
        ingredients = [
            Ingredient(
                name="Search Test Ingredient 1",
                name_plural="Search Test Ingredients 1",
                category="test",
                unit_weight=100
            ),
            Ingredient(
                name="Search Test Ingredient 2",
                name_plural="Search Test Ingredients 2",
                category="test",
                unit_weight=100
            )
        ]
        for ing in ingredients:
            db_session.add(ing)
        
        await db_session.flush()
        
        # 4. Create test recipes with various attributes
        recipes_data = [
            {
                "name": "Searchable Recipe Easy",
                "description": "A very easy recipe for search testing",
                "difficulty_level": "easy",
                "prep_time_minutes": 10,
                "cook_time_minutes": 20,
                "servings": 4,
                "is_public": True,
                "view_count": 100
            },
            {
                "name": "Searchable Recipe Medium",
                "description": "A medium difficulty recipe with longer cooking time",
                "difficulty_level": "medium",
                "prep_time_minutes": 20,
                "cook_time_minutes": 40,
                "servings": 6,
                "is_public": True,
                "view_count": 50
            },
            {
                "name": "Private Recipe Hard",
                "description": "A hard recipe that is private",
                "difficulty_level": "hard",
                "prep_time_minutes": 30,
                "cook_time_minutes": 60,
                "servings": 8,
                "is_public": False,
                "view_count": 10
            }
        ]
        
        recipes = []
        for recipe_data in recipes_data:
            recipe = Recipe(
                user_id=test_user.id,
                **recipe_data,
                instructions="Test instructions for search",
                water_ml=500,
                rating_average=4.5,
                rating_count=10
            )
            db_session.add(recipe)
            recipes.append(recipe)
        
        await db_session.flush()
        
        # 5. Add categorization and ingredients
        for i, recipe in enumerate(recipes):
            # Add category
            recipe_category = RecipeCategory(
                recipe_id=recipe.id,
                category_id=category.id,
                is_primary=True
            )
            db_session.add(recipe_category)
            
            # Add tags
            for j, tag in enumerate(tags[:2]):
                recipe_tag = RecipeTag(
                    recipe_id=recipe.id,
                    tag_id=tag.id
                )
                db_session.add(recipe_tag)
            
            # Add ingredients
            for j, ingredient in enumerate(ingredients[:i+1]):
                recipe_ingredient = RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    quantity=100 * (j + 1),
                    unit="g",
                    display_order=j
                )
                db_session.add(recipe_ingredient)
        
        await db_session.commit()
        
        # 6. Test basic search
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={"query": "Searchable"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should find public searchable recipes
        assert data["total"] >= 2
        assert all("Searchable" in item["name"] for item in data["items"])
        
        # 7. Test search with difficulty filter
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={
                "query": "Searchable",
                "difficulty_level": ["easy"]
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["difficulty_level"] == "easy"
        
        # 8. Test search with time filter
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={
                "query": "recipe",
                "max_total_time": 35
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Only easy recipe has total time <= 35 minutes
        assert all(
            item["total_time_minutes"] <= 35
            for item in data["items"]
            if item["total_time_minutes"]
        )
        
        # 9. Test search with category filter
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={
                "category_ids": [str(category.id)],
                "include_facets": True
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 2  # Public recipes only
        assert "facets" in data
        
        # 10. Test search suggestions
        response = await async_client.post(
            "/api/v1/recipes/search/suggestions",
            json={"query": "Search"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have recipe and ingredient suggestions
        recipe_suggestions = [s for s in data["suggestions"] if s["type"] == "recipe"]
        ingredient_suggestions = [s for s in data["suggestions"] if s["type"] == "ingredient"]
        
        assert len(recipe_suggestions) > 0
        assert len(ingredient_suggestions) > 0
        
        # 11. Test similar recipes
        recipe_id = recipes[0].id
        response = await async_client.get(
            f"/api/v1/recipes/search/similar/{recipe_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should find similar recipes based on shared ingredients/tags
        assert len(data["similar_recipes"]) > 0
        assert data["similar_recipes"][0]["similarity_score"] > 0
        
        # 12. Test search as anonymous user (should only see public recipes)
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={"query": "recipe"}
            # No auth headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should not include private recipe
        assert all(item["is_public"] for item in data["items"])
        assert not any("Private" in item["name"] for item in data["items"])
    
    async def test_search_performance(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        many_test_recipes: list[Recipe]  # Creates 100+ recipes
    ):
        """Test search performance with large dataset."""
        import time
        
        # Measure search time
        start_time = time.time()
        
        response = await async_client.post(
            "/api/v1/recipes/search",
            json={
                "query": "test",
                "difficulty_level": ["easy", "medium"],
                "max_total_time": 60,
                "include_facets": True,
                "page_size": 20
            },
            headers=auth_headers
        )
        
        end_time = time.time()
        search_time = end_time - start_time
        
        assert response.status_code == 200
        data = response.json()
        
        # Search should complete within reasonable time
        assert search_time < 2.0  # 2 seconds max
        assert data["search_time_ms"] < 2000
        
        # Should handle pagination properly
        assert len(data["items"]) <= 20
        assert data["total_pages"] > 1