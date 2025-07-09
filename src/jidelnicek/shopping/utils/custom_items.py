"""
Custom items management for shopping lists.

This module handles non-food items like utensils, napkins, cleaning supplies,
and other trip necessities that need to be included in shopping lists.
"""

from typing import Dict, List, Optional, Set
from decimal import Decimal
from dataclasses import dataclass, field
from uuid import UUID, uuid4
from enum import Enum
import json
import logging


logger = logging.getLogger(__name__)


class CustomItemCategory(Enum):
    """Categories for custom items."""
    UTENSILS = "Utensils & Cookware"
    PAPER_PRODUCTS = "Paper Products"
    CLEANING = "Cleaning Supplies"
    PERSONAL_CARE = "Personal Care"
    FIRST_AID = "First Aid & Medicine"
    OUTDOOR = "Outdoor & Camping"
    ENTERTAINMENT = "Entertainment"
    OFFICE = "Office Supplies"
    HOUSEHOLD = "Household Items"
    BEVERAGES_NON_FOOD = "Non-Food Beverages"
    PET_SUPPLIES = "Pet Supplies"
    BABY_SUPPLIES = "Baby Supplies"
    OTHER = "Other Items"


@dataclass
class CustomItem:
    """Represents a custom non-food item."""
    id: UUID
    name: str
    category: CustomItemCategory
    quantity: Decimal
    unit: str
    notes: Optional[str] = None
    reusable: bool = False
    priority: str = "normal"  # low, normal, high
    tags: Set[str] = field(default_factory=set)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            'id': str(self.id),
            'name': self.name,
            'category': self.category.value,
            'quantity': str(self.quantity),
            'unit': self.unit,
            'notes': self.notes,
            'reusable': self.reusable,
            'priority': self.priority,
            'tags': list(self.tags)
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'CustomItem':
        """Create from dictionary."""
        return cls(
            id=UUID(data['id']),
            name=data['name'],
            category=CustomItemCategory(data['category']),
            quantity=Decimal(data['quantity']),
            unit=data['unit'],
            notes=data.get('notes'),
            reusable=data.get('reusable', False),
            priority=data.get('priority', 'normal'),
            tags=set(data.get('tags', []))
        )


