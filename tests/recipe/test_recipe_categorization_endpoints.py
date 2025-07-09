"""
Integration tests for recipe categorization endpoints.

These tests verify the recipe categorization functionality including:
- Assign categories to recipe
- Assign tags to recipe
- Remove category/tag from recipe
- Get suggested tags
- Get recipe categorization info
- Authorization checks (owner only)
"""

import pytest
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.categorization import Category, Tag, RecipeCategory, RecipeTag
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.auth.utils.password import PasswordHasher


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def recipe_owner(db_session: AsyncSession) -> AuthUser:
    """Create a recipe owner user."""
    user = AuthUser(
        email="owner@example.com",
        password_hash=PasswordHasher.hash_password("OwnerPassword123!"),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        timezone="UTC",
        is_active=True,
        email_verified=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def other_user(db_session: AsyncSession) -> AuthUser:
    """Create another user (not recipe owner)."""
    user = AuthUser(
        email="other@example.com",
        password_hash=PasswordHasher.hash_password("OtherPassword123!"),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        timezone="UTC",
        is_active=True,
        email_verified=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_recipe(
    db_session: AsyncSession,
    recipe_owner: AuthUser
) -> Recipe:
    """Create a test recipe."""
    recipe = Recipe(
        title="Chocolate Chip Cookies",
        description="Classic homemade chocolate chip cookies",
        instructions="Mix ingredients, bake at 350F for 12 minutes",
        prep_time_minutes=15,
        cook_time_minutes=12,
        servings=24,
        difficulty="easy",
        author_id=recipe_owner.id,
        is_public=True
    )
    db_session.add(recipe)
    await db_session.commit()
    await db_session.refresh(recipe)
    return recipe


@pytest.fixture
async def test_categories(db_session: AsyncSession) -> list[Category]:
    """Create test categories."""
    categories = [
        Category(
            name="Desserts",
            slug="desserts",
            description="Sweet treats",
            icon="dessert",
            display_order=1
        ),
        Category(
            name="Cookies",
            slug="cookies",
            description="Cookie recipes",
            icon="cookie",
            parent_id=None,  # Will be set after flush
            display_order=1
        ),
        Category(
            name="Snacks",
            slug="snacks",
            description="Quick snacks",
            icon="snack",
            display_order=2
        )
    ]
    
    # Add desserts first to get ID
    db_session.add(categories[0])
    await db_session.flush()
    
    # Set cookies as child of desserts
    categories[1].parent_id = categories[0].id
    db_session.add_all(categories[1:])
    await db_session.commit()
    
    return categories


@pytest.fixture
async def test_tags(db_session: AsyncSession) -> list[Tag]:
    """Create test tags."""
    tags = [
        Tag(name="dessert", slug="dessert", usage_count=100),
        Tag(name="baking", slug="baking", usage_count=80),
        Tag(name="chocolate", slug="chocolate", usage_count=60),
        Tag(name="quick-and-easy", slug="quick-and-easy", usage_count=120),
        Tag(name="kid-friendly", slug="kid-friendly", usage_count=70),
        Tag(name="gluten-free", slug="gluten-free", usage_count=50),
        Tag(name="vegan", slug="vegan", usage_count=45),
    ]
    
    db_session.add_all(tags)
    await db_session.commit()
    
    return tags


class TestAssignCategories:
    """Test assigning categories to recipes."""
    
    async def test_assign_single_category(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str
    ):
        """Test assigning a single category to recipe."""
        assignments = [
            {"category_id": str(test_categories[1].id)}  # Cookies
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["name"] == "Cookies"
        assert data[0]["slug"] == "cookies"
    
    async def test_assign_multiple_categories(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str
    ):
        """Test assigning multiple categories to recipe."""
        assignments = [
            {"category_id": str(test_categories[0].id)},  # Desserts (primary)
            {"category_id": str(test_categories[1].id)},  # Cookies
            {"category_id": str(test_categories[2].id)}   # Snacks
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 3
        # Check order is preserved
        assert data[0]["name"] == "Desserts"
        assert data[1]["name"] == "Cookies"
        assert data[2]["name"] == "Snacks"
    
    async def test_assign_categories_replaces_existing(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test that assigning categories replaces existing ones."""
        # First assignment
        assignments = [
            {"category_id": str(test_categories[0].id)}  # Desserts
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        
        # Second assignment (should replace)
        assignments = [
            {"category_id": str(test_categories[1].id)},  # Cookies
            {"category_id": str(test_categories[2].id)}   # Snacks
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only have the new categories
        assert len(data) == 2
        assert data[0]["name"] == "Cookies"
        assert data[1]["name"] == "Snacks"
        
        # Verify in database
        stmt = select(RecipeCategory).where(RecipeCategory.recipe_id == test_recipe.id)
        result = await db_session.execute(stmt)
        db_categories = list(result.scalars())
        assert len(db_categories) == 2
    
    async def test_assign_categories_max_limit(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str
    ):
        """Test maximum category limit enforcement."""
        # Try to assign 4 categories (limit is 3)
        assignments = [
            {"category_id": str(test_categories[0].id)},
            {"category_id": str(test_categories[1].id)},
            {"category_id": str(test_categories[2].id)},
            {"category_id": str(uuid4())}  # Fourth category
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 400
        assert "Maximum 3 categories" in response.json()["detail"]
    
    async def test_assign_invalid_category(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        owner_token: str
    ):
        """Test assigning non-existent category."""
        fake_id = uuid4()
        assignments = [
            {"category_id": str(fake_id)}
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()
    
    async def test_assign_categories_non_owner_forbidden(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        other_user_token: str
    ):
        """Test non-owner cannot assign categories."""
        assignments = [
            {"category_id": str(test_categories[0].id)}
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {other_user_token}"}
        )
        
        assert response.status_code == 403
        assert "owner" in response.json()["detail"].lower()
    
    async def test_primary_category_is_first(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test that first category is marked as primary."""
        assignments = [
            {"category_id": str(test_categories[1].id)},  # Cookies
            {"category_id": str(test_categories[0].id)}   # Desserts
        ]
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/categories",
            json=assignments,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        
        # Check in database
        stmt = (
            select(RecipeCategory)
            .where(RecipeCategory.recipe_id == test_recipe.id)
            .where(RecipeCategory.is_primary == True)
        )
        result = await db_session.execute(stmt)
        primary = result.scalar_one()
        
        assert primary.category_id == test_categories[1].id  # First in list


class TestAssignTags:
    """Test assigning tags to recipes."""
    
    async def test_assign_tags_existing(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_tags: list[Tag],
        owner_token: str
    ):
        """Test assigning existing tags to recipe."""
        assignment = {
            "tag_names": ["dessert", "baking", "chocolate"]
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/tags",
            json=assignment,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 3
        tag_names = [tag["name"] for tag in data]
        assert "dessert" in tag_names
        assert "baking" in tag_names
        assert "chocolate" in tag_names
    
    async def test_assign_tags_create_new(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test creating new tags when assigning."""
        assignment = {
            "tag_names": ["homemade", "comfort-food", "dessert"]  # First two don't exist
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/tags",
            json=assignment,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 3
        
        # Check new tags were created
        stmt = select(Tag).where(Tag.slug.in_(["homemade", "comfort-food"]))
        result = await db_session.execute(stmt)
        new_tags = list(result.scalars())
        assert len(new_tags) == 2
    
    async def test_assign_tags_replaces_existing(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_tags: list[Tag],
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test that assigning tags replaces existing ones."""
        # First assignment
        assignment = {
            "tag_names": ["dessert", "baking"]
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/tags",
            json=assignment,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        
        # Second assignment (should replace)
        assignment = {
            "tag_names": ["chocolate", "quick-and-easy"]
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/tags",
            json=assignment,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only have the new tags
        assert len(data) == 2
        tag_names = [tag["name"] for tag in data]
        assert "chocolate" in tag_names
        assert "quick-and-easy" in tag_names
        assert "dessert" not in tag_names
        assert "baking" not in tag_names
    
    async def test_assign_tags_case_normalization(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        owner_token: str
    ):
        """Test tag names are normalized."""
        assignment = {
            "tag_names": ["DESSERT", "Baking", "ChOcOlAtE"]
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/tags",
            json=assignment,
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should match existing tags despite case differences
        tag_slugs = [tag["slug"] for tag in data]
        assert "dessert" in tag_slugs
        assert "baking" in tag_slugs
        assert "chocolate" in tag_slugs
    
    async def test_assign_tags_non_owner_forbidden(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        other_user_token: str
    ):
        """Test non-owner cannot assign tags."""
        assignment = {
            "tag_names": ["dessert"]
        }
        
        response = await async_client.post(
            f"/api/v1/recipes/{test_recipe.id}/tags",
            json=assignment,
            headers={"Authorization": f"Bearer {other_user_token}"}
        )
        
        assert response.status_code == 403


class TestRemoveCategory:
    """Test removing categories from recipes."""
    
    async def test_remove_category(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test removing a category from recipe."""
        # First assign categories
        recipe_category = RecipeCategory(
            recipe_id=test_recipe.id,
            category_id=test_categories[0].id,
            is_primary=True
        )
        db_session.add(recipe_category)
        await db_session.commit()
        
        # Remove the category
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/categories/{test_categories[0].id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 204
        
        # Verify it's removed
        stmt = select(RecipeCategory).where(
            RecipeCategory.recipe_id == test_recipe.id,
            RecipeCategory.category_id == test_categories[0].id
        )
        result = await db_session.execute(stmt)
        assert result.scalar_one_or_none() is None
    
    async def test_remove_primary_category_reassigns(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test removing primary category makes another one primary."""
        # Assign multiple categories
        for i, category in enumerate(test_categories[:2]):
            recipe_category = RecipeCategory(
                recipe_id=test_recipe.id,
                category_id=category.id,
                is_primary=(i == 0)
            )
            db_session.add(recipe_category)
        await db_session.commit()
        
        # Remove the primary category
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/categories/{test_categories[0].id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 204
        
        # Check remaining category is now primary
        stmt = select(RecipeCategory).where(
            RecipeCategory.recipe_id == test_recipe.id
        )
        result = await db_session.execute(stmt)
        remaining = result.scalar_one()
        assert remaining.is_primary is True
    
    async def test_remove_non_existent_category(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        owner_token: str
    ):
        """Test removing category that's not assigned."""
        fake_id = uuid4()
        
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/categories/{fake_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 404
    
    async def test_remove_category_non_owner_forbidden(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        other_user_token: str
    ):
        """Test non-owner cannot remove categories."""
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/categories/{test_categories[0].id}",
            headers={"Authorization": f"Bearer {other_user_token}"}
        )
        
        assert response.status_code == 403


class TestRemoveTag:
    """Test removing tags from recipes."""
    
    async def test_remove_tag(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_tags: list[Tag],
        owner_token: str,
        db_session: AsyncSession
    ):
        """Test removing a tag from recipe."""
        # First assign tag
        recipe_tag = RecipeTag(
            recipe_id=test_recipe.id,
            tag_id=test_tags[0].id
        )
        db_session.add(recipe_tag)
        await db_session.commit()
        
        # Remove the tag
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/tags/{test_tags[0].id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 204
        
        # Verify it's removed
        stmt = select(RecipeTag).where(
            RecipeTag.recipe_id == test_recipe.id,
            RecipeTag.tag_id == test_tags[0].id
        )
        result = await db_session.execute(stmt)
        assert result.scalar_one_or_none() is None
    
    async def test_remove_non_existent_tag(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        owner_token: str
    ):
        """Test removing tag that's not assigned."""
        fake_id = uuid4()
        
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/tags/{fake_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 404
    
    async def test_remove_tag_non_owner_forbidden(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_tags: list[Tag],
        other_user_token: str
    ):
        """Test non-owner cannot remove tags."""
        response = await async_client.delete(
            f"/api/v1/recipes/{test_recipe.id}/tags/{test_tags[0].id}",
            headers={"Authorization": f"Bearer {other_user_token}"}
        )
        
        assert response.status_code == 403


class TestSuggestedTags:
    """Test getting suggested tags for recipes."""
    
    async def test_get_suggested_tags_basic(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe
    ):
        """Test getting basic tag suggestions."""
        response = await async_client.get(f"/api/v1/recipes/{test_recipe.id}/suggested-tags")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Should suggest tags based on recipe content
        # Recipe has "chocolate" and "bake" in content
        assert "dessert" in data  # From title/description
        assert "baked" in data    # From instructions
    
    async def test_get_suggested_tags_dietary(
        self,
        async_client: AsyncClient,
        recipe_owner: AuthUser,
        db_session: AsyncSession
    ):
        """Test dietary tag suggestions."""
        # Create a recipe with dietary keywords
        recipe = Recipe(
            title="Vegan Chocolate Cake",
            description="A delicious dairy-free and egg-free chocolate cake",
            instructions="Mix plant-based ingredients and bake",
            prep_time_minutes=20,
            cook_time_minutes=30,
            servings=8,
            difficulty="medium",
            author_id=recipe_owner.id,
            is_public=True
        )
        db_session.add(recipe)
        await db_session.commit()
        
        response = await async_client.get(f"/api/v1/recipes/{recipe.id}/suggested-tags")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "vegan" in data
        assert "dairy-free" in data
    
    async def test_get_suggested_tags_excludes_existing(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_tags: list[Tag],
        db_session: AsyncSession
    ):
        """Test that existing tags are excluded from suggestions."""
        # Assign some tags
        dessert_tag = next(t for t in test_tags if t.slug == "dessert")
        recipe_tag = RecipeTag(
            recipe_id=test_recipe.id,
            tag_id=dessert_tag.id
        )
        db_session.add(recipe_tag)
        await db_session.commit()
        
        response = await async_client.get(f"/api/v1/recipes/{test_recipe.id}/suggested-tags")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should not suggest already assigned tags
        assert "dessert" not in data
    
    async def test_get_suggested_tags_limit(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe
    ):
        """Test tag suggestion limit."""
        response = await async_client.get(
            f"/api/v1/recipes/{test_recipe.id}/suggested-tags?limit=3"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) <= 3


class TestRecipeCategorization:
    """Test getting complete categorization info."""
    
    async def test_get_recipe_categorization(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe,
        test_categories: list[Category],
        test_tags: list[Tag],
        db_session: AsyncSession
    ):
        """Test getting complete categorization info."""
        # Assign category and tags
        recipe_category = RecipeCategory(
            recipe_id=test_recipe.id,
            category_id=test_categories[1].id,  # Cookies
            is_primary=True
        )
        db_session.add(recipe_category)
        
        for tag_name in ["dessert", "baking"]:
            tag = next(t for t in test_tags if t.name == tag_name)
            recipe_tag = RecipeTag(
                recipe_id=test_recipe.id,
                tag_id=tag.id
            )
            db_session.add(recipe_tag)
        
        await db_session.commit()
        
        # Get categorization info
        response = await async_client.get(f"/api/v1/recipes/{test_recipe.id}/categorization")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "recipe_id" in data
        assert "category" in data
        assert "tags" in data
        assert "suggested_categories" in data
        assert "suggested_tags" in data
        
        # Check current category
        assert data["category"]["name"] == "Cookies"
        
        # Check current tags
        assert len(data["tags"]) == 2
        tag_names = [tag["name"] for tag in data["tags"]]
        assert "dessert" in tag_names
        assert "baking" in tag_names
        
        # Check suggestions
        assert isinstance(data["suggested_tags"], list)
        assert isinstance(data["suggested_categories"], list)
    
    async def test_get_categorization_no_assignments(
        self,
        async_client: AsyncClient,
        test_recipe: Recipe
    ):
        """Test categorization info for uncategorized recipe."""
        response = await async_client.get(f"/api/v1/recipes/{test_recipe.id}/categorization")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["category"] is None
        assert data["tags"] == []
        assert len(data["suggested_tags"]) > 0  # Should have suggestions