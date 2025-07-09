"""
Edge case handling for recipe scaling operations.

This module provides comprehensive handling of edge cases and error scenarios
in recipe scaling, including zero participants, missing data, extreme values,
and graceful degradation strategies.
"""

from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass
import logging

from jidelnicek.core.exceptions import ValidationError
from jidelnicek.recipe.utils.scaling_validator import ScalingValidator


logger = logging.getLogger(__name__)


@dataclass
class EdgeCaseResult:
    """Result of edge case handling."""
    handled: bool
    modified_input: Optional[Dict[str, Any]] = None
    warnings: List[str] = None
    error_message: Optional[str] = None
    fallback_value: Optional[Any] = None
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class ScalingEdgeCaseHandler:
    """Handles edge cases and error scenarios in recipe scaling."""
    
    # Edge case constants
    MIN_SAFE_QUANTITY = Decimal('0.001')
    MAX_SAFE_QUANTITY = Decimal('99999')
    MIN_SAFE_SERVINGS = 1
    MAX_SAFE_SERVINGS = 1000
    DEFAULT_SERVINGS = 4
    DEFAULT_COEFFICIENT = 100  # 100%
    
    def __init__(self):
        """Initialize the edge case handler."""
        self.validator = ScalingValidator()
    
    def handle_zero_participants(
        self,
        target_participants: int,
        original_servings: int
    ) -> EdgeCaseResult:
        """
        Handle the case where target participants is zero.
        
        Args:
            target_participants: The requested number of participants
            original_servings: Original recipe servings
            
        Returns:
            EdgeCaseResult with handling information
        """
        if target_participants != 0:
            return EdgeCaseResult(handled=False)
        
        logger.warning("Zero participants requested for scaling")
        
        return EdgeCaseResult(
            handled=True,
            modified_input={'target_participants': 0, 'scaling_factor': Decimal('0')},
            warnings=[
                "Recipe scaled to zero participants - all quantities will be zero",
                "Consider whether this scaling makes practical sense"
            ],
            fallback_value=Decimal('0')
        )
    
    def handle_fractional_servings(
        self,
        servings: float,
        context: str = "servings"
    ) -> EdgeCaseResult:
        """
        Handle fractional serving values.
        
        Args:
            servings: The serving value that might be fractional
            context: Context for error messages
            
        Returns:
            EdgeCaseResult with handling information
        """
        try:
            servings_decimal = Decimal(str(servings))
            
            # Check if it's actually fractional
            if servings_decimal % 1 == 0:
                return EdgeCaseResult(handled=False)
            
            # Round to nearest integer
            rounded_servings = int(round(servings_decimal))
            
            # Ensure it's at least 1
            if rounded_servings < 1:
                rounded_servings = 1
            
            logger.info(f"Rounding fractional {context} from {servings} to {rounded_servings}")
            
            return EdgeCaseResult(
                handled=True,
                modified_input={f'target_{context}': rounded_servings},
                warnings=[
                    f"Fractional {context} ({servings}) rounded to {rounded_servings}",
                    "Recipe scaling works best with whole numbers of servings"
                ],
                fallback_value=rounded_servings
            )
            
        except (InvalidOperation, ValueError) as e:
            logger.error(f"Invalid servings value: {servings}")
            return EdgeCaseResult(
                handled=True,
                error_message=f"Invalid {context} value: {servings}",
                fallback_value=self.DEFAULT_SERVINGS
            )
    
    def handle_missing_nutritional_data(
        self,
        ingredient: Dict[str, Any]
    ) -> EdgeCaseResult:
        """
        Handle ingredients with missing nutritional data.
        
        Args:
            ingredient: Ingredient dictionary
            
        Returns:
            EdgeCaseResult with handling information
        """
        if 'nutritional_data' in ingredient and ingredient['nutritional_data']:
            return EdgeCaseResult(handled=False)
        
        ingredient_name = ingredient.get('name', 'Unknown ingredient')
        logger.warning(f"Missing nutritional data for: {ingredient_name}")
        
        # Provide zero-calorie fallback
        fallback_nutrition = {
            'calories': Decimal('0'),
            'proteins': Decimal('0'),
            'carbohydrates': Decimal('0'),
            'fats': Decimal('0')
        }
        
        return EdgeCaseResult(
            handled=True,
            modified_input={
                **ingredient,
                'nutritional_data': fallback_nutrition
            },
            warnings=[
                f"No nutritional data available for {ingredient_name}",
                "Using zero values for nutritional calculations",
                "Consider adding nutritional information for accurate calorie scaling"
            ],
            fallback_value=fallback_nutrition
        )
    
    def handle_invalid_coefficient(
        self,
        coefficient: Any,
        participant_name: Optional[str] = None
    ) -> EdgeCaseResult:
        """
        Handle invalid participant coefficients.
        
        Args:
            coefficient: The coefficient value to validate
            participant_name: Optional participant name for context
            
        Returns:
            EdgeCaseResult with handling information
        """
        name = participant_name or "Participant"
        
        try:
            # Try to convert to integer
            if isinstance(coefficient, (int, float, str, Decimal)):
                coef_int = int(Decimal(str(coefficient)))
                
                # Validate range
                if coef_int < 10:
                    logger.warning(f"{name}: Coefficient {coefficient} too low, using minimum 10%")
                    return EdgeCaseResult(
                        handled=True,
                        modified_input={'coefficient': 10},
                        warnings=[f"{name}: Coefficient adjusted from {coefficient}% to 10% (minimum)"],
                        fallback_value=10
                    )
                elif coef_int > 300:
                    logger.warning(f"{name}: Coefficient {coefficient} too high, using maximum 300%")
                    return EdgeCaseResult(
                        handled=True,
                        modified_input={'coefficient': 300},
                        warnings=[f"{name}: Coefficient adjusted from {coefficient}% to 300% (maximum)"],
                        fallback_value=300
                    )
                elif coef_int != coefficient:
                    # It was fractional, we rounded it
                    return EdgeCaseResult(
                        handled=True,
                        modified_input={'coefficient': coef_int},
                        warnings=[f"{name}: Coefficient rounded from {coefficient}% to {coef_int}%"],
                        fallback_value=coef_int
                    )
                else:
                    # Valid coefficient
                    return EdgeCaseResult(handled=False)
            else:
                raise ValueError(f"Cannot convert {type(coefficient).__name__} to coefficient")
                
        except (InvalidOperation, ValueError, TypeError) as e:
            logger.error(f"{name}: Invalid coefficient value: {coefficient}")
            return EdgeCaseResult(
                handled=True,
                modified_input={'coefficient': self.DEFAULT_COEFFICIENT},
                warnings=[
                    f"{name}: Invalid coefficient '{coefficient}', using default 100%",
                    "Coefficients must be integer percentages between 10 and 300"
                ],
                error_message=str(e),
                fallback_value=self.DEFAULT_COEFFICIENT
            )
    
    def handle_extreme_scaling_factor(
        self,
        scaling_factor: Decimal
    ) -> EdgeCaseResult:
        """
        Handle extreme scaling factors that might cause issues.
        
        Args:
            scaling_factor: The scaling factor to check
            
        Returns:
            EdgeCaseResult with handling information
        """
        try:
            factor = Decimal(str(scaling_factor))
            
            # Check for non-finite values
            if not factor.is_finite():
                logger.error(f"Non-finite scaling factor: {scaling_factor}")
                return EdgeCaseResult(
                    handled=True,
                    error_message="Invalid scaling factor (infinite or NaN)",
                    fallback_value=Decimal('1')
                )
            
            # Check for extreme values
            if factor > Decimal('100'):
                logger.warning(f"Extremely large scaling factor: {factor}")
                return EdgeCaseResult(
                    handled=True,
                    modified_input={'scaling_factor': Decimal('10')},
                    warnings=[
                        f"Scaling factor {factor} is extremely large",
                        "Clamped to maximum practical value of 10x",
                        "Consider scaling in multiple steps for very large quantities"
                    ],
                    fallback_value=Decimal('10')
                )
            elif 0 < factor < Decimal('0.01'):
                logger.warning(f"Extremely small scaling factor: {factor}")
                return EdgeCaseResult(
                    handled=True,
                    modified_input={'scaling_factor': Decimal('0.1')},
                    warnings=[
                        f"Scaling factor {factor} is extremely small",
                        "Clamped to minimum practical value of 0.1x",
                        "Very small quantities may not be practical for cooking"
                    ],
                    fallback_value=Decimal('0.1')
                )
            else:
                return EdgeCaseResult(handled=False)
                
        except (InvalidOperation, ValueError) as e:
            logger.error(f"Invalid scaling factor: {scaling_factor}")
            return EdgeCaseResult(
                handled=True,
                error_message=f"Invalid scaling factor: {e}",
                fallback_value=Decimal('1')
            )
    
    def handle_missing_ingredient_data(
        self,
        ingredient: Dict[str, Any]
    ) -> EdgeCaseResult:
        """
        Handle ingredients with missing required fields.
        
        Args:
            ingredient: Ingredient dictionary
            
        Returns:
            EdgeCaseResult with handling information
        """
        warnings = []
        modified = False
        modified_ingredient = ingredient.copy()
        
        # Check for missing quantity
        if 'quantity' not in ingredient or ingredient['quantity'] is None:
            logger.warning(f"Missing quantity for ingredient: {ingredient.get('name', 'Unknown')}")
            modified_ingredient['quantity'] = Decimal('0')
            warnings.append(f"{ingredient.get('name', 'Ingredient')}: Missing quantity, using 0")
            modified = True
        
        # Check for missing unit
        if 'unit' not in ingredient or not ingredient['unit']:
            logger.warning(f"Missing unit for ingredient: {ingredient.get('name', 'Unknown')}")
            modified_ingredient['unit'] = 'unit'
            warnings.append(f"{ingredient.get('name', 'Ingredient')}: Missing unit, using 'unit'")
            modified = True
        
        # Check for missing name
        if 'name' not in ingredient or not ingredient['name']:
            logger.warning("Ingredient missing name")
            modified_ingredient['name'] = 'Unknown Ingredient'
            warnings.append("Unnamed ingredient found")
            modified = True
        
        if modified:
            return EdgeCaseResult(
                handled=True,
                modified_input=modified_ingredient,
                warnings=warnings
            )
        else:
            return EdgeCaseResult(handled=False)
    
    def handle_recipe_without_ingredients(
        self,
        recipe_data: Dict[str, Any]
    ) -> EdgeCaseResult:
        """
        Handle recipes that have no ingredients.
        
        Args:
            recipe_data: Recipe data dictionary
            
        Returns:
            EdgeCaseResult with handling information
        """
        ingredients = recipe_data.get('ingredients', [])
        
        if ingredients and len(ingredients) > 0:
            return EdgeCaseResult(handled=False)
        
        logger.error("Recipe has no ingredients to scale")
        
        return EdgeCaseResult(
            handled=True,
            error_message="Recipe has no ingredients to scale",
            warnings=[
                "Cannot scale a recipe without ingredients",
                "Please add ingredients before attempting to scale"
            ]
        )
    
    def handle_attendance_factor_edge_cases(
        self,
        attendance_factor: Any
    ) -> EdgeCaseResult:
        """
        Handle edge cases in attendance factors.
        
        Args:
            attendance_factor: The attendance factor to validate
            
        Returns:
            EdgeCaseResult with handling information
        """
        try:
            factor = Decimal(str(attendance_factor))
            
            if factor < 0:
                logger.warning(f"Negative attendance factor: {factor}")
                return EdgeCaseResult(
                    handled=True,
                    modified_input={'attendance_factor': Decimal('0')},
                    warnings=["Negative attendance factor adjusted to 0 (not attending)"],
                    fallback_value=Decimal('0')
                )
            elif factor > 1:
                logger.warning(f"Attendance factor > 1: {factor}")
                return EdgeCaseResult(
                    handled=True,
                    modified_input={'attendance_factor': Decimal('1')},
                    warnings=[
                        f"Attendance factor {factor} exceeds 1.0",
                        "Adjusted to 1.0 (full attendance)"
                    ],
                    fallback_value=Decimal('1')
                )
            else:
                return EdgeCaseResult(handled=False)
                
        except (InvalidOperation, ValueError) as e:
            logger.error(f"Invalid attendance factor: {attendance_factor}")
            return EdgeCaseResult(
                handled=True,
                modified_input={'attendance_factor': Decimal('1')},
                error_message=f"Invalid attendance factor: {e}",
                warnings=["Invalid attendance factor, assuming full attendance"],
                fallback_value=Decimal('1')
            )
    
    def sanitize_scaling_request(
        self,
        request_data: Dict[str, Any],
        request_type: str = "basic"
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Sanitize and fix common issues in scaling requests.
        
        Args:
            request_data: The scaling request data
            request_type: Type of scaling request
            
        Returns:
            Tuple of (sanitized data, warnings)
        """
        sanitized = request_data.copy()
        all_warnings = []
        
        if request_type == "basic":
            # Handle fractional servings
            if 'target_servings' in sanitized:
                result = self.handle_fractional_servings(
                    sanitized['target_servings'], 'servings'
                )
                if result.handled:
                    sanitized.update(result.modified_input)
                    all_warnings.extend(result.warnings)
        
        elif request_type == "calorie":
            # Ensure positive calories
            if 'target_calories' in sanitized:
                try:
                    calories = Decimal(str(sanitized['target_calories']))
                    if calories <= 0:
                        sanitized['target_calories'] = 100
                        all_warnings.append("Non-positive calorie target adjusted to 100")
                except (InvalidOperation, ValueError):
                    sanitized['target_calories'] = 500
                    all_warnings.append("Invalid calorie target, using default 500")
        
        elif request_type == "participant":
            # Sanitize participant list
            if 'participants' in sanitized:
                cleaned_participants = []
                for i, participant in enumerate(sanitized['participants']):
                    cleaned = participant.copy()
                    
                    # Ensure name
                    if 'name' not in cleaned or not cleaned['name']:
                        cleaned['name'] = f'Participant {i+1}'
                        all_warnings.append(f"Added default name for participant {i+1}")
                    
                    # Handle coefficient
                    if 'coefficient' in cleaned:
                        coef_result = self.handle_invalid_coefficient(
                            cleaned['coefficient'], cleaned['name']
                        )
                        if coef_result.handled:
                            cleaned['coefficient'] = coef_result.fallback_value
                            all_warnings.extend(coef_result.warnings)
                    else:
                        cleaned['coefficient'] = self.DEFAULT_COEFFICIENT
                        all_warnings.append(
                            f"{cleaned['name']}: Missing coefficient, using default 100%"
                        )
                    
                    # Handle attendance factor
                    if 'attendance_factor' in cleaned:
                        att_result = self.handle_attendance_factor_edge_cases(
                            cleaned['attendance_factor']
                        )
                        if att_result.handled:
                            cleaned['attendance_factor'] = att_result.fallback_value
                            all_warnings.extend(att_result.warnings)
                    
                    cleaned_participants.append(cleaned)
                
                sanitized['participants'] = cleaned_participants
        
        return sanitized, all_warnings
    
    def provide_graceful_degradation(
        self,
        error: Exception,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Provide graceful degradation when scaling fails.
        
        Args:
            error: The exception that occurred
            context: Context information about the scaling operation
            
        Returns:
            Fallback response data
        """
        logger.error(f"Scaling failed, providing graceful degradation: {error}")
        
        # Extract what we can from context
        recipe_id = context.get('recipe_id', 'unknown')
        recipe_name = context.get('recipe_name', 'Unknown Recipe')
        original_servings = context.get('original_servings', self.DEFAULT_SERVINGS)
        
        # Provide a safe fallback response
        return {
            'recipe_id': str(recipe_id),
            'recipe_name': recipe_name,
            'original_servings': original_servings,
            'target_servings': original_servings,
            'scaling_factor': 1.0,
            'ingredients': context.get('ingredients', []),
            'warnings': [
                "Scaling operation failed - returning original quantities",
                f"Error: {str(error)}",
                "Please check your input and try again"
            ],
            'error': str(error),
            'degraded': True
        }


def handle_scaling_edge_cases(
    operation_type: str,
    data: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str], Optional[str]]:
    """
    Convenience function to handle edge cases in scaling operations.
    
    Args:
        operation_type: Type of edge case to handle
        data: Data related to the edge case
        
    Returns:
        Tuple of (modified data, warnings, error message)
    """
    handler = ScalingEdgeCaseHandler()
    
    if operation_type == "zero_participants":
        result = handler.handle_zero_participants(
            data.get('target_participants', 0),
            data.get('original_servings', 4)
        )
    
    elif operation_type == "fractional_servings":
        result = handler.handle_fractional_servings(
            data.get('servings', 0)
        )
    
    elif operation_type == "missing_nutrition":
        result = handler.handle_missing_nutritional_data(data)
    
    elif operation_type == "invalid_coefficient":
        result = handler.handle_invalid_coefficient(
            data.get('coefficient'),
            data.get('name')
        )
    
    elif operation_type == "extreme_scaling":
        result = handler.handle_extreme_scaling_factor(
            data.get('scaling_factor', 1)
        )
    
    elif operation_type == "sanitize_request":
        sanitized, warnings = handler.sanitize_scaling_request(
            data.get('request', {}),
            data.get('request_type', 'basic')
        )
        return sanitized, warnings, None
    
    elif operation_type == "graceful_degradation":
        fallback = handler.provide_graceful_degradation(
            data.get('error', Exception("Unknown error")),
            data.get('context', {})
        )
        return fallback, ["Graceful degradation applied"], None
    
    else:
        return data, [], f"Unknown edge case type: {operation_type}"
    
    # Process result
    if result.handled:
        modified_data = result.modified_input or data
        return modified_data, result.warnings, result.error_message
    else:
        return data, [], None