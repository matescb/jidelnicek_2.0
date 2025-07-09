"""
Standalone script to verify scaling accuracy meets 99.9% requirement.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal, getcontext
import random
import statistics

from jidelnicek.recipe.utils.scaling import RecipeScaler, CalorieScaler, ParticipantScaler


# Set high precision for testing
getcontext().prec = 28


def calculate_relative_error(expected: Decimal, actual: Decimal) -> Decimal:
    """Calculate relative error between expected and actual values."""
    if expected == 0:
        return Decimal('0') if actual == 0 else Decimal('inf')
    return abs((actual - expected) / expected)


def test_basic_scaling_accuracy():
    """Test basic scaling accuracy."""
    print("\n=== Testing Basic Scaling Accuracy ===")
    
    scaler = RecipeScaler(use_rounding=False, use_constraints=False)
    errors = []
    
    # Test cases with known results
    test_cases = [
        (4, 6, Decimal('100'), Decimal('150')),
        (3, 7, Decimal('250'), Decimal('583.3333')),
        (8, 3, Decimal('480'), Decimal('180')),
        (5, 11, Decimal('75.5'), Decimal('166.1')),
        (1, 10, Decimal('100'), Decimal('1000')),
    ]
    
    for original, target, quantity, expected in test_cases:
        factor = scaler.calculate_base_scaling_factor(original, target)
        scaled = scaler.scale_ingredient_quantity(quantity, factor)
        
        error = calculate_relative_error(expected, scaled)
        errors.append(float(error))
        
        status = "✓" if error <= Decimal('0.001') else "✗"
        print(f"{status} {original}→{target} servings: {quantity} → {scaled} (error: {error*100:.4f}%)")
    
    avg_error = statistics.mean(errors)
    max_error = max(errors)
    print(f"\nAverage error: {avg_error*100:.4f}%")
    print(f"Maximum error: {max_error*100:.4f}%")
    
    return max_error <= 0.001


def test_calorie_scaling_accuracy():
    """Test calorie-based scaling accuracy."""
    print("\n=== Testing Calorie Scaling Accuracy ===")
    
    scaler = CalorieScaler(use_rounding=False, use_constraints=False)
    errors = []
    
    # Test calorie calculations
    ingredients = [
        {
            'name': 'Flour',
            'quantity': Decimal('250'),
            'unit': 'g',
            'nutritional_data': {'calories': Decimal('364')}
        },
        {
            'name': 'Sugar',
            'quantity': Decimal('100'),
            'unit': 'g',
            'nutritional_data': {'calories': Decimal('387')}
        },
        {
            'name': 'Butter',
            'quantity': Decimal('125'),
            'unit': 'g',
            'nutritional_data': {'calories': Decimal('717')}
        }
    ]
    
    # Calculate expected total
    # Flour: 250 * 3.64 = 910
    # Sugar: 100 * 3.87 = 387
    # Butter: 125 * 7.17 = 896.25
    # Total: 2193.25
    expected_total = Decimal('2193.25')
    actual_total = scaler.calculate_recipe_calories(ingredients)
    
    error = calculate_relative_error(expected_total, actual_total)
    errors.append(float(error))
    
    status = "✓" if error <= Decimal('0.001') else "✗"
    print(f"{status} Total calories: expected {expected_total}, got {actual_total} (error: {error*100:.4f}%)")
    
    # Test scaling to target calories
    target_calories = Decimal('1500')
    recipe_data = {
        'servings': 4,
        'ingredients': ingredients
    }
    
    result = scaler.scale_recipe_to_target_calories(recipe_data, target_calories)
    
    # Verify scaled calories
    scaled_calories = result['total_calories']
    error = calculate_relative_error(target_calories, scaled_calories)
    errors.append(float(error))
    
    status = "✓" if error <= Decimal('0.001') else "✗"
    print(f"{status} Scaled to {target_calories} calories: got {scaled_calories} (error: {error*100:.4f}%)")
    
    avg_error = statistics.mean(errors)
    max_error = max(errors)
    print(f"\nAverage error: {avg_error*100:.4f}%")
    print(f"Maximum error: {max_error*100:.4f}%")
    
    return max_error <= 0.001


def test_participant_scaling_accuracy():
    """Test participant-based scaling accuracy."""
    print("\n=== Testing Participant Scaling Accuracy ===")
    
    scaler = ParticipantScaler(use_rounding=False, use_constraints=False)
    errors = []
    
    participants = [
        {'name': 'Adult', 'coefficient': 100},
        {'name': 'Teen', 'coefficient': 120},
        {'name': 'Child', 'coefficient': 75},
        {'name': 'Toddler', 'coefficient': 50}
    ]
    
    # Expected: 1.0 + 1.2 + 0.75 + 0.5 = 3.45
    expected_effective = Decimal('3.45')
    actual_effective = scaler.calculate_effective_participants(participants)
    
    error = calculate_relative_error(expected_effective, actual_effective)
    errors.append(float(error))
    
    status = "✓" if error <= Decimal('0.001') else "✗"
    print(f"{status} Effective participants: expected {expected_effective}, got {actual_effective} (error: {error*100:.4f}%)")
    
    # Test with meal coefficients
    participants_meal = [
        {'name': 'Athlete', 'coefficient': 150, 'meal_coefficients': {'Lunch': 175}},
        {'name': 'Regular', 'coefficient': 100}
    ]
    
    # At lunch: Athlete uses 175% (not 150% * 175%), Regular uses 100%
    # So: 1.75 + 1.0 = 2.75
    expected_lunch = Decimal('2.75')
    actual_lunch = scaler.calculate_effective_participants(participants_meal, 'Lunch')
    
    error = calculate_relative_error(expected_lunch, actual_lunch)
    errors.append(float(error))
    
    status = "✓" if error <= Decimal('0.001') else "✗"
    print(f"{status} Lunch participants: expected {expected_lunch}, got {actual_lunch} (error: {error*100:.4f}%)")
    
    avg_error = statistics.mean(errors)
    max_error = max(errors)
    print(f"\nAverage error: {avg_error*100:.4f}%")
    print(f"Maximum error: {max_error*100:.4f}%")
    
    return max_error <= 0.001


def run_random_accuracy_tests():
    """Run random tests to verify overall accuracy."""
    print("\n=== Running Random Accuracy Tests ===")
    
    scaler = RecipeScaler(use_rounding=False, use_constraints=False)
    random.seed(42)  # Reproducible results
    
    total_tests = 1000
    passed_tests = 0
    errors = []
    
    for i in range(total_tests):
        # Random parameters
        original_servings = random.randint(1, 20)
        target_servings = random.randint(1, 20)
        quantity = Decimal(str(random.uniform(0.1, 1000)))
        
        # Calculate expected
        expected_factor = Decimal(target_servings) / Decimal(original_servings)
        expected_scaled = quantity * expected_factor
        
        # Calculate actual
        factor = scaler.calculate_base_scaling_factor(original_servings, target_servings)
        scaled = scaler.scale_ingredient_quantity(quantity, factor)
        
        # Check accuracy
        error = calculate_relative_error(expected_scaled, scaled)
        errors.append(float(error))
        
        if error <= Decimal('0.001'):
            passed_tests += 1
        
        # Show progress
        if (i + 1) % 100 == 0:
            print(f"  Completed {i + 1}/{total_tests} tests...")
    
    accuracy_rate = passed_tests / total_tests
    avg_error = statistics.mean(errors)
    max_error = max(errors)
    
    print(f"\nResults from {total_tests} random tests:")
    print(f"  Passed tests: {passed_tests}")
    print(f"  Accuracy rate: {accuracy_rate * 100:.2f}%")
    print(f"  Average error: {avg_error * 100:.6f}%")
    print(f"  Maximum error: {max_error * 100:.6f}%")
    
    return accuracy_rate >= 0.999


def test_cumulative_accuracy():
    """Test accuracy with cumulative operations."""
    print("\n=== Testing Cumulative Accuracy ===")
    
    scaler = RecipeScaler(use_rounding=False, use_constraints=False)
    
    # Start with a quantity
    original = Decimal('100')
    current = original
    
    # Apply series of scaling operations
    operations = [
        (4, 6),   # Scale up 1.5x
        (6, 3),   # Scale down 0.5x
        (3, 8),   # Scale up 2.667x
        (8, 4),   # Scale down 0.5x
    ]
    
    print(f"Starting quantity: {original}")
    
    for from_srv, to_srv in operations:
        factor = scaler.calculate_base_scaling_factor(from_srv, to_srv)
        current = scaler.scale_ingredient_quantity(current, factor)
        print(f"  {from_srv}→{to_srv}: factor={factor}, quantity={current}")
    
    # Should be back to original
    error = calculate_relative_error(original, current)
    
    status = "✓" if error <= Decimal('0.001') else "✗"
    print(f"{status} Final quantity: {current} (error: {error*100:.4f}%)")
    
    return error <= Decimal('0.001')


def main():
    """Run all accuracy tests and report results."""
    print("=" * 60)
    print("Recipe Scaling Accuracy Verification")
    print("Target: 99.9% accuracy (≤0.1% error)")
    print("=" * 60)
    
    tests = [
        ("Basic Scaling", test_basic_scaling_accuracy),
        ("Calorie Scaling", test_calorie_scaling_accuracy),
        ("Participant Scaling", test_participant_scaling_accuracy),
        ("Cumulative Operations", test_cumulative_accuracy),
        ("Random Tests", run_random_accuracy_tests),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n❌ {name} failed with error: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED - 99.9% ACCURACY REQUIREMENT MET")
    else:
        print("❌ SOME TESTS FAILED - ACCURACY REQUIREMENT NOT MET")
    print("=" * 60)
    
    return all_passed


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)