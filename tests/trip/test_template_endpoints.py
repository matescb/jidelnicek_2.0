"""
Comprehensive tests for Trip Template API endpoints.

This module provides complete test coverage for all trip template-related API endpoints,
including CRUD operations, permissions, public/private templates, duplication,
template browsing, and creating trips from templates.
"""

import pytest
import pytest_asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4, UUID
from typing import Dict, Any, List, Optional

from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


# Shared fixtures for authentication
@pytest_asyncio.fixture(scope="function")
async def auth_headers(async_client: AsyncClient) -> Dict[str, str]:
    """Create authenticated user and return auth headers."""
    # Register user
    register_data = {
        "email": "template_test@example.com",
        "password": "TemplateTest123!",
        "password_confirmation": "TemplateTest123!"
    }
    await async_client.post("/api/v1/auth/register", json=register_data)
    
    # Login
    login_data = {
        "email": "template_test@example.com",
        "password": "TemplateTest123!"
    }
    response = await async_client.post("/api/v1/auth/login", json=login_data)
    token = response.json()["access_token"]
    
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def other_auth_headers(async_client: AsyncClient) -> Dict[str, str]:
    """Create another authenticated user for permission testing."""
    # Register user
    register_data = {
        "email": "other_template@example.com",
        "password": "OtherTemplate123!",
        "password_confirmation": "OtherTemplate123!"
    }
    await async_client.post("/api/v1/auth/register", json=register_data)
    
    # Login
    login_data = {
        "email": "other_template@example.com",
        "password": "OtherTemplate123!"
    }
    response = await async_client.post("/api/v1/auth/login", json=login_data)
    token = response.json()["access_token"]
    
    return {"Authorization": f"Bearer {token}"}


