"""
Simple tests for recipe scaling edge case handling without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.recipe.utils.scaling_edge_cases import (
    ScalingEdgeCaseHandler,
    handle_scaling_edge_cases
)


def test_edge_case_handler_creation():
    """Test that edge case handler can be created."""
    handler = ScalingEdgeCaseHandler()
    assert handler is not None
    print("✓ Edge case handler creation test passed")


def test_zero_participants():
    """Test handling of zero participants."""
    handler = ScalingEdgeCaseHandler()
    
    result = handler.handle_zero_participants(0, 4)
    assert result.handled
    assert result.modified_input['scaling_factor'] == Decimal('0')
    assert len(result.warnings) > 0
    
    print("✓ Zero participants test passed")


def test_fractional_servings():
    """Test handling of fractional servings."""
    handler = ScalingEdgeCaseHandler()
    
    result = handler.handle_fractional_servings(3.7, 'servings')
    assert result.handled
    assert result.fallback_value == 4
    
    print("✓ Fractional servings test passed")


def test_missing_nutritional_data():
    """Test handling of missing nutritional data."""
    handler = ScalingEdgeCaseHandler()
    
    ingredient = {'name': 'Flour', 'quantity': Decimal('200'), 'unit': 'g'}
    result = handler.handle_missing_nutritional_data(ingredient)
    assert result.handled
    assert 'nutritional_data' in result.modified_input
    
    print("✓ Missing nutritional data test passed")


def test_invalid_coefficient():
    """Test handling of invalid coefficients."""
    handler = ScalingEdgeCaseHandler()
    
    # Too low
    result = handler.handle_invalid_coefficient(5, 'Child')
    assert result.handled
    assert result.fallback_value == 10
    
    # Too high
    result = handler.handle_invalid_coefficient(350, 'Athlete')
    assert result.handled
    assert result.fallback_value == 300
    
    print("✓ Invalid coefficient test passed")


def test_extreme_scaling_factor():
    """Test handling of extreme scaling factors."""
    handler = ScalingEdgeCaseHandler()
    
    # Very large
    result = handler.handle_extreme_scaling_factor(Decimal('150'))
    assert result.handled
    assert result.fallback_value == Decimal('10')
    
    # Very small
    result = handler.handle_extreme_scaling_factor(Decimal('0.005'))
    assert result.handled
    assert result.fallback_value == Decimal('0.1')
    
    print("✓ Extreme scaling factor test passed")


def test_sanitize_request():
    """Test request sanitization."""
    handler = ScalingEdgeCaseHandler()
    
    # Fractional servings
    request = {'target_servings': 4.3}
    sanitized, warnings = handler.sanitize_scaling_request(request, 'basic')
    assert sanitized['target_servings'] == 4
    assert len(warnings) > 0
    
    # Invalid participant coefficient
    request = {
        'participants': [
            {'name': 'Test', 'coefficient': -50}
        ]
    }
    sanitized, warnings = handler.sanitize_scaling_request(request, 'participant')
    assert sanitized['participants'][0]['coefficient'] == 10
    
    print("✓ Request sanitization test passed")


def test_graceful_degradation():
    """Test graceful degradation."""
    handler = ScalingEdgeCaseHandler()
    
    error = ValueError("Test error")
    context = {
        'recipe_id': '123',
        'recipe_name': 'Test Recipe',
        'original_servings': 4
    }
    
    result = handler.provide_graceful_degradation(error, context)
    assert result['degraded'] is True
    assert result['scaling_factor'] == 1.0
    assert len(result['warnings']) > 0
    
    print("✓ Graceful degradation test passed")


def test_convenience_function():
    """Test the convenience function."""
    # Zero participants
    data = {'target_participants': 0, 'original_servings': 4}
    modified, warnings, error = handle_scaling_edge_cases('zero_participants', data)
    assert 'scaling_factor' in modified
    assert len(warnings) > 0
    
    # Unknown type
    data = {'some': 'data'}
    result, warnings, error = handle_scaling_edge_cases('unknown_type', data)
    assert error is not None
    assert "Unknown edge case type" in error
    
    print("✓ Convenience function test passed")


if __name__ == '__main__':
    print("Running scaling edge case handler tests...\n")
    
    test_edge_case_handler_creation()
    test_zero_participants()
    test_fractional_servings()
    test_missing_nutritional_data()
    test_invalid_coefficient()
    test_extreme_scaling_factor()
    test_sanitize_request()
    test_graceful_degradation()
    test_convenience_function()
    
    print("\n✅ All edge case tests passed!")