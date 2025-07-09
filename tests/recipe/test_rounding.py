"""Tests for the intelligent recipe rounding utilities."""

import pytest
from decimal import Decimal

from jidelnicek.recipe.utils.rounding import SmartRounder, CustomizableSmartRounder
from jidelnicek.recipe.utils.scaling import RecipeScaler


class TestSmartRounder:
    """Test suite for the SmartRounder class."""
    
    @pytest.fixture
    def rounder(self):
        """Create a SmartRounder instance for testing."""
        return SmartRounder()
    
    # Tests for weight rounding
    
    def test_weight_rounding_small_amounts(self, rounder):
        """Test rounding for small weight amounts (<10g)."""
        # Round to 1g increments
        assert rounder.round_quantity(Decimal('0.1'), 'g') == Decimal('1')
        assert rounder.round_quantity(Decimal('3.2'), 'g') == Decimal('4')
        assert rounder.round_quantity(Decimal('7.8'), 'g') == Decimal('8')
        assert rounder.round_quantity(Decimal('9.1'), 'g') == Decimal('10')
    
    def test_weight_rounding_medium_amounts(self, rounder):
        """Test rounding for medium weight amounts (10-100g)."""
        # Round to 5g increments
        assert rounder.round_quantity(Decimal('12.3'), 'g') == Decimal('15')
        assert rounder.round_quantity(Decimal('47'), 'g') == Decimal('50')
        assert rounder.round_quantity(Decimal('73.7'), 'g') == Decimal('75')
        assert rounder.round_quantity(Decimal('98.2'), 'g') == Decimal('100')
    
    def test_weight_rounding_large_amounts(self, rounder):
        """Test rounding for large weight amounts (100-1000g)."""
        # Round to 10g increments
        assert rounder.round_quantity(Decimal('123'), 'g') == Decimal('130')
        assert rounder.round_quantity(Decimal('456.7'), 'g') == Decimal('460')
        assert rounder.round_quantity(Decimal('789.2'), 'g') == Decimal('790')
        assert rounder.round_quantity(Decimal('995'), 'g') == Decimal('1000')
    
    def test_weight_rounding_very_large_amounts(self, rounder):
        """Test rounding for very large weight amounts (>1000g)."""
        # Round to 50g increments
        assert rounder.round_quantity(Decimal('1234'), 'g') == Decimal('1250')
        assert rounder.round_quantity(Decimal('2567'), 'g') == Decimal('2600')
        assert rounder.round_quantity(Decimal('5001'), 'g') == Decimal('5050')
        assert rounder.round_quantity(Decimal('9999'), 'g') == Decimal('10000')
    
    def test_weight_rounding_kilograms(self, rounder):
        """Test rounding for kilogram units."""
        # Should convert to grams, round, then convert back
        assert rounder.round_quantity(Decimal('0.123'), 'kg') == Decimal('0.125')  # 123g -> 125g
        assert rounder.round_quantity(Decimal('1.234'), 'kg') == Decimal('1.250')  # 1234g -> 1250g
        assert rounder.round_quantity(Decimal('0.007'), 'kg') == Decimal('0.008')  # 7g -> 8g
    
    # Tests for volume rounding
    
    def test_volume_rounding_small_amounts(self, rounder):
        """Test rounding for small volume amounts (<50ml)."""
        # Round to 5ml increments
        assert rounder.round_quantity(Decimal('3.2'), 'ml') == Decimal('5')
        assert rounder.round_quantity(Decimal('17.8'), 'ml') == Decimal('20')
        assert rounder.round_quantity(Decimal('42.1'), 'ml') == Decimal('45')
        assert rounder.round_quantity(Decimal('48'), 'ml') == Decimal('50')
    
    def test_volume_rounding_medium_amounts(self, rounder):
        """Test rounding for medium volume amounts (50-250ml)."""
        # Round to 10ml increments
        assert rounder.round_quantity(Decimal('57'), 'ml') == Decimal('60')
        assert rounder.round_quantity(Decimal('123.4'), 'ml') == Decimal('130')
        assert rounder.round_quantity(Decimal('187.2'), 'ml') == Decimal('190')
        assert rounder.round_quantity(Decimal('241'), 'ml') == Decimal('250')
    
    def test_volume_rounding_large_amounts(self, rounder):
        """Test rounding for large volume amounts (250-1000ml)."""
        # Round to 25ml increments
        assert rounder.round_quantity(Decimal('267'), 'ml') == Decimal('275')
        assert rounder.round_quantity(Decimal('512.3'), 'ml') == Decimal('525')
        assert rounder.round_quantity(Decimal('789'), 'ml') == Decimal('800')
        assert rounder.round_quantity(Decimal('987'), 'ml') == Decimal('1000')
    
    def test_volume_rounding_very_large_amounts(self, rounder):
        """Test rounding for very large volume amounts (>1000ml)."""
        # Round to 50ml increments
        assert rounder.round_quantity(Decimal('1234'), 'ml') == Decimal('1250')
        assert rounder.round_quantity(Decimal('2567'), 'ml') == Decimal('2600')
        assert rounder.round_quantity(Decimal('5001'), 'ml') == Decimal('5050')
    
    def test_volume_rounding_liters(self, rounder):
        """Test rounding for liter units."""
        # Should convert to ml, round, then convert back
        assert rounder.round_quantity(Decimal('0.237'), 'l') == Decimal('0.240')  # 237ml -> 240ml
        assert rounder.round_quantity(Decimal('1.512'), 'l') == Decimal('1.525')  # 1512ml -> 1525ml
        assert rounder.round_quantity(Decimal('0.043'), 'l') == Decimal('0.045')  # 43ml -> 45ml
    
    # Tests for special units
    
    def test_fractional_units_rounding(self, rounder):
        """Test rounding for fractional units (tbsp, tsp, cup)."""
        # Round to 0.25 increments
        assert rounder.round_quantity(Decimal('1.1'), 'tbsp') == Decimal('1.25')
        assert rounder.round_quantity(Decimal('1.3'), 'tsp') == Decimal('1.5')
        assert rounder.round_quantity(Decimal('0.6'), 'cup') == Decimal('0.75')
        assert rounder.round_quantity(Decimal('2.8'), 'tbsp') == Decimal('3')
        assert rounder.round_quantity(Decimal('0.24'), 'tsp') == Decimal('0.25')
    
    def test_countable_units_rounding(self, rounder):
        """Test rounding for countable units (pieces, eggs)."""
        # Always round to whole numbers
        assert rounder.round_quantity(Decimal('1.1'), 'piece') == Decimal('2')
        assert rounder.round_quantity(Decimal('2.9'), 'pieces') == Decimal('3')
        assert rounder.round_quantity(Decimal('3.1'), 'egg') == Decimal('4')
        assert rounder.round_quantity(Decimal('0.3'), 'eggs') == Decimal('1')
        assert rounder.round_quantity(Decimal('5.5'), 'clove') == Decimal('6')
        assert rounder.round_quantity(Decimal('1.01'), 'cloves') == Decimal('2')
    
    def test_fine_precision_units_rounding(self, rounder):
        """Test rounding for fine precision units (pinch, dash)."""
        # Round to 0.1 increments
        assert rounder.round_quantity(Decimal('0.12'), 'pinch') == Decimal('0.2')
        assert rounder.round_quantity(Decimal('0.67'), 'dash') == Decimal('0.7')
        assert rounder.round_quantity(Decimal('1.23'), 'pinch') == Decimal('1.3')
        assert rounder.round_quantity(Decimal('0.01'), 'dash') == Decimal('0.1')
    
    # Tests for edge cases
    
    def test_zero_quantity(self, rounder):
        """Test handling of zero quantities."""
        assert rounder.round_quantity(Decimal('0'), 'g') == Decimal('0')
        assert rounder.round_quantity(Decimal('0'), 'ml') == Decimal('0')
        assert rounder.round_quantity(Decimal('0'), 'piece') == Decimal('0')
    
    def test_negative_quantity(self, rounder):
        """Test handling of negative quantities."""
        assert rounder.round_quantity(Decimal('-5'), 'g') == Decimal('0')
        assert rounder.round_quantity(Decimal('-10'), 'ml') == Decimal('0')
    
    def test_very_small_quantities(self, rounder):
        """Test handling of very small quantities."""
        assert rounder.round_quantity(Decimal('0.001'), 'g') == Decimal('1')
        assert rounder.round_quantity(Decimal('0.0001'), 'tsp') == Decimal('0.25')
        assert rounder.round_quantity(Decimal('0.01'), 'piece') == Decimal('1')
    
    def test_case_insensitive_units(self, rounder):
        """Test that units are handled case-insensitively."""
        assert rounder.round_quantity(Decimal('7.3'), 'G') == Decimal('8')
        assert rounder.round_quantity(Decimal('7.3'), 'ML') == Decimal('10')
        assert rounder.round_quantity(Decimal('1.3'), 'TBSP') == Decimal('1.5')
        assert rounder.round_quantity(Decimal('2.3'), 'Piece') == Decimal('3')
    
    def test_unknown_units(self, rounder):
        """Test handling of unknown units."""
        # Should default to 1 decimal place
        assert rounder.round_quantity(Decimal('1.23'), 'unknown') == Decimal('1.3')
        assert rounder.round_quantity(Decimal('5.67'), 'mystery_unit') == Decimal('5.7')
    
    def test_ingredient_type_spice(self, rounder):
        """Test special handling for spice ingredients."""
        # Very small amounts
        assert rounder.round_quantity(Decimal('0.23'), 'g', 'spice') == Decimal('0.3')
        assert rounder.round_quantity(Decimal('0.67'), 'g', 'spice') == Decimal('0.7')
        
        # Small amounts
        assert rounder.round_quantity(Decimal('1.3'), 'g', 'spice') == Decimal('1.5')
        assert rounder.round_quantity(Decimal('3.7'), 'g', 'spice') == Decimal('4')
        
        # Larger amounts
        assert rounder.round_quantity(Decimal('7.3'), 'g', 'spice') == Decimal('8')
        assert rounder.round_quantity(Decimal('12.4'), 'g', 'spice') == Decimal('13')
    
    # Tests for get_rounding_rules
    
    def test_get_rounding_rules(self, rounder):
        """Test retrieving the rounding rules configuration."""
        rules = rounder.get_rounding_rules()
        
        assert 'weight_rules' in rules
        assert 'volume_rules' in rules
        assert 'fractional_units' in rules
        assert 'countable_units' in rules
        assert 'fine_precision_units' in rules
        
        # Check weight rules structure
        assert len(rules['weight_rules']) == 4
        assert rules['weight_rules'][0]['max'] == 10
        assert rules['weight_rules'][0]['increment'] == 1
        assert rules['weight_rules'][-1]['max'] == 'infinity'
        
        # Check fractional units
        assert 'tbsp' in rules['fractional_units']['units']
        assert rules['fractional_units']['increment'] == 0.25
    
    # Tests for round_recipe_ingredients
    
    def test_round_recipe_ingredients_basic(self, rounder):
        """Test rounding a list of ingredients."""
        ingredients = [
            {'name': 'Flour', 'quantity': Decimal('237'), 'unit': 'g'},
            {'name': 'Eggs', 'quantity': Decimal('2.3'), 'unit': 'piece'},
            {'name': 'Vanilla', 'quantity': Decimal('1.6'), 'unit': 'tsp'},
            {'name': 'Milk', 'quantity': Decimal('187'), 'unit': 'ml'}
        ]
        
        rounded = rounder.round_recipe_ingredients(ingredients)
        
        assert len(rounded) == 4
        assert rounded[0]['quantity'] == Decimal('240')  # 237g -> 240g
        assert rounded[1]['quantity'] == Decimal('3')    # 2.3 pieces -> 3
        assert rounded[2]['quantity'] == Decimal('1.75') # 1.6 tsp -> 1.75
        assert rounded[3]['quantity'] == Decimal('190')  # 187ml -> 190ml
        
        # Check metadata
        assert rounded[0]['was_rounded'] == True
        assert rounded[0]['original_quantity'] == Decimal('237')
    
    def test_round_recipe_ingredients_with_types(self, rounder):
        """Test rounding ingredients with type hints."""
        ingredients = [
            {'name': 'Salt', 'quantity': Decimal('2.3'), 'unit': 'g', 'ingredient_type': 'spice'},
            {'name': 'Pepper', 'quantity': Decimal('0.7'), 'unit': 'g', 'ingredient_type': 'spice'},
            {'name': 'Chicken', 'quantity': Decimal('567'), 'unit': 'g'}
        ]
        
        rounded = rounder.round_recipe_ingredients(ingredients)
        
        assert rounded[0]['quantity'] == Decimal('2.5')   # Spice: 2.3g -> 2.5g
        assert rounded[1]['quantity'] == Decimal('0.8')   # Spice: 0.7g -> 0.8g
        assert rounded[2]['quantity'] == Decimal('570')   # Regular: 567g -> 570g
    
    def test_round_recipe_ingredients_preserves_fields(self, rounder):
        """Test that rounding preserves other ingredient fields."""
        ingredients = [
            {
                'name': 'Sugar',
                'quantity': Decimal('123'),
                'unit': 'g',
                'nutritional_data': {'calories': 387},
                'custom_field': 'value'
            }
        ]
        
        rounded = rounder.round_recipe_ingredients(ingredients)
        
        assert rounded[0]['name'] == 'Sugar'
        assert rounded[0]['nutritional_data'] == {'calories': 387}
        assert rounded[0]['custom_field'] == 'value'
    
    def test_round_recipe_ingredients_invalid_data(self, rounder):
        """Test error handling for invalid ingredient data."""
        # Not a list
        with pytest.raises(ValueError) as exc_info:
            rounder.round_recipe_ingredients('not a list')
        assert "must be a list" in str(exc_info.value)
        
        # Not a dictionary
        with pytest.raises(ValueError) as exc_info:
            rounder.round_recipe_ingredients(['not a dict'])
        assert "must be a dictionary" in str(exc_info.value)
        
        # Missing quantity
        with pytest.raises(ValueError) as exc_info:
            rounder.round_recipe_ingredients([{'unit': 'g'}])
        assert "missing 'quantity' field" in str(exc_info.value)
        
        # Missing unit
        with pytest.raises(ValueError) as exc_info:
            rounder.round_recipe_ingredients([{'quantity': 100}])
        assert "missing 'unit' field" in str(exc_info.value)


