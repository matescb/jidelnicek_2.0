"""
Tests for recipe scaling validation.
"""

import pytest
from decimal import Decimal

from jidelnicek.recipe.utils.scaling_validator import (
    ScalingValidator,
    ValidationResult,
    validate_scaling_operation
)


class TestScalingValidator:
    """Test the ScalingValidator class."""
    
    @pytest.fixture
    def validator(self):
        """Create a validator instance."""
        return ScalingValidator()
    
    def test_validate_scaling_factor_valid(self, validator):
        """Test validation of valid scaling factors."""
        # Normal scaling factors
        result = validator.validate_scaling_factor(Decimal('1.5'))
        assert result.is_valid
        assert len(result.errors) == 0
        assert len(result.warnings) == 0
        
        result = validator.validate_scaling_factor(Decimal('2'))
        assert result.is_valid
        assert len(result.errors) == 0
        
        result = validator.validate_scaling_factor(Decimal('0.5'))
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_validate_scaling_factor_invalid(self, validator):
        """Test validation of invalid scaling factors."""
        # Negative factor
        result = validator.validate_scaling_factor(Decimal('-1'))
        assert not result.is_valid
        assert "must be positive" in result.errors[0]
        
        # Zero factor
        result = validator.validate_scaling_factor(Decimal('0'))
        assert not result.is_valid
        assert "must be positive" in result.errors[0]
        
        # Invalid value
        result = validator.validate_scaling_factor("invalid")
        assert not result.is_valid
        assert "Invalid scaling factor" in result.errors[0]
    
    def test_validate_scaling_factor_warnings(self, validator):
        """Test scaling factor validation warnings."""
        # Very small factor
        result = validator.validate_scaling_factor(Decimal('0.05'))
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Very small scaling factor" in result.warnings[0]
        
        # Very large factor
        result = validator.validate_scaling_factor(Decimal('15'))
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Very large scaling factor" in result.warnings[0]
    
    def test_validate_servings_valid(self, validator):
        """Test validation of valid serving counts."""
        result = validator.validate_servings(4, 6)
        assert result.is_valid
        assert len(result.errors) == 0
        assert len(result.warnings) == 0
        
        result = validator.validate_servings(1, 10)
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_validate_servings_invalid(self, validator):
        """Test validation of invalid serving counts."""
        # Invalid original servings
        result = validator.validate_servings(0, 4)
        assert not result.is_valid
        assert "Original servings must be" in result.errors[0]
        
        # Invalid target servings
        result = validator.validate_servings(4, 0)
        assert not result.is_valid
        assert "Target servings must be" in result.errors[0]
        
        # Exceeding maximum
        result = validator.validate_servings(4, 1001)
        assert not result.is_valid
        assert "cannot exceed" in result.errors[0]
    
    def test_validate_servings_warnings(self, validator):
        """Test serving validation warnings."""
        # Extreme scaling down
        result = validator.validate_servings(10, 1)
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Scaling down by more than 90%" in result.warnings[0]
        
        # Extreme scaling up
        result = validator.validate_servings(1, 15)
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Scaling up by more than 10x" in result.warnings[0]
    
    def test_validate_ingredient_quantity_valid(self, validator):
        """Test validation of valid ingredient quantities."""
        result = validator.validate_ingredient_quantity(Decimal('200'), 'g', 'Flour')
        assert result.is_valid
        assert len(result.errors) == 0
        
        result = validator.validate_ingredient_quantity(Decimal('2.5'), 'cups', 'Milk')
        assert result.is_valid
        assert len(result.errors) == 0
        
        # Whole pieces
        result = validator.validate_ingredient_quantity(Decimal('3'), 'piece', 'Eggs')
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_validate_ingredient_quantity_invalid(self, validator):
        """Test validation of invalid ingredient quantities."""
        # Negative quantity
        result = validator.validate_ingredient_quantity(Decimal('-1'), 'g', 'Salt')
        assert not result.is_valid
        assert "cannot be negative" in result.errors[0]
        
        # Zero quantity
        result = validator.validate_ingredient_quantity(Decimal('0'), 'ml', 'Water')
        assert not result.is_valid
        assert "cannot be zero" in result.errors[0]
        
        # Too small
        result = validator.validate_ingredient_quantity(Decimal('0.0001'), 'g')
        assert not result.is_valid
        assert "too small" in result.errors[0]
        
        # Too large
        result = validator.validate_ingredient_quantity(Decimal('100000'), 'kg')
        assert not result.is_valid
        assert "too large" in result.errors[0]
    
    def test_validate_ingredient_quantity_warnings(self, validator):
        """Test ingredient quantity validation warnings."""
        # Fractional pieces
        result = validator.validate_ingredient_quantity(Decimal('2.7'), 'piece', 'Eggs')
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Unusual fractional quantity" in result.warnings[0]
        
        # Acceptable fractions (0.5, 0.25)
        result = validator.validate_ingredient_quantity(Decimal('0.5'), 'piece', 'Onion')
        assert result.is_valid
        assert len(result.warnings) == 0
        
        # Excessive precision
        result = validator.validate_ingredient_quantity(Decimal('123.4567'), 'g')
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Excessive precision" in result.warnings[0]
    
    def test_validate_calories(self, validator):
        """Test calorie validation."""
        # Valid calories
        result = validator.validate_calories(Decimal('350'), 'Per serving')
        assert result.is_valid
        assert len(result.errors) == 0
        
        # Negative calories
        result = validator.validate_calories(Decimal('-100'), 'Recipe')
        assert not result.is_valid
        assert "cannot be negative" in result.errors[0]
        
        # Zero calories warning
        result = validator.validate_calories(Decimal('0'), 'Ingredient')
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Zero calories" in result.warnings[0]
        
        # Very high calories
        result = validator.validate_calories(Decimal('60000'), 'Total')
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Unusually high" in result.warnings[0]
    
    def test_validate_participant_coefficient(self, validator):
        """Test participant coefficient validation."""
        # Valid coefficients
        result = validator.validate_participant_coefficient(100, 'Adult')
        assert result.is_valid
        assert len(result.errors) == 0
        
        result = validator.validate_participant_coefficient(75, 'Child')
        assert result.is_valid
        assert len(result.errors) == 0
        
        # Invalid coefficients
        result = validator.validate_participant_coefficient(5, 'Toddler')
        assert not result.is_valid
        assert "at least 10%" in result.errors[0]
        
        result = validator.validate_participant_coefficient(350, 'Giant')
        assert not result.is_valid
        assert "cannot exceed 300%" in result.errors[0]
        
        # Warnings
        result = validator.validate_participant_coefficient(30, 'Light eater')
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Very low coefficient" in result.warnings[0]
        
        result = validator.validate_participant_coefficient(250, 'Heavy eater')
        assert result.is_valid
        assert len(result.warnings) > 0
        assert "Very high coefficient" in result.warnings[0]
    
    def test_validate_scaling_result(self, validator):
        """Test validation of scaling results."""
        original = {
            'ingredients': [
                {'quantity': Decimal('200'), 'unit': 'g'},
                {'quantity': Decimal('100'), 'unit': 'ml'}
            ]
        }
        
        # Correct scaling
        scaled = {
            'ingredients': [
                {'quantity': Decimal('300'), 'unit': 'g'},
                {'quantity': Decimal('150'), 'unit': 'ml'}
            ]
        }
        result = validator.validate_scaling_result(original, scaled, Decimal('1.5'))
        assert result.is_valid
        assert len(result.errors) == 0
        
        # Incorrect scaling
        scaled_wrong = {
            'ingredients': [
                {'quantity': Decimal('250'), 'unit': 'g'},  # Should be 300
                {'quantity': Decimal('150'), 'unit': 'ml'}
            ]
        }
        result = validator.validate_scaling_result(original, scaled_wrong, Decimal('1.5'))
        assert not result.is_valid
        assert "Scaling factor mismatch" in result.errors[0]
        
        # With rounding tolerance
        scaled_rounded = {
            'ingredients': [
                {'quantity': Decimal('300'), 'unit': 'g', 'was_rounded': True},
                {'quantity': Decimal('150'), 'unit': 'ml', 'was_rounded': True}
            ]
        }
        result = validator.validate_scaling_result(original, scaled_rounded, Decimal('1.5'))
        assert result.is_valid
    
    def test_validate_nutritional_scaling(self, validator):
        """Test nutritional value scaling validation."""
        original = {
            'calories': Decimal('200'),
            'proteins': Decimal('10'),
            'carbohydrates': Decimal('30'),
            'fats': Decimal('5')
        }
        
        # Correct scaling
        scaled = {
            'calories': Decimal('400'),
            'proteins': Decimal('20'),
            'carbohydrates': Decimal('60'),
            'fats': Decimal('10')
        }
        result = validator.validate_nutritional_scaling(original, scaled, Decimal('2'))
        assert result.is_valid
        assert len(result.errors) == 0
        
        # Incorrect scaling
        scaled_wrong = {
            'calories': Decimal('380'),  # Should be 400
            'proteins': Decimal('20'),
            'carbohydrates': Decimal('60'),
            'fats': Decimal('10')
        }
        result = validator.validate_nutritional_scaling(original, scaled_wrong, Decimal('2'))
        assert not result.is_valid
        assert "Calories: Scaling error" in result.errors[0]
    
    def test_validate_participant_list(self, validator):
        """Test participant list validation."""
        # Valid list
        participants = [
            {'name': 'Adult 1', 'coefficient': 100},
            {'name': 'Adult 2', 'coefficient': 120},
            {'name': 'Child', 'coefficient': 75}
        ]
        result = validator.validate_participant_list(participants)
        assert result.is_valid
        assert len(result.errors) == 0
        
        # Empty list
        result = validator.validate_participant_list([])
        assert not result.is_valid
        assert "at least one participant" in result.errors[0]
        
        # Too many participants
        many_participants = [
            {'name': f'Person {i}', 'coefficient': 100}
            for i in range(25)
        ]
        result = validator.validate_participant_list(many_participants)
        assert not result.is_valid
        assert "Maximum 20 participants" in result.errors[0]
        
        # Duplicate names
        duplicates = [
            {'name': 'John', 'coefficient': 100},
            {'name': 'John', 'coefficient': 120}
        ]
        result = validator.validate_participant_list(duplicates)
        assert not result.is_valid
        assert "Duplicate participant names" in result.errors[0]
        
        # Invalid attendance factor
        invalid_attendance = [
            {'name': 'Person', 'coefficient': 100, 'attendance_factor': 1.5}
        ]
        result = validator.validate_participant_list(invalid_attendance)
        assert not result.is_valid
        assert "Attendance factor must be between 0 and 1" in result.errors[0]
    
    def test_validate_scaling_request(self, validator):
        """Test complete scaling request validation."""
        # Valid basic request
        basic_request = {'target_servings': 6}
        result = validator.validate_scaling_request(basic_request, 'basic')
        assert result.is_valid
        
        # Invalid basic request
        invalid_basic = {'target_servings': 0}
        result = validator.validate_scaling_request(invalid_basic, 'basic')
        assert not result.is_valid
        
        # Valid calorie request
        calorie_request = {'target_calories': 500, 'target_servings': 1}
        result = validator.validate_scaling_request(calorie_request, 'calorie')
        assert result.is_valid
        
        # Invalid calorie request
        invalid_calorie = {'target_servings': 1}  # Missing target_calories
        result = validator.validate_scaling_request(invalid_calorie, 'calorie')
        assert not result.is_valid
        assert "Target calories is required" in result.errors[0]
        
        # Valid participant request
        participant_request = {
            'participants': [
                {'name': 'Adult', 'coefficient': 100},
                {'name': 'Child', 'coefficient': 75}
            ]
        }
        result = validator.validate_scaling_request(participant_request, 'participant')
        assert result.is_valid
        
        # Invalid participant request
        invalid_participant = {'participants': []}
        result = validator.validate_scaling_request(invalid_participant, 'participant')
        assert not result.is_valid
    
    def test_validation_result_merge(self):
        """Test merging validation results."""
        result1 = ValidationResult(is_valid=True, errors=[], warnings=['Warning 1'])
        result2 = ValidationResult(is_valid=False, errors=['Error 1'], warnings=['Warning 2'])
        
        result1.merge(result2)
        
        assert not result1.is_valid
        assert len(result1.errors) == 1
        assert len(result1.warnings) == 2
        assert 'Error 1' in result1.errors
        assert 'Warning 1' in result1.warnings
        assert 'Warning 2' in result1.warnings


