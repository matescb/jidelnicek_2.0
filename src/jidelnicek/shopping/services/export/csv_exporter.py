"""
CSV exporter for shopping lists.
"""

import csv
import io
from typing import List, Dict, Any

from .base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


class CSVExporter(ShoppingListExporter):
    """
    Export shopping lists as CSV files.
    
    Provides tabular format suitable for:
    - Spreadsheet import
    - Database import
    - Simple data analysis
    """
    
    def get_file_extension(self) -> str:
        """Return .csv extension."""
        return '.csv'
        
    def get_mime_type(self) -> str:
        """Return text/csv MIME type."""
        return 'text/csv'
        
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to CSV format.
        
        Options:
            delimiter: Field delimiter (default: comma)
            include_header: Include header row
            fields: List of fields to include
            
        Returns:
            UTF-8 encoded CSV bytes
        """
        # Prepare CSV writer
        output = io.StringIO()
        delimiter = self.options.get('delimiter', ',')
        writer = csv.DictWriter(
            output,
            fieldnames=self._get_fieldnames(),
            delimiter=delimiter
        )
        
        # Write header if requested
        if self.options.get('include_header', True):
            writer.writeheader()
            
        # Write rows
        for row in self._generate_rows(shopping_list):
            writer.writerow(row)
            
        # Get content and encode
        content = output.getvalue()
        return content.encode('utf-8')
        
    def _get_fieldnames(self) -> List[str]:
        """Get CSV field names based on options."""
        default_fields = [
            'section',
            'name',
            'quantity',
            'unit',
            'display_text',
            'category',
            'storage_type',
            'aisle_number',
            'package_suggestion',
            'checked'
        ]
        
        # Use custom fields if provided
        fields = self.options.get('fields', default_fields)
        
        # Add source fields if requested
        if self.options.get('include_sources', False):
            fields.extend(['source_recipes', 'source_meals', 'source_days'])
            
        return fields
        
    def _generate_rows(self, shopping_list: ShoppingList) -> List[Dict[str, Any]]:
        """Generate CSV rows from shopping list."""
        rows = []
        
        for section in shopping_list.sections:
            for item in section.items:
                row = self._item_to_row(item, section)
                rows.append(row)
                
        return rows
        
    def _item_to_row(self, item, section) -> Dict[str, Any]:
        """Convert item to CSV row."""
        row = {
            'section': section.title,
            'name': item.name,
            'quantity': float(item.rounded_quantity),
            'unit': item.unit,
            'display_text': item.display_text,
            'category': item.category.value,
            'storage_type': item.storage_type.value,
            'aisle_number': item.aisle_number or '',
            'package_suggestion': item.package_suggestion or '',
            'checked': 'Yes' if item.checked else 'No'
        }
        
        # Add source information if available
        if self.options.get('include_sources', False) and item.sources:
            row['source_recipes'] = '; '.join(s['recipe'] for s in item.sources)
            row['source_meals'] = '; '.join(s['meal'] for s in item.sources)
            row['source_days'] = '; '.join(str(s['day']) for s in item.sources)
        elif self.options.get('include_sources', False):
            row['source_recipes'] = ''
            row['source_meals'] = ''
            row['source_days'] = ''
            
        return row