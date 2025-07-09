"""
JSON exporter for shopping lists.
"""

import json
from typing import Any, Dict
from datetime import datetime
from decimal import Decimal
from enum import Enum

from .base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


class DecimalEncoder(json.JSONEncoder):
    """Custom encoder to handle Decimal types and Enums."""
    
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, Enum):
            return obj.value
        return super().default(obj)


class JSONExporter(ShoppingListExporter):
    """
    Export shopping lists as JSON files.
    
    Provides structured data format suitable for:
    - API responses
    - Mobile app consumption
    - Data interchange
    - Backup/restore operations
    """
    
    def get_file_extension(self) -> str:
        """Return .json extension."""
        return '.json'
        
    def get_mime_type(self) -> str:
        """Return application/json MIME type."""
        return 'application/json'
        
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to JSON format.
        
        Options:
            pretty: Pretty print with indentation
            include_metadata: Include generation metadata
            flat_items: Flatten items into single array
            
        Returns:
            UTF-8 encoded JSON bytes
        """
        data = self._build_json_structure(shopping_list)
        
        # JSON formatting options
        if self.options.get('pretty', True):
            json_str = json.dumps(data, cls=DecimalEncoder, indent=2, ensure_ascii=False)
        else:
            json_str = json.dumps(data, cls=DecimalEncoder, ensure_ascii=False)
            
        return json_str.encode('utf-8')
        
    def _build_json_structure(self, shopping_list: ShoppingList) -> Dict[str, Any]:
        """Build the JSON data structure."""
        data = {
            'format': shopping_list.format.value,
            'total_items': shopping_list.total_items,
            'total_weight_g': shopping_list.total_weight_g,
            'total_volume_ml': shopping_list.total_volume_ml,
            'storage_summary': {
                storage_type.value: count 
                for storage_type, count in shopping_list.storage_summary.items()
            }
        }
        
        # Add metadata if requested
        if self.options.get('include_metadata', True):
            data['metadata'] = {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0',
                **shopping_list.metadata
            }
            
        # Add sections or flat items
        if self.options.get('flat_items', False):
            # Flatten all items into single array
            items = []
            for section in shopping_list.sections:
                for item in section.items:
                    item_data = self._item_to_dict(item)
                    item_data['section'] = section.title
                    items.append(item_data)
            data['items'] = items
        else:
            # Keep sectioned structure
            data['sections'] = [
                self._section_to_dict(section) 
                for section in shopping_list.sections
            ]
            
        return data
        
    def _section_to_dict(self, section) -> Dict[str, Any]:
        """Convert a section to dictionary."""
        return {
            'title': section.title,
            'type': section.section_type,
            'items': [self._item_to_dict(item) for item in section.items],
            'metadata': section.metadata
        }
        
    def _item_to_dict(self, item) -> Dict[str, Any]:
        """Convert an item to dictionary."""
        item_dict = {
            'id': str(item.ingredient_id),
            'name': item.name,
            'quantity': float(item.quantity),
            'rounded_quantity': float(item.rounded_quantity),
            'unit': item.unit,
            'display_text': item.display_text,
            'category': item.category.value,
            'storage_type': item.storage_type.value,
            'checked': item.checked
        }
        
        # Optional fields
        if item.aisle_number is not None:
            item_dict['aisle_number'] = item.aisle_number
            
        if item.package_suggestion:
            item_dict['package_suggestion'] = item.package_suggestion
            
        if item.subcategory:
            item_dict['subcategory'] = item.subcategory
            
        if item.sources:
            item_dict['sources'] = item.sources
            
        return item_dict