"""Recipe scaling utilities for the Jidelnicek application.

This module provides functionality to scale recipe quantities based on the number
of servings or participants. It maintains high precision using Decimal arithmetic
to ensure accurate scaling of ingredient quantities.
"""

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional, List, Dict, Any, Union, Tuple
from datetime import date

from jidelnicek.core.exceptions import ValidationError
from jidelnicek.recipe.utils.rounding import SmartRounder
from jidelnicek.recipe.utils.constraints import ScalingConstraints, ScalingValidationResult


class RecipeScaler:
    """Handles recipe scaling calculations with high precision.
    
    This class provides methods to calculate scaling factors and scale ingredient
    quantities while maintaining at least 4 decimal places of precision. All
    calculations use Decimal arithmetic to avoid floating-point precision issues.
    
    Example:
        >>> scaler = RecipeScaler()
        >>> factor = scaler.calculate_base_scaling_factor(4, 6)
        >>> print(factor)  # Decimal('1.5000')
        >>> scaled_qty = scaler.scale_ingredient_quantity(Decimal('200'), factor)
        >>> print(scaled_qty)  # Decimal('300.0000')
    """
    
    # Default precision for calculations (4 decimal places)
    PRECISION = Decimal('0.0001')
    
    def __init__(
        self, 
        use_rounding: bool = False,
        use_constraints: bool = True,
        constraints: Optional[ScalingConstraints] = None
    ):
        """Initialize the RecipeScaler.
        
        Args:
            use_rounding: Whether to use smart rounding for ingredient quantities.
            use_constraints: Whether to enforce scaling constraints.
            constraints: Custom constraints instance (uses defaults if None).
        """
        self.use_rounding = use_rounding
        self.rounder = SmartRounder() if use_rounding else None
        self.use_constraints = use_constraints
        self.constraints = constraints if constraints is not None else ScalingConstraints()
    
    def calculate_base_scaling_factor(
        self, 
        original_servings: int, 
        target_participants: int
    ) -> Decimal:
        """Calculate the scaling factor for adjusting recipe quantities.
        
        The scaling factor is calculated as:
            scaling_factor = target_participants / original_servings
        
        Args:
            original_servings: The number of servings the original recipe yields.
            target_participants: The desired number of participants to serve.
            
        Returns:
            Decimal: The scaling factor with at least 4 decimal places of precision.
            
        Raises:
            ValidationError: If original_servings is zero or negative, or if
                target_participants is negative.
                
        Example:
            >>> scaler = RecipeScaler()
            >>> scaler.calculate_base_scaling_factor(4, 6)
            Decimal('1.5000')
            >>> scaler.calculate_base_scaling_factor(8, 2)
            Decimal('0.2500')
        """
        # Validate inputs
        if original_servings <= 0:
            raise ValidationError(
                "Original servings must be a positive integer, "
                f"got {original_servings}"
            )
        
        if target_participants < 0:
            raise ValidationError(
                "Target participants must be non-negative, "
                f"got {target_participants}"
            )
        
        # Handle special case where target is zero (no scaling needed)
        if target_participants == 0:
            return Decimal('0')
        
        # Convert to Decimal for precise calculation
        original = Decimal(str(original_servings))
        target = Decimal(str(target_participants))
        
        # Calculate scaling factor with proper precision
        scaling_factor = target / original
        
        # Quantize to ensure consistent precision
        return scaling_factor.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
    
    def scale_ingredient_quantity(
        self, 
        quantity: Decimal, 
        scaling_factor: Decimal
    ) -> Decimal:
        """Scale an ingredient quantity by the given scaling factor.
        
        Multiplies the quantity by the scaling factor while maintaining
        precision. The result is rounded to 4 decimal places using
        ROUND_HALF_UP rounding.
        
        Args:
            quantity: The original ingredient quantity as a Decimal.
            scaling_factor: The scaling factor to apply.
            
        Returns:
            Decimal: The scaled quantity with at least 4 decimal places.
            
        Raises:
            ValidationError: If quantity is negative or if inputs are invalid.
            
        Example:
            >>> scaler = RecipeScaler()
            >>> scaler.scale_ingredient_quantity(Decimal('250'), Decimal('1.5'))
            Decimal('375.0000')
            >>> scaler.scale_ingredient_quantity(Decimal('0.75'), Decimal('2'))
            Decimal('1.5000')
        """
        try:
            # Ensure both values are Decimals first
            if not isinstance(quantity, Decimal):
                quantity = Decimal(str(quantity))
            if not isinstance(scaling_factor, Decimal):
                scaling_factor = Decimal(str(scaling_factor))
            
            # Now validate
            if quantity < 0:
                raise ValidationError(
                    f"Quantity must be non-negative, got {quantity}"
                )
            
            if scaling_factor < 0:
                raise ValidationError(
                    f"Scaling factor must be non-negative, got {scaling_factor}"
                )
            
            # Calculate scaled quantity
            scaled_quantity = quantity * scaling_factor
            
            # Quantize to ensure consistent precision
            return scaled_quantity.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
            
        except (InvalidOperation, ValueError) as e:
            raise ValidationError(f"Invalid input for scaling: {e}")
    
    def scale_recipe(
        self,
        original_servings: int,
        target_participants: int,
        ingredient_quantities: list[Decimal]
    ) -> tuple[Decimal, list[Decimal]]:
        """Convenience method to scale an entire recipe.
        
        Calculates the scaling factor and applies it to all ingredient quantities
        in one operation.
        
        Args:
            original_servings: The number of servings the original recipe yields.
            target_participants: The desired number of participants to serve.
            ingredient_quantities: List of ingredient quantities to scale.
            
        Returns:
            tuple: A tuple containing:
                - The scaling factor (Decimal)
                - List of scaled quantities (list[Decimal])
                
        Example:
            >>> scaler = RecipeScaler()
            >>> factor, scaled = scaler.scale_recipe(
            ...     4, 6, [Decimal('200'), Decimal('100'), Decimal('50')]
            ... )
            >>> print(factor)  # Decimal('1.5000')
            >>> print(scaled)  # [Decimal('300.0000'), Decimal('150.0000'), Decimal('75.0000')]
        """
        scaling_factor = self.calculate_base_scaling_factor(
            original_servings, target_participants
        )
        
        scaled_quantities = [
            self.scale_ingredient_quantity(qty, scaling_factor)
            for qty in ingredient_quantities
        ]
        
        return scaling_factor, scaled_quantities
    
    def scale_and_round_recipe(
        self,
        original_servings: int,
        target_participants: int,
        ingredients: List[Dict[str, Any]]
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """Scale and intelligently round a recipe's ingredients.
        
        This method combines scaling with smart rounding to produce practical
        quantities for cooking. It scales all ingredients first, then applies
        intelligent rounding based on units and quantity ranges.
        
        Args:
            original_servings: The number of servings the original recipe yields.
            target_participants: The desired number of participants to serve.
            ingredients: List of ingredient dictionaries containing:
                - quantity: The amount as Decimal or convertible to Decimal
                - unit: The unit of measurement (e.g., 'g', 'ml', 'piece')
                - ingredient_type: Optional type hint (e.g., 'spice')
                - name: Optional ingredient name
                - Other fields that will be preserved
                
        Returns:
            tuple: A tuple containing:
                - The scaling factor (Decimal)
                - List of ingredient dictionaries with scaled and rounded quantities
                
        Raises:
            ValidationError: If ingredients data is invalid.
            
        Example:
            >>> scaler = RecipeScaler(use_rounding=True)
            >>> ingredients = [
            ...     {'name': 'Flour', 'quantity': Decimal('158'), 'unit': 'g'},
            ...     {'name': 'Eggs', 'quantity': Decimal('1.5'), 'unit': 'piece'},
            ...     {'name': 'Vanilla', 'quantity': Decimal('1.2'), 'unit': 'tsp'}
            ... ]
            >>> factor, rounded = scaler.scale_and_round_recipe(4, 6, ingredients)
            >>> # Flour: 237g -> 240g, Eggs: 2.25 -> 3, Vanilla: 1.8 -> 2 tsp
        """
        # First calculate the scaling factor
        scaling_factor = self.calculate_base_scaling_factor(
            original_servings, target_participants
        )
        
        # Scale all ingredients
        scaled_ingredients = []
        for idx, ingredient in enumerate(ingredients):
            if not isinstance(ingredient, dict):
                raise ValidationError(f"Ingredient at index {idx} must be a dictionary")
            
            if 'quantity' not in ingredient:
                raise ValidationError(f"Ingredient at index {idx} missing 'quantity' field")
            if 'unit' not in ingredient:
                raise ValidationError(f"Ingredient at index {idx} missing 'unit' field")
            
            # Copy the ingredient to avoid modifying the original
            scaled_ingredient = ingredient.copy()
            
            # Get and scale the quantity
            original_quantity = ingredient['quantity']
            if not isinstance(original_quantity, Decimal):
                original_quantity = Decimal(str(original_quantity))
            
            scaled_quantity = self.scale_ingredient_quantity(
                original_quantity, scaling_factor
            )
            
            # Apply rounding if enabled
            if self.use_rounding and self.rounder:
                ingredient_type = ingredient.get('ingredient_type', None)
                rounded_quantity = self.rounder.round_quantity(
                    scaled_quantity, 
                    ingredient['unit'],
                    ingredient_type
                )
                scaled_ingredient['quantity'] = rounded_quantity
                
                # Add metadata about the transformation
                scaled_ingredient['original_quantity'] = original_quantity
                scaled_ingredient['scaled_quantity'] = scaled_quantity
                if rounded_quantity != scaled_quantity:
                    scaled_ingredient['was_rounded'] = True
            else:
                scaled_ingredient['quantity'] = scaled_quantity
                scaled_ingredient['original_quantity'] = original_quantity
            
            scaled_ingredients.append(scaled_ingredient)
        
        return scaling_factor, scaled_ingredients
    
    def validate_and_apply_constraints(
        self, 
        scaling_factor: Decimal
    ) -> Tuple[Decimal, List[str]]:
        """Validate scaling factor and apply constraints if enabled.
        
        Args:
            scaling_factor: The scaling factor to validate
            
        Returns:
            Tuple of (possibly adjusted scaling factor, list of warnings)
        """
        if not self.use_constraints:
            return scaling_factor, []
        
        validation_result = self.constraints.validate_scaling_factor(scaling_factor)
        return validation_result.clamped_factor, validation_result.warnings
    
    def scale_recipe_with_constraints(
        self,
        original_servings: int,
        target_participants: int,
        ingredient_quantities: List[Decimal],
        enforce_constraints: Optional[bool] = None
    ) -> Tuple[Decimal, List[Decimal], List[str]]:
        """Scale a recipe with constraint enforcement.
        
        This method calculates the scaling factor, validates it against constraints,
        and applies the possibly adjusted factor to all ingredients.
        
        Args:
            original_servings: The number of servings the original recipe yields.
            target_participants: The desired number of participants to serve.
            ingredient_quantities: List of ingredient quantities to scale.
            enforce_constraints: Override instance setting for constraint enforcement.
            
        Returns:
            Tuple containing:
                - The (possibly adjusted) scaling factor (Decimal)
                - List of scaled quantities (List[Decimal])
                - List of warning messages (List[str])
                
        Example:
            >>> scaler = RecipeScaler(use_constraints=True)
            >>> factor, scaled, warnings = scaler.scale_recipe_with_constraints(
            ...     4, 1, [Decimal('200'), Decimal('100')]
            ... )
            >>> print(factor)  # Decimal('0.2500')
            >>> print(warnings)  # ['Scaling down to 25% may result in...']
        """
        # Calculate raw scaling factor
        raw_factor = self.calculate_base_scaling_factor(
            original_servings, target_participants
        )
        
        # Apply constraints if enabled
        use_constraints = self.use_constraints if enforce_constraints is None else enforce_constraints
        if use_constraints:
            adjusted_factor, warnings = self.validate_and_apply_constraints(raw_factor)
        else:
            adjusted_factor, warnings = raw_factor, []
        
        # Scale quantities with adjusted factor
        scaled_quantities = [
            self.scale_ingredient_quantity(qty, adjusted_factor)
            for qty in ingredient_quantities
        ]
        
        return adjusted_factor, scaled_quantities, warnings
    
    def calculate_base_scaling_factor_with_validation(
        self, 
        original_servings: int, 
        target_participants: int
    ) -> Tuple[Decimal, ScalingValidationResult]:
        """Calculate scaling factor with constraint validation.
        
        This method extends calculate_base_scaling_factor to include
        constraint validation results.
        
        Args:
            original_servings: The number of servings the original recipe yields.
            target_participants: The desired number of participants to serve.
            
        Returns:
            Tuple of (scaling factor, validation result)
        """
        factor = self.calculate_base_scaling_factor(original_servings, target_participants)
        
        if self.use_constraints:
            validation_result = self.constraints.validate_scaling_factor(factor)
        else:
            # Create a dummy result when constraints are disabled
            validation_result = ScalingValidationResult(
                is_valid=True,
                clamped_factor=factor,
                warnings=[]
            )
        
        return factor, validation_result


class CalorieScaler(RecipeScaler):
    """Handles calorie-based recipe scaling calculations with high precision.
    
    This class extends RecipeScaler to provide calorie-based scaling functionality,
    allowing recipes to be scaled to meet specific calorie targets while maintaining
    at least 4 decimal places of precision. All calculations use Decimal arithmetic
    to ensure 99.9% accuracy.
    
    Example:
        >>> scaler = CalorieScaler()
        >>> total_calories = scaler.calculate_recipe_calories(ingredients)
        >>> per_serving = scaler.calculate_calories_per_serving(total_calories, 4)
        >>> factor = scaler.calculate_calorie_based_scaling_factor(total_calories, Decimal('600'))
        >>> scaled_recipe = scaler.scale_recipe_to_target_calories(recipe_data, Decimal('600'))
    """
    
    def calculate_recipe_calories(self, ingredients: List[Dict[str, Any]]) -> Decimal:
        """Calculate total calories for a recipe from its ingredients.
        
        Each ingredient should have:
        - quantity: The amount of ingredient (Decimal or convertible to Decimal)
        - unit: The unit of measurement
        - nutritional_data: Dict containing 'calories' per 100g
        - unit_conversions: Optional dict for unit to gram conversions
        
        Args:
            ingredients: List of ingredient dictionaries with quantity, unit, and nutritional data.
            
        Returns:
            Decimal: Total calories for the recipe with at least 4 decimal places of precision.
            
        Raises:
            ValidationError: If ingredient data is invalid or missing required fields.
            
        Example:
            >>> ingredients = [
            ...     {
            ...         'quantity': Decimal('200'),
            ...         'unit': 'g',
            ...         'nutritional_data': {'calories': 250}  # per 100g
            ...     },
            ...     {
            ...         'quantity': Decimal('100'),
            ...         'unit': 'ml',
            ...         'nutritional_data': {'calories': 50},
            ...         'unit_conversions': {'ml_to_g': 1.03}  # milk density
            ...     }
            ... ]
            >>> scaler = CalorieScaler()
            >>> total = scaler.calculate_recipe_calories(ingredients)
            >>> print(total)  # Decimal('551.5000')
        """
        if not ingredients:
            return Decimal('0')
        
        total_calories = Decimal('0')
        
        for idx, ingredient in enumerate(ingredients):
            try:
                # Validate required fields
                if 'quantity' not in ingredient:
                    raise ValidationError(f"Ingredient at index {idx} missing 'quantity' field")
                if 'unit' not in ingredient:
                    raise ValidationError(f"Ingredient at index {idx} missing 'unit' field")
                if 'nutritional_data' not in ingredient:
                    raise ValidationError(f"Ingredient at index {idx} missing 'nutritional_data' field")
                
                # Get nutritional data
                nutritional_data = ingredient.get('nutritional_data', {})
                if not isinstance(nutritional_data, dict):
                    raise ValidationError(f"Ingredient at index {idx} has invalid nutritional_data format")
                
                # Skip if no calorie data
                if 'calories' not in nutritional_data:
                    continue  # Skip ingredients without calorie data
                
                # Convert quantity to Decimal
                quantity = Decimal(str(ingredient['quantity']))
                if quantity < 0:
                    raise ValidationError(f"Ingredient at index {idx} has negative quantity")
                
                # Get calories per 100g
                calories_per_100g = Decimal(str(nutritional_data['calories']))
                if calories_per_100g < 0:
                    raise ValidationError(f"Ingredient at index {idx} has negative calories")
                
                # Convert to grams based on unit
                unit = ingredient['unit']
                grams = self._convert_to_grams(quantity, unit, ingredient.get('unit_conversions', {}))
                
                # Calculate calories for this ingredient
                ingredient_calories = (grams * calories_per_100g) / Decimal('100')
                total_calories += ingredient_calories
                
            except (InvalidOperation, ValueError, KeyError) as e:
                raise ValidationError(f"Error processing ingredient at index {idx}: {e}")
        
        # Quantize to ensure consistent precision
        return total_calories.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
    
    def _convert_to_grams(self, quantity: Decimal, unit: str, unit_conversions: Dict[str, Any]) -> Decimal:
        """Convert a quantity from its unit to grams.
        
        Args:
            quantity: The amount to convert.
            unit: The unit of measurement.
            unit_conversions: Optional conversion factors for this ingredient.
            
        Returns:
            Decimal: The quantity in grams.
            
        Raises:
            ValidationError: If conversion is not possible.
        """
        # Direct gram units
        if unit == 'g':
            return quantity
        elif unit == 'kg':
            return quantity * Decimal('1000')
        
        # Volume units - check for specific conversion factor
        elif unit in ['ml', 'l']:
            # Convert liters to ml first
            ml_amount = quantity * Decimal('1000') if unit == 'l' else quantity
            
            # Use specific conversion factor if available
            if 'ml_to_g' in unit_conversions:
                conversion_factor = Decimal(str(unit_conversions['ml_to_g']))
                return ml_amount * conversion_factor
            else:
                # Default to water density (1g/ml)
                return ml_amount
        
        # Common volume measurements
        elif unit in ['cup', 'tbsp', 'tsp']:
            ml_conversions = {
                'cup': Decimal('240'),
                'tbsp': Decimal('15'),
                'tsp': Decimal('5')
            }
            ml_amount = quantity * ml_conversions[unit]
            
            # Use specific conversion factor if available
            if 'ml_to_g' in unit_conversions:
                conversion_factor = Decimal(str(unit_conversions['ml_to_g']))
                return ml_amount * conversion_factor
            else:
                # Default to water density
                return ml_amount
        
        # Pieces - need specific conversion
        elif unit == 'piece':
            if 'piece_to_g' in unit_conversions:
                conversion_factor = Decimal(str(unit_conversions['piece_to_g']))
                return quantity * conversion_factor
            else:
                raise ValidationError(f"Cannot convert pieces to grams without conversion factor")
        
        else:
            raise ValidationError(f"Unknown unit: {unit}")
    
    def calculate_calories_per_serving(self, total_calories: Decimal, servings: int) -> Decimal:
        """Calculate calories per serving from total recipe calories.
        
        Args:
            total_calories: Total calories in the recipe.
            servings: Number of servings the recipe yields.
            
        Returns:
            Decimal: Calories per serving with at least 4 decimal places of precision.
            
        Raises:
            ValidationError: If servings is zero or negative, or if total_calories is negative.
            
        Example:
            >>> scaler = CalorieScaler()
            >>> per_serving = scaler.calculate_calories_per_serving(Decimal('2400'), 6)
            >>> print(per_serving)  # Decimal('400.0000')
        """
        # Validate inputs
        if not isinstance(total_calories, Decimal):
            total_calories = Decimal(str(total_calories))
        
        if total_calories < 0:
            raise ValidationError(f"Total calories must be non-negative, got {total_calories}")
        
        if servings <= 0:
            raise ValidationError(f"Servings must be positive, got {servings}")
        
        # Calculate calories per serving
        calories_per_serving = total_calories / Decimal(str(servings))
        
        # Quantize to ensure consistent precision
        return calories_per_serving.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
    
    def calculate_calorie_based_scaling_factor(
        self, 
        recipe_calories: Decimal, 
        target_calories: Decimal
    ) -> Decimal:
        """Calculate scaling factor to achieve target calories.
        
        The scaling factor is calculated as:
            scaling_factor = target_calories / recipe_calories
        
        Args:
            recipe_calories: Current total calories in the recipe.
            target_calories: Desired total calories after scaling.
            
        Returns:
            Decimal: The scaling factor with at least 4 decimal places of precision.
            
        Raises:
            ValidationError: If recipe_calories is zero or negative, or if
                target_calories is negative.
                
        Example:
            >>> scaler = CalorieScaler()
            >>> factor = scaler.calculate_calorie_based_scaling_factor(
            ...     Decimal('800'), Decimal('600')
            ... )
            >>> print(factor)  # Decimal('0.7500')
        """
        # Ensure Decimal types
        if not isinstance(recipe_calories, Decimal):
            recipe_calories = Decimal(str(recipe_calories))
        if not isinstance(target_calories, Decimal):
            target_calories = Decimal(str(target_calories))
        
        # Validate inputs
        if recipe_calories <= 0:
            raise ValidationError(
                f"Recipe calories must be positive, got {recipe_calories}"
            )
        
        if target_calories < 0:
            raise ValidationError(
                f"Target calories must be non-negative, got {target_calories}"
            )
        
        # Handle special case where target is zero
        if target_calories == 0:
            return Decimal('0')
        
        # Calculate scaling factor
        scaling_factor = target_calories / recipe_calories
        
        # Quantize to ensure consistent precision
        return scaling_factor.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
    
    def scale_recipe_to_target_calories(
        self, 
        recipe_data: Dict[str, Any], 
        target_calories: Decimal,
        target_servings: int = 1
    ) -> Dict[str, Any]:
        """Scale a recipe to meet specific calorie targets.
        
        This method scales all ingredient quantities to achieve the target calories
        while optionally adjusting for a different number of servings.
        
        Args:
            recipe_data: Dictionary containing:
                - ingredients: List of ingredient dicts with quantity, unit, nutritional_data
                - servings: Original number of servings (optional, defaults to 1)
                - Other recipe fields that will be preserved
            target_calories: Desired total calories for the scaled recipe.
            target_servings: Desired number of servings (defaults to original servings).
            
        Returns:
            Dict containing:
                - All original recipe fields
                - scaled_ingredients: List of ingredients with scaled quantities
                - scaling_factor: The applied scaling factor
                - total_calories: Calculated total calories
                - calories_per_serving: Calories per serving
                - servings: Target servings
                
        Raises:
            ValidationError: If recipe data is invalid or scaling cannot be performed.
            
        Example:
            >>> recipe_data = {
            ...     'name': 'Pasta Dish',
            ...     'servings': 4,
            ...     'ingredients': [
            ...         {
            ...             'name': 'Pasta',
            ...             'quantity': Decimal('400'),
            ...             'unit': 'g',
            ...             'nutritional_data': {'calories': 350}
            ...         }
            ...     ]
            ... }
            >>> scaler = CalorieScaler()
            >>> scaled = scaler.scale_recipe_to_target_calories(
            ...     recipe_data, Decimal('1050'), target_servings=3
            ... )
            >>> print(scaled['scaling_factor'])  # Decimal('0.7500')
            >>> print(scaled['calories_per_serving'])  # Decimal('350.0000')
        """
        # Validate recipe data
        if not isinstance(recipe_data, dict):
            raise ValidationError("Recipe data must be a dictionary")
        
        if 'ingredients' not in recipe_data:
            raise ValidationError("Recipe data must contain 'ingredients' field")
        
        ingredients = recipe_data['ingredients']
        if not isinstance(ingredients, list):
            raise ValidationError("Ingredients must be a list")
        
        if not ingredients:
            raise ValidationError("Recipe must have at least one ingredient")
        
        # Get original servings
        original_servings = recipe_data.get('servings', 1)
        if original_servings <= 0:
            raise ValidationError(f"Original servings must be positive, got {original_servings}")
        
        # Use original servings if target not specified
        if target_servings <= 0:
            target_servings = original_servings
        
        # Ensure target_calories is Decimal
        if not isinstance(target_calories, Decimal):
            target_calories = Decimal(str(target_calories))
        
        # Calculate current recipe calories
        current_calories = self.calculate_recipe_calories(ingredients)
        
        if current_calories == 0:
            raise ValidationError("Recipe has no calorie information")
        
        # Calculate scaling factor based on calories
        calorie_scaling_factor = self.calculate_calorie_based_scaling_factor(
            current_calories, target_calories
        )
        
        # Scale all ingredient quantities
        scaled_ingredients = []
        for ingredient in ingredients:
            scaled_ingredient = ingredient.copy()
            
            # Scale the quantity
            original_quantity = Decimal(str(ingredient['quantity']))
            scaled_quantity = self.scale_ingredient_quantity(
                original_quantity, calorie_scaling_factor
            )
            scaled_ingredient['quantity'] = scaled_quantity
            
            scaled_ingredients.append(scaled_ingredient)
        
        # Calculate final calories (should match target within precision)
        final_calories = self.calculate_recipe_calories(scaled_ingredients)
        calories_per_serving = self.calculate_calories_per_serving(
            final_calories, target_servings
        )
        
        # Build result dictionary
        result = recipe_data.copy()
        result.update({
            'scaled_ingredients': scaled_ingredients,
            'scaling_factor': calorie_scaling_factor,
            'total_calories': final_calories,
            'calories_per_serving': calories_per_serving,
            'servings': target_servings
        })
        
        return result


class ParticipantScaler(CalorieScaler):
    """Handles participant-based recipe scaling with coefficient support.
    
    This class extends CalorieScaler to provide participant-based scaling functionality,
    incorporating participant coefficients (e.g., children eat 75%, athletes eat 150%)
    and meal-specific variations. It integrates both participant-based and calorie-based
    scaling approaches.
    
    Example:
        >>> scaler = ParticipantScaler()
        >>> participants = [
        ...     {'name': 'Adult', 'coefficient': 100},
        ...     {'name': 'Child', 'coefficient': 75},
        ...     {'name': 'Athlete', 'coefficient': 150}
        ... ]
        >>> effective = scaler.calculate_effective_participants(participants)
        >>> print(effective)  # Decimal('3.2500')
        >>> scaled = scaler.scale_recipe_for_participants(recipe_data, participants)
    """
    
    def calculate_effective_participants(
        self, 
        participants: List[Dict[str, Any]], 
        meal_type: Optional[str] = None
    ) -> Decimal:
        """Calculate effective participant count considering coefficients.
        
        Converts a list of participants with individual coefficients into an
        effective participant count. For example, 2 adults (100%) + 1 child (75%)
        = 2.75 effective participants.
        
        Args:
            participants: List of participant dictionaries, each containing:
                - coefficient: Base coefficient as percentage (100 = 100%)
                - meal_coefficients: Optional dict of meal-specific coefficients
                - attendance_start: Optional start date for partial attendance
                - attendance_end: Optional end date for partial attendance
                - attendance_factor: Optional pre-calculated attendance factor (0-1)
            meal_type: Optional meal type (e.g., 'Breakfast', 'Lunch', 'Dinner')
                      to use meal-specific coefficients if available.
                      
        Returns:
            Decimal: Effective participant count with at least 4 decimal places.
            
        Raises:
            ValidationError: If participant data is invalid or coefficients are negative.
            
        Example:
            >>> participants = [
            ...     {'name': 'Adult 1', 'coefficient': 100},
            ...     {'name': 'Adult 2', 'coefficient': 100, 
            ...      'meal_coefficients': {'Breakfast': 75, 'Lunch': 100, 'Dinner': 125}},
            ...     {'name': 'Child', 'coefficient': 75}
            ... ]
            >>> scaler = ParticipantScaler()
            >>> # General calculation
            >>> scaler.calculate_effective_participants(participants)
            Decimal('2.7500')
            >>> # Breakfast-specific
            >>> scaler.calculate_effective_participants(participants, 'Breakfast')
            Decimal('2.5000')  # Adult 2 only counts as 75% for breakfast
        """
        if not participants:
            return Decimal('0')
        
        effective_count = Decimal('0')
        
        for idx, participant in enumerate(participants):
            try:
                # Validate participant data
                if not isinstance(participant, dict):
                    raise ValidationError(f"Participant at index {idx} must be a dictionary")
                
                # Get base coefficient
                if 'coefficient' not in participant:
                    raise ValidationError(f"Participant at index {idx} missing 'coefficient' field")
                
                base_coefficient = Decimal(str(participant['coefficient']))
                
                if base_coefficient < 0:
                    raise ValidationError(
                        f"Participant at index {idx} has negative coefficient: {base_coefficient}"
                    )
                
                # Check for meal-specific coefficient
                coefficient = base_coefficient
                if meal_type and 'meal_coefficients' in participant:
                    meal_coeffs = participant['meal_coefficients']
                    if isinstance(meal_coeffs, dict) and meal_type in meal_coeffs:
                        meal_coefficient = Decimal(str(meal_coeffs[meal_type]))
                        if meal_coefficient < 0:
                            raise ValidationError(
                                f"Participant at index {idx} has negative meal coefficient "
                                f"for {meal_type}: {meal_coefficient}"
                            )
                        coefficient = meal_coefficient
                
                # Apply attendance factor if present
                attendance_factor = Decimal('1')
                if 'attendance_factor' in participant:
                    attendance_factor = Decimal(str(participant['attendance_factor']))
                    if not (0 <= attendance_factor <= 1):
                        raise ValidationError(
                            f"Participant at index {idx} has invalid attendance factor: "
                            f"{attendance_factor} (must be between 0 and 1)"
                        )
                
                # Calculate effective portion (coefficient as decimal)
                effective_portion = (coefficient / Decimal('100')) * attendance_factor
                effective_count += effective_portion
                
            except (InvalidOperation, ValueError, KeyError) as e:
                raise ValidationError(f"Error processing participant at index {idx}: {e}")
        
        # Quantize to ensure consistent precision
        return effective_count.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
    
    def calculate_attendance_factor(
        self,
        start_date: Union[date, str],
        end_date: Union[date, str],
        trip_start: Union[date, str],
        trip_end: Union[date, str]
    ) -> Decimal:
        """Calculate attendance factor for partial trip participation.
        
        Calculates the fraction of the trip that a participant will attend,
        useful for scaling recipes when participants arrive late or leave early.
        
        Args:
            start_date: Participant's arrival date
            end_date: Participant's departure date  
            trip_start: Trip start date
            trip_end: Trip end date
            
        Returns:
            Decimal: Attendance factor between 0 and 1
            
        Example:
            >>> # Participant attending 3 days of a 5-day trip
            >>> factor = scaler.calculate_attendance_factor(
            ...     '2024-01-02', '2024-01-04', '2024-01-01', '2024-01-05'
            ... )
            >>> print(factor)  # Decimal('0.6000')
        """
        # Convert strings to dates if needed
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)
        if isinstance(trip_start, str):
            trip_start = date.fromisoformat(trip_start)
        if isinstance(trip_end, str):
            trip_end = date.fromisoformat(trip_end)
        
        # Validate date ranges
        if start_date > end_date:
            raise ValidationError(f"Start date {start_date} is after end date {end_date}")
        if trip_start > trip_end:
            raise ValidationError(f"Trip start {trip_start} is after trip end {trip_end}")
        
        # Calculate overlap
        overlap_start = max(start_date, trip_start)
        overlap_end = min(end_date, trip_end)
        
        if overlap_start > overlap_end:
            # No overlap
            return Decimal('0')
        
        # Calculate days
        participant_days = (overlap_end - overlap_start).days + 1
        total_trip_days = (trip_end - trip_start).days + 1
        
        if total_trip_days <= 0:
            raise ValidationError("Trip duration must be at least 1 day")
        
        # Calculate factor
        factor = Decimal(str(participant_days)) / Decimal(str(total_trip_days))
        
        # Quantize to ensure consistent precision
        return factor.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
    
    def scale_recipe_for_participants(
        self,
        recipe_data: Dict[str, Any],
        participants: List[Dict[str, Any]],
        meal_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scale a recipe based on participant coefficients.
        
        Scales recipe quantities to accommodate the effective number of participants,
        considering individual coefficients and optional meal-specific variations.
        
        Args:
            recipe_data: Dictionary containing:
                - ingredients: List of ingredient dicts with quantity and unit
                - servings: Original number of servings
                - Other recipe fields that will be preserved
            participants: List of participant dictionaries with coefficients
            meal_type: Optional meal type for meal-specific coefficients
            
        Returns:
            Dict containing:
                - All original recipe fields
                - scaled_ingredients: List of ingredients with scaled quantities
                - scaling_factor: The applied scaling factor
                - effective_participants: Calculated effective participant count
                - servings: Updated to match effective participants
                
        Raises:
            ValidationError: If recipe data or participant data is invalid.
            
        Example:
            >>> recipe_data = {
            ...     'name': 'Pasta',
            ...     'servings': 4,
            ...     'ingredients': [
            ...         {'name': 'Pasta', 'quantity': Decimal('400'), 'unit': 'g'}
            ...     ]
            ... }
            >>> participants = [
            ...     {'name': 'Adult', 'coefficient': 100},
            ...     {'name': 'Child', 'coefficient': 75}
            ... ]
            >>> result = scaler.scale_recipe_for_participants(recipe_data, participants)
            >>> print(result['effective_participants'])  # Decimal('1.7500')
            >>> print(result['scaling_factor'])  # Decimal('0.4375')
        """
        # Validate recipe data
        if not isinstance(recipe_data, dict):
            raise ValidationError("Recipe data must be a dictionary")
        
        if 'ingredients' not in recipe_data:
            raise ValidationError("Recipe data must contain 'ingredients' field")
        
        ingredients = recipe_data['ingredients']
        if not isinstance(ingredients, list):
            raise ValidationError("Ingredients must be a list")
        
        if not ingredients:
            raise ValidationError("Recipe must have at least one ingredient")
        
        # Get original servings
        original_servings = recipe_data.get('servings', 1)
        if original_servings <= 0:
            raise ValidationError(f"Original servings must be positive, got {original_servings}")
        
        # Calculate effective participants
        effective_participants = self.calculate_effective_participants(participants, meal_type)
        
        if effective_participants == 0:
            raise ValidationError("Effective participant count is zero")
        
        # Calculate scaling factor
        scaling_factor = self.calculate_base_scaling_factor(
            original_servings,
            int(effective_participants)  # Convert to int for compatibility
        )
        
        # For more precise scaling, recalculate with exact decimal value
        scaling_factor = effective_participants / Decimal(str(original_servings))
        scaling_factor = scaling_factor.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
        
        # Scale all ingredient quantities
        scaled_ingredients = []
        for ingredient in ingredients:
            scaled_ingredient = ingredient.copy()
            
            # Get quantity
            if 'quantity' not in ingredient:
                raise ValidationError(f"Ingredient missing 'quantity' field: {ingredient}")
            
            original_quantity = Decimal(str(ingredient['quantity']))
            scaled_quantity = self.scale_ingredient_quantity(
                original_quantity, scaling_factor
            )
            scaled_ingredient['quantity'] = scaled_quantity
            
            scaled_ingredients.append(scaled_ingredient)
        
        # Build result dictionary
        result = recipe_data.copy()
        result.update({
            'scaled_ingredients': scaled_ingredients,
            'scaling_factor': scaling_factor,
            'effective_participants': effective_participants,
            'servings': effective_participants  # Servings now match effective participants
        })
        
        return result
    
    def scale_recipe_for_participant_calories(
        self,
        recipe_data: Dict[str, Any],
        participants: List[Dict[str, Any]],
        target_calories_per_person: Decimal,
        meal_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scale a recipe to meet calorie targets considering participant coefficients.
        
        Combines calorie-based and participant-based scaling to ensure each
        "standard" participant receives the target calories, with adjustments
        for individual coefficients.
        
        Args:
            recipe_data: Dictionary containing:
                - ingredients: List of ingredient dicts with quantity, unit, nutritional_data
                - servings: Original number of servings
                - Other recipe fields that will be preserved
            participants: List of participant dictionaries with coefficients
            target_calories_per_person: Desired calories per standard participant (100%)
            meal_type: Optional meal type for meal-specific coefficients
            
        Returns:
            Dict containing:
                - All original recipe fields
                - scaled_ingredients: List of ingredients with scaled quantities
                - scaling_factor: The applied scaling factor
                - effective_participants: Calculated effective participant count
                - total_calories: Total calories in scaled recipe
                - calories_per_standard_person: Calories per 100% participant
                - participant_calorie_distribution: Dict of participant to calorie amounts
                
        Raises:
            ValidationError: If recipe data or scaling cannot be performed.
            
        Example:
            >>> recipe_data = {
            ...     'servings': 4,
            ...     'ingredients': [
            ...         {
            ...             'quantity': Decimal('400'),
            ...             'unit': 'g',
            ...             'nutritional_data': {'calories': 350}
            ...         }
            ...     ]
            ... }
            >>> participants = [
            ...     {'name': 'Adult', 'coefficient': 100},
            ...     {'name': 'Child', 'coefficient': 75}
            ... ]
            >>> result = scaler.scale_recipe_for_participant_calories(
            ...     recipe_data, participants, Decimal('500')
            ... )
            >>> # Adult gets 500 calories, child gets 375 calories (75% of 500)
            >>> print(result['total_calories'])  # Decimal('875.0000')
        """
        # First calculate effective participants
        effective_participants = self.calculate_effective_participants(participants, meal_type)
        
        if effective_participants == 0:
            raise ValidationError("Effective participant count is zero")
        
        # Ensure target calories is Decimal
        if not isinstance(target_calories_per_person, Decimal):
            target_calories_per_person = Decimal(str(target_calories_per_person))
        
        if target_calories_per_person <= 0:
            raise ValidationError(
                f"Target calories per person must be positive, got {target_calories_per_person}"
            )
        
        # Calculate total target calories
        # This is the total calories needed for all participants considering coefficients
        total_target_calories = target_calories_per_person * effective_participants
        
        # Use parent class to scale to total calorie target
        scaled_result = self.scale_recipe_to_target_calories(
            recipe_data,
            total_target_calories,
            target_servings=int(effective_participants)
        )
        
        # Calculate calorie distribution among participants
        participant_calorie_distribution = []
        for participant in participants:
            # Get coefficient for this meal type
            coefficient = Decimal(str(participant['coefficient']))
            if meal_type and 'meal_coefficients' in participant:
                meal_coeffs = participant['meal_coefficients']
                if isinstance(meal_coeffs, dict) and meal_type in meal_coeffs:
                    coefficient = Decimal(str(meal_coeffs[meal_type]))
            
            # Apply attendance factor if present
            attendance_factor = Decimal('1')
            if 'attendance_factor' in participant:
                attendance_factor = Decimal(str(participant['attendance_factor']))
            
            # Calculate calories for this participant
            participant_calories = (
                target_calories_per_person * 
                (coefficient / Decimal('100')) * 
                attendance_factor
            )
            
            participant_calorie_distribution.append({
                'name': participant.get('name', f"Participant {participants.index(participant) + 1}"),
                'coefficient': float(coefficient),
                'attendance_factor': float(attendance_factor),
                'calories': participant_calories.quantize(self.PRECISION, rounding=ROUND_HALF_UP)
            })
        
        # Update result with participant-specific information
        scaled_result.update({
            'effective_participants': effective_participants,
            'calories_per_standard_person': target_calories_per_person,
            'participant_calorie_distribution': participant_calorie_distribution
        })
        
        return scaled_result