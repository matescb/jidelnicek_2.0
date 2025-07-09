"""
Ingredient categorization service for shopping list organization.

This module provides automatic categorization of ingredients by type,
storage requirements, and shopping aisle mapping.
"""

from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass
from enum import Enum
import re
import logging


logger = logging.getLogger(__name__)


class StorageType(Enum):
    """Storage temperature requirements."""
    REFRIGERATED = "refrigerated"
    FROZEN = "frozen"
    ROOM_TEMP = "room_temp"
    COOL_DRY = "cool_dry"
    PRODUCE = "produce"  # Can be room temp or refrigerated


class ShoppingCategory(Enum):
    """Main shopping categories."""
    PRODUCE = "Produce"
    DAIRY = "Dairy & Eggs"
    MEAT_SEAFOOD = "Meat & Seafood"
    BAKERY = "Bakery"
    PANTRY = "Pantry & Dry Goods"
    CANNED_GOODS = "Canned & Jarred Goods"
    FROZEN = "Frozen Foods"
    BEVERAGES = "Beverages"
    CONDIMENTS = "Condiments & Sauces"
    SNACKS = "Snacks"
    BAKING = "Baking Supplies"
    SPICES_HERBS = "Spices & Herbs"
    OILS_VINEGARS = "Oils & Vinegars"
    PASTA_GRAINS = "Pasta & Grains"
    BREAKFAST = "Breakfast & Cereal"
    INTERNATIONAL = "International Foods"
    HEALTH_ORGANIC = "Health & Organic"
    HOUSEHOLD = "Household & Cleaning"
    OTHER = "Other"


@dataclass
class CategoryInfo:
    """Information about an ingredient category."""
    category: ShoppingCategory
    storage_type: StorageType
    aisle_number: Optional[int] = None
    subcategory: Optional[str] = None


