"""
Comprehensive validation for recipe scaling operations.

This module provides validation functions to ensure scaling accuracy,
check for mathematical errors, validate coefficient applications,
and ensure all constraints are respected throughout the scaling process.
"""

from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass
import logging

from jidelnicek.core.exceptions import ValidationError


logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of a validation check."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    
    def add_error(self, message: str) -> None:
        """Add an error message."""
        self.errors.append(message)
        self.is_valid = False
    
    def add_warning(self, message: str) -> None:
        """Add a warning message."""
        self.warnings.append(message)
    
    def merge(self, other: 'ValidationResult') -> None:
        """Merge another validation result into this one."""
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        if not other.is_valid:
            self.is_valid = False


class ScalingValidator:
    """Validator for recipe scaling operations."""
    
    # Validation constants
    MIN_QUANTITY = Decimal('0.001')  # Minimum allowed ingredient quantity
    MAX_QUANTITY = Decimal('99999')   # Maximum allowed ingredient quantity
    MIN_SERVINGS = 1
    MAX_SERVINGS = 1000
    MIN_CALORIES = Decimal('1')
    MAX_CALORIES_PER_SERVING = Decimal('5000')
    MIN_COEFFICIENT = Decimal('0.1')  # 10%
    MAX_COEFFICIENT = Decimal('3.0')  # 300%
    PRECISION_TOLERANCE = Decimal('0.0001')  # For floating point comparisons
    
    def validate_scaling_factor(self, factor: Decimal) -> ValidationResult:
        """
        Validate a scaling factor.
        
        Args:
            factor: The scaling factor to validate
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        try:
            # Ensure it's a valid decimal
            factor = Decimal(str(factor))
        except (InvalidOperation, ValueError):
            result.add_error(f"Invalid scaling factor: {factor}")
            return result
        
        # Check if factor is positive
        if factor <= 0:
            result.add_error("Scaling factor must be positive")
        
        # Check for extreme values
        if factor < Decimal('0.1'):
            result.add_warning("Very small scaling factor (< 10%) may result in impractical quantities")
        elif factor > Decimal('10'):
            result.add_warning("Very large scaling factor (> 1000%) may result in impractical quantities")
        
        # Check for NaN or infinity
        if not factor.is_finite():
            result.add_error("Scaling factor must be a finite number")
        
        return result
    
    def validate_servings(self, original: int, target: int) -> ValidationResult:
        """
        Validate serving counts.
        
        Args:
            original: Original number of servings
            target: Target number of servings
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        # Validate original servings
        if not isinstance(original, int) or original < self.MIN_SERVINGS:
            result.add_error(f"Original servings must be an integer >= {self.MIN_SERVINGS}")
        elif original > self.MAX_SERVINGS:
            result.add_error(f"Original servings cannot exceed {self.MAX_SERVINGS}")
        
        # Validate target servings
        if not isinstance(target, int) or target < self.MIN_SERVINGS:
            result.add_error(f"Target servings must be an integer >= {self.MIN_SERVINGS}")
        elif target > self.MAX_SERVINGS:
            result.add_error(f"Target servings cannot exceed {self.MAX_SERVINGS}")
        
        # Warn about extreme scaling
        if original > 0 and target > 0:
            ratio = target / original
            if ratio < 0.1:
                result.add_warning("Scaling down by more than 90% may result in impractical quantities")
            elif ratio > 10:
                result.add_warning("Scaling up by more than 10x may result in impractical quantities")
        
        return result
    
    def validate_ingredient_quantity(
        self,
        quantity: Decimal,
        unit: str,
        ingredient_name: Optional[str] = None
    ) -> ValidationResult:
        """
        Validate an ingredient quantity.
        
        Args:
            quantity: The quantity to validate
            unit: The unit of measurement
            ingredient_name: Optional ingredient name for better error messages
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        name = ingredient_name or "Ingredient"
        
        try:
            quantity = Decimal(str(quantity))
        except (InvalidOperation, ValueError):
            result.add_error(f"{name}: Invalid quantity value")
            return result
        
        # Check basic constraints
        if quantity < 0:
            result.add_error(f"{name}: Quantity cannot be negative")
        elif quantity == 0:
            result.add_error(f"{name}: Quantity cannot be zero")
        elif quantity < self.MIN_QUANTITY:
            result.add_error(f"{name}: Quantity too small (minimum: {self.MIN_QUANTITY})")
        elif quantity > self.MAX_QUANTITY:
            result.add_error(f"{name}: Quantity too large (maximum: {self.MAX_QUANTITY})")
        
        # Unit-specific validations
        if unit in ['piece', 'pieces', 'ks', 'kusy']:
            # Check for fractional pieces in certain cases
            if quantity % 1 != 0:
                # Some fractional pieces are acceptable (e.g., 0.5, 0.25)
                if quantity % Decimal('0.25') != 0:
                    result.add_warning(f"{name}: Unusual fractional quantity for countable items")
        
        # Check for impractical precision
        if str(quantity).find('.') > -1:
            decimal_places = len(str(quantity).split('.')[-1])
            if decimal_places > 3:
                result.add_warning(f"{name}: Excessive precision may not be practical")
        
        return result
    
    def validate_calories(
        self,
        calories: Decimal,
        context: str = "Recipe"
    ) -> ValidationResult:
        """
        Validate calorie values.
        
        Args:
            calories: The calorie value to validate
            context: Context for error messages (e.g., "Recipe", "Per serving")
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        try:
            calories = Decimal(str(calories))
        except (InvalidOperation, ValueError):
            result.add_error(f"{context}: Invalid calorie value")
            return result
        
        if calories < 0:
            result.add_error(f"{context}: Calories cannot be negative")
        elif calories == 0:
            result.add_warning(f"{context}: Zero calories is unusual")
        elif calories < self.MIN_CALORIES:
            result.add_warning(f"{context}: Very low calorie count")
        elif calories > self.MAX_CALORIES_PER_SERVING * 10:  # Assuming max 10 servings
            result.add_warning(f"{context}: Unusually high calorie count")
        
        return result
    
    def validate_participant_coefficient(
        self,
        coefficient: int,
        participant_name: Optional[str] = None
    ) -> ValidationResult:
        """
        Validate a participant coefficient.
        
        Args:
            coefficient: The coefficient percentage (e.g., 100 for 100%)
            participant_name: Optional participant name for better error messages
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        name = participant_name or "Participant"
        
        if not isinstance(coefficient, int):
            result.add_error(f"{name}: Coefficient must be an integer percentage")
            return result
        
        if coefficient < 10:
            result.add_error(f"{name}: Coefficient must be at least 10%")
        elif coefficient > 300:
            result.add_error(f"{name}: Coefficient cannot exceed 300%")
        elif coefficient < 50:
            result.add_warning(f"{name}: Very low coefficient (< 50%)")
        elif coefficient > 200:
            result.add_warning(f"{name}: Very high coefficient (> 200%)")
        
        return result
    
    def validate_scaling_result(
        self,
        original_data: Dict[str, Any],
        scaled_data: Dict[str, Any],
        expected_factor: Decimal
    ) -> ValidationResult:
        """
        Validate the result of a scaling operation.
        
        Args:
            original_data: Original recipe data
            scaled_data: Scaled recipe data
            expected_factor: Expected scaling factor
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        # Validate scaling factor accuracy
        if 'ingredients' in original_data and 'ingredients' in scaled_data:
            for i, (orig, scaled) in enumerate(zip(
                original_data['ingredients'],
                scaled_data['ingredients']
            )):
                if 'quantity' in orig and 'quantity' in scaled:
                    orig_qty = Decimal(str(orig['quantity']))
                    scaled_qty = Decimal(str(scaled['quantity']))
                    
                    if orig_qty > 0:
                        actual_factor = scaled_qty / orig_qty
                        deviation = abs(actual_factor - expected_factor)
                        
                        # Allow for rounding differences
                        if deviation > self.PRECISION_TOLERANCE:
                            # Check if it's due to rounding
                            if 'was_rounded' in scaled and scaled['was_rounded']:
                                if deviation > Decimal('0.1'):  # 10% tolerance for rounding
                                    result.add_warning(
                                        f"Ingredient {i+1}: Large rounding deviation detected"
                                    )
                            else:
                                result.add_error(
                                    f"Ingredient {i+1}: Scaling factor mismatch "
                                    f"(expected: {expected_factor}, actual: {actual_factor})"
                                )
        
        return result
    
    def validate_nutritional_scaling(
        self,
        original_nutrition: Dict[str, Decimal],
        scaled_nutrition: Dict[str, Decimal],
        scaling_factor: Decimal
    ) -> ValidationResult:
        """
        Validate that nutritional values are scaled correctly.
        
        Args:
            original_nutrition: Original nutritional values
            scaled_nutrition: Scaled nutritional values
            scaling_factor: Applied scaling factor
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        nutrients = ['calories', 'proteins', 'carbohydrates', 'fats']
        
        for nutrient in nutrients:
            if nutrient in original_nutrition and nutrient in scaled_nutrition:
                original = Decimal(str(original_nutrition[nutrient]))
                scaled = Decimal(str(scaled_nutrition[nutrient]))
                expected = original * scaling_factor
                
                # Check for accuracy within tolerance
                deviation = abs(scaled - expected)
                if deviation > self.PRECISION_TOLERANCE:
                    relative_error = deviation / expected if expected > 0 else Decimal('0')
                    if relative_error > Decimal('0.01'):  # 1% tolerance
                        result.add_error(
                            f"{nutrient.capitalize()}: Scaling error detected "
                            f"(expected: {expected}, actual: {scaled})"
                        )
        
        return result
    
    def validate_participant_list(
        self,
        participants: List[Dict[str, Any]]
    ) -> ValidationResult:
        """
        Validate a list of participants.
        
        Args:
            participants: List of participant data
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        if not participants:
            result.add_error("At least one participant is required")
            return result
        
        if len(participants) > 20:
            result.add_error("Maximum 20 participants allowed")
        
        # Check for duplicate names
        names = [p.get('name', '') for p in participants]
        if len(names) != len(set(names)):
            result.add_error("Duplicate participant names found")
        
        # Validate each participant
        for i, participant in enumerate(participants):
            name = participant.get('name', f'Participant {i+1}')
            
            # Validate coefficient
            if 'coefficient' in participant:
                coef_result = self.validate_participant_coefficient(
                    participant['coefficient'],
                    name
                )
                result.merge(coef_result)
            
            # Validate meal coefficients
            if 'meal_coefficients' in participant:
                for meal, coef in participant['meal_coefficients'].items():
                    meal_coef_result = self.validate_participant_coefficient(
                        coef,
                        f"{name} - {meal}"
                    )
                    result.merge(meal_coef_result)
            
            # Validate attendance factor
            if 'attendance_factor' in participant:
                factor = participant['attendance_factor']
                if not (0 <= factor <= 1):
                    result.add_error(f"{name}: Attendance factor must be between 0 and 1")
        
        return result
    
    def validate_scaling_request(
        self,
        request_data: Dict[str, Any],
        request_type: str = "basic"
    ) -> ValidationResult:
        """
        Validate a complete scaling request.
        
        Args:
            request_data: The scaling request data
            request_type: Type of scaling ("basic", "calorie", "participant")
            
        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True, errors=[], warnings=[])
        
        if request_type == "basic":
            # Validate target servings
            if 'target_servings' not in request_data:
                result.add_error("Target servings is required")
            else:
                servings_result = self.validate_servings(1, request_data['target_servings'])
                result.merge(servings_result)
        
        elif request_type == "calorie":
            # Validate target calories
            if 'target_calories' not in request_data:
                result.add_error("Target calories is required")
            else:
                cal_result = self.validate_calories(
                    Decimal(str(request_data['target_calories'])),
                    "Target calories per serving"
                )
                result.merge(cal_result)
            
            # Validate optional target servings
            if 'target_servings' in request_data:
                servings_result = self.validate_servings(1, request_data['target_servings'])
                result.merge(servings_result)
        
        elif request_type == "participant":
            # Validate participants
            if 'participants' not in request_data:
                result.add_error("Participants list is required")
            else:
                participants_result = self.validate_participant_list(
                    request_data['participants']
                )
                result.merge(participants_result)
            
            # Validate optional calorie target
            if 'target_calories_per_person' in request_data:
                cal_result = self.validate_calories(
                    Decimal(str(request_data['target_calories_per_person'])),
                    "Target calories per person"
                )
                result.merge(cal_result)
        
        return result


def validate_scaling_operation(
    operation_type: str,
    input_data: Dict[str, Any],
    output_data: Optional[Dict[str, Any]] = None
) -> Tuple[bool, List[str], List[str]]:
    """
    Convenience function to validate a scaling operation.
    
    Args:
        operation_type: Type of operation ("request", "result", "factor", etc.)
        input_data: Input data to validate
        output_data: Optional output data for result validation
        
    Returns:
        Tuple of (is_valid, errors, warnings)
    """
    validator = ScalingValidator()
    
    if operation_type == "request":
        request_type = input_data.get('type', 'basic')
        result = validator.validate_scaling_request(input_data, request_type)
    
    elif operation_type == "factor":
        result = validator.validate_scaling_factor(Decimal(str(input_data['factor'])))
    
    elif operation_type == "servings":
        result = validator.validate_servings(
            input_data['original'],
            input_data['target']
        )
    
    elif operation_type == "result" and output_data:
        result = validator.validate_scaling_result(
            input_data,
            output_data,
            Decimal(str(input_data.get('scaling_factor', 1)))
        )
    
    else:
        result = ValidationResult(
            is_valid=False,
            errors=[f"Unknown operation type: {operation_type}"],
            warnings=[]
        )
    
    return result.is_valid, result.errors, result.warnings