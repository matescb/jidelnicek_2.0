"""
Comprehensive tests for Recipe Service CRUD functionality.

This module provides complete test coverage for the RecipeService class,
including all CRUD operations, ingredient management, publishing, forking,
and authorization checks.
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4, UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.recipe.services.recipe_service import RecipeService
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.ingredient import RecipeIngredient
from jidelnicek.recipe.models.recipe_version import RecipeVersion
from jidelnicek.recipe.schemas import (
    RecipeCreate, RecipeUpdate, RecipeSearch, RecipeIngredientCreate,
    RecipeDuplicateRequest, RecipeVersionCreate
)
from jidelnicek.recipe.exceptions import (
    RecipeNotFoundError, RecipePermissionError, RecipeUnpublishError,
    RecipeNotPublishedError, RecipeSelfForkError, RecipeAlreadyPublishedError,
    RecipeNotPublishedForUnpublishError, RecipeValidationError,
    IngredientNotFoundError, DuplicateIngredientError
)
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.common.models.nutritional_value import NutritionalValue
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher


pytestmark = pytest.mark.asyncio


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture
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


class TestRecipeServiceCrud:
    """Test basic CRUD operations for recipes."""
    
    async def test_create_recipe_basic(self, db_session: AsyncSession, recipe_owner: AuthUser):
        """Test basic recipe creation."""
        recipe_data = RecipeCreate(
            name="Basic Recipe",
            description="Basic description",
            instructions="Basic instructions",
            prep_time_minutes=5,
            cook_time_minutes=10,
            servings=2,
            water_ml=100
        )
        
        service = RecipeService(db_session)
        recipe = await service.create_recipe(recipe_owner.id, recipe_data)
        
        assert recipe.id is not None
        assert recipe.user_id == recipe_owner.id
        assert recipe.name == "Basic Recipe"
        assert recipe.description == "Basic description"
        assert recipe.instructions == "Basic instructions"
        assert recipe.prep_time_minutes == 5
        assert recipe.cook_time_minutes == 10
        assert recipe.servings == 2
        assert recipe.water_ml == 100
        assert recipe.is_public is False
        assert recipe.is_published is False
        assert recipe.is_archived is False
        assert recipe.fork_count == 0
        assert recipe.original_recipe_id is None
    
    async def test_create_recipe_with_ingredients(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient,
        sample_ingredient_2: Ingredient
    ):
        """Test recipe creation with ingredients."""
        recipe_data = RecipeCreate(
            name="Recipe with Ingredients",
            description="Recipe with ingredients",
            instructions="Mix ingredients",
            servings=3,
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=sample_ingredient.id,
                    quantity_g=Decimal('100.0'),
                    display_order=0
                ),
                RecipeIngredientCreate(
                    ingredient_id=sample_ingredient_2.id,
                    quantity_g=Decimal('50.0'),
                    display_order=1
                )
            ]
        )
        
        service = RecipeService(db_session)
        recipe = await service.create_recipe(recipe_owner.id, recipe_data)
        
        assert recipe.id is not None
        assert len(recipe.ingredients) == 2
        
        # Check first ingredient
        ingredient_1 = recipe.ingredients[0]
        assert ingredient_1.ingredient_id == sample_ingredient.id
        assert ingredient_1.quantity_g == Decimal('100.0')
        assert ingredient_1.display_order == 0
        
        # Check second ingredient
        ingredient_2 = recipe.ingredients[1]
        assert ingredient_2.ingredient_id == sample_ingredient_2.id
        assert ingredient_2.quantity_g == Decimal('50.0')
        assert ingredient_2.display_order == 1
    
    async def test_create_recipe_with_invalid_ingredient(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test recipe creation with invalid ingredient ID."""
        invalid_ingredient_id = uuid4()
        recipe_data = RecipeCreate(
            name="Invalid Ingredient Recipe",
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=invalid_ingredient_id,
                    quantity_g=Decimal('100.0'),
                    display_order=0
                )
            ]
        )
        
        service = RecipeService(db_session)
        
        with pytest.raises(IngredientNotFoundError) as exc_info:
            await service.create_recipe(recipe_owner.id, recipe_data)
        
        assert exc_info.value.ingredient_id == invalid_ingredient_id
    
    async def test_get_recipe_success(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test getting a recipe successfully."""
        service = RecipeService(db_session)
        recipe = await service.get_recipe(sample_recipe.id, recipe_owner.id)
        
        assert recipe.id == sample_recipe.id
        assert recipe.name == "Test Recipe"
        assert recipe.user_id == recipe_owner.id
        assert len(recipe.ingredients) == 1
    
    async def test_get_recipe_not_found(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test getting a non-existent recipe."""
        service = RecipeService(db_session)
        non_existent_id = uuid4()
        
        with pytest.raises(RecipeNotFoundError) as exc_info:
            await service.get_recipe(non_existent_id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == non_existent_id
    
    async def test_get_recipe_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test getting a private recipe without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.get_recipe(sample_recipe.id, other_user.id)
    
    async def test_get_published_recipe_by_other_user(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        published_recipe: Recipe
    ):
        """Test getting a published recipe by another user."""
        service = RecipeService(db_session)
        recipe = await service.get_recipe(published_recipe.id, other_user.id)
        
        assert recipe.id == published_recipe.id
        assert recipe.is_published is True
    
    async def test_update_recipe_basic(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test basic recipe update."""
        service = RecipeService(db_session)
        
        update_data = RecipeUpdate(
            name="Updated Recipe",
            description="Updated description",
            prep_time_minutes=15,
            servings=6
        )
        
        updated_recipe = await service.update_recipe(
            sample_recipe.id, 
            recipe_owner.id, 
            update_data,
            create_version=False
        )
        
        assert updated_recipe.name == "Updated Recipe"
        assert updated_recipe.description == "Updated description"
        assert updated_recipe.prep_time_minutes == 15
        assert updated_recipe.servings == 6
        # Original unchanged fields should remain
        assert updated_recipe.instructions == "Test instructions"
        assert updated_recipe.cook_time_minutes == 20
    
    async def test_update_recipe_not_found(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test updating a non-existent recipe."""
        service = RecipeService(db_session)
        non_existent_id = uuid4()
        
        update_data = RecipeUpdate(name="Updated Recipe")
        
        with pytest.raises(RecipeNotFoundError) as exc_info:
            await service.update_recipe(non_existent_id, recipe_owner.id, update_data)
        
        assert exc_info.value.recipe_id == non_existent_id
    
    async def test_update_recipe_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test updating a recipe without permission."""
        service = RecipeService(db_session)
        
        update_data = RecipeUpdate(name="Updated Recipe")
        
        with pytest.raises(RecipePermissionError):
            await service.update_recipe(sample_recipe.id, other_user.id, update_data)
    
    async def test_delete_recipe_success(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test successful recipe deletion (archiving)."""
        service = RecipeService(db_session)
        
        deleted_recipe = await service.delete_recipe(sample_recipe.id, recipe_owner.id)
        
        assert deleted_recipe.is_archived is True
        assert deleted_recipe.is_published is False
        assert deleted_recipe.published_at is None
        
        # Verify recipe is no longer accessible
        with pytest.raises(RecipeNotFoundError):
            await service.get_recipe(sample_recipe.id, recipe_owner.id)
    
    async def test_delete_recipe_not_found(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test deleting a non-existent recipe."""
        service = RecipeService(db_session)
        non_existent_id = uuid4()
        
        with pytest.raises(RecipeNotFoundError) as exc_info:
            await service.delete_recipe(non_existent_id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == non_existent_id
    
    async def test_delete_recipe_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test deleting a recipe without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.delete_recipe(sample_recipe.id, other_user.id)
    
    async def test_list_user_recipes(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test listing user's recipes."""
        service = RecipeService(db_session)
        
        recipes, total = await service.list_user_recipes(recipe_owner.id, skip=0, limit=10)
        
        assert total == 1
        assert len(recipes) == 1
        assert recipes[0].id == sample_recipe.id
    
    async def test_list_user_recipes_pagination(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient
    ):
        """Test pagination in user recipe listing."""
        service = RecipeService(db_session)
        
        # Create multiple recipes
        for i in range(5):
            recipe_data = RecipeCreate(
                name=f"Recipe {i}",
                description=f"Description {i}",
                servings=2
            )
            await service.create_recipe(recipe_owner.id, recipe_data)
        
        # Test pagination
        recipes, total = await service.list_user_recipes(recipe_owner.id, skip=0, limit=3)
        assert total == 5
        assert len(recipes) == 3
        
        # Test second page
        recipes, total = await service.list_user_recipes(recipe_owner.id, skip=3, limit=3)
        assert total == 5
        assert len(recipes) == 2


class TestRecipeServiceIngredientManagement:
    """Test ingredient management operations."""
    
    async def test_add_ingredient_to_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient_2: Ingredient
    ):
        """Test adding an ingredient to an existing recipe."""
        service = RecipeService(db_session)
        
        ingredient_data = RecipeIngredientCreate(
            ingredient_id=sample_ingredient_2.id,
            quantity_g=Decimal('75.0'),
            display_order=1
        )
        
        recipe_ingredient = await service.add_ingredient_to_recipe(
            sample_recipe.id, 
            recipe_owner.id, 
            ingredient_data,
            create_version=False
        )
        
        assert recipe_ingredient.ingredient_id == sample_ingredient_2.id
        assert recipe_ingredient.quantity_g == Decimal('75.0')
        assert recipe_ingredient.display_order == 1
        
        # Verify recipe now has 2 ingredients
        updated_recipe = await service.get_recipe(sample_recipe.id, recipe_owner.id)
        assert len(updated_recipe.ingredients) == 2
    
    async def test_add_duplicate_ingredient_to_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test adding a duplicate ingredient to a recipe."""
        service = RecipeService(db_session)
        
        # The recipe already has sample_ingredient
        ingredient_data = RecipeIngredientCreate(
            ingredient_id=sample_ingredient.id,
            quantity_g=Decimal('75.0'),
            display_order=1
        )
        
        with pytest.raises(DuplicateIngredientError) as exc_info:
            await service.add_ingredient_to_recipe(
                sample_recipe.id, 
                recipe_owner.id, 
                ingredient_data
            )
        
        assert exc_info.value.recipe_id == sample_recipe.id
        assert exc_info.value.ingredient_id == sample_ingredient.id
    
    async def test_add_ingredient_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient_2: Ingredient
    ):
        """Test adding ingredient without permission."""
        service = RecipeService(db_session)
        
        ingredient_data = RecipeIngredientCreate(
            ingredient_id=sample_ingredient_2.id,
            quantity_g=Decimal('75.0'),
            display_order=1
        )
        
        with pytest.raises(RecipePermissionError):
            await service.add_ingredient_to_recipe(
                sample_recipe.id, 
                other_user.id, 
                ingredient_data
            )
    
    async def test_update_recipe_ingredient(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test updating an ingredient quantity in a recipe."""
        service = RecipeService(db_session)
        
        updated_ingredient = await service.update_recipe_ingredient(
            sample_recipe.id,
            sample_ingredient.id,
            recipe_owner.id,
            Decimal('200.0'),
            create_version=False
        )
        
        assert updated_ingredient.quantity_g == Decimal('200.0')
        
        # Verify in database
        updated_recipe = await service.get_recipe(sample_recipe.id, recipe_owner.id)
        assert updated_recipe.ingredients[0].quantity_g == Decimal('200.0')
    
    async def test_update_nonexistent_ingredient(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test updating a non-existent ingredient in a recipe."""
        service = RecipeService(db_session)
        non_existent_ingredient_id = uuid4()
        
        with pytest.raises(IngredientNotFoundError) as exc_info:
            await service.update_recipe_ingredient(
                sample_recipe.id,
                non_existent_ingredient_id,
                recipe_owner.id,
                Decimal('200.0')
            )
        
        assert exc_info.value.ingredient_id == non_existent_ingredient_id
    
    async def test_update_ingredient_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test updating ingredient without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.update_recipe_ingredient(
                sample_recipe.id,
                sample_ingredient.id,
                other_user.id,
                Decimal('200.0')
            )
    
    async def test_remove_ingredient_from_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test removing an ingredient from a recipe."""
        service = RecipeService(db_session)
        
        # Verify ingredient exists first
        original_recipe = await service.get_recipe(sample_recipe.id, recipe_owner.id)
        assert len(original_recipe.ingredients) == 1
        
        await service.remove_ingredient_from_recipe(
            sample_recipe.id,
            sample_ingredient.id,
            recipe_owner.id,
            create_version=False
        )
        
        # Verify ingredient is removed
        updated_recipe = await service.get_recipe(sample_recipe.id, recipe_owner.id)
        assert len(updated_recipe.ingredients) == 0
    
    async def test_remove_nonexistent_ingredient(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test removing a non-existent ingredient from a recipe."""
        service = RecipeService(db_session)
        non_existent_ingredient_id = uuid4()
        
        with pytest.raises(IngredientNotFoundError) as exc_info:
            await service.remove_ingredient_from_recipe(
                sample_recipe.id,
                non_existent_ingredient_id,
                recipe_owner.id
            )
        
        assert exc_info.value.ingredient_id == non_existent_ingredient_id
    
    async def test_remove_ingredient_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test removing ingredient without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.remove_ingredient_from_recipe(
                sample_recipe.id,
                sample_ingredient.id,
                other_user.id
            )


class TestRecipeServicePublishingAndForking:
    """Test recipe publishing and forking functionality."""
    
    async def test_publish_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test publishing a recipe."""
        service = RecipeService(db_session)
        
        published_recipe = await service.publish_recipe(sample_recipe.id, recipe_owner.id)
        
        assert published_recipe.is_published is True
        assert published_recipe.is_public is True
        assert published_recipe.published_at is not None
    
    async def test_publish_already_published_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        published_recipe: Recipe
    ):
        """Test publishing an already published recipe."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipeAlreadyPublishedError) as exc_info:
            await service.publish_recipe(published_recipe.id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == published_recipe.id
    
    async def test_publish_recipe_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test publishing recipe without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.publish_recipe(sample_recipe.id, other_user.id)
    
    async def test_unpublish_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        published_recipe: Recipe
    ):
        """Test unpublishing a recipe."""
        service = RecipeService(db_session)
        
        unpublished_recipe = await service.unpublish_recipe(published_recipe.id, recipe_owner.id)
        
        assert unpublished_recipe.is_published is False
        assert unpublished_recipe.published_at is None
    
    async def test_unpublish_not_published_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test unpublishing a recipe that's not published."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipeNotPublishedForUnpublishError) as exc_info:
            await service.unpublish_recipe(sample_recipe.id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == sample_recipe.id
    
    async def test_unpublish_recipe_with_many_forks(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        published_recipe: Recipe
    ):
        """Test unpublishing a recipe with too many forks."""
        service = RecipeService(db_session)
        
        # Manually set fork count to exceed limit
        published_recipe.fork_count = 6
        await db_session.commit()
        
        with pytest.raises(RecipeUnpublishError) as exc_info:
            await service.unpublish_recipe(published_recipe.id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == published_recipe.id
        assert exc_info.value.fork_count == 6
    
    async def test_fork_recipe(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        published_recipe: Recipe
    ):
        """Test forking a published recipe."""
        service = RecipeService(db_session)
        
        forked_recipe = await service.fork_recipe(
            published_recipe.id, 
            other_user.id,
            "My Forked Recipe"
        )
        
        assert forked_recipe.user_id == other_user.id
        assert forked_recipe.name == "My Forked Recipe"
        assert forked_recipe.original_recipe_id == published_recipe.id
        assert forked_recipe.is_published is False
        assert forked_recipe.is_public is False
        assert len(forked_recipe.ingredients) == len(published_recipe.ingredients)
        
        # Verify original recipe fork count increased
        original_recipe = await service.get_recipe(published_recipe.id, other_user.id)
        assert original_recipe.fork_count == 1
    
    async def test_fork_recipe_default_name(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        published_recipe: Recipe
    ):
        """Test forking a recipe with default name."""
        service = RecipeService(db_session)
        
        forked_recipe = await service.fork_recipe(published_recipe.id, other_user.id)
        
        assert forked_recipe.name == f"{published_recipe.name} (fork)"
    
    async def test_fork_unpublished_recipe(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test forking an unpublished recipe."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipeNotPublishedError) as exc_info:
            await service.fork_recipe(sample_recipe.id, other_user.id)
        
        assert exc_info.value.recipe_id == sample_recipe.id
    
    async def test_fork_own_recipe(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        published_recipe: Recipe
    ):
        """Test forking your own recipe."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipeSelfForkError) as exc_info:
            await service.fork_recipe(published_recipe.id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == published_recipe.id


class TestRecipeServiceDuplicate:
    """Test recipe duplication functionality."""
    
    async def test_duplicate_recipe_basic(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test basic recipe duplication."""
        service = RecipeService(db_session)
        
        result = await service.duplicate_recipe(sample_recipe.id, recipe_owner.id)
        
        assert result.original_recipe_id == sample_recipe.id
        assert result.duplicated_recipe_id != sample_recipe.id
        assert "(Copy)" in result.message
        
        # Verify the duplicated recipe
        duplicated_recipe = await service.get_recipe(result.duplicated_recipe_id, recipe_owner.id)
        
        assert duplicated_recipe.name == "Test Recipe (Copy)"
        assert duplicated_recipe.description == sample_recipe.description
        assert duplicated_recipe.instructions == sample_recipe.instructions
        assert duplicated_recipe.user_id == recipe_owner.id
        assert duplicated_recipe.is_published is False
        assert duplicated_recipe.original_recipe_id is None  # Not a fork
        assert len(duplicated_recipe.ingredients) == len(sample_recipe.ingredients)
    
    async def test_duplicate_recipe_custom_name(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test recipe duplication with custom name."""
        service = RecipeService(db_session)
        
        duplicate_request = RecipeDuplicateRequest(new_name="My Custom Recipe")
        result = await service.duplicate_recipe(
            sample_recipe.id, 
            recipe_owner.id, 
            duplicate_request
        )
        
        duplicated_recipe = await service.get_recipe(result.duplicated_recipe_id, recipe_owner.id)
        assert duplicated_recipe.name == "My Custom Recipe"
    
    async def test_duplicate_recipe_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test duplicating recipe without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.duplicate_recipe(sample_recipe.id, other_user.id)


class TestRecipeServiceSearch:
    """Test recipe search functionality."""
    
    async def test_search_recipes_basic(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test basic recipe search."""
        service = RecipeService(db_session)
        
        search_params = RecipeSearch(
            query="Test",
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        
        assert total == 1
        assert len(recipes) == 1
        assert recipes[0].id == sample_recipe.id
    
    async def test_search_recipes_by_time_filter(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test recipe search with time filters."""
        service = RecipeService(db_session)
        
        # Search with time filter that should match
        search_params = RecipeSearch(
            max_prep_time=15,
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 1
        
        # Search with time filter that should not match
        search_params = RecipeSearch(
            max_prep_time=5,
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 0
    
    async def test_search_recipes_by_servings_filter(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test recipe search with servings filters."""
        service = RecipeService(db_session)
        
        # Search with servings filter that should match
        search_params = RecipeSearch(
            min_servings=2,
            max_servings=6,
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 1
        
        # Search with servings filter that should not match
        search_params = RecipeSearch(
            min_servings=10,
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 0
    
    async def test_search_recipes_by_ingredients(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test recipe search by ingredients."""
        service = RecipeService(db_session)
        
        search_params = RecipeSearch(
            has_ingredients=[sample_ingredient.id],
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 1
        assert recipes[0].id == sample_recipe.id
    
    async def test_search_recipes_published_filter(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        published_recipe: Recipe
    ):
        """Test recipe search with published filter."""
        service = RecipeService(db_session)
        
        # Search for published recipes
        search_params = RecipeSearch(
            is_published=True,
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 1
        assert recipes[0].id == published_recipe.id
        
        # Search for unpublished recipes
        search_params = RecipeSearch(
            is_published=False,
            user_id=recipe_owner.id
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert total == 1
        assert recipes[0].id == sample_recipe.id


class TestRecipeServiceValidation:
    """Test recipe service validation integration."""
    
    async def test_create_recipe_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient
    ):
        """Test recipe creation with validation integration."""
        service = RecipeService(db_session)
        
        # Test successful validation
        valid_recipe_data = RecipeCreate(
            name="Valid Recipe",
            description="Valid description",
            instructions="Valid instructions",
            prep_time_minutes=10,
            cook_time_minutes=20,
            servings=4,
            water_ml=300,
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=sample_ingredient.id,
                    quantity_g=Decimal('100.0'),
                    display_order=0
                )
            ]
        )
        
        recipe = await service.create_recipe(recipe_owner.id, valid_recipe_data)
        assert recipe.name == "Valid Recipe"
        assert recipe.user_id == recipe_owner.id
        assert len(recipe.ingredients) == 1
    
    async def test_create_recipe_ingredient_validation(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient
    ):
        """Test ingredient validation in recipe creation."""
        service = RecipeService(db_session)
        
        # Test with non-existent ingredient
        invalid_recipe_data = RecipeCreate(
            name="Invalid Recipe",
            description="Test description",
            instructions="Test instructions",
            prep_time_minutes=10,
            cook_time_minutes=20,
            servings=4,
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=uuid4(),  # Non-existent ingredient
                    quantity_g=Decimal('100.0'),
                    display_order=0
                )
            ]
        )
        
        with pytest.raises(IngredientNotFoundError):
            await service.create_recipe(recipe_owner.id, invalid_recipe_data)
    
    async def test_create_recipe_duplicate_ingredient_validation(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient
    ):
        """Test duplicate ingredient validation."""
        service = RecipeService(db_session)
        
        # Test with duplicate ingredients
        duplicate_recipe_data = RecipeCreate(
            name="Duplicate Ingredient Recipe",
            description="Test description",
            instructions="Test instructions",
            prep_time_minutes=10,
            cook_time_minutes=20,
            servings=4,
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=sample_ingredient.id,
                    quantity_g=Decimal('100.0'),
                    display_order=0
                ),
                RecipeIngredientCreate(
                    ingredient_id=sample_ingredient.id,  # Same ingredient
                    quantity_g=Decimal('50.0'),
                    display_order=1
                )
            ]
        )
        
        with pytest.raises(DuplicateIngredientError):
            await service.create_recipe(recipe_owner.id, duplicate_recipe_data)
    
    async def test_update_recipe_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test recipe update validation integration."""
        service = RecipeService(db_session)
        
        # Test successful update validation
        valid_update_data = RecipeUpdate(
            name="Updated Recipe Name",
            description="Updated description",
            prep_time_minutes=15,
            servings=6
        )
        
        updated_recipe = await service.update_recipe(
            sample_recipe.id, 
            recipe_owner.id, 
            valid_update_data
        )
        
        assert updated_recipe.name == "Updated Recipe Name"
        assert updated_recipe.description == "Updated description"
        assert updated_recipe.prep_time_minutes == 15
        assert updated_recipe.servings == 6
    
    async def test_update_recipe_ingredient_validation(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test ingredient validation in recipe updates."""
        service = RecipeService(db_session)
        
        # Test updating with non-existent ingredient
        invalid_update_data = RecipeUpdate(
            name="Updated Recipe",
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=uuid4(),  # Non-existent ingredient
                    quantity_g=Decimal('100.0'),
                    display_order=0
                )
            ]
        )
        
        with pytest.raises(IngredientNotFoundError):
            await service.update_recipe(
                sample_recipe.id, 
                recipe_owner.id, 
                invalid_update_data
            )
    
    async def test_recipe_permission_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test permission validation in recipe operations."""
        service = RecipeService(db_session)
        
        # Test update without permission
        update_data = RecipeUpdate(name="Unauthorized Update")
        
        with pytest.raises(RecipePermissionError):
            await service.update_recipe(
                sample_recipe.id, 
                other_user.id,  # Different user
                update_data
            )
        
        # Test delete without permission
        with pytest.raises(RecipePermissionError):
            await service.delete_recipe(sample_recipe.id, other_user.id)
        
        # Test publish without permission
        with pytest.raises(RecipePermissionError):
            await service.publish_recipe(sample_recipe.id, other_user.id)
    
    async def test_recipe_publish_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test publish validation integration."""
        service = RecipeService(db_session)
        
        # Test successful publish
        published_recipe = await service.publish_recipe(sample_recipe.id, recipe_owner.id)
        assert published_recipe.is_published is True
        assert published_recipe.published_at is not None
        
        # Test double publish (should raise error)
        with pytest.raises(RecipeAlreadyPublishedError):
            await service.publish_recipe(sample_recipe.id, recipe_owner.id)
    
    async def test_recipe_unpublish_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        published_recipe: Recipe
    ):
        """Test unpublish validation integration."""
        service = RecipeService(db_session)
        
        # Test successful unpublish
        unpublished_recipe = await service.unpublish_recipe(published_recipe.id, recipe_owner.id)
        assert unpublished_recipe.is_published is False
        assert unpublished_recipe.published_at is None
        
        # Test unpublish non-published recipe (should raise error)
        with pytest.raises(RecipeNotPublishedForUnpublishError):
            await service.unpublish_recipe(published_recipe.id, recipe_owner.id)
    
    async def test_recipe_fork_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        other_user: AuthUser,
        published_recipe: Recipe
    ):
        """Test fork validation integration."""
        service = RecipeService(db_session)
        
        # Test successful fork
        forked_recipe = await service.fork_recipe(
            published_recipe.id, 
            other_user.id, 
            new_name="Forked Recipe"
        )
        
        assert forked_recipe.name == "Forked Recipe"
        assert forked_recipe.user_id == other_user.id
        assert forked_recipe.parent_recipe_id == published_recipe.id
        assert forked_recipe.is_published is False
        
        # Test self-fork (should raise error)
        with pytest.raises(RecipeSelfForkError):
            await service.fork_recipe(
                published_recipe.id, 
                recipe_owner.id,  # Same user as owner
                new_name="Self Fork"
            )
        
        # Test fork unpublished recipe (should raise error)
        unpublished_recipe = await service.create_recipe(
            recipe_owner.id,
            RecipeCreate(
                name="Unpublished Recipe",
                description="Test",
                instructions="Test",
                prep_time_minutes=10,
                cook_time_minutes=20,
                servings=4,
                ingredients=[]
            )
        )
        
        with pytest.raises(RecipeNotPublishedError):
            await service.fork_recipe(
                unpublished_recipe.id, 
                other_user.id, 
                new_name="Fork of Unpublished"
            )
    
    async def test_recipe_search_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        published_recipe: Recipe
    ):
        """Test search validation integration."""
        service = RecipeService(db_session)
        
        # Test search with valid parameters
        search_params = RecipeSearch(
            name="Test",
            user_id=recipe_owner.id,
            is_published=True,
            min_prep_time=0,
            max_prep_time=60,
            min_servings=1,
            max_servings=10
        )
        
        recipes, total = await service.search_recipes(search_params, skip=0, limit=10)
        assert isinstance(recipes, list)
        assert isinstance(total, int)
        assert total >= 0
        
        # Test search with edge case parameters
        edge_case_params = RecipeSearch(
            min_prep_time=0,
            max_prep_time=0,  # Same min/max
            min_servings=1,
            max_servings=1  # Same min/max
        )
        
        recipes, total = await service.search_recipes(edge_case_params, skip=0, limit=10)
        assert isinstance(recipes, list)
        assert isinstance(total, int)
    
    async def test_recipe_validation_error_handling(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test error handling in validation scenarios."""
        service = RecipeService(db_session)
        
        # Test creating recipe with empty ingredients list
        empty_ingredients_data = RecipeCreate(
            name="Empty Ingredients Recipe",
            description="Test description",
            instructions="Test instructions",
            prep_time_minutes=10,
            cook_time_minutes=20,
            servings=4,
            ingredients=[]  # Empty ingredients
        )
        
        # Should succeed (empty ingredients might be allowed)
        recipe = await service.create_recipe(recipe_owner.id, empty_ingredients_data)
        assert recipe.name == "Empty Ingredients Recipe"
        assert len(recipe.ingredients) == 0
    
    async def test_recipe_nutritional_validation_integration(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_ingredient: Ingredient
    ):
        """Test nutritional validation integration."""
        service = RecipeService(db_session)
        
        # Create recipe with ingredient that has nutritional data
        recipe_data = RecipeCreate(
            name="Nutritional Recipe",
            description="Recipe with nutritional data",
            instructions="Test instructions",
            prep_time_minutes=10,
            cook_time_minutes=20,
            servings=4,
            ingredients=[
                RecipeIngredientCreate(
                    ingredient_id=sample_ingredient.id,
                    quantity_g=Decimal('100.0'),
                    display_order=0
                )
            ]
        )
        
        recipe = await service.create_recipe(recipe_owner.id, recipe_data)
        
        # Recipe should be created successfully
        assert recipe.name == "Nutritional Recipe"
        assert len(recipe.ingredients) == 1
        
        # Nutritional calculations should be available
        # (This depends on the nutrition calculator implementation)
        ingredient = recipe.ingredients[0]
        assert ingredient.quantity_g == Decimal('100.0')
        assert ingredient.ingredient_id == sample_ingredient.id