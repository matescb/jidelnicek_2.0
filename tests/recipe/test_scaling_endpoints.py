"""
Tests for recipe scaling API endpoints.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from uuid import uuid4
from typing import Dict, Any

import httpx
from httpx import AsyncClient

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.common.models.nutritional_value import NutritionalValue


pytestmark = pytest.mark.asyncio


class TestRecipeScalingEndpoints:
    """Test recipe scaling preview endpoints."""
    
    @pytest_asyncio.fixture(scope="function")
    async def auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create authenticated user and return auth headers."""
        # Register user
        register_data = {
            "email": "scaling_test@example.com",
            "password": "ScalingTest123!",
            "password_confirmation": "ScalingTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "scaling_test@example.com",
            "password": "ScalingTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
    
    @pytest_asyncio.fixture(scope="function")
    async def sample_recipe(self, db_session, existing_user) -> Recipe:
        """Create a sample recipe with ingredients."""
        # Create nutritional values
        flour_nutrition = NutritionalValue(
            calories=Decimal("364"),
            proteins=Decimal("10.3"),
            carbohydrates=Decimal("76.3"),
            fats=Decimal("1.0")
        )
        db_session.add(flour_nutrition)
        
        milk_nutrition = NutritionalValue(
            calories=Decimal("42"),
            proteins=Decimal("3.4"),
            carbohydrates=Decimal("5.0"),
            fats=Decimal("1.0")
        )
        db_session.add(milk_nutrition)
        
        egg_nutrition = NutritionalValue(
            calories=Decimal("155"),
            proteins=Decimal("13"),
            carbohydrates=Decimal("1.1"),
            fats=Decimal("11")
        )
        db_session.add(egg_nutrition)
        
        # Create ingredients
        flour = Ingredient(
            name="Flour",
            user_id=existing_user.id,
            nutritional_value=flour_nutrition,
            is_global=True
        )
        db_session.add(flour)
        
        milk = Ingredient(
            name="Milk",
            user_id=existing_user.id,
            nutritional_value=milk_nutrition,
            is_global=True
        )
        db_session.add(milk)
        
        eggs = Ingredient(
            name="Eggs",
            user_id=existing_user.id,
            nutritional_value=egg_nutrition,
            is_global=True
        )
        db_session.add(eggs)
        
        # Create recipe
        recipe = Recipe(
            user_id=existing_user.id,
            title="Pancakes",
            description="Simple pancake recipe",
            instructions="Mix and cook",
            prep_time=10,
            cook_time=15,
            servings=4,
            is_public=True
        )
        db_session.add(recipe)
        await db_session.flush()
        
        # Create recipe ingredients
        recipe_flour = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=flour.id,
            quantity=Decimal("200"),
            unit="g"
        )
        db_session.add(recipe_flour)
        
        recipe_milk = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=milk.id,
            quantity=Decimal("250"),
            unit="ml"
        )
        db_session.add(recipe_milk)
        
        recipe_eggs = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=eggs.id,
            quantity=Decimal("2"),
            unit="piece"
        )
        db_session.add(recipe_eggs)
        
        await db_session.commit()
        await db_session.refresh(recipe)
        
        return recipe
    
    async def test_preview_basic_scaling(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test basic recipe scaling preview."""
        request_data = {
            "target_servings": 6,
            "use_rounding": True,
            "use_constraints": True
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["recipe_id"] == str(sample_recipe.id)
        assert data["recipe_name"] == "Pancakes"
        assert data["original_servings"] == 4
        assert data["target_servings"] == 6
        assert data["scaling_factor"] == 1.5
        assert data["constraints_applied"] is True
        assert data["rounding_applied"] is True
        
        # Check ingredients
        assert len(data["ingredients"]) == 3
        
        # Check flour scaling (200g * 1.5 = 300g)
        flour = next(i for i in data["ingredients"] if i["name"] == "Flour")
        assert flour["original_quantity"] == 200.0
        assert flour["scaled_quantity"] == 300.0
        assert flour["unit"] == "g"
        assert flour["was_rounded"] is True
        
        # Check eggs scaling (2 * 1.5 = 3, rounded to whole number)
        eggs = next(i for i in data["ingredients"] if i["name"] == "Eggs")
        assert eggs["original_quantity"] == 2.0
        assert eggs["scaled_quantity"] == 3.0
        assert eggs["unit"] == "piece"
    
    async def test_preview_scaling_without_rounding(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test scaling preview without rounding."""
        request_data = {
            "target_servings": 5,
            "use_rounding": False,
            "use_constraints": True
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["scaling_factor"] == 1.25
        assert data["rounding_applied"] is False
        
        # Check eggs without rounding (2 * 1.25 = 2.5)
        eggs = next(i for i in data["ingredients"] if i["name"] == "Eggs")
        assert eggs["scaled_quantity"] == 2.5
    
    async def test_preview_calorie_scaling(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test calorie-based scaling preview."""
        request_data = {
            "target_calories": 500.0,
            "target_servings": 1
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview/calories",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["recipe_id"] == str(sample_recipe.id)
        assert data["target_calories"] == 500.0
        assert data["target_servings"] == 1
        assert "original_calories_total" in data
        assert "scaled_calories_total" in data
        assert "scaling_factor" in data
        
        # Verify scaled calories are close to target
        assert abs(data["scaled_calories_per_serving"] - 500.0) < 50  # Within 10%
    
    async def test_preview_participant_scaling(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test participant-based scaling preview."""
        request_data = {
            "participants": [
                {"name": "Adult 1", "coefficient": 100},
                {"name": "Adult 2", "coefficient": 120},
                {"name": "Child", "coefficient": 75},
                {"name": "Athlete", "coefficient": 150, "meal_coefficients": {"Breakfast": 175}}
            ],
            "meal_type": "Breakfast"
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview/participants",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["participant_count"] == 4
        assert data["meal_type"] == "Breakfast"
        assert len(data["participant_details"]) == 4
        
        # Check athlete with meal coefficient
        athlete = next(p for p in data["participant_details"] if p["name"] == "Athlete")
        assert athlete["base_coefficient"] == 150
        assert athlete["meal_coefficient"] == 175
        assert athlete["effective_coefficient"] > 150  # Should be higher due to meal coefficient
        
        # Check effective participants calculation
        # Adult 1: 100%, Adult 2: 120%, Child: 75%, Athlete: 150% * 175% = 262.5%
        # Total: 1.0 + 1.2 + 0.75 + 2.625 = 5.575
        assert abs(data["effective_participants"] - 5.575) < 0.01
    
    async def test_preview_participant_scaling_with_calories(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test participant-based scaling with calorie targets."""
        request_data = {
            "participants": [
                {"name": "Person 1", "coefficient": 100},
                {"name": "Person 2", "coefficient": 80}
            ],
            "target_calories_per_person": 600.0
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview/participants",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["target_calories_per_person"] == 600.0
        assert "total_calories" in data
        assert "calories_per_effective_participant" in data
        
        # Check calorie allocation
        person1 = next(p for p in data["participant_details"] if p["name"] == "Person 1")
        person2 = next(p for p in data["participant_details"] if p["name"] == "Person 2")
        
        assert person1["calories_allocated"] is not None
        assert person2["calories_allocated"] is not None
        assert person1["calories_allocated"] > person2["calories_allocated"]  # Due to coefficient
    
    async def test_preview_scaling_constraints(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test scaling with extreme values triggers constraints."""
        # Test maximum scaling
        request_data = {
            "target_servings": 100,  # 25x scaling from 4 servings
            "use_constraints": True
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be clamped to max 10x
        assert data["scaling_factor"] <= 10.0
        assert len(data["warnings"]) > 0
        assert any("maximum" in w.lower() for w in data["warnings"])
    
    async def test_preview_scaling_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipe: Recipe
    ):
        """Test validation errors in scaling requests."""
        # Test invalid target servings
        request_data = {
            "target_servings": 0
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
        # Test invalid calorie target
        request_data = {
            "target_calories": -100
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview/calories",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
        # Test too many participants
        request_data = {
            "participants": [
                {"name": f"Person {i}", "coefficient": 100}
                for i in range(25)  # Exceeds max 20
            ]
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview/participants",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    async def test_preview_scaling_unauthorized(
        self,
        async_client: AsyncClient,
        sample_recipe: Recipe
    ):
        """Test scaling preview without authentication."""
        request_data = {
            "target_servings": 6
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{sample_recipe.id}/scaling/preview",
            json=request_data
        )
        
        assert response.status_code == 401
    
    async def test_preview_scaling_nonexistent_recipe(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test scaling preview for non-existent recipe."""
        fake_id = uuid4()
        request_data = {
            "target_servings": 6
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{fake_id}/scaling/preview",
            json=request_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404