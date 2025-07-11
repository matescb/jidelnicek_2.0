"""
Tests for seed data functionality.
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.models.categorization import Category, Tag
from jidelnicek.core.seed_data import (
    seed_categories,
    seed_tags,
    seed_all,
    check_and_seed,
    check_and_seed_with_session,
    CATEGORY_HIERARCHY,
    DIETARY_TAGS
)


@pytest.mark.asyncio
async def test_seed_categories(db_session: AsyncSession):
    """Test seeding categories creates the expected hierarchy."""
    # Seed categories
    categories = await seed_categories(db_session)
    
    # Check total count
    assert len(categories) > 0
    
    # Verify root categories
    root_categories = [c for c in categories if c.parent_id is None]
    root_names = {c.name for c in root_categories}
    expected_roots = set(CATEGORY_HIERARCHY.keys())
    assert root_names == expected_roots
    
    # Verify each root has correct children
    for root_name, root_data in CATEGORY_HIERARCHY.items():
        root = next(c for c in root_categories if c.name == root_name)
        
        # Check root properties
        assert root.description == root_data["description"]
        assert root.icon == root_data["icon"]
        
        # Check children
        children = [c for c in categories if c.parent_id == root.id]
        child_names = {c.name for c in children}
        expected_children = set(root_data.get("children", {}).keys())
        assert child_names == expected_children


@pytest.mark.asyncio
async def test_seed_tags(db_session: AsyncSession):
    """Test seeding dietary tags."""
    # Seed tags
    tags = await seed_tags(db_session)
    
    # Check count
    assert len(tags) == len(DIETARY_TAGS)
    
    # Verify all tags created
    tag_names = {t.name for t in tags}
    expected_names = {t["name"] for t in DIETARY_TAGS}
    assert tag_names == expected_names
    
    # Check slug generation
    for tag in tags:
        assert tag.slug == tag.name.lower().replace(" ", "-")
        assert tag.usage_count == 0


@pytest.mark.asyncio
async def test_seed_all(db_session: AsyncSession):
    """Test seeding all data at once."""
    result = await seed_all(db_session)
    
    assert "categories" in result
    assert "tags" in result
    assert len(result["categories"]) > 0
    assert len(result["tags"]) == len(DIETARY_TAGS)


@pytest.mark.asyncio
async def test_seed_idempotent(db_session: AsyncSession):
    """Test that seeding is idempotent - running twice doesn't duplicate."""
    # First seed
    result1 = await seed_all(db_session)
    initial_categories = len(result1["categories"])
    initial_tags = len(result1["tags"])
    
    # Second seed - should skip existing
    result2 = await seed_all(db_session)
    
    # Check totals haven't changed
    stmt = select(Category)
    categories = await db_session.execute(stmt)
    assert len(categories.scalars().all()) == initial_categories
    
    stmt = select(Tag)
    tags = await db_session.execute(stmt)
    assert len(tags.scalars().all()) == initial_tags


@pytest.mark.asyncio
async def test_category_hierarchy(db_session: AsyncSession):
    """Test category parent-child relationships."""
    await seed_categories(db_session)
    
    # Get "Meals" category
    stmt = select(Category).where(Category.name == "Meals")
    result = await db_session.execute(stmt)
    meals = result.scalar_one()
    
    # Get children
    stmt = select(Category).where(Category.parent_id == meals.id)
    result = await db_session.execute(stmt)
    children = result.scalars().all()
    
    # Verify children
    child_names = {c.name for c in children}
    expected = {"Breakfast", "Lunch", "Dinner", "Snacks", "Desserts"}
    assert child_names == expected
    
    # Test get_path method
    breakfast = next(c for c in children if c.name == "Breakfast")
    path = breakfast.get_path()
    assert len(path) == 2
    assert path[0].name == "Meals"
    assert path[1].name == "Breakfast"
    
    # Test breadcrumb
    assert breakfast.get_breadcrumb() == "Meals > Breakfast"


@pytest.mark.asyncio
async def test_tag_properties(db_session: AsyncSession):
    """Test tag properties and methods."""
    await seed_tags(db_session)
    
    # Get vegan tag
    stmt = select(Tag).where(Tag.name == "Vegan")
    result = await db_session.execute(stmt)
    vegan = result.scalar_one()
    
    # Check properties
    assert vegan.slug == "vegan"
    assert vegan.is_dietary is True
    assert vegan.is_popular is False  # No usage yet
    
    # Simulate usage
    vegan.usage_count = 15
    await db_session.flush()
    
    assert vegan.is_popular is True


@pytest.mark.asyncio
async def test_check_and_seed_empty_db(db_session: AsyncSession):
    """Test check_and_seed on empty database."""
    # Ensure database is empty first
    await db_session.execute(text("DELETE FROM recipe_tags"))
    await db_session.execute(text("DELETE FROM recipe_categories"))
    await db_session.commit()
    
    # Use the test database session
    result = await check_and_seed_with_session(db_session)
    assert result is True
    
    # Verify data exists
    stmt = select(Category)
    categories = await db_session.execute(stmt)
    assert len(categories.scalars().all()) > 0
    
    stmt = select(Tag)
    tags = await db_session.execute(stmt) 
    assert len(tags.scalars().all()) > 0


@pytest.mark.asyncio
async def test_check_and_seed_existing_data(db_session: AsyncSession):
    """Test check_and_seed with existing data."""
    # First seed
    await seed_all(db_session)
    
    # Second check should return False (no seeding needed)
    result = await check_and_seed_with_session(db_session)
    assert result is False


@pytest.mark.asyncio
async def test_slug_special_characters(db_session: AsyncSession):
    """Test slug generation with special characters."""
    from jidelnicek.core.utils import slugify
    
    # Test various inputs
    assert slugify("Easy (< 30 min)") == "easy-30-min"
    assert slugify("Raw/No-Cook") == "raw-no-cook" 
    assert slugify("Gluten-Free") == "gluten-free"
    assert slugify("High-Protein") == "high-protein"
    assert slugify("30-60 min") == "30-60-min"