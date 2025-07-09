"""
Simple test to verify category endpoints work.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.recipe.models.categorization import Category


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def simple_category(db_session: AsyncSession) -> Category:
    """Create a simple test category."""
    category = Category(
        name="Test Category",
        slug="test-category",
        description="A test category"
    )
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


async def test_list_categories_simple(
    async_client: AsyncClient,
    simple_category: Category
):
    """Test simple category listing."""
    response = await async_client.get("/api/v1/recipes/categories?tree=false")
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["name"] == "Test Category"
    assert data[0]["slug"] == "test-category"


async def test_get_category_by_id(
    async_client: AsyncClient,
    simple_category: Category
):
    """Test getting category by ID."""
    response = await async_client.get(f"/api/v1/recipes/categories/{simple_category.id}")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["name"] == "Test Category"
    assert data["slug"] == "test-category"
    assert data["recipes"] == []  # No recipes assigned