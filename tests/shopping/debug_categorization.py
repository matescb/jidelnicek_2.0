"""
Debug categorization issue.
"""

import sys
sys.path.insert(0, 'src')

from jidelnicek.shopping.utils.categorization import (
    IngredientCategorizer, 
    ShoppingCategory
)


def debug_categorization():
    """Debug the categorization."""
    categorizer = IngredientCategorizer()
    
    ingredient = 'Tomatoes'
    print(f"Testing: {ingredient}")
    
    # Check if pattern is compiled
    produce_pattern = categorizer.category_patterns.get(ShoppingCategory.PRODUCE)
    if produce_pattern:
        print(f"Pattern exists for PRODUCE")
        matches = produce_pattern.findall(ingredient.lower())
        print(f"Matches: {matches}")
    else:
        print("No pattern for PRODUCE!")
    
    # Check keyword list
    produce_info = categorizer.CATEGORY_KEYWORDS.get(ShoppingCategory.PRODUCE)
    if produce_info:
        keywords = produce_info['keywords']
        print(f"\nKeywords ({len(keywords)} total): {keywords[:10]}...")
        print(f"'tomato' in keywords: {'tomato' in keywords}")
    
    # Test the categorization
    result = categorizer.categorize_ingredient(ingredient)
    print(f"\nResult: {result.category} ({result.storage_type})")


if __name__ == '__main__':
    debug_categorization()