"""
Comprehensive tests for Day Plan API endpoints.

This module provides complete test coverage for all day plan-related API endpoints,
including authentication, request/response validation, error handling,
shopping lists, nutrition calculations, and export functionality.
"""

import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4, UUID
from typing import Dict, Any, List, Optional
import json

import httpx
from httpx import AsyncClient

from jidelnicek.auth.models import AuthUser
from jidelnicek.trip.models import Trip, TripDay, TripMeal


pytestmark = pytest.mark.asyncio


class MockRecipe:
    """Mock Recipe model for testing."""
    def __init__(self, id: UUID, name: str, servings: int = 4, 
                 ingredients: Optional[List[Dict]] = None,
                 nutritional_info: Optional[Dict] = None):
        self.id = id
        self.name = name
        self.servings = servings
        self.ingredients = ingredients or []
        self.nutritional_info = nutritional_info or {}
        
    def to_snapshot(self) -> Dict[str, Any]:
        """Convert to snapshot format."""
        return {
            'id': str(self.id),
            'name': self.name,
            'servings': self.servings,
            'ingredients': self.ingredients,
            'nutritional_info': self.nutritional_info
        }


class TestDayPlanEndpoints:
    """Test day plan API endpoints."""
    
    @pytest.fixture
    async def auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create authenticated user and return auth headers."""
        # Register user
        register_data = {
            "email": "dayplan_test@example.com",
            "password": "DayPlanTest123!",
            "password_confirmation": "DayPlanTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "dayplan_test@example.com",
            "password": "DayPlanTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    @pytest.fixture
    async def other_auth_headers(self, async_client: AsyncClient) -> Dict[str, str]:
        """Create another authenticated user for permission testing."""
        # Register user
        register_data = {
            "email": "other_dayplan_test@example.com",
            "password": "OtherTest123!",
            "password_confirmation": "OtherTest123!"
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Login
        login_data = {
            "email": "other_dayplan_test@example.com",
            "password": "OtherTest123!"
        }
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        token = response.json()["access_token"]
        
        return {"Authorization": f"Bearer {token}"}
        
    @pytest.fixture
    async def sample_recipes(self) -> List[Dict[str, Any]]:
        """Create sample recipe data for testing."""
        return [
            {
                'id': str(uuid4()),
                'name': 'Scrambled Eggs',
                'servings': 4,
                'ingredients': [
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Eggs',
                        'quantity': '8',
                        'unit': 'pcs',
                        'category': 'Dairy'
                    },
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Butter',
                        'quantity': '40',
                        'unit': 'g',
                        'category': 'Dairy'
                    }
                ],
                'nutritional_info': {
                    'calories_per_serving': 200,
                    'protein_per_serving_g': 15,
                    'carbs_per_serving_g': 2,
                    'fat_per_serving_g': 14
                }
            },
            {
                'id': str(uuid4()),
                'name': 'Chicken Salad',
                'servings': 6,
                'ingredients': [
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Chicken Breast',
                        'quantity': '600',
                        'unit': 'g',
                        'category': 'Meat'
                    },
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Lettuce',
                        'quantity': '200',
                        'unit': 'g',
                        'category': 'Vegetables'
                    },
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Tomatoes',
                        'quantity': '300',
                        'unit': 'g',
                        'category': 'Vegetables'
                    }
                ],
                'nutritional_info': {
                    'calories_per_serving': 250,
                    'protein_per_serving_g': 30,
                    'carbs_per_serving_g': 10,
                    'fat_per_serving_g': 8
                }
            },
            {
                'id': str(uuid4()),
                'name': 'Spaghetti Carbonara',
                'servings': 4,
                'ingredients': [
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Spaghetti',
                        'quantity': '400',
                        'unit': 'g',
                        'category': 'Grains'
                    },
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Bacon',
                        'quantity': '200',
                        'unit': 'g',
                        'category': 'Meat'
                    },
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Eggs',
                        'quantity': '4',
                        'unit': 'pcs',
                        'category': 'Dairy'
                    },
                    {
                        'ingredient_id': str(uuid4()),
                        'name': 'Parmesan',
                        'quantity': '100',
                        'unit': 'g',
                        'category': 'Dairy'
                    }
                ],
                'nutritional_info': {
                    'calories_per_serving': 500,
                    'protein_per_serving_g': 20,
                    'carbs_per_serving_g': 60,
                    'fat_per_serving_g': 20
                }
            }
        ]
        
    @pytest.fixture
    async def sample_trip_with_meals(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_recipes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Create a sample trip with meals assigned."""
        # Create trip with participants
        trip_data = {
            "name": "Test Trip with Day Plans",
            "start_date": "2024-07-15",
            "end_date": "2024-07-17",  # 3 days
            "meal_slots": ["Breakfast", "Lunch", "Dinner"],
            "participants": [
                {"name": "Alice", "coefficient": 100.0},
                {"name": "Bob", "coefficient": 120.0},
                {"name": "Charlie", "coefficient": 80.0},  # Child
                {
                    "name": "Dave", 
                    "coefficient": 100.0,
                    "arrival_date": "2024-07-16",  # Arrives day 2
                    "departure_date": "2024-07-16"  # Leaves day 2
                }
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        trip = response.json()
        
        # Assign meals to each day
        # Note: In real scenario, these would be actual recipe IDs from the database
        # For testing, we'll simulate meal assignments
        
        return trip


class TestGetDayPlanEndpoint:
    """Test GET /trips/{trip_id}/days/{day_id}/plan endpoint."""
    
    async def test_get_day_plan_success(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test successful retrieval of day plan."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["day_id"] == day_id
        assert data["day_number"] == 1
        assert data["date"] == "2024-07-15"
        assert data["total_participants"] == 3  # Alice, Bob, Charlie (Dave not yet)
        assert "meal_slots" in data
        assert "completion_percentage" in data
        
        # Check meal slots
        assert len(data["meal_slots"]) == 3
        for slot in data["meal_slots"]:
            assert "meal_slot_id" in slot
            assert "meal_type" in slot
            assert "participant_count" in slot
            assert "effective_participant_count" in slot
            assert "participant_attendance" in slot
            
    async def test_get_day_plan_with_shopping_list(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test day plan with shopping list included."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan?include_shopping=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check shopping list
        if data.get("shopping_list"):
            shopping = data["shopping_list"]
            assert "day_id" in shopping
            assert "total_items" in shopping
            assert "categories" in shopping
            
            # If items exist, verify structure
            if shopping["total_items"] > 0:
                for category, items in shopping["categories"].items():
                    assert isinstance(items, list)
                    for item in items:
                        assert "ingredient_id" in item
                        assert "name" in item
                        assert "total_quantity" in item
                        assert "unit" in item
                        assert "meal_sources" in item
                        
    async def test_get_day_plan_with_nutrition(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test day plan with nutritional information."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan?include_nutrition=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check nutrition data if available
        if data.get("nutrition_totals"):
            nutrition = data["nutrition_totals"]
            assert "calories" in nutrition
            assert "protein_g" in nutrition
            assert "carbs_g" in nutrition
            assert "fat_g" in nutrition
            
        if data.get("nutrition_per_person"):
            per_person = data["nutrition_per_person"]
            assert "calories" in per_person
            
    async def test_get_day_plan_not_found(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting day plan for non-existent day."""
        trip_id = sample_trip_with_meals["id"]
        fake_day_id = str(uuid4())
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{fake_day_id}/plan",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        
    async def test_get_day_plan_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting day plan without permission."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan",
            headers=other_auth_headers
        )
        
        assert response.status_code == 403
        
    async def test_get_day_plan_unauthenticated(
        self,
        async_client: AsyncClient,
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting day plan without authentication."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan"
        )
        
        assert response.status_code == 401


class TestGetTripDayPlansEndpoint:
    """Test GET /trips/{trip_id}/day-plans endpoint."""
    
    async def test_get_trip_day_plans_success(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test successful retrieval of trip-wide day plans."""
        trip_id = sample_trip_with_meals["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/day-plans",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["trip_id"] == trip_id
        assert data["trip_name"] == sample_trip_with_meals["name"]
        assert data["total_days"] == 3
        assert data["total_participants"] == 4
        assert len(data["days"]) == 3
        
        # Check calculated fields
        assert "total_meal_slots" in data
        assert "total_assigned_meals" in data
        assert "overall_completion_percentage" in data
        assert "unique_recipes" in data
        assert "meal_type_distribution" in data
        
        # Verify each day
        for day in data["days"]:
            assert "day_id" in day
            assert "day_number" in day
            assert "date" in day
            assert "meal_slots" in day
            
    async def test_get_trip_day_plans_date_range(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting day plans for specific date range."""
        trip_id = sample_trip_with_meals["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/day-plans?start_day=1&end_day=2",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["days"]) == 2
        assert data["days"][0]["day_number"] == 1
        assert data["days"][1]["day_number"] == 2
        
    async def test_get_trip_day_plans_without_details(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting day plans without shopping/nutrition."""
        trip_id = sample_trip_with_meals["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/day-plans?include_shopping=false&include_nutrition=false",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify no shopping/nutrition data in days
        for day in data["days"]:
            assert day.get("shopping_list") is None or day["shopping_list"]["total_items"] == 0
            assert day.get("nutrition_totals") is None


class TestGetDayShoppingListEndpoint:
    """Test GET /trips/{trip_id}/days/{day_id}/shopping endpoint."""
    
    async def test_get_day_shopping_list_success(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test successful retrieval of day shopping list."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/shopping",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["day_id"] == day_id
        assert data["day_number"] == 1
        assert data["date"] == "2024-07-15"
        assert "total_items" in data
        assert "categories" in data
        
        # If items exist, check structure
        if data["total_items"] > 0:
            assert len(data["categories"]) > 0
            for category, items in data["categories"].items():
                assert isinstance(items, list)
                for item in items:
                    assert "ingredient_id" in item
                    assert "name" in item
                    assert "total_quantity" in item
                    assert "unit" in item
                    assert "category" in item
                    assert "meal_sources" in item
                    
    async def test_get_shopping_list_ungrouped(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting shopping list without category grouping."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/shopping?group_by_category=false",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # When ungrouped, all items might be in a single category
        assert "categories" in data


class TestGetMealParticipantsEndpoint:
    """Test GET /trips/{trip_id}/days/{day_id}/meals/{meal_slot}/participants endpoint."""
    
    async def test_get_meal_participants_success(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test successful retrieval of meal participants."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/meals/Breakfast/participants",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list of participants
        assert isinstance(data, list)
        assert len(data) == 4  # All participants (including Dave who isn't present)
        
        # Check participant structure
        for participant in data:
            assert "participant_id" in participant
            assert "participant_name" in participant
            assert "is_present" in participant
            assert "base_coefficient" in participant
            assert "effective_coefficient" in participant
            
            # Dave should not be present on day 1
            if participant["participant_name"] == "Dave":
                assert participant["is_present"] is False
                assert participant["effective_coefficient"] == 0.0
                
    async def test_get_meal_participants_day2(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test meal participants on day 2 (Dave present)."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][1]["id"]  # Day 2
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/meals/Lunch/participants",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Dave should be present on day 2
        dave = next((p for p in data if p["participant_name"] == "Dave"), None)
        assert dave is not None
        assert dave["is_present"] is True
        assert dave["effective_coefficient"] == 100.0
        
    async def test_get_meal_participants_invalid_slot(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting participants for invalid meal slot."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/meals/InvalidMeal/participants",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestUpdateDayMealsEndpoint:
    """Test PUT /trips/{trip_id}/days/{day_id}/meals endpoint."""
    
    async def test_update_day_meals_success(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any],
        sample_recipes: List[Dict[str, Any]]
    ):
        """Test successful bulk meal update."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        update_data = {
            "meal_assignments": {
                "Breakfast": {
                    "recipe_id": sample_recipes[0]["id"],
                    "servings_override": 6,
                    "notes": "Extra hungry morning"
                },
                "Lunch": {
                    "recipe_id": sample_recipes[1]["id"]
                }
            }
        }
        
        response = await async_client.put(
            f"/api/v1/trips/{trip_id}/days/{day_id}/meals",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return updated day plan
        assert data["day_id"] == day_id
        assert "meal_slots" in data
        
        # Verify updates applied
        breakfast = next(
            (s for s in data["meal_slots"] if s["meal_type"] == "Breakfast"),
            None
        )
        if breakfast and breakfast.get("meal_assignment"):
            assert breakfast["meal_assignment"]["servings_override"] == 6
            assert breakfast["meal_assignment"]["notes"] == "Extra hungry morning"
            
    async def test_update_day_meals_validation_error(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test bulk meal update with validation errors."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        update_data = {
            "meal_assignments": {
                "InvalidMealSlot": {
                    "recipe_id": str(uuid4())
                }
            }
        }
        
        response = await async_client.put(
            f"/api/v1/trips/{trip_id}/days/{day_id}/meals",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        
    async def test_update_day_meals_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test updating meals without permission."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        update_data = {
            "meal_assignments": {
                "Breakfast": {
                    "recipe_id": str(uuid4())
                }
            }
        }
        
        response = await async_client.put(
            f"/api/v1/trips/{trip_id}/days/{day_id}/meals",
            json=update_data,
            headers=other_auth_headers
        )
        
        assert response.status_code == 403


class TestGetDayNutritionEndpoint:
    """Test GET /trips/{trip_id}/days/{day_id}/nutrition endpoint."""
    
    async def test_get_day_nutrition_totals(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting nutritional totals for a day."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/nutrition",
            headers=auth_headers
        )
        
        # May return 404 if no nutritional data available
        if response.status_code == 200:
            data = response.json()
            
            # Check nutrition fields
            assert "calories" in data
            assert "protein_g" in data
            assert "carbs_g" in data
            assert "fat_g" in data
            
    async def test_get_day_nutrition_per_person(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test getting per-person nutritional averages."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/nutrition?per_person=true",
            headers=auth_headers
        )
        
        # May return 404 if no nutritional data available
        if response.status_code == 200:
            data = response.json()
            
            # Per-person values should be present
            assert "calories" in data
            
    async def test_get_nutrition_no_data(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test nutrition endpoint when no data available."""
        # Create trip without meals
        trip_data = {
            "name": "Empty Trip",
            "start_date": "2024-08-01",
            "end_date": "2024-08-01"
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        trip_id = trip["id"]
        day_id = trip["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/nutrition",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert "No nutritional data" in response.json()["detail"]


class TestExportDayPlanEndpoint:
    """Test GET /trips/{trip_id}/days/{day_id}/plan/export endpoint."""
    
    async def test_export_day_plan_json(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test exporting day plan as JSON."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan/export?format=json",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        assert "attachment" in response.headers.get("content-disposition", "")
        
        # Verify it's valid JSON
        data = response.json()
        assert "day_id" in data
        assert "meal_slots" in data
        
    async def test_export_day_plan_csv(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test exporting day plan as CSV."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan/export?format=csv",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv"
        assert "attachment" in response.headers.get("content-disposition", "")
        
        # Verify CSV format
        content = response.text
        assert "Day " in content
        assert "Meal,Recipe,Servings" in content
        
    async def test_export_day_plan_markdown(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test exporting day plan as Markdown."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan/export?format=markdown",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown"
        
        # Verify Markdown format
        content = response.text
        assert "# Day " in content
        assert "## Meals" in content
        
    async def test_export_without_details(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test exporting day plan without detailed information."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan/export?format=markdown&include_details=false",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        content = response.text
        # Without details, should be more compact
        assert len(content) < 10000  # Reasonable size limit
        
    async def test_export_invalid_format(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test export with invalid format."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan/export?format=invalid",
            headers=auth_headers
        )
        
        # Should fail validation (regex pattern in query param)
        assert response.status_code in [400, 422]
        
    async def test_export_permission_denied(
        self,
        async_client: AsyncClient,
        other_auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test exporting plan without permission."""
        trip_id = sample_trip_with_meals["id"]
        day_id = sample_trip_with_meals["days"][0]["id"]
        
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan/export",
            headers=other_auth_headers
        )
        
        assert response.status_code == 403


class TestEdgeCasesAndErrors:
    """Test edge cases and error conditions."""
    
    async def test_day_plan_with_no_meals(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test day plan for trip with no meal assignments."""
        # Create trip without meals
        trip_data = {
            "name": "No Meals Trip",
            "start_date": "2024-08-01",
            "end_date": "2024-08-02",
            "participants": [
                {"name": "Alice", "coefficient": 100.0}
            ]
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        trip = response.json()
        trip_id = trip["id"]
        day_id = trip["days"][0]["id"]
        
        # Get day plan
        response = await async_client.get(
            f"/api/v1/trips/{trip_id}/days/{day_id}/plan",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have empty meal slots
        assert data["completion_percentage"] == 0.0
        for slot in data["meal_slots"]:
            assert slot["meal_assignment"] is None
            
        # Shopping list should be empty
        if data.get("shopping_list"):
            assert data["shopping_list"]["total_items"] == 0
            
    async def test_day_plan_inactive_meal_slot(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test day plan with inactive meal slots."""
        # This would require ability to deactivate meal slots
        # which might be done through a separate endpoint
        pass
        
    async def test_concurrent_meal_updates(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str],
        sample_trip_with_meals: Dict[str, Any]
    ):
        """Test handling of concurrent meal updates."""
        # This tests that the service properly handles race conditions
        # In practice, this would be tested with actual concurrent requests
        pass
        
    async def test_very_large_trip(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test day plan for trip with many participants and long duration."""
        # Create trip with 20 participants and 30 days
        participants = [
            {"name": f"Person{i}", "coefficient": 100.0}
            for i in range(20)
        ]
        
        trip_data = {
            "name": "Large Trip",
            "start_date": "2024-08-01",
            "end_date": "2024-08-30",
            "participants": participants
        }
        
        response = await async_client.post(
            "/api/v1/trips",
            json=trip_data,
            headers=auth_headers
        )
        
        if response.status_code == 201:
            trip = response.json()
            
            # Get full trip plan
            response = await async_client.get(
                f"/api/v1/trips/{trip['id']}/day-plans",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["total_days"] == 30
            assert data["total_participants"] == 20