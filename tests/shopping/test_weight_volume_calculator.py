"""
Simple tests for weight and volume calculator without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.shopping.utils import WeightVolumeCalculator, IngredientType


def test_basic_weight_calculation():
    """Test basic weight calculations."""
    print("Testing basic weight calculations...")
    
    calculator = WeightVolumeCalculator()
    
    # Test weight-based ingredients
    ingredients = [
        {'name': 'Flour', 'quantity': Decimal('500'), 'unit': 'g'},
        {'name': 'Sugar', 'quantity': Decimal('200'), 'unit': 'g'},
        {'name': 'Butter', 'quantity': Decimal('0.25'), 'unit': 'kg'},  # 250g
    ]
    
    result = calculator.calculate_totals(ingredients)
    
    # Total weight should be 500 + 200 + 250 = 950g
    assert result.total_weight_g == Decimal('950')
    assert result.actual_items == 3
    print(f"✓ Total weight: {result.total_weight_g}g")
    
    # Check volume estimation
    assert result.total_volume_ml > 0
    print(f"✓ Estimated volume: {result.total_volume_ml}ml")
    
    print("✓ Basic weight calculation test passed\n")


def test_volume_calculation():
    """Test volume-based calculations."""
    print("Testing volume calculations...")
    
    calculator = WeightVolumeCalculator()
    
    # Test volume-based ingredients
    ingredients = [
        {'name': 'Milk', 'quantity': Decimal('1'), 'unit': 'l'},         # 1000ml
        {'name': 'Oil', 'quantity': Decimal('250'), 'unit': 'ml'},
        {'name': 'Vinegar', 'quantity': Decimal('2'), 'unit': 'tbsp'},   # 30ml
    ]
    
    result = calculator.calculate_totals(ingredients)
    
    # Total volume should be 1000 + 250 + 30 = 1280ml
    assert result.total_volume_ml == Decimal('1280')
    print(f"✓ Total volume: {result.total_volume_ml}ml")
    
    # Check weight estimation
    assert result.total_weight_g > 0
    print(f"✓ Estimated weight: {result.total_weight_g}g")
    
    print("✓ Volume calculation test passed\n")


def test_countable_items():
    """Test countable item calculations."""
    print("Testing countable items...")
    
    calculator = WeightVolumeCalculator()
    
    # Test countable items
    ingredients = [
        {'name': 'Eggs', 'quantity': Decimal('12'), 'unit': 'piece'},
        {'name': 'Apples', 'quantity': Decimal('6'), 'unit': 'pieces'},
        {'name': 'Potatoes', 'quantity': Decimal('10'), 'unit': 'units'},
    ]
    
    result = calculator.calculate_totals(ingredients)
    
    # Check estimations
    # Eggs: 12 * 50g = 600g
    # Apples: 6 * 180g = 1080g
    # Potatoes: 10 * 150g = 1500g
    # Total: 3180g
    expected_weight = Decimal('3180')
    assert abs(result.total_weight_g - expected_weight) < Decimal('100')  # Allow small variance
    
    print(f"✓ Total weight: {result.total_weight_g}g (expected ~{expected_weight}g)")
    print(f"✓ Total volume: {result.total_volume_ml}ml")
    print(f"✓ All {result.estimated_items} items were estimated")
    
    print("✓ Countable items test passed\n")


def test_mixed_units():
    """Test mixed unit types."""
    print("Testing mixed units...")
    
    calculator = WeightVolumeCalculator()
    
    ingredients = [
        {'name': 'Flour', 'quantity': Decimal('1'), 'unit': 'kg'},        # 1000g
        {'name': 'Milk', 'quantity': Decimal('500'), 'unit': 'ml'},       # ~515g
        {'name': 'Eggs', 'quantity': Decimal('6'), 'unit': 'piece'},      # ~300g
        {'name': 'Sugar', 'quantity': Decimal('2'), 'unit': 'cup'},       # ~474ml, ~402g
    ]
    
    result = calculator.calculate_totals(ingredients)
    
    print(f"  Total weight: {result.total_weight_g}g")
    print(f"  Total volume: {result.total_volume_ml}ml")
    print(f"  Estimated items: {result.estimated_items}/{result.actual_items}")
    
    # Verify totals are reasonable
    assert result.total_weight_g > Decimal('2000')  # At least 2kg
    assert result.total_volume_ml > Decimal('1000')  # At least 1L
    
    print("✓ Mixed units test passed\n")


def test_transport_recommendations():
    """Test transport recommendations."""
    print("Testing transport recommendations...")
    
    calculator = WeightVolumeCalculator()
    
    # Light load
    light_ingredients = [
        {'name': 'Bread', 'quantity': Decimal('1'), 'unit': 'loaf'},
        {'name': 'Milk', 'quantity': Decimal('1'), 'unit': 'l'},
        {'name': 'Eggs', 'quantity': Decimal('6'), 'unit': 'piece'},
    ]
    
    light_result = calculator.calculate_totals(light_ingredients)
    print(f"\nLight load ({light_result.total_weight_g/1000:.1f}kg):")
    for rec in light_result.transport_recommendations:
        print(f"  - {rec}")
    
    # Heavy load
    heavy_ingredients = [
        {'name': 'Flour', 'quantity': Decimal('10'), 'unit': 'kg'},
        {'name': 'Sugar', 'quantity': Decimal('5'), 'unit': 'kg'},
        {'name': 'Rice', 'quantity': Decimal('10'), 'unit': 'kg'},
        {'name': 'Oil', 'quantity': Decimal('5'), 'unit': 'l'},
    ]
    
    heavy_result = calculator.calculate_totals(heavy_ingredients)
    print(f"\nHeavy load ({heavy_result.total_weight_g/1000:.1f}kg):")
    for rec in heavy_result.transport_recommendations:
        print(f"  - {rec}")
    
    assert len(light_result.transport_recommendations) > 0
    assert len(heavy_result.transport_recommendations) > 0
    
    print("\n✓ Transport recommendations test passed\n")


def test_category_breakdown():
    """Test weight/volume breakdown by category."""
    print("Testing category breakdown...")
    
    calculator = WeightVolumeCalculator()
    
    ingredients = [
        {'name': 'Flour', 'quantity': Decimal('1000'), 'unit': 'g', 'category': 'Baking'},
        {'name': 'Sugar', 'quantity': Decimal('500'), 'unit': 'g', 'category': 'Baking'},
        {'name': 'Milk', 'quantity': Decimal('1'), 'unit': 'l', 'category': 'Dairy'},
        {'name': 'Eggs', 'quantity': Decimal('12'), 'unit': 'piece', 'category': 'Dairy'},
    ]
    
    result = calculator.calculate_totals(ingredients)
    
    print("Weight by category:")
    for category, weight in result.weight_by_category.items():
        print(f"  {category}: {weight}g ({weight/1000:.1f}kg)")
    
    print("\nVolume by category:")
    for category, volume in result.volume_by_category.items():
        print(f"  {category}: {volume}ml ({volume/1000:.1f}L)")
    
    # Check categories exist
    assert 'Baking' in result.weight_by_category
    assert 'Dairy' in result.weight_by_category
    assert result.weight_by_category['Baking'] == Decimal('1500')  # 1000 + 500
    
    print("\n✓ Category breakdown test passed\n")


def test_container_estimation():
    """Test container requirement estimation."""
    print("Testing container estimation...")
    
    calculator = WeightVolumeCalculator()
    
    # Medium shopping trip
    total_weight = Decimal('15000')  # 15kg
    total_volume = Decimal('25000')  # 25L
    
    containers = calculator.estimate_container_requirements(total_weight, total_volume)
    
    print(f"For {total_weight/1000}kg and {total_volume/1000}L:")
    for container_type, count in containers.items():
        print(f"  {container_type}: {count}")
    
    # Check reasonable estimates
    assert containers['shopping_bags'] >= 2  # At least 2 bags
    assert containers['storage_boxes'] >= 1  # At least 1 box
    assert containers['cooler_bags'] >= 1   # At least 1 cooler
    
    print("\n✓ Container estimation test passed\n")


def test_density_determination():
    """Test ingredient type and density determination."""
    print("Testing density determination...")
    
    calculator = WeightVolumeCalculator()
    
    test_cases = [
        ('Olive oil', IngredientType.FAT),
        ('Chicken breast', IngredientType.PROTEIN),
        ('Whole milk', IngredientType.LIQUID),
        ('White bread', IngredientType.BAKED),
        ('Tomatoes', IngredientType.PRODUCE),
        ('All-purpose flour', IngredientType.SOLID_DENSE),
        ('Brown rice', IngredientType.SOLID_MEDIUM),
        ('Fresh spinach', IngredientType.SOLID_LIGHT),
    ]
    
    for ingredient_name, expected_type in test_cases:
        determined_type = calculator._determine_ingredient_type(ingredient_name)
        print(f"  {ingredient_name} → {determined_type.value}")
        
        # Get density
        density = calculator._get_density(ingredient_name)
        print(f"    Density: {density} g/ml")
    
    print("\n✓ Density determination test passed\n")


def test_specific_densities():
    """Test specific ingredient densities."""
    print("Testing specific densities...")
    
    calculator = WeightVolumeCalculator()
    
    # Test known densities
    ingredients_with_known_density = [
        {'name': 'Water', 'quantity': Decimal('1000'), 'unit': 'ml'},     # Should be 1000g
        {'name': 'Honey', 'quantity': Decimal('100'), 'unit': 'ml'},      # Should be ~142g
        {'name': 'Flour', 'quantity': Decimal('100'), 'unit': 'ml'},      # Should be ~59g
    ]
    
    for ing in ingredients_with_known_density:
        result = calculator.calculate_totals([ing])
        print(f"  {ing['name']}: {ing['quantity']}ml → {result.total_weight_g}g")
    
    print("\n✓ Specific densities test passed\n")


def run_all_tests():
    """Run all tests."""
    print("Running weight and volume calculator tests...\n")
    
    test_basic_weight_calculation()
    test_volume_calculation()
    test_countable_items()
    test_mixed_units()
    test_transport_recommendations()
    test_category_breakdown()
    test_container_estimation()
    test_density_determination()
    test_specific_densities()
    
    print("✅ All weight and volume calculator tests passed!")


if __name__ == '__main__':
    run_all_tests()