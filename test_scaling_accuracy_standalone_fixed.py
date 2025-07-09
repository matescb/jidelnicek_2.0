#!/usr/bin/env python3
"""
Standalone scaling accuracy test runner to verify the 99.9% accuracy requirement.
This script runs independently of the main test suite to avoid configuration issues.
"""

import sys
import random
from pathlib import Path
from decimal import Decimal, getcontext

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Set decimal precision for tests
getcontext().prec = 28

from jidelnicek.recipe.utils.scaling import RecipeScaler, CalorieScaler, ParticipantScaler
from jidelnicek.recipe.utils.rounding import SmartRounder
from jidelnicek.recipe.utils.constraints import ScalingConstraints
from jidelnicek.recipe.utils.scaling_validator import ScalingValidator


def calculate_relative_error(expected: Decimal, actual: Decimal) -> Decimal:
    """Calculate relative error between expected and actual values."""
    if expected == 0:
        return Decimal('0') if actual == 0 else Decimal('inf')
    return abs((actual - expected) / expected)


def assert_accuracy(expected: Decimal, actual: Decimal, tolerance: Decimal = Decimal('0.001')):
    """Assert that relative error is within tolerance (0.1% for 99.9% accuracy)."""
    error = calculate_relative_error(expected, actual)
    if error > tolerance:
        raise AssertionError(f"Accuracy test failed: expected {expected}, got {actual}, error {error*100:.4f}%")


def test_basic_scaling_precision():
    """Test precision of basic scaling calculations."""
    scaler = RecipeScaler(use_rounding=False, use_constraints=False)
    
    test_cases = [
        # (original_servings, target_servings, test_quantity, expected_result)
        (4, 6, Decimal('100'), Decimal('150')),
        (3, 7, Decimal('250'), Decimal('583.3333')),  # Repeating decimal
        (8, 3, Decimal('480'), Decimal('180')),
        (5, 11, Decimal('75.5'), Decimal('166.1')),
        (7, 2, Decimal('350'), Decimal('100')),
        (1, 1, Decimal('100'), Decimal('100')),  # No scaling
        (10, 1, Decimal('1000'), Decimal('100')),  # Scale down by 10
        (1, 10, Decimal('100'), Decimal('1000')),  # Scale up by 10
    ]
    
    passed = 0
    total = len(test_cases)
    
    for original, target, quantity, expected in test_cases:
        try:
            factor = scaler.calculate_base_scaling_factor(original, target)
            scaled = scaler.scale_ingredient_quantity(quantity, factor)
            
            # Verify factor calculation
            expected_factor = Decimal(target) / Decimal(original)
            assert_accuracy(expected_factor, factor)
            
            # Verify scaled quantity
            assert_accuracy(expected, scaled)
            passed += 1
        except Exception as e:
            print(f"  ❌ Failed: {original}→{target}, quantity={quantity}: {e}")
    
    print(f"  ✅ Basic scaling precision: {passed}/{total} tests passed")
    return passed, total


def test_calorie_calculation_accuracy():
    """Test accuracy of calorie-based calculations."""
    scaler = CalorieScaler(use_rounding=False, use_constraints=False)
    
    ingredients = [
        {
            'name': 'Flour',
            'quantity': Decimal('250'),
            'unit': 'g',
            'nutritional_data': {'calories': Decimal('364')}  # per 100g
        },
        {
            'name': 'Sugar',
            'quantity': Decimal('100'),
            'unit': 'g',
            'nutritional_data': {'calories': Decimal('387')}  # per 100g
        },
        {
            'name': 'Butter',
            'quantity': Decimal('125'),
            'unit': 'g',
            'nutritional_data': {'calories': Decimal('717')}  # per 100g
        },
        {
            'name': 'Eggs',
            'quantity': Decimal('3'),
            'unit': 'piece',
            'unit_conversions': {'piece_to_g': Decimal('50')},
            'nutritional_data': {'calories': Decimal('155')}  # per 100g
        }
    ]
    
    # Calculate expected total calories
    # Flour: 250g * 364cal/100g = 910 cal
    # Sugar: 100g * 387cal/100g = 387 cal
    # Butter: 125g * 717cal/100g = 896.25 cal
    # Eggs: 3 * 50g * 155cal/100g = 232.5 cal
    # Total: 910 + 387 + 896.25 + 232.5 = 2425.75 cal
    expected_total = Decimal('2425.75')
    
    try:
        actual_total = scaler.calculate_recipe_calories(ingredients)
        assert_accuracy(expected_total, actual_total)
        
        # Test calories per serving
        servings = 8
        expected_per_serving = expected_total / Decimal(servings)
        actual_per_serving = scaler.calculate_calories_per_serving(actual_total, servings)
        assert_accuracy(expected_per_serving, actual_per_serving)
        
        print(f"  ✅ Calorie calculation accuracy: 2/2 tests passed")
        return 2, 2
    except Exception as e:
        print(f"  ❌ Calorie calculation failed: {e}")
        return 0, 2


