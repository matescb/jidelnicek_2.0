"""
Tests for recipe scaling edge case handling.
"""

import pytest
from decimal import Decimal

from jidelnicek.recipe.utils.scaling_edge_cases import (
    ScalingEdgeCaseHandler,
    EdgeCaseResult,
    handle_scaling_edge_cases
)


class TestScalingEdgeCaseHandler:
    """Test the ScalingEdgeCaseHandler class."""
    
    @pytest.fixture
    def handler(self):
        """Create an edge case handler instance."""
        return ScalingEdgeCaseHandler()
    
    def test_handle_zero_participants(self, handler):
        """Test handling of zero participants."""
        # Zero participants
        result = handler.handle_zero_participants(0, 4)
        assert result.handled
        assert result.modified_input['scaling_factor'] == Decimal('0')
        assert len(result.warnings) > 0
        assert "zero participants" in result.warnings[0].lower()
        
        # Non-zero participants (should not handle)
        result = handler.handle_zero_participants(5, 4)
        assert not result.handled
    
    def test_handle_fractional_servings(self, handler):
        """Test handling of fractional serving values."""
        # Fractional servings
        result = handler.handle_fractional_servings(3.7, 'servings')
        assert result.handled
        assert result.fallback_value == 4
        assert len(result.warnings) > 0
        assert "rounded" in result.warnings[0].lower()
        
        # Very small fraction rounds to 1
        result = handler.handle_fractional_servings(0.3, 'servings')
        assert result.handled
        assert result.fallback_value == 1
        
        # Whole number (should not handle)
        result = handler.handle_fractional_servings(5.0, 'servings')
        assert not result.handled
        
        # Invalid value
        result = handler.handle_fractional_servings("invalid", 'servings')
        assert result.handled
        assert result.error_message is not None
        assert result.fallback_value == handler.DEFAULT_SERVINGS
    
    def test_handle_missing_nutritional_data(self, handler):
        """Test handling of missing nutritional data."""
        # Missing nutritional data
        ingredient = {'name': 'Flour', 'quantity': Decimal('200'), 'unit': 'g'}
        result = handler.handle_missing_nutritional_data(ingredient)
        assert result.handled
        assert 'nutritional_data' in result.modified_input
        assert result.modified_input['nutritional_data']['calories'] == Decimal('0')
        assert len(result.warnings) > 0
        
        # Has nutritional data (should not handle)
        ingredient = {
            'name': 'Sugar',
            'nutritional_data': {'calories': Decimal('400')}
        }
        result = handler.handle_missing_nutritional_data(ingredient)
        assert not result.handled
    
    def test_handle_invalid_coefficient(self, handler):
        """Test handling of invalid participant coefficients."""
        # Too low
        result = handler.handle_invalid_coefficient(5, 'Child')
        assert result.handled
        assert result.fallback_value == 10
        assert "minimum" in result.warnings[0].lower()
        
        # Too high
        result = handler.handle_invalid_coefficient(350, 'Athlete')
        assert result.handled
        assert result.fallback_value == 300
        assert "maximum" in result.warnings[0].lower()
        
        # Fractional
        result = handler.handle_invalid_coefficient(75.5, 'Adult')
        assert result.handled
        assert result.fallback_value == 76
        assert "rounded" in result.warnings[0].lower()
        
        # Valid (should not handle)
        result = handler.handle_invalid_coefficient(100, 'Adult')
        assert not result.handled
        
        # Invalid type
        result = handler.handle_invalid_coefficient([100], 'Invalid')
        assert result.handled
        assert result.fallback_value == handler.DEFAULT_COEFFICIENT
        assert result.error_message is not None
    
    def test_handle_extreme_scaling_factor(self, handler):
        """Test handling of extreme scaling factors."""
        # Very large factor
        result = handler.handle_extreme_scaling_factor(Decimal('150'))
        assert result.handled
        assert result.fallback_value == Decimal('10')
        assert "extremely large" in result.warnings[0].lower()
        
        # Very small factor
        result = handler.handle_extreme_scaling_factor(Decimal('0.005'))
        assert result.handled
        assert result.fallback_value == Decimal('0.1')
        assert "extremely small" in result.warnings[0].lower()
        
        # Normal factor (should not handle)
        result = handler.handle_extreme_scaling_factor(Decimal('2.5'))
        assert not result.handled
        
        # Non-finite value
        result = handler.handle_extreme_scaling_factor(Decimal('Infinity'))
        assert result.handled
        assert result.error_message is not None
        assert result.fallback_value == Decimal('1')
    
    def test_handle_missing_ingredient_data(self, handler):
        """Test handling of ingredients with missing fields."""
        # Missing quantity
        ingredient = {'name': 'Salt', 'unit': 'g'}
        result = handler.handle_missing_ingredient_data(ingredient)
        assert result.handled
        assert result.modified_input['quantity'] == Decimal('0')
        assert any('missing quantity' in w.lower() for w in result.warnings)
        
        # Missing unit
        ingredient = {'name': 'Pepper', 'quantity': Decimal('1')}
        result = handler.handle_missing_ingredient_data(ingredient)
        assert result.handled
        assert result.modified_input['unit'] == 'unit'
        assert any('missing unit' in w.lower() for w in result.warnings)
        
        # Missing name
        ingredient = {'quantity': Decimal('100'), 'unit': 'ml'}
        result = handler.handle_missing_ingredient_data(ingredient)
        assert result.handled
        assert result.modified_input['name'] == 'Unknown Ingredient'
        assert any('unnamed' in w.lower() for w in result.warnings)
        
        # Complete ingredient (should not handle)
        ingredient = {'name': 'Water', 'quantity': Decimal('500'), 'unit': 'ml'}
        result = handler.handle_missing_ingredient_data(ingredient)
        assert not result.handled
    
    def test_handle_recipe_without_ingredients(self, handler):
        """Test handling of recipes with no ingredients."""
        # No ingredients
        recipe = {'name': 'Empty Recipe', 'servings': 4}
        result = handler.handle_recipe_without_ingredients(recipe)
        assert result.handled
        assert result.error_message is not None
        assert "no ingredients" in result.error_message.lower()
        
        # Empty ingredients list
        recipe = {'name': 'Empty Recipe', 'ingredients': []}
        result = handler.handle_recipe_without_ingredients(recipe)
        assert result.handled
        
        # Has ingredients (should not handle)
        recipe = {'ingredients': [{'name': 'Flour'}]}
        result = handler.handle_recipe_without_ingredients(recipe)
        assert not result.handled
    
    def test_handle_attendance_factor_edge_cases(self, handler):
        """Test handling of attendance factor edge cases."""
        # Negative factor
        result = handler.handle_attendance_factor_edge_cases(-0.5)
        assert result.handled
        assert result.fallback_value == Decimal('0')
        assert "negative" in result.warnings[0].lower()
        
        # Factor > 1
        result = handler.handle_attendance_factor_edge_cases(1.5)
        assert result.handled
        assert result.fallback_value == Decimal('1')
        assert "exceeds 1.0" in result.warnings[0].lower()
        
        # Valid factor (should not handle)
        result = handler.handle_attendance_factor_edge_cases(0.75)
        assert not result.handled
        
        # Invalid value
        result = handler.handle_attendance_factor_edge_cases("invalid")
        assert result.handled
        assert result.error_message is not None
        assert result.fallback_value == Decimal('1')
    
    def test_sanitize_scaling_request_basic(self, handler):
        """Test sanitizing basic scaling requests."""
        # Fractional servings
        request = {'target_servings': 4.3}
        sanitized, warnings = handler.sanitize_scaling_request(request, 'basic')
        assert sanitized['target_servings'] == 4
        assert len(warnings) > 0
        
        # Valid request
        request = {'target_servings': 6}
        sanitized, warnings = handler.sanitize_scaling_request(request, 'basic')
        assert sanitized == request
        assert len(warnings) == 0
    
    def test_sanitize_scaling_request_calorie(self, handler):
        """Test sanitizing calorie scaling requests."""
        # Negative calories
        request = {'target_calories': -100}
        sanitized, warnings = handler.sanitize_scaling_request(request, 'calorie')
        assert sanitized['target_calories'] == 100
        assert len(warnings) > 0
        
        # Invalid calories
        request = {'target_calories': 'invalid'}
        sanitized, warnings = handler.sanitize_scaling_request(request, 'calorie')
        assert sanitized['target_calories'] == 500
        assert "invalid calorie target" in warnings[0].lower()
    
    def test_sanitize_scaling_request_participant(self, handler):
        """Test sanitizing participant scaling requests."""
        # Missing names and coefficients
        request = {
            'participants': [
                {'coefficient': 120},
                {'name': 'Child'},
                {'name': 'Invalid', 'coefficient': -50}
            ]
        }
        sanitized, warnings = handler.sanitize_scaling_request(request, 'participant')
        
        # Check first participant got default name
        assert sanitized['participants'][0]['name'] == 'Participant 1'
        
        # Check second participant got default coefficient
        assert sanitized['participants'][1]['coefficient'] == 100
        
        # Check third participant's coefficient was adjusted
        assert sanitized['participants'][2]['coefficient'] == 10
        
        assert len(warnings) > 0
    
    def test_provide_graceful_degradation(self, handler):
        """Test graceful degradation on errors."""
        error = ValueError("Scaling calculation failed")
        context = {
            'recipe_id': '123',
            'recipe_name': 'Test Recipe',
            'original_servings': 4,
            'ingredients': [{'name': 'Flour', 'quantity': 200}]
        }
        
        result = handler.provide_graceful_degradation(error, context)
        
        assert result['recipe_id'] == '123'
        assert result['recipe_name'] == 'Test Recipe'
        assert result['scaling_factor'] == 1.0
        assert result['degraded'] is True
        assert len(result['warnings']) > 0
        assert result['error'] == str(error)
        assert result['ingredients'] == context['ingredients']


