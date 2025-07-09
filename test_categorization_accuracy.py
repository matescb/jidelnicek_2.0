#!/usr/bin/env python3
"""
Test categorization accuracy and performance.
"""

import sys
sys.path.insert(0, 'src')

from jidelnicek.shopping.utils.categorization import (
    IngredientCategorizer, 
    ShoppingCategory, 
    StorageType
)
import time

def test_categorization_accuracy():
    """Test accuracy of ingredient categorization."""
    categorizer = IngredientCategorizer()
    
    # Test cases with expected results
    test_cases = [
        # Format: (ingredient_name, expected_category, expected_storage)
        
        # Produce
        ('Fresh tomatoes', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Organic spinach', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Baby carrots', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Red bell peppers', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Bananas', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Lemons', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Fresh basil', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        ('Garlic cloves', ShoppingCategory.PRODUCE, StorageType.PRODUCE),
        
        # Dairy
        ('Whole milk', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Butter', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Cheddar cheese', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Greek yogurt', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Eggs', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Heavy cream', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        ('Mozzarella', ShoppingCategory.DAIRY, StorageType.REFRIGERATED),
        
        # Meat & Seafood
        ('Chicken breast', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        ('Ground beef', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        ('Salmon fillets', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        ('Bacon', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        ('Shrimp', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        ('Pork chops', ShoppingCategory.MEAT_SEAFOOD, StorageType.REFRIGERATED),
        
        # Frozen Foods
        ('Frozen peas', ShoppingCategory.FROZEN, StorageType.FROZEN),
        ('Frozen pizza', ShoppingCategory.FROZEN, StorageType.FROZEN),
        ('Ice cream', ShoppingCategory.FROZEN, StorageType.FROZEN),
        ('Frozen chicken', ShoppingCategory.FROZEN, StorageType.FROZEN),
        ('Frozen berries', ShoppingCategory.FROZEN, StorageType.FROZEN),
        
        # Pantry/Dry Goods
        ('Brown rice', ShoppingCategory.PANTRY, StorageType.COOL_DRY),
        ('Almonds', ShoppingCategory.PANTRY, StorageType.COOL_DRY),
        ('Oats', ShoppingCategory.PANTRY, StorageType.COOL_DRY),
        ('Quinoa', ShoppingCategory.PANTRY, StorageType.COOL_DRY),
        ('Cashews', ShoppingCategory.PANTRY, StorageType.COOL_DRY),
        
        # Canned Goods
        ('Canned tomatoes', ShoppingCategory.CANNED_GOODS, StorageType.ROOM_TEMP),
        ('Canned beans', ShoppingCategory.CANNED_GOODS, StorageType.ROOM_TEMP),
        ('Jarred pasta sauce', ShoppingCategory.CANNED_GOODS, StorageType.ROOM_TEMP),
        ('Pickles', ShoppingCategory.CANNED_GOODS, StorageType.ROOM_TEMP),
        ('Canned tuna', ShoppingCategory.CANNED_GOODS, StorageType.ROOM_TEMP),
        
        # Baking Supplies
        ('All-purpose flour', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        ('White sugar', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        ('Brown sugar', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        ('Baking powder', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        ('Vanilla extract', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        ('Honey', ShoppingCategory.BAKING, StorageType.COOL_DRY),
        
        # Spices & Herbs
        ('Salt', ShoppingCategory.SPICES_HERBS, StorageType.COOL_DRY),
        ('Black pepper', ShoppingCategory.SPICES_HERBS, StorageType.COOL_DRY),
        ('Cinnamon', ShoppingCategory.SPICES_HERBS, StorageType.COOL_DRY),
        ('Paprika', ShoppingCategory.SPICES_HERBS, StorageType.COOL_DRY),
        ('Oregano', ShoppingCategory.SPICES_HERBS, StorageType.COOL_DRY),
        
        # Oils & Vinegars
        ('Olive oil', ShoppingCategory.OILS_VINEGARS, StorageType.COOL_DRY),
        ('Vegetable oil', ShoppingCategory.OILS_VINEGARS, StorageType.COOL_DRY),
        ('Balsamic vinegar', ShoppingCategory.OILS_VINEGARS, StorageType.COOL_DRY),
        ('Apple cider vinegar', ShoppingCategory.OILS_VINEGARS, StorageType.COOL_DRY),
        
        # Pasta & Grains
        ('Spaghetti', ShoppingCategory.PASTA_GRAINS, StorageType.COOL_DRY),
        ('Penne pasta', ShoppingCategory.PASTA_GRAINS, StorageType.COOL_DRY),
        ('Rice', ShoppingCategory.PASTA_GRAINS, StorageType.COOL_DRY),
        ('Whole wheat pasta', ShoppingCategory.PASTA_GRAINS, StorageType.COOL_DRY),
        
        # Bakery
        ('Bread', ShoppingCategory.BAKERY, StorageType.ROOM_TEMP),
        ('Hamburger buns', ShoppingCategory.BAKERY, StorageType.ROOM_TEMP),
        ('Bagels', ShoppingCategory.BAKERY, StorageType.ROOM_TEMP),
        ('Croissants', ShoppingCategory.BAKERY, StorageType.ROOM_TEMP),
        
        # Beverages
        ('Coffee', ShoppingCategory.BEVERAGES, StorageType.ROOM_TEMP),
        ('Orange juice', ShoppingCategory.BEVERAGES, StorageType.ROOM_TEMP),
        ('Water', ShoppingCategory.BEVERAGES, StorageType.ROOM_TEMP),
        ('Wine', ShoppingCategory.BEVERAGES, StorageType.ROOM_TEMP),
        
        # Condiments
        ('Ketchup', ShoppingCategory.CONDIMENTS, StorageType.ROOM_TEMP),
        ('Mustard', ShoppingCategory.CONDIMENTS, StorageType.ROOM_TEMP),
        ('Mayonnaise', ShoppingCategory.CONDIMENTS, StorageType.ROOM_TEMP),
        ('Soy sauce', ShoppingCategory.CONDIMENTS, StorageType.ROOM_TEMP),
    ]
    
    print("Testing categorization accuracy...")
    print("=" * 60)
    
    total_tests = len(test_cases)
    correct_category = 0
    correct_storage = 0
    
    failed_tests = []
    
    for ingredient, expected_category, expected_storage in test_cases:
        result = categorizer.categorize_ingredient(ingredient)
        
        category_correct = result.category == expected_category
        storage_correct = result.storage_type == expected_storage
        
        if category_correct:
            correct_category += 1
        if storage_correct:
            correct_storage += 1
            
        if not (category_correct and storage_correct):
            failed_tests.append({
                'ingredient': ingredient,
                'expected_category': expected_category,
                'actual_category': result.category,
                'expected_storage': expected_storage,
                'actual_storage': result.storage_type,
                'category_correct': category_correct,
                'storage_correct': storage_correct
            })
        
        # Print status
        status = "✓" if category_correct and storage_correct else "✗"
        print(f"{status} {ingredient:<25} → {result.category.value:<20} ({result.storage_type.value})")
    
    print("\n" + "=" * 60)
    print(f"Category Accuracy: {correct_category}/{total_tests} ({correct_category/total_tests*100:.1f}%)")
    print(f"Storage Accuracy:  {correct_storage}/{total_tests} ({correct_storage/total_tests*100:.1f}%)")
    print(f"Combined Accuracy: {len([t for t in failed_tests if not (t['category_correct'] and t['storage_correct']) == 0])}/{total_tests} ({(total_tests-len(failed_tests))/total_tests*100:.1f}%)")
    
    if failed_tests:
        print("\nFailed Tests:")
        print("-" * 60)
        for test in failed_tests:
            print(f"Ingredient: {test['ingredient']}")
            if not test['category_correct']:
                print(f"  Category: Expected {test['expected_category'].value}, got {test['actual_category'].value}")
            if not test['storage_correct']:
                print(f"  Storage: Expected {test['expected_storage'].value}, got {test['actual_storage'].value}")
            print()
    
    return correct_category, correct_storage, total_tests

def test_performance():
    """Test categorization performance."""
    print("Testing categorization performance...")
    print("=" * 60)
    
    categorizer = IngredientCategorizer()
    
    # Test ingredients
    test_ingredients = [
        'Fresh tomatoes', 'Milk', 'Chicken breast', 'Olive oil', 'Flour',
        'Canned beans', 'Frozen peas', 'Bread', 'Salt', 'Pasta'
    ] * 100  # 1000 total tests
    
    start_time = time.time()
    
    for ingredient in test_ingredients:
        result = categorizer.categorize_ingredient(ingredient)
    
    end_time = time.time()
    
    total_time = end_time - start_time
    avg_time_ms = (total_time / len(test_ingredients)) * 1000
    
    print(f"Categorized {len(test_ingredients)} ingredients in {total_time:.3f} seconds")
    print(f"Average time per ingredient: {avg_time_ms:.3f} ms")
    print(f"Throughput: {len(test_ingredients)/total_time:.0f} ingredients/second")
    
    return total_time, avg_time_ms

def test_subcategory_detection():
    """Test subcategory detection accuracy."""
    print("Testing subcategory detection...")
    print("=" * 60)
    
    categorizer = IngredientCategorizer()
    
    test_cases = [
        ('Organic tomatoes', 'organic'),
        ('Organic spinach', 'organic'),
        ('Gluten-free bread', 'gluten_free'),
        ('Gluten free pasta', 'gluten_free'),
        ('Vegan cheese', 'vegan'),
        ('Plant-based milk', 'vegan'),
        ('Low-fat yogurt', 'low_fat'),
        ('Lite cream cheese', 'low_fat'),
        ('Sugar-free cookies', 'sugar_free'),
        ('No sugar added juice', 'sugar_free'),
        ('Whole grain bread', 'whole_grain'),
        ('Whole wheat pasta', 'whole_grain'),
        ('Local honey', 'local'),
        ('Locally grown apples', 'local'),
        ('Regular milk', None),  # Should have no subcategory
        ('Plain chicken', None),  # Should have no subcategory
    ]
    
    correct = 0
    total = len(test_cases)
    
    for ingredient, expected_subcat in test_cases:
        result = categorizer.categorize_ingredient(ingredient)
        actual_subcat = result.subcategory
        
        if actual_subcat == expected_subcat:
            correct += 1
            status = "✓"
        else:
            status = "✗"
            
        print(f"{status} {ingredient:<25} → {actual_subcat or 'None':<15} (expected: {expected_subcat or 'None'})")
    
    print(f"\nSubcategory Accuracy: {correct}/{total} ({correct/total*100:.1f}%)")
    
    return correct, total

if __name__ == '__main__':
    print("INGREDIENT CATEGORIZATION ACCURACY TEST")
    print("=" * 80)
    
    # Test basic accuracy
    cat_correct, stor_correct, total = test_categorization_accuracy()
    
    print("\n")
    
    # Test performance
    total_time, avg_time = test_performance()
    
    print("\n")
    
    # Test subcategory detection
    sub_correct, sub_total = test_subcategory_detection()
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Category Accuracy:    {cat_correct}/{total} ({cat_correct/total*100:.1f}%)")
    print(f"Storage Accuracy:     {stor_correct}/{total} ({stor_correct/total*100:.1f}%)")
    print(f"Subcategory Accuracy: {sub_correct}/{sub_total} ({sub_correct/sub_total*100:.1f}%)")
    print(f"Performance:          {avg_time:.3f} ms per ingredient")
    print(f"Overall Grade:        {'A' if cat_correct/total >= 0.9 else 'B' if cat_correct/total >= 0.8 else 'C' if cat_correct/total >= 0.7 else 'D' if cat_correct/total >= 0.6 else 'F'}")