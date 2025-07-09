"""
Export manager for shopping lists.

Provides a unified interface for exporting shopping lists
to various formats.
"""

from typing import Dict, Any, Optional, Type
from pathlib import Path
import logging

from jidelnicek.shopping.services.shopping_list_generator import ShoppingList
from jidelnicek.shopping.services.export import (
    ExportFormat,
    ShoppingListExporter,
    TextExporter,
    JSONExporter,
    CSVExporter,
    ExcelExporter,
    PDFExporter,
    HTMLExporter
)


logger = logging.getLogger(__name__)


class ExportManager:
    """
    Manager for shopping list exports.
    
    Provides a simple interface to export shopping lists
    to any supported format.
    """
    
    # Map formats to exporter classes
    EXPORTERS: Dict[ExportFormat, Type[ShoppingListExporter]] = {
        ExportFormat.TEXT: TextExporter,
        ExportFormat.JSON: JSONExporter,
        ExportFormat.CSV: CSVExporter,
        ExportFormat.EXCEL: ExcelExporter,
        ExportFormat.PDF: PDFExporter,
        ExportFormat.HTML: HTMLExporter
    }
    
    def __init__(self):
        """Initialize the export manager."""
        self._exporters: Dict[ExportFormat, ShoppingListExporter] = {}
        
    def export(
        self,
        shopping_list: ShoppingList,
        format: ExportFormat,
        options: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Export shopping list to specified format.
        
        Args:
            shopping_list: The shopping list to export
            format: Export format
            options: Format-specific options
            
        Returns:
            Exported content as bytes
            
        Raises:
            ValueError: If format is not supported
            ImportError: If required library is not installed
        """
        if format not in self.EXPORTERS:
            raise ValueError(f"Unsupported export format: {format}")
            
        # Get or create exporter
        exporter = self._get_exporter(format, options)
        
        # Export
        try:
            return exporter.export(shopping_list)
        except Exception as e:
            logger.error(f"Failed to export to {format.value}: {e}")
            raise
            
    def export_to_file(
        self,
        shopping_list: ShoppingList,
        format: ExportFormat,
        file_path: Path,
        options: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Export shopping list to a file.
        
        Args:
            shopping_list: The shopping list to export
            format: Export format
            file_path: Path where to save the file
            options: Format-specific options
        """
        # Get exporter
        exporter = self._get_exporter(format, options)
        
        # Export to file
        exporter.export_to_file(shopping_list, file_path)
        
    def get_file_extension(self, format: ExportFormat) -> str:
        """
        Get file extension for a format.
        
        Args:
            format: Export format
            
        Returns:
            File extension with dot (e.g., '.pdf')
        """
        exporter_class = self.EXPORTERS.get(format)
        if not exporter_class:
            raise ValueError(f"Unsupported export format: {format}")
            
        # Create temporary instance to get extension
        exporter = exporter_class()
        return exporter.get_file_extension()
        
    def get_mime_type(self, format: ExportFormat) -> str:
        """
        Get MIME type for a format.
        
        Args:
            format: Export format
            
        Returns:
            MIME type string
        """
        exporter_class = self.EXPORTERS.get(format)
        if not exporter_class:
            raise ValueError(f"Unsupported export format: {format}")
            
        # Create temporary instance to get MIME type
        exporter = exporter_class()
        return exporter.get_mime_type()
        
    def get_supported_formats(self) -> list[ExportFormat]:
        """
        Get list of supported export formats.
        
        Returns:
            List of supported formats
        """
        return list(self.EXPORTERS.keys())
        
    def is_format_available(self, format: ExportFormat) -> bool:
        """
        Check if a format is available (dependencies installed).
        
        Args:
            format: Export format to check
            
        Returns:
            True if format is available
        """
        try:
            exporter_class = self.EXPORTERS.get(format)
            if not exporter_class:
                return False
                
            # Try to create instance
            exporter = exporter_class()
            return True
        except ImportError:
            return False
            
    def _get_exporter(
        self,
        format: ExportFormat,
        options: Optional[Dict[str, Any]] = None
    ) -> ShoppingListExporter:
        """
        Get or create exporter instance.
        
        Args:
            format: Export format
            options: Format-specific options
            
        Returns:
            Exporter instance
        """
        # Check if we need to create new instance (options changed)
        if format in self._exporters and options:
            # For now, always create new instance if options provided
            # Could optimize by checking if options actually changed
            exporter_class = self.EXPORTERS[format]
            return exporter_class(options)
            
        # Get cached instance or create new one
        if format not in self._exporters:
            exporter_class = self.EXPORTERS[format]
            self._exporters[format] = exporter_class(options)
            
        return self._exporters[format]