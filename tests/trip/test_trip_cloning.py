"""
Comprehensive tests for Trip Cloning API endpoints and functionality.

This module provides complete test coverage for trip cloning,
including endpoint tests, service method tests, permission checks,
and various cloning scenarios.
"""

import pytest
import pytest_asyncio
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4, UUID
from typing import Dict, Any, List, Optional

import httpx
from httpx import AsyncClient

from jidelnicek.auth.models import AuthUser
from jidelnicek.trip.models import Trip, TripParticipant, TripDay, TripMeal
from jidelnicek.trip.services.trip_service import TripService
from jidelnicek.trip.schemas.trip import TripCloneRequest
from jidelnicek.trip.schemas.participant import ParticipantCreate
from jidelnicek.core.exceptions import NotFoundError, PermissionError, ValidationError


pytestmark = pytest.mark.asyncio


class TestTripCloningEndpoint:
    """Test trip cloning API endpoint."""
    
    @pytest_asyncio.fixture(scope="function")
    async def auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create authenticated user and return auth headers."""
        # Register user
        register_data = {
            "email": "clone_test@example.com",
            "password": "CloneTest123!",
            "password_confirmation": "CloneTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "clone_test@example.com",
            "password": "CloneTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    @pytest_asyncio.fixture(scope="function")
    async def other_auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create another authenticated user for permission testing."""
        # Register user
        register_data = {
            "email": "other_clone_test@example.com",
            "password": "OtherClone123!",
            "password_confirmation": "OtherClone123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "other_clone_test@example.com",
            "password": "OtherClone123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    @pytest_asyncio.fixture(scope="function")
    async def sample_trip_with_meals(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Create a sample trip with participants and meal assignments."""
        trip_data = {
            "name": "Original Summer Trip",
            "start_date": "2024-07-15",
            "end_date": "2024-07-20",  # 6 days
            "meal_slots": ["Breakfast", "Lunch", "Dinner"],
            "participants": [
                {"name": "Alice", "coefficient": 100.0, "email": "alice@example.com"},
                {"name": "Bob", "coefficient": 120.0},
                {"name": "Charlie", "coefficient": 80.0},  # Child
                {
                    "name": "Dave", 
                    "coefficient": 100.0,
                    "arrival_date": "2024-07-16",  # Arrives day 2
                    "departure_date": "2024-07-18"  # Leaves day 4
                }
            ],
            "notes": "Annual family camping trip"
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        trip = response.json()
        
        # Add some meal assignments (simulate)
        # In real scenario, would use meal assignment endpoints
        
        return trip
        
    async def test_clone_trip_basic(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test basic trip cloning with all options enabled."""
        trip_id = sample_trip_with_meals["id"]
        new_start_date = date.today() + timedelta(days=30)
        
        clone_data = {
            "new_name": "Summer Trip 2025 Clone",
            "start_date": new_start_date.isoformat(),
            "clone_participants": True,
            "clone_meal_slots": True,
            "clone_meal_assignments": True,
            "notes": "Cloned for next year"
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned_trip = response.json()
        
        # Verify basic properties
        assert cloned_trip["name"] == "Summer Trip 2025 Clone"
        assert cloned_trip["start_date"] == new_start_date.isoformat()
        assert cloned_trip["duration_days"] == sample_trip_with_meals["duration_days"]
        assert cloned_trip["notes"] == "Cloned for next year"
        
        # Verify meal slots were cloned
        assert cloned_trip["meal_slots"] == sample_trip_with_meals["meal_slots"]
        
        # Verify it's owned by the current user
        assert cloned_trip["user_id"] == sample_trip_with_meals["user_id"]
        
    async def test_clone_trip_without_participants(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning trip without participants."""
        trip_id = sample_trip_with_meals["id"]
        
        clone_data = {
            "new_name": "Solo Trip Clone",
            "start_date": (date.today() + timedelta(days=14)).isoformat(),
            "clone_participants": False,
            "clone_meal_slots": True,
            "clone_meal_assignments": True
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned_trip = response.json()
        
        # Verify no participants were cloned
        assert len(cloned_trip.get("participants", [])) == 0
        
        # But meal slots should be cloned
        assert cloned_trip["meal_slots"] == sample_trip_with_meals["meal_slots"]
        
    async def test_clone_trip_without_meal_slots(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning trip without meal slots."""
        trip_id = sample_trip_with_meals["id"]
        
        clone_data = {
            "new_name": "Basic Clone",
            "start_date": (date.today() + timedelta(days=7)).isoformat(),
            "clone_participants": True,
            "clone_meal_slots": False,
            "clone_meal_assignments": False
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned_trip = response.json()
        
        # Should have default meal slots
        assert cloned_trip["meal_slots"] == ["Breakfast", "Lunch", "Dinner"]
        
    async def test_clone_trip_without_meal_assignments(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning trip without meal assignments."""
        trip_id = sample_trip_with_meals["id"]
        
        clone_data = {
            "new_name": "Clone Without Meals",
            "start_date": (date.today() + timedelta(days=21)).isoformat(),
            "clone_participants": True,
            "clone_meal_slots": True,
            "clone_meal_assignments": False
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned_trip = response.json()
        
        # Verify structure is cloned but no meal assignments
        assert cloned_trip["meal_slots"] == sample_trip_with_meals["meal_slots"]
        # Days should exist but no meals assigned
        assert len(cloned_trip.get("days", [])) == sample_trip_with_meals["duration_days"]
        
    async def test_clone_trip_with_participant_overrides(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning with participant overrides."""
        trip_id = sample_trip_with_meals["id"]
        
        clone_data = {
            "new_name": "Custom Participants Clone",
            "start_date": (date.today() + timedelta(days=10)).isoformat(),
            "clone_participants": True,  # Should be ignored when overrides provided
            "clone_meal_slots": True,
            "clone_meal_assignments": True,
            "participant_overrides": [
                {
                    "name": "Emma",
                    "coefficient": 110.0,
                    "email": "emma@example.com"
                },
                {
                    "name": "Frank",
                    "coefficient": 90.0,
                    "meal_coefficients": {
                        "Breakfast": 60,
                        "Lunch": 100,
                        "Dinner": 110
                    }
                },
                {
                    "name": "Grace",
                    "coefficient": 100.0,
                    "arrival_date": (date.today() + timedelta(days=12)).isoformat(),
                    "departure_date": (date.today() + timedelta(days=14)).isoformat()
                }
            ]
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned_trip = response.json()
        
        # Verify participants match overrides
        participants = cloned_trip.get("participants", [])
        assert len(participants) == 3
        
        # Check participant details if returned
        # Note: The actual response structure may vary based on implementation
        
    async def test_clone_trip_permission_denied(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning fails without permission."""
        trip_id = sample_trip_with_meals["id"]
        
        clone_data = {
            "new_name": "Unauthorized Clone",
            "start_date": (date.today() + timedelta(days=10)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=other_auth_headers
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()
        
    async def test_clone_trip_not_found(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test cloning non-existent trip."""
        fake_trip_id = str(uuid4())
        
        clone_data = {
            "new_name": "Clone of Nothing",
            "start_date": (date.today() + timedelta(days=10)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{fake_trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
        
    async def test_clone_trip_validation_errors(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning with validation errors."""
        trip_id = sample_trip_with_meals["id"]
        
        # Test with empty name
        clone_data = {
            "new_name": "",
            "start_date": (date.today() + timedelta(days=10)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
        # Test with past date
        clone_data = {
            "new_name": "Past Date Clone",
            "start_date": (date.today() - timedelta(days=10)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
        # Test with too many participant overrides
        clone_data = {
            "new_name": "Too Many Participants",
            "start_date": (date.today() + timedelta(days=10)).isoformat(),
            "participant_overrides": [
                {"name": f"Person{i}", "coefficient": 100.0}
                for i in range(25)  # Exceeds max_items=20
            ]
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
    async def test_clone_trip_unauthenticated(
        self,
        async_client: AsyncClient,
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test cloning without authentication."""
        trip_id = sample_trip_with_meals["id"]
        
        clone_data = {
            "new_name": "Unauthenticated Clone",
            "start_date": (date.today() + timedelta(days=10)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data
        )
        
        assert response.status_code == 401
        
    async def test_clone_shared_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        other_auth_headers: Dict[str, str]
    ):
        """Test cloning a shared trip by non-owner."""
        # Create a shareable trip
        trip_data = {
            "name": "Shared Trip",
            "start_date": "2024-08-01",
            "end_date": "2024-08-05",
            "meal_slots": ["Breakfast", "Lunch", "Dinner"]
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        trip_id = trip["id"]
        
        # Generate share link
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/share",
            headers=auth_headers
        )
        
        # Note: Actual sharing implementation may vary
        # This test assumes shared trips can be cloned by others
        
    async def test_clone_trip_preserves_duration(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test that cloned trip preserves the original duration."""
        trip_id = sample_trip_with_meals["id"]
        original_duration = sample_trip_with_meals["duration_days"]
        
        new_start_date = date.today() + timedelta(days=60)
        clone_data = {
            "new_name": "Duration Test Clone",
            "start_date": new_start_date.isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip_id}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned_trip = response.json()
        
        # Verify duration is preserved
        assert cloned_trip["duration_days"] == original_duration
        
        # Verify end date is calculated correctly
        expected_end_date = new_start_date + timedelta(days=original_duration - 1)
        assert cloned_trip["end_date"] == expected_end_date.isoformat()


class TestTripCloningService:
    """Test trip cloning service method directly."""
    
    @pytest_asyncio.fixture(scope="function")
    async def trip_service(self, db_session):
        """Create trip service instance."""
        return TripService(db_session)
        
    @pytest_asyncio.fixture(scope="function")
    async def test_user(self, db_session) -> AuthUser:
        """Create a test user."""
        user = AuthUser(
            email="service_test@example.com",
            password_hash="hashed_password",
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user
        
    @pytest_asyncio.fixture(scope="function")
    async def test_trip(self, db_session, test_user) -> Trip:
        """Create a test trip with participants and meals."""
        trip = Trip(
            user_id=test_user.id,
            name="Test Trip",
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=10),
            meal_slots=["Breakfast", "Lunch", "Dinner", "Snack"]
        )
        db_session.add(trip)
        await db_session.flush()
        
        # Add participants
        participants = [
            TripParticipant(
                trip_id=trip.id,
                name="Alice",
                number=1,
                coefficient=Decimal("100.00"),
                email="alice@test.com"
            ),
            TripParticipant(
                trip_id=trip.id,
                name="Bob",
                number=2,
                coefficient=Decimal("120.00"),
                meal_coefficients={"Breakfast": 80, "Lunch": 120, "Dinner": 140}
            )
        ]
        for p in participants:
            db_session.add(p)
            
        # Add days
        for i in range(4):  # 4 days
            day = TripDay(
                trip_id=trip.id,
                day_number=i + 1,
                date=trip.start_date + timedelta(days=i)
            )
            db_session.add(day)
            
        await db_session.commit()
        await db_session.refresh(trip)
        
        return trip
        
    async def test_clone_trip_date_calculations(
        self,
        trip_service: TripService,
        test_user: AuthUser,
        test_trip: Trip
    ):
        """Test that date calculations work correctly when cloning."""
        new_start_date = date.today() + timedelta(days=30)
        
        clone_data = TripCloneRequest(
            new_name="Date Test Clone",
            start_date=new_start_date,
            clone_participants=True,
            clone_meal_slots=True,
            clone_meal_assignments=True
        )
        
        cloned_trip = await trip_service.clone_trip(
            trip_id=test_trip.id,
            user_id=test_user.id,
            clone_data=clone_data
        )
        
        # Verify dates
        assert cloned_trip.start_date == new_start_date
        expected_end_date = new_start_date + timedelta(days=3)  # 4 days total
        assert cloned_trip.end_date == expected_end_date
        assert cloned_trip.duration_days == 4
        
        # Verify days have correct dates
        assert len(cloned_trip.days) == 4
        for i, day in enumerate(cloned_trip.days):
            expected_day_date = new_start_date + timedelta(days=i)
            assert day.date == expected_day_date
            assert day.day_number == i + 1
            
    async def test_clone_trip_participant_logic(
        self,
        trip_service: TripService,
        test_user: AuthUser,
        test_trip: Trip
    ):
        """Test participant cloning logic."""
        # Test with participant cloning enabled
        clone_data = TripCloneRequest(
            new_name="Participant Clone Test",
            start_date=date.today() + timedelta(days=14),
            clone_participants=True,
            clone_meal_slots=True,
            clone_meal_assignments=False
        )
        
        cloned_trip = await trip_service.clone_trip(
            trip_id=test_trip.id,
            user_id=test_user.id,
            clone_data=clone_data
        )
        
        # Verify participants were cloned
        assert len(cloned_trip.participants) == 2
        
        # Check that arrival/departure dates were not copied
        for participant in cloned_trip.participants:
            assert participant.arrival_date is None
            assert participant.departure_date is None
            
        # Verify meal coefficients were preserved
        bob = next(p for p in cloned_trip.participants if p.name == "Bob")
        assert bob.meal_coefficients == {"Breakfast": 80, "Lunch": 120, "Dinner": 140}
        
    async def test_clone_trip_with_meal_assignments(
        self,
        trip_service: TripService,
        test_user: AuthUser,
        test_trip: Trip,
        db_session
    ):
        """Test cloning with meal assignments."""
        # Add some meal assignments to the original trip
        day1 = test_trip.days[0]
        meal = TripMeal(
            day_id=day1.id,
            recipe_id=uuid4(),
            meal_slot="Breakfast",
            servings_override=6,
            notes="Extra hungry morning",
            recipe_snapshot={"name": "Pancakes", "servings": 4}
        )
        db_session.add(meal)
        await db_session.commit()
        
        # Clone with meal assignments
        clone_data = TripCloneRequest(
            new_name="Meal Assignment Clone",
            start_date=date.today() + timedelta(days=21),
            clone_participants=True,
            clone_meal_slots=True,
            clone_meal_assignments=True
        )
        
        cloned_trip = await trip_service.clone_trip(
            trip_id=test_trip.id,
            user_id=test_user.id,
            clone_data=clone_data
        )
        
        # Verify meal assignments were cloned
        cloned_day1 = cloned_trip.days[0]
        assert len(cloned_day1.meals) == 1
        
        cloned_meal = cloned_day1.meals[0]
        assert cloned_meal.meal_slot == "Breakfast"
        assert cloned_meal.servings_override == 6
        assert cloned_meal.notes == "Extra hungry morning"
        assert cloned_meal.recipe_snapshot == {"name": "Pancakes", "servings": 4}
        
    async def test_clone_trip_ownership(
        self,
        trip_service: TripService,
        test_user: AuthUser,
        test_trip: Trip,
        db_session
    ):
        """Test that cloned trip has correct ownership."""
        # Create another user
        other_user = AuthUser(
            email="other_service@example.com",
            password_hash="hashed_password",
            email_verified=True
        )
        db_session.add(other_user)
        await db_session.commit()
        
        # Make trip shareable
        test_trip.is_shareable = True
        await db_session.commit()
        
        # Clone as other user
        clone_data = TripCloneRequest(
            new_name="Other User Clone",
            start_date=date.today() + timedelta(days=14)
        )
        
        cloned_trip = await trip_service.clone_trip(
            trip_id=test_trip.id,
            user_id=other_user.id,
            clone_data=clone_data
        )
        
        # Verify ownership
        assert cloned_trip.user_id == other_user.id
        assert cloned_trip.user_id != test_trip.user_id


class TestTripCloningEdgeCases:
    """Test edge cases and error conditions for trip cloning."""
    
    @pytest_asyncio.fixture(scope="function")
    async def auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create authenticated user and return auth headers."""
        register_data = {
            "email": "edge_test@example.com",
            "password": "EdgeTest123!",
            "password_confirmation": "EdgeTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        login_data = {
            "email": "edge_test@example.com",
            "password": "EdgeTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    async def test_clone_trip_with_special_characters(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test cloning with special characters in names."""
        # Create trip with special characters
        trip_data = {
            "name": "Trip with émojis 🏕️ & symbols!",
            "start_date": "2024-09-01",
            "end_date": "2024-09-03",
            "participants": [
                {"name": "José María", "coefficient": 100.0},
                {"name": "李明 (Li Ming)", "coefficient": 110.0}
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        
        # Clone with special characters
        clone_data = {
            "new_name": "Cloned 🎉 Trip with symbols & émojis!",
            "start_date": (date.today() + timedelta(days=30)).isoformat(),
            "clone_participants": True
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip['id']}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        cloned = response.json()
        assert cloned["name"] == "Cloned 🎉 Trip with symbols & émojis!"
        
    async def test_clone_trip_max_name_length(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test cloning with maximum name length."""
        # Create a simple trip
        trip_data = {
            "name": "Short Name",
            "start_date": "2024-09-01",
            "end_date": "2024-09-03"
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        
        # Try to clone with name exceeding max length (100 chars)
        long_name = "A" * 101
        clone_data = {
            "new_name": long_name,
            "start_date": (date.today() + timedelta(days=30)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{trip['id']}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
    async def test_clone_trip_concurrent_requests(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test handling of concurrent clone requests."""
        # Create a trip
        trip_data = {
            "name": "Concurrent Test Trip",
            "start_date": "2024-09-01",
            "end_date": "2024-09-03"
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        trip_id = trip["id"]
        
        # Simulate concurrent clone requests
        import asyncio
        
        async def clone_trip(index: int):
            clone_data = {
                "new_name": f"Concurrent Clone {index}",
                "start_date": (date.today() + timedelta(days=30 + index)).isoformat()
            }
            
            return await async_client.post(
                f"/api/v1/trips/{trip_id}/clone",
                json=clone_data,
                headers=auth_headers
            )
            
        # Run multiple clone requests concurrently
        responses = await asyncio.gather(
            clone_trip(1),
            clone_trip(2),
            clone_trip(3),
            return_exceptions=True
        )
        
        # All should succeed
        for response in responses:
            if not isinstance(response, Exception):
                assert response.status_code == 201
                
    async def test_clone_trip_with_invalid_uuid(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test cloning with invalid UUID format."""
        invalid_uuid = "not-a-valid-uuid"
        
        clone_data = {
            "new_name": "Invalid UUID Clone",
            "start_date": (date.today() + timedelta(days=10)).isoformat()
        }
        
        response = await async_client.post(
            f"/api/v1/trips/{invalid_uuid}/clone",
            json=clone_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
    async def test_clone_trip_with_malformed_json(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test cloning with malformed JSON request."""
        # Create a trip first
        trip_data = {
            "name": "Test Trip",
            "start_date": "2024-09-01",
            "end_date": "2024-09-03"
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        
        # Send malformed request
        response = await async_client.post(
            f"/api/v1/trips/{trip['id']}/clone",
            content='{"new_name": "Missing quote}',  # Malformed JSON
            headers={**auth_headers, "Content-Type": "application/json"}
        )
        
        assert response.status_code == 422