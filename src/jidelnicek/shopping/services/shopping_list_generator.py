"""
Shopping list generator service.

This module combines ingredient aggregation, rounding, and categorization
to generate organized shopping lists in various formats.
"""

from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from decimal import Decimal
from dataclasses import dataclass, field
from uuid import UUID
import logging

from jidelnicek.shopping.utils import (
    IngredientAggregator,
    ShoppingRounder,
    IngredientCategorizer,
    ShoppingCategory,
    StorageType
)


logger = logging.getLogger(__name__)


class ListFormat(Enum):
    """Shopping list format options."""
    BY_CATEGORY = "by_category"
    BY_AISLE = "by_aisle"
    BY_STORAGE = "by_storage"
    ALPHABETICAL = "alphabetical"
    COMPACT = "compact"


@dataclass
class ShoppingListItem:
    """Single item in a shopping list."""
    ingredient_id: UUID
    name: str
    quantity: Decimal
    rounded_quantity: Decimal
    unit: str
    display_text: str
    category: ShoppingCategory
    storage_type: StorageType
    aisle_number: Optional[int] = None
    package_suggestion: Optional[str] = None
    subcategory: Optional[str] = None
    sources: List[Dict[str, Any]] = field(default_factory=list)
    checked: bool = False


@dataclass
class ShoppingListSection:
    """A section of the shopping list (e.g., a category)."""
    title: str
    items: List[ShoppingListItem]
    section_type: str  # 'category', 'aisle', 'storage', etc.
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ShoppingList:
    """Complete shopping list with sections and metadata."""
    sections: List[ShoppingListSection]
    format: ListFormat
    total_items: int
    total_weight_g: float
    total_volume_ml: float
    storage_summary: Dict[StorageType, int]
    metadata: Dict[str, Any] = field(default_factory=dict)


