"""
Simple tests for shopping rounding without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.shopping.utils.shopping_rounding import ShoppingRounder


def test_basic_rounding():
    """Test basic rounding functionality."""
    print("Testing basic rounding...")
    
    rounder = ShoppingRounder(prefer_package_sizes=False)
    
    # Test weight rounding
    test_cases = [
        ('Weight <10g', Decimal('7.2'), 'g', None, Decimal('8')),
        ('Weight 10-100g', Decimal('47.1'), 'g', None, Decimal('50')),
        ('Weight 100-1000g', Decimal('567.8'), 'g', None, Decimal('570')),
        ('Weight >1000g', Decimal('1234'), 'g', None, Decimal('1250')),
    ]
    
    for desc, quantity, unit, ingredient, expected in test_cases:
        rounded, suggestion = rounder.round_quantity(quantity, unit, ingredient)
        assert rounded == expected, f"{desc}: expected {expected}, got {rounded}"
        print(f"✓ {desc}: {quantity}{unit} → {rounded}{unit}")
    
    print("✓ Basic rounding test passed\n")


def test_countable_items():
    """Test rounding for countable items."""
    print("Testing countable items...")
    
    rounder = ShoppingRounder()
    
    # Test eggs with package suggestions
    test_cases = [
        (Decimal('1.1'), 'eggs', Decimal('2'), "Buy 6-pack"),
        (Decimal('5.2'), 'eggs', Decimal('6'), "Buy 6-pack"),
        (Decimal('11.3'), 'eggs', Decimal('12'), "Buy 12-pack"),
        (Decimal('20.5'), 'eggs', Decimal('21'), "Buy 24-pack"),
    ]
    
    for quantity, ingredient, expected_qty, expected_suggestion in test_cases:
        rounded, suggestion = rounder.round_quantity(quantity, 'piece', ingredient)
        assert rounded == expected_qty
        assert suggestion == expected_suggestion
        print(f"✓ {quantity} {ingredient} → {rounded} ({suggestion})")
    
    print("✓ Countable items test passed\n")


def test_package_suggestions():
    """Test package size suggestions."""
    print("Testing package suggestions...")
    
    rounder = ShoppingRounder(prefer_package_sizes=True)
    
    # Test various ingredients
    test_cases = [
        (Decimal('1200'), 'g', 'flour', "1×1000g + 1×500g"),
        (Decimal('2300'), 'ml', 'milk', "1×2000ml + 1×500ml"),
        (Decimal('350'), 'g', 'butter', "1×250g + 1×125g"),
        (Decimal('750'), 'ml', 'oil', "1×750ml"),
    ]
    
    for quantity, unit, ingredient, expected_suggestion in test_cases:
        rounded, suggestion = rounder.round_quantity(quantity, unit, ingredient)
        print(f"  {quantity}{unit} {ingredient}: {suggestion}")
        if expected_suggestion:
            assert suggestion == expected_suggestion
    
    print("✓ Package suggestions test passed\n")


def test_display_formatting():
    """Test display formatting."""
    print("Testing display formatting...")
    
    rounder = ShoppingRounder()
    
    test_cases = [
        (Decimal('1'), 'g', "1 g"),
        (Decimal('1.5'), 'kg', "1.5 kg"),
        (Decimal('0.25'), 'l', "0.25 l"),
        (Decimal('12.00'), 'piece', "12 piece"),
        (Decimal('123.456'), 'g', "123.5 g"),
    ]
    
    for quantity, unit, expected in test_cases:
        formatted = rounder.round_for_display(quantity, unit)
        assert formatted == expected
        print(f"✓ {quantity} {unit} → '{formatted}'")
    
    print("✓ Display formatting test passed\n")


def test_practical_shopping_scenario():
    """Test a practical shopping scenario."""
    print("Testing practical shopping scenario...")
    
    rounder = ShoppingRounder(prefer_package_sizes=True)
    
    # Ingredients for a cake recipe scaled for a party
    ingredients = [
        (Decimal('1847'), 'g', 'flour'),
        (Decimal('923'), 'g', 'sugar'),
        (Decimal('467'), 'g', 'butter'),
        (Decimal('11.3'), 'piece', 'eggs'),
        (Decimal('473'), 'ml', 'milk'),
        (Decimal('15'), 'g', 'baking powder'),
    ]
    
    print("  Shopping list for party cake:")
    for quantity, unit, ingredient in ingredients:
        rounded, suggestion = rounder.round_quantity(quantity, unit, ingredient)
        display = rounder.round_for_display(rounded, unit)
        
        if suggestion:
            print(f"  - {ingredient}: {display} ({suggestion})")
        else:
            print(f"  - {ingredient}: {display}")
    
    print("✓ Practical scenario test passed\n")


def test_volume_units():
    """Test volume unit handling."""
    print("Testing volume units...")
    
    rounder = ShoppingRounder()
    
    # Test milliliters
    ml_cases = [
        (Decimal('237'), Decimal('240')),
        (Decimal('473'), Decimal('480')),
        (Decimal('946'), Decimal('950')),
    ]
    
    for input_ml, expected_ml in ml_cases:
        rounded, _ = rounder.round_quantity(input_ml, 'ml')
        assert rounded == expected_ml
        print(f"✓ {input_ml}ml → {rounded}ml")
    
    print("✓ Volume units test passed\n")


def run_all_tests():
    """Run all tests."""
    print("Running shopping rounding tests...\n")
    
    test_basic_rounding()
    test_countable_items()
    test_package_suggestions()
    test_display_formatting()
    test_practical_shopping_scenario()
    test_volume_units()
    
    print("✅ All shopping rounding tests passed!")


if __name__ == '__main__':
    run_all_tests()