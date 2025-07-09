"""Tests for recipe scaling constraints functionality."""

import pytest
from decimal import Decimal

from jidelnicek.core.exceptions import ValidationError
from jidelnicek.recipe.utils.constraints import (
    ScalingConstraints, 
    ScalingValidationResult,
    MIN_SCALING_FACTOR,
    MAX_SCALING_FACTOR,
    WARNING_LOW_THRESHOLD,
    WARNING_HIGH_THRESHOLD
)
from jidelnicek.recipe.utils.scaling import RecipeScaler


class TestScalingConstraints:
    """Test suite for the ScalingConstraints class."""
    
    @pytest.fixture
    def default_constraints(self):
        """Create a ScalingConstraints instance with default values."""
        return ScalingConstraints()
    
    @pytest.fixture
    def custom_constraints(self):
        """Create a ScalingConstraints instance with custom values."""
        return ScalingConstraints(
            min_factor=Decimal('0.2'),
            max_factor=Decimal('5.0'),
            warning_low=Decimal('0.4'),
            warning_high=Decimal('3.0')
        )
    
    # Tests for initialization
    
    def test_default_initialization(self, default_constraints):
        """Test that default constraints are properly initialized."""
        assert default_constraints.min_factor == MIN_SCALING_FACTOR
        assert default_constraints.max_factor == MAX_SCALING_FACTOR
        assert default_constraints.warning_low == WARNING_LOW_THRESHOLD
        assert default_constraints.warning_high == WARNING_HIGH_THRESHOLD
    
    def test_custom_initialization(self, custom_constraints):
        """Test that custom constraints are properly set."""
        assert custom_constraints.min_factor == Decimal('0.2')
        assert custom_constraints.max_factor == Decimal('5.0')
        assert custom_constraints.warning_low == Decimal('0.4')
        assert custom_constraints.warning_high == Decimal('3.0')
    
    def test_invalid_initialization(self):
        """Test that invalid constraint values raise errors."""
        # Negative min factor
        with pytest.raises(ValidationError, match="Minimum scaling factor must be positive"):
            ScalingConstraints(min_factor=Decimal('-0.1'))
        
        # Zero max factor
        with pytest.raises(ValidationError, match="Maximum scaling factor must be positive"):
            ScalingConstraints(max_factor=Decimal('0'))
        
        # Min >= Max
        with pytest.raises(ValidationError, match="Minimum factor .* must be less than maximum"):
            ScalingConstraints(min_factor=Decimal('2.0'), max_factor=Decimal('1.0'))
        
        # Warning thresholds invalid
        with pytest.raises(ValidationError, match="Warning thresholds must be positive"):
            ScalingConstraints(warning_low=Decimal('-0.5'))
        
        # Warning low >= high
        with pytest.raises(ValidationError, match="Warning low threshold .* must be less than"):
            ScalingConstraints(warning_low=Decimal('2.0'), warning_high=Decimal('1.0'))
    
    # Tests for validate_scaling_factor
    
    def test_validate_valid_factor(self, default_constraints):
        """Test validation of factors within acceptable range."""
        # Normal scaling
        result = default_constraints.validate_scaling_factor(Decimal('1.5'))
        assert result.is_valid is True
        assert result.clamped_factor == Decimal('1.5000')
        assert len(result.warnings) == 0
        
        # At boundaries
        result = default_constraints.validate_scaling_factor(MIN_SCALING_FACTOR)
        assert result.is_valid is True
        assert result.clamped_factor == MIN_SCALING_FACTOR
        
        result = default_constraints.validate_scaling_factor(MAX_SCALING_FACTOR)
        assert result.is_valid is True
        assert result.clamped_factor == MAX_SCALING_FACTOR
    
    def test_validate_below_minimum(self, default_constraints):
        """Test validation of factors below minimum."""
        result = default_constraints.validate_scaling_factor(Decimal('0.05'))
        assert result.is_valid is False
        assert result.clamped_factor == MIN_SCALING_FACTOR
        assert len(result.warnings) > 0
        assert "below minimum" in result.warnings[0]
        assert "5%" in result.warnings[0]
    
    def test_validate_above_maximum(self, default_constraints):
        """Test validation of factors above maximum."""
        result = default_constraints.validate_scaling_factor(Decimal('15.0'))
        assert result.is_valid is False
        assert result.clamped_factor == MAX_SCALING_FACTOR
        assert len(result.warnings) > 0
        assert "exceeds maximum" in result.warnings[0]
        assert "1500%" in result.warnings[0]
    
    def test_validate_zero_factor(self, default_constraints):
        """Test validation of zero scaling factor."""
        result = default_constraints.validate_scaling_factor(Decimal('0'))
        assert result.is_valid is False
        assert result.clamped_factor == MIN_SCALING_FACTOR
        assert len(result.warnings) > 0
        assert "not practical" in result.warnings[0]
    
    def test_validate_negative_factor(self, default_constraints):
        """Test that negative factors raise error."""
        with pytest.raises(ValidationError, match="must be non-negative"):
            default_constraints.validate_scaling_factor(Decimal('-1.0'))
    
    def test_validate_non_decimal_input(self, default_constraints):
        """Test validation with non-Decimal input."""
        # Float input
        result = default_constraints.validate_scaling_factor(1.5)
        assert result.is_valid is True
        assert result.clamped_factor == Decimal('1.5000')
        
        # String input
        result = default_constraints.validate_scaling_factor('2.0')
        assert result.is_valid is True
        assert result.clamped_factor == Decimal('2.0000')
        
        # Invalid input
        with pytest.raises(ValidationError, match="Invalid scaling factor"):
            default_constraints.validate_scaling_factor('invalid')
    
    # Tests for get_scaling_warnings
    
    def test_warnings_below_threshold(self, default_constraints):
        """Test warnings for factors below warning threshold."""
        # Just below warning threshold
        warnings = default_constraints.get_scaling_warnings(Decimal('0.4'))
        assert len(warnings) == 1
        assert "40%" in warnings[0]
        assert "impractical quantities" in warnings[0]
    
    def test_warnings_above_threshold(self, default_constraints):
        """Test warnings for factors above warning threshold."""
        # Just above warning threshold
        warnings = default_constraints.get_scaling_warnings(Decimal('2.5'))
        assert len(warnings) == 1
        assert "250%" in warnings[0]
        assert "industrial-scale" in warnings[0]
    
    def test_no_warnings_in_range(self, default_constraints):
        """Test no warnings for factors in recommended range."""
        warnings = default_constraints.get_scaling_warnings(Decimal('1.0'))
        assert len(warnings) == 0
        
        warnings = default_constraints.get_scaling_warnings(Decimal('0.75'))
        assert len(warnings) == 0
        
        warnings = default_constraints.get_scaling_warnings(Decimal('1.8'))
        assert len(warnings) == 0
    
    def test_warnings_custom_limits(self, custom_constraints):
        """Test warnings with custom constraint values."""
        # At custom minimum
        warnings = custom_constraints.get_scaling_warnings(Decimal('0.2'))
        assert len(warnings) == 1
        assert "custom minimum" in warnings[0]
        
        # At custom maximum
        warnings = custom_constraints.get_scaling_warnings(Decimal('5.0'))
        assert len(warnings) == 1
        assert "custom maximum" in warnings[0]
    
    # Tests for clamp_scaling_factor
    
    def test_clamp_within_range(self, default_constraints):
        """Test clamping factors that are already within range."""
        assert default_constraints.clamp_scaling_factor(Decimal('1.5')) == Decimal('1.5000')
        assert default_constraints.clamp_scaling_factor(Decimal('0.8')) == Decimal('0.8000')
    
    def test_clamp_below_minimum(self, default_constraints):
        """Test clamping factors below minimum."""
        assert default_constraints.clamp_scaling_factor(Decimal('0.05')) == MIN_SCALING_FACTOR
        assert default_constraints.clamp_scaling_factor(Decimal('0')) == MIN_SCALING_FACTOR
        assert default_constraints.clamp_scaling_factor(Decimal('-1')) == MIN_SCALING_FACTOR
    
    def test_clamp_above_maximum(self, default_constraints):
        """Test clamping factors above maximum."""
        assert default_constraints.clamp_scaling_factor(Decimal('15')) == MAX_SCALING_FACTOR
        assert default_constraints.clamp_scaling_factor(Decimal('100')) == MAX_SCALING_FACTOR
    
    def test_clamp_precision(self, default_constraints):
        """Test that clamping maintains proper precision."""
        # Test with many decimal places
        factor = Decimal('1.23456789')
        clamped = default_constraints.clamp_scaling_factor(factor)
        assert clamped == Decimal('1.2346')  # Rounded to 4 decimal places
    
    # Tests for is_within_recommended_range
    
    def test_recommended_range_check(self, default_constraints):
        """Test checking if factor is within recommended range."""
        # Within range
        assert default_constraints.is_within_recommended_range(Decimal('1.0')) is True
        assert default_constraints.is_within_recommended_range(Decimal('0.75')) is True
        assert default_constraints.is_within_recommended_range(Decimal('1.5')) is True
        
        # At boundaries
        assert default_constraints.is_within_recommended_range(WARNING_LOW_THRESHOLD) is True
        assert default_constraints.is_within_recommended_range(WARNING_HIGH_THRESHOLD) is True
        
        # Outside range
        assert default_constraints.is_within_recommended_range(Decimal('0.4')) is False
        assert default_constraints.is_within_recommended_range(Decimal('2.5')) is False
        assert default_constraints.is_within_recommended_range(Decimal('0.05')) is False
    
    # Tests for get_constraint_info
    
    def test_get_constraint_info(self, default_constraints):
        """Test getting constraint configuration info."""
        info = default_constraints.get_constraint_info()
        
        assert info['min_factor']['value'] == MIN_SCALING_FACTOR
        assert info['min_factor']['percentage'] == 10
        
        assert info['max_factor']['value'] == MAX_SCALING_FACTOR
        assert info['max_factor']['percentage'] == 1000
        
        assert info['warning_low']['value'] == WARNING_LOW_THRESHOLD
        assert info['warning_low']['percentage'] == 50
        
        assert info['warning_high']['value'] == WARNING_HIGH_THRESHOLD
        assert info['warning_high']['percentage'] == 200
        
        assert info['recommended_range']['low'] == WARNING_LOW_THRESHOLD
        assert info['recommended_range']['high'] == WARNING_HIGH_THRESHOLD
        assert info['recommended_range']['low_percentage'] == 50
        assert info['recommended_range']['high_percentage'] == 200


