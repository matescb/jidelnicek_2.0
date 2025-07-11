"""
Tests for trip participant API endpoints.
"""

import pytest
import pytest_asyncio
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.trip.models import Trip, TripParticipant, TripDay


@pytest_asyncio.fixture(scope="function")
async def trip_with_days(db_session: AsyncSession, test_user):
    """Create a test trip with days."""
    trip = Trip(
        user_id=test_user.id,
        name="Test Trip",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=5),
        meal_slots=["Breakfast", "Lunch", "Dinner"]
    )
    db_session.add(trip)
    await db_session.commit()
    
    # Add days
    for i in range(6):
        day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=trip.start_date + timedelta(days=i)
        )
        db_session.add(day)
    
    await db_session.commit()
    await db_session.refresh(trip)
    return trip


class TestAddParticipantEndpoint:
    """Test POST /trips/{trip_id}/participants endpoint."""
    
    async def test_add_participant_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test successfully adding a participant."""
        participant_data = {
            "name": "John Doe",
            "coefficient": 100.00,
            "email": "john@example.com"
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/participants",
            json=participant_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "John Doe"
        assert data["coefficient"] == "100.00"
        assert data["email"] == "john@example.com"
        assert data["trip_id"] == str(trip_with_days.id)
    
    async def test_add_participant_with_meal_coefficients(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test adding participant with meal-specific coefficients."""
        participant_data = {
            "name": "Jane Doe",
            "coefficient": 100.00,
            "meal_coefficients": {
                "breakfast": 50.00,
                "lunch": 100.00,
                "dinner": 120.00
            }
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/participants",
            json=participant_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["meal_coefficients"]["breakfast"] == "50.00"
        assert data["meal_coefficients"]["lunch"] == "100.00"
        assert data["meal_coefficients"]["dinner"] == "120.00"
    
    async def test_add_participant_with_partial_attendance(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test adding participant with arrival/departure dates."""
        participant_data = {
            "name": "Partial Participant",
            "coefficient": 100.00,
            "arrival_date": (trip_with_days.start_date + timedelta(days=1)).isoformat(),
            "departure_date": (trip_with_days.end_date - timedelta(days=1)).isoformat()
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/participants",
            json=participant_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["arrival_date"] == participant_data["arrival_date"]
        assert data["departure_date"] == participant_data["departure_date"]
    
    async def test_add_participant_invalid_data(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test adding participant with invalid data."""
        # Neither name nor number provided
        participant_data = {
            "coefficient": 100.00
        }
        
        response = await authenticated_client.post(
            f"/trips/{trip_with_days.id}/participants",
            json=participant_data
        )
        
        assert response.status_code == 400
        assert "Either name or number must be provided" in response.json()["detail"]
    
    async def test_add_participant_to_nonexistent_trip(
        self,
        authenticated_client: AsyncClient
    ):
        """Test adding participant to non-existent trip."""
        participant_data = {
            "name": "Test",
            "coefficient": 100.00
        }
        
        response = await authenticated_client.post(
            f"/trips/{uuid4()}/participants",
            json=participant_data
        )
        
        assert response.status_code == 404
    
    async def test_add_participant_unauthorized(
        self,
        client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test adding participant without authentication."""
        participant_data = {
            "name": "Test",
            "coefficient": 100.00
        }
        
        response = await client.post(
            f"/trips/{trip_with_days.id}/participants",
            json=participant_data
        )
        
        assert response.status_code == 401


class TestListParticipantsEndpoint:
    """Test GET /trips/{trip_id}/participants endpoint."""
    
    async def test_list_participants_empty(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test listing participants when none exist."""
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/participants"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data == []
    
    async def test_list_participants_with_data(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test listing participants."""
        # Add participants
        participants = []
        for i in range(3):
            p = TripParticipant(
                trip_id=trip_with_days.id,
                number=i + 1,
                coefficient=Decimal("100.00")
            )
            db_session.add(p)
            participants.append(p)
        await db_session.commit()
        
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/participants"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all(p["coefficient"] == "100.00" for p in data)


class TestGetDayParticipantsEndpoint:
    """Test GET /trips/{trip_id}/participants/day/{day_number} endpoint."""
    
    async def test_get_day_participants(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test getting participants for a specific day."""
        # Add participants with different attendance
        p1 = TripParticipant(
            trip_id=trip_with_days.id,
            name="Full Timer",
            coefficient=Decimal("100.00")
        )
        p2 = TripParticipant(
            trip_id=trip_with_days.id,
            name="Late Arrival",
            coefficient=Decimal("100.00"),
            arrival_date=trip_with_days.start_date + timedelta(days=2)
        )
        
        db_session.add_all([p1, p2])
        await db_session.commit()
        
        # Get day 1 participants
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/participants/day/1"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["day_number"] == 1
        assert data["total_participants"] == 1
        assert data["total_coefficient"] == "100.00"
        assert len(data["participants"]) == 1
        assert data["participants"][0]["name"] == "Full Timer"
        
        # Get day 3 participants
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/participants/day/3"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_participants"] == 2
        assert data["total_coefficient"] == "200.00"
    
    async def test_get_day_participants_invalid_day(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test getting participants for invalid day."""
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/participants/day/99"
        )
        
        assert response.status_code == 404
        assert "Day 99 not found" in response.json()["detail"]


class TestUpdateParticipantEndpoint:
    """Test PUT /trips/{trip_id}/participants/{participant_id} endpoint."""
    
    async def test_update_participant_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test successfully updating a participant."""
        # Create participant
        participant = TripParticipant(
            trip_id=trip_with_days.id,
            name="Original Name",
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        await db_session.commit()
        await db_session.refresh(participant)
        
        # Update participant
        update_data = {
            "email": "updated@example.com",
            "coefficient": 80.00
        }
        
        response = await authenticated_client.put(
            f"/trips/{trip_with_days.id}/participants/{participant.id}",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original Name"  # Unchanged
        assert data["email"] == "updated@example.com"
        assert data["coefficient"] == "80.00"
    
    async def test_update_participant_attendance_dates(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test updating participant attendance dates."""
        # Create participant
        participant = TripParticipant(
            trip_id=trip_with_days.id,
            name="Test Participant",
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        await db_session.commit()
        await db_session.refresh(participant)
        
        # Update with attendance dates
        update_data = {
            "arrival_date": (trip_with_days.start_date + timedelta(days=1)).isoformat(),
            "departure_date": (trip_with_days.end_date - timedelta(days=1)).isoformat()
        }
        
        response = await authenticated_client.put(
            f"/trips/{trip_with_days.id}/participants/{participant.id}",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["arrival_date"] == update_data["arrival_date"]
        assert data["departure_date"] == update_data["departure_date"]
    
    async def test_update_nonexistent_participant(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test updating non-existent participant."""
        update_data = {"email": "test@example.com"}
        
        response = await authenticated_client.put(
            f"/trips/{trip_with_days.id}/participants/{uuid4()}",
            json=update_data
        )
        
        assert response.status_code == 404


class TestRemoveParticipantEndpoint:
    """Test DELETE /trips/{trip_id}/participants/{participant_id} endpoint."""
    
    async def test_remove_participant_success(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip,
        db_session: AsyncSession
    ):
        """Test successfully removing a participant."""
        # Create participant
        participant = TripParticipant(
            trip_id=trip_with_days.id,
            name="To Remove",
            coefficient=Decimal("100.00")
        )
        db_session.add(participant)
        await db_session.commit()
        await db_session.refresh(participant)
        
        # Remove participant
        response = await authenticated_client.delete(
            f"/trips/{trip_with_days.id}/participants/{participant.id}"
        )
        
        assert response.status_code == 204
        
        # Verify removed
        response = await authenticated_client.get(
            f"/trips/{trip_with_days.id}/participants"
        )
        assert response.status_code == 200
        assert response.json() == []
    
    async def test_remove_nonexistent_participant(
        self,
        authenticated_client: AsyncClient,
        trip_with_days: Trip
    ):
        """Test removing non-existent participant."""
        response = await authenticated_client.delete(
            f"/trips/{trip_with_days.id}/participants/{uuid4()}"
        )
        
        assert response.status_code == 404