class TestValidateScalingOperation:
    """Test the convenience validation function."""
    
    def test_validate_request_operation(self):
        """Test validating a scaling request."""
        request_data = {
            'type': 'basic',
            'target_servings': 8
        }
        
        is_valid, errors, warnings = validate_scaling_operation('request', request_data)
        assert is_valid
        assert len(errors) == 0
    
    def test_validate_factor_operation(self):
        """Test validating a scaling factor."""
        is_valid, errors, warnings = validate_scaling_operation(
            'factor',
            {'factor': 2.5}
        )
        assert is_valid
        assert len(errors) == 0
        
        is_valid, errors, warnings = validate_scaling_operation(
            'factor',
            {'factor': -1}
        )
        assert not is_valid
        assert len(errors) > 0
    
    def test_validate_servings_operation(self):
        """Test validating servings."""
        is_valid, errors, warnings = validate_scaling_operation(
            'servings',
            {'original': 4, 'target': 6}
        )
        assert is_valid
        assert len(errors) == 0
    
    def test_validate_result_operation(self):
        """Test validating scaling results."""
        input_data = {
            'scaling_factor': 2,
            'ingredients': [{'quantity': Decimal('100')}]
        }
        output_data = {
            'ingredients': [{'quantity': Decimal('200')}]
        }
        
        is_valid, errors, warnings = validate_scaling_operation(
            'result',
            input_data,
            output_data
        )
        assert is_valid
        assert len(errors) == 0
    
    def test_unknown_operation_type(self):
        """Test handling unknown operation type."""
        is_valid, errors, warnings = validate_scaling_operation(
            'unknown',
            {}
        )
        assert not is_valid
        assert "Unknown operation type" in errors[0]