def test_participant_coefficient_accuracy():
    """Test accuracy of participant coefficient calculations."""
    scaler = ParticipantScaler(use_rounding=False, use_constraints=False)
    
    participants = [
        {'name': 'Adult 1', 'coefficient': 100},
        {'name': 'Adult 2', 'coefficient': 120},
        {'name': 'Child 1', 'coefficient': 75},
        {'name': 'Child 2', 'coefficient': 60},
        {'name': 'Athlete', 'coefficient': 150, 'meal_coefficients': {'Lunch': 175}},
        {'name': 'Elderly', 'coefficient': 85, 'attendance_factor': Decimal('0.8')}
    ]
    
    # Calculate expected effective participants
    # Adult 1: 100% = 1.0
    # Adult 2: 120% = 1.2  
    # Child 1: 75% = 0.75
    # Child 2: 60% = 0.6
    # Athlete: 150% = 1.5 (base)
    # Elderly: 85% * 0.8 = 0.68
    expected_base = Decimal('1.0') + Decimal('1.2') + Decimal('0.75') + Decimal('0.6') + Decimal('1.5') + Decimal('0.68')
    expected_base = Decimal('5.73')
    
    try:
        actual_base = scaler.calculate_effective_participants(participants)
        assert_accuracy(expected_base, actual_base)
        
        # Test with meal-specific coefficient
        # Based on the actual implementation, meal coefficients replace the base coefficient
        # Athlete at lunch: 175% = 1.75 (not 150% * 175% = 2.625)
        expected_lunch = Decimal('1.0') + Decimal('1.2') + Decimal('0.75') + Decimal('0.6') + Decimal('1.75') + Decimal('0.68')
        expected_lunch = Decimal('5.98')
        
        actual_lunch = scaler.calculate_effective_participants(participants, 'Lunch')
        assert_accuracy(expected_lunch, actual_lunch)
        
        print(f"  ✅ Participant coefficient accuracy: 2/2 tests passed")
        return 2, 2
    except Exception as e:
        print(f"  ❌ Participant coefficient calculation failed: {e}")
        return 0, 2


def test_cumulative_error_analysis():
    """Test that cumulative errors remain within tolerance."""
    scaler = RecipeScaler(use_rounding=False, use_constraints=False)
    
    # Scale a recipe multiple times and verify cumulative error
    original_servings = 4
    quantities = [
        Decimal('200'),   # Flour
        Decimal('150'),   # Sugar
        Decimal('3'),     # Eggs
        Decimal('250'),   # Milk
        Decimal('5'),     # Salt
        Decimal('10'),    # Yeast
        Decimal('50'),    # Butter
    ]
    
    # Apply multiple scaling operations
    scaling_sequence = [
        (4, 6),   # Scale up to 6
        (6, 3),   # Scale down to 3
        (3, 8),   # Scale up to 8
        (8, 4),   # Scale back to original
    ]
    
    current_quantities = quantities.copy()
    current_servings = original_servings
    
    try:
        for from_servings, to_servings in scaling_sequence:
            factor = scaler.calculate_base_scaling_factor(from_servings, to_servings)
            current_quantities = [
                scaler.scale_ingredient_quantity(qty, factor)
                for qty in current_quantities
            ]
            current_servings = to_servings
        
        # After scaling 4->6->3->8->4, we should be back to original
        assert current_servings == original_servings
        
        # Check cumulative error for each ingredient
        passed = 0
        total = len(quantities)
        
        for original, final in zip(quantities, current_quantities):
            try:
                assert_accuracy(original, final, Decimal('0.001'))
                passed += 1
            except Exception as e:
                print(f"    ❌ Cumulative error too large: original={original}, final={final}")
        
        print(f"  ✅ Cumulative error analysis: {passed}/{total} ingredients within tolerance")
        return passed, total
    except Exception as e:
        print(f"  ❌ Cumulative error analysis failed: {e}")
        return 0, len(quantities)


