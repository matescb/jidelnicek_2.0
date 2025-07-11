"""
Comprehensive tests for Trip API endpoints.

This module provides complete test coverage for all trip-related API endpoints,
including authentication, request/response validation, error handling,
pagination, and filtering.
"""

import pytest
import pytest_asyncio
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from typing import Dict, Any

import httpx
from httpx import AsyncClient

from jidelnicek.auth.models import AuthUser
from jidelnicek.trip.models.trip import Trip


pytestmark = pytest.mark.asyncio


class TestTripEndpoints:
    """Test trip API endpoints."""
    
    @pytest_asyncio.fixture(scope="function")
    async def auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create authenticated user and return auth headers."""
        # Register user
        register_data = {
            "email": "trip_test@example.com",
            "password": "TripTest123!",
            "password_confirmation": "TripTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "trip_test@example.com",
            "password": "TripTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    @pytest_asyncio.fixture(scope="function")
    async def other_auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create another authenticated user for permission testing."""
        # Register user
        register_data = {
            "email": "other_trip_test@example.com",
            "password": "OtherTest123!",
            "password_confirmation": "OtherTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "other_trip_test@example.com",
            "password": "OtherTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    @pytest_asyncio.fixture(scope="function")
    async def sample_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create a sample trip and return its data."""
        trip_data = {
            "name": "Test Alpine Adventure",
            "start_date": "2024-07-15",
            "end_date": "2024-07-22",
            "meal_slots": ["Breakfast", "Lunch", "Dinner", "Snack"],
            "participants": [
                {"name": "Alice", "coefficient": 100.0},
                {"name": "Bob", "coefficient": 120.0},
                {"number": 3, "coefficient": 80.0}
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        return response.json()


class TestTripCreationEndpoint:
    """Test trip creation endpoint."""
    
    async def test_create_trip_success(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test successful trip creation."""
        trip_data = {
            "name": "Summer Hiking Trip",
            "start_date": "2024-08-01",
            "end_date": "2024-08-07",
            "meal_slots": ["Breakfast", "Dinner"],
            "participants": [
                {"name": "John", "coefficient": 100.0},
                {"name": "Jane", "coefficient": 90.0}
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "Summer Hiking Trip"
        assert data["start_date"] == "2024-08-01"
        assert data["end_date"] == "2024-08-07"
        assert data["duration_days"] == 7
        assert data["meal_slots"] == ["Breakfast", "Dinner"]
        assert len(data["participants"]) == 2
        assert data["is_archived"] is False
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        
    async def test_create_trip_without_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test creating trip without participants."""
        trip_data = {
            "name": "Solo Trip",
            "start_date": "2024-09-01",
            "end_date": "2024-09-03"
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "Solo Trip"
        assert data["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]  # Default
        assert len(data["participants"]) == 0
        
    async def test_create_trip_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test trip creation validation errors."""
        # Empty name
        response = await async_client.post(
            "/api/v1/trips",
            json={
                "name": "",
                "start_date": "2024-07-01",
                "end_date": "2024-07-05"
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Invalid date range
        response = await async_client.post(
            "/api/v1/trips",
            json={
                "name": "Invalid Dates",
                "start_date": "2024-07-10",
                "end_date": "2024-07-05"
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Empty meal slots
        response = await async_client.post(
            "/api/v1/trips",
            json={
                "name": "No Meals",
                "start_date": "2024-07-01",
                "end_date": "2024-07-05",
                "meal_slots": []
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Too many participants
        participants = [
            {"name": f"Person{i}", "coefficient": 100.0}
            for i in range(21)
        ]
        response = await async_client.post(
            "/api/v1/trips",
            json={
                "name": "Too Many People",
                "start_date": "2024-07-01",
                "end_date": "2024-07-05",
                "participants": participants
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
    async def test_create_trip_unauthenticated(
        self,
        async_client: AsyncClient
    ):
        """Test creating trip without authentication."""
        trip_data = {
            "name": "Unauthorized Trip",
            "start_date": "2024-07-01",
            "end_date": "2024-07-05"
        }
        
        response = await async_client.post("/api/v1/trips", json=trip_data)
        assert response.status_code == 401


class TestTripRetrievalEndpoints:
    """Test trip retrieval endpoints."""
    
    async def test_get_trip_by_id(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test retrieving trip by ID."""
        response = await async_client.get(
            f"/api/v1/trips/{sample_trip['id']}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == sample_trip["id"]
        assert data["name"] == sample_trip["name"]
        assert len(data["participants"]) == 3
        assert data["total_meals_planned"] == 0  # No meals added yet
        assert data["completion_percentage"] == 0.0
        
    async def test_get_trip_not_found(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test retrieving non-existent trip."""
        fake_id = str(uuid4())
        
        response = await async_client.get(
            f"/api/v1/trips/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"
        
    async def test_get_trip_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test retrieving trip without permission."""
        response = await async_client.get(
            f"/api/v1/trips/{sample_trip['id']}",
            headers=other_auth_headers
        )
        
        assert response.status_code == 403
        assert response.json()["detail"] == "You don't have permission to access this trip"
        
    async def test_list_trips(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test listing user trips."""
        # Create multiple trips
        for i in range(5):
            await async_client.post(
                "/api/v1/trips",
                json={
                    "name": f"Trip {i+1}",
                    "start_date": f"2024-07-{i+1:02d}",
                    "end_date": f"2024-07-{i+5:02d}"
                },
                headers=auth_headers
            )
        
        # List trips
        response = await async_client.get(
            "/api/v1/trips",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 5  # May include sample_trip
        assert len(data["items"]) >= 5
        assert data["page"] == 1
        assert "total_pages" in data
        assert "has_next" in data
        assert "has_prev" in data
        
        # Verify trip list item structure
        trip_item = data["items"][0]
        assert "id" in trip_item
        assert "name" in trip_item
        assert "start_date" in trip_item
        assert "end_date" in trip_item
        assert "duration_days" in trip_item
        assert "participant_count" in trip_item
        assert "is_archived" in trip_item
        
    async def test_list_trips_pagination(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test trip list pagination."""
        # Create 15 trips
        for i in range(15):
            await async_client.post(
                "/api/v1/trips",
                json={
                    "name": f"Trip {i+1}",
                    "start_date": "2024-07-01",
                    "end_date": "2024-07-05"
                },
                headers=auth_headers
            )
        
        # Get first page
        response = await async_client.get(
            "/api/v1/trips?page=1&page_size=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        page1 = response.json()
        
        assert page1["total"] >= 15
        assert len(page1["items"]) == 10
        assert page1["page"] == 1
        assert page1["page_size"] == 10
        assert page1["has_next"] is True
        assert page1["has_prev"] is False
        
        # Get second page
        response = await async_client.get(
            "/api/v1/trips?page=2&page_size=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        page2 = response.json()
        
        assert len(page2["items"]) >= 5
        assert page2["page"] == 2
        assert page2["has_prev"] is True
        
    async def test_search_trips(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test trip search functionality."""
        # Create trips with different attributes
        await async_client.post(
            "/api/v1/trips",
            json={
                "name": "Winter Ski Trip",
                "start_date": "2024-01-10",
                "end_date": "2024-01-15",
                "participants": [
                    {"name": "Skier1", "coefficient": 100.0}
                ]
            },
            headers=auth_headers
        )
        
        await async_client.post(
            "/api/v1/trips",
            json={
                "name": "Summer Beach Vacation",
                "start_date": "2024-07-01",
                "end_date": "2024-07-14",
                "participants": [
                    {"name": "Person1", "coefficient": 100.0},
                    {"name": "Person2", "coefficient": 100.0}
                ]
            },
            headers=auth_headers
        )
        
        # Search by name
        response = await async_client.get(
            "/api/v1/trips/search?query=Winter",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert "Winter" in data["items"][0]["name"]
        
        # Search by date range
        response = await async_client.get(
            "/api/v1/trips/search?start_date_from=2024-06-01&start_date_to=2024-08-01",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        found_summer = any("Summer" in item["name"] for item in data["items"])
        assert found_summer
        
        # Search by participant count
        response = await async_client.get(
            "/api/v1/trips/search?min_participants=2",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["participant_count"] >= 2


class TestTripUpdateEndpoints:
    """Test trip update endpoints."""
    
    async def test_update_trip_basic_info(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test updating basic trip information."""
        update_data = {
            "name": "Updated Alpine Adventure",
            "start_date": "2024-08-01",
            "end_date": "2024-08-10",
            "meal_slots": ["Morning", "Afternoon", "Evening"]
        }
        
        response = await async_client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "Updated Alpine Adventure"
        assert data["start_date"] == "2024-08-01"
        assert data["end_date"] == "2024-08-10"
        assert data["duration_days"] == 10
        assert data["meal_slots"] == ["Morning", "Afternoon", "Evening"]
        
    async def test_update_trip_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test updating trip participants."""
        # Get participant IDs
        alice = next(p for p in sample_trip["participants"] if p["name"] == "Alice")
        bob = next(p for p in sample_trip["participants"] if p["name"] == "Bob")
        
        update_data = {
            "participants": [
                {
                    "id": alice["id"],
                    "coefficient": 150.0
                },
                {
                    "id": bob["id"],
                    "name": "Robert"
                }
            ]
        }
        
        response = await async_client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check updates
        updated_alice = next(p for p in data["participants"] if p["id"] == alice["id"])
        assert updated_alice["coefficient"] == 150.0
        
        updated_bob = next(p for p in data["participants"] if p["id"] == bob["id"])
        assert updated_bob["name"] == "Robert"
        
    async def test_update_trip_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test trip update validation errors."""
        # Invalid date range
        response = await async_client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json={
                "start_date": "2024-08-10",
                "end_date": "2024-08-05"
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Empty name
        response = await async_client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json={"name": ""},
            headers=auth_headers
        )
        assert response.status_code == 422
        
    async def test_update_trip_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test updating trip without permission."""
        response = await async_client.patch(
            f"/api/v1/trips/{sample_trip['id']}",
            json={"name": "Unauthorized Update"},
            headers=other_auth_headers
        )
        
        assert response.status_code == 403


class TestTripArchivingEndpoints:
    """Test trip archiving endpoints."""
    
    async def test_archive_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test archiving a trip."""
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/archive",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["message"] == "Trip archived successfully"
        
        # Verify trip is archived
        response = await async_client.get(
            f"/api/v1/trips/{sample_trip['id']}?include_archived=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["is_archived"] is True
        
    async def test_unarchive_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test unarchiving a trip."""
        # First archive the trip
        await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/archive",
            headers=auth_headers
        )
        
        # Then unarchive it
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/unarchive",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["message"] == "Trip unarchived successfully"
        
        # Verify trip is not archived
        response = await async_client.get(
            f"/api/v1/trips/{sample_trip['id']}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["is_archived"] is False
        
    async def test_archive_trip_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test archiving trip without permission."""
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/archive",
            headers=other_auth_headers
        )
        
        assert response.status_code == 403


class TestTripDuplicationEndpoints:
    """Test trip duplication endpoints."""
    
    async def test_duplicate_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test duplicating a trip."""
        duplicate_data = {
            "new_name": "Summer Alpine Trek 2025",
            "include_meals": False,
            "include_participants": True,
            "new_start_date": "2025-07-15"
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/duplicate",
            json=duplicate_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["id"] != sample_trip["id"]
        assert data["name"] == "Summer Alpine Trek 2025"
        assert data["start_date"] == "2025-07-15"
        assert data["end_date"] == "2025-07-22"  # Same duration
        assert len(data["participants"]) == 3
        
    async def test_duplicate_trip_auto_name(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test duplicating trip with automatic naming."""
        duplicate_data = {
            "include_meals": True,
            "include_participants": True
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/duplicate",
            json=duplicate_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == f"{sample_trip['name']} (Copy)"
        assert data["start_date"] == sample_trip["start_date"]
        assert data["end_date"] == sample_trip["end_date"]
        
    async def test_duplicate_trip_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test duplicating trip without permission."""
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/duplicate",
            json={},
            headers=other_auth_headers
        )
        
        assert response.status_code == 403


class TestTripSharingEndpoints:
    """Test trip sharing endpoints."""
    
    async def test_generate_share_link(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test generating a share link."""
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/share",
            json={"expires_in_days": 7},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "share_url" in data
        assert "share_token" in data
        assert "expires_at" in data
        assert len(data["share_token"]) >= 32
        
    async def test_access_trip_by_share_token(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test accessing trip via share token."""
        # Generate share link
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/share",
            headers=auth_headers
        )
        share_data = response.json()
        
        # Access trip with share token (as different user)
        response = await async_client.get(
            f"/api/v1/trips/shared/{share_data['share_token']}",
            headers=other_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == sample_trip["id"]
        assert data["name"] == sample_trip["name"]
        
    async def test_revoke_share_link(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test revoking a share link."""
        # Generate share link
        response = await async_client.post(
            f"/api/v1/trips/{sample_trip['id']}/share",
            headers=auth_headers
        )
        share_data = response.json()
        
        # Revoke the link
        response = await async_client.delete(
            f"/api/v1/trips/{sample_trip['id']}/share",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["message"] == "Share link revoked successfully"
        
        # Try to access with revoked token
        response = await async_client.get(
            f"/api/v1/trips/shared/{share_data['share_token']}",
            headers=other_auth_headers
        )
        
        assert response.status_code == 404


class TestTripDeletionEndpoints:
    """Test trip deletion endpoints."""
    
    async def test_delete_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test deleting a trip."""
        response = await async_client.delete(
            f"/api/v1/trips/{sample_trip['id']}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify trip is deleted
        response = await async_client.get(
            f"/api/v1/trips/{sample_trip['id']}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        
    async def test_delete_trip_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip: Dict[str, Any]
    ):
        """Test deleting trip without permission."""
        response = await async_client.delete(
            f"/api/v1/trips/{sample_trip['id']}",
            headers=other_auth_headers
        )
        
        assert response.status_code == 403
        
    async def test_delete_nonexistent_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test deleting non-existent trip."""
        fake_id = str(uuid4())
        
        response = await async_client.delete(
            f"/api/v1/trips/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestTripStatisticsEndpoint:
    """Test trip statistics endpoint."""
    
    async def test_get_trip_statistics(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test getting trip statistics."""
        # Create multiple trips
        await async_client.post(
            "/api/v1/trips",
            json={
                "name": "Trip 1",
                "start_date": "2024-01-01",
                "end_date": "2024-01-05",
                "participants": [
                    {"name": "P1", "coefficient": 100.0},
                    {"name": "P2", "coefficient": 100.0}
                ]
            },
            headers=auth_headers
        )
        
        trip2_response = await async_client.post(
            "/api/v1/trips",
            json={
                "name": "Trip 2",
                "start_date": "2024-02-01",
                "end_date": "2024-02-10",
                "meal_slots": ["Morning", "Evening"],
                "participants": [
                    {"name": "P1", "coefficient": 100.0}
                ]
            },
            headers=auth_headers
        )
        trip2_id = trip2_response.json()["id"]
        
        # Archive one trip
        await async_client.post(
            f"/api/v1/trips/{trip2_id}/archive",
            headers=auth_headers
        )
        
        # Get statistics
        response = await async_client.get(
            "/api/v1/trips/statistics",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_trips"] >= 2
        assert data["active_trips"] >= 1
        assert data["archived_trips"] >= 1
        assert data["total_trip_days"] >= 15  # 5 + 10 days
        assert "average_trip_duration" in data
        assert "average_participants" in data
        assert "most_common_meal_slots" in data
        assert isinstance(data["most_common_meal_slots"], list)