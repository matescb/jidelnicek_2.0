"""
Tests for shopping list rounding rules.
"""

import pytest
from decimal import Decimal

from jidelnicek.shopping.utils.shopping_rounding import (
    ShoppingRounder,
    RoundingRule
)


class TestShoppingRounder:
    """Test suite for ShoppingRounder."""
    
    @pytest.fixture
    def rounder(self):
        """Create a shopping rounder instance."""
        return ShoppingRounder(prefer_package_sizes=True)
    
    @pytest.fixture
    def rounder_no_packages(self):
        """Create a rounder without package suggestions."""
        return ShoppingRounder(prefer_package_sizes=False)
    
    def test_weight_rounding_rules(self, rounder_no_packages):
        """Test weight-based rounding rules."""
        test_cases = [
            # (input, expected)
            (Decimal('0.5'), Decimal('1')),      # <10g: round to 1g
            (Decimal('7.2'), Decimal('8')),       # <10g: round to 1g
            (Decimal('12.3'), Decimal('15')),     # 10-100g: round to 5g
            (Decimal('47.1'), Decimal('50')),     # 10-100g: round to 5g
            (Decimal('123.4'), Decimal('130')),   # 100-1000g: round to 10g
            (Decimal('567.8'), Decimal('570')),   # 100-1000g: round to 10g
            (Decimal('1234'), Decimal('1250')),   # 1000-5000g: round to 50g
            (Decimal('3456'), Decimal('3500')),   # 1000-5000g: round to 50g
            (Decimal('5678'), Decimal('5700')),   # >5000g: round to 100g
            (Decimal('12345'), Decimal('12400')), # >5000g: round to 100g
        ]
        
        for input_val, expected in test_cases:
            rounded, suggestion = rounder_no_packages.round_quantity(
                input_val, 'g'
            )
            assert rounded == expected, f"Failed for {input_val}g"
            assert suggestion is None  # No package suggestions
    
    def test_volume_rounding_rules(self, rounder_no_packages):
        """Test volume-based rounding rules."""
        test_cases = [
            # (input, expected)
            (Decimal('3.2'), Decimal('4')),       # <10ml: round to 1ml
            (Decimal('25.7'), Decimal('30')),     # 10-100ml: round to 5ml
            (Decimal('234.5'), Decimal('240')),   # 100-1000ml: round to 10ml
            (Decimal('1567'), Decimal('1600')),   # 1000-5000ml: round to 50ml
            (Decimal('7890'), Decimal('7900')),   # >5000ml: round to 100ml
        ]
        
        for input_val, expected in test_cases:
            rounded, suggestion = rounder_no_packages.round_quantity(
                input_val, 'ml'
            )
            assert rounded == expected, f"Failed for {input_val}ml"
    
    def test_countable_rounding(self, rounder):
        """Test rounding for countable items."""
        # Test eggs
        test_cases = [
            # (quantity, ingredient, expected_rounded, expected_suggestion)
            (Decimal('1.1'), 'eggs', Decimal('2'), "Buy 6-pack"),
            (Decimal('5.2'), 'eggs', Decimal('6'), "Buy 6-pack"),
            (Decimal('6.8'), 'Eggs', Decimal('7'), "Buy 12-pack"),
            (Decimal('11.3'), 'EGGS', Decimal('12'), "Buy 12-pack"),
            (Decimal('13'), 'eggs', Decimal('13'), "Buy 18-pack"),
            (Decimal('20.5'), 'eggs', Decimal('21'), "Buy 24-pack"),
        ]
        
        for quantity, ingredient, expected_rounded, expected_suggestion in test_cases:
            rounded, suggestion = rounder.round_quantity(
                quantity, 'piece', ingredient
            )
            assert rounded == expected_rounded
            assert suggestion == expected_suggestion
    
    def test_countable_default_rounding(self, rounder):
        """Test default countable rounding."""
        # Non-egg countables
        test_cases = [
            (Decimal('1.05'), Decimal('1')),  # Below threshold
            (Decimal('1.15'), Decimal('2')),  # Above threshold
            (Decimal('3.9'), Decimal('4')),
            (Decimal('10.01'), Decimal('10')),
        ]
        
        for input_val, expected in test_cases:
            rounded, suggestion = rounder.round_quantity(
                input_val, 'piece', 'onion'
            )
            assert rounded == expected
            assert suggestion is None  # No special packaging for onions
    
    def test_package_size_suggestions(self, rounder):
        """Test package size suggestions."""
        # Test flour
        rounded, suggestion = rounder.round_quantity(
            Decimal('1200'), 'g', 'flour'
        )
        assert rounded == Decimal('1200')
        assert suggestion == "1×1000g + 1×500g"  # Suggests efficient packaging
        
        # Test milk
        rounded, suggestion = rounder.round_quantity(
            Decimal('2300'), 'ml', 'milk'
        )
        assert rounded == Decimal('2300')
        assert suggestion == "1×2000ml + 1×500ml"
        
        # Test butter (smaller packages)
        rounded, suggestion = rounder.round_quantity(
            Decimal('350'), 'g', 'butter'
        )
        assert rounded == Decimal('350')
        assert suggestion == "1×250g + 1×125g"
    
    def test_display_formatting(self, rounder):
        """Test display formatting."""
        test_cases = [
            # (quantity, unit, expected_display)
            (Decimal('1'), 'g', "1 g"),
            (Decimal('1.0'), 'ml', "1 ml"),
            (Decimal('1.5'), 'kg', "1.5 kg"),
            (Decimal('0.25'), 'l', "0.25 l"),
            (Decimal('12.00'), 'piece', "12 piece"),
            (Decimal('123.456'), 'g', "123.5 g"),
        ]
        
        for quantity, unit, expected in test_cases:
            formatted = rounder.round_for_display(quantity, unit)
            assert formatted == expected
    
    def test_rounding_rule_application(self):
        """Test individual rounding rule logic."""
        rule = RoundingRule(
            min_quantity=Decimal('100'),
            max_quantity=Decimal('1000'),
            round_to=Decimal('10')
        )
        
        assert rule.applies_to(Decimal('50')) is False
        assert rule.applies_to(Decimal('100')) is True
        assert rule.applies_to(Decimal('500')) is True
        assert rule.applies_to(Decimal('1000')) is True
        assert rule.applies_to(Decimal('1001')) is False
    
    def test_unknown_units(self, rounder):
        """Test handling of unknown units."""
        # Should just round to nearest integer
        rounded, suggestion = rounder.round_quantity(
            Decimal('3.7'), 'bunch'
        )
        assert rounded == Decimal('4')
        assert suggestion is None
    
    def test_ingredient_type_override(self, rounder):
        """Test that ingredient type can override unit detection."""
        # Even though unit is 'g', ingredient_type='countable' should use countable rules
        rounded, suggestion = rounder.round_quantity(
            Decimal('3.2'), 'g', ingredient_type='countable'
        )
        assert rounded == Decimal('4')  # Countable rounding, not weight rounding
    
    def test_case_insensitive_matching(self, rounder):
        """Test case-insensitive ingredient name matching."""
        test_cases = [
            ('Flour', 'flour'),
            ('MILK', 'milk'),
            ('BuTtEr', 'butter'),
        ]
        
        for name1, name2 in test_cases:
            rounded1, suggestion1 = rounder.round_quantity(
                Decimal('750'), 'g', name1
            )
            rounded2, suggestion2 = rounder.round_quantity(
                Decimal('750'), 'g', name2
            )
            assert suggestion1 == suggestion2  # Should match regardless of case
    
    def test_no_package_suggestion_mode(self, rounder_no_packages):
        """Test that package suggestions can be disabled."""
        rounded, suggestion = rounder_no_packages.round_quantity(
            Decimal('1200'), 'g', 'flour'
        )
        assert rounded == Decimal('1200')
        assert suggestion is None  # No suggestion when disabled
    
    def test_edge_cases(self, rounder):
        """Test edge cases."""
        # Zero quantity
        rounded, suggestion = rounder.round_quantity(
            Decimal('0'), 'g'
        )
        assert rounded == Decimal('0')
        
        # Very large quantity
        rounded, suggestion = rounder.round_quantity(
            Decimal('99999'), 'g'
        )
        assert rounded == Decimal('100000')  # Rounded to nearest 100g
    
    def test_practical_examples(self, rounder):
        """Test with practical recipe examples."""
        examples = [
            # Baking a cake
            (Decimal('237'), 'g', 'flour', Decimal('240')),
            (Decimal('198'), 'g', 'sugar', Decimal('200')),
            (Decimal('113'), 'g', 'butter', Decimal('120')),
            (Decimal('2.5'), 'piece', 'eggs', Decimal('3')),
            
            # Making soup
            (Decimal('1847'), 'ml', 'broth', Decimal('1850')),
            (Decimal('423'), 'g', 'vegetables', Decimal('430')),
            (Decimal('67'), 'ml', 'cream', Decimal('70')),
        ]
        
        for quantity, unit, ingredient, expected in examples:
            rounded, _ = rounder.round_quantity(quantity, unit, ingredient)
            assert rounded == expected