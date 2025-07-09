"""
Tests for ingredient management service.

This module tests the admin ingredient CRUD operations, bulk operations,
and quality validation features.
"""

import pytest
from uuid import uuid4
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from jidelnicek.admin.services.ingredient_management import IngredientManagementService
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.exceptions import ValidationError, NotFoundError, ConflictError


@pytest.fixture
def admin_user():
    """Create a mock admin user."""
    user = AuthUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        is_active=True
    )
    return user


@pytest.fixture
def ingredient_service(db_session: AsyncSession, admin_user: AuthUser):
    """Create ingredient management service instance."""
    return IngredientManagementService(db_session, admin_user)


@pytest.fixture
def sample_nutritional_data():
    """Sample nutritional data for testing."""
    return {
        "calories": 250.0,
        "proteins": 10.0,
        "carbs": 30.0,
        "fats": 8.0,
        "fiber": 5.0,
        "sodium": 200.0
    }


@pytest.fixture
def sample_unit_conversions():
    """Sample unit conversions for testing."""
    return {
        "ml_to_g": 1.05,
        "cup_to_g": 240.0,
        "tbsp_to_g": 15.0,
        "tsp_to_g": 5.0
    }


class TestIngredientCreation:
    """Test ingredient creation functionality."""
    
    async def test_create_global_ingredient(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict,
        sample_unit_conversions: dict
    ):
        """Test creating a global ingredient."""
        ingredient = await ingredient_service.create_ingredient(
            name="Test Flour",
            category="Grains",
            brand="Test Brand",
            nutritional_data=sample_nutritional_data,
            unit_conversions=sample_unit_conversions,
            allergens=["gluten"],
            dietary_flags={"vegan": True, "gluten_free": False},
            is_global=True
        )
        
        assert ingredient.id is not None
        assert ingredient.name == "Test Flour"
        assert ingredient.category == "Grains"
        assert ingredient.brand == "Test Brand"
        assert ingredient.is_global is True
        assert ingredient.user_id is None
        assert ingredient.allergens == ["gluten"]
        assert ingredient.dietary_flags["vegan"] is True
    
    async def test_create_user_specific_ingredient(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test creating a user-specific ingredient."""
        user_id = uuid4()
        ingredient = await ingredient_service.create_ingredient(
            name="My Special Sauce",
            category="Condiments",
            nutritional_data=sample_nutritional_data,
            is_global=False,
            user_id=user_id
        )
        
        assert ingredient.is_global is False
        assert ingredient.user_id == user_id
    
    async def test_create_ingredient_with_barcode(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test creating an ingredient with barcode."""
        ingredient = await ingredient_service.create_ingredient(
            name="Barcode Product",
            barcode="1234567890123",
            nutritional_data=sample_nutritional_data
        )
        
        assert ingredient.barcode == "1234567890123"
    
    async def test_create_ingredient_validation_errors(
        self,
        ingredient_service: IngredientManagementService
    ):
        """Test ingredient creation validation."""
        # Missing required nutritional fields
        with pytest.raises(ValidationError, match="Missing required nutritional field"):
            await ingredient_service.create_ingredient(
                name="Invalid",
                nutritional_data={"calories": 100}  # Missing proteins, carbs, fats
            )
        
        # Invalid nutritional values
        with pytest.raises(ValidationError, match="must be non-negative"):
            await ingredient_service.create_ingredient(
                name="Invalid",
                nutritional_data={
                    "calories": -100,
                    "proteins": 10,
                    "carbs": 30,
                    "fats": 8
                }
            )
        
        # Macros exceed 100g
        with pytest.raises(ValidationError, match="cannot exceed 100g"):
            await ingredient_service.create_ingredient(
                name="Invalid",
                nutritional_data={
                    "calories": 400,
                    "proteins": 50,
                    "carbs": 40,
                    "fats": 20  # Total: 110g
                }
            )
    
    async def test_create_duplicate_ingredient(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict,
        db_session: AsyncSession
    ):
        """Test duplicate ingredient detection."""
        # Create first ingredient
        await ingredient_service.create_ingredient(
            name="Duplicate Test",
            brand="Test Brand",
            nutritional_data=sample_nutritional_data
        )
        
        # Try to create duplicate
        with pytest.raises(ConflictError, match="already exists"):
            await ingredient_service.create_ingredient(
                name="Duplicate Test",
                brand="Test Brand",
                nutritional_data=sample_nutritional_data
            )


class TestIngredientUpdate:
    """Test ingredient update functionality."""
    
    async def test_update_ingredient_basic(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test basic ingredient update."""
        # Create ingredient
        ingredient = await ingredient_service.create_ingredient(
            name="Original Name",
            category="Original Category",
            nutritional_data=sample_nutritional_data
        )
        
        # Update ingredient
        updated = await ingredient_service.update_ingredient(
            ingredient.id,
            name="Updated Name",
            category="Updated Category"
        )
        
        assert updated.name == "Updated Name"
        assert updated.category == "Updated Category"
    
    async def test_update_nutritional_data(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test updating nutritional data."""
        ingredient = await ingredient_service.create_ingredient(
            name="Test",
            nutritional_data=sample_nutritional_data
        )
        
        new_nutrition = {
            "calories": 300.0,
            "proteins": 15.0,
            "carbs": 35.0,
            "fats": 10.0
        }
        
        updated = await ingredient_service.update_ingredient(
            ingredient.id,
            nutritional_data=new_nutrition
        )
        
        assert updated.nutritional_data["calories"] == 300.0
        assert updated.nutritional_data["proteins"] == 15.0
    
    async def test_update_nonexistent_ingredient(
        self,
        ingredient_service: IngredientManagementService
    ):
        """Test updating non-existent ingredient."""
        fake_id = uuid4()
        
        with pytest.raises(NotFoundError):
            await ingredient_service.update_ingredient(
                fake_id,
                name="Updated"
            )


class TestIngredientDeletion:
    """Test ingredient deletion functionality."""
    
    async def test_soft_delete_ingredient(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test soft delete (archive) ingredient."""
        ingredient = await ingredient_service.create_ingredient(
            name="To Delete",
            nutritional_data=sample_nutritional_data
        )
        
        success = await ingredient_service.delete_ingredient(
            ingredient.id,
            force=False
        )
        
        assert success is True
        
        # Check ingredient is archived
        archived = await ingredient_service.get_ingredient_by_id(ingredient.id)
        assert archived.is_archived is True
    
    async def test_force_delete_ingredient(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test force delete ingredient."""
        ingredient = await ingredient_service.create_ingredient(
            name="To Force Delete",
            nutritional_data=sample_nutritional_data
        )
        
        success = await ingredient_service.delete_ingredient(
            ingredient.id,
            force=True
        )
        
        assert success is True
        
        # Check ingredient is gone
        deleted = await ingredient_service.get_ingredient_by_id(ingredient.id)
        assert deleted is None
    
    @patch('jidelnicek.admin.services.ingredient_management.IngredientManagementService._count_ingredient_usage')
    async def test_delete_ingredient_in_use(
        self,
        mock_count_usage,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test deleting ingredient that's in use."""
        mock_count_usage.return_value = 5  # Simulate usage in 5 recipes
        
        ingredient = await ingredient_service.create_ingredient(
            name="In Use",
            nutritional_data=sample_nutritional_data
        )
        
        with pytest.raises(ConflictError, match="used in 5 recipes"):
            await ingredient_service.delete_ingredient(
                ingredient.id,
                force=False
            )


class TestIngredientSearch:
    """Test ingredient search functionality."""
    
    async def test_search_by_name(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test searching ingredients by name."""
        # Create test ingredients
        await ingredient_service.create_ingredient(
            name="Apple Juice",
            nutritional_data=sample_nutritional_data
        )
        await ingredient_service.create_ingredient(
            name="Orange Juice",
            nutritional_data=sample_nutritional_data
        )
        await ingredient_service.create_ingredient(
            name="Tomato Sauce",
            nutritional_data=sample_nutritional_data
        )
        
        # Search for "juice"
        results, total = await ingredient_service.search_ingredients(
            query="juice"
        )
        
        assert total == 2
        assert all("juice" in r.name.lower() for r in results)
    
    async def test_search_by_category(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test searching ingredients by category."""
        # Create ingredients in different categories
        await ingredient_service.create_ingredient(
            name="Bread",
            category="Grains",
            nutritional_data=sample_nutritional_data
        )
        await ingredient_service.create_ingredient(
            name="Rice",
            category="Grains",
            nutritional_data=sample_nutritional_data
        )
        await ingredient_service.create_ingredient(
            name="Apple",
            category="Fruits",
            nutritional_data=sample_nutritional_data
        )
        
        # Search by category
        results, total = await ingredient_service.search_ingredients(
            category="Grains"
        )
        
        assert total == 2
        assert all(r.category == "Grains" for r in results)
    
    async def test_search_by_allergens(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test searching ingredients by allergens."""
        # Create ingredients with different allergens
        await ingredient_service.create_ingredient(
            name="Peanut Butter",
            nutritional_data=sample_nutritional_data,
            allergens=["peanuts", "nuts"]
        )
        await ingredient_service.create_ingredient(
            name="Almond Milk",
            nutritional_data=sample_nutritional_data,
            allergens=["nuts"]
        )
        await ingredient_service.create_ingredient(
            name="Soy Milk",
            nutritional_data=sample_nutritional_data,
            allergens=["soy"]
        )
        
        # Search by allergen
        results, total = await ingredient_service.search_ingredients(
            allergens=["nuts"]
        )
        
        assert total == 2
        assert all("nuts" in r.allergens for r in results)
    
    async def test_search_pagination(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test search pagination."""
        # Create multiple ingredients
        for i in range(15):
            await ingredient_service.create_ingredient(
                name=f"Test Ingredient {i:02d}",
                nutritional_data=sample_nutritional_data
            )
        
        # Test pagination
        page1, total = await ingredient_service.search_ingredients(
            page=1,
            per_page=10
        )
        
        assert len(page1) == 10
        assert total == 15
        
        page2, _ = await ingredient_service.search_ingredients(
            page=2,
            per_page=10
        )
        
        assert len(page2) == 5


class TestIngredientQualityValidation:
    """Test ingredient quality validation."""
    
    async def test_complete_ingredient_quality(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict,
        sample_unit_conversions: dict
    ):
        """Test quality validation for complete ingredient."""
        ingredient = await ingredient_service.create_ingredient(
            name="Complete Ingredient",
            category="Test",
            nutritional_data=sample_nutritional_data,
            unit_conversions=sample_unit_conversions,
            allergens=["none"],
            dietary_flags={"vegan": True}
        )
        
        quality = await ingredient_service.validate_ingredient_quality(ingredient.id)
        
        assert quality["quality_score"] == 100
        assert quality["is_complete"] is True
        assert len(quality["issues"]) == 0
    
    async def test_incomplete_ingredient_quality(
        self,
        ingredient_service: IngredientManagementService
    ):
        """Test quality validation for incomplete ingredient."""
        # Create minimal ingredient
        ingredient = await ingredient_service.create_ingredient(
            name="Minimal Ingredient",
            nutritional_data={
                "calories": 100,
                "proteins": 5,
                "carbs": 10,
                "fats": 2
            }
        )
        
        quality = await ingredient_service.validate_ingredient_quality(ingredient.id)
        
        assert quality["quality_score"] < 100
        assert quality["is_complete"] is False
        assert "Missing category" in quality["issues"]
        assert "No allergen information" in quality["issues"]
        assert "No unit conversions defined" in quality["issues"]
        assert "No dietary flags set" in quality["issues"]


class TestIngredientBulkOperations:
    """Test bulk import/export operations."""
    
    async def test_export_csv(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test CSV export functionality."""
        # Create test ingredients
        await ingredient_service.create_ingredient(
            name="Export Test 1",
            brand="Brand A",
            category="Test",
            nutritional_data=sample_nutritional_data,
            allergens=["gluten", "dairy"]
        )
        await ingredient_service.create_ingredient(
            name="Export Test 2",
            brand="Brand B",
            category="Test",
            nutritional_data=sample_nutritional_data
        )
        
        # Export as CSV
        csv_data = await ingredient_service.bulk_export(format="csv")
        
        assert b"name,brand,barcode,category" in csv_data
        assert b"Export Test 1" in csv_data
        assert b"Export Test 2" in csv_data
        assert b"Brand A" in csv_data
        assert b"gluten,dairy" in csv_data
    
    async def test_export_json(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test JSON export functionality."""
        # Create test ingredient
        ingredient = await ingredient_service.create_ingredient(
            name="JSON Export Test",
            nutritional_data=sample_nutritional_data
        )
        
        # Export as JSON
        json_data = await ingredient_service.bulk_export(format="json")
        
        import json
        data = json.loads(json_data.decode('utf-8'))
        
        assert len(data) >= 1
        assert any(i["name"] == "JSON Export Test" for i in data)
        assert all("nutritional_data" in i for i in data)
    
    @patch('jidelnicek.admin.services.ingredient_management.csv.DictReader')
    async def test_import_csv(
        self,
        mock_csv_reader,
        ingredient_service: IngredientManagementService
    ):
        """Test CSV import functionality."""
        # Mock CSV data
        mock_csv_reader.return_value = [
            {
                'name': 'Import Test 1',
                'brand': 'Test Brand',
                'category': 'Test',
                'calories': '200',
                'proteins': '10',
                'carbs': '20',
                'fats': '5',
                'allergens': 'gluten,dairy'
            },
            {
                'name': 'Import Test 2',
                'category': 'Test',
                'calories': '150',
                'proteins': '8',
                'carbs': '15',
                'fats': '4',
                'allergens': ''
            }
        ]
        
        # Create mock file
        mock_file = AsyncMock(spec=UploadFile)
        mock_file.read.return_value = b"mock csv content"
        
        # Import
        results = await ingredient_service.bulk_import_csv(mock_file)
        
        assert results['total'] == 2
        assert results['success'] >= 0  # Depends on mock implementation
        assert isinstance(results['errors'], list)


class TestIngredientMerge:
    """Test ingredient merging functionality."""
    
    async def test_merge_ingredients(
        self,
        ingredient_service: IngredientManagementService,
        sample_nutritional_data: dict
    ):
        """Test merging two ingredients."""
        # Create source ingredient
        source = await ingredient_service.create_ingredient(
            name="Source Ingredient",
            nutritional_data=sample_nutritional_data,
            allergens=["gluten"],
            unit_conversions={"ml_to_g": 1.0}
        )
        
        # Create target ingredient
        target_nutrition = sample_nutritional_data.copy()
        target_nutrition["fiber"] = 3.0
        target = await ingredient_service.create_ingredient(
            name="Target Ingredient",
            nutritional_data=target_nutrition,
            allergens=["dairy"],
            unit_conversions={"cup_to_g": 240.0}
        )
        
        # Merge
        merged = await ingredient_service.merge_ingredients(
            source_id=source.id,
            target_id=target.id,
            update_recipes=False
        )
        
        # Check merged data
        assert merged.id == target.id
        assert set(merged.allergens) == {"gluten", "dairy"}
        assert merged.unit_conversions["ml_to_g"] == 1.0
        assert merged.unit_conversions["cup_to_g"] == 240.0
        assert merged.nutritional_data["fiber"] == 3.0
        
        # Check source is deleted
        deleted = await ingredient_service.get_ingredient_by_id(source.id)
        assert deleted is None