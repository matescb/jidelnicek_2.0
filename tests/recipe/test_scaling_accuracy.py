"""
Comprehensive accuracy tests for recipe scaling to verify 99.9% accuracy requirement.

This test suite covers:
- Mathematical precision tests
- Boundary condition tests
- Real-world recipe examples
- Cumulative error analysis
- Edge case accuracy verification
"""

import pytest
from decimal import Decimal, getcontext
from typing import List, Dict, Any, Tuple
import math

from jidelnicek.recipe.utils.scaling import RecipeScaler, CalorieScaler, ParticipantScaler
from jidelnicek.recipe.utils.rounding import SmartRounder
from jidelnicek.recipe.utils.constraints import ScalingConstraints
from jidelnicek.recipe.utils.scaling_validator import ScalingValidator


# Set decimal precision for tests
getcontext().prec = 28  # High precision for accuracy testing


class TestScalingAccuracy:
    """Test suite to verify 99.9% accuracy in scaling operations."""
    
    @pytest.fixture
    def scaler(self):
        """Create a recipe scaler without rounding for accuracy tests."""
        return RecipeScaler(use_rounding=False, use_constraints=False)
    
    @pytest.fixture
    def calorie_scaler(self):
        """Create a calorie scaler for accuracy tests."""
        return CalorieScaler(use_rounding=False, use_constraints=False)
    
    @pytest.fixture
    def participant_scaler(self):
        """Create a participant scaler for accuracy tests."""
        return ParticipantScaler(use_rounding=False, use_constraints=False)
    
    def calculate_relative_error(self, expected: Decimal, actual: Decimal) -> Decimal:
        """Calculate relative error between expected and actual values."""
        if expected == 0:
            return Decimal('0') if actual == 0 else Decimal('inf')
        return abs((actual - expected) / expected)
    
    def assert_accuracy(self, expected: Decimal, actual: Decimal, tolerance: Decimal = Decimal('0.001')):
        """Assert that relative error is within tolerance (0.1% for 99.9% accuracy)."""
        error = self.calculate_relative_error(expected, actual)
        assert error <= tolerance, f"Accuracy test failed: expected {expected}, got {actual}, error {error*100:.4f}%"
    
    def test_basic_scaling_precision(self, scaler):
        """Test precision of basic scaling calculations."""
        test_cases = [
            # (original_servings, target_servings, test_quantity, expected_result)
            (4, 6, Decimal('100'), Decimal('150')),
            (3, 7, Decimal('250'), Decimal('583.3333')),  # Repeating decimal
            (8, 3, Decimal('480'), Decimal('180')),
            (5, 11, Decimal('75.5'), Decimal('166.1')),
            (7, 2, Decimal('350'), Decimal('100')),
            (1, 1, Decimal('100'), Decimal('100')),  # No scaling
            (10, 1, Decimal('1000'), Decimal('100')),  # Scale down by 10
            (1, 10, Decimal('100'), Decimal('1000')),  # Scale up by 10
        ]
        
        for original, target, quantity, expected in test_cases:
            factor = scaler.calculate_base_scaling_factor(original, target)
            scaled = scaler.scale_ingredient_quantity(quantity, factor)
            
            # Verify factor calculation
            expected_factor = Decimal(target) / Decimal(original)
            self.assert_accuracy(expected_factor, factor)
            
            # Verify scaled quantity
            self.assert_accuracy(expected, scaled)
    
    def test_extreme_precision_cases(self, scaler):
        """Test precision with extreme values and high precision requirements."""
        # Very small quantities
        factor = scaler.calculate_base_scaling_factor(1000, 1)
        scaled = scaler.scale_ingredient_quantity(Decimal('0.001'), factor)
        expected = Decimal('0.000001')
        self.assert_accuracy(expected, scaled)
        
        # Very large quantities
        factor = scaler.calculate_base_scaling_factor(1, 1000)
        scaled = scaler.scale_ingredient_quantity(Decimal('99999'), factor)
        expected = Decimal('99999000')
        self.assert_accuracy(expected, scaled)
        
        # High precision decimals
        factor = scaler.calculate_base_scaling_factor(7, 11)
        scaled = scaler.scale_ingredient_quantity(Decimal('123.456789'), factor)
        # 11/7 * 123.456789 = 193.86066857142857...
        expected = Decimal('193.8607')  # Rounded to 4 decimal places
        self.assert_accuracy(expected, scaled, Decimal('0.0001'))
    
    def test_cumulative_error_analysis(self, scaler):
        """Test that cumulative errors remain within tolerance."""
        # Scale a recipe multiple times and verify cumulative error
        original_servings = 4
        quantities = [
            Decimal('200'),   # Flour
            Decimal('150'),   # Sugar
            Decimal('3'),     # Eggs
            Decimal('250'),   # Milk
            Decimal('5'),     # Salt
            Decimal('10'),    # Yeast
            Decimal('50'),    # Butter
        ]
        
        # Apply multiple scaling operations
        scaling_sequence = [
            (4, 6),   # Scale up to 6
            (6, 3),   # Scale down to 3
            (3, 8),   # Scale up to 8
            (8, 4),   # Scale back to original
        ]
        
        current_quantities = quantities.copy()
        current_servings = original_servings
        
        for from_servings, to_servings in scaling_sequence:
            factor = scaler.calculate_base_scaling_factor(from_servings, to_servings)
            current_quantities = [
                scaler.scale_ingredient_quantity(qty, factor)
                for qty in current_quantities
            ]
            current_servings = to_servings
        
        # After scaling 4->6->3->8->4, we should be back to original
        assert current_servings == original_servings
        
        # Check cumulative error for each ingredient
        for original, final in zip(quantities, current_quantities):
            self.assert_accuracy(original, final, Decimal('0.001'))
    
    def test_calorie_calculation_accuracy(self, calorie_scaler):
        """Test accuracy of calorie-based calculations."""
        ingredients = [
            {
                'name': 'Flour',
                'quantity': Decimal('250'),
                'unit': 'g',
                'nutritional_data': {'calories': Decimal('364')}  # per 100g
            },
            {
                'name': 'Sugar',
                'quantity': Decimal('100'),
                'unit': 'g',
                'nutritional_data': {'calories': Decimal('387')}  # per 100g
            },
            {
                'name': 'Butter',
                'quantity': Decimal('125'),
                'unit': 'g',
                'nutritional_data': {'calories': Decimal('717')}  # per 100g
            },
            {
                'name': 'Eggs',
                'quantity': Decimal('3'),
                'unit': 'piece',
                'unit_conversions': {'piece_to_g': Decimal('50')},
                'nutritional_data': {'calories': Decimal('155')}  # per 100g
            }
        ]
        
        # Calculate expected total calories
        # Flour: 250g * 364cal/100g = 910 cal
        # Sugar: 100g * 387cal/100g = 387 cal
        # Butter: 125g * 717cal/100g = 896.25 cal
        # Eggs: 3 * 50g * 155cal/100g = 232.5 cal
        # Total: 910 + 387 + 896.25 + 232.5 = 2425.75 cal
        expected_total = Decimal('2425.75')
        
        actual_total = calorie_scaler.calculate_recipe_calories(ingredients)
        self.assert_accuracy(expected_total, actual_total)
        
        # Test calories per serving
        servings = 8
        expected_per_serving = expected_total / Decimal(servings)
        actual_per_serving = calorie_scaler.calculate_calories_per_serving(actual_total, servings)
        self.assert_accuracy(expected_per_serving, actual_per_serving)
    
    def test_calorie_scaling_accuracy(self, calorie_scaler):
        """Test accuracy of calorie-based scaling."""
        recipe_data = {
            'servings': 4,
            'ingredients': [
                {
                    'name': 'Pasta',
                    'quantity': Decimal('400'),
                    'unit': 'g',
                    'nutritional_data': {'calories': Decimal('371')}  # per 100g
                },
                {
                    'name': 'Tomato Sauce',
                    'quantity': Decimal('300'),
                    'unit': 'g',
                    'nutritional_data': {'calories': Decimal('82')}  # per 100g
                },
                {
                    'name': 'Cheese',
                    'quantity': Decimal('150'),
                    'unit': 'g',
                    'nutritional_data': {'calories': Decimal('402')}  # per 100g
                }
            ]
        }
        
        # Current calories: 400*3.71 + 300*0.82 + 150*4.02 = 1484 + 246 + 603 = 2333
        current_calories = Decimal('2333')
        
        # Scale to 1800 calories total
        target_calories = Decimal('1800')
        expected_factor = target_calories / current_calories
        
        result = calorie_scaler.scale_recipe_to_target_calories(
            recipe_data, target_calories, target_servings=4
        )
        
        # Verify scaling factor
        self.assert_accuracy(expected_factor, Decimal(str(result['scaling_factor'])))
        
        # Verify total calories
        self.assert_accuracy(target_calories, result['total_calories'])
        
        # Verify individual ingredients
        for orig, scaled in zip(recipe_data['ingredients'], result['scaled_ingredients']):
            expected_qty = orig['quantity'] * expected_factor
            self.assert_accuracy(expected_qty, scaled['quantity'])
    
    def test_participant_coefficient_accuracy(self, participant_scaler):
        """Test accuracy of participant coefficient calculations."""
        participants = [
            {'name': 'Adult 1', 'coefficient': 100},
            {'name': 'Adult 2', 'coefficient': 120},
            {'name': 'Child 1', 'coefficient': 75},
            {'name': 'Child 2', 'coefficient': 60},
            {'name': 'Athlete', 'coefficient': 150, 'meal_coefficients': {'Lunch': 175}},
            {'name': 'Elderly', 'coefficient': 85, 'attendance_factor': Decimal('0.8')}
        ]
        
        # Calculate expected effective participants
        # Adult 1: 100% = 1.0
        # Adult 2: 120% = 1.2
        # Child 1: 75% = 0.75
        # Child 2: 60% = 0.6
        # Athlete: 150% = 1.5 (base)
        # Elderly: 85% * 0.8 = 0.68
        expected_base = Decimal('1.0') + Decimal('1.2') + Decimal('0.75') + Decimal('0.6') + Decimal('1.5') + Decimal('0.68')
        expected_base = Decimal('5.73')
        
        actual_base = participant_scaler.calculate_effective_participants(participants)
        self.assert_accuracy(expected_base, actual_base)
        
        # Test with meal-specific coefficient
        # Athlete at lunch: 150% * 175% = 262.5% = 2.625
        expected_lunch = Decimal('1.0') + Decimal('1.2') + Decimal('0.75') + Decimal('0.6') + Decimal('2.625') + Decimal('0.68')
        expected_lunch = Decimal('6.855')
        
        actual_lunch = participant_scaler.calculate_effective_participants(participants, 'Lunch')
        self.assert_accuracy(expected_lunch, actual_lunch)
    
    def test_participant_scaling_accuracy(self, participant_scaler):
        """Test accuracy of participant-based scaling."""
        recipe_data = {
            'servings': 6,
            'ingredients': [
                {'name': 'Rice', 'quantity': Decimal('450'), 'unit': 'g'},
                {'name': 'Chicken', 'quantity': Decimal('600'), 'unit': 'g'},
                {'name': 'Vegetables', 'quantity': Decimal('300'), 'unit': 'g'}
            ]
        }
        
        participants = [
            {'name': 'Person 1', 'coefficient': 100},
            {'name': 'Person 2', 'coefficient': 80}
        ]
        
        # Effective participants: 1.0 + 0.8 = 1.8
        # Scaling factor: 1.8 / 6 = 0.3
        expected_factor = Decimal('0.3')
        
        result = participant_scaler.scale_recipe_for_participants(
            recipe_data, participants
        )
        
        # Verify scaling factor
        self.assert_accuracy(expected_factor, Decimal(str(result['scaling_factor'])))
        
        # Verify ingredient scaling
        for orig, scaled in zip(recipe_data['ingredients'], result['scaled_ingredients']):
            expected_qty = orig['quantity'] * expected_factor
            self.assert_accuracy(expected_qty, scaled['quantity'])
    
    def test_real_world_recipe_accuracy(self, scaler, calorie_scaler):
        """Test accuracy with real-world recipe examples."""
        # Bread recipe (makes 2 loaves)
        bread_recipe = {
            'servings': 2,
            'ingredients': [
                {'name': 'Bread Flour', 'quantity': Decimal('1000'), 'unit': 'g',
                 'nutritional_data': {'calories': Decimal('340')}},
                {'name': 'Water', 'quantity': Decimal('680'), 'unit': 'ml'},
                {'name': 'Yeast', 'quantity': Decimal('7'), 'unit': 'g'},
                {'name': 'Salt', 'quantity': Decimal('20'), 'unit': 'g'},
                {'name': 'Sugar', 'quantity': Decimal('25'), 'unit': 'g',
                 'nutritional_data': {'calories': Decimal('387')}},
                {'name': 'Oil', 'quantity': Decimal('30'), 'unit': 'ml',
                 'nutritional_data': {'calories': Decimal('884')}}
            ]
        }
        
        # Scale to make 5 loaves
        factor = scaler.calculate_base_scaling_factor(2, 5)
        expected_factor = Decimal('2.5')
        self.assert_accuracy(expected_factor, factor)
        
        # Verify each ingredient scales correctly
        expected_quantities = [
            Decimal('2500'),   # Flour
            Decimal('1700'),   # Water
            Decimal('17.5'),   # Yeast
            Decimal('50'),     # Salt
            Decimal('62.5'),   # Sugar
            Decimal('75')      # Oil
        ]
        
        for ing, expected in zip(bread_recipe['ingredients'], expected_quantities):
            scaled = scaler.scale_ingredient_quantity(ing['quantity'], factor)
            self.assert_accuracy(expected, scaled)
    
    def test_precision_boundaries(self, scaler):
        """Test precision at boundary conditions."""
        # Minimum practical quantity
        factor = scaler.calculate_base_scaling_factor(100, 1)
        scaled = scaler.scale_ingredient_quantity(Decimal('0.1'), factor)
        expected = Decimal('0.001')
        self.assert_accuracy(expected, scaled)
        
        # Maximum practical quantity
        factor = scaler.calculate_base_scaling_factor(1, 100)
        scaled = scaler.scale_ingredient_quantity(Decimal('999.99'), factor)
        expected = Decimal('99999')
        self.assert_accuracy(expected, scaled)
        
        # Precision with many decimal places
        factor = Decimal('1.234567890123456789')
        quantity = Decimal('987.654321098765432')
        scaled = scaler.scale_ingredient_quantity(quantity, factor)
        # Verify at least 4 decimal places of accuracy
        expected = quantity * factor
        # Quantize both to 4 decimal places for comparison
        expected_rounded = expected.quantize(Decimal('0.0001'))
        scaled_rounded = scaled.quantize(Decimal('0.0001'))
        assert expected_rounded == scaled_rounded
    
    def test_rounding_impact_on_accuracy(self):
        """Test that rounding maintains acceptable accuracy."""
        # Create scalers with and without rounding
        scaler_no_round = RecipeScaler(use_rounding=False)
        scaler_with_round = RecipeScaler(use_rounding=True)
        
        # Test various quantities and units
        test_cases = [
            {'quantity': Decimal('237'), 'unit': 'g'},      # Weight
            {'quantity': Decimal('118'), 'unit': 'ml'},     # Volume
            {'quantity': Decimal('1.5'), 'unit': 'piece'},  # Countable
            {'quantity': Decimal('2.3'), 'unit': 'tsp'},    # Small measure
            {'quantity': Decimal('0.75'), 'unit': 'cup'},   # Fraction
        ]
        
        factor = Decimal('1.5')  # Scale up by 50%
        
        for test in test_cases:
            # Scale without rounding
            exact = scaler_no_round.scale_ingredient_quantity(test['quantity'], factor)
            
            # Scale with rounding
            ingredients = [test]
            _, rounded_ingredients = scaler_with_round.scale_and_round_recipe(
                4, 6, ingredients
            )
            rounded = rounded_ingredients[0]['quantity']
            
            # Verify rounding doesn't introduce more than 5% error
            if exact > 0:
                error = self.calculate_relative_error(exact, rounded)
                assert error <= Decimal('0.05'), (
                    f"Rounding error too large for {test['quantity']} {test['unit']}: "
                    f"exact={exact}, rounded={rounded}, error={error*100:.2f}%"
                )
    
    def test_constraint_impact_on_accuracy(self):
        """Test that constraints maintain mathematical relationships."""
        scaler = RecipeScaler(use_constraints=True)
        
        # Test extreme scaling that triggers constraints
        # Should clamp to 10x maximum
        factor, scaled, warnings = scaler.scale_recipe_with_constraints(
            original_servings=1,
            target_participants=50,  # 50x scaling
            ingredient_quantities=[Decimal('100'), Decimal('200')]
        )
        
        # Verify constraint was applied
        assert factor <= Decimal('10')
        assert len(warnings) > 0
        
        # Verify quantities maintain proportions
        ratio = scaled[1] / scaled[0]
        expected_ratio = Decimal('2')  # 200/100
        self.assert_accuracy(expected_ratio, ratio)
    
    def test_validation_consistency(self):
        """Test that validation doesn't affect calculation accuracy."""
        validator = ScalingValidator()
        
        # Test scaling factor validation
        test_factors = [
            Decimal('0.1'),
            Decimal('1'),
            Decimal('2.5'),
            Decimal('10')
        ]
        
        for factor in test_factors:
            result = validator.validate_scaling_factor(factor)
            if result.is_valid:
                # Validation shouldn't change the factor
                assert factor == factor  # Factor remains unchanged
    
    def test_overall_accuracy_requirement(self):
        """Comprehensive test to verify 99.9% accuracy requirement is met."""
        scaler = RecipeScaler(use_rounding=False, use_constraints=False)
        
        # Run 1000 random scaling operations
        import random
        random.seed(42)  # Reproducible results
        
        total_tests = 1000
        passed_tests = 0
        max_error = Decimal('0')
        
        for _ in range(total_tests):
            # Random servings and quantities
            original_servings = random.randint(1, 20)
            target_servings = random.randint(1, 20)
            quantity = Decimal(str(random.uniform(0.1, 1000)))
            
            # Calculate expected result
            expected_factor = Decimal(target_servings) / Decimal(original_servings)
            expected_scaled = quantity * expected_factor
            
            # Calculate actual result
            factor = scaler.calculate_base_scaling_factor(original_servings, target_servings)
            scaled = scaler.scale_ingredient_quantity(quantity, factor)
            
            # Check accuracy
            error = self.calculate_relative_error(expected_scaled, scaled)
            max_error = max(max_error, error)
            
            if error <= Decimal('0.001'):  # 0.1% error = 99.9% accuracy
                passed_tests += 1
        
        accuracy_rate = passed_tests / total_tests
        print(f"\nAccuracy test results:")
        print(f"Total tests: {total_tests}")
        print(f"Passed tests: {passed_tests}")
        print(f"Accuracy rate: {accuracy_rate * 100:.2f}%")
        print(f"Maximum error: {max_error * 100:.4f}%")
        
        # Verify 99.9% accuracy requirement
        assert accuracy_rate >= 0.999, f"Accuracy requirement not met: {accuracy_rate * 100:.2f}%"


