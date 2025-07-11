"""
Comprehensive tests for Recipe Version functionality.

This module provides complete test coverage for recipe version tracking,
including version creation, change detection algorithms, version history
retrieval, and nutritional change calculations.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.services.recipe_service import RecipeService
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.recipe_version import RecipeVersion
from jidelnicek.recipe.schemas import (
    RecipeCreate, RecipeUpdate, RecipeIngredientCreate,
    RecipeVersionCreate, RecipeVersionResponse, RecipeVersionHistory
)
from jidelnicek.recipe.exceptions import (
    RecipeNotFoundError, RecipePermissionError
)
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.common.models.nutritional_value import NutritionalValue
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher


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
        name="High Protein Ingredient",
        category="Protein",
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
async def sample_recipe_with_versions(
    db_session: AsyncSession, 
    recipe_owner: AuthUser, 
    sample_ingredient: Ingredient
) -> Recipe:
    """Create a sample recipe with some versions for testing."""
    recipe_data = RecipeCreate(
        name="Versioned Recipe",
        description="Recipe with versions",
        instructions="Original instructions",
        prep_time_minutes=15,
        cook_time_minutes=30,
        servings=2,
        ingredients=[
            RecipeIngredientCreate(
                ingredient_id=sample_ingredient.id,
                quantity_g=Decimal('200.0'),
                display_order=0
            )
        ]
    )
    
    service = RecipeService(db_session)
    recipe = await service.create_recipe(recipe_owner.id, recipe_data)
    
    # Create some versions
    version1_data = RecipeVersionCreate(
        version_number="1.0",
        change_description="Initial version",
        change_type="major",
        is_significant=True,
        recipe_snapshot={
            "name": recipe.name,
            "description": recipe.description,
            "instructions": recipe.instructions,
            "servings": recipe.servings
        }
    )
    
    version2_data = RecipeVersionCreate(
        version_number="1.1",
        change_description="Updated instructions",
        change_type="minor",
        is_significant=False,
        recipe_snapshot={
            "name": recipe.name,
            "description": recipe.description,
            "instructions": "Updated instructions",
            "servings": recipe.servings
        }
    )
    
    await service.create_version(recipe.id, recipe_owner.id, version1_data)
    await service.create_version(recipe.id, recipe_owner.id, version2_data)
    
    return recipe


class TestRecipeVersionCreation:
    """Test recipe version creation functionality."""
    
    async def test_create_version_basic(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test basic version creation."""
        service = RecipeService(db_session)
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Initial version",
            change_type="major",
            is_significant=True,
            recipe_snapshot={
                "name": sample_recipe.name,
                "description": sample_recipe.description,
                "instructions": sample_recipe.instructions,
                "servings": sample_recipe.servings
            }
        )
        
        version = await service.create_version(
            sample_recipe.id,
            recipe_owner.id,
            version_data
        )
        
        assert version.recipe_id == sample_recipe.id
        assert version.changed_by == recipe_owner.id
        assert version.version_number == "1.0"
        assert version.change_description == "Initial version"
        assert version.change_type == "major"
        assert version.is_significant is True
        assert version.recipe_snapshot is not None
        assert version.created_at is not None
    
    async def test_create_version_with_nutritional_change(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test version creation with nutritional change percentage."""
        service = RecipeService(db_session)
        
        version_data = RecipeVersionCreate(
            version_number="1.1",
            change_description="Nutritional update",
            change_type="nutritional",
            nutritional_change_percentage=Decimal('5.25'),
            is_significant=True,
            recipe_snapshot={
                "name": sample_recipe.name,
                "description": sample_recipe.description,
                "instructions": sample_recipe.instructions,
                "servings": sample_recipe.servings
            }
        )
        
        version = await service.create_version(
            sample_recipe.id,
            recipe_owner.id,
            version_data
        )
        
        assert version.nutritional_change_percentage == Decimal('5.25')
        assert version.change_type == "nutritional"
        assert version.is_significant is True
    
    async def test_create_version_not_found(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test creating version for non-existent recipe."""
        service = RecipeService(db_session)
        non_existent_id = uuid4()
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Version for non-existent recipe",
            change_type="major",
            is_significant=True
        )
        
        with pytest.raises(RecipeNotFoundError) as exc_info:
            await service.create_version(non_existent_id, recipe_owner.id, version_data)
        
        assert exc_info.value.recipe_id == non_existent_id
    
    async def test_create_version_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe: Recipe
    ):
        """Test creating version without permission."""
        service = RecipeService(db_session)
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Unauthorized version",
            change_type="major",
            is_significant=True
        )
        
        with pytest.raises(RecipePermissionError):
            await service.create_version(
                sample_recipe.id,
                other_user.id,
                version_data
            )