class TestCreateTemplateEndpoint:
    """Test POST /trips/templates endpoint."""
    
    async def test_create_template_basic(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test creating a basic template."""
        template_data = {
            "name": "Basic Family Trip",
            "description": "A simple template for family trips",
            "duration_days": 5,
            "meal_slots": ["Breakfast", "Lunch", "Dinner"],
            "participants": [
                {"name": "Dad", "coefficient": 100.0},
                {"name": "Mom", "coefficient": 90.0},
                {"name": "Child", "coefficient": 70.0}
            ],
            "is_public": False,
            "category": "Family",
            "tags": ["family", "vacation", "summer"]
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["name"] == "Basic Family Trip"
        assert data["description"] == "A simple template for family trips"
        assert data["duration_days"] == 5
        assert data["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]
        assert len(data["participants"]) == 3
        assert data["is_public"] is False
        assert data["category"] == "Family"
        assert set(data["tags"]) == {"family", "vacation", "summer"}
        assert "created_at" in data
        assert "updated_at" in data
    
    async def test_create_template_with_meal_assignments(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test creating template with pre-assigned meals."""
        template_data = {
            "name": "Camping Weekend",
            "duration_days": 2,
            "meal_slots": ["Breakfast", "Lunch", "Dinner"],
            "participants": [
                {"name": "Adult", "coefficient": 100.0}
            ],
            "meal_assignments": [
                {
                    "day_number": 1,
                    "meal_slot": "Breakfast",
                    "recipe_id": str(uuid4()),
                    "meal_type": "hot",
                    "notes": "Quick breakfast"
                },
                {
                    "day_number": 1,
                    "meal_slot": "Lunch",
                    "recipe_id": str(uuid4()),
                    "meal_type": "cold"
                }
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify meal assignments were stored
        assert "meal_assignments" in data
        assert isinstance(data["meal_assignments"], dict)
    
    async def test_create_public_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test creating a public template."""
        template_data = {
            "name": "Public Hiking Template",
            "duration_days": 3,
            "is_public": True,
            "category": "Sports",
            "tags": ["hiking", "outdoor", "adventure"]
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["is_public"] is True
        assert data["category"] == "Sports"
    
    async def test_create_template_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test template creation with various validation errors."""
        # Empty name
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={"name": "", "duration_days": 5},
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Invalid duration
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={"name": "Test", "duration_days": 0},
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Duration too long
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={"name": "Test", "duration_days": 366},
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Empty meal slots
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={"name": "Test", "duration_days": 5, "meal_slots": []},
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Invalid participant coefficient
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Test",
                "duration_days": 5,
                "participants": [
                    {"name": "Person", "coefficient": 250.0}  # Too high
                ]
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Duplicate participant names
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Test",
                "duration_days": 5,
                "participants": [
                    {"name": "Alice", "coefficient": 100.0},
                    {"name": "Alice", "coefficient": 90.0}
                ]
            },
            headers=auth_headers
        )
        assert response.status_code == 422
    
    async def test_create_template_meal_assignment_validation(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test meal assignment validation."""
        # Day number exceeds duration
        template_data = {
            "name": "Test Template",
            "duration_days": 2,
            "meal_assignments": [
                {
                    "day_number": 3,  # Exceeds duration
                    "meal_slot": "Breakfast",
                    "recipe_id": str(uuid4())
                }
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Invalid meal slot
        template_data = {
            "name": "Test Template",
            "duration_days": 2,
            "meal_slots": ["Breakfast", "Dinner"],
            "meal_assignments": [
                {
                    "day_number": 1,
                    "meal_slot": "Lunch",  # Not in meal_slots
                    "recipe_id": str(uuid4())
                }
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        assert response.status_code == 422
    
    async def test_create_template_unauthenticated(
        self,
        async_client: AsyncClient
    ):
        """Test creating template without authentication."""
        template_data = {
            "name": "Test Template",
            "duration_days": 5
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data
        )
        
        assert response.status_code == 401


class TestListTemplatesEndpoint:
    """Test GET /trips/templates endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def templates_setup(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create various templates for testing."""
        templates = []
        
        # User's private templates
        for i in range(3):
            response = await async_client.post(
                "/api/v1/trips/templates",
                json={
                    "name": f"Private Template {i}",
                    "duration_days": i + 3,
                    "is_public": False,
                    "category": "Family" if i == 0 else "Sports",
                    "tags": ["test", f"tag{i}"]
                },
                headers=auth_headers
            )
            templates.append(response.json())
        
        # User's public templates
        for i in range(2):
            response = await async_client.post(
                "/api/v1/trips/templates",
                json={
                    "name": f"Public Template {i}",
                    "duration_days": i + 5,
                    "is_public": True,
                    "category": "Adventure",
                    "tags": ["public", "shared"]
                },
                headers=auth_headers
            )
            templates.append(response.json())
        
        # Other user's public templates
        for i in range(2):
            response = await async_client.post(
                "/api/v1/trips/templates",
                json={
                    "name": f"Other Public {i}",
                    "duration_days": 7,
                    "is_public": True,
                    "category": "School",
                    "tags": ["education"]
                },
                headers=other_auth_headers
            )
            templates.append(response.json())
        
        return {"templates": templates}
    
    async def test_list_user_templates(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test listing user's own templates."""
        response = await async_client.get(
            "/api/v1/trips/templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pagination structure
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert "has_next" in data
        assert "has_prev" in data
        
        # Should see user's own templates (5 total)
        assert data["total"] == 5
        assert len(data["items"]) == 5
    
    async def test_list_public_templates(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test listing public templates."""
        response = await async_client.get(
            "/api/v1/trips/templates?is_public=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should see all public templates (4 total)
        assert data["total"] == 4
        
        # Verify all returned templates are public
        for template in data["items"]:
            assert template["is_public"] is True
    
    async def test_list_templates_with_category_filter(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test filtering templates by category."""
        response = await async_client.get(
            "/api/v1/trips/templates?category=Family",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only see Family category templates
        assert all(t["category"] == "Family" for t in data["items"])
    
    async def test_list_templates_with_tag_filter(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test filtering templates by tags."""
        response = await async_client.get(
            "/api/v1/trips/templates?tags=public,shared",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should see templates with either 'public' OR 'shared' tag
        for template in data["items"]:
            tags = template["tags"]
            assert "public" in tags or "shared" in tags
    
    async def test_list_templates_with_duration_filter(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test filtering templates by duration."""
        response = await async_client.get(
            "/api/v1/trips/templates?min_duration_days=5&max_duration_days=6",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all templates are within duration range
        for template in data["items"]:
            assert 5 <= template["duration_days"] <= 6
    
    async def test_list_templates_pagination(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test template list pagination."""
        # First page
        response = await async_client.get(
            "/api/v1/trips/templates?page=1&page_size=2",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2
        assert data["has_next"] is True
        assert data["has_prev"] is False
        
        # Second page
        response = await async_client.get(
            "/api/v1/trips/templates?page=2&page_size=2",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 2
        assert data["has_prev"] is True
    
    async def test_list_templates_search(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test searching templates by name/description."""
        response = await async_client.get(
            "/api/v1/trips/templates?query=Private",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should find templates with "Private" in name
        assert all("Private" in t["name"] for t in data["items"])
    
    async def test_list_templates_created_by_me_filter(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str],
        templates_setup: Dict[str, Any]
    ):
        """Test filtering templates created by current user."""
        # When viewing as other user with created_by_me filter
        response = await async_client.get(
            "/api/v1/trips/templates?created_by_me=true",
            headers=other_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only see templates created by other user
        assert data["total"] == 2  # Other user created 2 templates


class TestGetTemplateEndpoint:
    """Test GET /trips/templates/{template_id} endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def template_setup(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create templates for testing."""
        # User's private template
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Private Template",
                "duration_days": 5,
                "is_public": False,
                "participants": [
                    {"name": "Person1", "coefficient": 100.0}
                ]
            },
            headers=auth_headers
        )
        private_template = response.json()
        
        # User's public template
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Public Template",
                "duration_days": 3,
                "is_public": True,
                "description": "A public template for everyone"
            },
            headers=auth_headers
        )
        public_template = response.json()
        
        # Other user's private template
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Other Private",
                "duration_days": 2,
                "is_public": False
            },
            headers=other_auth_headers
        )
        other_private = response.json()
        
        return {
            "private_template": private_template,
            "public_template": public_template,
            "other_private": other_private
        }
    
    async def test_get_own_private_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test getting user's own private template."""
        template_id = template_setup["private_template"]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == template_id
        assert data["name"] == "Private Template"
        assert data["is_public"] is False
    
    async def test_get_public_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test getting public template (by different user)."""
        template_id = template_setup["public_template"]["id"]
        
        # Get as different user
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}",
            headers=other_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == template_id
        assert data["is_public"] is True
        assert "created_by_name" in data  # Should include creator info for public templates
    
    async def test_get_other_private_template_forbidden(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test getting another user's private template fails."""
        template_id = template_setup["other_private"]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    async def test_get_nonexistent_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test getting non-existent template."""
        fake_id = str(uuid4())
        
        response = await async_client.get(
            f"/api/v1/trips/templates/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_get_template_unauthenticated(
        self,
        async_client: AsyncClient,
        template_setup: Dict[str, Any]
    ):
        """Test getting template without authentication."""
        template_id = template_setup["public_template"]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}"
        )
        
        assert response.status_code == 401


class TestUpdateTemplateEndpoint:
    """Test PUT /trips/templates/{template_id} endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def template_setup(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create template for update testing."""
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Original Template",
                "duration_days": 5,
                "meal_slots": ["Breakfast", "Lunch", "Dinner"],
                "participants": [
                    {"name": "Person1", "coefficient": 100.0}
                ],
                "is_public": False,
                "category": "Family",
                "tags": ["original", "test"]
            },
            headers=auth_headers
        )
        return response.json()
    
    async def test_update_template_basic(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test basic template update."""
        template_id = template_setup["id"]
        
        update_data = {
            "name": "Updated Template",
            "description": "Now with description",
            "category": "Adventure",
            "tags": ["updated", "modified"]
        }
        
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "Updated Template"
        assert data["description"] == "Now with description"
        assert data["category"] == "Adventure"
        assert set(data["tags"]) == {"updated", "modified"}
        
        # Unchanged fields should remain
        assert data["duration_days"] == 5
        assert data["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]
    
    async def test_update_template_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test updating template participants."""
        template_id = template_setup["id"]
        
        update_data = {
            "participants": [
                {"name": "Adult", "coefficient": 100.0},
                {"name": "Teen", "coefficient": 85.0},
                {"name": "Child", "coefficient": 60.0}
            ]
        }
        
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["participants"]) == 3
        participant_names = [p["name"] for p in data["participants"]]
        assert set(participant_names) == {"Adult", "Teen", "Child"}
    
    async def test_update_template_visibility(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test changing template from private to public."""
        template_id = template_setup["id"]
        
        update_data = {
            "is_public": True
        }
        
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_public"] is True
    
    async def test_update_template_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_setup: Dict[str, Any]
    ):
        """Test update with validation errors."""
        template_id = template_setup["id"]
        
        # Empty name
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json={"name": ""},
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Invalid duration
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json={"duration_days": 400},
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Empty meal slots
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json={"meal_slots": []},
            headers=auth_headers
        )
        assert response.status_code == 422
    
    async def test_update_other_user_template_forbidden(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test updating another user's template fails."""
        # Create template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Other User Template",
                "duration_days": 3
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Try to update as different user
        response = await async_client.put(
            f"/api/v1/trips/templates/{template_id}",
            json={"name": "Hacked!"},
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    async def test_update_nonexistent_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test updating non-existent template."""
        fake_id = str(uuid4())
        
        response = await async_client.put(
            f"/api/v1/trips/templates/{fake_id}",
            json={"name": "Updated"},
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestDeleteTemplateEndpoint:
    """Test DELETE /trips/templates/{template_id} endpoint."""
    
    async def test_delete_own_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test deleting user's own template."""
        # Create template
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Template to Delete",
                "duration_days": 3
            },
            headers=auth_headers
        )
        template_id = response.json()["id"]
        
        # Delete template
        response = await async_client.delete(
            f"/api/v1/trips/templates/{template_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify template is deleted
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}",
            headers=auth_headers
        )
        assert response.status_code == 404
    
    async def test_delete_other_user_template_forbidden(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test deleting another user's template fails."""
        # Create template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Other User Template",
                "duration_days": 3
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Try to delete as different user
        response = await async_client.delete(
            f"/api/v1/trips/templates/{template_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    async def test_delete_nonexistent_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test deleting non-existent template."""
        fake_id = str(uuid4())
        
        response = await async_client.delete(
            f"/api/v1/trips/templates/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_delete_template_unauthenticated(
        self,
        async_client: AsyncClient
    ):
        """Test deleting template without authentication."""
        fake_id = str(uuid4())
        
        response = await async_client.delete(
            f"/api/v1/trips/templates/{fake_id}"
        )
        
        assert response.status_code == 401


class TestDuplicateTemplateEndpoint:
    """Test POST /trips/templates/{template_id}/duplicate endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def template_with_assignments(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create template with meal assignments for duplication."""
        template_data = {
            "name": "Original Template",
            "description": "Template to duplicate",
            "duration_days": 3,
            "meal_slots": ["Breakfast", "Lunch", "Dinner"],
            "participants": [
                {"name": "Adult", "coefficient": 100.0},
                {"name": "Child", "coefficient": 70.0}
            ],
            "meal_assignments": [
                {
                    "day_number": 1,
                    "meal_slot": "Breakfast",
                    "recipe_id": str(uuid4()),
                    "notes": "Quick meal"
                }
            ],
            "is_public": False,
            "category": "Family",
            "tags": ["test", "original"]
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        return response.json()
    
    async def test_duplicate_own_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_with_assignments: Dict[str, Any]
    ):
        """Test duplicating user's own template."""
        template_id = template_with_assignments["id"]
        
        duplicate_data = {
            "new_name": "Duplicated Template",
            "make_public": False
        }
        
        response = await async_client.post(
            f"/api/v1/trips/templates/{template_id}/duplicate",
            json=duplicate_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify duplicate
        assert data["name"] == "Duplicated Template"
        assert data["id"] != template_id
        assert data["duration_days"] == template_with_assignments["duration_days"]
        assert data["meal_slots"] == template_with_assignments["meal_slots"]
        assert len(data["participants"]) == 2
        assert data["is_public"] is False
    
    async def test_duplicate_public_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test duplicating another user's public template."""
        # Create public template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Public Template",
                "duration_days": 5,
                "is_public": True,
                "category": "Adventure"
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Duplicate as different user
        duplicate_data = {
            "new_name": "My Copy of Public Template"
        }
        
        response = await async_client.post(
            f"/api/v1/trips/templates/{template_id}/duplicate",
            json=duplicate_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "My Copy of Public Template"
        # The duplicated template should have a different owner
    
    async def test_duplicate_private_template_forbidden(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test duplicating another user's private template fails."""
        # Create private template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Private Template",
                "duration_days": 3,
                "is_public": False
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Try to duplicate as different user
        response = await async_client.post(
            f"/api/v1/trips/templates/{template_id}/duplicate",
            json={"new_name": "Stolen!"},
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    async def test_duplicate_with_auto_name(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_with_assignments: Dict[str, Any]
    ):
        """Test duplicating template without providing new name."""
        template_id = template_with_assignments["id"]
        
        response = await async_client.post(
            f"/api/v1/trips/templates/{template_id}/duplicate",
            json={},  # No new_name provided
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Should auto-generate name like "Copy of Original Template"
        assert "Copy of" in data["name"] or data["name"].endswith("(Copy)")


class TestBrowsePublicTemplatesEndpoint:
    """Test GET /trips/templates/public endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def public_templates_setup(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ) -> None:
        """Create various public templates."""
        # User 1 templates
        templates = [
            {
                "name": "Family Vacation",
                "duration_days": 7,
                "is_public": True,
                "category": "Family",
                "tags": ["family", "vacation", "summer"],
                "participants": [
                    {"name": "Adult", "coefficient": 100.0},
                    {"name": "Child", "coefficient": 70.0}
                ]
            },
            {
                "name": "Weekend Camping",
                "duration_days": 2,
                "is_public": True,
                "category": "Adventure",
                "tags": ["camping", "outdoor", "weekend"]
            }
        ]
        
        for template in templates:
            await async_client.post(
                "/api/v1/trips/templates",
                json=template,
                headers=auth_headers
            )
        
        # User 2 templates
        templates = [
            {
                "name": "School Trip",
                "duration_days": 3,
                "is_public": True,
                "category": "School",
                "tags": ["education", "students"],
                "participants": [
                    {"name": "Teacher", "coefficient": 100.0},
                    {"name": "Student", "coefficient": 80.0}
                ]
            },
            {
                "name": "Sports Team Camp",
                "duration_days": 5,
                "is_public": True,
                "category": "Sports",
                "tags": ["sports", "team", "training"]
            }
        ]
        
        for template in templates:
            await async_client.post(
                "/api/v1/trips/templates",
                json=template,
                headers=other_auth_headers
            )
    
    async def test_browse_all_public_templates(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        public_templates_setup: None
    ):
        """Test browsing all public templates."""
        response = await async_client.get(
            "/api/v1/trips/templates/public",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should see all public templates
        assert data["total"] >= 4
        
        # Verify all are public and include creator info
        for template in data["items"]:
            assert template["is_public"] is True
            assert "created_by_name" in template
    
    async def test_browse_public_by_category(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        public_templates_setup: None
    ):
        """Test browsing public templates by category."""
        response = await async_client.get(
            "/api/v1/trips/templates/public?category=Family",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only see Family category
        assert all(t["category"] == "Family" for t in data["items"])
    
    async def test_browse_public_popular_sort(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        public_templates_setup: None
    ):
        """Test sorting public templates by popularity (usage count)."""
        response = await async_client.get(
            "/api/v1/trips/templates/public?sort_by=usage_count&sort_order=desc",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify sorting (usage counts should be descending)
        if len(data["items"]) > 1:
            for i in range(len(data["items"]) - 1):
                assert data["items"][i]["usage_count"] >= data["items"][i + 1]["usage_count"]
    
    async def test_browse_public_unauthenticated(
        self,
        async_client: AsyncClient,
        public_templates_setup: None
    ):
        """Test browsing public templates without authentication fails."""
        response = await async_client.get(
            "/api/v1/trips/templates/public"
        )
        
        # Should require authentication even for public templates
        assert response.status_code == 401


class TestTemplateStatsEndpoint:
    """Test GET /trips/templates/{template_id}/stats endpoint."""
    
    async def test_get_template_stats(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test getting template usage statistics."""
        # Create template
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Popular Template",
                "duration_days": 5,
                "is_public": True
            },
            headers=auth_headers
        )
        template_id = response.json()["id"]
        
        # Get stats
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "template_id" in data
        assert "usage_count" in data
        assert "last_used_at" in data
        assert "created_trips_count" in data
        assert "average_rating" in data
    
    async def test_get_stats_other_private_template_forbidden(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test getting stats for another user's private template fails."""
        # Create private template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Private Template",
                "duration_days": 3,
                "is_public": False
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Try to get stats as different user
        response = await async_client.get(
            f"/api/v1/trips/templates/{template_id}/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 403


class TestCreateTripFromTemplateEndpoint:
    """Test POST /trips/from-template endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def template_for_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create template for trip creation."""
        template_data = {
            "name": "Trip Template",
            "duration_days": 5,
            "meal_slots": ["Breakfast", "Lunch", "Dinner"],
            "participants": [
                {"name": "Adult", "coefficient": 100.0},
                {"name": "Child", "coefficient": 70.0}
            ],
            "meal_assignments": [
                {
                    "day_number": 1,
                    "meal_slot": "Breakfast",
                    "recipe_id": str(uuid4())
                }
            ],
            "category": "Family"
        }
        
        response = await async_client.post(
            "/api/v1/trips/templates",
            json=template_data,
            headers=auth_headers
        )
        return response.json()
    
    async def test_create_trip_from_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_for_trip: Dict[str, Any]
    ):
        """Test creating trip from template."""
        create_data = {
            "template_id": template_for_trip["id"],
            "trip_name": "Summer Vacation 2024",
            "start_date": "2024-07-15",
            "include_meal_assignments": True,
            "notes": "Family trip to the mountains"
        }
        
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json=create_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify trip created with template data
        assert data["name"] == "Summer Vacation 2024"
        assert data["start_date"] == "2024-07-15"
        assert data["end_date"] == "2024-07-19"  # 5 days
        assert data["meal_slots"] == template_for_trip["meal_slots"]
        assert len(data["participants"]) == 2
    
    async def test_create_trip_with_participant_overrides(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_for_trip: Dict[str, Any]
    ):
        """Test creating trip with custom participants."""
        create_data = {
            "template_id": template_for_trip["id"],
            "trip_name": "Custom Trip",
            "start_date": "2024-08-01",
            "participant_overrides": [
                {"name": "Person1", "coefficient": 100.0},
                {"name": "Person2", "coefficient": 100.0},
                {"name": "Person3", "coefficient": 100.0}
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json=create_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Should use custom participants instead of template ones
        assert len(data["participants"]) == 3
        participant_names = [p["name"] for p in data["participants"]]
        assert set(participant_names) == {"Person1", "Person2", "Person3"}
    
    async def test_create_trip_without_meal_assignments(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_for_trip: Dict[str, Any]
    ):
        """Test creating trip without copying meal assignments."""
        create_data = {
            "template_id": template_for_trip["id"],
            "trip_name": "Empty Meals Trip",
            "start_date": "2024-09-01",
            "include_meal_assignments": False
        }
        
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json=create_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Trip should be created but without meal assignments
        assert data["name"] == "Empty Meals Trip"
        # Meal assignments would be empty (not copied from template)
    
    async def test_create_trip_from_public_template(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test creating trip from another user's public template."""
        # Create public template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Public Template",
                "duration_days": 3,
                "is_public": True
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Create trip from public template
        create_data = {
            "template_id": template_id,
            "trip_name": "My Trip from Public",
            "start_date": "2024-10-01"
        }
        
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json=create_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "My Trip from Public"
        assert data["duration_days"] == 3
    
    async def test_create_trip_from_private_template_forbidden(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test creating trip from another user's private template fails."""
        # Create private template as other user
        response = await async_client.post(
            "/api/v1/trips/templates",
            json={
                "name": "Private Template",
                "duration_days": 3,
                "is_public": False
            },
            headers=other_auth_headers
        )
        template_id = response.json()["id"]
        
        # Try to create trip from private template
        create_data = {
            "template_id": template_id,
            "trip_name": "Stolen Trip",
            "start_date": "2024-10-01"
        }
        
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json=create_data,
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    async def test_create_trip_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        template_for_trip: Dict[str, Any]
    ):
        """Test trip creation validation."""
        # Empty trip name
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json={
                "template_id": template_for_trip["id"],
                "trip_name": "",
                "start_date": "2024-10-01"
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Invalid date format
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json={
                "template_id": template_for_trip["id"],
                "trip_name": "Test",
                "start_date": "invalid-date"
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Non-existent template
        response = await async_client.post(
            "/api/v1/trips/from-template",
            json={
                "template_id": str(uuid4()),
                "trip_name": "Test",
                "start_date": "2024-10-01"
            },
            headers=auth_headers
        )
        assert response.status_code == 404