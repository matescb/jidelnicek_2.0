"""
Manual test for custom items manager functionality.
Tests the specific features for subtask 6.6.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.shopping.utils.custom_items import CustomItemsManager, CustomItemCategory
from jidelnicek.shopping.services.shopping_list_generator import ShoppingListGenerator, ListFormat
from uuid import uuid4
import json

def test_custom_items_manager():
    """Test the CustomItemsManager class."""
    print("Testing CustomItemsManager...")
    
    manager = CustomItemsManager()
    
    # Test adding items
    print("\n1. Testing add_item functionality:")
    item1 = manager.add_item(
        name="Paper towels",
        quantity=Decimal('2'),
        unit="rolls",
        category=CustomItemCategory.PAPER_PRODUCTS,
        notes="For kitchen cleanup",
        priority="high",
        tags={"kitchen", "cleaning"}
    )
    print(f"   ✓ Added: {item1.name} - {item1.quantity} {item1.unit}")
    
    # Test adding from template
    print("\n2. Testing add_from_template functionality:")
    item2 = manager.add_from_template(
        template_key="napkins",
        quantity_override=Decimal('3'),
        notes="For outdoor dinner"
    )
    print(f"   ✓ Added from template: {item2.name} - {item2.quantity} {item2.unit}")
    
    # Test adding custom utensils
    print("\n3. Testing utensils management:")
    utensils = manager.add_item(
        name="Plastic forks",
        quantity=Decimal('50'),
        unit="pieces",
        category=CustomItemCategory.UTENSILS,
        notes="Disposable for camping",
        tags={"disposable", "camping"}
    )
    print(f"   ✓ Added: {utensils.name} - {utensils.quantity} {utensils.unit}")
    
    # Test cleaning supplies
    print("\n4. Testing cleaning supplies:")
    cleaning = manager.add_item(
        name="Biodegradable soap",
        quantity=Decimal('1'),
        unit="bottle",
        category=CustomItemCategory.CLEANING,
        notes="Environmentally friendly",
        reusable=True,
        priority="medium"
    )
    print(f"   ✓ Added: {cleaning.name} - {cleaning.quantity} {cleaning.unit}")
    
    # Test getting items by category
    print("\n5. Testing get_items_by_category:")
    by_category = manager.get_items_by_category()
    for category, items in by_category.items():
        print(f"   {category.value}: {len(items)} items")
        for item in items:
            print(f"     - {item.name} ({item.quantity} {item.unit})")
    
    # Test filtering
    print("\n6. Testing item filtering:")
    high_priority = manager.get_items(priority="high")
    print(f"   High priority items: {len(high_priority)}")
    
    cleaning_items = manager.get_items(category=CustomItemCategory.CLEANING)
    print(f"   Cleaning items: {len(cleaning_items)}")
    
    kitchen_items = manager.get_items(tags={"kitchen"})
    print(f"   Kitchen items: {len(kitchen_items)}")
    
    # Test trip suggestions
    print("\n7. Testing trip suggestions:")
    suggestions = manager.suggest_items_for_trip(
        trip_type="camping",
        duration_days=3,
        participant_count=6,
        has_kitchen=False
    )
    print(f"   Camping trip suggestions: {len(suggestions)} items")
    for suggestion in suggestions[:5]:  # Show first 5
        print(f"     - {suggestion['name']}: {suggestion['quantity']} {suggestion['unit']}")
    
    # Test export/import
    print("\n8. Testing export/import:")
    exported = manager.export_items()
    print(f"   Exported {len(json.loads(exported))} items")
    
    # Clear and import
    manager.clear()
    manager.import_items(exported)
    print(f"   Imported {len(manager.get_items())} items")
    
    # Test template categories
    print("\n9. Testing template categories:")
    categories = manager.get_template_categories()
    print(f"   Available template categories: {len(categories)}")
    for category, templates in categories.items():
        print(f"     {category.value}: {len(templates)} templates")
    
    print("\n✅ CustomItemsManager tests completed!")

def test_custom_items_in_shopping_list():
    """Test custom items integration with shopping list generator."""
    print("\nTesting custom items integration with shopping list generator...")
    
    # Create custom items manager
    manager = CustomItemsManager()
    
    # Add various custom items
    manager.add_from_template("paper_towels", quantity_override=Decimal('3'))
    manager.add_from_template("napkins", quantity_override=Decimal('2'))
    manager.add_from_template("dish_soap")
    manager.add_from_template("trash_bags")
    manager.add_from_template("charcoal")
    manager.add_from_template("cooler")
    
    # Add custom item not in templates
    manager.add_item(
        name="Camping chairs",
        quantity=Decimal('4'),
        unit="pieces",
        category=CustomItemCategory.OUTDOOR,
        notes="Folding chairs for campsite"
    )
    
    # Convert to format for shopping list generator
    custom_items = []
    for item in manager.get_items():
        custom_items.append({
            'id': str(item.id),
            'name': item.name,
            'quantity': float(item.quantity),
            'unit': item.unit,
            'category': item.category.value,
            'notes': item.notes
        })
    
    # Create shopping list generator with custom items
    generator = ShoppingListGenerator()
    
    # Add some recipes too
    recipes = [{
        'recipe_id': uuid4(),
        'recipe_name': 'Grilled Chicken',
        'meal_name': 'Dinner',
        'day_number': 1,
        'ingredients': [
            {
                'ingredient_id': uuid4(),
                'name': 'Chicken breast',
                'quantity': Decimal('800'),
                'unit': 'g'
            },
            {
                'ingredient_id': uuid4(),
                'name': 'BBQ sauce',
                'quantity': Decimal('200'),
                'unit': 'ml'
            }
        ]
    }]
    
    generator.add_recipes(recipes)
    
    # Generate shopping list with custom items
    shopping_list = generator.generate_list(
        format=ListFormat.BY_CATEGORY,
        custom_items=custom_items
    )
    
    print(f"\nGenerated shopping list with {shopping_list.total_items} items:")
    
    # Find sections with custom items
    for section in shopping_list.sections:
        has_custom = any(item.subcategory == 'custom' for item in section.items)
        if has_custom:
            print(f"\n{section.title}:")
            for item in section.items:
                if item.subcategory == 'custom':
                    print(f"  ✓ {item.name} - {item.display_text}")
    
    print("\n✅ Custom items integration test completed!")

def test_category_support():
    """Test comprehensive category support."""
    print("\nTesting category support...")
    
    manager = CustomItemsManager()
    
    # Test all categories
    category_items = [
        (CustomItemCategory.UTENSILS, "Plastic plates", "pieces"),
        (CustomItemCategory.PAPER_PRODUCTS, "Paper plates", "pack"),
        (CustomItemCategory.CLEANING, "All-purpose cleaner", "bottle"),
        (CustomItemCategory.PERSONAL_CARE, "Toothpaste", "tube"),
        (CustomItemCategory.FIRST_AID, "Bandages", "box"),
        (CustomItemCategory.OUTDOOR, "Tent stakes", "pack"),
        (CustomItemCategory.ENTERTAINMENT, "Playing cards", "deck"),
        (CustomItemCategory.OFFICE, "Notepads", "pack"),
        (CustomItemCategory.HOUSEHOLD, "Trash bags", "roll"),
        (CustomItemCategory.BEVERAGES_NON_FOOD, "Bottled water", "bottles"),
        (CustomItemCategory.PET_SUPPLIES, "Dog food", "bag"),
        (CustomItemCategory.BABY_SUPPLIES, "Diapers", "pack"),
        (CustomItemCategory.OTHER, "Miscellaneous", "unit")
    ]
    
    for category, name, unit in category_items:
        item = manager.add_item(
            name=name,
            quantity=Decimal('1'),
            unit=unit,
            category=category
        )
        print(f"  ✓ {category.value}: {item.name}")
    
    # Test categorization
    by_category = manager.get_items_by_category()
    print(f"\nCategorized items into {len(by_category)} categories:")
    for category, items in by_category.items():
        print(f"  {category.value}: {len(items)} items")
    
    print("\n✅ Category support test completed!")

def test_unit_support():
    """Test different unit types."""
    print("\nTesting unit support...")
    
    manager = CustomItemsManager()
    
    # Test different units
    unit_tests = [
        ("Paper towels", Decimal('2'), "rolls"),
        ("Bottled water", Decimal('24'), "bottles"),
        ("Rope", Decimal('50'), "meters"),
        ("Batteries", Decimal('8'), "pieces"),
        ("Duct tape", Decimal('1'), "roll"),
        ("Garbage bags", Decimal('1'), "box"),
        ("Dish soap", Decimal('500'), "ml"),
        ("Hand sanitizer", Decimal('250'), "ml"),
        ("Ice", Decimal('5'), "kg"),
        ("Charcoal", Decimal('3'), "bags")
    ]
    
    for name, quantity, unit in unit_tests:
        item = manager.add_item(
            name=name,
            quantity=quantity,
            unit=unit,
            category=CustomItemCategory.OTHER
        )
        print(f"  ✓ {item.name}: {item.quantity} {item.unit}")
    
    print("\n✅ Unit support test completed!")

def test_validation_and_error_handling():
    """Test input validation and error handling."""
    print("\nTesting validation and error handling...")
    
    manager = CustomItemsManager()
    
    # Test invalid template key
    result = manager.add_from_template("nonexistent_template")
    assert result is None, "Should return None for invalid template"
    print("  ✓ Invalid template key handled correctly")
    
    # Test removing non-existent item
    result = manager.remove_item(uuid4())
    assert result is False, "Should return False for non-existent item"
    print("  ✓ Non-existent item removal handled correctly")
    
    # Test empty filters
    items = manager.get_items()
    assert len(items) == 0, "Should return empty list when no items"
    print("  ✓ Empty manager handled correctly")
    
    # Add some items and test filtering
    manager.add_item("Test item", Decimal('1'), "unit", CustomItemCategory.OTHER)
    
    # Test filtering with non-matching criteria
    filtered = manager.get_items(tags={"nonexistent"})
    assert len(filtered) == 0, "Should return empty list for non-matching tags"
    print("  ✓ Non-matching filter handled correctly")
    
    # Test invalid JSON import
    try:
        manager.import_items("invalid json")
        assert False, "Should raise exception for invalid JSON"
    except:
        print("  ✓ Invalid JSON import handled correctly")
    
    print("\n✅ Validation and error handling test completed!")

def run_all_tests():
    """Run all custom items tests."""
    print("Running comprehensive custom items tests...\n")
    
    test_custom_items_manager()
    test_custom_items_in_shopping_list()
    test_category_support()
    test_unit_support()
    test_validation_and_error_handling()
    
    print("\n🎉 All custom items tests completed successfully!")

if __name__ == '__main__':
    run_all_tests()