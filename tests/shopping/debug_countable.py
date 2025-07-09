"""
Debug countable rounding issue.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.shopping.utils.shopping_rounding import ShoppingRounder


def debug_countable():
    """Debug the countable rounding."""
    rounder = ShoppingRounder()
    
    # Test case that's failing
    quantity = Decimal('1.1')
    ingredient = 'eggs'
    
    print(f"Testing: {quantity} {ingredient}")
    
    rounded, suggestion = rounder.round_quantity(quantity, 'piece', ingredient)
    
    print(f"Rounded: {rounded}")
    print(f"Suggestion: {suggestion}")
    print(f"Expected rounded: 2")
    print(f"Expected suggestion: Buy 6-pack")
    
    # Let's trace through the logic
    print("\nTracing through _round_countable logic:")
    
    # Get rules
    rules = rounder.COUNTABLE_RULES.get('default')
    name_lower = ingredient.lower()
    for key in rounder.COUNTABLE_RULES:
        if key in name_lower:
            rules = rounder.COUNTABLE_RULES[key]
            print(f"Found matching rule for key '{key}'")
            break
    
    print(f"Rules: {rules}")
    
    # Check rounding logic
    integer_part = int(quantity)
    decimal_part = quantity - integer_part
    
    print(f"\nInteger part: {integer_part}")
    print(f"Decimal part: {decimal_part}")
    print(f"Threshold: {rules['round_up_threshold']}")
    print(f"Decimal > threshold? {decimal_part > rules['round_up_threshold']}")


if __name__ == '__main__':
    debug_countable()