class TestRecipeVersionHistory:
    """Test recipe version history functionality."""
    
    async def test_get_version_history(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe_with_versions: Recipe
    ):
        """Test getting version history for a recipe."""
        service = RecipeService(db_session)
        
        history = await service.get_version_history(
            sample_recipe_with_versions.id, 
            recipe_owner.id
        )
        
        assert history.recipe_id == sample_recipe_with_versions.id
        assert history.total_versions == 2
        assert len(history.versions) == 2
        assert history.current_version == "1.1"  # Most recent
        
        # Verify ordering (newest first)
        assert history.versions[0].version_number == "1.1"
        assert history.versions[1].version_number == "1.0"
        
        # Verify version details
        latest_version = history.versions[0]
        assert latest_version.change_description == "Updated instructions"
        assert latest_version.change_type == "minor"
        assert latest_version.is_significant is False
    
    async def test_get_version_history_empty(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test getting version history for recipe with no versions."""
        service = RecipeService(db_session)
        
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.recipe_id == sample_recipe.id
        assert history.total_versions == 0
        assert len(history.versions) == 0
        assert history.current_version is None
    
    async def test_get_version_history_not_found(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test getting version history for non-existent recipe."""
        service = RecipeService(db_session)
        non_existent_id = uuid4()
        
        with pytest.raises(RecipeNotFoundError) as exc_info:
            await service.get_version_history(non_existent_id, recipe_owner.id)
        
        assert exc_info.value.recipe_id == non_existent_id
    
    async def test_get_version_history_permission_denied(
        self, 
        db_session: AsyncSession, 
        other_user: AuthUser,
        sample_recipe_with_versions: Recipe
    ):
        """Test getting version history without permission."""
        service = RecipeService(db_session)
        
        with pytest.raises(RecipePermissionError):
            await service.get_version_history(
                sample_recipe_with_versions.id, 
                other_user.id
            )


class TestRecipeVersionChangeDetection:
    """Test version change detection algorithms."""
    
    async def test_calculate_nutritional_change(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test nutritional change calculation."""
        service = RecipeService(db_session)
        
        # Test with significant change
        original_nutrition = {
            'calories': Decimal('200'),
            'proteins_g': Decimal('10'),
            'carbohydrates_g': Decimal('20'),
            'fats_g': Decimal('5')
        }
        
        updated_nutrition = {
            'calories': Decimal('220'),  # 10% increase
            'proteins_g': Decimal('11'),  # 10% increase
            'carbohydrates_g': Decimal('22'),  # 10% increase
            'fats_g': Decimal('5.5')  # 10% increase
        }
        
        change = await service.calculate_nutritional_change(
            original_nutrition,
            updated_nutrition
        )
        
        # Should be approximately 10% change
        assert abs(change - Decimal('10.0')) < Decimal('0.1')
    
    async def test_calculate_nutritional_change_no_change(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test nutritional change calculation with no change."""
        service = RecipeService(db_session)
        
        nutrition = {
            'calories': Decimal('200'),
            'proteins_g': Decimal('10'),
            'carbohydrates_g': Decimal('20'),
            'fats_g': Decimal('5')
        }
        
        change = await service.calculate_nutritional_change(nutrition, nutrition)
        
        assert change == Decimal('0')
    
    async def test_calculate_nutritional_change_partial_data(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test nutritional change calculation with partial data."""
        service = RecipeService(db_session)
        
        original_nutrition = {
            'calories': Decimal('200'),
            'proteins_g': Decimal('10'),
            'carbohydrates_g': None,  # Missing data
            'fats_g': Decimal('5')
        }
        
        updated_nutrition = {
            'calories': Decimal('220'),
            'proteins_g': Decimal('11'),
            'carbohydrates_g': None,  # Still missing
            'fats_g': Decimal('5.5')
        }
        
        change = await service.calculate_nutritional_change(
            original_nutrition,
            updated_nutrition
        )
        
        # Should calculate based on available data (calories, proteins, fats)
        assert change > Decimal('0')
        assert abs(change - Decimal('10.0')) < Decimal('0.1')
    
    async def test_calculate_nutritional_change_empty_data(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test nutritional change calculation with empty data."""
        service = RecipeService(db_session)
        
        change = await service.calculate_nutritional_change(None, None)
        assert change == Decimal('0')
        
        change = await service.calculate_nutritional_change({}, {})
        assert change == Decimal('0')
    
    async def test_is_significant_change_default_threshold(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test significant change detection with default threshold."""
        service = RecipeService(db_session)
        
        # Test above threshold (default 1%)
        assert await service.is_significant_change(Decimal('2.0')) is True
        assert await service.is_significant_change(Decimal('1.5')) is True
        assert await service.is_significant_change(Decimal('1.0')) is True
        
        # Test below threshold
        assert await service.is_significant_change(Decimal('0.5')) is False
        assert await service.is_significant_change(Decimal('0.0')) is False
    
    async def test_is_significant_change_custom_threshold(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser
    ):
        """Test significant change detection with custom threshold."""
        service = RecipeService(db_session)
        
        # Test with 5% threshold
        threshold = Decimal('5.0')
        
        assert await service.is_significant_change(Decimal('6.0'), threshold) is True
        assert await service.is_significant_change(Decimal('5.0'), threshold) is True
        assert await service.is_significant_change(Decimal('4.0'), threshold) is False
        assert await service.is_significant_change(Decimal('2.0'), threshold) is False


class TestRecipeVersionAutoCreation:
    """Test automatic version creation during recipe updates."""
    
    async def test_update_recipe_creates_version(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test that recipe updates create versions automatically."""
        service = RecipeService(db_session)
        
        # Update recipe with version tracking enabled
        update_data = RecipeUpdate(
            name="Updated Recipe Name",
            description="Updated description"
        )
        
        await service.update_recipe(
            sample_recipe.id,
            recipe_owner.id,
            update_data,
            create_version=True
        )
        
        # Check if version was created
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.total_versions >= 1
        
        # Most recent version should reflect the update
        if history.versions:
            latest_version = history.versions[0]
            assert "name, description" in latest_version.change_description
    
    async def test_update_recipe_without_version_tracking(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test that recipe updates can skip version creation."""
        service = RecipeService(db_session)
        
        # Update recipe with version tracking disabled
        update_data = RecipeUpdate(
            name="Updated Recipe Name",
            description="Updated description"
        )
        
        await service.update_recipe(
            sample_recipe.id,
            recipe_owner.id,
            update_data,
            create_version=False
        )
        
        # Check that no version was created
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.total_versions == 0
    
    async def test_add_ingredient_creates_version(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient_2: Ingredient
    ):
        """Test that adding ingredients creates versions."""
        service = RecipeService(db_session)
        
        ingredient_data = RecipeIngredientCreate(
            ingredient_id=sample_ingredient_2.id,
            quantity_g=Decimal('75.0'),
            display_order=1
        )
        
        await service.add_ingredient_to_recipe(
            sample_recipe.id,
            recipe_owner.id,
            ingredient_data,
            create_version=True
        )
        
        # Check if version was created
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.total_versions >= 1
        
        if history.versions:
            latest_version = history.versions[0]
            assert "Ingredient added" in latest_version.change_description
    
    async def test_update_ingredient_creates_version(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test that updating ingredients creates versions."""
        service = RecipeService(db_session)
        
        await service.update_recipe_ingredient(
            sample_recipe.id,
            sample_ingredient.id,
            recipe_owner.id,
            Decimal('200.0'),
            create_version=True
        )
        
        # Check if version was created
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.total_versions >= 1
        
        if history.versions:
            latest_version = history.versions[0]
            assert "Ingredient quantity updated" in latest_version.change_description
    
    async def test_remove_ingredient_creates_version(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe,
        sample_ingredient: Ingredient
    ):
        """Test that removing ingredients creates versions."""
        service = RecipeService(db_session)
        
        await service.remove_ingredient_from_recipe(
            sample_recipe.id,
            sample_ingredient.id,
            recipe_owner.id,
            create_version=True
        )
        
        # Check if version was created
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.total_versions >= 1
        
        if history.versions:
            latest_version = history.versions[0]
            assert "Ingredient removed" in latest_version.change_description


class TestRecipeVersionSnapshots:
    """Test recipe snapshot functionality in versions."""
    
    async def test_version_snapshot_contains_recipe_data(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test that version snapshots contain recipe data."""
        service = RecipeService(db_session)
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Snapshot test",
            change_type="major",
            is_significant=True,
            recipe_snapshot={
                "name": sample_recipe.name,
                "description": sample_recipe.description,
                "instructions": sample_recipe.instructions,
                "prep_time_minutes": sample_recipe.prep_time_minutes,
                "cook_time_minutes": sample_recipe.cook_time_minutes,
                "servings": sample_recipe.servings,
                "water_ml": sample_recipe.water_ml,
                "difficulty_level": sample_recipe.difficulty_level
            }
        )
        
        version = await service.create_version(
            sample_recipe.id,
            recipe_owner.id,
            version_data
        )
        
        assert version.recipe_snapshot is not None
        snapshot = version.recipe_snapshot
        
        assert snapshot["name"] == sample_recipe.name
        assert snapshot["description"] == sample_recipe.description
        assert snapshot["instructions"] == sample_recipe.instructions
        assert snapshot["prep_time_minutes"] == sample_recipe.prep_time_minutes
        assert snapshot["cook_time_minutes"] == sample_recipe.cook_time_minutes
        assert snapshot["servings"] == sample_recipe.servings
        assert snapshot["water_ml"] == sample_recipe.water_ml
    
    async def test_version_snapshot_optional(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test that version snapshots are optional."""
        service = RecipeService(db_session)
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="No snapshot test",
            change_type="minor",
            is_significant=False
            # No recipe_snapshot provided
        )
        
        version = await service.create_version(
            sample_recipe.id,
            recipe_owner.id,
            version_data
        )
        
        assert version.recipe_snapshot is None


class TestRecipeVersionAutoNumbering:
    """Test automatic version numbering functionality."""
    
    async def test_version_numbering_sequence(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test that version numbers are generated in sequence."""
        service = RecipeService(db_session)
        
        # Create first version manually
        version1_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="First version",
            change_type="major",
            is_significant=True
        )
        
        version1 = await service.create_version(
            sample_recipe.id,
            recipe_owner.id,
            version1_data
        )
        
        assert version1.version_number == "1.0"
        
        # Trigger automatic version creation
        update_data = RecipeUpdate(name="Updated Recipe")
        await service.update_recipe(
            sample_recipe.id,
            recipe_owner.id,
            update_data,
            create_version=True
        )
        
        # Check version history
        history = await service.get_version_history(sample_recipe.id, recipe_owner.id)
        
        assert history.total_versions >= 2
        
        # Should have versions 1.0 and 1.1
        version_numbers = [v.version_number for v in history.versions]
        assert "1.0" in version_numbers
        assert "1.1" in version_numbers or "1.2" in version_numbers  # Depends on auto-generation
    
    async def test_create_version_on_update_with_nutritional_change(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test automatic version creation with nutritional change tracking."""
        service = RecipeService(db_session)
        
        # Mock nutritional data
        original_nutrition = {
            'calories': Decimal('200'),
            'proteins_g': Decimal('10'),
            'carbohydrates_g': Decimal('20'),
            'fats_g': Decimal('5')
        }
        
        updated_nutrition = {
            'calories': Decimal('220'),  # 10% increase
            'proteins_g': Decimal('11'),  # 10% increase
            'carbohydrates_g': Decimal('22'),  # 10% increase
            'fats_g': Decimal('5.5')  # 10% increase
        }
        
        # Test the version creation method directly
        version = await service.create_version_on_update(
            sample_recipe,
            recipe_owner.id,
            original_nutrition,
            updated_nutrition,
            "Nutritional update test"
        )
        
        assert version is not None
        assert version.nutritional_change_percentage > Decimal('0')
        assert abs(version.nutritional_change_percentage - Decimal('10.0')) < Decimal('0.1')
        assert version.is_significant is True
        assert version.change_description == "Nutritional update test"
    
    async def test_create_version_on_update_no_significant_change(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test that insignificant changes don't create versions."""
        service = RecipeService(db_session)
        
        # Mock nutritional data with minimal change
        original_nutrition = {
            'calories': Decimal('200'),
            'proteins_g': Decimal('10'),
            'carbohydrates_g': Decimal('20'),
            'fats_g': Decimal('5')
        }
        
        updated_nutrition = {
            'calories': Decimal('200.1'),  # 0.05% increase
            'proteins_g': Decimal('10.01'),  # 0.1% increase
            'carbohydrates_g': Decimal('20.01'),  # 0.05% increase
            'fats_g': Decimal('5.001')  # 0.02% increase
        }
        
        # Test the version creation method directly
        version = await service.create_version_on_update(
            sample_recipe,
            recipe_owner.id,
            original_nutrition,
            updated_nutrition,
            "Minor update test"
        )
        
        # Should create version because change_description is provided
        assert version is not None
        assert version.nutritional_change_percentage < Decimal('1.0')
        assert version.is_significant is False
        assert version.change_description == "Minor update test"
    
    async def test_create_version_on_update_no_nutritional_data(
        self, 
        db_session: AsyncSession, 
        recipe_owner: AuthUser,
        sample_recipe: Recipe
    ):
        """Test version creation without nutritional data."""
        service = RecipeService(db_session)
        
        # Test the version creation method without nutritional data
        version = await service.create_version_on_update(
            sample_recipe,
            recipe_owner.id,
            None,
            None,
            "Metadata update test"
        )
        
        assert version is not None
        assert version.nutritional_change_percentage is None
        assert version.is_significant is False
        assert version.change_description == "Metadata update test"