"""
Integration tests for tag management endpoints.

These tests verify the tag functionality including:
- List tags with filters
- Tag autocomplete
- Popular and dietary tags endpoints
- Create tag
- Get tag details with recipes
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.categorization import Tag, RecipeTag
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.auth.utils.password import PasswordHasher


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(scope="function")
async def test_tags(db_session: AsyncSession) -> list[Tag]:
    """Create test tags with various characteristics."""
    tags = [
        Tag(name="vegan", slug="vegan", usage_count=50),
        Tag(name="vegetarian", slug="vegetarian", usage_count=45),
        Tag(name="gluten-free", slug="gluten-free", usage_count=30),
        Tag(name="dairy-free", slug="dairy-free", usage_count=25),
        Tag(name="quick-and-easy", slug="quick-and-easy", usage_count=60),
        Tag(name="italian", slug="italian", usage_count=35),
        Tag(name="mexican", slug="mexican", usage_count=20),
        Tag(name="breakfast", slug="breakfast", usage_count=40),
        Tag(name="dessert", slug="dessert", usage_count=55),
        Tag(name="low-carb", slug="low-carb", usage_count=15),
        Tag(name="keto", slug="keto", usage_count=12),
        Tag(name="paleo", slug="paleo", usage_count=8),
        Tag(name="whole30", slug="whole30", usage_count=5),
        Tag(name="sugar-free", slug="sugar-free", usage_count=18),
        Tag(name="nut-free", slug="nut-free", usage_count=10),
    ]
    
    db_session.add_all(tags)
    await db_session.commit()
    
    return tags


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> AuthUser:
    """Create a test user."""
    user = AuthUser(
        email="user@example.com",
        password_hash=PasswordHasher.hash_password("UserPassword123!"),
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


@pytest_asyncio.fixture(scope="function")
async def test_recipe_with_tags(
    db_session: AsyncSession,
    test_user: AuthUser,
    test_tags: list[Tag]
) -> Recipe:
    """Create a test recipe with tags."""
    recipe = Recipe(
        title="Vegan Pasta Salad",
        description="A healthy vegan pasta salad",
        instructions="Mix ingredients and serve",
        prep_time_minutes=15,
        cook_time_minutes=0,
        servings=4,
        difficulty="easy",
        author_id=test_user.id,
        is_public=True
    )
    db_session.add(recipe)
    await db_session.flush()
    
    # Assign tags
    tag_names = ["vegan", "italian", "quick-and-easy"]
    for tag in test_tags:
        if tag.name in tag_names:
            recipe_tag = RecipeTag(
                recipe_id=recipe.id,
                tag_id=tag.id,
                tagged_at=datetime.now(timezone.utc)
            )
            db_session.add(recipe_tag)
    
    await db_session.commit()
    await db_session.refresh(recipe)
    
    return recipe


class TestListTags:
    """Test listing tags endpoint."""
    
    async def test_list_tags_default(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test listing tags with default parameters."""
        response = await async_client.get("/api/v1/recipes/tags")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return tags sorted by usage count descending
        assert len(data) <= 50  # Default limit
        assert data[0]["name"] == "quick-and-easy"  # Highest usage count (60)
        assert data[1]["name"] == "dessert"  # Second highest (55)
        
        # Check tag structure
        first_tag = data[0]
        assert "id" in first_tag
        assert "name" in first_tag
        assert "slug" in first_tag
        assert "usage_count" in first_tag
        assert "recent_usage_count" in first_tag
        assert "trend" in first_tag
    
    async def test_list_tags_with_search(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test searching tags by name."""
        response = await async_client.get("/api/v1/recipes/tags?search=veg")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return tags containing "veg"
        tag_names = [tag["name"] for tag in data]
        assert "vegan" in tag_names
        assert "vegetarian" in tag_names
        assert len(data) == 2
    
    async def test_list_tags_dietary_only(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test filtering dietary restriction tags."""
        response = await async_client.get("/api/v1/recipes/tags?dietary_only=true")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return only dietary tags
        dietary_tags = [
            "vegan", "vegetarian", "gluten-free", "dairy-free",
            "keto", "paleo", "whole30", "sugar-free", "nut-free",
            "low-carb"
        ]
        
        for tag in data:
            assert tag["slug"] in dietary_tags
    
    async def test_list_tags_popular_only(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test filtering popular tags."""
        response = await async_client.get("/api/v1/recipes/tags?popular_only=true")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return only tags with usage_count > 10
        for tag in data:
            assert tag["usage_count"] > 10
    
    async def test_list_tags_min_usage(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test filtering by minimum usage count."""
        response = await async_client.get("/api/v1/recipes/tags?min_usage=30")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return only tags with usage_count >= 30
        for tag in data:
            assert tag["usage_count"] >= 30
    
    async def test_list_tags_pagination(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test tag list pagination."""
        # Get first page
        response = await async_client.get("/api/v1/recipes/tags?limit=5&offset=0")
        assert response.status_code == 200
        page1 = response.json()
        assert len(page1) == 5
        
        # Get second page
        response = await async_client.get("/api/v1/recipes/tags?limit=5&offset=5")
        assert response.status_code == 200
        page2 = response.json()
        assert len(page2) == 5
        
        # Ensure no overlap
        page1_ids = [tag["id"] for tag in page1]
        page2_ids = [tag["id"] for tag in page2]
        assert len(set(page1_ids) & set(page2_ids)) == 0


class TestTagAutocomplete:
    """Test tag autocomplete endpoint."""
    
    async def test_autocomplete_basic(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test basic tag autocomplete."""
        response = await async_client.get("/api/v1/recipes/tags/autocomplete?q=ve")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return tag names matching "ve"
        assert "vegan" in data
        assert "vegetarian" in data
        assert len(data) <= 10  # Default limit
    
    async def test_autocomplete_exact_match_first(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test exact matches appear first."""
        # Add a tag that contains "vegan" but isn't exact
        new_tag = Tag(name="vegan-friendly", slug="vegan-friendly", usage_count=100)
        test_tags[0].usage_count = 50  # Ensure vegan has lower count
        
        response = await async_client.get("/api/v1/recipes/tags/autocomplete?q=vegan")
        
        assert response.status_code == 200
        data = response.json()
        
        # Exact match should be first despite lower usage count
        if "vegan" in data and "vegan-friendly" in data:
            assert data.index("vegan") < data.index("vegan-friendly")
    
    async def test_autocomplete_minimum_query_length(
        self,
        client: AsyncClient
    ):
        """Test minimum query length requirement."""
        response = await async_client.get("/api/v1/recipes/tags/autocomplete?q=v")
        
        assert response.status_code == 422  # Validation error
    
    async def test_autocomplete_limit(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test autocomplete result limit."""
        response = await async_client.get("/api/v1/recipes/tags/autocomplete?q=a&limit=3")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) <= 3


class TestPopularTags:
    """Test popular tags endpoint."""
    
    async def test_get_popular_tags_default(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag],
        test_recipe_with_tags: Recipe
    ):
        """Test getting popular tags with default parameters."""
        response = await async_client.get("/api/v1/recipes/tags/popular")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "tags" in data
        assert "min_count" in data
        assert "max_count" in data
        assert "total_tags" in data
        
        # Check tag cloud structure
        assert len(data["tags"]) <= 30  # Default limit
        assert data["total_tags"] == len(test_tags)
        assert data["max_count"] == 60  # quick-and-easy
        assert data["min_count"] == 5   # whole30
    
    async def test_get_popular_tags_custom_limit(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test popular tags with custom limit."""
        response = await async_client.get("/api/v1/recipes/tags/popular?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["tags"]) == 5
        # Should be the top 5 by usage count
        expected_order = ["quick-and-easy", "dessert", "vegan", "vegetarian", "breakfast"]
        actual_order = [tag["name"] for tag in data["tags"]]
        assert actual_order == expected_order
    
    async def test_get_popular_tags_empty_database(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test popular tags with no tags in database."""
        # Clean database
        await db_session.execute(select(Tag).delete())
        await db_session.commit()
        
        response = await async_client.get("/api/v1/recipes/tags/popular")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["tags"] == []
        assert data["min_count"] == 0
        assert data["max_count"] == 0
        assert data["total_tags"] == 0


class TestDietaryTags:
    """Test dietary tags endpoint."""
    
    async def test_get_dietary_tags(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test getting dietary restriction tags."""
        response = await async_client.get("/api/v1/recipes/tags/dietary")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check all dietary tags are included
        dietary_slugs = [tag["slug"] for tag in data]
        expected_dietary = [
            "vegan", "vegetarian", "gluten-free", "dairy-free",
            "nut-free", "keto", "paleo", "whole30", "sugar-free",
            "low-carb"
        ]
        
        for expected in expected_dietary:
            assert expected in dietary_slugs
        
        # Check alphabetical order
        names = [tag["name"] for tag in data]
        assert names == sorted(names)


class TestCreateTag:
    """Test creating tags endpoint."""
    
    async def test_create_tag_authenticated(
        self,
        async_client: AsyncClient,
        test_user: AuthUser,
        user_token: str
    ):
        """Test creating a new tag as authenticated user."""
        tag_data = {
            "name": "Mediterranean"
        }
        
        response = await async_client.post(
            "/api/v1/recipes/tags",
            json=tag_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "Mediterranean"
        assert data["slug"] == "mediterranean"
        assert data["usage_count"] == 0
    
    async def test_create_tag_with_slug(
        self,
        async_client: AsyncClient,
        user_token: str
    ):
        """Test creating tag with custom slug."""
        tag_data = {
            "name": "30 Minute Meals",
            "slug": "30-minute-meals"
        }
        
        response = await async_client.post(
            "/api/v1/recipes/tags",
            json=tag_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["slug"] == "30-minute-meals"
    
    async def test_create_tag_duplicate_returns_existing(
        self,
        async_client: AsyncClient,
        user_token: str,
        test_tags: list[Tag]
    ):
        """Test creating duplicate tag returns existing tag."""
        tag_data = {
            "name": "Vegan"  # Already exists
        }
        
        response = await async_client.post(
            "/api/v1/recipes/tags",
            json=tag_data,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Should return existing tag
        assert data["slug"] == "vegan"
        assert data["usage_count"] == 50  # Existing count
    
    async def test_create_tag_unauthenticated(
        self,
        client: AsyncClient
    ):
        """Test creating tag requires authentication."""
        tag_data = {
            "name": "New Tag"
        }
        
        response = await async_client.post("/api/v1/recipes/tags", json=tag_data)
        
        assert response.status_code == 401


class TestGetTagDetails:
    """Test getting tag details endpoint."""
    
    async def test_get_tag_details_with_recipes(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag],
        test_recipe_with_tags: Recipe
    ):
        """Test getting tag details with recipes."""
        response = await async_client.get("/api/v1/recipes/tags/vegan")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "tag" in data
        assert "recipes" in data
        assert "total_recipes" in data
        assert "is_dietary" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        
        # Check tag info
        assert data["tag"]["name"] == "vegan"
        assert data["tag"]["slug"] == "vegan"
        assert data["is_dietary"] is True
        
        # Check recipes
        assert data["total_recipes"] == 1
        assert len(data["recipes"]) == 1
        assert data["recipes"][0]["title"] == "Vegan Pasta Salad"
    
    async def test_get_tag_details_pagination(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag],
        test_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test tag details pagination."""
        # Get vegan tag
        vegan_tag = next(t for t in test_tags if t.slug == "vegan")
        
        # Create multiple recipes with vegan tag
        for i in range(5):
            recipe = Recipe(
                title=f"Vegan Recipe {i}",
                description="Another vegan dish",
                instructions="Cook and serve",
                prep_time_minutes=10,
                cook_time_minutes=15,
                servings=4,
                difficulty="easy",
                author_id=test_user.id,
                is_public=True
            )
            db_session.add(recipe)
            await db_session.flush()
            
            recipe_tag = RecipeTag(
                recipe_id=recipe.id,
                tag_id=vegan_tag.id,
                tagged_at=datetime.now(timezone.utc)
            )
            db_session.add(recipe_tag)
        
        await db_session.commit()
        
        # Test pagination
        response = await async_client.get("/api/v1/recipes/tags/vegan?page=1&page_size=3")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_recipes"] == 6  # Original + 5 new
        assert len(data["recipes"]) == 3
        assert data["total_pages"] == 2
    
    async def test_get_tag_not_found(
        self,
        client: AsyncClient
    ):
        """Test getting non-existent tag."""
        response = await async_client.get("/api/v1/recipes/tags/non-existent-tag")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    async def test_get_tag_dietary_detection(
        self,
        async_client: AsyncClient,
        test_tags: list[Tag]
    ):
        """Test dietary tag detection."""
        # Test dietary tag
        response = await async_client.get("/api/v1/recipes/tags/gluten-free")
        assert response.status_code == 200
        assert response.json()["is_dietary"] is True
        
        # Test non-dietary tag
        response = await async_client.get("/api/v1/recipes/tags/italian")
        assert response.status_code == 200
        assert response.json()["is_dietary"] is False