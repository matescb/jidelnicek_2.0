"""
Plain text exporter for shopping lists.
"""

from typing import Optional, Dict, Any
from datetime import datetime

from .base import ShoppingListExporter
from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


class TextExporter(ShoppingListExporter):
    """
    Export shopping lists as plain text files.
    
    Supports various formatting options including:
    - Checkboxes for items
    - Package suggestions
    - Source recipe information
    - Compact or detailed formats
    """
    
    def get_file_extension(self) -> str:
        """Return .txt extension."""
        return '.txt'
        
    def get_mime_type(self) -> str:
        """Return text/plain MIME type."""
        return 'text/plain'
        
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to plain text format.
        
        Options:
            include_checkboxes: Add [ ] before each item
            include_sources: Show recipe sources
            include_suggestions: Show package suggestions
            compact: Use compact format
            include_header: Add header with metadata
            include_footer: Add footer with storage summary
            
        Returns:
            UTF-8 encoded text bytes
        """
        lines = []
        
        # Header
        if self.options.get('include_header', True):
            lines.extend(self._generate_header(shopping_list))
            
        # Sections
        for section in shopping_list.sections:
            if lines and not self.options.get('compact', False):
                lines.append("")  # Empty line between sections
                
            lines.extend(self._generate_section(section))
            
        # Footer
        if self.options.get('include_footer', True):
            lines.extend(self._generate_footer(shopping_list))
            
        # Join and encode
        text = '\n'.join(lines)
        return text.encode('utf-8')
        
    def _generate_header(self, shopping_list: ShoppingList) -> list[str]:
        """Generate header lines."""
        lines = []
        
        lines.append("SHOPPING LIST")
        lines.append("=" * 60)
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"Format: {shopping_list.format.value}")
        lines.append(f"Total Items: {shopping_list.total_items}")
        
        if shopping_list.total_weight_g > 0:
            weight_kg = shopping_list.total_weight_g / 1000
            lines.append(f"Total Weight: {weight_kg:.1f} kg")
            
        if shopping_list.total_volume_ml > 0:
            volume_l = shopping_list.total_volume_ml / 1000
            lines.append(f"Total Volume: {volume_l:.1f} L")
            
        lines.append("")
        return lines
        
    def _generate_section(self, section) -> list[str]:
        """Generate lines for a section."""
        lines = []
        
        # Section title
        if not self.options.get('compact', False):
            lines.append(section.title)
            lines.append("-" * len(section.title))
        
        # Items
        for item in section.items:
            line = self._format_item(item)
            lines.append(line)
            
            # Add source info if requested
            if self.options.get('include_sources', False) and item.sources:
                for source in item.sources:
                    source_line = f"    → {source['recipe']} ({source['meal']}, Day {source['day']})"
                    lines.append(source_line)
                    
        return lines
        
    def _format_item(self, item) -> str:
        """Format a single item line."""
        parts = []
        
        # Checkbox
        if self.options.get('include_checkboxes', True):
            parts.append("[ ]")
            
        # Item name and quantity
        if self.options.get('compact', False):
            parts.append(f"{item.name}: {item.display_text}")
        else:
            parts.append(f"{item.name} - {item.display_text}")
            
        # Package suggestion
        if self.options.get('include_suggestions', True) and item.package_suggestion:
            parts.append(f"({item.package_suggestion})")
            
        return " ".join(parts)
        
    def _generate_footer(self, shopping_list: ShoppingList) -> list[str]:
        """Generate footer lines."""
        lines = []
        
        lines.append("")
        lines.append("=" * 60)
        
        # Storage summary
        if shopping_list.storage_summary:
            lines.append("")
            lines.append("Storage Requirements:")
            for storage_type, count in shopping_list.storage_summary.items():
                lines.append(f"  {storage_type.value}: {count} items")
                
        # Notes section
        if self.options.get('include_notes', True):
            lines.append("")
            lines.append("Notes:")
            lines.append("_" * 60)
            lines.append("")
            lines.append("")
            
        return lines