class TestCustomizableSmartRounder:
    """Test suite for the CustomizableSmartRounder class."""
    
    @pytest.fixture
    def custom_rounder(self):
        """Create a CustomizableSmartRounder instance for testing."""
        return CustomizableSmartRounder()
    
    def test_custom_weight_rule(self, custom_rounder):
        """Test adding custom weight rounding rules."""
        # Add a rule for 50-100g with 2g increments
        custom_rounder.set_weight_rule(Decimal('50'), Decimal('2'))
        
        # Test that it's applied
        assert custom_rounder.round_quantity(Decimal('47.3'), 'g') == Decimal('48')  # 2g increments
        assert custom_rounder.round_quantity(Decimal('73.1'), 'g') == Decimal('74')  # 2g increments
        
        # Original rules still apply outside the range
        assert custom_rounder.round_quantity(Decimal('7.3'), 'g') == Decimal('8')    # 1g increments
        assert custom_rounder.round_quantity(Decimal('123'), 'g') == Decimal('130')  # 10g increments
    
    def test_custom_volume_rule(self, custom_rounder):
        """Test adding custom volume rounding rules."""
        # Add a rule for 100-200ml with 5ml increments
        custom_rounder.set_volume_rule(Decimal('200'), Decimal('5'))
        
        # Test that it's applied
        assert custom_rounder.round_quantity(Decimal('123'), 'ml') == Decimal('125')
        assert custom_rounder.round_quantity(Decimal('187'), 'ml') == Decimal('190')
    
    def test_add_custom_unit_fractional(self, custom_rounder):
        """Test adding a custom fractional unit."""
        custom_rounder.add_custom_unit('scoop', Decimal('0.5'), 'fractional')
        
        assert custom_rounder.round_quantity(Decimal('1.3'), 'scoop') == Decimal('1.5')
        assert custom_rounder.round_quantity(Decimal('2.7'), 'scoop') == Decimal('3')
    
    def test_add_custom_unit_countable(self, custom_rounder):
        """Test adding a custom countable unit."""
        custom_rounder.add_custom_unit('tablet', Decimal('1'), 'countable')
        
        assert custom_rounder.round_quantity(Decimal('1.1'), 'tablet') == Decimal('2')
        assert custom_rounder.round_quantity(Decimal('3.9'), 'tablet') == Decimal('4')
    
    def test_add_custom_unit_fine_precision(self, custom_rounder):
        """Test adding a custom fine precision unit."""
        custom_rounder.add_custom_unit('drop', Decimal('0.05'), 'fine_precision')
        
        assert custom_rounder.round_quantity(Decimal('0.12'), 'drop') == Decimal('0.15')
        assert custom_rounder.round_quantity(Decimal('0.67'), 'drop') == Decimal('0.70')
    
    def test_invalid_unit_type(self, custom_rounder):
        """Test error handling for invalid unit types."""
        with pytest.raises(ValueError) as exc_info:
            custom_rounder.add_custom_unit('invalid', Decimal('1'), 'unknown_type')
        assert "Unknown unit type" in str(exc_info.value)


