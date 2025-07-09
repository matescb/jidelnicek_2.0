"""Tests for the recipe scaling utilities."""

import pytest
from decimal import Decimal, getcontext
from datetime import date

from jidelnicek.core.exceptions import ValidationError
from jidelnicek.recipe.utils.scaling import RecipeScaler, CalorieScaler, ParticipantScaler


class TestRecipeScaler:
    """Test suite for the RecipeScaler class."""
    
    @pytest.fixture
    def scaler(self):
        """Create a RecipeScaler instance for testing."""
        return RecipeScaler()
    
    # Tests for calculate_base_scaling_factor
    
    def test_calculate_base_scaling_factor_basic(self, scaler):
        """Test basic scaling factor calculations."""
        # Scale up: 4 servings to 6 participants
        factor = scaler.calculate_base_scaling_factor(4, 6)
        assert factor == Decimal('1.5000')
        
        # Scale down: 8 servings to 2 participants
        factor = scaler.calculate_base_scaling_factor(8, 2)
        assert factor == Decimal('0.2500')
        
        # Same servings and participants
        factor = scaler.calculate_base_scaling_factor(5, 5)
        assert factor == Decimal('1.0000')
    
    def test_calculate_base_scaling_factor_precision(self, scaler):
        """Test that scaling factor maintains proper precision."""
        # Test case that would have repeating decimals
        factor = scaler.calculate_base_scaling_factor(3, 7)
        assert factor == Decimal('2.3333')  # Rounded to 4 decimal places
        
        # Another precision test
        factor = scaler.calculate_base_scaling_factor(7, 3)
        assert factor == Decimal('0.4286')  # Rounded to 4 decimal places
    
    def test_calculate_base_scaling_factor_large_numbers(self, scaler):
        """Test scaling with large numbers."""
        factor = scaler.calculate_base_scaling_factor(100, 500)
        assert factor == Decimal('5.0000')
        
        factor = scaler.calculate_base_scaling_factor(1000, 250)
        assert factor == Decimal('0.2500')
    
    def test_calculate_base_scaling_factor_zero_target(self, scaler):
        """Test scaling when target participants is zero."""
        factor = scaler.calculate_base_scaling_factor(4, 0)
        assert factor == Decimal('0')
    
    def test_calculate_base_scaling_factor_invalid_inputs(self, scaler):
        """Test error handling for invalid inputs."""
        # Zero original servings
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_base_scaling_factor(0, 4)
        assert "Original servings must be a positive integer" in str(exc_info.value)
        
        # Negative original servings
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_base_scaling_factor(-4, 4)
        assert "Original servings must be a positive integer" in str(exc_info.value)
        
        # Negative target participants
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_base_scaling_factor(4, -4)
        assert "Target participants must be non-negative" in str(exc_info.value)
    
    # Tests for scale_ingredient_quantity
    
    def test_scale_ingredient_quantity_basic(self, scaler):
        """Test basic ingredient quantity scaling."""
        # Scale up
        scaled = scaler.scale_ingredient_quantity(
            Decimal('200'), Decimal('1.5')
        )
        assert scaled == Decimal('300.0000')
        
        # Scale down
        scaled = scaler.scale_ingredient_quantity(
            Decimal('100'), Decimal('0.5')
        )
        assert scaled == Decimal('50.0000')
        
        # No scaling (factor of 1)
        scaled = scaler.scale_ingredient_quantity(
            Decimal('75'), Decimal('1')
        )
        assert scaled == Decimal('75.0000')
    
    def test_scale_ingredient_quantity_precision(self, scaler):
        """Test that quantity scaling maintains precision."""
        # Test with fractional quantities
        scaled = scaler.scale_ingredient_quantity(
            Decimal('0.75'), Decimal('2.6667')
        )
        assert scaled == Decimal('2.0000')  # 0.75 * 2.6667 = 2.00025, rounded
        
        # Test with small quantities
        scaled = scaler.scale_ingredient_quantity(
            Decimal('0.125'), Decimal('3.3333')
        )
        assert scaled == Decimal('0.4167')  # Properly rounded
    
    def test_scale_ingredient_quantity_zero_handling(self, scaler):
        """Test scaling with zero values."""
        # Zero quantity
        scaled = scaler.scale_ingredient_quantity(
            Decimal('0'), Decimal('1.5')
        )
        assert scaled == Decimal('0.0000')
        
        # Zero scaling factor
        scaled = scaler.scale_ingredient_quantity(
            Decimal('100'), Decimal('0')
        )
        assert scaled == Decimal('0.0000')
    
    def test_scale_ingredient_quantity_type_conversion(self, scaler):
        """Test automatic type conversion to Decimal."""
        # String inputs
        scaled = scaler.scale_ingredient_quantity('250', '1.5')
        assert scaled == Decimal('375.0000')
        
        # Mixed types
        scaled = scaler.scale_ingredient_quantity(Decimal('100'), '2.5')
        assert scaled == Decimal('250.0000')
    
    def test_scale_ingredient_quantity_invalid_inputs(self, scaler):
        """Test error handling for invalid quantity inputs."""
        # Negative quantity
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_ingredient_quantity(Decimal('-50'), Decimal('1.5'))
        assert "Quantity must be non-negative" in str(exc_info.value)
        
        # Negative scaling factor
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_ingredient_quantity(Decimal('50'), Decimal('-1.5'))
        assert "Scaling factor must be non-negative" in str(exc_info.value)
        
        # Invalid string input
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_ingredient_quantity('invalid', Decimal('1.5'))
        assert "Invalid input for scaling" in str(exc_info.value)
    
    # Tests for scale_recipe
    
    def test_scale_recipe_basic(self, scaler):
        """Test scaling an entire recipe."""
        quantities = [
            Decimal('200'),
            Decimal('100'),
            Decimal('50'),
            Decimal('0.5')
        ]
        
        factor, scaled = scaler.scale_recipe(4, 6, quantities)
        
        assert factor == Decimal('1.5000')
        assert scaled == [
            Decimal('300.0000'),
            Decimal('150.0000'),
            Decimal('75.0000'),
            Decimal('0.7500')
        ]
    
    def test_scale_recipe_empty_ingredients(self, scaler):
        """Test scaling with no ingredients."""
        factor, scaled = scaler.scale_recipe(4, 6, [])
        
        assert factor == Decimal('1.5000')
        assert scaled == []
    
    # Edge case tests
    
    def test_very_large_scaling_factors(self, scaler):
        """Test with very large scaling factors."""
        # Scale up by 100x
        factor = scaler.calculate_base_scaling_factor(1, 100)
        assert factor == Decimal('100.0000')
        
        scaled = scaler.scale_ingredient_quantity(
            Decimal('0.5'), factor
        )
        assert scaled == Decimal('50.0000')
    
    def test_very_small_scaling_factors(self, scaler):
        """Test with very small scaling factors."""
        # Scale down by 100x
        factor = scaler.calculate_base_scaling_factor(100, 1)
        assert factor == Decimal('0.0100')
        
        scaled = scaler.scale_ingredient_quantity(
            Decimal('500'), factor
        )
        assert scaled == Decimal('5.0000')
    
    def test_precision_accumulation(self, scaler):
        """Test that precision doesn't degrade with multiple operations."""
        # Start with a quantity
        quantity = Decimal('100')
        
        # Scale up then down
        factor_up = scaler.calculate_base_scaling_factor(3, 7)
        scaled_up = scaler.scale_ingredient_quantity(quantity, factor_up)
        
        factor_down = scaler.calculate_base_scaling_factor(7, 3)
        scaled_back = scaler.scale_ingredient_quantity(scaled_up, factor_down)
        
        # Should be close to original (within precision limits)
        # Due to rounding, might not be exactly 100.0000
        assert abs(scaled_back - Decimal('100.0000')) < Decimal('0.001')
    
    def test_decimal_context_independence(self, scaler):
        """Test that results are consistent regardless of decimal context."""
        # Save current context
        original_context = getcontext().copy()
        
        try:
            # Test with different precision settings
            getcontext().prec = 2
            factor1 = scaler.calculate_base_scaling_factor(3, 7)
            
            getcontext().prec = 50
            factor2 = scaler.calculate_base_scaling_factor(3, 7)
            
            # Results should be the same due to internal quantization
            assert factor1 == factor2
            assert factor1 == Decimal('2.3333')
            
        finally:
            # Restore original context
            getcontext().prec = original_context.prec


