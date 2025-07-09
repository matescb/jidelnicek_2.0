#!/usr/bin/env python3
"""
Comprehensive accuracy test for shopping rounding rules.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.shopping.utils.shopping_rounding import ShoppingRounder


def test_rounding_accuracy():
    """Test rounding accuracy across different scenarios."""
    
    print("=" * 60)
    print("COMPREHENSIVE ROUNDING ACCURACY TEST")
    print("=" * 60)
    
    rounder = ShoppingRounder(prefer_package_sizes=True)
    
    test_results = {
        'total_tests': 0,
        'passed': 0,
        'failed': 0,
        'failures': []
    }
    
    # Test cases organized by type
    test_cases = [
        # Weight rounding tests
        {
            'name': 'Small weights (<10g)',
            'cases': [
                (Decimal('1.1'), 'g', None, Decimal('2'), 'Round up 1.1g eggs'),
                (Decimal('3.7'), 'g', None, Decimal('4'), 'Round up 3.7g spices'),
                (Decimal('7.2'), 'g', None, Decimal('8'), 'Round up 7.2g salt'),
                (Decimal('9.9'), 'g', None, Decimal('10'), 'Round up 9.9g baking powder'),
            ]
        },
        {
            'name': 'Medium weights (10-100g)',
            'cases': [
                (Decimal('12.3'), 'g', None, Decimal('15'), 'Round to 5g increment'),
                (Decimal('47.1'), 'g', None, Decimal('50'), 'Round up to 50g'),
                (Decimal('73.8'), 'g', None, Decimal('75'), 'Round to 75g'),
                (Decimal('98.2'), 'g', None, Decimal('100'), 'Round to 100g'),
            ]
        },
        {
            'name': 'Large weights (100-1000g)',
            'cases': [
                (Decimal('123.4'), 'g', None, Decimal('130'), 'Round to 10g increment'),
                (Decimal('456.7'), 'g', None, Decimal('460'), 'Round to 460g'),
                (Decimal('789.1'), 'g', None, Decimal('790'), 'Round to 790g'),
                (Decimal('999.9'), 'g', None, Decimal('1000'), 'Round to 1000g'),
            ]
        },
        {
            'name': 'Very large weights (1000-5000g)',
            'cases': [
                (Decimal('1234'), 'g', None, Decimal('1250'), 'Round to 50g increment'),
                (Decimal('2567'), 'g', None, Decimal('2600'), 'Round to 2600g'),
                (Decimal('4321'), 'g', None, Decimal('4350'), 'Round to 4350g'),
                (Decimal('4999'), 'g', None, Decimal('5000'), 'Round to 5000g'),
            ]
        },
        {
            'name': 'Huge weights (>5000g)',
            'cases': [
                (Decimal('5678'), 'g', None, Decimal('5700'), 'Round to 100g increment'),
                (Decimal('12345'), 'g', None, Decimal('12400'), 'Round to 12400g'),
                (Decimal('23456'), 'g', None, Decimal('23500'), 'Round to 23500g'),
            ]
        },
        {
            'name': 'Volume rounding (<10ml)',
            'cases': [
                (Decimal('1.5'), 'ml', None, Decimal('2'), 'Round up 1.5ml vanilla'),
                (Decimal('3.2'), 'ml', None, Decimal('4'), 'Round up 3.2ml extract'),
                (Decimal('7.8'), 'ml', None, Decimal('8'), 'Round up 7.8ml lemon juice'),
            ]
        },
        {
            'name': 'Volume rounding (10-100ml)',
            'cases': [
                (Decimal('25.7'), 'ml', None, Decimal('30'), 'Round to 5ml increment'),
                (Decimal('67.3'), 'ml', None, Decimal('70'), 'Round to 70ml'),
                (Decimal('94.1'), 'ml', None, Decimal('95'), 'Round to 95ml'),
            ]
        },
        {
            'name': 'Volume rounding (100-1000ml)',
            'cases': [
                (Decimal('234.5'), 'ml', None, Decimal('240'), 'Round to 10ml increment'),
                (Decimal('567.8'), 'ml', None, Decimal('570'), 'Round to 570ml'),
                (Decimal('891.2'), 'ml', None, Decimal('900'), 'Round to 900ml'),
            ]
        },
        {
            'name': 'Volume rounding (1000-5000ml)',
            'cases': [
                (Decimal('1234'), 'ml', None, Decimal('1250'), 'Round to 50ml increment'),
                (Decimal('2567'), 'ml', None, Decimal('2600'), 'Round to 2600ml'),
                (Decimal('4321'), 'ml', None, Decimal('4350'), 'Round to 4350ml'),
            ]
        },
        {
            'name': 'Volume rounding (>5000ml)',
            'cases': [
                (Decimal('5678'), 'ml', None, Decimal('5700'), 'Round to 100ml increment'),
                (Decimal('12345'), 'ml', None, Decimal('12400'), 'Round to 12400ml'),
            ]
        },
        {
            'name': 'Countable items - eggs',
            'cases': [
                (Decimal('1.1'), 'piece', 'eggs', Decimal('2'), 'Round up 1.1 eggs'),
                (Decimal('2.05'), 'piece', 'eggs', Decimal('2'), 'Keep 2.05 eggs as 2'),
                (Decimal('5.2'), 'piece', 'eggs', Decimal('6'), 'Round up 5.2 eggs'),
                (Decimal('11.3'), 'piece', 'eggs', Decimal('12'), 'Round up 11.3 eggs'),
                (Decimal('20.5'), 'piece', 'eggs', Decimal('21'), 'Round up 20.5 eggs'),
            ]
        },
        {
            'name': 'Countable items - default',
            'cases': [
                (Decimal('1.05'), 'piece', 'onion', Decimal('1'), 'Keep 1.05 onions as 1'),
                (Decimal('1.15'), 'piece', 'onion', Decimal('2'), 'Round up 1.15 onions'),
                (Decimal('3.9'), 'piece', 'apple', Decimal('4'), 'Round up 3.9 apples'),
                (Decimal('10.01'), 'piece', 'tomato', Decimal('10'), 'Keep 10.01 tomatoes as 10'),
            ]
        },
        {
            'name': 'Unknown units',
            'cases': [
                (Decimal('3.7'), 'bunch', None, Decimal('4'), 'Round up unknown unit'),
                (Decimal('2.3'), 'package', None, Decimal('3'), 'Round up package'),
                (Decimal('5.1'), 'bag', None, Decimal('6'), 'Round up bag'),
            ]
        }
    ]
    
    # Run all test cases
    for test_group in test_cases:
        print(f"\n{test_group['name']}")
        print("-" * len(test_group['name']))
        
        for quantity, unit, ingredient, expected, description in test_group['cases']:
            test_results['total_tests'] += 1
            
            try:
                rounded, suggestion = rounder.round_quantity(quantity, unit, ingredient)
                
                if rounded == expected:
                    print(f"✓ {description}: {quantity}{unit} → {rounded}{unit}")
                    test_results['passed'] += 1
                else:
                    print(f"✗ {description}: {quantity}{unit} → {rounded}{unit} (expected {expected}{unit})")
                    test_results['failed'] += 1
                    test_results['failures'].append({
                        'description': description,
                        'input': f"{quantity}{unit}",
                        'expected': f"{expected}{unit}",
                        'actual': f"{rounded}{unit}",
                        'ingredient': ingredient
                    })
                    
            except Exception as e:
                print(f"✗ {description}: ERROR - {str(e)}")
                test_results['failed'] += 1
                test_results['failures'].append({
                    'description': description,
                    'input': f"{quantity}{unit}",
                    'expected': f"{expected}{unit}",
                    'actual': f"ERROR: {str(e)}",
                    'ingredient': ingredient
                })
    
    # Test package suggestions
    print(f"\nPackage Suggestions")
    print("-" * 18)
    
    package_tests = [
        (Decimal('1200'), 'g', 'flour', "1×1000g + 1×500g"),
        (Decimal('2300'), 'ml', 'milk', "1×2000ml + 1×500ml"),
        (Decimal('350'), 'g', 'butter', "1×250g + 1×125g"),
        (Decimal('750'), 'ml', 'oil', "1×750ml"),
        (Decimal('6'), 'piece', 'eggs', "Buy 6-pack"),
        (Decimal('12'), 'piece', 'eggs', "Buy 12-pack"),
        (Decimal('21'), 'piece', 'eggs', "Buy 24-pack"),
    ]
    
    for quantity, unit, ingredient, expected_suggestion in package_tests:
        test_results['total_tests'] += 1
        
        try:
            rounded, suggestion = rounder.round_quantity(quantity, unit, ingredient)
            
            if suggestion == expected_suggestion:
                print(f"✓ Package {ingredient}: {quantity}{unit} → {suggestion}")
                test_results['passed'] += 1
            else:
                print(f"✗ Package {ingredient}: {quantity}{unit} → {suggestion} (expected {expected_suggestion})")
                test_results['failed'] += 1
                test_results['failures'].append({
                    'description': f"Package suggestion for {ingredient}",
                    'input': f"{quantity}{unit}",
                    'expected': expected_suggestion,
                    'actual': suggestion or "None",
                    'ingredient': ingredient
                })
                
        except Exception as e:
            print(f"✗ Package {ingredient}: ERROR - {str(e)}")
            test_results['failed'] += 1
            test_results['failures'].append({
                'description': f"Package suggestion for {ingredient}",
                'input': f"{quantity}{unit}",
                'expected': expected_suggestion,
                'actual': f"ERROR: {str(e)}",
                'ingredient': ingredient
            })
    
    # Test display formatting
    print(f"\nDisplay Formatting")
    print("-" * 17)
    
    display_tests = [
        (Decimal('1'), 'g', "1 g"),
        (Decimal('1.5'), 'kg', "1.5 kg"),
        (Decimal('0.25'), 'l', "0.25 l"),
        (Decimal('12.00'), 'piece', "12 piece"),
        (Decimal('123.456'), 'g', "123.5 g"),
        (Decimal('0.5'), 'ml', "0.50 ml"),
    ]
    
    for quantity, unit, expected_display in display_tests:
        test_results['total_tests'] += 1
        
        try:
            formatted = rounder.round_for_display(quantity, unit)
            
            if formatted == expected_display:
                print(f"✓ Display: {quantity} {unit} → '{formatted}'")
                test_results['passed'] += 1
            else:
                print(f"✗ Display: {quantity} {unit} → '{formatted}' (expected '{expected_display}')")
                test_results['failed'] += 1
                test_results['failures'].append({
                    'description': f"Display formatting",
                    'input': f"{quantity} {unit}",
                    'expected': expected_display,
                    'actual': formatted,
                    'ingredient': None
                })
                
        except Exception as e:
            print(f"✗ Display: {quantity} {unit} → ERROR - {str(e)}")
            test_results['failed'] += 1
            test_results['failures'].append({
                'description': f"Display formatting",
                'input': f"{quantity} {unit}",
                'expected': expected_display,
                'actual': f"ERROR: {str(e)}",
                'ingredient': None
            })
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Total Tests: {test_results['total_tests']}")
    print(f"Passed: {test_results['passed']}")
    print(f"Failed: {test_results['failed']}")
    print(f"Pass Rate: {test_results['passed']/test_results['total_tests']*100:.1f}%")
    
    if test_results['failures']:
        print(f"\nFAILURES:")
        print("-" * 50)
        for i, failure in enumerate(test_results['failures'], 1):
            print(f"{i}. {failure['description']}")
            print(f"   Input: {failure['input']}")
            print(f"   Expected: {failure['expected']}")
            print(f"   Actual: {failure['actual']}")
            if failure['ingredient']:
                print(f"   Ingredient: {failure['ingredient']}")
            print()
    
    return test_results


if __name__ == '__main__':
    test_rounding_accuracy()