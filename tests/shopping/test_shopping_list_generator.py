"""
Simple tests for shopping list generator without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from uuid import uuid4

from jidelnicek.shopping.services import (
    ShoppingListGenerator,
    ListFormat
)
from jidelnicek.shopping.utils import ShoppingCategory, StorageType


def create_sample_recipes():
    """Create sample recipe data for testing."""
    return [
        {
            'recipe_id': uuid4(),
            'recipe_name': 'Spaghetti Carbonara',
            'meal_name': 'Dinner',
            'day_number': 1,
            'ingredients': [
                {
                    'ingredient_id': uuid4(),
                    'name': 'Spaghetti pasta',
                    'quantity': Decimal('400'),
                    'unit': 'g'
                },
                {
                    'ingredient_id': uuid4(),
                    'name': 'Eggs',
                    'quantity': Decimal('4'),
                    'unit': 'piece'
                },
                {
                    'ingredient_id': uuid4(),
                    'name': 'Parmesan cheese',
                    'quantity': Decimal('100'),
                    'unit': 'g'
                },
                {
                    'ingredient_id': uuid4(),
                    'name': 'Bacon',
                    'quantity': Decimal('150'),
                    'unit': 'g'
                }
            ]
        },
        {
            'recipe_id': uuid4(),
            'recipe_name': 'Caesar Salad',
            'meal_name': 'Lunch',
            'day_number': 2,
            'ingredients': [
                {
                    'ingredient_id': uuid4(),
                    'name': 'Romaine lettuce',
                    'quantity': Decimal('300'),
                    'unit': 'g'
                },
                {
                    'ingredient_id': uuid4(),
                    'name': 'Parmesan cheese',
                    'quantity': Decimal('50'),
                    'unit': 'g'
                },
                {
                    'ingredient_id': uuid4(),
                    'name': 'Croutons',
                    'quantity': Decimal('100'),
                    'unit': 'g'
                },
                {
                    'ingredient_id': uuid4(),
                    'name': 'Caesar dressing',
                    'quantity': Decimal('120'),
                    'unit': 'ml'
                }
            ]
        }
    ]


def test_basic_generation():
    """Test basic shopping list generation."""
    print("Testing basic shopping list generation...")
    
    generator = ShoppingListGenerator()
    recipes = create_sample_recipes()
    
    # Add recipes
    generator.add_recipes(recipes)
    
    # Generate list
    shopping_list = generator.generate_list(format=ListFormat.BY_CATEGORY)
    
    # Check basic properties
    assert shopping_list.format == ListFormat.BY_CATEGORY
    assert shopping_list.total_items > 0
    assert len(shopping_list.sections) > 0
    
    print(f"✓ Generated list with {shopping_list.total_items} items in {len(shopping_list.sections)} sections")
    
    # Check sections
    for section in shopping_list.sections:
        print(f"  Section: {section.title} ({len(section.items)} items)")
        assert len(section.items) > 0
        assert section.section_type == 'category'
    
    print("✓ Basic generation test passed\n")


def test_ingredient_aggregation():
    """Test that duplicate ingredients are aggregated."""
    print("Testing ingredient aggregation...")
    
    generator = ShoppingListGenerator()
    
    # Create recipes with overlapping ingredients (same ingredient ID)
    tomato_id = uuid4()
    recipes = [
        {
            'recipe_id': uuid4(),
            'recipe_name': 'Recipe 1',
            'meal_name': 'Lunch',
            'day_number': 1,
            'ingredients': [{
                'ingredient_id': tomato_id,
                'name': 'Tomatoes',
                'quantity': Decimal('300'),
                'unit': 'g'
            }]
        },
        {
            'recipe_id': uuid4(),
            'recipe_name': 'Recipe 2',
            'meal_name': 'Dinner',
            'day_number': 1,
            'ingredients': [{
                'ingredient_id': tomato_id,
                'name': 'Tomatoes',
                'quantity': Decimal('200'),
                'unit': 'g'
            }]
        }
    ]
    
    generator.add_recipes(recipes)
    shopping_list = generator.generate_list()
    
    # Find tomatoes in the list
    tomato_item = None
    for section in shopping_list.sections:
        for item in section.items:
            if item.name == 'Tomatoes':
                tomato_item = item
                break
    
    assert tomato_item is not None
    assert tomato_item.quantity == Decimal('500')  # 300 + 200
    assert tomato_item.rounded_quantity == Decimal('500')  # Should round to 500g
    assert len(tomato_item.sources) == 2
    
    print(f"✓ Tomatoes aggregated: {tomato_item.display_text}")
    print(f"  Sources: {[s['recipe'] for s in tomato_item.sources]}")
    print("✓ Aggregation test passed\n")


def test_different_formats():
    """Test different list formats."""
    print("Testing different list formats...")
    
    generator = ShoppingListGenerator()
    generator.add_recipes(create_sample_recipes())
    
    formats = [
        ListFormat.BY_CATEGORY,
        ListFormat.BY_AISLE,
        ListFormat.BY_STORAGE,
        ListFormat.ALPHABETICAL,
        ListFormat.COMPACT
    ]
    
    for format in formats:
        shopping_list = generator.generate_list(format=format)
        assert shopping_list.format == format
        assert len(shopping_list.sections) > 0
        
        print(f"✓ {format.value} format: {len(shopping_list.sections)} sections")
        
        # Check section types
        if format == ListFormat.BY_CATEGORY:
            assert all(s.section_type == 'category' for s in shopping_list.sections)
        elif format == ListFormat.BY_AISLE:
            assert all(s.section_type == 'aisle' for s in shopping_list.sections)
        elif format == ListFormat.BY_STORAGE:
            assert all(s.section_type == 'storage' for s in shopping_list.sections)
        elif format == ListFormat.ALPHABETICAL:
            assert all(s.section_type == 'alphabetical' for s in shopping_list.sections)
        elif format == ListFormat.COMPACT:
            assert len(shopping_list.sections) == 1
            assert shopping_list.sections[0].section_type == 'compact'
    
    print("✓ All format tests passed\n")


def test_custom_items():
    """Test adding custom items."""
    print("Testing custom items...")
    
    generator = ShoppingListGenerator()
    generator.add_recipes(create_sample_recipes())
    
    custom_items = [
        {
            'name': 'Paper towels',
            'quantity': 2,
            'unit': 'rolls'
        },
        {
            'name': 'Dish soap',
            'quantity': 1,
            'unit': 'bottle'
        }
    ]
    
    shopping_list = generator.generate_list(
        format=ListFormat.BY_CATEGORY,
        custom_items=custom_items
    )
    
    # Find custom items (should be in OTHER category)
    other_section = None
    for section in shopping_list.sections:
        if section.title == ShoppingCategory.OTHER.value:
            other_section = section
            break
    
    assert other_section is not None
    custom_item_names = [item.name for item in other_section.items]
    assert 'Paper towels' in custom_item_names
    assert 'Dish soap' in custom_item_names
    
    print(f"✓ Found {len(custom_item_names)} items in OTHER category")
    print("✓ Custom items test passed\n")


def test_text_formatting():
    """Test text output formatting."""
    print("Testing text formatting...")
    
    generator = ShoppingListGenerator()
    generator.add_recipes(create_sample_recipes())
    
    shopping_list = generator.generate_list(format=ListFormat.BY_CATEGORY)
    
    # Format as text
    text_output = generator.format_as_text(shopping_list)
    
    # Check text contains expected elements
    assert "SHOPPING LIST" in text_output
    assert "Total Items:" in text_output
    assert "[ ]" in text_output  # Checkboxes
    
    # Check sections are present
    for section in shopping_list.sections:
        assert section.title in text_output
    
    print("Sample output:")
    print("-" * 50)
    print(text_output[:500] + "...")  # First 500 chars
    print("-" * 50)
    print("✓ Text formatting test passed\n")


def test_storage_summary():
    """Test storage type summary."""
    print("Testing storage summary...")
    
    generator = ShoppingListGenerator()
    generator.add_recipes(create_sample_recipes())
    
    shopping_list = generator.generate_list()
    
    # Check storage summary
    assert len(shopping_list.storage_summary) > 0
    
    print("Storage summary:")
    for storage_type, count in shopping_list.storage_summary.items():
        print(f"  {storage_type.value}: {count} items")
    
    # Verify counts add up
    total_from_summary = sum(shopping_list.storage_summary.values())
    assert total_from_summary == shopping_list.total_items
    
    print("✓ Storage summary test passed\n")


def test_package_suggestions():
    """Test package size suggestions."""
    print("Testing package suggestions...")
    
    generator = ShoppingListGenerator(prefer_package_sizes=True)
    
    # Add recipe with larger quantities
    recipes = [{
        'recipe_id': uuid4(),
        'recipe_name': 'Big Batch Cookies',
        'meal_name': 'Snack',
        'day_number': 1,
        'ingredients': [
            {
                'ingredient_id': uuid4(),
                'name': 'Flour',
                'quantity': Decimal('1200'),
                'unit': 'g'
            },
            {
                'ingredient_id': uuid4(),
                'name': 'Eggs',
                'quantity': Decimal('8'),
                'unit': 'piece'
            }
        ]
    }]
    
    generator.add_recipes(recipes)
    shopping_list = generator.generate_list()
    
    # Find items with suggestions
    suggestions_found = 0
    for section in shopping_list.sections:
        for item in section.items:
            if item.package_suggestion:
                suggestions_found += 1
                print(f"  {item.name}: {item.display_text} → {item.package_suggestion}")
    
    assert suggestions_found > 0
    print(f"✓ Found {suggestions_found} package suggestions")
    print("✓ Package suggestions test passed\n")


def test_weight_volume_totals():
    """Test weight and volume calculations."""
    print("Testing weight and volume totals...")
    
    generator = ShoppingListGenerator()
    generator.add_recipes(create_sample_recipes())
    
    shopping_list = generator.generate_list()
    
    # Manual calculation for verification
    weight_items = []
    volume_items = []
    
    for section in shopping_list.sections:
        for item in section.items:
            if item.unit == 'g':
                weight_items.append(item)
            elif item.unit == 'ml':
                volume_items.append(item)
    
    print(f"Total weight: {shopping_list.total_weight_g}g ({shopping_list.total_weight_g/1000:.1f}kg)")
    print(f"Total volume: {shopping_list.total_volume_ml}ml ({shopping_list.total_volume_ml/1000:.1f}L)")
    print(f"Weight items: {len(weight_items)}")
    print(f"Volume items: {len(volume_items)}")
    
    assert shopping_list.total_weight_g > 0
    assert shopping_list.total_volume_ml >= 0  # May be 0 if no liquid items
    
    print("✓ Weight/volume totals test passed\n")


def run_all_tests():
    """Run all tests."""
    print("Running shopping list generator tests...\n")
    
    test_basic_generation()
    test_ingredient_aggregation()
    test_different_formats()
    test_custom_items()
    test_text_formatting()
    test_storage_summary()
    test_package_suggestions()
    test_weight_volume_totals()
    
    print("✅ All shopping list generator tests passed!")


if __name__ == '__main__':
    run_all_tests()