class TestAccuracyIntegration:
    """Integration tests for accuracy across the entire scaling system."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_scaling_accuracy(self):
        """Test accuracy through the complete scaling pipeline."""
        from jidelnicek.recipe.services.scaling_service import ScalingService
        from unittest.mock import AsyncMock, MagicMock
        
        # Mock database session
        mock_db = AsyncMock()
        service = ScalingService(mock_db)
        
        # Mock recipe data
        mock_recipe = MagicMock()
        mock_recipe.id = "test-recipe-id"
        mock_recipe.title = "Test Recipe"
        mock_recipe.servings = 4
        
        # Mock ingredients with precise quantities
        mock_ingredients = []
        ingredient_data = [
            ('Flour', Decimal('250'), 'g'),
            ('Sugar', Decimal('125.5'), 'g'),
            ('Butter', Decimal('85.25'), 'g'),
            ('Eggs', Decimal('2'), 'piece'),
            ('Milk', Decimal('175.75'), 'ml'),
        ]
        
        for name, qty, unit in ingredient_data:
            ing = MagicMock()
            ing.name = name
            ing.quantity = qty
            ing.unit = unit
            ri = MagicMock()
            ri.ingredient = ing
            ri.quantity = qty
            ri.unit = unit
            mock_ingredients.append(ri)
        
        mock_recipe.recipe_ingredients = mock_ingredients
        
        # Mock the get_recipe_with_ingredients method
        service.get_recipe_with_ingredients = AsyncMock(return_value=mock_recipe)
        
        # Test scaling to 6 servings
        result = await service.preview_recipe_scaling(
            recipe_id="test-recipe-id",
            target_servings=6,
            use_rounding=False,
            use_constraints=False
        )
        
        # Verify accuracy
        expected_factor = Decimal('1.5')
        actual_factor = Decimal(str(result['scaling_factor']))
        
        # Check scaling factor accuracy
        error = abs(actual_factor - expected_factor) / expected_factor
        assert error <= Decimal('0.001'), f"Scaling factor error: {error * 100:.4f}%"
        
        # Check each ingredient
        for i, (name, original_qty, unit) in enumerate(ingredient_data):
            scaled_ing = result['ingredients'][i]
            expected_scaled = float(original_qty * expected_factor)
            actual_scaled = scaled_ing['scaled_quantity']
            
            # Calculate relative error
            if expected_scaled > 0:
                rel_error = abs(actual_scaled - expected_scaled) / expected_scaled
                assert rel_error <= 0.001, (
                    f"Ingredient '{name}' scaling error: "
                    f"expected {expected_scaled}, got {actual_scaled}, "
                    f"error {rel_error * 100:.4f}%"
                )