class ShoppingListGenerator:
    """
    Service for generating organized shopping lists from aggregated ingredients.
    
    Combines the aggregator, rounder, and categorizer to create
    formatted shopping lists suitable for different purposes.
    """
    
    def __init__(
        self,
        prefer_package_sizes: bool = True,
        custom_categories: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the shopping list generator.
        
        Args:
            prefer_package_sizes: Whether to include package suggestions
            custom_categories: Custom category mappings
        """
        self.aggregator = IngredientAggregator()
        self.rounder = ShoppingRounder(prefer_package_sizes=prefer_package_sizes)
        self.categorizer = IngredientCategorizer(custom_mappings=custom_categories)
        
    def add_recipes(
        self,
        recipes: List[Dict[str, Any]]
    ) -> None:
        """
        Add recipes to the shopping list.
        
        Args:
            recipes: List of recipe dicts with:
                - recipe_id: UUID
                - recipe_name: str
                - meal_name: str
                - day_number: int
                - ingredients: List[Dict] with ingredient data
        """
        for recipe in recipes:
            self.aggregator.add_recipe_ingredients(
                recipe_id=recipe['recipe_id'],
                recipe_name=recipe['recipe_name'],
                meal_name=recipe['meal_name'],
                day_number=recipe['day_number'],
                ingredients=recipe['ingredients']
            )
            
    def generate_list(
        self,
        format: ListFormat = ListFormat.BY_CATEGORY,
        include_sources: bool = True,
        custom_items: Optional[List[Dict[str, Any]]] = None
    ) -> ShoppingList:
        """
        Generate a formatted shopping list.
        
        Args:
            format: How to organize the list
            include_sources: Whether to include recipe sources
            custom_items: Additional non-food items to include
            
        Returns:
            ShoppingList with organized sections
        """
        # Get aggregated ingredients
        aggregated = self.aggregator.get_aggregated_ingredients()
        
        # Process each ingredient
        items = []
        for agg_ingredient in aggregated:
            # Categorize
            category_info = self.categorizer.categorize_ingredient(
                agg_ingredient.name
            )
            
            # Round quantity
            rounded_qty, package_suggestion = self.rounder.round_quantity(
                agg_ingredient.total_quantity,
                agg_ingredient.unit,
                agg_ingredient.name
            )
            
            # Format display text
            display_text = self.rounder.round_for_display(
                rounded_qty,
                agg_ingredient.unit
            )
            
            # Create shopping list item
            item = ShoppingListItem(
                ingredient_id=agg_ingredient.ingredient_id,
                name=agg_ingredient.name,
                quantity=agg_ingredient.total_quantity,
                rounded_quantity=rounded_qty,
                unit=agg_ingredient.unit,
                display_text=display_text,
                category=category_info.category,
                storage_type=category_info.storage_type,
                aisle_number=category_info.aisle_number,
                package_suggestion=package_suggestion,
                subcategory=category_info.subcategory,
                sources=[{
                    'recipe': s.recipe_name,
                    'meal': s.meal_name,
                    'day': s.day_number,
                    'quantity': float(s.quantity)
                } for s in agg_ingredient.sources] if include_sources else []
            )
            items.append(item)
            
        # Add custom items if provided
        if custom_items:
            for custom in custom_items:
                # Simple custom item without aggregation
                item = ShoppingListItem(
                    ingredient_id=custom.get('id', UUID('00000000-0000-0000-0000-000000000000')),
                    name=custom['name'],
                    quantity=Decimal(str(custom.get('quantity', 1))),
                    rounded_quantity=Decimal(str(custom.get('quantity', 1))),
                    unit=custom.get('unit', 'unit'),
                    display_text=f"{custom.get('quantity', 1)} {custom.get('unit', 'unit')}",
                    category=ShoppingCategory.OTHER,
                    storage_type=StorageType.ROOM_TEMP,
                    subcategory='custom'
                )
                items.append(item)
                
        # Organize into sections based on format
        sections = self._organize_sections(items, format)
        
        # Calculate metadata
        total_weight_g = sum(
            float(item.rounded_quantity) 
            for item in items 
            if item.unit == 'g'
        )
        total_volume_ml = sum(
            float(item.rounded_quantity) 
            for item in items 
            if item.unit == 'ml'
        )
        
        # Storage summary
        storage_summary = {}
        for item in items:
            if item.storage_type not in storage_summary:
                storage_summary[item.storage_type] = 0
            storage_summary[item.storage_type] += 1
            
        # Create shopping list
        return ShoppingList(
            sections=sections,
            format=format,
            total_items=len(items),
            total_weight_g=total_weight_g,
            total_volume_ml=total_volume_ml,
            storage_summary=storage_summary,
            metadata={
                'aggregator_stats': self.aggregator.get_summary_stats()
            }
        )
        
    def _organize_sections(
        self,
        items: List[ShoppingListItem],
        format: ListFormat
    ) -> List[ShoppingListSection]:
        """Organize items into sections based on format."""
        if format == ListFormat.BY_CATEGORY:
            return self._organize_by_category(items)
        elif format == ListFormat.BY_AISLE:
            return self._organize_by_aisle(items)
        elif format == ListFormat.BY_STORAGE:
            return self._organize_by_storage(items)
        elif format == ListFormat.ALPHABETICAL:
            return self._organize_alphabetical(items)
        elif format == ListFormat.COMPACT:
            return self._organize_compact(items)
        else:
            # Default to by category
            return self._organize_by_category(items)
            
    def _organize_by_category(
        self,
        items: List[ShoppingListItem]
    ) -> List[ShoppingListSection]:
        """Organize items by shopping category."""
        # Group by category
        categories = {}
        for item in items:
            if item.category not in categories:
                categories[item.category] = []
            categories[item.category].append(item)
            
        # Create sections
        sections = []
        for category in sorted(categories.keys(), key=lambda c: c.value):
            section_items = sorted(categories[category], key=lambda i: i.name.lower())
            sections.append(ShoppingListSection(
                title=category.value,
                items=section_items,
                section_type='category',
                metadata={'category': category}
            ))
            
        return sections
        
    def _organize_by_aisle(
        self,
        items: List[ShoppingListItem]
    ) -> List[ShoppingListSection]:
        """Organize items by store aisle."""
        # Group by aisle number
        aisles = {}
        for item in items:
            aisle = item.aisle_number or 99
            if aisle not in aisles:
                aisles[aisle] = []
            aisles[aisle].append(item)
            
        # Create sections
        sections = []
        for aisle in sorted(aisles.keys()):
            section_items = sorted(aisles[aisle], key=lambda i: i.name.lower())
            
            # Get aisle name from first item's category
            aisle_name = f"Aisle {aisle}"
            if section_items and aisle != 99:
                aisle_name = f"Aisle {aisle} - {section_items[0].category.value}"
                
            sections.append(ShoppingListSection(
                title=aisle_name,
                items=section_items,
                section_type='aisle',
                metadata={'aisle_number': aisle}
            ))
            
        return sections
        
    def _organize_by_storage(
        self,
        items: List[ShoppingListItem]
    ) -> List[ShoppingListSection]:
        """Organize items by storage type."""
        # Group by storage type
        storage_groups = {}
        for item in items:
            if item.storage_type not in storage_groups:
                storage_groups[item.storage_type] = []
            storage_groups[item.storage_type].append(item)
            
        # Create sections in logical order
        storage_order = [
            StorageType.FROZEN,
            StorageType.REFRIGERATED,
            StorageType.PRODUCE,
            StorageType.COOL_DRY,
            StorageType.ROOM_TEMP
        ]
        
        sections = []
        for storage_type in storage_order:
            if storage_type in storage_groups:
                section_items = sorted(
                    storage_groups[storage_type], 
                    key=lambda i: i.name.lower()
                )
                sections.append(ShoppingListSection(
                    title=storage_type.value.replace('_', ' ').title(),
                    items=section_items,
                    section_type='storage',
                    metadata={'storage_type': storage_type}
                ))
                
        return sections
        
    def _organize_alphabetical(
        self,
        items: List[ShoppingListItem]
    ) -> List[ShoppingListSection]:
        """Organize items alphabetically."""
        # Sort all items alphabetically
        sorted_items = sorted(items, key=lambda i: i.name.lower())
        
        # Group by first letter
        sections = []
        current_letter = None
        current_items = []
        
        for item in sorted_items:
            first_letter = item.name[0].upper()
            if first_letter != current_letter:
                if current_items:
                    sections.append(ShoppingListSection(
                        title=current_letter,
                        items=current_items,
                        section_type='alphabetical',
                        metadata={'letter': current_letter}
                    ))
                current_letter = first_letter
                current_items = [item]
            else:
                current_items.append(item)
                
        # Add last section
        if current_items:
            sections.append(ShoppingListSection(
                title=current_letter,
                items=current_items,
                section_type='alphabetical',
                metadata={'letter': current_letter}
            ))
            
        return sections
        
    def _organize_compact(
        self,
        items: List[ShoppingListItem]
    ) -> List[ShoppingListSection]:
        """Create a single compact list."""
        # Sort by category then name for some organization
        sorted_items = sorted(
            items,
            key=lambda i: (i.category.value, i.name.lower())
        )
        
        return [ShoppingListSection(
            title="Shopping List",
            items=sorted_items,
            section_type='compact',
            metadata={'format': 'compact'}
        )]
        
    def clear(self) -> None:
        """Clear all aggregated data."""
        self.aggregator.clear()
        
    def format_as_text(
        self,
        shopping_list: ShoppingList,
        include_checkboxes: bool = True,
        include_package_suggestions: bool = True
    ) -> str:
        """
        Format shopping list as plain text.
        
        Args:
            shopping_list: The shopping list to format
            include_checkboxes: Whether to include [ ] checkboxes
            include_package_suggestions: Whether to include package suggestions
            
        Returns:
            Formatted text string
        """
        lines = []
        
        # Header
        lines.append("SHOPPING LIST")
        lines.append("=" * 50)
        lines.append(f"Total Items: {shopping_list.total_items}")
        if shopping_list.total_weight_g > 0:
            lines.append(f"Total Weight: {shopping_list.total_weight_g/1000:.1f} kg")
        if shopping_list.total_volume_ml > 0:
            lines.append(f"Total Volume: {shopping_list.total_volume_ml/1000:.1f} L")
        lines.append("")
        
        # Sections
        for section in shopping_list.sections:
            # Section header
            lines.append(f"\n{section.title}")
            lines.append("-" * len(section.title))
            
            # Items
            for item in section.items:
                checkbox = "[ ] " if include_checkboxes else ""
                line = f"{checkbox}{item.name} - {item.display_text}"
                
                if include_package_suggestions and item.package_suggestion:
                    line += f" ({item.package_suggestion})"
                    
                lines.append(line)
                
        # Footer
        lines.append("\n" + "=" * 50)
        
        # Storage summary
        if shopping_list.storage_summary:
            lines.append("\nStorage Requirements:")
            for storage_type, count in shopping_list.storage_summary.items():
                lines.append(f"  {storage_type.value}: {count} items")
                
        return "\n".join(lines)