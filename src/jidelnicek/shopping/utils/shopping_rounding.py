"""
Smart rounding rules for shopping list generation.

This module provides intelligent rounding for aggregated ingredient quantities
to create practical shopping lists. Different from recipe scaling rounding,
this focuses on what makes sense to buy at a store.
"""

from decimal import Decimal, ROUND_UP, ROUND_HALF_UP
from typing import Dict, Tuple, Optional
from dataclasses import dataclass
import logging


logger = logging.getLogger(__name__)


@dataclass
class RoundingRule:
    """Defines a rounding rule for a specific quantity range."""
    min_quantity: Decimal
    max_quantity: Optional[Decimal]
    round_to: Decimal
    rounding_mode: str = ROUND_UP  # Default to round up for shopping
    
    def applies_to(self, quantity: Decimal) -> bool:
        """Check if this rule applies to the given quantity."""
        if quantity < self.min_quantity:
            return False
        if self.max_quantity is not None and quantity > self.max_quantity:
            return False
        return True


class ShoppingRounder:
    """
    Intelligent rounding system for shopping list quantities.
    
    Applies different rounding rules based on:
    - Quantity ranges
    - Unit types
    - Ingredient types (countable vs measurable)
    
    Key principles:
    - Always round up for shopping (better to have extra)
    - Use practical increments (e.g., eggs by 6 or 12)
    - Consider package sizes
    """
    
    # Default weight rounding rules (in grams)
    WEIGHT_RULES = [
        RoundingRule(min_quantity=Decimal('0'), max_quantity=Decimal('10'), 
                    round_to=Decimal('1'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('10'), max_quantity=Decimal('100'), 
                    round_to=Decimal('5'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('100'), max_quantity=Decimal('1000'), 
                    round_to=Decimal('10'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('1000'), max_quantity=Decimal('5000'), 
                    round_to=Decimal('50'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('5000'), max_quantity=None, 
                    round_to=Decimal('100'), rounding_mode=ROUND_UP),
    ]
    
    # Default volume rounding rules (in milliliters)
    VOLUME_RULES = [
        RoundingRule(min_quantity=Decimal('0'), max_quantity=Decimal('10'), 
                    round_to=Decimal('1'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('10'), max_quantity=Decimal('100'), 
                    round_to=Decimal('5'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('100'), max_quantity=Decimal('1000'), 
                    round_to=Decimal('10'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('1000'), max_quantity=Decimal('5000'), 
                    round_to=Decimal('50'), rounding_mode=ROUND_UP),
        RoundingRule(min_quantity=Decimal('5000'), max_quantity=None, 
                    round_to=Decimal('100'), rounding_mode=ROUND_UP),
    ]
    
    # Special rules for countable items
    COUNTABLE_RULES = {
        'egg': {
            'increment': Decimal('1'),  # Single eggs
            'preferred_pack_sizes': [Decimal('6'), Decimal('12'), Decimal('18'), Decimal('24')],
            'round_up_threshold': Decimal('0.1')  # Round up if over 0.1
        },
        'default': {
            'increment': Decimal('1'),
            'round_up_threshold': Decimal('0.1')
        }
    }
    
    # Common package sizes for various units
    PACKAGE_SIZES = {
        'g': {
            'flour': [Decimal('500'), Decimal('1000'), Decimal('2000'), Decimal('5000')],
            'sugar': [Decimal('500'), Decimal('1000'), Decimal('2000')],
            'butter': [Decimal('125'), Decimal('250'), Decimal('500')],
            'cheese': [Decimal('200'), Decimal('400'), Decimal('500'), Decimal('1000')],
            'default': [Decimal('100'), Decimal('250'), Decimal('500'), Decimal('1000')]
        },
        'ml': {
            'milk': [Decimal('500'), Decimal('1000'), Decimal('2000')],
            'cream': [Decimal('200'), Decimal('250'), Decimal('500')],
            'oil': [Decimal('250'), Decimal('500'), Decimal('750'), Decimal('1000')],
            'default': [Decimal('250'), Decimal('500'), Decimal('1000')]
        }
    }
    
    def __init__(self, prefer_package_sizes: bool = True):
        """
        Initialize the shopping rounder.
        
        Args:
            prefer_package_sizes: If True, suggest common package sizes
        """
        self.prefer_package_sizes = prefer_package_sizes
        
    def round_quantity(
        self, 
        quantity: Decimal, 
        unit: str, 
        ingredient_name: Optional[str] = None,
        ingredient_type: Optional[str] = None
    ) -> Tuple[Decimal, Optional[str]]:
        """
        Round a quantity to a practical shopping amount.
        
        Args:
            quantity: The exact quantity needed
            unit: The unit of measurement
            ingredient_name: Name of the ingredient (for special rules)
            ingredient_type: Type of ingredient (e.g., 'countable', 'liquid', 'solid')
            
        Returns:
            Tuple of (rounded_quantity, package_suggestion)
        """
        unit_lower = unit.lower()
        
        # Handle countable items
        if unit_lower in ['piece', 'pcs', 'count', 'unit'] or ingredient_type == 'countable':
            return self._round_countable(quantity, ingredient_name)
            
        # Handle weight-based items
        if unit_lower == 'g':
            return self._round_weight(quantity, ingredient_name)
            
        # Handle volume-based items
        if unit_lower == 'ml':
            return self._round_volume(quantity, ingredient_name)
            
        # For other units, just round to nearest integer
        return quantity.quantize(Decimal('1'), rounding=ROUND_UP), None
        
    def _round_countable(
        self, 
        quantity: Decimal, 
        ingredient_name: Optional[str] = None
    ) -> Tuple[Decimal, Optional[str]]:
        """Round countable items (eggs, etc.)."""
        # Get specific rules for this ingredient
        rules = self.COUNTABLE_RULES.get('default')
        if ingredient_name:
            name_lower = ingredient_name.lower()
            for key in self.COUNTABLE_RULES:
                if key in name_lower:
                    rules = self.COUNTABLE_RULES[key]
                    break
                    
        # Round up if over threshold
        integer_part = int(quantity)
        decimal_part = quantity - integer_part
        
        if decimal_part >= rules['round_up_threshold']:
            rounded = Decimal(integer_part + 1)
        else:
            rounded = Decimal(integer_part)
            
        # Suggest package sizes for eggs
        suggestion = None
        if 'egg' in (ingredient_name or '').lower() and 'preferred_pack_sizes' in rules:
            for pack_size in rules['preferred_pack_sizes']:
                if rounded <= pack_size:
                    suggestion = f"Buy {int(pack_size)}-pack"
                    break
                    
        return rounded, suggestion
        
    def _round_weight(
        self, 
        quantity: Decimal, 
        ingredient_name: Optional[str] = None
    ) -> Tuple[Decimal, Optional[str]]:
        """Round weight-based quantities."""
        # Apply rounding rules
        rounded = self._apply_rules(quantity, self.WEIGHT_RULES)
        
        # Suggest package sizes if enabled
        suggestion = None
        if self.prefer_package_sizes and ingredient_name:
            suggestion = self._suggest_package_size(
                rounded, 'g', ingredient_name
            )
            
        return rounded, suggestion
        
    def _round_volume(
        self, 
        quantity: Decimal, 
        ingredient_name: Optional[str] = None
    ) -> Tuple[Decimal, Optional[str]]:
        """Round volume-based quantities."""
        # Apply rounding rules
        rounded = self._apply_rules(quantity, self.VOLUME_RULES)
        
        # Suggest package sizes if enabled
        suggestion = None
        if self.prefer_package_sizes and ingredient_name:
            suggestion = self._suggest_package_size(
                rounded, 'ml', ingredient_name
            )
            
        return rounded, suggestion
        
    def _apply_rules(
        self, 
        quantity: Decimal, 
        rules: list[RoundingRule]
    ) -> Decimal:
        """Apply rounding rules to a quantity."""
        for rule in rules:
            if rule.applies_to(quantity):
                # Round to the specified increment
                if rule.round_to == Decimal('1'):
                    return quantity.quantize(Decimal('1'), rounding=rule.rounding_mode)
                else:
                    # Round to nearest increment
                    rounded = (quantity / rule.round_to).quantize(
                        Decimal('1'), 
                        rounding=rule.rounding_mode
                    ) * rule.round_to
                    return rounded
                    
        # Fallback: round to integer
        return quantity.quantize(Decimal('1'), rounding=ROUND_UP)
        
    def _suggest_package_size(
        self, 
        quantity: Decimal, 
        unit: str, 
        ingredient_name: str
    ) -> Optional[str]:
        """Suggest appropriate package sizes."""
        if unit not in self.PACKAGE_SIZES:
            return None
            
        # Find matching package sizes
        name_lower = ingredient_name.lower()
        package_sizes = None
        
        for key in self.PACKAGE_SIZES[unit]:
            if key != 'default' and key in name_lower:
                package_sizes = self.PACKAGE_SIZES[unit][key]
                break
                
        if not package_sizes:
            package_sizes = self.PACKAGE_SIZES[unit].get('default', [])
            
        # Find smallest package that fits
        suggestions = []
        remaining = quantity
        
        # Sort packages from largest to smallest
        sorted_sizes = sorted(package_sizes, reverse=True)
        
        while remaining > 0 and sorted_sizes:
            for size in sorted_sizes:
                if remaining >= size:
                    count = int(remaining / size)
                    suggestions.append(f"{count}×{int(size)}{unit}")
                    remaining = remaining % size
                    break
            else:
                # No package fits, use smallest
                if sorted_sizes:
                    suggestions.append(f"1×{int(sorted_sizes[-1])}{unit}")
                    remaining = Decimal('0')
                    
        if suggestions:
            return " + ".join(suggestions)
        return None
        
    def round_for_display(
        self, 
        quantity: Decimal, 
        unit: str
    ) -> str:
        """
        Format quantity for display in shopping list.
        
        Returns a human-friendly string representation.
        """
        # Remove trailing zeros and decimal point if not needed
        normalized = quantity.normalize()
        
        # For very small quantities, show with appropriate precision
        if normalized < Decimal('1') and normalized > Decimal('0'):
            return f"{float(normalized):.2f} {unit}"
            
        # For whole numbers, don't show decimal
        if normalized == normalized.to_integral_value():
            return f"{int(normalized)} {unit}"
            
        # Otherwise, show with one decimal place
        return f"{float(normalized):.1f} {unit}"