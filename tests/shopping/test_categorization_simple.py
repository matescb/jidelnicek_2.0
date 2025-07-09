"""
Simple tests for ingredient categorization without full app setup.
"""

import sys
sys.path.insert(0, 'src')

from jidelnicek.shopping.utils.categorization import (
    IngredientCategorizer, 
    ShoppingCategory, 
    StorageType
)


def test_basic_categorization():
    """Test basic ingredient categorization."""
    print("Testing basic categorization...")
    
    categorizer = IngredientCategorizer()
    
    # Test various ingredients
    test_cases = [
        ('Tomatoes', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Milk', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Chicken breast', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        ('Bread', ShoppingCategory.BAKERY, StorageType.ROOM_TEMP),
        ('Canned tomatoes', ShoppingCategory.CANNED_GOODS, StorageType.ROOM_TEMP),
        ('Frozen peas', ShoppingCategory.FROZEN, StorageType.FROZEN),
        ('Olive oil', ShoppingCategory.OILS_VINEGARS, StorageType.COOL_DRY),
        ('Flour', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        ('Salt', ShoppingCategory.SPICES_HERBS, StorageType.COOL_DRY),
        ('Pasta', ShoppingCategory.PASTA_GRAINS, StorageType.COOL_DRY),
    ]
    
    for ingredient, expected_category, expected_storage in test_cases:
        result = categorizer.categorize_ingredient(ingredient)
        assert result.category == expected_category, f"{ingredient}: expected {expected_category}, got {result.category}"
        assert result.storage_type == expected_storage, f"{ingredient}: expected {expected_storage}, got {result.storage_type}"
        print(f"✓ {ingredient} → {result.category.value} ({result.storage_type.value})")
    
    print("✓ Basic categorization test passed\n")


def test_subcategory_detection():
    """Test subcategory detection."""
    print("Testing subcategory detection...")
    
    categorizer = IngredientCategorizer()
    
    test_cases = [
        ('Organic tomatoes', 'organic'),
        ('Gluten-free bread', 'gluten_free'),
        ('Vegan cheese', 'vegan'),
        ('Low-fat milk', 'low_fat'),
        ('Sugar free cookies', 'sugar_free'),
        ('Whole grain pasta', 'whole_grain'),
    ]
    
    for ingredient, expected_subcat in test_cases:
        result = categorizer.categorize_ingredient(ingredient)
        assert result.subcategory == expected_subcat, f"{ingredient}: expected subcategory {expected_subcat}, got {result.subcategory}"
        print(f"✓ {ingredient} → subcategory: {result.subcategory}")
    
    print("✓ Subcategory detection test passed\n")


def test_case_insensitive():
    """Test case-insensitive matching."""
    print("Testing case-insensitive matching...")
    
    categorizer = IngredientCategorizer()
    
    test_cases = [
        ('CHICKEN', 'chicken', 'ChIcKeN'),
        ('milk', 'MILK', 'Milk'),
        ('Flour', 'flour', 'FLOUR'),
    ]
    
    for variations in test_cases:
        categories = [categorizer.categorize_ingredient(v).category for v in variations]
        assert all(c == categories[0] for c in categories), f"Categories don't match for {variations}"
        print(f"✓ All variations of '{variations[0]}' categorized consistently")
    
    print("✓ Case-insensitive test passed\n")


def test_frozen_priority():
    """Test that 'frozen' keyword takes priority."""
    print("Testing frozen priority...")
    
    categorizer = IngredientCategorizer()
    
    # Even though these contain other keywords, 'frozen' should win
    test_cases = [
        'Frozen chicken',
        'Frozen vegetables',
        'Frozen bread',
        'Frozen fruit',
    ]
    
    for ingredient in test_cases:
        result = categorizer.categorize_ingredient(ingredient)
        assert result.category == ShoppingCategory.FROZEN, f"{ingredient} should be FROZEN"
        assert result.storage_type == StorageType.FROZEN
        print(f"✓ {ingredient} → {result.category.value}")
    
    print("✓ Frozen priority test passed\n")


def test_categorize_list():
    """Test categorizing a list of ingredients."""
    print("Testing list categorization...")
    
    categorizer = IngredientCategorizer()
    
    ingredients = [
        {'name': 'Tomatoes', 'quantity': 500, 'unit': 'g'},
        {'name': 'Mozzarella cheese', 'quantity': 200, 'unit': 'g'},
        {'name': 'Fresh basil', 'quantity': 1, 'unit': 'bunch'},
        {'name': 'Olive oil', 'quantity': 50, 'unit': 'ml'},
        {'name': 'Salt', 'quantity': 5, 'unit': 'g'},
        {'name': 'Bread', 'quantity': 1, 'unit': 'loaf'},
    ]
    
    categorized = categorizer.categorize_ingredients(ingredients)
    
    # Check categories
    assert ShoppingCategory.PRODUCE in categorized
    assert ShoppingCategory.DAIRY in categorized
    assert ShoppingCategory.OILS_VINEGARS in categorized
    assert ShoppingCategory.SPICES_HERBS in categorized
    assert ShoppingCategory.BAKERY in categorized
    
    # Check specific ingredients
    produce = categorized[ShoppingCategory.PRODUCE]
    assert len(produce) == 2  # Tomatoes and basil
    assert any(ing['name'] == 'Tomatoes' for ing in produce)
    assert any(ing['name'] == 'Fresh basil' for ing in produce)
    
    print(f"  Found {len(categorized)} categories:")
    for category, items in categorized.items():
        print(f"  - {category.value}: {len(items)} items")
    
    print("✓ List categorization test passed\n")


def test_storage_grouping():
    """Test grouping by storage requirements."""
    print("Testing storage grouping...")
    
    categorizer = IngredientCategorizer()
    
    ingredients = [
        {'name': 'Milk'},
        {'name': 'Eggs'},
        {'name': 'Frozen peas'},
        {'name': 'Ice cream'},
        {'name': 'Flour'},
        {'name': 'Sugar'},
        {'name': 'Fresh lettuce'},
        {'name': 'Tomatoes'},
    ]
    
    storage_groups = categorizer.get_storage_requirements(ingredients)
    
    # Check storage groups
    assert StorageType.REFRIGERATED in storage_groups
    assert StorageType.FROZEN in storage_groups
    assert StorageType.COOL_DRY in storage_groups
    assert StorageType.PRODUCE in storage_groups
    
    # Check counts
    assert len(storage_groups[StorageType.REFRIGERATED]) == 2  # Milk, Eggs
    assert len(storage_groups[StorageType.FROZEN]) == 2  # Frozen peas, Ice cream
    assert len(storage_groups[StorageType.COOL_DRY]) == 2  # Flour, Sugar
    assert len(storage_groups[StorageType.PRODUCE]) == 2  # Lettuce, Tomatoes
    
    print(f"  Storage groups:")
    for storage_type, items in storage_groups.items():
        print(f"  - {storage_type.value}: {len(items)} items")
    
    print("✓ Storage grouping test passed\n")


def test_shopping_route():
    """Test shopping route optimization."""
    print("Testing shopping route...")
    
    categorizer = IngredientCategorizer()
    
    categories = {
        ShoppingCategory.FROZEN,  # Aisle 7
        ShoppingCategory.PRODUCE,  # Aisle 1
        ShoppingCategory.DAIRY,  # Aisle 2
        ShoppingCategory.MEAT_SEAFOOD,  # Aisle 3
        ShoppingCategory.BAKERY,  # Aisle 4
    }
    
    route = categorizer.get_shopping_route(categories)
    
    # Check that route is sorted by aisle
    aisle_numbers = [aisle for aisle, _ in route]
    assert aisle_numbers == sorted(aisle_numbers), "Route should be sorted by aisle"
    assert aisle_numbers == [1, 2, 3, 4, 7]
    
    print("  Shopping route:")
    for aisle, category in route:
        print(f"  - Aisle {aisle}: {category.value}")
    
    print("✓ Shopping route test passed\n")


def test_custom_categorization():
    """Test custom category mappings."""
    print("Testing custom categorization...")
    
    categorizer = IngredientCategorizer()
    
    # Add custom mapping
    categorizer.add_custom_category(
        'Special ingredient',
        ShoppingCategory.INTERNATIONAL,
        StorageType.COOL_DRY,
        aisle_number=15
    )
    
    # Test it works
    result = categorizer.categorize_ingredient('special ingredient')
    assert result.category == ShoppingCategory.INTERNATIONAL
    assert result.storage_type == StorageType.COOL_DRY
    assert result.aisle_number == 15
    
    # Test case insensitive
    result2 = categorizer.categorize_ingredient('SPECIAL INGREDIENT')
    assert result2.category == ShoppingCategory.INTERNATIONAL
    
    print("✓ Custom categorization test passed\n")


def test_unknown_ingredients():
    """Test handling of unknown ingredients."""
    print("Testing unknown ingredients...")
    
    categorizer = IngredientCategorizer()
    
    # Ingredients that don't match any pattern
    unknown_ingredients = [
        'Mystery item',
        'Random thing',
        'XYZ123',
    ]
    
    for ingredient in unknown_ingredients:
        result = categorizer.categorize_ingredient(ingredient)
        assert result.category == ShoppingCategory.OTHER
        assert result.storage_type == StorageType.ROOM_TEMP
        assert result.aisle_number == 99
        print(f"✓ {ingredient} → {result.category.value} (default)")
    
    print("✓ Unknown ingredients test passed\n")


def run_all_tests():
    """Run all tests."""
    print("Running ingredient categorization tests...\n")
    
    test_basic_categorization()
    test_subcategory_detection()
    test_case_insensitive()
    test_frozen_priority()
    test_categorize_list()
    test_storage_grouping()
    test_shopping_route()
    test_custom_categorization()
    test_unknown_ingredients()
    
    print("✅ All categorization tests passed!")


if __name__ == '__main__':
    run_all_tests()