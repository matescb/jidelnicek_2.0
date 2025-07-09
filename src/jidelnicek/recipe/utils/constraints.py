"""Scaling constraints and limits for recipe scaling operations.

This module provides functionality to define and enforce constraints on recipe
scaling factors, ensuring practical and realistic scaling operations while
providing clear feedback about constraint violations.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from dataclasses import dataclass

from jidelnicek.core.exceptions import ValidationError


# Default scaling constraints
MIN_SCALING_FACTOR = Decimal('0.1')  # 10% - minimum practical scaling
MAX_SCALING_FACTOR = Decimal('10.0')  # 1000% - maximum realistic scaling
WARNING_LOW_THRESHOLD = Decimal('0.5')  # 50% - below this may affect quality
WARNING_HIGH_THRESHOLD = Decimal('2.0')  # 200% - above this may be challenging


@dataclass
class ScalingValidationResult:
    """Result of scaling factor validation.
    
    Attributes:
        is_valid: Whether the scaling factor is within acceptable bounds
        clamped_factor: The scaling factor clamped to valid range
        warnings: List of warning messages about the scaling factor
    """
    is_valid: bool
    clamped_factor: Decimal
    warnings: List[str]


class ScalingConstraints:
    """Manages constraints and validation for recipe scaling operations.
    
    This class provides methods to validate scaling factors, generate warnings
    for potentially problematic scaling values, and clamp factors to acceptable
    ranges. It helps ensure recipe scaling remains practical and achievable.
    
    Example:
        >>> constraints = ScalingConstraints()
        >>> result = constraints.validate_scaling_factor(Decimal('0.05'))
        >>> print(result.is_valid)  # False
        >>> print(result.clamped_factor)  # Decimal('0.1000')
        >>> print(result.warnings)  # ['Scaling factor 0.05 is below minimum...']
    """
    
    def __init__(
        self,
        min_factor: Optional[Decimal] = None,
        max_factor: Optional[Decimal] = None,
        warning_low: Optional[Decimal] = None,
        warning_high: Optional[Decimal] = None
    ):
        """Initialize ScalingConstraints with custom or default limits.
        
        Args:
            min_factor: Minimum allowed scaling factor (default: 0.1)
            max_factor: Maximum allowed scaling factor (default: 10.0)
            warning_low: Lower threshold for warnings (default: 0.5)
            warning_high: Upper threshold for warnings (default: 2.0)
            
        Raises:
            ValidationError: If constraints are invalid (e.g., min > max)
        """
        self.min_factor = min_factor if min_factor is not None else MIN_SCALING_FACTOR
        self.max_factor = max_factor if max_factor is not None else MAX_SCALING_FACTOR
        self.warning_low = warning_low if warning_low is not None else WARNING_LOW_THRESHOLD
        self.warning_high = warning_high if warning_high is not None else WARNING_HIGH_THRESHOLD
        
        # Validate constraints
        if self.min_factor <= 0:
            raise ValidationError(f"Minimum scaling factor must be positive, got {self.min_factor}")
        
        if self.max_factor <= 0:
            raise ValidationError(f"Maximum scaling factor must be positive, got {self.max_factor}")
        
        if self.min_factor >= self.max_factor:
            raise ValidationError(
                f"Minimum factor ({self.min_factor}) must be less than "
                f"maximum factor ({self.max_factor})"
            )
        
        if self.warning_low <= 0 or self.warning_high <= 0:
            raise ValidationError("Warning thresholds must be positive")
        
        if self.warning_low >= self.warning_high:
            raise ValidationError(
                f"Warning low threshold ({self.warning_low}) must be less than "
                f"high threshold ({self.warning_high})"
            )
    
    def validate_scaling_factor(self, factor: Decimal) -> ScalingValidationResult:
        """Validate a scaling factor against constraints.
        
        Checks if the factor is within acceptable bounds and generates
        appropriate warnings for edge cases.
        
        Args:
            factor: The scaling factor to validate
            
        Returns:
            ScalingValidationResult with validation status, clamped value, and warnings
            
        Raises:
            ValidationError: If factor is not a valid Decimal or is negative
        """
        # Ensure factor is Decimal
        if not isinstance(factor, Decimal):
            try:
                factor = Decimal(str(factor))
            except Exception as e:
                raise ValidationError(f"Invalid scaling factor: {e}")
        
        if factor < 0:
            raise ValidationError(f"Scaling factor must be non-negative, got {factor}")
        
        # Special case: factor is exactly 0
        if factor == 0:
            return ScalingValidationResult(
                is_valid=False,
                clamped_factor=self.min_factor,
                warnings=["Scaling factor of 0 is not practical - using minimum value"]
            )
        
        # Check bounds
        is_valid = self.min_factor <= factor <= self.max_factor
        clamped_factor = self.clamp_scaling_factor(factor)
        warnings = self.get_scaling_warnings(factor)
        
        return ScalingValidationResult(
            is_valid=is_valid,
            clamped_factor=clamped_factor,
            warnings=warnings
        )
    
    def get_scaling_warnings(self, factor: Decimal) -> List[str]:
        """Generate warning messages for a scaling factor.
        
        Provides helpful warnings when scaling factors are outside recommended
        ranges or at extreme values.
        
        Args:
            factor: The scaling factor to check
            
        Returns:
            List of warning messages (empty if no warnings)
        """
        warnings = []
        
        # Ensure factor is Decimal
        if not isinstance(factor, Decimal):
            factor = Decimal(str(factor))
        
        # Check against hard limits
        if factor < self.min_factor:
            percentage = int(factor * 100)
            warnings.append(
                f"Scaling factor {factor} ({percentage}%) is below minimum "
                f"of {self.min_factor} ({int(self.min_factor * 100)}%). "
                "Recipe will be clamped to minimum."
            )
        elif factor > self.max_factor:
            percentage = int(factor * 100)
            warnings.append(
                f"Scaling factor {factor} ({percentage}%) exceeds maximum "
                f"of {self.max_factor} ({int(self.max_factor * 100)}%). "
                "Recipe will be clamped to maximum."
            )
        
        # Check against warning thresholds
        elif factor < self.warning_low:
            percentage = int(factor * 100)
            warnings.append(
                f"Scaling down to {percentage}% may result in impractical "
                "quantities for some ingredients. Consider adjusting portions "
                "or preparation methods."
            )
        elif factor > self.warning_high:
            percentage = int(factor * 100)
            warnings.append(
                f"Scaling up to {percentage}% may require industrial-scale "
                "equipment or multiple batches. Consider splitting the recipe."
            )
        
        # Special case warnings
        if factor == self.min_factor and factor != MIN_SCALING_FACTOR:
            warnings.append("Using custom minimum scaling factor.")
        elif factor == self.max_factor and factor != MAX_SCALING_FACTOR:
            warnings.append("Using custom maximum scaling factor.")
        
        return warnings
    
    def clamp_scaling_factor(self, factor: Decimal) -> Decimal:
        """Clamp a scaling factor to valid range.
        
        Ensures the scaling factor is within the minimum and maximum bounds,
        adjusting it if necessary.
        
        Args:
            factor: The scaling factor to clamp
            
        Returns:
            The clamped scaling factor with proper precision
        """
        # Ensure factor is Decimal
        if not isinstance(factor, Decimal):
            factor = Decimal(str(factor))
        
        # Special case: negative factors become minimum
        if factor < 0:
            factor = self.min_factor
        # Clamp to range
        elif factor < self.min_factor:
            factor = self.min_factor
        elif factor > self.max_factor:
            factor = self.max_factor
        
        # Ensure consistent precision (4 decimal places)
        return factor.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    
    def is_within_recommended_range(self, factor: Decimal) -> bool:
        """Check if scaling factor is within recommended range.
        
        The recommended range is between warning thresholds, where scaling
        is most practical and achievable.
        
        Args:
            factor: The scaling factor to check
            
        Returns:
            True if within recommended range, False otherwise
        """
        if not isinstance(factor, Decimal):
            factor = Decimal(str(factor))
        
        return self.warning_low <= factor <= self.warning_high
    
    def get_constraint_info(self) -> dict:
        """Get current constraint configuration.
        
        Returns:
            Dictionary with all constraint values and their percentages
        """
        return {
            'min_factor': {
                'value': self.min_factor,
                'percentage': int(self.min_factor * 100)
            },
            'max_factor': {
                'value': self.max_factor,
                'percentage': int(self.max_factor * 100)
            },
            'warning_low': {
                'value': self.warning_low,
                'percentage': int(self.warning_low * 100)
            },
            'warning_high': {
                'value': self.warning_high,
                'percentage': int(self.warning_high * 100)
            },
            'recommended_range': {
                'low': self.warning_low,
                'high': self.warning_high,
                'low_percentage': int(self.warning_low * 100),
                'high_percentage': int(self.warning_high * 100)
            }
        }