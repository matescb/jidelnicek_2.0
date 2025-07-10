"""
Tests for new RecipeService features: duplicate recipe and version tracking.
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from jidelnicek.recipe.services.recipe_service import RecipeService
from jidelnicek.recipe.models import Recipe, RecipeVersion
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.schemas import (
    RecipeCreate, RecipeUpdate, RecipeIngredientCreate,
    RecipeDuplicateRequest, RecipeVersionCreate
)
from jidelnicek.recipe.exceptions import (
    RecipeNotFoundError, RecipePermissionError
)


class TestRecipeServiceDuplicateFeature:
    """Test duplicate recipe functionality."""
    
    @pytest.fixture
    async def sample_recipe(self, db_session, sample_user, sample_ingredient):
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
        recipe = await service.create_recipe(sample_user.id, recipe_data)
        
        # Set some stats to verify they get reset
        recipe.view_count = 10
        recipe.rating_average = Decimal('4.5')
        recipe.rating_count = 3
        recipe.fork_count = 2
        
        await db_session.commit()
        await db_session.refresh(recipe)
        
        return recipe
    
    async def test_duplicate_recipe_basic(self, db_session, sample_user, sample_recipe):
        """Test basic recipe duplication."""
        service = RecipeService(db_session)
        
        # Duplicate the recipe
        result = await service.duplicate_recipe(
            sample_recipe.id,
            sample_user.id
        )
        
        assert result.original_recipe_id == sample_recipe.id
        assert result.duplicated_recipe_id != sample_recipe.id
        assert "(Copy)" in result.message
        
        # Verify the duplicated recipe
        duplicated_recipe = await service.get_recipe(result.duplicated_recipe_id, sample_user.id)
        
        assert duplicated_recipe.name == "Test Recipe (Copy)"
        assert duplicated_recipe.description == sample_recipe.description
        assert duplicated_recipe.instructions == sample_recipe.instructions
        assert duplicated_recipe.prep_time_minutes == sample_recipe.prep_time_minutes
        assert duplicated_recipe.cook_time_minutes == sample_recipe.cook_time_minutes
        assert duplicated_recipe.servings == sample_recipe.servings
        assert duplicated_recipe.water_ml == sample_recipe.water_ml
        
        # Verify stats are reset
        assert duplicated_recipe.view_count == 0
        assert duplicated_recipe.rating_average is None
        assert duplicated_recipe.rating_count == 0
        assert duplicated_recipe.fork_count == 0
        assert duplicated_recipe.is_published == False
        assert duplicated_recipe.published_at is None
        
        # Verify ingredients are copied
        assert len(duplicated_recipe.ingredients) == len(sample_recipe.ingredients)
        orig_ingredient = sample_recipe.ingredients[0]
        dup_ingredient = duplicated_recipe.ingredients[0]
        
        assert dup_ingredient.ingredient_id == orig_ingredient.ingredient_id
        assert dup_ingredient.quantity_g == orig_ingredient.quantity_g
        assert dup_ingredient.display_order == orig_ingredient.display_order
    
    async def test_duplicate_recipe_custom_name(self, db_session, sample_user, sample_recipe):
        """Test recipe duplication with custom name."""
        service = RecipeService(db_session)
        
        custom_name = "My Custom Recipe Name"
        duplicate_request = RecipeDuplicateRequest(new_name=custom_name)
        
        result = await service.duplicate_recipe(
            sample_recipe.id,
            sample_user.id,
            duplicate_request
        )
        
        # Verify the custom name is used
        duplicated_recipe = await service.get_recipe(result.duplicated_recipe_id, sample_user.id)
        assert duplicated_recipe.name == custom_name
    
    async def test_duplicate_recipe_permission_error(self, db_session, sample_user, sample_recipe):
        """Test that users can't duplicate recipes they don't own."""
        service = RecipeService(db_session)
        other_user_id = uuid4()
        
        with pytest.raises(RecipePermissionError):
            await service.duplicate_recipe(
                sample_recipe.id,
                other_user_id
            )
    
    async def test_duplicate_recipe_not_found(self, db_session, sample_user):
        """Test duplication of non-existent recipe."""
        service = RecipeService(db_session)
        non_existent_id = uuid4()
        
        with pytest.raises(RecipeNotFoundError):
            await service.duplicate_recipe(
                non_existent_id,
                sample_user.id
            )


class TestRecipeServiceVersionTracking:
    """Test version tracking functionality."""
    
    @pytest.fixture
    async def sample_recipe(self, db_session, sample_user, sample_ingredient):
        """Create a sample recipe for testing."""
        recipe_data = RecipeCreate(
            name="Test Recipe",
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
                )
            ]
        )
        
        service = RecipeService(db_session)
        recipe = await service.create_recipe(sample_user.id, recipe_data)
        return recipe
    
    async def test_create_version_basic(self, db_session, sample_user, sample_recipe):
        """Test basic version creation."""
        service = RecipeService(db_session)
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Initial version",
            change_type="major",
            is_significant=True
        )
        
        version = await service.create_version(
            sample_recipe.id,
            sample_user.id,
            version_data
        )
        
        assert version.recipe_id == sample_recipe.id
        assert version.changed_by == sample_user.id
        assert version.version_number == "1.0"
        assert version.change_description == "Initial version"
        assert version.change_type == "major"
        assert version.is_significant == True
    
    async def test_get_version_history(self, db_session, sample_user, sample_recipe):
        """Test getting version history."""
        service = RecipeService(db_session)
        
        # Create a couple of versions
        version1_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Initial version",
            change_type="major",
            is_significant=True
        )
        
        version2_data = RecipeVersionCreate(
            version_number="1.1",
            change_description="Minor update",
            change_type="minor",
            is_significant=False
        )
        
        await service.create_version(sample_recipe.id, sample_user.id, version1_data)
        await service.create_version(sample_recipe.id, sample_user.id, version2_data)
        
        # Get version history
        history = await service.get_version_history(sample_recipe.id, sample_user.id)
        
        assert history.recipe_id == sample_recipe.id
        assert history.current_version == "1.1"  # Most recent
        assert history.total_versions == 2
        assert len(history.versions) == 2
        
        # Verify ordering (newest first)
        assert history.versions[0].version_number == "1.1"
        assert history.versions[1].version_number == "1.0"
    
    async def test_calculate_nutritional_change(self, db_session, sample_user):
        """Test nutritional change calculation."""
        service = RecipeService(db_session)
        
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
    
    async def test_is_significant_change(self, db_session, sample_user):
        """Test significant change detection."""
        service = RecipeService(db_session)
        
        # Test above threshold
        assert await service.is_significant_change(Decimal('2.0')) == True
        
        # Test below threshold
        assert await service.is_significant_change(Decimal('0.5')) == False
        
        # Test at threshold
        assert await service.is_significant_change(Decimal('1.0')) == True
        
        # Test with custom threshold
        assert await service.is_significant_change(Decimal('0.5'), Decimal('0.3')) == True
    
    async def test_update_recipe_with_version_tracking(self, db_session, sample_user, sample_recipe):
        """Test that recipe updates create versions when appropriate."""
        service = RecipeService(db_session)
        
        # Update recipe with significant change
        update_data = RecipeUpdate(
            name="Updated Recipe Name",
            description="Updated description"
        )
        
        await service.update_recipe(
            sample_recipe.id,
            sample_user.id,
            update_data,
            create_version=True
        )
        
        # Check if version was created
        history = await service.get_version_history(sample_recipe.id, sample_user.id)
        
        # Should have at least one version
        assert history.total_versions >= 1
        
        # Most recent version should reflect the update
        latest_version = history.versions[0]
        assert "name, description" in latest_version.change_description
    
    async def test_version_creation_permission_error(self, db_session, sample_user, sample_recipe):
        """Test that users can't create versions for recipes they don't own."""
        service = RecipeService(db_session)
        other_user_id = uuid4()
        
        version_data = RecipeVersionCreate(
            version_number="1.0",
            change_description="Unauthorized version",
            change_type="major"
        )
        
        with pytest.raises(RecipePermissionError):
            await service.create_version(
                sample_recipe.id,
                other_user_id,
                version_data
            )