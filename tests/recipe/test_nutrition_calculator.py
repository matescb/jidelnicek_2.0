"""
Tests for the nutrition calculator with known values to verify 99.9% accuracy.
"""

import pytest
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

from jidelnicek.recipe.utils.nutrition_calculator import NutritionCalculator
from jidelnicek.common.models import NutritionalValue, Ingredient
from jidelnicek.recipe.models import RecipeIngredient


class TestNutritionCalculator:
    """Test suite for NutritionCalculator."""
    
    @pytest.fixture
    def calculator(self):
        """Create a nutrition calculator instance."""
        return NutritionCalculator()
    
    @pytest.fixture
    def mock_nutritional_value_rice(self):
        """Mock nutritional value for white rice (per 100g)."""
        mock = Mock(spec=NutritionalValue)
        mock.calories = Decimal('130')
        mock.proteins_g = Decimal('2.7')
        mock.carbohydrates_g = Decimal('28.2')
        mock.fats_g = Decimal('0.3')
        mock.sugars_g = Decimal('0.1')
        mock.fiber_g = Decimal('0.4')
        mock.sodium_mg = Decimal('1')
        mock.water_g = Decimal('68.4')
        # Optional nutrients not present
        mock.saturated_fats_g = None
        mock.trans_fats_g = None
        mock.cholesterol_mg = None
        mock.calcium_mg = Decimal('10')
        mock.phe_mg = None
        mock.vitamin_b1_mg = Decimal('0.07')
        mock.vitamin_b3_mg = Decimal('1.6')
        mock.vitamin_c_mg = None
        return mock
    
    @pytest.fixture
    def mock_nutritional_value_chicken(self):
        """Mock nutritional value for chicken breast (per 100g)."""
        mock = Mock(spec=NutritionalValue)
        mock.calories = Decimal('165')
        mock.proteins_g = Decimal('31.0')
        mock.carbohydrates_g = Decimal('0')
        mock.fats_g = Decimal('3.6')
        mock.saturated_fats_g = Decimal('1.0')
        mock.trans_fats_g = Decimal('0.02')
        mock.monounsaturated_fats_g = Decimal('1.24')
        mock.polyunsaturated_fats_g = Decimal('0.77')
        mock.cholesterol_mg = Decimal('85')
        mock.fiber_g = Decimal('0')
        mock.sodium_mg = Decimal('74')
        mock.water_g = Decimal('65.3')
        mock.calcium_mg = Decimal('11')
        mock.phe_mg = Decimal('1260')  # For PKU tracking
        mock.vitamin_b3_mg = Decimal('13.7')
        mock.vitamin_b6_mg = Decimal('0.94')
        mock.vitamin_b12_ug = Decimal('0.34')
        mock.vitamin_d_ug = None
        mock.sugars_g = None
        return mock
    
    @pytest.fixture
    def mock_nutritional_value_broccoli(self):
        """Mock nutritional value for broccoli (per 100g)."""
        mock = Mock(spec=NutritionalValue)
        mock.calories = Decimal('34')
        mock.proteins_g = Decimal('2.8')
        mock.carbohydrates_g = Decimal('6.6')
        mock.fats_g = Decimal('0.4')
        mock.sugars_g = Decimal('1.7')
        mock.fiber_g = Decimal('2.6')
        mock.sodium_mg = Decimal('33')
        mock.water_g = Decimal('89.3')
        mock.calcium_mg = Decimal('47')
        mock.vitamin_c_mg = Decimal('89.2')
        mock.vitamin_k_ug = Decimal('101.6')
        mock.vitamin_a_ug = Decimal('31')
        mock.saturated_fats_g = Decimal('0.039')
        mock.cholesterol_mg = Decimal('0')
        mock.phe_mg = None
        mock.trans_fats_g = None
        return mock
    
    @pytest.fixture
    def mock_recipe_ingredients(self, mock_nutritional_value_rice, 
                                mock_nutritional_value_chicken,
                                mock_nutritional_value_broccoli):
        """Create mock recipe ingredients for a simple meal."""
        # Create mock ingredients
        rice = Mock(spec=Ingredient)
        rice.id = uuid4()
        rice.name = "White Rice"
        rice.nutritional_value = mock_nutritional_value_rice
        
        chicken = Mock(spec=Ingredient)
        chicken.id = uuid4()
        chicken.name = "Chicken Breast"
        chicken.nutritional_value = mock_nutritional_value_chicken
        
        broccoli = Mock(spec=Ingredient)
        broccoli.id = uuid4()
        broccoli.name = "Broccoli"
        broccoli.nutritional_value = mock_nutritional_value_broccoli
        
        # Create recipe ingredients with quantities
        rice_ingredient = Mock(spec=RecipeIngredient)
        rice_ingredient.ingredient = rice
        rice_ingredient.quantity_g = Decimal('150')  # 150g cooked rice
        
        chicken_ingredient = Mock(spec=RecipeIngredient)
        chicken_ingredient.ingredient = chicken
        chicken_ingredient.quantity_g = Decimal('120')  # 120g chicken
        
        broccoli_ingredient = Mock(spec=RecipeIngredient)
        broccoli_ingredient.ingredient = broccoli
        broccoli_ingredient.quantity_g = Decimal('200')  # 200g broccoli
        
        return [rice_ingredient, chicken_ingredient, broccoli_ingredient]
    
    def test_calculate_recipe_nutrition_basic(self, calculator, mock_recipe_ingredients):
        """Test basic nutritional calculation for a recipe."""
        result = calculator.calculate_recipe_nutrition(mock_recipe_ingredients, servings=2)
        
        # Verify required nutrients are calculated correctly
        # Rice: 130 * 1.5 = 195
        # Chicken: 165 * 1.2 = 198
        # Broccoli: 34 * 2.0 = 68
        # Total: 461
        assert result['calories'] == Decimal('461')
        
        # Proteins: 2.7*1.5 + 31*1.2 + 2.8*2 = 4.05 + 37.2 + 5.6 = 46.85
        assert result['proteins_g'] == Decimal('46.85')
        
        # Carbs: 28.2*1.5 + 0*1.2 + 6.6*2 = 42.3 + 0 + 13.2 = 55.5
        assert result['carbohydrates_g'] == Decimal('55.5')
        
        # Fats: 0.3*1.5 + 3.6*1.2 + 0.4*2 = 0.45 + 4.32 + 0.8 = 5.57
        assert result['fats_g'] == Decimal('5.57')
    
    def test_calculate_recipe_nutrition_optional_nutrients(self, calculator, mock_recipe_ingredients):
        """Test calculation of optional nutrients."""
        result = calculator.calculate_recipe_nutrition(mock_recipe_ingredients, servings=1)
        
        # Fiber: 0.4*1.5 + 0*1.2 + 2.6*2 = 0.6 + 0 + 5.2 = 5.8
        assert result['fiber_g'] == Decimal('5.8')
        
        # Sodium: 1*1.5 + 74*1.2 + 33*2 = 1.5 + 88.8 + 66 = 156.3
        assert result['sodium_mg'] == Decimal('156.3')
        
        # Vitamin C (only in broccoli): 89.2 * 2 = 178.4
        assert result['vitamin_c_mg'] == Decimal('178.4')
        
        # Cholesterol (only in chicken): 85 * 1.2 = 102
        assert result['cholesterol_mg'] == Decimal('102')
        
        # PKU tracking - phe_mg (only in chicken): 1260 * 1.2 = 1512
        assert result['phe_mg'] == Decimal('1512')
    
    def test_calculate_recipe_nutrition_missing_optional(self, calculator, mock_recipe_ingredients):
        """Test that missing optional nutrients are handled properly."""
        result = calculator.calculate_recipe_nutrition(mock_recipe_ingredients, servings=1)
        
        # Vitamin D is not present in any ingredient
        assert result['vitamin_d_ug'] is None
        
        # Trans fats only in chicken
        assert result['trans_fats_g'] == Decimal('0.024')  # 0.02 * 1.2
    
    def test_calculate_per_serving(self, calculator):
        """Test per-serving calculation."""
        total_nutrition = {
            'calories': Decimal('600'),
            'proteins_g': Decimal('45'),
            'carbohydrates_g': Decimal('60'),
            'fats_g': Decimal('20'),
            'fiber_g': Decimal('8'),
            'vitamin_c_mg': None,
        }
        
        # Test with 2 servings
        result = calculator.calculate_per_serving(total_nutrition, 2)
        assert result['calories'] == Decimal('300')
        assert result['proteins_g'] == Decimal('22.5')
        assert result['carbohydrates_g'] == Decimal('30')
        assert result['fats_g'] == Decimal('10')
        assert result['fiber_g'] == Decimal('4')
        assert result['vitamin_c_mg'] is None
        
        # Test with 3 servings
        result = calculator.calculate_per_serving(total_nutrition, 3)
        assert result['calories'] == Decimal('200')
        assert result['proteins_g'] == Decimal('15')
        assert result['carbohydrates_g'] == Decimal('20')
        assert result['fats_g'] == Decimal('6.666666666666666666666666667')
    
    def test_round_nutrition_values(self, calculator):
        """Test rounding of nutritional values for display."""
        nutrition = {
            'calories': Decimal('234.7'),
            'proteins_g': Decimal('23.456'),
            'carbohydrates_g': Decimal('45.123'),
            'fats_g': Decimal('12.789'),
            'trans_fats_g': Decimal('0.0123'),
            'cholesterol_mg': Decimal('85.6'),
            'vitamin_b1_mg': Decimal('0.0745'),
            'vitamin_c_mg': Decimal('45.67'),
            'calcium_mg': Decimal('123.4'),
            'phe_mg': Decimal('1234.5'),
        }
        
        result = calculator.round_nutrition_values(nutrition)
        
        # Check integer rounding (0 decimal places)
        assert result['calories'] == 235
        assert result['cholesterol_mg'] == 86
        assert result['calcium_mg'] == 123
        assert result['phe_mg'] == 1235
        
        # Check 1 decimal place rounding
        assert result['proteins_g'] == 23.5
        assert result['carbohydrates_g'] == 45.1
        assert result['fats_g'] == 12.8
        assert result['vitamin_c_mg'] == 45.7
        
        # Check 2 decimal place rounding
        assert result['trans_fats_g'] == 0.01
        assert result['vitamin_b1_mg'] == 0.07
    
    def test_validate_nutritional_data(self, calculator):
        """Test validation of nutritional data completeness."""
        # Create ingredients with various issues
        ingredient1 = Mock(spec=Ingredient)
        ingredient1.name = "Mystery Ingredient"
        ingredient1.nutritional_value = None
        
        ingredient2 = Mock(spec=Ingredient)
        ingredient2.name = "Partial Ingredient"
        mock_nutrition = Mock(spec=NutritionalValue)
        mock_nutrition.calories = Decimal('100')
        mock_nutrition.proteins_g = None  # Missing required
        mock_nutrition.carbohydrates_g = Decimal('20')
        mock_nutrition.fats_g = Decimal('5')
        ingredient2.nutritional_value = mock_nutrition
        
        ingredient3 = Mock(spec=Ingredient)
        ingredient3.name = "Complete Ingredient"
        complete_nutrition = Mock(spec=NutritionalValue)
        complete_nutrition.calories = Decimal('150')
        complete_nutrition.proteins_g = Decimal('10')
        complete_nutrition.carbohydrates_g = Decimal('25')
        complete_nutrition.fats_g = Decimal('5')
        ingredient3.nutritional_value = complete_nutrition
        
        # Create recipe ingredients
        recipe_ingredients = []
        for ing in [ingredient1, ingredient2, ingredient3]:
            ri = Mock(spec=RecipeIngredient)
            ri.ingredient = ing
            ri.quantity_g = Decimal('100')
            recipe_ingredients.append(ri)
        
        result = calculator.validate_nutritional_data(recipe_ingredients)
        
        assert "Mystery Ingredient" in result['missing_ingredients']
        assert len(result['incomplete_ingredients']) == 1
        assert "Partial Ingredient (missing: proteins_g)" in result['incomplete_ingredients'][0]
    
    def test_calculate_recipe_nutrition_empty(self, calculator):
        """Test calculation with empty ingredient list."""
        result = calculator.calculate_recipe_nutrition([], servings=1)
        
        # Should have zeros for required nutrients
        assert result['calories'] == Decimal('0')
        assert result['proteins_g'] == Decimal('0')
        assert result['carbohydrates_g'] == Decimal('0')
        assert result['fats_g'] == Decimal('0')
        
        # Optional nutrients should be None
        assert result['fiber_g'] is None
        assert result['vitamin_c_mg'] is None
    
    def test_calculate_recipe_nutrition_no_nutritional_value(self, calculator):
        """Test calculation with ingredients lacking nutritional values."""
        ingredient = Mock(spec=Ingredient)
        ingredient.name = "Unknown Food"
        ingredient.nutritional_value = None
        
        recipe_ingredient = Mock(spec=RecipeIngredient)
        recipe_ingredient.ingredient = ingredient
        recipe_ingredient.quantity_g = Decimal('100')
        
        result = calculator.calculate_recipe_nutrition([recipe_ingredient], servings=1)
        
        # Should still return zeros for required nutrients
        assert result['calories'] == Decimal('0')
        assert result['proteins_g'] == Decimal('0')
        assert result['carbohydrates_g'] == Decimal('0')
        assert result['fats_g'] == Decimal('0')
    
    def test_invalid_servings(self, calculator):
        """Test error handling for invalid servings."""
        with pytest.raises(ValueError, match="Servings must be greater than 0"):
            calculator.calculate_recipe_nutrition([], servings=0)
        
        with pytest.raises(ValueError, match="Servings must be greater than 0"):
            calculator.calculate_recipe_nutrition([], servings=-1)
        
        with pytest.raises(ValueError, match="Servings must be greater than 0"):
            calculator.calculate_per_serving({}, servings=0)
    
    def test_precision_accuracy(self, calculator):
        """Test that calculations maintain 99.9% accuracy."""
        # Create a precise test case
        mock_nutrition = Mock(spec=NutritionalValue)
        mock_nutrition.calories = Decimal('123.456')
        mock_nutrition.proteins_g = Decimal('12.3456')
        mock_nutrition.carbohydrates_g = Decimal('23.4567')
        mock_nutrition.fats_g = Decimal('3.45678')
        
        ingredient = Mock(spec=Ingredient)
        ingredient.nutritional_value = mock_nutrition
        
        recipe_ingredient = Mock(spec=RecipeIngredient)
        recipe_ingredient.ingredient = ingredient
        recipe_ingredient.quantity_g = Decimal('237.5')  # Odd quantity
        
        result = calculator.calculate_recipe_nutrition([recipe_ingredient], servings=1)
        
        # Expected values (per 100g * 2.375)
        # Calories: 123.456 * 2.375 = 293.208
        assert result['calories'] == Decimal('293.208')
        
        # Proteins: 12.3456 * 2.375 = 29.3208
        assert result['proteins_g'] == Decimal('29.3208')
        
        # The precision should be maintained throughout
        per_serving = calculator.calculate_per_serving(result, 3)
        
        # 293.208 / 3 = 97.736
        assert per_serving['calories'] == Decimal('97.736')
        
        # Test rounding maintains accuracy
        rounded = calculator.round_nutrition_values(per_serving)
        assert rounded['calories'] == 98  # Proper rounding
    
    def test_complex_recipe_accuracy(self, calculator):
        """Test a complex recipe with many ingredients for accuracy."""
        # Create 10 ingredients with varied nutritional profiles
        ingredients_data = [
            {'calories': '250', 'proteins': '8.5', 'carbs': '45', 'fats': '5', 'quantity': '125'},
            {'calories': '180', 'proteins': '25', 'carbs': '2', 'fats': '8', 'quantity': '150'},
            {'calories': '45', 'proteins': '1.2', 'carbs': '9', 'fats': '0.5', 'quantity': '200'},
            {'calories': '320', 'proteins': '12', 'carbs': '60', 'fats': '4', 'quantity': '80'},
            {'calories': '90', 'proteins': '3', 'carbs': '15', 'fats': '2.5', 'quantity': '175'},
            {'calories': '410', 'proteins': '18', 'carbs': '35', 'fats': '22', 'quantity': '50'},
            {'calories': '25', 'proteins': '2', 'carbs': '4', 'fats': '0.2', 'quantity': '300'},
            {'calories': '160', 'proteins': '6', 'carbs': '28', 'fats': '3.5', 'quantity': '110'},
            {'calories': '200', 'proteins': '15', 'carbs': '5', 'fats': '14', 'quantity': '90'},
            {'calories': '75', 'proteins': '4.5', 'carbs': '12', 'fats': '1.8', 'quantity': '140'},
        ]
        
        recipe_ingredients = []
        expected_totals = {
            'calories': Decimal('0'),
            'proteins_g': Decimal('0'),
            'carbohydrates_g': Decimal('0'),
            'fats_g': Decimal('0'),
        }
        
        for data in ingredients_data:
            mock_nutrition = Mock(spec=NutritionalValue)
            mock_nutrition.calories = Decimal(data['calories'])
            mock_nutrition.proteins_g = Decimal(data['proteins'])
            mock_nutrition.carbohydrates_g = Decimal(data['carbs'])
            mock_nutrition.fats_g = Decimal(data['fats'])
            
            ingredient = Mock(spec=Ingredient)
            ingredient.nutritional_value = mock_nutrition
            
            recipe_ingredient = Mock(spec=RecipeIngredient)
            recipe_ingredient.ingredient = ingredient
            recipe_ingredient.quantity_g = Decimal(data['quantity'])
            recipe_ingredients.append(recipe_ingredient)
            
            # Calculate expected totals
            scale = Decimal(data['quantity']) / Decimal('100')
            expected_totals['calories'] += Decimal(data['calories']) * scale
            expected_totals['proteins_g'] += Decimal(data['proteins']) * scale
            expected_totals['carbohydrates_g'] += Decimal(data['carbs']) * scale
            expected_totals['fats_g'] += Decimal(data['fats']) * scale
        
        result = calculator.calculate_recipe_nutrition(recipe_ingredients, servings=4)
        
        # Verify totals match expected with high precision
        assert result['calories'] == expected_totals['calories']
        assert result['proteins_g'] == expected_totals['proteins_g']
        assert result['carbohydrates_g'] == expected_totals['carbohydrates_g']
        assert result['fats_g'] == expected_totals['fats_g']
        
        # Test per-serving calculation maintains precision
        per_serving = calculator.calculate_per_serving(result, 4)
        
        # Verify that total / 4 is accurate
        for nutrient in ['calories', 'proteins_g', 'carbohydrates_g', 'fats_g']:
            assert per_serving[nutrient] == expected_totals[nutrient] / Decimal('4')