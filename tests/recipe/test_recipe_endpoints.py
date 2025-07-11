"""
Comprehensive tests for Recipe API endpoints.

This module provides complete test coverage for all Recipe API endpoints,
including request/response validation, authorization middleware, error handling,
pagination, filtering, and search functionality.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from typing import Dict, Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.services.recipe_service import RecipeService
from jidelnicek.recipe.schemas import RecipeCreate, RecipeIngredientCreate
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.common.models.nutritional_value import NutritionalValue
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.auth.services.token_service import TokenService


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(scope="function")
async def recipe_owner(db_session: AsyncSession) -> AuthUser:
    """Create a user who owns recipes."""
    user = AuthUser(
        email="recipe_owner@example.com",
        password_hash=PasswordHasher.hash_password("RecipeOwner123!"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="UTC",
        role="user",
        is_active=True,
        is_archived=False
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def other_user(db_session: AsyncSession) -> AuthUser:
    """Create another user for permission testing."""
    user = AuthUser(
        email="other_user@example.com",
        password_hash=PasswordHasher.hash_password("OtherUser123!"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="UTC",
        role="user",
        is_active=True,
        is_archived=False
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def recipe_owner_token(
    recipe_owner: AuthUser, 
    db_session: AsyncSession, 
    mock_redis
) -> str:
    """Create authentication token for recipe owner."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(recipe_owner)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def other_user_token(
    other_user: AuthUser, 
    db_session: AsyncSession, 
    mock_redis
) -> str:
    """Create authentication token for other user."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(other_user)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def recipe_owner_headers(recipe_owner_token: str) -> Dict[str, str]:
    """Create auth headers for recipe owner."""
    return {"Authorization": f"Bearer {recipe_owner_token}"}


@pytest_asyncio.fixture(scope="function")
async def other_user_headers(other_user_token: str) -> Dict[str, str]:
    """Create auth headers for other user."""
    return {"Authorization": f"Bearer {other_user_token}"}


@pytest_asyncio.fixture(scope="function")
async def sample_nutritional_value(db_session: AsyncSession) -> NutritionalValue:
    """Create a sample nutritional value for testing."""
    nutritional_value = NutritionalValue(
        calories=Decimal('100.0'),
        proteins_g=Decimal('20.0'),
        carbohydrates_g=Decimal('10.0'),
        fats_g=Decimal('5.0'),
        fiber_g=Decimal('2.0'),
        sugars_g=Decimal('3.0'),
        sodium_mg=Decimal('50.0'),
        reference_amount_g=Decimal('100.0')
    )
    db_session.add(nutritional_value)
    await db_session.commit()
    await db_session.refresh(nutritional_value)
    return nutritional_value


@pytest_asyncio.fixture(scope="function")
async def sample_ingredient(db_session: AsyncSession, sample_nutritional_value: NutritionalValue) -> Ingredient:
    """Create a sample ingredient for testing."""
    ingredient = Ingredient(
        name="Test Ingredient",
        category="Test Category",
        nutritional_value_id=sample_nutritional_value.id,
        is_global=True
    )
    db_session.add(ingredient)
    await db_session.commit()
    await db_session.refresh(ingredient)
    return ingredient


@pytest_asyncio.fixture(scope="function")
async def sample_ingredient_2(db_session: AsyncSession, sample_nutritional_value: NutritionalValue) -> Ingredient:
    """Create another sample ingredient for testing."""
    ingredient = Ingredient(
        name="Test Ingredient 2",
        category="Test Category",
        nutritional_value_id=sample_nutritional_value.id,
        is_global=True
    )
    db_session.add(ingredient)
    await db_session.commit()
    await db_session.refresh(ingredient)
    return ingredient


@pytest_asyncio.fixture(scope="function")
async def sample_recipe(
    db_session: AsyncSession, 
    recipe_owner: AuthUser, 
    sample_ingredient: Ingredient
) -> Recipe:
    """Create a sample recipe for testing."""
    recipe_data = RecipeCreate(
        name="Test Recipe",
        description="Test description",
        instructions="Test instructions",
        prep_time_minutes=10,
        cook_time_minutes=20,
        servings=4,
        water_ml=500,
        ingredients=[
            RecipeIngredientCreate(
                ingredient_id=sample_ingredient.id,
                quantity_g=Decimal('100.0'),
                display_order=0
            )
        ]
    )
    
    service = RecipeService(db_session)
    recipe = await service.create_recipe(recipe_owner.id, recipe_data)
    return recipe


@pytest_asyncio.fixture(scope="function")
async def published_recipe(
    db_session: AsyncSession, 
    recipe_owner: AuthUser, 
    sample_ingredient: Ingredient
) -> Recipe:
    """Create a published recipe for testing."""
    recipe_data = RecipeCreate(
        name="Published Recipe",
        description="Published description",
        instructions="Published instructions",
        prep_time_minutes=15,
        cook_time_minutes=25,
        servings=2,
        is_public=True,
        ingredients=[
            RecipeIngredientCreate(
                ingredient_id=sample_ingredient.id,
                quantity_g=Decimal('150.0'),
                display_order=0
            )
        ]
    )
    
    service = RecipeService(db_session)
    recipe = await service.create_recipe(recipe_owner.id, recipe_data)
    
    # Publish the recipe
    await service.publish_recipe(recipe.id, recipe_owner.id)
    return recipe


class TestRecipeEndpointsCreate:
    """Test recipe creation endpoints."""
    
    async def test_create_recipe_basic(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_ingredient: Ingredient
    ):
        """Test basic recipe creation."""
        recipe_data = {
            "name": "API Test Recipe",
            "description": "API test description",
            "instructions": "API test instructions",
            "prep_time_minutes": 5,
            "cook_time_minutes": 15,
            "servings": 3,
            "water_ml": 300,
            "is_public": False,
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredient.id),
                    "quantity_g": 75.0,
                    "display_order": 0
                }
            ]
        }
        
        response = await async_client.post(
            "/recipes/",
            json=recipe_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "API Test Recipe"
        assert data["description"] == "API test description"
        assert data["instructions"] == "API test instructions"
        assert data["prep_time_minutes"] == 5
        assert data["cook_time_minutes"] == 15
        assert data["servings"] == 3
        assert data["water_ml"] == 300
        assert data["is_public"] is False
        assert data["is_published"] is False
        assert data["is_archived"] is False
        assert data["fork_count"] == 0
        assert data["id"] is not None
        assert data["created_at"] is not None
        assert data["updated_at"] is not None
    
    async def test_create_recipe_without_auth(
        self, 
        async_client: AsyncClient,
        sample_ingredient: Ingredient
    ):
        """Test recipe creation without authentication."""
        recipe_data = {
            "name": "Unauthorized Recipe",
            "ingredients": []
        }
        
        response = await async_client.post("/recipes/", json=recipe_data)
        
        assert response.status_code == 401
    
    async def test_create_recipe_invalid_data(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test recipe creation with invalid data."""
        recipe_data = {
            "name": "",  # Empty name should fail
            "servings": 0,  # Zero servings should fail
            "ingredients": []
        }
        
        response = await async_client.post(
            "/recipes/",
            json=recipe_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
    
    async def test_create_recipe_with_invalid_ingredient(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test recipe creation with invalid ingredient ID."""
        recipe_data = {
            "name": "Recipe with Invalid Ingredient",
            "ingredients": [
                {
                    "ingredient_id": str(uuid4()),  # Non-existent ingredient
                    "quantity_g": 100.0,
                    "display_order": 0
                }
            ]
        }
        
        response = await async_client.post(
            "/recipes/",
            json=recipe_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 500  # Internal server error due to ingredient not found


class TestRecipeEndpointsRead:
    """Test recipe reading endpoints."""
    
    async def test_get_recipe_by_owner(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test getting a recipe by its owner."""
        response = await async_client.get(
            f"/recipes/{sample_recipe.id}",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(sample_recipe.id)
        assert data["name"] == "Test Recipe"
        assert data["description"] == "Test description"
        assert data["instructions"] == "Test instructions"
        assert data["prep_time_minutes"] == 10
        assert data["cook_time_minutes"] == 20
        assert data["servings"] == 4
        assert data["water_ml"] == 500
    
    async def test_get_recipe_not_found(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test getting a non-existent recipe."""
        non_existent_id = uuid4()
        
        response = await async_client.get(
            f"/recipes/{non_existent_id}",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    async def test_get_private_recipe_by_other_user(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test getting a private recipe by another user."""
        response = await async_client.get(
            f"/recipes/{sample_recipe.id}",
            headers=other_user_headers
        )
        
        assert response.status_code == 404  # Should return 404 for private recipes
    
    async def test_get_published_recipe_by_other_user(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        published_recipe: Recipe
    ):
        """Test getting a published recipe by another user."""
        response = await async_client.get(
            f"/recipes/{published_recipe.id}",
            headers=other_user_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(published_recipe.id)
        assert data["is_published"] is True
    
    async def test_get_recipe_without_auth(
        self, 
        async_client: AsyncClient,
        published_recipe: Recipe
    ):
        """Test getting a published recipe without authentication."""
        response = await async_client.get(f"/recipes/{published_recipe.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(published_recipe.id)
        assert data["is_published"] is True
    
    async def test_list_recipes_basic(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test basic recipe listing."""
        response = await async_client.get("/recipes/", headers=recipe_owner_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert "has_next" in data
        assert "has_prev" in data
        
        assert data["total"] >= 1
        assert len(data["items"]) >= 1
    
    async def test_list_recipes_pagination(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        db_session: AsyncSession,
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient
    ):
        """Test recipe listing with pagination."""
        # Create multiple recipes
        service = RecipeService(db_session)
        for i in range(5):
            recipe_data = RecipeCreate(
                name=f"Recipe {i}",
                description=f"Description {i}",
                servings=2
            )
            await service.create_recipe(recipe_owner.id, recipe_data)
        
        # Test first page
        response = await async_client.get(
            "/recipes/?page=1&page_size=3",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 5
        assert len(data["items"]) == 3
        assert data["page"] == 1
        assert data["page_size"] == 3
        assert data["has_next"] is True
        assert data["has_prev"] is False
        
        # Test second page
        response = await async_client.get(
            "/recipes/?page=2&page_size=3",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 2
        assert data["has_prev"] is True
    
    async def test_list_recipes_with_filters(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test recipe listing with filters."""
        # Test query filter
        response = await async_client.get(
            "/recipes/?query=Test",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 1
        assert any("Test" in item["name"] for item in data["items"])
        
        # Test time filters
        response = await async_client.get(
            "/recipes/?max_prep_time=15&max_cook_time=25",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 1
        for item in data["items"]:
            if item["prep_time_minutes"]:
                assert item["prep_time_minutes"] <= 15
            if item["cook_time_minutes"]:
                assert item["cook_time_minutes"] <= 25
    
    async def test_search_recipes(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test recipe search endpoint."""
        response = await async_client.get(
            "/recipes/search?query=Test&min_servings=2&max_servings=6",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 1
        assert any("Test" in item["name"] for item in data["items"])
        for item in data["items"]:
            assert 2 <= item["servings"] <= 6


class TestRecipeEndpointsUpdate:
    """Test recipe update endpoints."""
    
    async def test_update_recipe_basic(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test basic recipe update."""
        update_data = {
            "name": "Updated Recipe Name",
            "description": "Updated description",
            "prep_time_minutes": 25,
            "servings": 8
        }
        
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json=update_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "Updated Recipe Name"
        assert data["description"] == "Updated description"
        assert data["prep_time_minutes"] == 25
        assert data["servings"] == 8
        # Unchanged fields should remain the same
        assert data["instructions"] == "Test instructions"
        assert data["cook_time_minutes"] == 20
    
    async def test_update_recipe_not_found(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test updating a non-existent recipe."""
        non_existent_id = uuid4()
        update_data = {"name": "Updated Recipe"}
        
        response = await async_client.put(
            f"/recipes/{non_existent_id}",
            json=update_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 404
    
    async def test_update_recipe_permission_denied(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test updating a recipe without permission."""
        update_data = {"name": "Unauthorized Update"}
        
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json=update_data,
            headers=other_user_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"]
    
    async def test_update_recipe_without_auth(
        self, 
        async_client: AsyncClient,
        sample_recipe: Recipe
    ):
        """Test updating a recipe without authentication."""
        update_data = {"name": "Unauthorized Update"}
        
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json=update_data
        )
        
        assert response.status_code == 401
    
    async def test_update_recipe_invalid_data(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test updating a recipe with invalid data."""
        update_data = {
            "name": "",  # Empty name should fail
            "servings": 0  # Zero servings should fail
        }
        
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json=update_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422


class TestRecipeEndpointsDelete:
    """Test recipe deletion endpoints."""
    
    async def test_delete_recipe_success(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test successful recipe deletion."""
        response = await async_client.delete(
            f"/recipes/{sample_recipe.id}",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 204
        
        # Verify recipe is no longer accessible
        response = await async_client.get(
            f"/recipes/{sample_recipe.id}",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 404
    
    async def test_delete_recipe_not_found(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test deleting a non-existent recipe."""
        non_existent_id = uuid4()
        
        response = await async_client.delete(
            f"/recipes/{non_existent_id}",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 404
    
    async def test_delete_recipe_permission_denied(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test deleting a recipe without permission."""
        response = await async_client.delete(
            f"/recipes/{sample_recipe.id}",
            headers=other_user_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"]
    
    async def test_delete_recipe_without_auth(
        self, 
        async_client: AsyncClient,
        sample_recipe: Recipe
    ):
        """Test deleting a recipe without authentication."""
        response = await async_client.delete(f"/recipes/{sample_recipe.id}")
        
        assert response.status_code == 401


class TestRecipeEndpointsActions:
    """Test recipe action endpoints (publish, unpublish, fork, duplicate)."""
    
    async def test_publish_recipe(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test publishing a recipe."""
        publish_data = {"make_public": True}
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/publish",
            json=publish_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_published"] is True
        assert data["is_public"] is True
        assert data["published_at"] is not None
    
    async def test_publish_already_published_recipe(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        published_recipe: Recipe
    ):
        """Test publishing an already published recipe."""
        publish_data = {"make_public": True}
        
        response = await async_client.post(
            f"/recipes/{published_recipe.id}/publish",
            json=publish_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 400
        assert "already published" in response.json()["detail"]
    
    async def test_publish_recipe_permission_denied(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test publishing a recipe without permission."""
        publish_data = {"make_public": True}
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/publish",
            json=publish_data,
            headers=other_user_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"]
    
    async def test_unpublish_recipe(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        published_recipe: Recipe
    ):
        """Test unpublishing a recipe."""
        response = await async_client.post(
            f"/recipes/{published_recipe.id}/unpublish",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_published"] is False
        assert data["published_at"] is None
    
    async def test_unpublish_not_published_recipe(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test unpublishing a recipe that's not published."""
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/unpublish",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 400
        assert "not published" in response.json()["detail"]
    
    async def test_fork_recipe(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        published_recipe: Recipe
    ):
        """Test forking a published recipe."""
        fork_data = {"new_name": "My Forked Recipe"}
        
        response = await async_client.post(
            f"/recipes/{published_recipe.id}/fork",
            json=fork_data,
            headers=other_user_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "My Forked Recipe"
        assert data["id"] != str(published_recipe.id)
        assert data["is_published"] is False
        assert data["is_public"] is False
        assert data["original_recipe_id"] == str(published_recipe.id)
    
    async def test_fork_unpublished_recipe(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test forking an unpublished recipe."""
        fork_data = {"new_name": "My Forked Recipe"}
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/fork",
            json=fork_data,
            headers=other_user_headers
        )
        
        assert response.status_code == 400
        assert "published" in response.json()["detail"]
    
    async def test_fork_own_recipe(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        published_recipe: Recipe
    ):
        """Test forking your own recipe."""
        fork_data = {"new_name": "My Forked Recipe"}
        
        response = await async_client.post(
            f"/recipes/{published_recipe.id}/fork",
            json=fork_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 400
        assert "own recipe" in response.json()["detail"]
    
    async def test_duplicate_recipe(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test duplicating a recipe."""
        duplicate_data = {"new_name": "My Duplicate Recipe", "make_private": False}
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/duplicate",
            json=duplicate_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "My Duplicate Recipe"
        assert data["id"] != str(sample_recipe.id)
        assert data["is_published"] is False
        assert data["original_recipe_id"] is None  # Not a fork
    
    async def test_duplicate_recipe_permission_denied(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test duplicating a recipe without permission."""
        duplicate_data = {"new_name": "My Duplicate Recipe", "make_private": False}
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/duplicate",
            json=duplicate_data,
            headers=other_user_headers
        )
        
        assert response.status_code == 404  # Should return 404 for private recipes


class TestRecipeEndpointsErrorHandling:
    """Test error handling in recipe endpoints."""
    
    async def test_invalid_recipe_id_format(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test endpoints with invalid UUID format."""
        invalid_id = "not-a-uuid"
        
        response = await async_client.get(
            f"/recipes/{invalid_id}",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
    
    async def test_missing_required_fields(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test creating recipe with missing required fields."""
        incomplete_data = {
            "description": "Missing name field"
        }
        
        response = await async_client.post(
            "/recipes/",
            json=incomplete_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
    
    async def test_invalid_pagination_params(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test recipe listing with invalid pagination parameters."""
        # Test negative page
        response = await async_client.get(
            "/recipes/?page=-1",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        
        # Test zero page
        response = await async_client.get(
            "/recipes/?page=0",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        
        # Test invalid page size
        response = await async_client.get(
            "/recipes/?page_size=101",  # Exceeds max limit
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
    
    async def test_invalid_filter_params(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test recipe filtering with invalid parameters."""
        # Test negative time values
        response = await async_client.get(
            "/recipes/?max_prep_time=-1",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        
        # Test invalid servings
        response = await async_client.get(
            "/recipes/?min_servings=0",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        
        # Test invalid sort order
        response = await async_client.get(
            "/recipes/?sort_order=invalid",
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422


class TestRecipeEndpointsAuthorization:
    """Test authorization checks in recipe endpoints."""
    
    async def test_endpoints_require_authentication(
        self, 
        async_client: AsyncClient,
        sample_recipe: Recipe
    ):
        """Test that protected endpoints require authentication."""
        # Test POST (create)
        response = await async_client.post(
            "/recipes/",
            json={"name": "Test Recipe"}
        )
        assert response.status_code == 401
        
        # Test PUT (update)
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json={"name": "Updated Recipe"}
        )
        assert response.status_code == 401
        
        # Test DELETE
        response = await async_client.delete(f"/recipes/{sample_recipe.id}")
        assert response.status_code == 401
        
        # Test publish
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/publish",
            json={"make_public": True}
        )
        assert response.status_code == 401
        
        # Test unpublish
        response = await async_client.post(f"/recipes/{sample_recipe.id}/unpublish")
        assert response.status_code == 401
        
        # Test fork
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/fork",
            json={"new_name": "Forked Recipe"}
        )
        assert response.status_code == 401
        
        # Test duplicate
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/duplicate",
            json={"new_name": "Duplicate Recipe", "make_private": False}
        )
        assert response.status_code == 401
    
    async def test_public_endpoints_allow_anonymous(
        self, 
        async_client: AsyncClient,
        published_recipe: Recipe
    ):
        """Test that public endpoints allow anonymous access."""
        # Test GET (public recipe)
        response = await async_client.get(f"/recipes/{published_recipe.id}")
        assert response.status_code == 200
        
        # Test LIST (public recipes)
        response = await async_client.get("/recipes/")
        assert response.status_code == 200
        
        # Test SEARCH (public recipes)
        response = await async_client.get("/recipes/search")
        assert response.status_code == 200
    
    async def test_owner_permissions(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test that recipe owners can perform all operations."""
        # Test GET
        response = await async_client.get(
            f"/recipes/{sample_recipe.id}",
            headers=recipe_owner_headers
        )
        assert response.status_code == 200
        
        # Test PUT
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json={"name": "Updated Recipe"},
            headers=recipe_owner_headers
        )
        assert response.status_code == 200
        
        # Test publish
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/publish",
            json={"make_public": True},
            headers=recipe_owner_headers
        )
        assert response.status_code == 200
        
        # Test duplicate
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/duplicate",
            json={"new_name": "Duplicate Recipe", "make_private": False},
            headers=recipe_owner_headers
        )
        assert response.status_code == 200
    
    async def test_non_owner_permissions(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe,
        published_recipe: Recipe
    ):
        """Test that non-owners have limited permissions."""
        # Test GET private recipe (should fail)
        response = await async_client.get(
            f"/recipes/{sample_recipe.id}",
            headers=other_user_headers
        )
        assert response.status_code == 404
        
        # Test GET public recipe (should succeed)
        response = await async_client.get(
            f"/recipes/{published_recipe.id}",
            headers=other_user_headers
        )
        assert response.status_code == 200
        
        # Test PUT (should fail)
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json={"name": "Updated Recipe"},
            headers=other_user_headers
        )
        assert response.status_code == 403
        
        # Test DELETE (should fail)
        response = await async_client.delete(
            f"/recipes/{sample_recipe.id}",
            headers=other_user_headers
        )
        assert response.status_code == 403
        
        # Test publish (should fail)
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/publish",
            json={"make_public": True},
            headers=other_user_headers
        )
        assert response.status_code == 403
        
        # Test fork public recipe (should succeed)
        response = await async_client.post(
            f"/recipes/{published_recipe.id}/fork",
            json={"new_name": "Forked Recipe"},
            headers=other_user_headers
        )
        assert response.status_code == 200


class TestRecipeEndpointsValidation:
    """Test recipe endpoint validation integration."""
    
    async def test_create_recipe_validation_errors(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test recipe creation with comprehensive validation errors."""
        # Test missing required fields
        response = await async_client.post(
            "/recipes/",
            json={},
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "details" in data["error"]
        
        # Check that required fields are mentioned in error details
        detail_fields = [detail.get("field", "") for detail in data["error"]["details"]]
        assert any("name" in field for field in detail_fields)
        assert any("ingredients" in field for field in detail_fields)
    
    async def test_create_recipe_field_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test individual field validation."""
        # Test invalid field values
        invalid_data = {
            "name": "",  # Empty name
            "description": "x" * 2001,  # Too long description
            "prep_time_minutes": -1,  # Negative time
            "cook_time_minutes": 10001,  # Too long time
            "servings": 0,  # Zero servings
            "water_ml": -100,  # Negative water
            "ingredients": []  # Empty ingredients
        }
        
        response = await async_client.post(
            "/recipes/",
            json=invalid_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert len(data["error"]["details"]) > 0
    
    async def test_create_recipe_ingredient_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_ingredient: Ingredient
    ):
        """Test ingredient validation in recipe creation."""
        # Test invalid ingredient data
        invalid_ingredient_data = {
            "name": "Test Recipe",
            "description": "Test description",
            "instructions": "Test instructions",
            "prep_time_minutes": 10,
            "cook_time_minutes": 20,
            "servings": 2,
            "ingredients": [
                {
                    "ingredient_id": "invalid-uuid",  # Invalid UUID
                    "quantity_g": 100.0,
                    "display_order": 0
                }
            ]
        }
        
        response = await async_client.post(
            "/recipes/",
            json=invalid_ingredient_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        
        # Test negative quantity
        negative_quantity_data = {
            "name": "Test Recipe",
            "description": "Test description",
            "instructions": "Test instructions",
            "prep_time_minutes": 10,
            "cook_time_minutes": 20,
            "servings": 2,
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredient.id),
                    "quantity_g": -10.0,  # Negative quantity
                    "display_order": 0
                }
            ]
        }
        
        response = await async_client.post(
            "/recipes/",
            json=negative_quantity_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
    
    async def test_update_recipe_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test recipe update validation."""
        # Test invalid update data
        invalid_update_data = {
            "name": "",  # Empty name
            "servings": 0,  # Zero servings
            "prep_time_minutes": -5  # Negative time
        }
        
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json=invalid_update_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert len(data["error"]["details"]) > 0
    
    async def test_recipe_search_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test recipe search parameter validation."""
        # Test invalid pagination parameters
        response = await async_client.get(
            "/recipes/search",
            params={
                "page": 0,  # Invalid page
                "per_page": 0,  # Invalid per_page
                "min_prep_time": -1,  # Invalid min_prep_time
                "max_prep_time": -1,  # Invalid max_prep_time
                "min_servings": 0,  # Invalid min_servings
                "max_servings": 0  # Invalid max_servings
            },
            headers=recipe_owner_headers
        )
        
        # Should either return 422 for validation or handle gracefully
        assert response.status_code in [200, 422]
        
        if response.status_code == 422:
            data = response.json()
            assert "error" in data
    
    async def test_recipe_publish_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test recipe publish request validation."""
        # Test invalid publish data
        invalid_publish_data = {
            "make_public": "not_a_boolean"  # Invalid boolean
        }
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/publish",
            json=invalid_publish_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
    
    async def test_recipe_fork_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        published_recipe: Recipe
    ):
        """Test recipe fork request validation."""
        # Test invalid fork data
        invalid_fork_data = {
            "new_name": "",  # Empty name
            "make_public": "not_a_boolean"  # Invalid boolean
        }
        
        response = await async_client.post(
            f"/recipes/{published_recipe.id}/fork",
            json=invalid_fork_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
    
    async def test_recipe_duplicate_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test recipe duplicate request validation."""
        # Test invalid duplicate data
        invalid_duplicate_data = {
            "new_name": "",  # Empty name
            "include_images": "not_a_boolean"  # Invalid boolean
        }
        
        response = await async_client.post(
            f"/recipes/{sample_recipe.id}/duplicate",
            json=invalid_duplicate_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
    
    async def test_recipe_validation_error_format(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test that validation errors are properly formatted."""
        # Send request with multiple validation errors
        invalid_data = {
            "name": "",  # Empty name
            "description": "x" * 2001,  # Too long
            "prep_time_minutes": -1,  # Negative
            "servings": 0,  # Zero
            "ingredients": []  # Empty
        }
        
        response = await async_client.post(
            "/recipes/",
            json=invalid_data,
            headers=recipe_owner_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        
        # Check error structure
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
        assert "details" in data["error"]
        
        # Check that details are properly formatted
        for detail in data["error"]["details"]:
            assert "field" in detail
            assert "message" in detail
            assert isinstance(detail["field"], str)
            assert isinstance(detail["message"], str)
        
        # Check that request ID is included if available
        if "X-Request-ID" in response.headers:
            assert "request_id" in data["error"]
    
    async def test_recipe_content_type_validation(
        self, 
        async_client: AsyncClient,
        recipe_owner_headers: Dict[str, str]
    ):
        """Test content type validation for recipe endpoints."""
        # Test with invalid content type
        response = await async_client.post(
            "/recipes/",
            data="invalid data",  # Not JSON
            headers={
                **recipe_owner_headers,
                "Content-Type": "text/plain"
            }
        )
        
        # Should return 422 or 415 for unsupported media type
        assert response.status_code in [415, 422]
    
    async def test_recipe_permission_validation(
        self, 
        async_client: AsyncClient,
        other_user_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test permission validation for recipe operations."""
        # Test updating recipe without ownership
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json={"name": "Updated Name"},
            headers=other_user_headers
        )
        
        assert response.status_code == 403
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "PERMISSION_DENIED"
        
        # Test deleting recipe without ownership
        response = await async_client.delete(
            f"/recipes/{sample_recipe.id}",
            headers=other_user_headers
        )
        
        assert response.status_code == 403
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "PERMISSION_DENIED"
    
    async def test_recipe_authentication_validation(
        self, 
        async_client: AsyncClient,
        sample_recipe: Recipe
    ):
        """Test authentication validation for recipe endpoints."""
        # Test creating recipe without authentication
        response = await async_client.post(
            "/recipes/",
            json={"name": "Test Recipe", "ingredients": []}
        )
        
        assert response.status_code == 401
        
        # Test updating recipe without authentication
        response = await async_client.put(
            f"/recipes/{sample_recipe.id}",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 401
        
        # Test deleting recipe without authentication
        response = await async_client.delete(
            f"/recipes/{sample_recipe.id}"
        )
        
        assert response.status_code == 401