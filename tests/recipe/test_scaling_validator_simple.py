"""
Simple tests for recipe scaling validation without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.recipe.utils.scaling_validator import (
    ScalingValidator,
    ValidationResult,
    validate_scaling_operation
)


def test_validator_creation():
    """Test that validator can be created."""
    validator = ScalingValidator()
    assert validator is not None
    print("✓ Validator creation test passed")


def test_validate_scaling_factor():
    """Test scaling factor validation."""
    validator = ScalingValidator()
    
    # Valid factor
    result = validator.validate_scaling_factor(Decimal('1.5'))
    assert result.is_valid
    assert len(result.errors) == 0
    
    # Invalid factor
    result = validator.validate_scaling_factor(Decimal('-1'))
    assert not result.is_valid
    assert len(result.errors) > 0
    
    print("✓ Scaling factor validation test passed")


def test_validate_servings():
    """Test servings validation."""
    validator = ScalingValidator()
    
    # Valid servings
    result = validator.validate_servings(4, 6)
    assert result.is_valid
    
    # Invalid servings
    result = validator.validate_servings(0, 4)
    assert not result.is_valid
    
    print("✓ Servings validation test passed")


def test_validate_ingredient_quantity():
    """Test ingredient quantity validation."""
    validator = ScalingValidator()
    
    # Valid quantity
    result = validator.validate_ingredient_quantity(
        Decimal('200'), 'g', 'Flour'
    )
    assert result.is_valid
    
    # Invalid quantity
    result = validator.validate_ingredient_quantity(
        Decimal('-10'), 'g', 'Salt'
    )
    assert not result.is_valid
    
    print("✓ Ingredient quantity validation test passed")


def test_validate_calories():
    """Test calorie validation."""
    validator = ScalingValidator()
    
    # Valid calories
    result = validator.validate_calories(Decimal('350'), 'Per serving')
    assert result.is_valid
    
    # Invalid calories
    result = validator.validate_calories(Decimal('-100'), 'Recipe')
    assert not result.is_valid
    
    print("✓ Calorie validation test passed")


def test_validate_participant_coefficient():
    """Test participant coefficient validation."""
    validator = ScalingValidator()
    
    # Valid coefficient
    result = validator.validate_participant_coefficient(100, 'Adult')
    assert result.is_valid
    
    # Invalid coefficient
    result = validator.validate_participant_coefficient(5, 'Toddler')
    assert not result.is_valid
    
    print("✓ Participant coefficient validation test passed")


def test_validate_scaling_request():
    """Test complete scaling request validation."""
    validator = ScalingValidator()
    
    # Valid basic request
    request = {'target_servings': 6}
    result = validator.validate_scaling_request(request, 'basic')
    assert result.is_valid
    
    # Invalid request
    request = {'target_servings': 0}
    result = validator.validate_scaling_request(request, 'basic')
    assert not result.is_valid
    
    print("✓ Scaling request validation test passed")


def test_validation_result_merge():
    """Test merging validation results."""
    result1 = ValidationResult(is_valid=True, errors=[], warnings=['Warning 1'])
    result2 = ValidationResult(is_valid=False, errors=['Error 1'], warnings=['Warning 2'])
    
    result1.merge(result2)
    
    assert not result1.is_valid
    assert 'Error 1' in result1.errors
    assert 'Warning 1' in result1.warnings
    assert 'Warning 2' in result1.warnings
    
    print("✓ Validation result merge test passed")


def test_validate_scaling_operation_function():
    """Test the convenience validation function."""
    # Valid request
    is_valid, errors, warnings = validate_scaling_operation(
        'request',
        {'type': 'basic', 'target_servings': 6}
    )
    assert is_valid
    assert len(errors) == 0
    
    # Invalid request
    is_valid, errors, warnings = validate_scaling_operation(
        'factor',
        {'factor': -1}
    )
    assert not is_valid
    assert len(errors) > 0
    
    print("✓ Validate scaling operation function test passed")


if __name__ == '__main__':
    print("Running scaling validator tests...\n")
    
    test_validator_creation()
    test_validate_scaling_factor()
    test_validate_servings()
    test_validate_ingredient_quantity()
    test_validate_calories()
    test_validate_participant_coefficient()
    test_validate_scaling_request()
    test_validation_result_merge()
    test_validate_scaling_operation_function()
    
    print("\n✅ All tests passed!")