class TestCalorieScaler:
    """Test suite for the CalorieScaler class."""
    
    @pytest.fixture
    def scaler(self):
        """Create a CalorieScaler instance for testing."""
        return CalorieScaler()
    
    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredients with nutritional data."""
        return [
            {
                'name': 'Pasta',
                'quantity': Decimal('200'),
                'unit': 'g',
                'nutritional_data': {'calories': 350}  # per 100g
            },
            {
                'name': 'Olive Oil',
                'quantity': Decimal('30'),
                'unit': 'ml',
                'nutritional_data': {'calories': 884},  # per 100g
                'unit_conversions': {'ml_to_g': 0.92}  # oil density
            },
            {
                'name': 'Tomato Sauce',
                'quantity': Decimal('150'),
                'unit': 'g',
                'nutritional_data': {'calories': 82}  # per 100g
            }
        ]
    
    # Tests for calculate_recipe_calories
    
    def test_calculate_recipe_calories_basic(self, scaler, sample_ingredients):
        """Test basic calorie calculation from ingredients."""
        total_calories = scaler.calculate_recipe_calories(sample_ingredients)
        
        # Expected: (200*350/100) + (30*0.92*884/100) + (150*82/100)
        # = 700 + 244.128 + 123 = 1067.128
        assert total_calories == Decimal('1067.1280')
    
    def test_calculate_recipe_calories_empty_list(self, scaler):
        """Test calorie calculation with empty ingredient list."""
        total_calories = scaler.calculate_recipe_calories([])
        assert total_calories == Decimal('0')
    
    def test_calculate_recipe_calories_missing_calorie_data(self, scaler):
        """Test handling ingredients without calorie data."""
        ingredients = [
            {
                'quantity': Decimal('100'),
                'unit': 'g',
                'nutritional_data': {'proteins': 10}  # No calories field
            },
            {
                'quantity': Decimal('200'),
                'unit': 'g',
                'nutritional_data': {'calories': 250}
            }
        ]
        
        total_calories = scaler.calculate_recipe_calories(ingredients)
        # Should only count the second ingredient: 200*250/100 = 500
        assert total_calories == Decimal('500.0000')
    
    def test_calculate_recipe_calories_various_units(self, scaler):
        """Test calorie calculation with various units."""
        ingredients = [
            {
                'quantity': Decimal('1'),
                'unit': 'kg',
                'nutritional_data': {'calories': 100}
            },
            {
                'quantity': Decimal('500'),
                'unit': 'ml',
                'nutritional_data': {'calories': 50}
            },
            {
                'quantity': Decimal('2'),
                'unit': 'cup',
                'nutritional_data': {'calories': 200}
            },
            {
                'quantity': Decimal('3'),
                'unit': 'tbsp',
                'nutritional_data': {'calories': 300}
            },
            {
                'quantity': Decimal('4'),
                'unit': 'tsp',
                'nutritional_data': {'calories': 400}
            }
        ]
        
        total_calories = scaler.calculate_recipe_calories(ingredients)
        # kg: 1000*100/100 = 1000
        # ml: 500*50/100 = 250
        # cup: 2*240*200/100 = 960
        # tbsp: 3*15*300/100 = 135
        # tsp: 4*5*400/100 = 80
        # Total: 2425
        assert total_calories == Decimal('2425.0000')
    
    def test_calculate_recipe_calories_with_pieces(self, scaler):
        """Test calorie calculation with piece units."""
        ingredients = [
            {
                'quantity': Decimal('2'),
                'unit': 'piece',
                'nutritional_data': {'calories': 95},
                'unit_conversions': {'piece_to_g': 150}  # 150g per piece
            }
        ]
        
        total_calories = scaler.calculate_recipe_calories(ingredients)
        # 2 pieces * 150g/piece * 95cal/100g = 285
        assert total_calories == Decimal('285.0000')
    
    def test_calculate_recipe_calories_pieces_without_conversion(self, scaler):
        """Test error handling for pieces without conversion factor."""
        ingredients = [
            {
                'quantity': Decimal('2'),
                'unit': 'piece',
                'nutritional_data': {'calories': 95}
                # Missing unit_conversions
            }
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories(ingredients)
        assert "Cannot convert pieces to grams" in str(exc_info.value)
    
    def test_calculate_recipe_calories_invalid_data(self, scaler):
        """Test error handling for invalid ingredient data."""
        # Missing quantity
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories([
                {'unit': 'g', 'nutritional_data': {'calories': 100}}
            ])
        assert "missing 'quantity' field" in str(exc_info.value)
        
        # Missing unit
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories([
                {'quantity': Decimal('100'), 'nutritional_data': {'calories': 100}}
            ])
        assert "missing 'unit' field" in str(exc_info.value)
        
        # Missing nutritional_data
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories([
                {'quantity': Decimal('100'), 'unit': 'g'}
            ])
        assert "missing 'nutritional_data' field" in str(exc_info.value)
        
        # Invalid nutritional_data format
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories([
                {'quantity': Decimal('100'), 'unit': 'g', 'nutritional_data': 'invalid'}
            ])
        assert "invalid nutritional_data format" in str(exc_info.value)
        
        # Negative quantity
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories([
                {'quantity': Decimal('-100'), 'unit': 'g', 'nutritional_data': {'calories': 100}}
            ])
        assert "negative quantity" in str(exc_info.value)
        
        # Negative calories
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories([
                {'quantity': Decimal('100'), 'unit': 'g', 'nutritional_data': {'calories': -100}}
            ])
        assert "negative calories" in str(exc_info.value)
    
    # Tests for calculate_calories_per_serving
    
    def test_calculate_calories_per_serving_basic(self, scaler):
        """Test basic calories per serving calculation."""
        per_serving = scaler.calculate_calories_per_serving(Decimal('2400'), 6)
        assert per_serving == Decimal('400.0000')
        
        per_serving = scaler.calculate_calories_per_serving(Decimal('1500'), 4)
        assert per_serving == Decimal('375.0000')
    
    def test_calculate_calories_per_serving_precision(self, scaler):
        """Test calories per serving with precision requirements."""
        # Test case that would have repeating decimals
        per_serving = scaler.calculate_calories_per_serving(Decimal('1000'), 3)
        assert per_serving == Decimal('333.3333')  # Rounded to 4 decimal places
        
        per_serving = scaler.calculate_calories_per_serving(Decimal('1000'), 7)
        assert per_serving == Decimal('142.8571')  # Rounded to 4 decimal places
    
    def test_calculate_calories_per_serving_type_conversion(self, scaler):
        """Test automatic type conversion for calories per serving."""
        per_serving = scaler.calculate_calories_per_serving('2400', 6)
        assert per_serving == Decimal('400.0000')
        
        per_serving = scaler.calculate_calories_per_serving(2400.5, 6)
        assert per_serving == Decimal('400.0833')
    
    def test_calculate_calories_per_serving_invalid_inputs(self, scaler):
        """Test error handling for invalid inputs."""
        # Zero servings
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_calories_per_serving(Decimal('1000'), 0)
        assert "Servings must be positive" in str(exc_info.value)
        
        # Negative servings
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_calories_per_serving(Decimal('1000'), -4)
        assert "Servings must be positive" in str(exc_info.value)
        
        # Negative calories
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_calories_per_serving(Decimal('-1000'), 4)
        assert "Total calories must be non-negative" in str(exc_info.value)
    
    # Tests for calculate_calorie_based_scaling_factor
    
    def test_calculate_calorie_based_scaling_factor_basic(self, scaler):
        """Test basic calorie-based scaling factor calculation."""
        # Scale down
        factor = scaler.calculate_calorie_based_scaling_factor(
            Decimal('800'), Decimal('600')
        )
        assert factor == Decimal('0.7500')
        
        # Scale up
        factor = scaler.calculate_calorie_based_scaling_factor(
            Decimal('500'), Decimal('750')
        )
        assert factor == Decimal('1.5000')
        
        # No change
        factor = scaler.calculate_calorie_based_scaling_factor(
            Decimal('600'), Decimal('600')
        )
        assert factor == Decimal('1.0000')
    
    def test_calculate_calorie_based_scaling_factor_precision(self, scaler):
        """Test scaling factor precision."""
        factor = scaler.calculate_calorie_based_scaling_factor(
            Decimal('700'), Decimal('300')
        )
        assert factor == Decimal('0.4286')  # Rounded to 4 decimal places
        
        factor = scaler.calculate_calorie_based_scaling_factor(
            Decimal('300'), Decimal('700')
        )
        assert factor == Decimal('2.3333')  # Rounded to 4 decimal places
    
    def test_calculate_calorie_based_scaling_factor_zero_target(self, scaler):
        """Test scaling factor when target calories is zero."""
        factor = scaler.calculate_calorie_based_scaling_factor(
            Decimal('800'), Decimal('0')
        )
        assert factor == Decimal('0')
    
    def test_calculate_calorie_based_scaling_factor_invalid_inputs(self, scaler):
        """Test error handling for invalid scaling factor inputs."""
        # Zero recipe calories
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_calorie_based_scaling_factor(Decimal('0'), Decimal('600'))
        assert "Recipe calories must be positive" in str(exc_info.value)
        
        # Negative recipe calories
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_calorie_based_scaling_factor(Decimal('-800'), Decimal('600'))
        assert "Recipe calories must be positive" in str(exc_info.value)
        
        # Negative target calories
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_calorie_based_scaling_factor(Decimal('800'), Decimal('-600'))
        assert "Target calories must be non-negative" in str(exc_info.value)
    
    # Tests for scale_recipe_to_target_calories
    
    def test_scale_recipe_to_target_calories_basic(self, scaler, sample_ingredients):
        """Test basic recipe scaling to target calories."""
        recipe_data = {
            'name': 'Test Recipe',
            'servings': 4,
            'ingredients': sample_ingredients
        }
        
        # Scale to 800 calories total
        result = scaler.scale_recipe_to_target_calories(
            recipe_data, Decimal('800')
        )
        
        assert 'scaled_ingredients' in result
        assert 'scaling_factor' in result
        assert 'total_calories' in result
        assert 'calories_per_serving' in result
        
        # Check scaling factor (800 / 1067.128 ≈ 0.7497)
        assert result['scaling_factor'] == Decimal('0.7497')
        
        # Check total calories (should be close to 800)
        assert abs(result['total_calories'] - Decimal('800')) < Decimal('1')
        
        # Check calories per serving
        assert result['calories_per_serving'] == result['total_calories'] / 4
    
    def test_scale_recipe_to_target_calories_with_target_servings(self, scaler, sample_ingredients):
        """Test scaling recipe with different target servings."""
        recipe_data = {
            'name': 'Test Recipe',
            'servings': 4,
            'ingredients': sample_ingredients
        }
        
        # Scale to 900 calories total for 6 servings
        result = scaler.scale_recipe_to_target_calories(
            recipe_data, Decimal('900'), target_servings=6
        )
        
        assert result['servings'] == 6
        assert abs(result['total_calories'] - Decimal('900')) < Decimal('1')
        assert result['calories_per_serving'] == Decimal('150.0000')
    
    def test_scale_recipe_to_target_calories_precision(self, scaler):
        """Test precision maintenance in recipe scaling."""
        recipe_data = {
            'name': 'Precision Test',
            'servings': 3,
            'ingredients': [
                {
                    'quantity': Decimal('333.3333'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 333.3333}
                }
            ]
        }
        
        result = scaler.scale_recipe_to_target_calories(
            recipe_data, Decimal('500')
        )
        
        # Check that precision is maintained
        scaled_quantity = result['scaled_ingredients'][0]['quantity']
        assert len(str(scaled_quantity).split('.')[1]) == 4  # 4 decimal places
        
        # Verify calorie calculation
        assert abs(result['total_calories'] - Decimal('500')) < Decimal('0.01')
    
    def test_scale_recipe_to_target_calories_preserves_fields(self, scaler, sample_ingredients):
        """Test that original recipe fields are preserved."""
        recipe_data = {
            'name': 'Test Recipe',
            'servings': 4,
            'description': 'A test recipe',
            'prep_time': 30,
            'custom_field': 'value',
            'ingredients': sample_ingredients
        }
        
        result = scaler.scale_recipe_to_target_calories(
            recipe_data, Decimal('800')
        )
        
        # Check that original fields are preserved
        assert result['name'] == 'Test Recipe'
        assert result['description'] == 'A test recipe'
        assert result['prep_time'] == 30
        assert result['custom_field'] == 'value'
    
    def test_scale_recipe_to_target_calories_invalid_inputs(self, scaler):
        """Test error handling for invalid recipe data."""
        # Not a dictionary
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_to_target_calories([], Decimal('800'))
        assert "Recipe data must be a dictionary" in str(exc_info.value)
        
        # Missing ingredients
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_to_target_calories({'name': 'Test'}, Decimal('800'))
        assert "Recipe data must contain 'ingredients' field" in str(exc_info.value)
        
        # Ingredients not a list
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_to_target_calories(
                {'ingredients': 'invalid'}, Decimal('800')
            )
        assert "Ingredients must be a list" in str(exc_info.value)
        
        # Empty ingredients
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_to_target_calories(
                {'ingredients': []}, Decimal('800')
            )
        assert "Recipe must have at least one ingredient" in str(exc_info.value)
        
        # Invalid servings
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_to_target_calories(
                {'ingredients': [{'quantity': 1, 'unit': 'g', 'nutritional_data': {'calories': 100}}], 
                 'servings': 0}, 
                Decimal('800')
            )
        assert "Original servings must be positive" in str(exc_info.value)
        
        # Recipe with no calorie information
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_to_target_calories(
                {'ingredients': [{'quantity': 100, 'unit': 'g', 'nutritional_data': {}}]}, 
                Decimal('800')
            )
        assert "Recipe has no calorie information" in str(exc_info.value)
    
    # Edge case tests
    
    def test_very_small_calorie_targets(self, scaler, sample_ingredients):
        """Test scaling to very small calorie targets."""
        recipe_data = {
            'ingredients': sample_ingredients
        }
        
        # Scale to 10 calories
        result = scaler.scale_recipe_to_target_calories(
            recipe_data, Decimal('10')
        )
        
        assert result['scaling_factor'] < Decimal('0.01')
        assert abs(result['total_calories'] - Decimal('10')) < Decimal('0.1')
    
    def test_very_large_calorie_targets(self, scaler):
        """Test scaling to very large calorie targets."""
        recipe_data = {
            'ingredients': [
                {
                    'quantity': Decimal('100'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 200}
                }
            ]
        }
        
        # Scale to 10000 calories
        result = scaler.scale_recipe_to_target_calories(
            recipe_data, Decimal('10000')
        )
        
        assert result['scaling_factor'] == Decimal('50.0000')
        assert result['total_calories'] == Decimal('10000.0000')
    
    def test_precision_accumulation_calories(self, scaler):
        """Test that precision doesn't degrade with multiple calorie operations."""
        ingredients = [
            {
                'quantity': Decimal('123.4567'),
                'unit': 'g',
                'nutritional_data': {'calories': 234.5678}
            }
        ]
        
        # Calculate calories
        calories1 = scaler.calculate_recipe_calories(ingredients)
        
        # Scale and recalculate
        factor = scaler.calculate_calorie_based_scaling_factor(calories1, Decimal('500'))
        scaled_ingredients = []
        for ing in ingredients:
            scaled_ing = ing.copy()
            scaled_ing['quantity'] = scaler.scale_ingredient_quantity(ing['quantity'], factor)
            scaled_ingredients.append(scaled_ing)
        
        calories2 = scaler.calculate_recipe_calories(scaled_ingredients)
        
        # Should be close to target
        assert abs(calories2 - Decimal('500')) < Decimal('0.01')
    
    def test_unit_conversion_edge_cases(self, scaler):
        """Test edge cases in unit conversions."""
        # Liters to grams
        ingredients = [
            {
                'quantity': Decimal('0.5'),
                'unit': 'l',
                'nutritional_data': {'calories': 100},
                'unit_conversions': {'ml_to_g': 1.2}
            }
        ]
        
        calories = scaler.calculate_recipe_calories(ingredients)
        # 0.5L = 500ml * 1.2 = 600g, 600g * 100cal/100g = 600cal
        assert calories == Decimal('600.0000')
        
        # Unknown unit
        ingredients = [
            {
                'quantity': Decimal('1'),
                'unit': 'unknown_unit',
                'nutritional_data': {'calories': 100}
            }
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_recipe_calories(ingredients)
        assert "Unknown unit" in str(exc_info.value)


class TestParticipantScaler:
    """Test suite for the ParticipantScaler class."""
    
    @pytest.fixture
    def scaler(self):
        """Create a ParticipantScaler instance for testing."""
        return ParticipantScaler()
    
    @pytest.fixture
    def sample_participants(self):
        """Create sample participants with various coefficients."""
        return [
            {'name': 'Adult 1', 'coefficient': 100},
            {'name': 'Adult 2', 'coefficient': 100},
            {'name': 'Child', 'coefficient': 75},
            {'name': 'Teenager', 'coefficient': 125}
        ]
    
    @pytest.fixture
    def sample_recipe(self):
        """Create a sample recipe for testing."""
        return {
            'name': 'Test Recipe',
            'servings': 4,
            'ingredients': [
                {'name': 'Ingredient 1', 'quantity': Decimal('200'), 'unit': 'g'},
                {'name': 'Ingredient 2', 'quantity': Decimal('100'), 'unit': 'ml'},
                {'name': 'Ingredient 3', 'quantity': Decimal('50'), 'unit': 'g'}
            ]
        }
    
    @pytest.fixture
    def sample_recipe_with_calories(self):
        """Create a sample recipe with calorie data."""
        return {
            'name': 'Calorie Test Recipe',
            'servings': 4,
            'ingredients': [
                {
                    'name': 'Pasta',
                    'quantity': Decimal('400'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 350}  # per 100g
                },
                {
                    'name': 'Sauce',
                    'quantity': Decimal('200'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 80}  # per 100g
                }
            ]
        }
    
    # Tests for calculate_effective_participants
    
    def test_calculate_effective_participants_basic(self, scaler, sample_participants):
        """Test basic effective participant calculation."""
        # 2*100% + 1*75% + 1*125% = 4.00
        effective = scaler.calculate_effective_participants(sample_participants)
        assert effective == Decimal('4.0000')
    
    def test_calculate_effective_participants_empty_list(self, scaler):
        """Test with empty participant list."""
        effective = scaler.calculate_effective_participants([])
        assert effective == Decimal('0')
    
    def test_calculate_effective_participants_single(self, scaler):
        """Test with single participant."""
        participants = [{'name': 'Solo', 'coefficient': 100}]
        effective = scaler.calculate_effective_participants(participants)
        assert effective == Decimal('1.0000')
    
    def test_calculate_effective_participants_all_children(self, scaler):
        """Test with all participants having reduced coefficients."""
        participants = [
            {'name': 'Child 1', 'coefficient': 75},
            {'name': 'Child 2', 'coefficient': 75},
            {'name': 'Child 3', 'coefficient': 50}
        ]
        # 0.75 + 0.75 + 0.50 = 2.00
        effective = scaler.calculate_effective_participants(participants)
        assert effective == Decimal('2.0000')
    
    def test_calculate_effective_participants_meal_specific(self, scaler):
        """Test meal-specific coefficients."""
        participants = [
            {'name': 'Adult 1', 'coefficient': 100},
            {
                'name': 'Adult 2', 
                'coefficient': 100,
                'meal_coefficients': {
                    'Breakfast': 75,
                    'Lunch': 100,
                    'Dinner': 125
                }
            },
            {'name': 'Child', 'coefficient': 75}
        ]
        
        # Breakfast: 1.0 + 0.75 + 0.75 = 2.50
        effective_breakfast = scaler.calculate_effective_participants(participants, 'Breakfast')
        assert effective_breakfast == Decimal('2.5000')
        
        # Lunch: 1.0 + 1.0 + 0.75 = 2.75
        effective_lunch = scaler.calculate_effective_participants(participants, 'Lunch')
        assert effective_lunch == Decimal('2.7500')
        
        # Dinner: 1.0 + 1.25 + 0.75 = 3.00
        effective_dinner = scaler.calculate_effective_participants(participants, 'Dinner')
        assert effective_dinner == Decimal('3.0000')
        
        # No meal type specified: uses base coefficients
        effective_base = scaler.calculate_effective_participants(participants)
        assert effective_base == Decimal('2.7500')
    
    def test_calculate_effective_participants_attendance_factor(self, scaler):
        """Test with attendance factors for partial trip participation."""
        participants = [
            {'name': 'Full Timer', 'coefficient': 100, 'attendance_factor': 1.0},
            {'name': 'Half Timer', 'coefficient': 100, 'attendance_factor': 0.5},
            {'name': 'Weekend Only', 'coefficient': 100, 'attendance_factor': 0.2857}  # 2/7 days
        ]
        
        # 1.0 + 0.5 + 0.2857 = 1.7857
        effective = scaler.calculate_effective_participants(participants)
        assert effective == Decimal('1.7857')
    
    def test_calculate_effective_participants_combined_factors(self, scaler):
        """Test combining meal coefficients with attendance factors."""
        participants = [
            {
                'name': 'Partial Adult',
                'coefficient': 100,
                'meal_coefficients': {'Breakfast': 50},
                'attendance_factor': 0.5
            }
        ]
        
        # Breakfast with 50% coefficient and 50% attendance: 0.5 * 0.5 = 0.25
        effective = scaler.calculate_effective_participants(participants, 'Breakfast')
        assert effective == Decimal('0.2500')
    
    def test_calculate_effective_participants_invalid_data(self, scaler):
        """Test error handling for invalid participant data."""
        # Not a dictionary
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_effective_participants(['invalid'])
        assert "must be a dictionary" in str(exc_info.value)
        
        # Missing coefficient
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_effective_participants([{'name': 'No Coefficient'}])
        assert "missing 'coefficient' field" in str(exc_info.value)
        
        # Negative coefficient
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_effective_participants([{'coefficient': -50}])
        assert "negative coefficient" in str(exc_info.value)
        
        # Negative meal coefficient
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_effective_participants([
                {'coefficient': 100, 'meal_coefficients': {'Breakfast': -25}}
            ], 'Breakfast')
        assert "negative meal coefficient" in str(exc_info.value)
        
        # Invalid attendance factor
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_effective_participants([
                {'coefficient': 100, 'attendance_factor': 1.5}
            ])
        assert "invalid attendance factor" in str(exc_info.value)
    
    # Tests for calculate_attendance_factor
    
    def test_calculate_attendance_factor_full_trip(self, scaler):
        """Test attendance factor for full trip participation."""
        factor = scaler.calculate_attendance_factor(
            '2024-01-01', '2024-01-05',
            '2024-01-01', '2024-01-05'
        )
        assert factor == Decimal('1.0000')
    
    def test_calculate_attendance_factor_partial_start(self, scaler):
        """Test attendance factor when arriving late."""
        # Arriving on day 2 of 5-day trip: 4/5 = 0.8
        factor = scaler.calculate_attendance_factor(
            '2024-01-02', '2024-01-05',
            '2024-01-01', '2024-01-05'
        )
        assert factor == Decimal('0.8000')
    
    def test_calculate_attendance_factor_partial_end(self, scaler):
        """Test attendance factor when leaving early."""
        # Leaving on day 4 of 5-day trip: 4/5 = 0.8
        factor = scaler.calculate_attendance_factor(
            '2024-01-01', '2024-01-04',
            '2024-01-01', '2024-01-05'
        )
        assert factor == Decimal('0.8000')
    
    def test_calculate_attendance_factor_middle_days(self, scaler):
        """Test attendance factor for middle days only."""
        # Days 2-4 of 5-day trip: 3/5 = 0.6
        factor = scaler.calculate_attendance_factor(
            '2024-01-02', '2024-01-04',
            '2024-01-01', '2024-01-05'
        )
        assert factor == Decimal('0.6000')
    
    def test_calculate_attendance_factor_no_overlap(self, scaler):
        """Test attendance factor with no overlap."""
        factor = scaler.calculate_attendance_factor(
            '2024-01-06', '2024-01-07',
            '2024-01-01', '2024-01-05'
        )
        assert factor == Decimal('0')
    
    def test_calculate_attendance_factor_date_objects(self, scaler):
        """Test attendance factor with date objects instead of strings."""
        factor = scaler.calculate_attendance_factor(
            date(2024, 1, 2), date(2024, 1, 4),
            date(2024, 1, 1), date(2024, 1, 5)
        )
        assert factor == Decimal('0.6000')
    
    def test_calculate_attendance_factor_invalid_dates(self, scaler):
        """Test error handling for invalid date ranges."""
        # Start after end
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_attendance_factor(
                '2024-01-05', '2024-01-01',
                '2024-01-01', '2024-01-05'
            )
        assert "Start date" in str(exc_info.value)
        
        # Trip start after trip end
        with pytest.raises(ValidationError) as exc_info:
            scaler.calculate_attendance_factor(
                '2024-01-01', '2024-01-05',
                '2024-01-05', '2024-01-01'
            )
        assert "Trip start" in str(exc_info.value)
    
    # Tests for scale_recipe_for_participants
    
    def test_scale_recipe_for_participants_basic(self, scaler, sample_recipe, sample_participants):
        """Test basic recipe scaling for participants."""
        result = scaler.scale_recipe_for_participants(sample_recipe, sample_participants)
        
        assert 'scaled_ingredients' in result
        assert 'scaling_factor' in result
        assert 'effective_participants' in result
        
        # Check effective participants: 2*100% + 75% + 125% = 4.00
        assert result['effective_participants'] == Decimal('4.0000')
        
        # Check scaling factor: 4.00 / 4 servings = 1.00
        assert result['scaling_factor'] == Decimal('1.0000')
        
        # Check ingredients are properly scaled (no change in this case)
        assert len(result['scaled_ingredients']) == 3
        assert result['scaled_ingredients'][0]['quantity'] == Decimal('200.0000')
    
    def test_scale_recipe_for_participants_scale_up(self, scaler, sample_recipe):
        """Test scaling up for more participants."""
        participants = [
            {'name': 'Adult 1', 'coefficient': 100},
            {'name': 'Adult 2', 'coefficient': 100},
            {'name': 'Adult 3', 'coefficient': 100},
            {'name': 'Adult 4', 'coefficient': 100},
            {'name': 'Adult 5', 'coefficient': 100},
            {'name': 'Adult 6', 'coefficient': 100}
        ]
        
        result = scaler.scale_recipe_for_participants(sample_recipe, participants)
        
        # 6 participants for 4 servings = 1.5x
        assert result['effective_participants'] == Decimal('6.0000')
        assert result['scaling_factor'] == Decimal('1.5000')
        
        # Check scaled quantities
        assert result['scaled_ingredients'][0]['quantity'] == Decimal('300.0000')  # 200 * 1.5
        assert result['scaled_ingredients'][1]['quantity'] == Decimal('150.0000')  # 100 * 1.5
        assert result['scaled_ingredients'][2]['quantity'] == Decimal('75.0000')   # 50 * 1.5
    
    def test_scale_recipe_for_participants_scale_down(self, scaler, sample_recipe):
        """Test scaling down for fewer participants."""
        participants = [
            {'name': 'Adult', 'coefficient': 100},
            {'name': 'Child', 'coefficient': 50}
        ]
        
        result = scaler.scale_recipe_for_participants(sample_recipe, participants)
        
        # 1.5 effective participants for 4 servings = 0.375x
        assert result['effective_participants'] == Decimal('1.5000')
        assert result['scaling_factor'] == Decimal('0.3750')
        
        # Check scaled quantities
        assert result['scaled_ingredients'][0]['quantity'] == Decimal('75.0000')   # 200 * 0.375
        assert result['scaled_ingredients'][1]['quantity'] == Decimal('37.5000')  # 100 * 0.375
        assert result['scaled_ingredients'][2]['quantity'] == Decimal('18.7500')  # 50 * 0.375
    
    def test_scale_recipe_for_participants_meal_specific(self, scaler, sample_recipe):
        """Test scaling with meal-specific coefficients."""
        participants = [
            {
                'name': 'Light Breakfast Eater',
                'coefficient': 100,
                'meal_coefficients': {'Breakfast': 50, 'Lunch': 100, 'Dinner': 100}
            },
            {
                'name': 'Heavy Dinner Eater',
                'coefficient': 100,
                'meal_coefficients': {'Breakfast': 100, 'Lunch': 100, 'Dinner': 150}
            }
        ]
        
        # Breakfast: 0.5 + 1.0 = 1.5
        breakfast_result = scaler.scale_recipe_for_participants(
            sample_recipe, participants, 'Breakfast'
        )
        assert breakfast_result['effective_participants'] == Decimal('1.5000')
        
        # Dinner: 1.0 + 1.5 = 2.5
        dinner_result = scaler.scale_recipe_for_participants(
            sample_recipe, participants, 'Dinner'
        )
        assert dinner_result['effective_participants'] == Decimal('2.5000')
    
    def test_scale_recipe_for_participants_preserves_fields(self, scaler, sample_participants):
        """Test that original recipe fields are preserved."""
        recipe = {
            'name': 'Test Recipe',
            'servings': 4,
            'description': 'A test recipe',
            'custom_field': 'value',
            'ingredients': [
                {'name': 'Test', 'quantity': Decimal('100'), 'unit': 'g'}
            ]
        }
        
        result = scaler.scale_recipe_for_participants(recipe, sample_participants)
        
        assert result['name'] == 'Test Recipe'
        assert result['description'] == 'A test recipe'
        assert result['custom_field'] == 'value'
    
    def test_scale_recipe_for_participants_invalid_inputs(self, scaler):
        """Test error handling for invalid inputs."""
        valid_participants = [{'coefficient': 100}]
        valid_recipe = {
            'servings': 4,
            'ingredients': [{'quantity': 100, 'unit': 'g'}]
        }
        
        # Not a dictionary
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participants([], valid_participants)
        assert "Recipe data must be a dictionary" in str(exc_info.value)
        
        # Missing ingredients
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participants({'servings': 4}, valid_participants)
        assert "must contain 'ingredients' field" in str(exc_info.value)
        
        # Empty ingredients
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participants(
                {'servings': 4, 'ingredients': []}, 
                valid_participants
            )
        assert "must have at least one ingredient" in str(exc_info.value)
        
        # Zero effective participants
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participants(valid_recipe, [])
        assert "Effective participant count is zero" in str(exc_info.value)
        
        # Ingredient missing quantity
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participants(
                {'servings': 4, 'ingredients': [{'unit': 'g'}]},
                valid_participants
            )
        assert "missing 'quantity' field" in str(exc_info.value)
    
    # Tests for scale_recipe_for_participant_calories
    
    def test_scale_recipe_for_participant_calories_basic(self, scaler, sample_recipe_with_calories):
        """Test basic calorie-based scaling with participants."""
        participants = [
            {'name': 'Adult', 'coefficient': 100},
            {'name': 'Child', 'coefficient': 75}
        ]
        
        result = scaler.scale_recipe_for_participant_calories(
            sample_recipe_with_calories,
            participants,
            Decimal('500')  # 500 calories per standard person
        )
        
        assert 'scaled_ingredients' in result
        assert 'effective_participants' in result
        assert 'total_calories' in result
        assert 'calories_per_standard_person' in result
        assert 'participant_calorie_distribution' in result
        
        # Check effective participants: 1.0 + 0.75 = 1.75
        assert result['effective_participants'] == Decimal('1.7500')
        
        # Check total target calories: 500 * 1.75 = 875
        expected_total = Decimal('875.0000')
        assert abs(result['total_calories'] - expected_total) < Decimal('1')
        
        # Check calorie distribution
        distribution = result['participant_calorie_distribution']
        assert len(distribution) == 2
        assert distribution[0]['calories'] == Decimal('500.0000')  # Adult: 100%
        assert distribution[1]['calories'] == Decimal('375.0000')  # Child: 75%
    
    def test_scale_recipe_for_participant_calories_meal_specific(self, scaler, sample_recipe_with_calories):
        """Test calorie scaling with meal-specific coefficients."""
        participants = [
            {
                'name': 'Light Breakfast',
                'coefficient': 100,
                'meal_coefficients': {'Breakfast': 75, 'Lunch': 100, 'Dinner': 125}
            },
            {
                'name': 'Standard',
                'coefficient': 100
            }
        ]
        
        # Breakfast scaling
        breakfast_result = scaler.scale_recipe_for_participant_calories(
            sample_recipe_with_calories,
            participants,
            Decimal('400'),
            'Breakfast'
        )
        
        # Effective: 0.75 + 1.0 = 1.75
        assert breakfast_result['effective_participants'] == Decimal('1.7500')
        
        # Distribution check
        distribution = breakfast_result['participant_calorie_distribution']
        assert distribution[0]['calories'] == Decimal('300.0000')  # 400 * 75%
        assert distribution[1]['calories'] == Decimal('400.0000')  # 400 * 100%
    
    def test_scale_recipe_for_participant_calories_with_attendance(self, scaler, sample_recipe_with_calories):
        """Test calorie scaling with attendance factors."""
        participants = [
            {'name': 'Full Timer', 'coefficient': 100, 'attendance_factor': 1.0},
            {'name': 'Half Timer', 'coefficient': 100, 'attendance_factor': 0.5}
        ]
        
        result = scaler.scale_recipe_for_participant_calories(
            sample_recipe_with_calories,
            participants,
            Decimal('600')
        )
        
        # Effective: 1.0 + 0.5 = 1.5
        assert result['effective_participants'] == Decimal('1.5000')
        
        # Total target: 600 * 1.5 = 900
        assert abs(result['total_calories'] - Decimal('900')) < Decimal('1')
        
        # Distribution
        distribution = result['participant_calorie_distribution']
        assert distribution[0]['calories'] == Decimal('600.0000')  # Full attendance
        assert distribution[1]['calories'] == Decimal('300.0000')  # Half attendance
    
    def test_scale_recipe_for_participant_calories_complex_scenario(self, scaler):
        """Test complex scenario with various participant types."""
        recipe = {
            'servings': 6,
            'ingredients': [
                {
                    'quantity': Decimal('600'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 300}  # 1800 total calories
                }
            ]
        }
        
        participants = [
            {
                'name': 'Athletic Adult',
                'coefficient': 150,  # Needs 150% of standard
                'meal_coefficients': {'Breakfast': 125, 'Lunch': 150, 'Dinner': 175}
            },
            {
                'name': 'Standard Adult',
                'coefficient': 100
            },
            {
                'name': 'Child',
                'coefficient': 75,
                'attendance_factor': 0.8  # Only 80% of trip
            },
            {
                'name': 'Elderly',
                'coefficient': 80,
                'meal_coefficients': {'Breakfast': 70, 'Lunch': 80, 'Dinner': 85}
            }
        ]
        
        # Test lunch scaling
        result = scaler.scale_recipe_for_participant_calories(
            recipe,
            participants,
            Decimal('700'),  # 700 calories per standard person
            'Lunch'
        )
        
        # Effective for lunch: 1.5 + 1.0 + 0.75*0.8 + 0.8 = 3.9
        assert result['effective_participants'] == Decimal('3.9000')
        
        # Check distribution
        distribution = result['participant_calorie_distribution']
        assert distribution[0]['calories'] == Decimal('1050.0000')  # Athletic: 700 * 150%
        assert distribution[1]['calories'] == Decimal('700.0000')   # Standard: 700 * 100%
        assert distribution[2]['calories'] == Decimal('420.0000')   # Child: 700 * 75% * 0.8
        assert distribution[3]['calories'] == Decimal('560.0000')   # Elderly: 700 * 80%
    
    def test_scale_recipe_for_participant_calories_invalid_inputs(self, scaler):
        """Test error handling for invalid calorie scaling inputs."""
        valid_recipe = {
            'servings': 4,
            'ingredients': [{
                'quantity': 100,
                'unit': 'g',
                'nutritional_data': {'calories': 200}
            }]
        }
        valid_participants = [{'coefficient': 100}]
        
        # Zero effective participants
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participant_calories(
                valid_recipe, [], Decimal('500')
            )
        assert "Effective participant count is zero" in str(exc_info.value)
        
        # Negative target calories
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participant_calories(
                valid_recipe, valid_participants, Decimal('-500')
            )
        assert "Target calories per person must be positive" in str(exc_info.value)
        
        # Recipe with no calorie information
        recipe_no_calories = {
            'servings': 4,
            'ingredients': [{'quantity': 100, 'unit': 'g', 'nutritional_data': {}}]
        }
        with pytest.raises(ValidationError) as exc_info:
            scaler.scale_recipe_for_participant_calories(
                recipe_no_calories, valid_participants, Decimal('500')
            )
        assert "Recipe has no calorie information" in str(exc_info.value)
    
    # Integration tests
    
    def test_integration_participant_coefficients_real_scenario(self, scaler):
        """Test a realistic camping trip scenario."""
        # Recipe for hearty camping stew (serves 8)
        recipe = {
            'name': 'Camping Stew',
            'servings': 8,
            'ingredients': [
                {
                    'name': 'Beef',
                    'quantity': Decimal('1000'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 250}  # per 100g
                },
                {
                    'name': 'Potatoes',
                    'quantity': Decimal('800'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 77}
                },
                {
                    'name': 'Carrots',
                    'quantity': Decimal('400'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 41}
                },
                {
                    'name': 'Onions',
                    'quantity': Decimal('200'),
                    'unit': 'g',
                    'nutritional_data': {'calories': 40}
                }
            ]
        }
        
        # Camping group with varied needs
        participants = [
            {
                'name': 'Hike Leader',
                'coefficient': 150,  # Very active
                'meal_coefficients': {'Breakfast': 125, 'Lunch': 175, 'Dinner': 150}
            },
            {
                'name': 'Adult Hiker 1',
                'coefficient': 125  # Active
            },
            {
                'name': 'Adult Hiker 2',
                'coefficient': 125
            },
            {
                'name': 'Casual Hiker',
                'coefficient': 100
            },
            {
                'name': 'Teen',
                'coefficient': 110
            },
            {
                'name': 'Child 1',
                'coefficient': 75
            },
            {
                'name': 'Child 2',
                'coefficient': 75
            },
            {
                'name': 'Late Arrival',
                'coefficient': 100,
                'attendance_factor': 0.6  # Arrives day 3 of 5
            }
        ]
        
        # Scale for dinner with 800 calories per standard person
        result = scaler.scale_recipe_for_participant_calories(
            recipe,
            participants,
            Decimal('800'),
            'Dinner'
        )
        
        # Verify scaling worked
        assert 'scaled_ingredients' in result
        assert 'participant_calorie_distribution' in result
        
        # Check some participants
        distribution = result['participant_calorie_distribution']
        assert distribution[0]['calories'] == Decimal('1200.0000')  # Leader: 800 * 150%
        assert distribution[5]['calories'] == Decimal('600.0000')   # Child: 800 * 75%
        assert distribution[7]['calories'] == Decimal('480.0000')   # Late arrival: 800 * 100% * 0.6
    
    def test_integration_scale_then_adjust(self, scaler):
        """Test scaling a recipe then adjusting for changed participants."""
        recipe = {
            'servings': 4,
            'ingredients': [
                {'quantity': Decimal('400'), 'unit': 'g'},
                {'quantity': Decimal('200'), 'unit': 'ml'}
            ]
        }
        
        # Initial participants
        initial_participants = [
            {'coefficient': 100},
            {'coefficient': 100},
            {'coefficient': 75},
            {'coefficient': 75}
        ]
        
        # Scale recipe
        result1 = scaler.scale_recipe_for_participants(recipe, initial_participants)
        assert result1['effective_participants'] == Decimal('3.5000')
        
        # Someone drops out, someone new joins
        updated_participants = [
            {'coefficient': 100},
            {'coefficient': 100},
            {'coefficient': 75},
            # Removed one 75% participant
            {'coefficient': 125}  # Added athletic participant
        ]
        
        # Re-scale from original
        result2 = scaler.scale_recipe_for_participants(recipe, updated_participants)
        assert result2['effective_participants'] == Decimal('4.0000')
        
        # Quantities should be different
        assert result1['scaled_ingredients'][0]['quantity'] != result2['scaled_ingredients'][0]['quantity']