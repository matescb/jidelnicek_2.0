"""
Tests for TagService.

This module tests the business logic for tag management including:
- CRUD operations for tags
- Tag autocomplete functionality
- Popular and trending tags
- Usage count management
- Dietary tag functionality
- Tag suggestions based on ingredients
"""

import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.services.tag_service import TagService
from jidelnicek.recipe.models import Tag, Recipe, RecipeTag
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


class TestTagService:
    """Test suite for TagService."""
    
    @pytest_asyncio.fixture
    async def service(self, db_session: AsyncSession) -> TagService:
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
    async def sample_tags(self, db_session: AsyncSession, service: TagService) -> List[Tag]:
        """Create sample tags with various usage counts."""
        tags = []
        
        # Create regular tags
        tag_data = [
            ("Italian", "italian", 25),
            ("Quick", "quick", 50),
            ("Easy", "easy", 30),
            ("Healthy", "healthy", 15),
            ("Budget-Friendly", "budget-friendly", 8),
            ("Party", "party", 3),
        ]
        
        for name, slug, usage in tag_data:
            tag = await service.create_tag(name=name, slug=slug)
            tag.usage_count = usage
            tags.append(tag)
        
        # Create dietary tags
        dietary_data = [
            ("Vegan", "vegan", 40),
            ("Vegetarian", "vegetarian", 45),
            ("Gluten-Free", "gluten-free", 20),
            ("Dairy-Free", "dairy-free", 18),
            ("Keto", "keto", 12),
        ]
        
        for name, slug, usage in dietary_data:
            tag = await service.create_tag(name=name, slug=slug)
            tag.usage_count = usage
            tags.append(tag)
        
        await db_session.commit()
        return tags
    
    @pytest_asyncio.fixture
    async def sample_recipe_with_ingredients(
        self,
        db_session: AsyncSession,
        test_user: AuthUser
    ) -> Recipe:
        """Create a sample recipe with ingredients."""
        # Create ingredients
        ingredients = []
        
        # Vegan ingredients
        tofu = Ingredient(
            name="Tofu",
            category="protein",
            is_vegan=True,
            is_vegetarian=True,
            is_gluten_free=True,
            energy_kcal_per_100g=144.0
        )
        ingredients.append(tofu)
        
        # Non-vegan ingredient
        chicken = Ingredient(
            name="Chicken Breast",
            category="meat",
            is_vegan=False,
            is_vegetarian=False,
            is_gluten_free=True,
            is_meat=True,
            is_poultry=True,
            energy_kcal_per_100g=165.0
        )
        ingredients.append(chicken)
        
        # Gluten-containing ingredient
        pasta = Ingredient(
            name="Wheat Pasta",
            category="grains",
            is_vegan=True,
            is_vegetarian=True,
            is_gluten_free=False,
            is_gluten_containing=True,
            energy_kcal_per_100g=371.0
        )
        ingredients.append(pasta)
        
        for ing in ingredients:
            db_session.add(ing)
        await db_session.commit()
        
        # Create recipe
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
        
        # Add ingredients to recipe
        for i, ing in enumerate(ingredients):
            recipe_ing = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ing.id,
                amount=100.0 * (i + 1),
                unit="g"
            )
            db_session.add(recipe_ing)
        
        await db_session.commit()
        await db_session.refresh(recipe)
        
        return recipe
    
    @pytest.mark.asyncio
    async def test_create_tag_success(self, service: TagService):
        """Test successful tag creation."""
        tag = await service.create_tag(
            name="Mediterranean",
            slug="mediterranean"
        )
        
        assert tag.id is not None
        assert tag.name == "Mediterranean"
        assert tag.slug == "mediterranean"
        assert tag.usage_count == 0
    
    @pytest.mark.asyncio
    async def test_create_tag_duplicate_slug(self, service: TagService):
        """Test creating tag with duplicate slug."""
        await service.create_tag(name="Test", slug="test-tag")
        
        with pytest.raises(ConflictError) as exc_info:
            await service.create_tag(name="Test 2", slug="test-tag")
        
        assert "already exists" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_get_tag(self, service: TagService):
        """Test getting tag by ID."""
        created = await service.create_tag(name="Test", slug="test")
        
        tag = await service.get_tag(created.id)
        assert tag is not None
        assert tag.id == created.id
        assert tag.name == "Test"
        
        # Test non-existent
        result = await service.get_tag(uuid4())
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_tag_by_slug(self, service: TagService):
        """Test getting tag by slug."""
        await service.create_tag(name="Test Tag", slug="test-tag")
        
        tag = await service.get_tag_by_slug("test-tag")
        assert tag is not None
        assert tag.name == "Test Tag"
        
        # Test non-existent
        result = await service.get_tag_by_slug("non-existent")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_update_tag(self, service: TagService):
        """Test updating tag."""
        tag = await service.create_tag(name="Old Name", slug="old-slug")
        
        updated = await service.update_tag(
            tag_id=tag.id,
            name="New Name",
            slug="new-slug"
        )
        
        assert updated.name == "New Name"
        assert updated.slug == "new-slug"
    
    @pytest.mark.asyncio
    async def test_update_tag_duplicate_slug(self, service: TagService):
        """Test updating tag with duplicate slug."""
        tag1 = await service.create_tag(name="Tag 1", slug="tag-1")
        tag2 = await service.create_tag(name="Tag 2", slug="tag-2")
        
        with pytest.raises(ConflictError) as exc_info:
            await service.update_tag(tag_id=tag2.id, slug="tag-1")
        
        assert "already exists" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_update_tag_not_found(self, service: TagService):
        """Test updating non-existent tag."""
        with pytest.raises(NotFoundError):
            await service.update_tag(tag_id=uuid4(), name="Test")
    
    @pytest.mark.asyncio
    async def test_delete_tag(self, service: TagService):
        """Test deleting tag."""
        tag = await service.create_tag(name="To Delete", slug="to-delete")
        
        result = await service.delete_tag(tag.id)
        assert result is True
        
        # Verify deletion
        deleted = await service.get_tag(tag.id)
        assert deleted is None
    
    @pytest.mark.asyncio
    async def test_delete_tag_not_found(self, service: TagService):
        """Test deleting non-existent tag."""
        with pytest.raises(NotFoundError):
            await service.delete_tag(uuid4())
    
    @pytest.mark.asyncio
    async def test_autocomplete_tags(
        self,
        service: TagService,
        sample_tags: List[Tag]
    ):
        """Test tag autocomplete functionality."""
        # Test basic autocomplete
        results = await service.autocomplete_tags("qu", limit=5)
        assert len(results) == 1
        assert results[0].name == "Quick"
        
        # Test case insensitive
        results = await service.autocomplete_tags("VEG", limit=5)
        assert len(results) == 2  # Vegan, Vegetarian
        
        # Test with popular only
        results = await service.autocomplete_tags(
            "e",
            limit=10,
            only_popular=True
        )
        # Should return tags with usage_count > 10
        for tag in results:
            assert tag.usage_count > 10
        
        # Test ordering by usage
        results = await service.autocomplete_tags("", limit=3)
        assert results[0].slug == "quick"  # Highest usage (50)
        assert results[1].slug == "vegetarian"  # Second highest (45)
        assert results[2].slug == "vegan"  # Third highest (40)
    
    @pytest.mark.asyncio
    async def test_get_popular_tags(
        self,
        service: TagService,
        sample_tags: List[Tag]
    ):
        """Test getting popular tags."""
        # Default threshold (10)
        popular = await service.get_popular_tags()
        for tag in popular:
            assert tag.usage_count >= 10
        
        # Custom threshold
        very_popular = await service.get_popular_tags(min_usage=30)
        for tag in very_popular:
            assert tag.usage_count >= 30
        
        # Test ordering
        popular = await service.get_popular_tags(limit=3)
        assert popular[0].usage_count >= popular[1].usage_count
        assert popular[1].usage_count >= popular[2].usage_count
    
    @pytest.mark.asyncio
    async def test_get_trending_tags(
        self,
        service: TagService,
        db_session: AsyncSession,
        sample_tags: List[Tag],
        test_user: AuthUser
    ):
        """Test getting trending tags."""
        # Create recent recipe with tags
        recipe = Recipe(
            user_id=test_user.id,
            name="Recent Recipe",
            description="A recent recipe",
            instructions="Test",
            servings=4,
            is_published=True
        )
        db_session.add(recipe)
        await db_session.commit()
        
        # Add some tags with recent timestamps
        italian_tag = next(t for t in sample_tags if t.slug == "italian")
        quick_tag = next(t for t in sample_tags if t.slug == "quick")
        
        for tag in [italian_tag, quick_tag]:
            recipe_tag = RecipeTag(
                recipe_id=recipe.id,
                tag_id=tag.id,
                tagged_at=datetime.now(timezone.utc)
            )
            db_session.add(recipe_tag)
        
        await db_session.commit()
        
        # Get trending tags
        trending = await service.get_trending_tags(days=30, limit=10)
        
        # Should have the recently used tags
        assert len(trending) >= 2
        
        # Check structure
        for tag_data in trending:
            assert "id" in tag_data
            assert "name" in tag_data
            assert "slug" in tag_data
            assert "total_usage" in tag_data
            assert "recent_usage" in tag_data
            assert "trend_percentage" in tag_data
    
    @pytest.mark.asyncio
    async def test_increment_decrement_usage_count(
        self,
        service: TagService
    ):
        """Test incrementing and decrementing usage count."""
        tag = await service.create_tag(name="Test", slug="test")
        assert tag.usage_count == 0
        
        # Increment
        await service.increment_usage_count(tag.id)
        tag = await service.get_tag(tag.id)
        assert tag.usage_count == 1
        
        # Increment again
        await service.increment_usage_count(tag.id)
        tag = await service.get_tag(tag.id)
        assert tag.usage_count == 2
        
        # Decrement
        await service.decrement_usage_count(tag.id)
        tag = await service.get_tag(tag.id)
        assert tag.usage_count == 1
        
        # Decrement to zero
        await service.decrement_usage_count(tag.id)
        tag = await service.get_tag(tag.id)
        assert tag.usage_count == 0
        
        # Decrement below zero (should stay at 0)
        await service.decrement_usage_count(tag.id)
        tag = await service.get_tag(tag.id)
        assert tag.usage_count == 0
    
    @pytest.mark.asyncio
    async def test_get_dietary_restriction_tags(
        self,
        service: TagService,
        sample_tags: List[Tag]
    ):
        """Test getting dietary restriction tags."""
        dietary_tags = await service.get_dietary_restriction_tags()
        
        # Should only return existing dietary tags
        dietary_slugs = {tag.slug for tag in dietary_tags}
        expected_slugs = {"vegan", "vegetarian", "gluten-free", "dairy-free", "keto"}
        
        assert dietary_slugs == expected_slugs
        
        # Should be ordered by name
        names = [tag.name for tag in dietary_tags]
        assert names == sorted(names)
    
    @pytest.mark.asyncio
    async def test_ensure_dietary_tags_exist(self, service: TagService):
        """Test ensuring all dietary tags exist."""
        # Get initial count
        initial_tags = await service.get_dietary_restriction_tags()
        initial_count = len(initial_tags)
        
        # Ensure all dietary tags exist
        tag_map = await service.ensure_dietary_tags_exist()
        
        # Should have all dietary tags
        assert len(tag_map) == len(TagService.DIETARY_TAGS)
        
        # Check all slugs are present
        for slug in TagService.DIETARY_TAGS:
            assert slug in tag_map
            assert tag_map[slug].slug == slug
        
        # Run again - should not create duplicates
        tag_map2 = await service.ensure_dietary_tags_exist()
        assert len(tag_map2) == len(tag_map)
    
    @pytest.mark.asyncio
    async def test_suggest_tags_for_recipe_dietary(
        self,
        service: TagService,
        db_session: AsyncSession,
        sample_recipe_with_ingredients: Recipe,
        sample_tags: List[Tag]
    ):
        """Test suggesting dietary tags based on ingredients."""
        recipe = sample_recipe_with_ingredients
        
        # Get suggestions
        suggestions = await service.suggest_tags_for_recipe(recipe.id)
        
        # Should suggest gluten-free (chicken and tofu are gluten-free, pasta is not)
        # Should not suggest vegan (has chicken)
        # Might suggest other tags based on ingredient analysis
        
        suggestion_slugs = {tag.slug for tag in suggestions}
        
        # Should not suggest vegan (has chicken)
        assert "vegan" not in suggestion_slugs
        
        # Test with vegan recipe
        # Create vegan recipe
        vegan_recipe = Recipe(
            user_id=recipe.user_id,
            name="Vegan Recipe",
            description="A vegan recipe",
            instructions="Test",
            servings=4,
            is_published=True
        )
        db_session.add(vegan_recipe)
        await db_session.commit()
        
        # Add only vegan ingredients
        tofu_ing = await db_session.execute(
            db_session.query(Ingredient).filter_by(name="Tofu")
        )
        tofu = tofu_ing.scalar_one()
        
        recipe_ing = RecipeIngredient(
            recipe_id=vegan_recipe.id,
            ingredient_id=tofu.id,
            amount=200.0,
            unit="g"
        )
        db_session.add(recipe_ing)
        await db_session.commit()
        
        # Get suggestions for vegan recipe
        vegan_suggestions = await service.suggest_tags_for_recipe(vegan_recipe.id)
        vegan_suggestion_slugs = {tag.slug for tag in vegan_suggestions}
        
        # Should suggest vegan
        assert "vegan" in vegan_suggestion_slugs or "vegetarian" in vegan_suggestion_slugs
    
    @pytest.mark.asyncio
    async def test_suggest_tags_for_recipe_related(
        self,
        service: TagService,
        db_session: AsyncSession,
        sample_tags: List[Tag],
        test_user: AuthUser
    ):
        """Test suggesting tags based on related tags."""
        # Create recipes with tag combinations
        recipes_data = [
            (["italian", "quick"], "Pasta Recipe 1"),
            (["italian", "quick", "easy"], "Pasta Recipe 2"),
            (["italian", "healthy"], "Pasta Recipe 3"),
        ]
        
        for tags, name in recipes_data:
            recipe = Recipe(
                user_id=test_user.id,
                name=name,
                description="Test",
                instructions="Test",
                servings=4,
                is_published=True
            )
            db_session.add(recipe)
            await db_session.commit()
            
            for tag_slug in tags:
                tag = next(t for t in sample_tags if t.slug == tag_slug)
                recipe_tag = RecipeTag(
                    recipe_id=recipe.id,
                    tag_id=tag.id
                )
                db_session.add(recipe_tag)
            
        await db_session.commit()
        
        # Create new recipe with just "italian" tag
        new_recipe = Recipe(
            user_id=test_user.id,
            name="New Italian Recipe",
            description="Test",
            instructions="Test",
            servings=4,
            is_published=True
        )
        db_session.add(new_recipe)
        await db_session.commit()
        
        italian_tag = next(t for t in sample_tags if t.slug == "italian")
        db_session.add(RecipeTag(
            recipe_id=new_recipe.id,
            tag_id=italian_tag.id
        ))
        await db_session.commit()
        
        # Get suggestions
        suggestions = await service.suggest_tags_for_recipe(new_recipe.id)
        suggestion_slugs = {tag.slug for tag in suggestions}
        
        # Should suggest "quick" since it's commonly used with "italian"
        assert "quick" in suggestion_slugs or "easy" in suggestion_slugs or "healthy" in suggestion_slugs
    
    @pytest.mark.asyncio
    async def test_suggest_tags_for_recipe_not_found(self, service: TagService):
        """Test suggesting tags for non-existent recipe."""
        with pytest.raises(NotFoundError):
            await service.suggest_tags_for_recipe(uuid4())
    
    @pytest.mark.asyncio
    async def test_list_tags(
        self,
        service: TagService,
        sample_tags: List[Tag]
    ):
        """Test listing tags with filters."""
        # Test listing all
        tags, total = await service.list_tags()
        assert total == len(sample_tags)
        
        # Test search
        tags, total = await service.list_tags(search="veg")
        assert total == 2  # vegan, vegetarian
        
        # Test dietary only
        tags, total = await service.list_tags(dietary_only=True)
        dietary_slugs = {tag.slug for tag in tags}
        assert all(slug in TagService.DIETARY_TAGS for slug in dietary_slugs)
        
        # Test popular only
        tags, total = await service.list_tags(popular_only=True)
        for tag in tags:
            assert tag.usage_count > 10
        
        # Test pagination
        tags_page1, total = await service.list_tags(limit=3, offset=0)
        tags_page2, total = await service.list_tags(limit=3, offset=3)
        
        assert len(tags_page1) == 3
        assert len(tags_page2) == 3
        assert tags_page1[0].id != tags_page2[0].id