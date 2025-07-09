"""
Tests for recipe scaling API endpoints.

This module tests all scaling preview endpoints with various scenarios.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from typing import Dict, Any
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient

from jidelnicek.recipe.models import Recipe, RecipeIngredient
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.auth.models import AuthUser


@pytest_asyncio.fixture
async def sample_recipe_with_calories(
    db_session: AsyncSession,
    sample_user: AuthUser
) -> Recipe:
    """Create a sample recipe with calorie information."""
    # Create ingredients
    pasta = Ingredient(
        name="Pasta",
        category="grains"
    )
    cheese = Ingredient(
        name="Cheese",
        category="dairy"
    )
    db_session.add_all([pasta, cheese])
    await db_session.flush()
    
    # Create recipe
    recipe = Recipe(
        name="Test Pasta",
        description="A test pasta recipe",
        prep_time_minutes=10,
        cooking_time_minutes=20,
        servings=4,
        difficulty="easy",
        calories_per_serving=450,
        creator_id=sample_user.id,
        is_public=True,
        is_pku_friendly=False
    )
    db_session.add(recipe)
    await db_session.flush()
    
    # Add ingredients
    ingredients = [
        RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=pasta.id,
            amount=Decimal("400"),
            unit="g",
            is_optional=False
        ),
        RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=cheese.id,
            amount=Decimal("100"),
            unit="g",
            is_optional=False
        )
    ]
    db_session.add_all(ingredients)
    await db_session.commit()
    await db_session.refresh(recipe)
    
    return recipe


@pytest_asyncio.fixture
async def private_recipe(
    db_session: AsyncSession,
    sample_user: AuthUser
) -> Recipe:
    """Create a private recipe for permission testing."""
    recipe = Recipe(
        name="Private Recipe",
        description="A private recipe",
        prep_time_minutes=5,
        cooking_time_minutes=10,
        servings=2,
        difficulty="easy",
        creator_id=sample_user.id,
        is_public=False,
        is_pku_friendly=False
    )
    db_session.add(recipe)
    await db_session.commit()
    await db_session.refresh(recipe)
    
    return recipe


class TestBasicScalingEndpoint:
    """Test the basic recipe scaling preview endpoint."""
    
    @pytest.mark.asyncio
    async def test_scale_recipe_by_factor(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling a recipe by a factor."""
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 2.0},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check response structure
        assert data["recipe_id"] == sample_recipe_with_calories.id
        assert data["recipe_title"] == "Test Pasta"
        assert data["scaling_factor"] == 2.0
        assert data["scaling_method"] == "factor"
        assert data["errors"] == []
        assert data["original_participants"] == 4
        assert data["scaled_participants"] == 8
        
        # Check ingredients
        assert len(data["ingredients"]) == 2
        
        # Check pasta scaling
        pasta = next(i for i in data["ingredients"] if i["name"] == "Pasta")
        assert pasta["original_quantity"] == 400.0
        assert pasta["scaled_quantity"] == 800.0
        assert pasta["rounded_quantity"] == 800.0
        
        # Check cheese scaling
        cheese = next(i for i in data["ingredients"] if i["name"] == "Cheese")
        assert cheese["original_quantity"] == 100.0
        assert cheese["scaled_quantity"] == 200.0
        assert cheese["rounded_quantity"] == 200.0
    
    @pytest.mark.asyncio
    async def test_scale_recipe_with_rounding(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling with quantity rounding."""
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 0.75, "round_quantities": True},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check pasta - 400 * 0.75 = 300 (no rounding needed)
        pasta = next(i for i in data["ingredients"] if i["name"] == "Pasta")
        assert pasta["scaled_quantity"] == 300.0
        assert pasta["rounded_quantity"] == 300.0
        
        # Check cheese - 100 * 0.75 = 75
        cheese = next(i for i in data["ingredients"] if i["name"] == "Cheese")
        assert cheese["scaled_quantity"] == 75.0
        assert cheese["rounded_quantity"] == 75.0
    
    @pytest.mark.asyncio
    async def test_scale_recipe_extreme_factor_warnings(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test warnings for extreme scaling factors."""
        # Test very low scaling factor
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 0.2},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert any("very low" in warning for warning in data["warnings"])
        
        # Test very high scaling factor
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 15.0},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert any("very high" in warning for warning in data["warnings"])
    
    @pytest.mark.asyncio
    async def test_scale_recipe_invalid_factor(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test validation of scaling factor."""
        # Zero factor
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 0},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Negative factor
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": -1},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Too high factor
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 101},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_scale_recipe_not_found(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test scaling non-existent recipe."""
        response = await async_client.post(
            "/api/v1/recipes/99999/scaling/preview",
            json={"scaling_factor": 2.0},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_scale_recipe_permission_denied(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_user_headers: Dict[str, str],
        private_recipe: Recipe
    ):
        """Test permission check for private recipes."""
        # Try to scale another user's private recipe
        response = await async_client.post(
            f"/api/v1/recipes/{private_recipe.id}/scaling/preview",
            json={"scaling_factor": 2.0},
            headers=other_user_headers
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    @pytest.mark.asyncio
    async def test_scale_recipe_unauthenticated(
        self,
        async_client: AsyncClient,
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling requires authentication."""
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview",
            json={"scaling_factor": 2.0}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestCalorieScalingEndpoint:
    """Test the calorie-based scaling preview endpoint."""
    
    @pytest.mark.asyncio
    async def test_scale_recipe_by_calories(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling a recipe to achieve target calories."""
        # Recipe has 450 cal/serving * 4 servings = 1800 total
        # Target 900 calories = scale by 0.5
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/calories",
            json={"target_calories": 900},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check response structure
        assert data["recipe_id"] == sample_recipe_with_calories.id
        assert data["scaling_factor"] == 0.5
        assert data["scaling_method"] == "calories"
        assert data["target_calories"] == 900
        assert data["total_calories"] == 900.0
        assert data["calories_per_serving"] == 225.0
        assert data["effective_participants"] == 4
        
        # Check ingredients are scaled by 0.5
        pasta = next(i for i in data["ingredients"] if i["name"] == "Pasta")
        assert pasta["scaled_quantity"] == 200.0
        
        cheese = next(i for i in data["ingredients"] if i["name"] == "Cheese")
        assert cheese["scaled_quantity"] == 50.0
    
    @pytest.mark.asyncio
    async def test_scale_recipe_by_calories_with_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling by calories with specific participant count."""
        # 450 cal/serving * 2 participants = 900 total wanted
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/calories",
            json={"target_calories": 900, "participants": 2},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Scaling factor should be 0.5 (to get from 4 to 2 servings)
        assert data["scaling_factor"] == 0.5
        assert data["effective_participants"] == 2
        assert data["total_calories"] == 900.0
        assert data["calories_per_serving"] == 450.0  # Same per serving
    
    @pytest.mark.asyncio
    async def test_scale_recipe_no_calorie_info(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        db_session: AsyncSession,
        sample_user: AuthUser
    ):
        """Test error when recipe has no calorie information."""
        # Create recipe without calories
        recipe = Recipe(
            name="No Calories Recipe",
            description="Recipe without calorie info",
            prep_time_minutes=10,
            cooking_time_minutes=20,
            servings=4,
            difficulty="easy",
            creator_id=sample_user.id,
            is_public=True,
            is_pku_friendly=False
        )
        db_session.add(recipe)
        await db_session.commit()
        
        response = await async_client.post(
            f"/api/v1/recipes/{recipe.id}/scaling/preview/calories",
            json={"target_calories": 1000},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["errors"]) > 0
        assert "calorie information" in data["errors"][0]
    
    @pytest.mark.asyncio
    async def test_scale_recipe_invalid_calories(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test validation of calorie targets."""
        # Too low
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/calories",
            json={"target_calories": 50},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Too high
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/calories",
            json={"target_calories": 60000},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestParticipantScalingEndpoint:
    """Test the participant-based scaling preview endpoint."""
    
    @pytest.mark.asyncio
    async def test_scale_recipe_by_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling a recipe for different participant count."""
        # Recipe is for 4, scale to 6 = factor 1.5
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/participants",
            json={"target_participants": 6},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check response structure
        assert data["recipe_id"] == sample_recipe_with_calories.id
        assert data["scaling_factor"] == 1.5
        assert data["scaling_method"] == "participants"
        assert data["target_participants"] == 6
        assert data["original_participants"] == 4
        assert data["scaled_participants"] == 6
        
        # Check total calories calculation
        assert data["total_calories"] == 2700.0  # 450 * 6
        
        # Check ingredients are scaled by 1.5
        pasta = next(i for i in data["ingredients"] if i["name"] == "Pasta")
        assert pasta["scaled_quantity"] == 600.0
        
        cheese = next(i for i in data["ingredients"] if i["name"] == "Cheese")
        assert cheese["scaled_quantity"] == 150.0
    
    @pytest.mark.asyncio
    async def test_scale_recipe_no_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        db_session: AsyncSession,
        sample_user: AuthUser
    ):
        """Test scaling when recipe has no participant info."""
        # Create recipe without participants
        recipe = Recipe(
            name="No Participants Recipe",
            description="Recipe without participant info",
            prep_time_minutes=10,
            cooking_time_minutes=20,
            servings=None,
            difficulty="easy",
            creator_id=sample_user.id,
            is_public=True,
            is_pku_friendly=False
        )
        db_session.add(recipe)
        await db_session.flush()
        
        # Add an ingredient
        pasta = Ingredient(name="Pasta", category="grains")
        db_session.add(pasta)
        await db_session.flush()
        
        ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=pasta.id,
            amount=Decimal("400"),
            unit="g"
        )
        db_session.add(ingredient)
        await db_session.commit()
        
        response = await async_client.post(
            f"/api/v1/recipes/{recipe.id}/scaling/preview/participants",
            json={"target_participants": 6},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should assume 4 participants and warn
        assert any("assuming 4" in warning for warning in data["warnings"])
        assert data["scaling_factor"] == 1.5  # 6/4
    
    @pytest.mark.asyncio
    async def test_scale_recipe_invalid_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test validation of participant count."""
        # Zero participants
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/participants",
            json={"target_participants": 0},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Too many participants
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/participants",
            json={"target_participants": 101},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_scale_recipe_single_participant(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe_with_calories: Recipe
    ):
        """Test scaling down to single participant."""
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe_with_calories.id}/scaling/preview/participants",
            json={"target_participants": 1},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["scaling_factor"] == 0.25  # 1/4
        assert data["scaled_participants"] == 1
        
        # Check ingredients are scaled by 0.25
        pasta = next(i for i in data["ingredients"] if i["name"] == "Pasta")
        assert pasta["scaled_quantity"] == 100.0
        
        cheese = next(i for i in data["ingredients"] if i["name"] == "Cheese")
        assert cheese["scaled_quantity"] == 25.0


class TestScalingWithComplexIngredients:
    """Test scaling with various ingredient scenarios."""
    
    @pytest.mark.asyncio
    async def test_scale_recipe_with_optional_ingredients(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        db_session: AsyncSession,
        sample_user: AuthUser
    ):
        """Test scaling includes optional ingredients."""
        # Create recipe with optional ingredient
        recipe = Recipe(
            name="Recipe with Optional",
            description="Has optional ingredients",
            prep_time_minutes=10,
            cooking_time_minutes=20,
            servings=4,
            difficulty="easy",
            creator_id=sample_user.id,
            is_public=True,
            is_pku_friendly=False
        )
        db_session.add(recipe)
        await db_session.flush()
        
        # Create ingredients
        salt = Ingredient(name="Salt", category="spices")
        pepper = Ingredient(name="Pepper", category="spices")
        db_session.add_all([salt, pepper])
        await db_session.flush()
        
        # Add required and optional ingredients
        ingredients = [
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=salt.id,
                amount=Decimal("5"),
                unit="g",
                is_optional=False
            ),
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=pepper.id,
                amount=Decimal("2"),
                unit="g",
                is_optional=True,
                notes="To taste"
            )
        ]
        db_session.add_all(ingredients)
        await db_session.commit()
        
        response = await async_client.post(
            f"/api/v1/recipes/{recipe.id}/scaling/preview",
            json={"scaling_factor": 2.0},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Both ingredients should be scaled
        assert len(data["ingredients"]) == 2
        
        # Check optional ingredient is marked and scaled
        pepper = next(i for i in data["ingredients"] if i["name"] == "Pepper")
        assert pepper["is_optional"] is True
        assert pepper["scaled_quantity"] == 4.0
        assert pepper["notes"] == "To taste"
    
    @pytest.mark.asyncio
    async def test_scale_recipe_with_no_quantity(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        db_session: AsyncSession,
        sample_user: AuthUser
    ):
        """Test scaling ingredients without quantities."""
        # Create recipe
        recipe = Recipe(
            name="Recipe with No Quantities",
            description="Has ingredients without quantities",
            prep_time_minutes=10,
            cooking_time_minutes=20,
            servings=4,
            difficulty="easy",
            creator_id=sample_user.id,
            is_public=True,
            is_pku_friendly=False
        )
        db_session.add(recipe)
        await db_session.flush()
        
        # Create ingredient
        oil = Ingredient(name="Oil", category="oils")
        db_session.add(oil)
        await db_session.flush()
        
        # Add ingredient without quantity
        ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=oil.id,
            amount=None,
            unit=None,
            notes="For frying"
        )
        db_session.add(ingredient)
        await db_session.commit()
        
        response = await async_client.post(
            f"/api/v1/recipes/{recipe.id}/scaling/preview",
            json={"scaling_factor": 2.0},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Ingredient should be included but with None quantities
        oil_data = data["ingredients"][0]
        assert oil_data["name"] == "Oil"
        assert oil_data["original_quantity"] is None
        assert oil_data["scaled_quantity"] is None
        assert oil_data["rounded_quantity"] is None
        assert oil_data["notes"] == "For frying"