"""Intelligent rounding utilities for recipe scaling.

This module provides smart rounding functionality that considers practical cooking
measurements and ingredient types. It ensures scaled quantities remain usable in
real-world cooking scenarios while maintaining accuracy.
"""

from decimal import Decimal, ROUND_UP
from typing import Dict, List, Any, Optional, Union


class SmartRounder:
    """Handles intelligent rounding of recipe quantities based on practical cooking needs.
    
    This class provides context-aware rounding that considers:
    - Ingredient units (weight, volume, count)
    - Quantity ranges (small amounts need finer precision)
    - Special units (tablespoons, teaspoons, cups)
    - Ingredient types (spices vs bulk ingredients)
    
    The rounding always rounds UP for safety - it's better to have slightly more
    than to run short of ingredients.
    
    Example:
        >>> rounder = SmartRounder()
        >>> rounder.round_quantity(Decimal('237'), 'ml')  # Round to 240ml
        >>> rounder.round_quantity(Decimal('3.7'), 'piece')  # Round to 4 pieces
        >>> rounder.round_quantity(Decimal('0.33'), 'tsp')  # Round to 0.5 tsp
    """
    
    # Weight rounding rules (grams)
    WEIGHT_RULES = [
        (Decimal('10'), Decimal('1')),      # < 10g: round to 1g
        (Decimal('100'), Decimal('5')),     # 10-100g: round to 5g
        (Decimal('1000'), Decimal('10')),   # 100-1000g: round to 10g
        (Decimal('inf'), Decimal('50'))     # > 1000g: round to 50g
    ]
    
    # Volume rounding rules (milliliters)
    VOLUME_RULES = [
        (Decimal('50'), Decimal('5')),      # < 50ml: round to 5ml
        (Decimal('250'), Decimal('10')),    # 50-250ml: round to 10ml
        (Decimal('1000'), Decimal('25')),   # 250-1000ml: round to 25ml
        (Decimal('inf'), Decimal('50'))     # > 1000ml: round to 50ml
    ]
    
    # Special units that use fractional rounding (1/4 increments)
    FRACTIONAL_UNITS = ['tbsp', 'tsp', 'cup']
    FRACTIONAL_INCREMENT = Decimal('0.25')
    
    # Units that must be whole numbers
    COUNTABLE_UNITS = ['piece', 'pieces', 'egg', 'eggs', 'clove', 'cloves']
    
    # Fine precision units (typically for spices and small amounts)
    FINE_PRECISION_UNITS = ['pinch', 'dash']
    FINE_PRECISION_INCREMENT = Decimal('0.1')
    
    def round_quantity(
        self, 
        quantity: Decimal, 
        unit: str, 
        ingredient_type: Optional[str] = None
    ) -> Decimal:
        """Round a quantity intelligently based on unit and context.
        
        Args:
            quantity: The quantity to round (must be a Decimal).
            unit: The unit of measurement (e.g., 'g', 'ml', 'piece', 'tsp').
            ingredient_type: Optional type hint for special handling (e.g., 'spice').
            
        Returns:
            Decimal: The rounded quantity, always rounded UP for safety.
            
        Example:
            >>> rounder = SmartRounder()
            >>> rounder.round_quantity(Decimal('7.3'), 'g')
            Decimal('8')     # Rounds up to 8g (1g increment for < 10g)
            >>> rounder.round_quantity(Decimal('237'), 'ml')
            Decimal('240')   # Rounds up to 240ml (10ml increment for 50-250ml)
            >>> rounder.round_quantity(Decimal('3.2'), 'piece')
            Decimal('4')     # Rounds up to 4 pieces (whole numbers only)
            >>> rounder.round_quantity(Decimal('1.6'), 'tsp')
            Decimal('1.75')  # Rounds up to 1.75 tsp (0.25 increments)
        """
        # Ensure quantity is a Decimal
        if not isinstance(quantity, Decimal):
            quantity = Decimal(str(quantity))
        
        # Handle zero or negative quantities
        if quantity <= 0:
            return Decimal('0')
        
        # Normalize unit to lowercase for comparison
        unit_lower = unit.lower()
        
        # Check for countable units (must be whole numbers)
        if unit_lower in self.COUNTABLE_UNITS:
            return self._round_to_whole(quantity)
        
        # Check for fractional units (quarters)
        if unit_lower in self.FRACTIONAL_UNITS:
            return self._round_to_fraction(quantity, self.FRACTIONAL_INCREMENT)
        
        # Check for fine precision units
        if unit_lower in self.FINE_PRECISION_UNITS:
            return self._round_to_fraction(quantity, self.FINE_PRECISION_INCREMENT)
        
        # Handle weight units
        if unit_lower in ['g', 'gram', 'grams']:
            return self._apply_weight_rules(quantity)
        elif unit_lower in ['kg', 'kilogram', 'kilograms']:
            # Convert to grams, round, then convert back
            grams = quantity * Decimal('1000')
            rounded_grams = self._apply_weight_rules(grams)
            return rounded_grams / Decimal('1000')
        
        # Handle volume units
        if unit_lower in ['ml', 'milliliter', 'milliliters']:
            return self._apply_volume_rules(quantity)
        elif unit_lower in ['l', 'liter', 'liters']:
            # Convert to ml, round, then convert back
            ml = quantity * Decimal('1000')
            rounded_ml = self._apply_volume_rules(ml)
            return rounded_ml / Decimal('1000')
        
        # Handle special ingredient types
        if ingredient_type and ingredient_type.lower() == 'spice':
            # Spices need finer precision
            if quantity < Decimal('1'):
                return self._round_to_fraction(quantity, Decimal('0.1'))
            elif quantity < Decimal('5'):
                return self._round_to_fraction(quantity, Decimal('0.25'))
            else:
                return self._round_to_fraction(quantity, Decimal('1'))
        
        # Default: round to 1 decimal place for unknown units
        return quantity.quantize(Decimal('0.1'), rounding=ROUND_UP)
    
    def _round_to_whole(self, quantity: Decimal) -> Decimal:
        """Round up to the nearest whole number."""
        return quantity.quantize(Decimal('1'), rounding=ROUND_UP)
    
    def _round_to_fraction(self, quantity: Decimal, increment: Decimal) -> Decimal:
        """Round up to the nearest fraction increment.
        
        Args:
            quantity: The quantity to round.
            increment: The fractional increment (e.g., 0.25 for quarters).
            
        Returns:
            Decimal: The rounded quantity.
        """
        if increment <= 0:
            raise ValueError("Increment must be positive")
        
        # Calculate how many increments fit into the quantity
        increments = quantity / increment
        
        # Round up to the nearest increment
        rounded_increments = increments.quantize(Decimal('1'), rounding=ROUND_UP)
        
        # Convert back to the actual value
        return rounded_increments * increment
    
    def _apply_weight_rules(self, grams: Decimal) -> Decimal:
        """Apply weight-based rounding rules.
        
        Args:
            grams: Weight in grams.
            
        Returns:
            Decimal: Rounded weight in grams.
        """
        for threshold, increment in self.WEIGHT_RULES:
            if grams < threshold or threshold == Decimal('inf'):
                return self._round_to_fraction(grams, increment)
        
        # Should never reach here, but default to 50g increments
        return self._round_to_fraction(grams, Decimal('50'))
    
    def _apply_volume_rules(self, ml: Decimal) -> Decimal:
        """Apply volume-based rounding rules.
        
        Args:
            ml: Volume in milliliters.
            
        Returns:
            Decimal: Rounded volume in milliliters.
        """
        for threshold, increment in self.VOLUME_RULES:
            if ml < threshold or threshold == Decimal('inf'):
                return self._round_to_fraction(ml, increment)
        
        # Should never reach here, but default to 50ml increments
        return self._round_to_fraction(ml, Decimal('50'))
    
    def get_rounding_rules(self) -> Dict[str, Any]:
        """Get the current rounding rules configuration.
        
        Returns:
            Dict containing all rounding rules organized by category.
            
        Example:
            >>> rounder = SmartRounder()
            >>> rules = rounder.get_rounding_rules()
            >>> print(rules['weight_rules'])
            [{'max': 10, 'increment': 1}, {'max': 100, 'increment': 5}, ...]
        """
        return {
            'weight_rules': [
                {
                    'max': float(threshold) if threshold != Decimal('inf') else 'infinity',
                    'increment': float(increment),
                    'unit': 'g'
                }
                for threshold, increment in self.WEIGHT_RULES
            ],
            'volume_rules': [
                {
                    'max': float(threshold) if threshold != Decimal('inf') else 'infinity',
                    'increment': float(increment),
                    'unit': 'ml'
                }
                for threshold, increment in self.VOLUME_RULES
            ],
            'fractional_units': {
                'units': self.FRACTIONAL_UNITS,
                'increment': float(self.FRACTIONAL_INCREMENT)
            },
            'countable_units': {
                'units': self.COUNTABLE_UNITS,
                'increment': 1.0
            },
            'fine_precision_units': {
                'units': self.FINE_PRECISION_UNITS,
                'increment': float(self.FINE_PRECISION_INCREMENT)
            }
        }
    
    def round_recipe_ingredients(
        self, 
        ingredients: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Round all quantities in a list of ingredients.
        
        Each ingredient should have 'quantity' and 'unit' fields. Optional
        'ingredient_type' field can provide hints for better rounding.
        
        Args:
            ingredients: List of ingredient dictionaries.
            
        Returns:
            List of ingredients with rounded quantities.
            
        Raises:
            ValueError: If ingredient data is invalid.
            
        Example:
            >>> ingredients = [
            ...     {'name': 'Flour', 'quantity': Decimal('237'), 'unit': 'g'},
            ...     {'name': 'Eggs', 'quantity': Decimal('2.3'), 'unit': 'piece'},
            ...     {'name': 'Vanilla', 'quantity': Decimal('1.6'), 'unit': 'tsp'}
            ... ]
            >>> rounder = SmartRounder()
            >>> rounded = rounder.round_recipe_ingredients(ingredients)
            >>> # Flour: 240g, Eggs: 3, Vanilla: 1.75 tsp
        """
        if not isinstance(ingredients, list):
            raise ValueError("Ingredients must be a list")
        
        rounded_ingredients = []
        
        for idx, ingredient in enumerate(ingredients):
            if not isinstance(ingredient, dict):
                raise ValueError(f"Ingredient at index {idx} must be a dictionary")
            
            # Validate required fields
            if 'quantity' not in ingredient:
                raise ValueError(f"Ingredient at index {idx} missing 'quantity' field")
            if 'unit' not in ingredient:
                raise ValueError(f"Ingredient at index {idx} missing 'unit' field")
            
            # Copy the ingredient
            rounded_ingredient = ingredient.copy()
            
            # Get quantity and ensure it's a Decimal
            quantity = ingredient['quantity']
            if not isinstance(quantity, Decimal):
                quantity = Decimal(str(quantity))
            
            # Round the quantity
            unit = ingredient['unit']
            ingredient_type = ingredient.get('ingredient_type', None)
            
            rounded_quantity = self.round_quantity(quantity, unit, ingredient_type)
            rounded_ingredient['quantity'] = rounded_quantity
            
            # Add rounding metadata if it changed
            if rounded_quantity != quantity:
                rounded_ingredient['original_quantity'] = quantity
                rounded_ingredient['was_rounded'] = True
            
            rounded_ingredients.append(rounded_ingredient)
        
        return rounded_ingredients


class CustomizableSmartRounder(SmartRounder):
    """Extended SmartRounder that allows customization of rounding rules.
    
    This class extends SmartRounder to allow users to customize the rounding
    rules for different units and ranges, making it adaptable to different
    cooking styles or regional preferences.
    
    Example:
        >>> custom_rounder = CustomizableSmartRounder()
        >>> # Make volume rounding more precise
        >>> custom_rounder.set_volume_rule(Decimal('100'), Decimal('5'))
        >>> # Add custom unit
        >>> custom_rounder.add_custom_unit('dash', Decimal('0.1'))
    """
    
    def __init__(self):
        """Initialize with default rules from parent class."""
        super().__init__()
        self.custom_units: Dict[str, Decimal] = {}
    
    def set_weight_rule(
        self, 
        max_threshold: Decimal, 
        increment: Decimal, 
        position: Optional[int] = None
    ) -> None:
        """Set or add a weight rounding rule.
        
        Args:
            max_threshold: Maximum weight for this rule (in grams).
            increment: Rounding increment for this range.
            position: Optional position to insert rule (default: append).
        """
        rule = (max_threshold, increment)
        
        if position is not None:
            self.WEIGHT_RULES.insert(position, rule)
        else:
            # Find appropriate position based on threshold
            for i, (threshold, _) in enumerate(self.WEIGHT_RULES):
                if max_threshold < threshold:
                    self.WEIGHT_RULES.insert(i, rule)
                    break
            else:
                # Replace the last rule if it's infinity
                if self.WEIGHT_RULES and self.WEIGHT_RULES[-1][0] == Decimal('inf'):
                    self.WEIGHT_RULES.insert(-1, rule)
                else:
                    self.WEIGHT_RULES.append(rule)
    
    def set_volume_rule(
        self, 
        max_threshold: Decimal, 
        increment: Decimal, 
        position: Optional[int] = None
    ) -> None:
        """Set or add a volume rounding rule.
        
        Args:
            max_threshold: Maximum volume for this rule (in ml).
            increment: Rounding increment for this range.
            position: Optional position to insert rule (default: append).
        """
        rule = (max_threshold, increment)
        
        if position is not None:
            self.VOLUME_RULES.insert(position, rule)
        else:
            # Find appropriate position based on threshold
            for i, (threshold, _) in enumerate(self.VOLUME_RULES):
                if max_threshold < threshold:
                    self.VOLUME_RULES.insert(i, rule)
                    break
            else:
                # Replace the last rule if it's infinity
                if self.VOLUME_RULES and self.VOLUME_RULES[-1][0] == Decimal('inf'):
                    self.VOLUME_RULES.insert(-1, rule)
                else:
                    self.VOLUME_RULES.append(rule)
    
    def add_custom_unit(
        self, 
        unit: str, 
        increment: Decimal, 
        unit_type: str = 'fractional'
    ) -> None:
        """Add a custom unit with specific rounding rules.
        
        Args:
            unit: The unit name.
            increment: The rounding increment.
            unit_type: Type of unit ('fractional', 'countable', 'fine_precision').
        """
        unit_lower = unit.lower()
        
        if unit_type == 'countable':
            if unit_lower not in self.COUNTABLE_UNITS:
                self.COUNTABLE_UNITS.append(unit_lower)
        elif unit_type == 'fractional':
            if unit_lower not in self.FRACTIONAL_UNITS:
                self.FRACTIONAL_UNITS.append(unit_lower)
            self.custom_units[unit_lower] = increment
        elif unit_type == 'fine_precision':
            if unit_lower not in self.FINE_PRECISION_UNITS:
                self.FINE_PRECISION_UNITS.append(unit_lower)
            self.custom_units[unit_lower] = increment
        else:
            raise ValueError(f"Unknown unit type: {unit_type}")
    
    def round_quantity(
        self, 
        quantity: Decimal, 
        unit: str, 
        ingredient_type: Optional[str] = None
    ) -> Decimal:
        """Round quantity with support for custom units.
        
        Extends parent method to check custom units first.
        """
        unit_lower = unit.lower()
        
        # Check custom units first
        if unit_lower in self.custom_units:
            return self._round_to_fraction(quantity, self.custom_units[unit_lower])
        
        # Fall back to parent implementation
        return super().round_quantity(quantity, unit, ingredient_type)