class CustomItemsManager:
    """
    Manager for custom shopping list items.
    
    Provides functionality to add, remove, categorize, and manage
    non-food items that need to be included in shopping lists.
    """
    
    # Common custom items templates
    COMMON_ITEMS = {
        # Utensils & Cookware
        'paper_plates': {
            'name': 'Paper plates',
            'category': CustomItemCategory.UTENSILS,
            'unit': 'pack',
            'quantity': Decimal('1'),
            'tags': {'disposable', 'dining'}
        },
        'plastic_cups': {
            'name': 'Plastic cups',
            'category': CustomItemCategory.UTENSILS,
            'unit': 'pack',
            'quantity': Decimal('1'),
            'tags': {'disposable', 'dining'}
        },
        'plastic_utensils': {
            'name': 'Plastic utensils set',
            'category': CustomItemCategory.UTENSILS,
            'unit': 'pack',
            'quantity': Decimal('1'),
            'tags': {'disposable', 'dining'}
        },
        'aluminum_foil': {
            'name': 'Aluminum foil',
            'category': CustomItemCategory.UTENSILS,
            'unit': 'roll',
            'quantity': Decimal('1'),
            'tags': {'cooking', 'wrapping'}
        },
        
        # Paper Products
        'paper_towels': {
            'name': 'Paper towels',
            'category': CustomItemCategory.PAPER_PRODUCTS,
            'unit': 'rolls',
            'quantity': Decimal('2'),
            'tags': {'cleaning', 'kitchen'}
        },
        'napkins': {
            'name': 'Napkins',
            'category': CustomItemCategory.PAPER_PRODUCTS,
            'unit': 'pack',
            'quantity': Decimal('1'),
            'tags': {'dining'}
        },
        'toilet_paper': {
            'name': 'Toilet paper',
            'category': CustomItemCategory.PAPER_PRODUCTS,
            'unit': 'rolls',
            'quantity': Decimal('4'),
            'tags': {'bathroom', 'essential'}
        },
        
        # Cleaning Supplies
        'dish_soap': {
            'name': 'Dish soap',
            'category': CustomItemCategory.CLEANING,
            'unit': 'bottle',
            'quantity': Decimal('1'),
            'tags': {'kitchen', 'cleaning'}
        },
        'sponges': {
            'name': 'Kitchen sponges',
            'category': CustomItemCategory.CLEANING,
            'unit': 'pack',
            'quantity': Decimal('1'),
            'tags': {'kitchen', 'cleaning'}
        },
        'trash_bags': {
            'name': 'Trash bags',
            'category': CustomItemCategory.CLEANING,
            'unit': 'roll',
            'quantity': Decimal('1'),
            'tags': {'cleaning', 'essential'}
        },
        'hand_sanitizer': {
            'name': 'Hand sanitizer',
            'category': CustomItemCategory.CLEANING,
            'unit': 'bottle',
            'quantity': Decimal('1'),
            'tags': {'hygiene', 'health'}
        },
        
        # Outdoor & Camping
        'charcoal': {
            'name': 'Charcoal',
            'category': CustomItemCategory.OUTDOOR,
            'unit': 'bag',
            'quantity': Decimal('1'),
            'tags': {'grilling', 'outdoor'}
        },
        'lighter_fluid': {
            'name': 'Lighter fluid',
            'category': CustomItemCategory.OUTDOOR,
            'unit': 'bottle',
            'quantity': Decimal('1'),
            'tags': {'grilling', 'outdoor'}
        },
        'ice': {
            'name': 'Ice bags',
            'category': CustomItemCategory.OUTDOOR,
            'unit': 'bags',
            'quantity': Decimal('2'),
            'tags': {'cooling', 'beverages'}
        },
        'cooler': {
            'name': 'Cooler',
            'category': CustomItemCategory.OUTDOOR,
            'unit': 'unit',
            'quantity': Decimal('1'),
            'tags': {'storage', 'cooling'},
            'reusable': True
        },
        
        # First Aid
        'bandaids': {
            'name': 'Band-aids',
            'category': CustomItemCategory.FIRST_AID,
            'unit': 'box',
            'quantity': Decimal('1'),
            'tags': {'health', 'safety'}
        },
        'sunscreen': {
            'name': 'Sunscreen',
            'category': CustomItemCategory.FIRST_AID,
            'unit': 'bottle',
            'quantity': Decimal('1'),
            'tags': {'health', 'outdoor'}
        },
        'insect_repellent': {
            'name': 'Insect repellent',
            'category': CustomItemCategory.FIRST_AID,
            'unit': 'bottle',
            'quantity': Decimal('1'),
            'tags': {'health', 'outdoor'}
        }
    }
    
    def __init__(self):
        """Initialize the custom items manager."""
        self._items: Dict[UUID, CustomItem] = {}
        self._templates = self.COMMON_ITEMS.copy()
        
    def add_item(
        self,
        name: str,
        quantity: Decimal,
        unit: str,
        category: Optional[CustomItemCategory] = None,
        notes: Optional[str] = None,
        reusable: bool = False,
        priority: str = "normal",
        tags: Optional[Set[str]] = None
    ) -> CustomItem:
        """
        Add a custom item to the manager.
        
        Args:
            name: Item name
            quantity: Quantity needed
            unit: Unit of measurement
            category: Item category (defaults to OTHER)
            notes: Optional notes
            reusable: Whether item is reusable
            priority: Priority level (low, normal, high)
            tags: Optional tags for organization
            
        Returns:
            The created CustomItem
        """
        item = CustomItem(
            id=uuid4(),
            name=name,
            category=category or CustomItemCategory.OTHER,
            quantity=quantity,
            unit=unit,
            notes=notes,
            reusable=reusable,
            priority=priority,
            tags=tags or set()
        )
        
        self._items[item.id] = item
        logger.info(f"Added custom item: {name} ({quantity} {unit})")
        
        return item
        
    def add_from_template(
        self,
        template_key: str,
        quantity_override: Optional[Decimal] = None,
        notes: Optional[str] = None
    ) -> Optional[CustomItem]:
        """
        Add an item from a common template.
        
        Args:
            template_key: Key from COMMON_ITEMS
            quantity_override: Override default quantity
            notes: Additional notes
            
        Returns:
            Created item or None if template not found
        """
        if template_key not in self._templates:
            logger.warning(f"Template '{template_key}' not found")
            return None
            
        template = self._templates[template_key]
        
        return self.add_item(
            name=template['name'],
            quantity=quantity_override or template['quantity'],
            unit=template['unit'],
            category=template['category'],
            notes=notes,
            reusable=template.get('reusable', False),
            priority=template.get('priority', 'normal'),
            tags=template.get('tags', set())
        )
        
    def remove_item(self, item_id: UUID) -> bool:
        """
        Remove an item by ID.
        
        Returns:
            True if removed, False if not found
        """
        if item_id in self._items:
            del self._items[item_id]
            return True
        return False
        
    def get_items(
        self,
        category: Optional[CustomItemCategory] = None,
        priority: Optional[str] = None,
        tags: Optional[Set[str]] = None
    ) -> List[CustomItem]:
        """
        Get items with optional filtering.
        
        Args:
            category: Filter by category
            priority: Filter by priority
            tags: Filter by tags (items must have all specified tags)
            
        Returns:
            List of matching items
        """
        items = list(self._items.values())
        
        if category:
            items = [i for i in items if i.category == category]
            
        if priority:
            items = [i for i in items if i.priority == priority]
            
        if tags:
            items = [i for i in items if tags.issubset(i.tags)]
            
        return items
        
    def get_items_by_category(self) -> Dict[CustomItemCategory, List[CustomItem]]:
        """
        Get all items grouped by category.
        
        Returns:
            Dictionary mapping categories to item lists
        """
        categorized = {}
        
        for item in self._items.values():
            if item.category not in categorized:
                categorized[item.category] = []
            categorized[item.category].append(item)
            
        return categorized
        
    def suggest_items_for_trip(
        self,
        trip_type: str,
        duration_days: int,
        participant_count: int,
        has_kitchen: bool = True
    ) -> List[Dict[str, any]]:
        """
        Suggest custom items based on trip parameters.
        
        Args:
            trip_type: Type of trip (camping, beach, picnic, etc.)
            duration_days: Trip duration
            participant_count: Number of participants
            has_kitchen: Whether accommodation has kitchen facilities
            
        Returns:
            List of suggested items with quantities
        """
        suggestions = []
        
        # Base suggestions for all trips
        base_items = [
            ('paper_towels', duration_days),
            ('napkins', participant_count // 4 + 1),  # 1 pack per 4 people
            ('trash_bags', duration_days // 2 + 1),
            ('hand_sanitizer', 1),
        ]
        
        # Add based on trip type
        if trip_type.lower() in ['camping', 'outdoor']:
            base_items.extend([
                ('charcoal', duration_days // 2 + 1),
                ('lighter_fluid', 1),
                ('ice', duration_days * 2),
                ('insect_repellent', 1),
                ('sunscreen', 1),
                ('cooler', participant_count // 6 + 1),  # 1 cooler per 6 people
            ])
            
        if trip_type.lower() in ['beach', 'pool']:
            base_items.extend([
                ('sunscreen', participant_count // 4 + 1),
                ('ice', duration_days * 3),  # More ice for beach
            ])
            
        if not has_kitchen:
            base_items.extend([
                ('paper_plates', participant_count * duration_days // 20 + 1),
                ('plastic_cups', participant_count * duration_days // 20 + 1),
                ('plastic_utensils', participant_count * duration_days // 24 + 1),
            ])
            
        # Basic hygiene for longer trips
        if duration_days > 2:
            base_items.extend([
                ('toilet_paper', duration_days * participant_count // 4 + 1),
                ('dish_soap', 1),
                ('sponges', 1),
            ])
            
        # Convert to suggestions
        for template_key, quantity in base_items:
            if template_key in self._templates:
                template = self._templates[template_key]
                suggestions.append({
                    'template_key': template_key,
                    'name': template['name'],
                    'quantity': Decimal(str(quantity)),
                    'unit': template['unit'],
                    'category': template['category'].value,
                    'reason': f"Recommended for {trip_type} trip"
                })
                
        return suggestions
        
    def clear(self):
        """Clear all custom items."""
        self._items.clear()
        
    def export_items(self) -> str:
        """
        Export items as JSON string.
        
        Returns:
            JSON string of all items
        """
        items_data = [item.to_dict() for item in self._items.values()]
        return json.dumps(items_data, indent=2)
        
    def import_items(self, json_data: str):
        """
        Import items from JSON string.
        
        Args:
            json_data: JSON string of items
        """
        items_data = json.loads(json_data)
        for item_data in items_data:
            item = CustomItem.from_dict(item_data)
            self._items[item.id] = item
            
    def get_template_categories(self) -> Dict[CustomItemCategory, List[str]]:
        """
        Get available templates organized by category.
        
        Returns:
            Dictionary mapping categories to template keys
        """
        categories = {}
        
        for key, template in self._templates.items():
            category = template['category']
            if category not in categories:
                categories[category] = []
            categories[category].append(key)
            
        return categories