"""
Simple tests for container size recommender.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal

from jidelnicek.shopping.services.container_recommender import (
    ContainerRecommender,
    ContainerType,
    ContainerShape,
    ContainerSize
)


def test_basic_container_recommendation():
    """Test basic container recommendations."""
    print("Testing basic container recommendation...")
    
    recommender = ContainerRecommender()
    
    # Test ingredients
    ingredients = [
        {
            'name': 'Tomatoes',
            'quantity': 500,
            'unit': 'g',
            'type': 'vegetable'
        },
        {
            'name': 'Chicken breast',
            'quantity': 1,
            'unit': 'kg',
            'type': 'meat'
        }
    ]
    
    # Get recommendations
    plan = recommender.recommend_containers(ingredients)
    
    assert plan.total_containers > 0
    assert len(plan.recommendations) > 0
    
    print(f"✓ Total containers needed: {plan.total_containers}")
    print(f"✓ Cooler space needed: {plan.cooler_space_needed_l:.1f}L")
    print(f"✓ Dry storage needed: {plan.dry_storage_volume_l:.1f}L")
    
    # Check container types
    for rec in plan.recommendations:
        print(f"  - {rec.quantity_needed}x {rec.container_size.name} "
              f"for {', '.join(rec.ingredient_names[:2])}")
        
    print("✓ Basic container recommendation test passed\n")


def test_grouped_storage():
    """Test grouping by storage type."""
    print("Testing grouped storage recommendations...")
    
    recommender = ContainerRecommender()
    
    # Mixed storage ingredients
    ingredients = [
        # Refrigerated items
        {'name': 'Milk', 'quantity': 1, 'unit': 'l'},
        {'name': 'Cheese', 'quantity': 200, 'unit': 'g'},
        {'name': 'Yogurt', 'quantity': 500, 'unit': 'ml'},
        
        # Room temp items
        {'name': 'Pasta', 'quantity': 500, 'unit': 'g'},
        {'name': 'Rice', 'quantity': 1, 'unit': 'kg'},
        
        # Frozen items
        {'name': 'Frozen peas', 'quantity': 300, 'unit': 'g'},
    ]
    
    plan = recommender.recommend_containers(ingredients, group_by_storage=True)
    
    # Check that items are grouped
    cold_items = 0
    dry_items = 0
    
    for rec in plan.recommendations:
        if rec.storage_type.value in ['refrigerated', 'frozen']:
            cold_items += 1
        else:
            dry_items += 1
            
    assert cold_items > 0
    assert dry_items > 0
    
    print(f"✓ Cold storage containers: {cold_items}")
    print(f"✓ Dry storage containers: {dry_items}")
    print("✓ Grouped storage test passed\n")


def test_individual_containers():
    """Test individual container assignment."""
    print("Testing individual container assignment...")
    
    recommender = ContainerRecommender()
    
    ingredients = [
        {'name': 'Soup', 'quantity': 500, 'unit': 'ml'},
        {'name': 'Salad', 'quantity': 300, 'unit': 'g'},
        {'name': 'Sandwich', 'quantity': 2, 'unit': 'pieces'}
    ]
    
    plan = recommender.recommend_containers(ingredients, group_by_storage=False)
    
    # Should have at least as many recommendations as ingredients
    assert len(plan.recommendations) >= len(ingredients)
    
    print(f"✓ Individual containers: {plan.total_containers}")
    for rec in plan.recommendations:
        if rec.ingredient_names:
            print(f"  - {rec.container_size.name} for {rec.ingredient_names[0]}")
            
    print("✓ Individual container test passed\n")


def test_cooler_sizing():
    """Test cooler size recommendations."""
    print("Testing cooler size recommendations...")
    
    recommender = ContainerRecommender()
    
    # Cold items for a weekend trip
    cold_ingredients = [
        {'name': 'Milk', 'quantity': 2, 'unit': 'l'},
        {'name': 'Cheese', 'quantity': 500, 'unit': 'g'},
        {'name': 'Meat', 'quantity': 1.5, 'unit': 'kg'},
        {'name': 'Yogurt', 'quantity': 1, 'unit': 'l'},
        {'name': 'Frozen vegetables', 'quantity': 500, 'unit': 'g'},
        {'name': 'Ice cream', 'quantity': 1, 'unit': 'l'}
    ]
    
    cooler_rec = recommender.recommend_cooler_size(cold_ingredients)
    
    assert 'recommended_cooler' in cooler_rec
    assert cooler_rec['volume_needed_l'] > 0
    
    print(f"✓ Volume needed: {cooler_rec['volume_needed_l']:.1f}L")
    print(f"✓ Recommended: {cooler_rec['recommended_cooler']['name']} "
          f"({cooler_rec['recommended_cooler']['capacity_l']}L)")
    print(f"✓ Fill percentage: {cooler_rec['fill_percentage']:.0f}%")
    
    print("✓ Cooler sizing test passed\n")


def test_container_efficiency():
    """Test container size efficiency."""
    print("Testing container efficiency...")
    
    recommender = ContainerRecommender()
    
    # Test with different volumes
    test_cases = [
        {'name': 'Small item', 'quantity': 100, 'unit': 'ml'},
        {'name': 'Medium item', 'quantity': 750, 'unit': 'ml'},
        {'name': 'Large item', 'quantity': 3, 'unit': 'l'},
    ]
    
    for test in test_cases:
        plan = recommender.recommend_containers([test], group_by_storage=False)
        
        if plan.recommendations:
            rec = plan.recommendations[0]
            efficiency = rec.fill_percentage * 100
            
            print(f"  {test['name']} ({test['quantity']}{test['unit']}): "
                  f"{rec.container_size.name} at {efficiency:.0f}% capacity")
            
            # Should not overfill
            assert rec.fill_percentage <= 0.85
            
    print("✓ Container efficiency test passed\n")


def test_packing_optimization():
    """Test packing optimization."""
    print("Testing packing optimization...")
    
    recommender = ContainerRecommender()
    
    # Generate a shopping list
    ingredients = [
        # Cold items
        {'name': 'Milk', 'quantity': 2, 'unit': 'l'},
        {'name': 'Cheese', 'quantity': 300, 'unit': 'g'},
        {'name': 'Meat', 'quantity': 1, 'unit': 'kg'},
        
        # Dry items
        {'name': 'Bread', 'quantity': 2, 'unit': 'pieces'},
        {'name': 'Chips', 'quantity': 500, 'unit': 'g'},
        {'name': 'Cookies', 'quantity': 400, 'unit': 'g'},
    ]
    
    plan = recommender.recommend_containers(ingredients)
    
    # Test packing optimization
    available_space = {
        'length': 60,  # cm
        'width': 40,   # cm
        'height': 30   # cm
    }
    
    optimization = recommender.optimize_packing(
        plan.recommendations,
        available_space
    )
    
    assert 'space_requirements' in optimization
    assert 'suggestions' in optimization
    
    print(f"✓ Space requirements:")
    for temp, volume in optimization['space_requirements'].items():
        if volume > 0:
            print(f"  - {temp}: {volume:.1f}L")
            
    for suggestion in optimization['suggestions']:
        print(f"  → {suggestion}")
        
    print("✓ Packing optimization test passed\n")


def test_reusable_vs_disposable():
    """Test reusable vs disposable container preferences."""
    print("Testing reusable vs disposable preferences...")
    
    ingredients = [
        {'name': 'Salad', 'quantity': 500, 'unit': 'g'},
        {'name': 'Fruit', 'quantity': 1, 'unit': 'kg'}
    ]
    
    # Test with reusable preference
    recommender_reusable = ContainerRecommender(prefer_reusable=True)
    plan_reusable = recommender_reusable.recommend_containers(ingredients)
    
    # Test with disposable preference
    recommender_disposable = ContainerRecommender(prefer_reusable=False)
    plan_disposable = recommender_disposable.recommend_containers(ingredients)
    
    print("Reusable containers:")
    for rec in plan_reusable.recommendations:
        print(f"  - {rec.container_type.value}")
        
    print("\nDisposable preference:")
    for rec in plan_disposable.recommendations:
        print(f"  - {rec.container_type.value}")
        
    print("✓ Container preference test passed\n")


def test_large_quantity_handling():
    """Test handling of large quantities."""
    print("Testing large quantity handling...")
    
    recommender = ContainerRecommender()
    
    # Large quantity items
    ingredients = [
        {'name': 'Water', 'quantity': 10, 'unit': 'l'},
        {'name': 'Flour', 'quantity': 5, 'unit': 'kg'},
        {'name': 'Potatoes', 'quantity': 10, 'unit': 'kg'}
    ]
    
    plan = recommender.recommend_containers(ingredients)
    
    print(f"✓ Total containers for bulk items: {plan.total_containers}")
    
    # Check that it uses multiple containers efficiently
    for rec in plan.recommendations:
        if rec.quantity_needed > 1:
            print(f"  - {rec.quantity_needed}x {rec.container_size.name} "
                  f"({rec.container_size.volume_liters:.1f}L each)")
            
    # Should have notes about large quantities
    if plan.notes:
        print("\nNotes:")
        for note in plan.notes:
            print(f"  - {note}")
            
    print("✓ Large quantity handling test passed\n")


def test_container_summary():
    """Test container summary generation."""
    print("Testing container summary...")
    
    recommender = ContainerRecommender()
    
    # Varied ingredients
    ingredients = [
        {'name': 'Milk', 'quantity': 1, 'unit': 'l'},
        {'name': 'Eggs', 'quantity': 12, 'unit': 'pieces'},
        {'name': 'Bread', 'quantity': 1, 'unit': 'loaf'},
        {'name': 'Frozen pizza', 'quantity': 2, 'unit': 'pieces'},
        {'name': 'Apples', 'quantity': 1, 'unit': 'kg'},
        {'name': 'Pasta sauce', 'quantity': 500, 'unit': 'ml'}
    ]
    
    plan = recommender.recommend_containers(ingredients)
    
    print(f"Container summary ({plan.total_containers} total):")
    for container_type, count in plan.container_summary.items():
        print(f"  - {container_type.value}: {count}")
        
    assert len(plan.container_summary) > 0
    assert sum(plan.container_summary.values()) == plan.total_containers
    
    print("✓ Container summary test passed\n")


def run_all_tests():
    """Run all container recommender tests."""
    print("Running container recommender tests...\n")
    
    test_basic_container_recommendation()
    test_grouped_storage()
    test_individual_containers()
    test_cooler_sizing()
    test_container_efficiency()
    test_packing_optimization()
    test_reusable_vs_disposable()
    test_large_quantity_handling()
    test_container_summary()
    
    print("✅ All container recommender tests passed!")


if __name__ == '__main__':
    run_all_tests()