class IngredientCategorizer:
    """
    Service for categorizing ingredients based on name and type.
    
    Uses pattern matching and keyword detection to automatically
    categorize ingredients for organized shopping lists.
    """
    
    # Keyword mappings for categories
    CATEGORY_KEYWORDS = {
        ShoppingCategory.PRODUCE: {
            'keywords': [
                # Vegetables
                'lettuce', 'tomato', 'cucumber', 'carrot', 'onion', 'garlic',
                'potato', 'pepper', 'broccoli', 'cauliflower', 'spinach', 'kale',
                'cabbage', 'celery', 'mushroom', 'corn', 'bean', 'pea', 'squash',
                'zucchini', 'eggplant', 'asparagus', 'radish', 'beet', 'turnip',
                'leek', 'scallion', 'shallot', 'ginger', 'herb', 'cilantro',
                'parsley', 'basil', 'mint', 'dill', 'thyme', 'rosemary', 'sage',
                # Fruits
                'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit',
                'strawberry', 'blueberry', 'raspberry', 'blackberry', 'grape',
                'melon', 'watermelon', 'cantaloupe', 'pineapple', 'mango',
                'peach', 'plum', 'pear', 'apricot', 'cherry', 'kiwi',
                'avocado', 'pomegranate', 'fig', 'date'
            ],
            'storage': StorageType.PRODUCE,
            'aisle': 1
        },
        ShoppingCategory.DAIRY: {
            'keywords': [
                'milk', 'cream', 'yogurt', 'cheese', 'butter', 'margarine',
                'sour cream', 'cottage cheese', 'ricotta', 'mozzarella',
                'cheddar', 'parmesan', 'feta', 'egg', 'half and half',
                'whipping cream', 'buttermilk', 'kefir', 'dairy'
            ],
            'storage': StorageType.REFRIGERATED,
            'aisle': 2
        },
        ShoppingCategory.MEAT_SEAFOOD: {
            'keywords': [
                'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'veal',
                'bacon', 'sausage', 'ham', 'salami', 'prosciutto', 'ground',
                'steak', 'chop', 'roast', 'rib', 'tenderloin', 'sirloin',
                'fish', 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'trout',
                'shrimp', 'crab', 'lobster', 'scallop', 'oyster', 'clam',
                'seafood', 'meat', 'poultry'
            ],
            'storage': StorageType.REFRIGERATED,
            'aisle': 3
        },
        ShoppingCategory.BAKERY: {
            'keywords': [
                'bread', 'roll', 'bun', 'bagel', 'croissant', 'muffin',
                'donut', 'pastry', 'cake', 'pie', 'tart', 'cookie',
                'baguette', 'sourdough', 'rye', 'whole wheat', 'white bread',
                'tortilla', 'pita', 'naan', 'flatbread'
            ],
            'storage': StorageType.ROOM_TEMP,
            'aisle': 4
        },
        ShoppingCategory.PANTRY: {
            'keywords': [
                'rice', 'quinoa', 'couscous', 'barley', 'oat', 'cereal',
                'granola', 'crackers', 'chips', 'pretzel', 'popcorn',
                'nut', 'almond', 'walnut', 'cashew', 'peanut', 'pistachio',
                'dried', 'raisin', 'cranberry', 'apricot', 'trail mix'
            ],
            'storage': StorageType.COOL_DRY,
            'aisle': 5
        },
        ShoppingCategory.CANNED_GOODS: {
            'keywords': [
                'canned', 'can of', 'jar', 'jarred', 'pickled', 'preserved',
                'tomato sauce', 'tomato paste', 'beans', 'corn', 'soup',
                'broth', 'stock', 'tuna', 'salmon', 'sardine', 'olive',
                'pickle', 'jam', 'jelly', 'preserve', 'marmalade'
            ],
            'storage': StorageType.ROOM_TEMP,
            'aisle': 6
        },
        ShoppingCategory.FROZEN: {
            'keywords': [
                'frozen', 'ice cream', 'ice', 'popsicle', 'sorbet',
                'frozen vegetable', 'frozen fruit', 'frozen meal',
                'frozen pizza', 'frozen fries', 'frozen fish'
            ],
            'storage': StorageType.FROZEN,
            'aisle': 7
        },
        ShoppingCategory.BEVERAGES: {
            'keywords': [
                'water', 'juice', 'soda', 'cola', 'soft drink', 'tea',
                'coffee', 'wine', 'beer', 'liquor', 'spirits', 'alcohol',
                'lemonade', 'sports drink', 'energy drink', 'beverage'
            ],
            'storage': StorageType.ROOM_TEMP,
            'aisle': 8
        },
        ShoppingCategory.CONDIMENTS: {
            'keywords': [
                'ketchup', 'mustard', 'mayonnaise', 'mayo', 'sauce',
                'dressing', 'vinaigrette', 'salsa', 'hot sauce', 'bbq sauce',
                'soy sauce', 'teriyaki', 'sriracha', 'relish', 'chutney'
            ],
            'storage': StorageType.ROOM_TEMP,
            'aisle': 9
        },
        ShoppingCategory.BAKING: {
            'keywords': [
                'flour', 'sugar', 'brown sugar', 'powdered sugar', 'honey',
                'maple syrup', 'vanilla', 'extract', 'baking soda',
                'baking powder', 'yeast', 'cocoa', 'chocolate chip',
                'chocolate', 'sprinkle', 'frosting', 'cake mix'
            ],
            'storage': StorageType.COOL_DRY,
            'aisle': 10
        },
        ShoppingCategory.SPICES_HERBS: {
            'keywords': [
                'salt', 'pepper', 'spice', 'seasoning', 'cinnamon', 'nutmeg',
                'paprika', 'cumin', 'coriander', 'turmeric', 'curry',
                'chili powder', 'oregano', 'basil', 'thyme', 'rosemary',
                'sage', 'bay leaf', 'clove', 'cardamom', 'fennel'
            ],
            'storage': StorageType.COOL_DRY,
            'aisle': 11
        },
        ShoppingCategory.OILS_VINEGARS: {
            'keywords': [
                'oil', 'olive oil', 'vegetable oil', 'canola oil', 'coconut oil',
                'vinegar', 'balsamic', 'apple cider vinegar', 'wine vinegar',
                'cooking spray', 'shortening', 'lard'
            ],
            'storage': StorageType.COOL_DRY,
            'aisle': 12
        },
        ShoppingCategory.PASTA_GRAINS: {
            'keywords': [
                'pasta', 'spaghetti', 'penne', 'rigatoni', 'macaroni',
                'lasagna', 'noodle', 'rice', 'quinoa', 'couscous', 'orzo',
                'farro', 'bulgur', 'wheat', 'grain'
            ],
            'storage': StorageType.COOL_DRY,
            'aisle': 13
        }
    }
    
    # Special subcategories
    SUBCATEGORIES = {
        'organic': ['organic', 'bio'],
        'gluten_free': ['gluten free', 'gluten-free', 'gf'],
        'vegan': ['vegan', 'plant based', 'plant-based'],
        'vegetarian': ['vegetarian', 'veggie'],
        'low_fat': ['low fat', 'low-fat', 'lite', 'light'],
        'sugar_free': ['sugar free', 'sugar-free', 'no sugar'],
        'whole_grain': ['whole grain', 'whole wheat', 'whole-grain'],
        'local': ['local', 'locally grown', 'farmers market']
    }
    
    def __init__(self, custom_mappings: Optional[Dict[str, CategoryInfo]] = None):
        """
        Initialize the categorizer.
        
        Args:
            custom_mappings: Optional custom ingredient-to-category mappings
        """
        self.custom_mappings = custom_mappings or {}
        self._compile_patterns()
        
    def _compile_patterns(self):
        """Compile regex patterns for efficient matching."""
        self.category_patterns = {}
        for category, info in self.CATEGORY_KEYWORDS.items():
            # Create pattern that matches any keyword (including plurals)
            keywords = info['keywords']
            # Add both singular and plural forms, and partial matches
            expanded_keywords = []
            for kw in keywords:
                expanded_keywords.append(kw)
                # Add common plural forms
                if not kw.endswith('s'):
                    expanded_keywords.append(kw + 's')
                    expanded_keywords.append(kw + 'es')
            
            # Create pattern that matches any keyword as a substring
            pattern = r'(' + '|'.join(re.escape(kw) for kw in expanded_keywords) + r')'
            self.category_patterns[category] = re.compile(pattern, re.IGNORECASE)
            
        # Compile subcategory patterns
        self.subcategory_patterns = {}
        for subcat, keywords in self.SUBCATEGORIES.items():
            pattern = r'\b(' + '|'.join(re.escape(kw) for kw in keywords) + r')\b'
            self.subcategory_patterns[subcat] = re.compile(pattern, re.IGNORECASE)
    
    def categorize_ingredient(
        self, 
        name: str,
        ingredient_type: Optional[str] = None
    ) -> CategoryInfo:
        """
        Categorize a single ingredient.
        
        Args:
            name: Ingredient name
            ingredient_type: Optional type hint (e.g., 'produce', 'dairy')
            
        Returns:
            CategoryInfo with category, storage type, and aisle
        """
        name_lower = name.lower()
        
        # Check custom mappings first
        if name_lower in self.custom_mappings:
            return self.custom_mappings[name_lower]
            
        # Check for priority keywords first
        # Frozen takes highest priority
        if 'frozen' in name_lower:
            return CategoryInfo(
                category=ShoppingCategory.FROZEN,
                storage_type=StorageType.FROZEN,
                aisle_number=7
            )
        
        # Canned/jarred takes priority over produce
        if any(kw in name_lower for kw in ['canned', 'can of', 'jarred']):
            return CategoryInfo(
                category=ShoppingCategory.CANNED_GOODS,
                storage_type=StorageType.ROOM_TEMP,
                aisle_number=6
            )
            
        # Try to match with category patterns
        best_match = None
        best_score = 0
        
        for category, pattern in self.category_patterns.items():
            matches = pattern.findall(name_lower)
            if matches:
                # Score based on number of matches and match length
                score = len(matches) + sum(len(m) for m in matches)
                if score > best_score:
                    best_score = score
                    best_match = category
                    
        # Determine category info
        if best_match:
            info = self.CATEGORY_KEYWORDS[best_match]
            category_info = CategoryInfo(
                category=best_match,
                storage_type=info['storage'],
                aisle_number=info.get('aisle')
            )
        else:
            # Default to OTHER category
            category_info = CategoryInfo(
                category=ShoppingCategory.OTHER,
                storage_type=StorageType.ROOM_TEMP,
                aisle_number=99
            )
            
        # Check for subcategories
        for subcat, pattern in self.subcategory_patterns.items():
            if pattern.search(name_lower):
                category_info.subcategory = subcat
                break
                
        return category_info
    
    def categorize_ingredients(
        self, 
        ingredients: List[Dict[str, any]]
    ) -> Dict[ShoppingCategory, List[Dict[str, any]]]:
        """
        Categorize a list of ingredients.
        
        Args:
            ingredients: List of ingredient dicts with 'name' key
            
        Returns:
            Dictionary mapping categories to ingredient lists
        """
        categorized = {}
        
        for ingredient in ingredients:
            name = ingredient['name']
            ingredient_type = ingredient.get('type')
            
            category_info = self.categorize_ingredient(name, ingredient_type)
            category = category_info.category
            
            # Add category info to ingredient
            ingredient['category_info'] = category_info
            
            # Group by category
            if category not in categorized:
                categorized[category] = []
            categorized[category].append(ingredient)
            
        return categorized
    
    def get_storage_requirements(
        self, 
        ingredients: List[Dict[str, any]]
    ) -> Dict[StorageType, List[Dict[str, any]]]:
        """
        Group ingredients by storage requirements.
        
        Args:
            ingredients: List of ingredient dicts
            
        Returns:
            Dictionary mapping storage types to ingredient lists
        """
        storage_groups = {}
        
        for ingredient in ingredients:
            name = ingredient['name']
            category_info = self.categorize_ingredient(name)
            storage_type = category_info.storage_type
            
            if storage_type not in storage_groups:
                storage_groups[storage_type] = []
            storage_groups[storage_type].append(ingredient)
            
        return storage_groups
    
    def get_shopping_route(
        self, 
        categories: Set[ShoppingCategory]
    ) -> List[Tuple[int, ShoppingCategory]]:
        """
        Get optimized shopping route based on aisle numbers.
        
        Args:
            categories: Set of categories needed
            
        Returns:
            List of (aisle_number, category) tuples in order
        """
        route = []
        
        for category in categories:
            if category in self.CATEGORY_KEYWORDS:
                info = self.CATEGORY_KEYWORDS[category]
                aisle = info.get('aisle', 99)
            else:
                aisle = 99
                
            route.append((aisle, category))
            
        # Sort by aisle number
        route.sort(key=lambda x: x[0])
        
        return route
    
    def add_custom_category(
        self,
        ingredient_name: str,
        category: ShoppingCategory,
        storage_type: StorageType,
        aisle_number: Optional[int] = None
    ):
        """
        Add a custom categorization for an ingredient.
        
        Args:
            ingredient_name: Name of the ingredient (case-insensitive)
            category: Shopping category
            storage_type: Storage requirement
            aisle_number: Optional aisle number
        """
        self.custom_mappings[ingredient_name.lower()] = CategoryInfo(
            category=category,
            storage_type=storage_type,
            aisle_number=aisle_number
        )