"""
Tests for RecipeCategorizationService.

This module tests the business logic for recipe categorization including:
- Assigning/removing categories and tags
- Primary category management
- Tag suggestions based on ingredients
- Bulk updates and copying categorization
"""

import pytest
import pytest_asyncio
from uuid import uuid4
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.services.recipe_categorization_service import RecipeCategorizationService
from jidelnicek.recipe.services.category_service import CategoryService
from jidelnicek.recipe.services.tag_service import TagService
from jidelnicek.recipe.models import (
    Recipe, Category, Tag, RecipeCategory, RecipeTag,
    RecipeIngredient, Ingredient
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.exceptions import RecipeNotFoundError
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


class TestRecipeCategorizationService:
    """Test suite for RecipeCategorizationService."""
    
    @pytest_asyncio.fixture
    async def service(self, db_session: AsyncSession) -> RecipeCategorizationService:
        """Create RecipeCategorizationService instance."""
        return RecipeCategorizationService(db_session)
    
    @pytest_asyncio.fixture
    async def category_service(self, db_session: AsyncSession) -> CategoryService:
        """Create CategoryService instance."""
        return CategoryService(db_session)
    
    @pytest_asyncio.fixture
    async def tag_service(self, db_session: AsyncSession) -> TagService:
        """Create TagService instance."""
        return TagService(db_session)
    
    @pytest_asyncio.fixture
    async def test_user(self, db_session: AsyncSession) -> AuthUser:
        """Create a test user."""
        user = AuthUser(
            email="test@example.com",
            password_hash="dummy_hash",
            email_verified=True,
            language="en",
            unit_system="metric",
            energy_unit="kcal",
            has_pku=False,
            timezone="Europe/Prague",
            role="user",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user
    
    @pytest_asyncio.fixture
    async def sample_recipe(
        self,
        db_session: AsyncSession,
        test_user: AuthUser
    ) -> Recipe:
        """Create a sample recipe."""
        recipe = Recipe(
            user_id=test_user.id,
            name="Test Recipe",
            description="A test recipe",
            instructions="Test instructions",
            servings=4,
            is_published=True
        )
        db_session.add(recipe)
        await db_session.commit()
        await db_session.refresh(recipe)
        return recipe
    
    @pytest_asyncio.fixture
    async def sample_categories(
        self,
        category_service: CategoryService
    ) -> List[Category]:
        """Create sample categories."""
        main_dishes = await category_service.create_category(
            name="Main Dishes",
            slug="main-dishes"
        )
        
        pasta = await category_service.create_category(
            name="Pasta",
            slug="pasta",
            parent_id=main_dishes.id
        )
        
        desserts = await category_service.create_category(
            name="Desserts",
            slug="desserts"
        )
        
        return [main_dishes, pasta, desserts]
    
    @pytest_asyncio.fixture
    async def sample_tags(
        self,
        tag_service: TagService
    ) -> List[Tag]:
        """Create sample tags."""
        italian = await tag_service.create_tag(name="Italian", slug="italian")
        quick = await tag_service.create_tag(name="Quick", slug="quick")
        vegan = await tag_service.create_tag(name="Vegan", slug="vegan")
        
        return [italian, quick, vegan]
    
    # Category Tests
    
    @pytest.mark.asyncio
    async def test_assign_category_success(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test successful category assignment."""
        category = sample_categories[0]  # Main Dishes
        
        assignment = await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=category.id,
            is_primary=True
        )
        
        assert assignment.recipe_id == sample_recipe.id
        assert assignment.category_id == category.id
        assert assignment.is_primary is True
    
    @pytest.mark.asyncio
    async def test_assign_category_duplicate(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test assigning duplicate category."""
        category = sample_categories[0]
        
        # First assignment
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=category.id
        )
        
        # Duplicate assignment
        with pytest.raises(ConflictError) as exc_info:
            await service.assign_category(
                recipe_id=sample_recipe.id,
                category_id=category.id
            )
        
        assert "already assigned" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_assign_category_recipe_not_found(
        self,
        service: RecipeCategorizationService,
        sample_categories: List[Category]
    ):
        """Test assigning category to non-existent recipe."""
        with pytest.raises(RecipeNotFoundError):
            await service.assign_category(
                recipe_id=uuid4(),
                category_id=sample_categories[0].id
            )
    
    @pytest.mark.asyncio
    async def test_assign_category_not_found(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe
    ):
        """Test assigning non-existent category."""
        with pytest.raises(NotFoundError):
            await service.assign_category(
                recipe_id=sample_recipe.id,
                category_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_assign_primary_category(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test primary category assignment."""
        # Assign first category as primary
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[0].id,
            is_primary=True
        )
        
        # Assign second category as primary (should unset first)
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[1].id,
            is_primary=True
        )
        
        # Check categories
        categories = await service.get_recipe_categories(sample_recipe.id)
        primary_count = sum(1 for cat in categories if cat.recipe_categories[0].is_primary)
        
        assert primary_count == 1
        assert categories[0].id == sample_categories[1].id  # New primary should be first
    
    @pytest.mark.asyncio
    async def test_remove_category(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test removing category from recipe."""
        category = sample_categories[0]
        
        # Assign category
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=category.id
        )
        
        # Remove category
        result = await service.remove_category(
            recipe_id=sample_recipe.id,
            category_id=category.id
        )
        
        assert result is True
        
        # Verify removal
        categories = await service.get_recipe_categories(sample_recipe.id)
        assert len(categories) == 0
    
    @pytest.mark.asyncio
    async def test_remove_category_not_found(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test removing non-assigned category."""
        with pytest.raises(NotFoundError):
            await service.remove_category(
                recipe_id=sample_recipe.id,
                category_id=sample_categories[0].id
            )
    
    @pytest.mark.asyncio
    async def test_set_primary_category(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test setting primary category."""
        # Assign multiple categories
        for cat in sample_categories[:2]:
            await service.assign_category(
                recipe_id=sample_recipe.id,
                category_id=cat.id,
                is_primary=False
            )
        
        # Set one as primary
        await service.set_primary_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[1].id
        )
        
        # Get primary category
        primary = await service.get_primary_category(sample_recipe.id)
        assert primary is not None
        assert primary.id == sample_categories[1].id
    
    @pytest.mark.asyncio
    async def test_set_primary_category_new(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test setting primary category that wasn't assigned."""
        # Set category as primary (should assign and set as primary)
        result = await service.set_primary_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[0].id
        )
        
        assert result.is_primary is True
        
        # Verify it's assigned
        categories = await service.get_recipe_categories(sample_recipe.id)
        assert len(categories) == 1
        assert categories[0].id == sample_categories[0].id
    
    @pytest.mark.asyncio
    async def test_get_recipe_categories(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test getting recipe categories."""
        # Assign categories with different orders
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[2].id,  # Desserts
            is_primary=False
        )
        
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[0].id,  # Main Dishes
            is_primary=True
        )
        
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[1].id,  # Pasta
            is_primary=False
        )
        
        # Get categories
        categories = await service.get_recipe_categories(sample_recipe.id)
        
        assert len(categories) == 3
        # Primary category should be first
        assert categories[0].slug == "main-dishes"
    
    # Tag Tests
    
    @pytest.mark.asyncio
    async def test_assign_tag_success(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_tags: List[Tag]
    ):
        """Test successful tag assignment."""
        tag = sample_tags[0]  # Italian
        
        assignment = await service.assign_tag(
            recipe_id=sample_recipe.id,
            tag_id=tag.id
        )
        
        assert assignment.recipe_id == sample_recipe.id
        assert assignment.tag_id == tag.id
        
        # Check usage count incremented
        updated_tag = await service.tag_service.get_tag(tag.id)
        assert updated_tag.usage_count == 1
    
    @pytest.mark.asyncio
    async def test_assign_tag_duplicate(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_tags: List[Tag]
    ):
        """Test assigning duplicate tag."""
        tag = sample_tags[0]
        
        # First assignment
        await service.assign_tag(
            recipe_id=sample_recipe.id,
            tag_id=tag.id
        )
        
        # Duplicate assignment
        with pytest.raises(ConflictError) as exc_info:
            await service.assign_tag(
                recipe_id=sample_recipe.id,
                tag_id=tag.id
            )
        
        assert "already has tag" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_remove_tag(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_tags: List[Tag]
    ):
        """Test removing tag from recipe."""
        tag = sample_tags[0]
        
        # Assign tag
        await service.assign_tag(
            recipe_id=sample_recipe.id,
            tag_id=tag.id
        )
        
        # Check usage count
        updated_tag = await service.tag_service.get_tag(tag.id)
        assert updated_tag.usage_count == 1
        
        # Remove tag
        result = await service.remove_tag(
            recipe_id=sample_recipe.id,
            tag_id=tag.id
        )
        
        assert result is True
        
        # Check usage count decremented
        updated_tag = await service.tag_service.get_tag(tag.id)
        assert updated_tag.usage_count == 0
        
        # Verify removal
        tags = await service.get_recipe_tags(sample_recipe.id)
        assert len(tags) == 0
    
    @pytest.mark.asyncio
    async def test_assign_tags_by_slug(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_tags: List[Tag]
    ):
        """Test assigning tags by slug."""
        slugs = ["italian", "quick", "non-existent"]
        
        assignments = await service.assign_tags_by_slug(
            recipe_id=sample_recipe.id,
            tag_slugs=slugs
        )
        
        # Should assign 2 tags (non-existent is skipped)
        assert len(assignments) == 2
        
        # Verify assignments
        tags = await service.get_recipe_tags(sample_recipe.id)
        tag_slugs = {tag.slug for tag in tags}
        assert tag_slugs == {"italian", "quick"}
    
    @pytest.mark.asyncio
    async def test_get_recipe_tags(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_tags: List[Tag]
    ):
        """Test getting recipe tags."""
        # Set usage counts for ordering test
        sample_tags[0].usage_count = 10
        sample_tags[1].usage_count = 20
        sample_tags[2].usage_count = 5
        await service.session.commit()
        
        # Assign all tags
        for tag in sample_tags:
            await service.assign_tag(
                recipe_id=sample_recipe.id,
                tag_id=tag.id
            )
        
        # Get tags
        tags = await service.get_recipe_tags(sample_recipe.id)
        
        assert len(tags) == 3
        # Should be ordered by usage count desc
        assert tags[0].slug == "quick"  # usage_count = 20 + 1
        assert tags[1].slug == "italian"  # usage_count = 10 + 1
        assert tags[2].slug == "vegan"  # usage_count = 5 + 1
    
    # Suggestion Tests
    
    @pytest.mark.asyncio
    async def test_suggest_categories(
        self,
        service: RecipeCategorizationService,
        db_session: AsyncSession,
        sample_recipe: Recipe,
        sample_categories: List[Category],
        test_user: AuthUser
    ):
        """Test category suggestions based on similar recipes."""
        # Create ingredients
        pasta_ing = Ingredient(
            name="Pasta",
            category="grains",
            energy_kcal_per_100g=371.0
        )
        tomato_ing = Ingredient(
            name="Tomato",
            category="vegetables",
            energy_kcal_per_100g=18.0
        )
        db_session.add_all([pasta_ing, tomato_ing])
        await db_session.commit()
        
        # Add ingredients to our recipe
        for ing in [pasta_ing, tomato_ing]:
            recipe_ing = RecipeIngredient(
                recipe_id=sample_recipe.id,
                ingredient_id=ing.id,
                amount=100.0,
                unit="g"
            )
            db_session.add(recipe_ing)
        await db_session.commit()
        
        # Create similar recipe with categories
        similar_recipe = Recipe(
            user_id=test_user.id,
            name="Similar Pasta Recipe",
            description="Another pasta dish",
            instructions="Cook pasta",
            servings=4,
            is_published=True
        )
        db_session.add(similar_recipe)
        await db_session.commit()
        
        # Add same ingredients
        for ing in [pasta_ing, tomato_ing]:
            recipe_ing = RecipeIngredient(
                recipe_id=similar_recipe.id,
                ingredient_id=ing.id,
                amount=150.0,
                unit="g"
            )
            db_session.add(recipe_ing)
        
        # Assign categories to similar recipe
        await service.assign_category(
            recipe_id=similar_recipe.id,
            category_id=sample_categories[1].id  # Pasta
        )
        
        await db_session.commit()
        
        # Get suggestions
        suggestions = await service.suggest_categories(
            recipe_id=sample_recipe.id,
            max_suggestions=5
        )
        
        # Should suggest Pasta category
        suggestion_ids = {cat.id for cat in suggestions}
        assert sample_categories[1].id in suggestion_ids
    
    @pytest.mark.asyncio
    async def test_suggest_tags_based_on_ingredients(
        self,
        service: RecipeCategorizationService,
        db_session: AsyncSession,
        sample_recipe: Recipe
    ):
        """Test tag suggestions based on ingredients."""
        # This delegates to tag_service, so just test the interface
        suggestions = await service.suggest_tags_based_on_ingredients(
            recipe_id=sample_recipe.id,
            max_suggestions=5
        )
        
        # Should return a list (even if empty)
        assert isinstance(suggestions, list)
    
    # Bulk Update Tests
    
    @pytest.mark.asyncio
    async def test_update_recipe_categories(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_categories: List[Category]
    ):
        """Test bulk updating recipe categories."""
        # Assign initial categories
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[0].id
        )
        
        # Update with new set
        new_category_ids = [cat.id for cat in sample_categories[1:]]
        assignments = await service.update_recipe_categories(
            recipe_id=sample_recipe.id,
            category_ids=new_category_ids,
            primary_category_id=sample_categories[2].id
        )
        
        assert len(assignments) == 2
        
        # Verify update
        categories = await service.get_recipe_categories(sample_recipe.id)
        assert len(categories) == 2
        
        # Check primary
        primary = await service.get_primary_category(sample_recipe.id)
        assert primary.id == sample_categories[2].id
    
    @pytest.mark.asyncio
    async def test_update_recipe_tags(
        self,
        service: RecipeCategorizationService,
        sample_recipe: Recipe,
        sample_tags: List[Tag]
    ):
        """Test bulk updating recipe tags."""
        # Assign initial tags
        for tag in sample_tags[:2]:
            await service.assign_tag(
                recipe_id=sample_recipe.id,
                tag_id=tag.id
            )
        
        # Check usage counts
        tag1 = await service.tag_service.get_tag(sample_tags[0].id)
        assert tag1.usage_count == 1
        
        # Update with new set
        new_tag_ids = [sample_tags[2].id]  # Only vegan
        assignments = await service.update_recipe_tags(
            recipe_id=sample_recipe.id,
            tag_ids=new_tag_ids
        )
        
        assert len(assignments) == 1
        
        # Verify update
        tags = await service.get_recipe_tags(sample_recipe.id)
        assert len(tags) == 1
        assert tags[0].slug == "vegan"
        
        # Check usage counts updated
        tag1 = await service.tag_service.get_tag(sample_tags[0].id)
        assert tag1.usage_count == 0  # Decremented
        
        tag3 = await service.tag_service.get_tag(sample_tags[2].id)
        assert tag3.usage_count == 1  # Incremented
    
    @pytest.mark.asyncio
    async def test_copy_categorization(
        self,
        service: RecipeCategorizationService,
        db_session: AsyncSession,
        sample_recipe: Recipe,
        sample_categories: List[Category],
        sample_tags: List[Tag],
        test_user: AuthUser
    ):
        """Test copying categorization between recipes."""
        # Set up source recipe
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[0].id,
            is_primary=True
        )
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[1].id,
            is_primary=False
        )
        
        for tag in sample_tags[:2]:
            await service.assign_tag(
                recipe_id=sample_recipe.id,
                tag_id=tag.id
            )
        
        # Create target recipe
        target_recipe = Recipe(
            user_id=test_user.id,
            name="Target Recipe",
            description="Target",
            instructions="Test",
            servings=4,
            is_published=True
        )
        db_session.add(target_recipe)
        await db_session.commit()
        
        # Copy categorization
        result = await service.copy_categorization(
            source_recipe_id=sample_recipe.id,
            target_recipe_id=target_recipe.id,
            include_categories=True,
            include_tags=True
        )
        
        assert len(result["categories"]) == 2
        assert len(result["tags"]) == 2
        
        # Verify target has same categorization
        target_categories = await service.get_recipe_categories(target_recipe.id)
        assert len(target_categories) == 2
        
        target_primary = await service.get_primary_category(target_recipe.id)
        assert target_primary.id == sample_categories[0].id
        
        target_tags = await service.get_recipe_tags(target_recipe.id)
        assert len(target_tags) == 2
    
    @pytest.mark.asyncio
    async def test_copy_categorization_partial(
        self,
        service: RecipeCategorizationService,
        db_session: AsyncSession,
        sample_recipe: Recipe,
        sample_categories: List[Category],
        sample_tags: List[Tag],
        test_user: AuthUser
    ):
        """Test partial copying of categorization."""
        # Set up source
        await service.assign_category(
            recipe_id=sample_recipe.id,
            category_id=sample_categories[0].id
        )
        await service.assign_tag(
            recipe_id=sample_recipe.id,
            tag_id=sample_tags[0].id
        )
        
        # Create target
        target_recipe = Recipe(
            user_id=test_user.id,
            name="Target Recipe",
            description="Target",
            instructions="Test",
            servings=4,
            is_published=True
        )
        db_session.add(target_recipe)
        await db_session.commit()
        
        # Copy only categories
        result = await service.copy_categorization(
            source_recipe_id=sample_recipe.id,
            target_recipe_id=target_recipe.id,
            include_categories=True,
            include_tags=False
        )
        
        assert len(result["categories"]) == 1
        assert len(result["tags"]) == 0
        
        # Verify
        target_categories = await service.get_recipe_categories(target_recipe.id)
        assert len(target_categories) == 1
        
        target_tags = await service.get_recipe_tags(target_recipe.id)
        assert len(target_tags) == 0