"""
Simple tests for ingredient aggregation without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from uuid import UUID, uuid4

from jidelnicek.shopping.utils.aggregation import (
    IngredientAggregator,
    AggregatedIngredient,
    RecipeSource
)


def test_basic_aggregation():
    """Test basic ingredient aggregation."""
    print("Testing basic aggregation...")
    
    aggregator = IngredientAggregator()
    recipe_id = uuid4()
    flour_id = uuid4()
    
    # Add ingredients
    aggregator.add_recipe_ingredients(
        recipe_id=recipe_id,
        recipe_name="Pancakes",
        meal_name="Breakfast",
        day_number=1,
        ingredients=[
            {
                'ingredient_id': flour_id,
                'name': 'Flour',
                'quantity': Decimal('500'),
                'unit': 'g',
                'category': 'Baking',
                'storage_type': 'dry'
            }
        ]
    )
    
    # Check result
    ingredients = aggregator.get_aggregated_ingredients()
    assert len(ingredients) == 1
    
    flour = aggregator.get_ingredient_by_name("Flour")
    assert flour is not None
    assert flour.total_quantity == Decimal('500')
    assert flour.unit == 'g'
    assert flour.category == 'Baking'
    
    print("✓ Basic aggregation test passed")


def test_multiple_recipes_aggregation():
    """Test aggregating same ingredient from multiple recipes."""
    print("\nTesting multiple recipe aggregation...")
    
    aggregator = IngredientAggregator()
    flour_id = uuid4()
    
    # Recipe 1
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Pancakes",
        meal_name="Breakfast",
        day_number=1,
        ingredients=[{
            'ingredient_id': flour_id,
            'name': 'Flour',
            'quantity': Decimal('200'),
            'unit': 'g'
        }]
    )
    
    # Recipe 2
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Bread",
        meal_name="Lunch",
        day_number=1,
        ingredients=[{
            'ingredient_id': flour_id,
            'name': 'Flour',
            'quantity': Decimal('300'),
            'unit': 'g'
        }]
    )
    
    # Check aggregation
    flour = aggregator.get_ingredient_by_name("Flour")
    assert flour.total_quantity == Decimal('500')  # 200 + 300
    assert len(flour.sources) == 2
    
    breakdown = flour.get_recipe_breakdown()
    assert len(breakdown) == 2
    print(f"  Recipe breakdown: {breakdown}")
    
    print("✓ Multiple recipe aggregation test passed")


def test_unit_normalization():
    """Test unit normalization."""
    print("\nTesting unit normalization...")
    
    aggregator = IngredientAggregator()
    sugar_id = uuid4()
    
    # Add in kg
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Recipe 1",
        meal_name="Lunch",
        day_number=1,
        ingredients=[{
            'ingredient_id': sugar_id,
            'name': 'Sugar',
            'quantity': Decimal('0.5'),
            'unit': 'kg'
        }]
    )
    
    # Add in g
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Recipe 2",
        meal_name="Dinner",
        day_number=1,
        ingredients=[{
            'ingredient_id': sugar_id,
            'name': 'Sugar',
            'quantity': Decimal('250'),
            'unit': 'g'
        }]
    )
    
    # Check total (should be 750g)
    sugar = aggregator.get_ingredient_by_name("Sugar")
    assert sugar.total_quantity == Decimal('750')
    assert sugar.unit == 'g'
    print(f"  Total sugar: {sugar.total_quantity}{sugar.unit}")
    
    print("✓ Unit normalization test passed")


def test_volume_normalization():
    """Test volume unit normalization."""
    print("\nTesting volume normalization...")
    
    aggregator = IngredientAggregator()
    water_id = uuid4()
    
    # Add in liters and ml
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Recipe 1",
        meal_name="Breakfast",
        day_number=1,
        ingredients=[{
            'ingredient_id': water_id,
            'name': 'Water',
            'quantity': Decimal('1.5'),
            'unit': 'l'
        }]
    )
    
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Recipe 2",
        meal_name="Lunch",
        day_number=1,
        ingredients=[{
            'ingredient_id': water_id,
            'name': 'Water',
            'quantity': Decimal('500'),
            'unit': 'ml'
        }]
    )
    
    # Check total (should be 2000ml)
    water = aggregator.get_ingredient_by_name("Water")
    assert water.total_quantity == Decimal('2000')
    assert water.unit == 'ml'
    print(f"  Total water: {water.total_quantity}{water.unit}")
    
    print("✓ Volume normalization test passed")


def test_category_filtering():
    """Test filtering by category."""
    print("\nTesting category filtering...")
    
    aggregator = IngredientAggregator()
    
    ingredients = [
        {
            'ingredient_id': uuid4(),
            'name': 'Flour',
            'quantity': Decimal('500'),
            'unit': 'g',
            'category': 'Baking'
        },
        {
            'ingredient_id': uuid4(),
            'name': 'Milk',
            'quantity': Decimal('250'),
            'unit': 'ml',
            'category': 'Dairy'
        },
        {
            'ingredient_id': uuid4(),
            'name': 'Eggs',
            'quantity': Decimal('3'),
            'unit': 'piece',
            'category': 'Dairy'
        }
    ]
    
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Test Recipe",
        meal_name="Breakfast",
        day_number=1,
        ingredients=ingredients
    )
    
    # Get dairy ingredients
    dairy = aggregator.get_ingredients_by_category("Dairy")
    assert len(dairy) == 2
    dairy_names = [ing.name for ing in dairy]
    assert "Milk" in dairy_names
    assert "Eggs" in dairy_names
    print(f"  Dairy ingredients: {dairy_names}")
    
    print("✓ Category filtering test passed")


def test_summary_stats():
    """Test summary statistics."""
    print("\nTesting summary statistics...")
    
    aggregator = IngredientAggregator()
    
    # Add some ingredients
    ingredients = [
        {
            'ingredient_id': uuid4(),
            'name': 'Flour',
            'quantity': Decimal('1'),
            'unit': 'kg',
            'category': 'Baking'
        },
        {
            'ingredient_id': uuid4(),
            'name': 'Water',
            'quantity': Decimal('2'),
            'unit': 'l',
            'category': 'Liquids'
        },
        {
            'ingredient_id': uuid4(),
            'name': 'Eggs',
            'quantity': Decimal('6'),
            'unit': 'piece',
            'category': 'Dairy'
        }
    ]
    
    aggregator.add_recipe_ingredients(
        recipe_id=uuid4(),
        recipe_name="Test Recipe",
        meal_name="Lunch",
        day_number=1,
        ingredients=ingredients
    )
    
    stats = aggregator.get_summary_stats()
    assert stats['total_ingredients'] == 3
    assert stats['total_weight_g'] == 1000.0  # 1kg flour
    assert stats['total_volume_ml'] == 2000.0  # 2l water
    assert stats['total_categories'] == 3
    
    print(f"  Stats: {stats}")
    print("✓ Summary statistics test passed")


def run_all_tests():
    """Run all tests."""
    print("Running ingredient aggregation tests...\n")
    
    test_basic_aggregation()
    test_multiple_recipes_aggregation()
    test_unit_normalization()
    test_volume_normalization()
    test_category_filtering()
    test_summary_stats()
    
    print("\n✅ All aggregation tests passed!")


if __name__ == '__main__':
    run_all_tests()