class TestRecipeScalerWithRounding:
    """Test suite for RecipeScaler with rounding enabled."""
    
    @pytest.fixture
    def scaler_with_rounding(self):
        """Create a RecipeScaler with rounding enabled."""
        return RecipeScaler(use_rounding=True)
    
    @pytest.fixture
    def scaler_without_rounding(self):
        """Create a RecipeScaler without rounding."""
        return RecipeScaler(use_rounding=False)
    
    def test_scale_and_round_recipe_basic(self, scaler_with_rounding):
        """Test basic recipe scaling with rounding."""
        ingredients = [
            {'name': 'Flour', 'quantity': Decimal('200'), 'unit': 'g'},
            {'name': 'Sugar', 'quantity': Decimal('100'), 'unit': 'g'},
            {'name': 'Eggs', 'quantity': Decimal('2'), 'unit': 'piece'},
            {'name': 'Vanilla', 'quantity': Decimal('1'), 'unit': 'tsp'}
        ]
        
        # Scale from 4 to 6 servings (1.5x)
        factor, scaled = scaler_with_rounding.scale_and_round_recipe(4, 6, ingredients)
        
        assert factor == Decimal('1.5000')
        
        # Check scaled and rounded quantities
        assert scaled[0]['quantity'] == Decimal('300')   # 300g -> 300g (already round)
        assert scaled[1]['quantity'] == Decimal('150')   # 150g -> 150g (already round)
        assert scaled[2]['quantity'] == Decimal('3')     # 3 pieces -> 3 (already whole)
        assert scaled[3]['quantity'] == Decimal('1.5')   # 1.5 tsp -> 1.5 (already at 0.25)
        
        # Check metadata
        for ingredient in scaled:
            assert 'original_quantity' in ingredient
            assert 'scaled_quantity' in ingredient
    
    def test_scale_and_round_recipe_with_rounding_needed(self, scaler_with_rounding):
        """Test scaling where rounding makes a difference."""
        ingredients = [
            {'name': 'Flour', 'quantity': Decimal('175'), 'unit': 'g'},
            {'name': 'Milk', 'quantity': Decimal('225'), 'unit': 'ml'},
            {'name': 'Eggs', 'quantity': Decimal('1.5'), 'unit': 'piece'},
            {'name': 'Oil', 'quantity': Decimal('2.5'), 'unit': 'tbsp'}
        ]
        
        # Scale from 4 to 5 servings (1.25x)
        factor, scaled = scaler_with_rounding.scale_and_round_recipe(4, 5, ingredients)
        
        assert factor == Decimal('1.2500')
        
        # Check scaled and rounded quantities
        assert scaled[0]['quantity'] == Decimal('220')    # 218.75g -> 220g
        assert scaled[1]['quantity'] == Decimal('290')    # 281.25ml -> 290ml
        assert scaled[2]['quantity'] == Decimal('2')      # 1.875 pieces -> 2
        assert scaled[3]['quantity'] == Decimal('3.25')   # 3.125 tbsp -> 3.25
        
        # Check rounding metadata
        assert scaled[0]['was_rounded'] == True
        assert scaled[1]['was_rounded'] == True
        assert scaled[2]['was_rounded'] == True
        assert scaled[3]['was_rounded'] == True
    
    def test_scale_and_round_recipe_scale_down(self, scaler_with_rounding):
        """Test scaling down with rounding."""
        ingredients = [
            {'name': 'Flour', 'quantity': Decimal('400'), 'unit': 'g'},
            {'name': 'Water', 'quantity': Decimal('500'), 'unit': 'ml'},
            {'name': 'Eggs', 'quantity': Decimal('4'), 'unit': 'piece'}
        ]
        
        # Scale from 8 to 3 servings (0.375x)
        factor, scaled = scaler_with_rounding.scale_and_round_recipe(8, 3, ingredients)
        
        assert factor == Decimal('0.3750')
        
        # Check scaled and rounded quantities
        assert scaled[0]['quantity'] == Decimal('150')    # 150g -> 150g (already round)
        assert scaled[1]['quantity'] == Decimal('190')    # 187.5ml -> 190ml
        assert scaled[2]['quantity'] == Decimal('2')      # 1.5 pieces -> 2
    
    def test_scale_and_round_recipe_with_spices(self, scaler_with_rounding):
        """Test scaling with spice ingredients."""
        ingredients = [
            {'name': 'Salt', 'quantity': Decimal('5'), 'unit': 'g', 'ingredient_type': 'spice'},
            {'name': 'Pepper', 'quantity': Decimal('2'), 'unit': 'g', 'ingredient_type': 'spice'},
            {'name': 'Paprika', 'quantity': Decimal('8'), 'unit': 'g', 'ingredient_type': 'spice'}
        ]
        
        # Scale from 4 to 6 servings (1.5x)
        factor, scaled = scaler_with_rounding.scale_and_round_recipe(4, 6, ingredients)
        
        # Spices should use finer rounding
        assert scaled[0]['quantity'] == Decimal('8')      # 7.5g -> 8g (1g increments for 5-10g spice)
        assert scaled[1]['quantity'] == Decimal('3')      # 3g -> 3g (already round)
        assert scaled[2]['quantity'] == Decimal('12')     # 12g -> 12g (already round)
    
    def test_scale_without_rounding(self, scaler_without_rounding):
        """Test that scaling without rounding preserves exact values."""
        ingredients = [
            {'name': 'Flour', 'quantity': Decimal('175'), 'unit': 'g'},
            {'name': 'Eggs', 'quantity': Decimal('1.5'), 'unit': 'piece'}
        ]
        
        # Scale from 4 to 5 servings (1.25x)
        factor, scaled = scaler_without_rounding.scale_and_round_recipe(4, 5, ingredients)
        
        # Should keep exact scaled values
        assert scaled[0]['quantity'] == Decimal('218.7500')
        assert scaled[1]['quantity'] == Decimal('1.8750')
        
        # No rounding metadata
        assert 'was_rounded' not in scaled[0]
        assert 'was_rounded' not in scaled[1]
    
    def test_scale_and_round_recipe_preserves_extra_fields(self, scaler_with_rounding):
        """Test that extra fields are preserved during scaling and rounding."""
        ingredients = [
            {
                'name': 'Flour',
                'quantity': Decimal('200'),
                'unit': 'g',
                'nutritional_data': {'calories': 364},
                'notes': 'All-purpose flour',
                'optional': False
            }
        ]
        
        factor, scaled = scaler_with_rounding.scale_and_round_recipe(4, 6, ingredients)
        
        # All fields should be preserved
        assert scaled[0]['name'] == 'Flour'
        assert scaled[0]['nutritional_data'] == {'calories': 364}
        assert scaled[0]['notes'] == 'All-purpose flour'
        assert scaled[0]['optional'] == False
    
    def test_scale_and_round_recipe_invalid_data(self, scaler_with_rounding):
        """Test error handling for invalid ingredient data."""
        # Not a dictionary in list
        with pytest.raises(ValueError) as exc_info:
            scaler_with_rounding.scale_and_round_recipe(4, 6, ['not a dict'])
        assert "must be a dictionary" in str(exc_info.value)
        
        # Missing quantity
        with pytest.raises(ValueError) as exc_info:
            scaler_with_rounding.scale_and_round_recipe(4, 6, [{'unit': 'g'}])
        assert "missing 'quantity' field" in str(exc_info.value)
        
        # Missing unit
        with pytest.raises(ValueError) as exc_info:
            scaler_with_rounding.scale_and_round_recipe(4, 6, [{'quantity': 100}])
        assert "missing 'unit' field" in str(exc_info.value)