def test_overall_accuracy_requirement():
    """Comprehensive test to verify 99.9% accuracy requirement is met."""
    scaler = RecipeScaler(use_rounding=False, use_constraints=False)
    
    # Run 1000 random scaling operations
    random.seed(42)  # Reproducible results
    
    total_tests = 1000
    passed_tests = 0
    max_error = Decimal('0')
    
    for _ in range(total_tests):
        # Random servings and quantities
        original_servings = random.randint(1, 20)
        target_servings = random.randint(1, 20)
        quantity = Decimal(str(random.uniform(0.1, 1000)))
        
        # Calculate expected result
        expected_factor = Decimal(target_servings) / Decimal(original_servings)
        expected_scaled = quantity * expected_factor
        
        # Calculate actual result
        factor = scaler.calculate_base_scaling_factor(original_servings, target_servings)
        scaled = scaler.scale_ingredient_quantity(quantity, factor)
        
        # Check accuracy
        error = calculate_relative_error(expected_scaled, scaled)
        max_error = max(max_error, error)
        
        if error <= Decimal('0.001'):  # 0.1% error = 99.9% accuracy
            passed_tests += 1
    
    accuracy_rate = passed_tests / total_tests
    print(f"  📊 Overall accuracy test results:")
    print(f"      Total tests: {total_tests}")
    print(f"      Passed tests: {passed_tests}")
    print(f"      Accuracy rate: {accuracy_rate * 100:.2f}%")
    print(f"      Maximum error: {max_error * 100:.4f}%")
    
    if accuracy_rate >= 0.999:
        print(f"  ✅ 99.9% accuracy requirement: PASSED")
        return passed_tests, total_tests
    else:
        print(f"  ❌ 99.9% accuracy requirement: FAILED ({accuracy_rate * 100:.2f}%)")
        return 0, 1


def run_all_tests():
    """Run all accuracy tests and generate results."""
    print("=" * 60)
    print("SCALING ACCURACY TEST SUITE")
    print("=" * 60)
    print()
    
    total_passed = 0
    total_tests = 0
    
    # Test 1: Basic scaling precision
    print("1. Basic Scaling Precision Test")
    passed, tests = test_basic_scaling_precision()
    total_passed += passed
    total_tests += tests
    print()
    
    # Test 2: Calorie calculation accuracy
    print("2. Calorie Calculation Accuracy Test")
    passed, tests = test_calorie_calculation_accuracy()
    total_passed += passed
    total_tests += tests
    print()
    
    # Test 3: Participant coefficient accuracy
    print("3. Participant Coefficient Accuracy Test")
    passed, tests = test_participant_coefficient_accuracy()
    total_passed += passed
    total_tests += tests
    print()
    
    # Test 4: Cumulative error analysis
    print("4. Cumulative Error Analysis Test")
    passed, tests = test_cumulative_error_analysis()
    total_passed += passed
    total_tests += tests
    print()
    
    # Test 5: Overall accuracy requirement
    print("5. Overall 99.9% Accuracy Requirement Test")
    passed, tests = test_overall_accuracy_requirement()
    total_passed += passed
    total_tests += tests
    print()
    
    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total tests passed: {total_passed}/{total_tests}")
    print(f"Overall success rate: {(total_passed/total_tests)*100:.1f}%")
    
    if total_passed == total_tests:
        print("🎉 ALL TESTS PASSED - 99.9% ACCURACY REQUIREMENT MET")
        return True
    else:
        print("❌ SOME TESTS FAILED - ACCURACY REQUIREMENT NOT MET")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)