class TestRecipeScalerWithConstraints:
    """Test RecipeScaler integration with constraints."""
    
    @pytest.fixture
    def scaler_with_constraints(self):
        """Create a RecipeScaler with constraints enabled."""
        return RecipeScaler(use_constraints=True)
    
    @pytest.fixture
    def scaler_without_constraints(self):
        """Create a RecipeScaler with constraints disabled."""
        return RecipeScaler(use_constraints=False)
    
    @pytest.fixture
    def scaler_custom_constraints(self):
        """Create a RecipeScaler with custom constraints."""
        custom = ScalingConstraints(
            min_factor=Decimal('0.25'),
            max_factor=Decimal('4.0')
        )
        return RecipeScaler(use_constraints=True, constraints=custom)
    
    # Tests for scale_recipe_with_constraints
    
    def test_scale_recipe_normal_range(self, scaler_with_constraints):
        """Test scaling within normal range."""
        quantities = [Decimal('100'), Decimal('200'), Decimal('50')]
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            4, 6, quantities
        )
        
        assert factor == Decimal('1.5000')
        assert scaled == [Decimal('150.0000'), Decimal('300.0000'), Decimal('75.0000')]
        assert len(warnings) == 0
    
    def test_scale_recipe_below_minimum(self, scaler_with_constraints):
        """Test scaling that would go below minimum."""
        quantities = [Decimal('100'), Decimal('200')]
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            20, 1, quantities  # Would be 5% scaling
        )
        
        assert factor == MIN_SCALING_FACTOR  # Clamped to 10%
        assert scaled == [Decimal('10.0000'), Decimal('20.0000')]
        assert len(warnings) > 0
        assert "below minimum" in warnings[0]
    
    def test_scale_recipe_above_maximum(self, scaler_with_constraints):
        """Test scaling that would go above maximum."""
        quantities = [Decimal('100'), Decimal('200')]
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            2, 30, quantities  # Would be 1500% scaling
        )
        
        assert factor == MAX_SCALING_FACTOR  # Clamped to 1000%
        assert scaled == [Decimal('1000.0000'), Decimal('2000.0000')]
        assert len(warnings) > 0
        assert "exceeds maximum" in warnings[0]
    
    def test_scale_recipe_with_warnings(self, scaler_with_constraints):
        """Test scaling that generates warnings but is valid."""
        quantities = [Decimal('100'), Decimal('200')]
        
        # Low warning
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            4, 1, quantities  # 25% scaling
        )
        assert factor == Decimal('0.2500')
        assert len(warnings) > 0
        assert "impractical" in warnings[0]
        
        # High warning
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            2, 5, quantities  # 250% scaling
        )
        assert factor == Decimal('2.5000')
        assert len(warnings) > 0
        assert "industrial-scale" in warnings[0]
    
    def test_scale_recipe_constraints_disabled(self, scaler_without_constraints):
        """Test that constraints can be disabled."""
        quantities = [Decimal('100')]
        
        # Extreme scaling that would normally be clamped
        factor, scaled, warnings = scaler_without_constraints.scale_recipe_with_constraints(
            20, 1, quantities  # 5% scaling
        )
        
        assert factor == Decimal('0.0500')  # Not clamped
        assert scaled == [Decimal('5.0000')]
        assert len(warnings) == 0  # No warnings when disabled
    
    def test_scale_recipe_constraint_override(self, scaler_with_constraints):
        """Test overriding constraint enforcement per call."""
        quantities = [Decimal('100')]
        
        # Override to disable constraints
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            20, 1, quantities, enforce_constraints=False
        )
        
        assert factor == Decimal('0.0500')  # Not clamped
        assert len(warnings) == 0
    
    # Tests for calculate_base_scaling_factor_with_validation
    
    def test_calculate_with_validation_valid(self, scaler_with_constraints):
        """Test calculation with validation for valid factors."""
        factor, result = scaler_with_constraints.calculate_base_scaling_factor_with_validation(
            4, 6
        )
        
        assert factor == Decimal('1.5000')
        assert result.is_valid is True
        assert result.clamped_factor == factor
        assert len(result.warnings) == 0
    
    def test_calculate_with_validation_invalid(self, scaler_with_constraints):
        """Test calculation with validation for invalid factors."""
        factor, result = scaler_with_constraints.calculate_base_scaling_factor_with_validation(
            20, 1  # 5% scaling
        )
        
        assert factor == Decimal('0.0500')  # Original calculation
        assert result.is_valid is False
        assert result.clamped_factor == MIN_SCALING_FACTOR
        assert len(result.warnings) > 0
    
    def test_calculate_with_validation_no_constraints(self, scaler_without_constraints):
        """Test calculation when constraints are disabled."""
        factor, result = scaler_without_constraints.calculate_base_scaling_factor_with_validation(
            20, 1
        )
        
        assert factor == Decimal('0.0500')
        assert result.is_valid is True  # Always valid when disabled
        assert result.clamped_factor == factor
        assert len(result.warnings) == 0
    
    # Tests for validate_and_apply_constraints
    
    def test_validate_and_apply_enabled(self, scaler_with_constraints):
        """Test constraint validation when enabled."""
        # Valid factor
        factor, warnings = scaler_with_constraints.validate_and_apply_constraints(
            Decimal('1.5')
        )
        assert factor == Decimal('1.5000')
        assert len(warnings) == 0
        
        # Invalid factor
        factor, warnings = scaler_with_constraints.validate_and_apply_constraints(
            Decimal('0.05')
        )
        assert factor == MIN_SCALING_FACTOR
        assert len(warnings) > 0
    
    def test_validate_and_apply_disabled(self, scaler_without_constraints):
        """Test constraint validation when disabled."""
        factor, warnings = scaler_without_constraints.validate_and_apply_constraints(
            Decimal('0.05')
        )
        assert factor == Decimal('0.05')  # Not adjusted
        assert len(warnings) == 0
    
    # Integration tests with custom constraints
    
    def test_custom_constraints_integration(self, scaler_custom_constraints):
        """Test that custom constraints are properly used."""
        quantities = [Decimal('100')]
        
        # Test custom minimum (0.25)
        factor, scaled, warnings = scaler_custom_constraints.scale_recipe_with_constraints(
            10, 2, quantities  # 20% scaling, below custom min
        )
        assert factor == Decimal('0.2500')  # Clamped to custom min
        
        # Test custom maximum (4.0)
        factor, scaled, warnings = scaler_custom_constraints.scale_recipe_with_constraints(
            2, 10, quantities  # 500% scaling, above custom max
        )
        assert factor == Decimal('4.0000')  # Clamped to custom max
    
    # Edge case tests
    
    def test_zero_target_participants(self, scaler_with_constraints):
        """Test scaling to zero participants."""
        quantities = [Decimal('100')]
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            4, 0, quantities
        )
        
        # Zero should be clamped to minimum
        assert factor == MIN_SCALING_FACTOR
        assert scaled == [Decimal('10.0000')]
        assert len(warnings) > 0
    
    def test_very_large_scaling(self, scaler_with_constraints):
        """Test extremely large scaling requests."""
        quantities = [Decimal('100')]
        factor, scaled, warnings = scaler_with_constraints.scale_recipe_with_constraints(
            1, 10000, quantities  # 1,000,000% scaling
        )
        
        assert factor == MAX_SCALING_FACTOR
        assert scaled == [Decimal('1000.0000')]
        assert len(warnings) > 0
        assert "exceeds maximum" in warnings[0]