class TestHandleScalingEdgeCases:
    """Test the convenience function."""
    
    def test_handle_zero_participants(self):
        """Test handling zero participants via convenience function."""
        data = {'target_participants': 0, 'original_servings': 4}
        modified, warnings, error = handle_scaling_edge_cases('zero_participants', data)
        
        assert 'scaling_factor' in modified
        assert modified['scaling_factor'] == Decimal('0')
        assert len(warnings) > 0
        assert error is None
    
    def test_handle_fractional_servings(self):
        """Test handling fractional servings via convenience function."""
        data = {'servings': 2.7}
        modified, warnings, error = handle_scaling_edge_cases('fractional_servings', data)
        
        assert modified.get('target_servings') == 3
        assert len(warnings) > 0
        assert error is None
    
    def test_handle_missing_nutrition(self):
        """Test handling missing nutrition via convenience function."""
        data = {'name': 'Sugar', 'quantity': 100}
        modified, warnings, error = handle_scaling_edge_cases('missing_nutrition', data)
        
        assert 'nutritional_data' in modified
        assert len(warnings) > 0
        assert error is None
    
    def test_sanitize_request(self):
        """Test sanitizing requests via convenience function."""
        data = {
            'request': {'target_servings': 3.3},
            'request_type': 'basic'
        }
        sanitized, warnings, error = handle_scaling_edge_cases('sanitize_request', data)
        
        assert sanitized['target_servings'] == 3
        assert len(warnings) > 0
        assert error is None
    
    def test_graceful_degradation(self):
        """Test graceful degradation via convenience function."""
        data = {
            'error': RuntimeError("Calculation failed"),
            'context': {
                'recipe_id': '456',
                'recipe_name': 'Failed Recipe',
                'original_servings': 6
            }
        }
        fallback, warnings, error = handle_scaling_edge_cases('graceful_degradation', data)
        
        assert fallback['degraded'] is True
        assert fallback['scaling_factor'] == 1.0
        assert len(warnings) > 0
        assert error is None
    
    def test_unknown_edge_case_type(self):
        """Test handling unknown edge case type."""
        data = {'some': 'data'}
        result, warnings, error = handle_scaling_edge_cases('unknown_type', data)
        
        assert result == data
        assert len(warnings) == 0
        assert error is not None
        assert "Unknown edge case type" in error