class TestRoundingIntegration:
    """Integration tests for rounding with scaling."""
    
    def test_practical_recipe_example(self):
        """Test a complete practical recipe scaling example."""
        # Recipe for chocolate chip cookies (makes 24)
        recipe_ingredients = [
            {'name': 'All-purpose flour', 'quantity': Decimal('280'), 'unit': 'g'},
            {'name': 'Butter', 'quantity': Decimal('225'), 'unit': 'g'},
            {'name': 'Brown sugar', 'quantity': Decimal('200'), 'unit': 'g'},
            {'name': 'White sugar', 'quantity': Decimal('150'), 'unit': 'g'},
            {'name': 'Eggs', 'quantity': Decimal('2'), 'unit': 'piece'},
            {'name': 'Vanilla extract', 'quantity': Decimal('2'), 'unit': 'tsp'},
            {'name': 'Baking soda', 'quantity': Decimal('1'), 'unit': 'tsp'},
            {'name': 'Salt', 'quantity': Decimal('1'), 'unit': 'tsp'},
            {'name': 'Chocolate chips', 'quantity': Decimal('340'), 'unit': 'g'}
        ]
        
        # Scale to make 36 cookies (1.5x)
        scaler = RecipeScaler(use_rounding=True)
        factor, scaled = scaler.scale_and_round_recipe(24, 36, recipe_ingredients)
        
        # Check practical results
        assert scaled[0]['quantity'] == Decimal('420')    # Flour: 420g (nice round number)
        assert scaled[1]['quantity'] == Decimal('340')    # Butter: 337.5g -> 340g
        assert scaled[2]['quantity'] == Decimal('300')    # Brown sugar: 300g (already round)
        assert scaled[3]['quantity'] == Decimal('225')    # White sugar: 225g (already round)
        assert scaled[4]['quantity'] == Decimal('3')      # Eggs: 3 (whole number)
        assert scaled[5]['quantity'] == Decimal('3')      # Vanilla: 3 tsp (already round)
        assert scaled[6]['quantity'] == Decimal('1.5')    # Baking soda: 1.5 tsp
        assert scaled[7]['quantity'] == Decimal('1.5')    # Salt: 1.5 tsp
        assert scaled[8]['quantity'] == Decimal('510')    # Chocolate: 510g
    
    def test_metric_to_imperial_friendly_rounding(self):
        """Test that rounding produces measurement-friendly results."""
        # Recipe with awkward metric measurements
        ingredients = [
            {'name': 'Flour', 'quantity': Decimal('473'), 'unit': 'ml'},      # ~2 cups
            {'name': 'Sugar', 'quantity': Decimal('237'), 'unit': 'ml'},      # ~1 cup
            {'name': 'Butter', 'quantity': Decimal('118'), 'unit': 'ml'},     # ~1/2 cup
            {'name': 'Milk', 'quantity': Decimal('59'), 'unit': 'ml'},        # ~1/4 cup
            {'name': 'Vanilla', 'quantity': Decimal('4.9'), 'unit': 'ml'},    # ~1 tsp
            {'name': 'Salt', 'quantity': Decimal('2.5'), 'unit': 'ml'}        # ~1/2 tsp
        ]
        
        rounder = SmartRounder()
        rounded = rounder.round_recipe_ingredients(ingredients)
        
        # Should round to practical measurements
        assert rounded[0]['quantity'] == Decimal('475')    # Close to 2 cups
        assert rounded[1]['quantity'] == Decimal('240')    # Close to 1 cup
        assert rounded[2]['quantity'] == Decimal('120')    # Close to 1/2 cup
        assert rounded[3]['quantity'] == Decimal('60')     # Close to 1/4 cup
        assert rounded[4]['quantity'] == Decimal('5')      # 1 tsp
        assert rounded[5]['quantity'] == Decimal('5')      # Rounded up for safety
    
    def test_safety_always_rounds_up(self):
        """Test that rounding always goes up for safety."""
        rounder = SmartRounder()
        
        # Test various scenarios where rounding up is important
        test_cases = [
            (Decimal('99.1'), 'g', Decimal('100')),     # Just over threshold
            (Decimal('249.1'), 'ml', Decimal('250')),   # Just over threshold
            (Decimal('0.9'), 'piece', Decimal('1')),    # Almost 1 piece
            (Decimal('0.01'), 'tsp', Decimal('0.25')),  # Minimum measurement
            (Decimal('0.1'), 'g', Decimal('1')),        # Minimum weight
        ]
        
        for quantity, unit, expected in test_cases:
            result = rounder.round_quantity(quantity, unit)
            assert result == expected, f"Failed for {quantity} {unit}: got {result}, expected {expected}"
            assert result >= quantity, f"Rounding down occurred for {quantity} {unit}"