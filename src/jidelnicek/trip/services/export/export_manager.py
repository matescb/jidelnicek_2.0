"""
Export manager for trip exports.

Coordinates different export formats and provides a unified interface.
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import logging

# These imports are done dynamically in _initialize_exporters to avoid circular dependencies
# from .pdf_exporter import TripPDFExporter
# from .excel_exporter import TripExcelExporter


logger = logging.getLogger(__name__)


class ExportFormat(Enum):
    """Supported export formats."""
    PDF = "pdf"
    EXCEL = "excel"
    TEXT = "text"
    MARKDOWN = "markdown"
    JSON = "json"


@dataclass
class ExportOptions:
    """Options for trip export."""
    format: ExportFormat
    include_recipes: bool = True
    include_shopping: bool = True
    include_nutrition: bool = True
    include_costs: bool = False
    include_packing: bool = True
    include_charts: bool = True
    include_formulas: bool = True
    page_size: str = "A4"  # A4 or letter
    language: str = "cs"    # cs or en
    currency: str = "Kč"
    compact: bool = False


class TripExportManager:
    """
    Manager for trip exports.
    
    Provides a unified interface for exporting trips to various formats
    with consistent options and error handling.
    """
    
    def __init__(self):
        """Initialize export manager."""
        self._exporters = {}
        self._initialize_exporters()
        
    def _initialize_exporters(self):
        """Initialize available exporters."""
        # PDF exporter
        try:
            from .pdf_exporter import TripPDFExporter
            self._exporters[ExportFormat.PDF] = TripPDFExporter
        except ImportError:
            logger.warning("PDF export not available - reportlab not installed")
            
        # Excel exporter
        try:
            from .excel_exporter import TripExcelExporter
            self._exporters[ExportFormat.EXCEL] = TripExcelExporter
        except ImportError:
            logger.warning("Excel export not available - openpyxl not installed")
            
    def export(
        self,
        trip_data: Dict[str, Any],
        options: ExportOptions
    ) -> bytes:
        """
        Export trip data to specified format.
        
        Args:
            trip_data: Complete trip data including:
                - trip: Trip information
                - days: List of days with meals
                - recipes: Recipe details
                - shopping_list: Aggregated shopping data
                - participants: Participant list
                - nutrition: Nutritional analysis
            options: Export options
            
        Returns:
            Exported file as bytes
            
        Raises:
            ValueError: If format not supported
            ImportError: If required library not installed
        """
        if options.format not in self._exporters:
            raise ValueError(f"Export format {options.format.value} not supported")
            
        # Prepare exporter options
        exporter_options = self._prepare_exporter_options(options)
        
        # Create exporter instance
        exporter_class = self._exporters[options.format]
        exporter = exporter_class(exporter_options)
        
        # Prepare trip data
        prepared_data = self._prepare_trip_data(trip_data, options)
        
        # Export
        try:
            return exporter.export(prepared_data)
        except Exception as e:
            logger.error(f"Export failed: {e}")
            raise
            
    def get_available_formats(self) -> List[ExportFormat]:
        """Get list of available export formats."""
        return list(self._exporters.keys())
        
    def is_format_available(self, format: ExportFormat) -> bool:
        """Check if export format is available."""
        return format in self._exporters
        
    def get_file_extension(self, format: ExportFormat) -> str:
        """Get file extension for export format."""
        extensions = {
            ExportFormat.PDF: ".pdf",
            ExportFormat.EXCEL: ".xlsx",
            ExportFormat.TEXT: ".txt",
            ExportFormat.MARKDOWN: ".md",
            ExportFormat.JSON: ".json"
        }
        return extensions.get(format, ".bin")
        
    def get_mime_type(self, format: ExportFormat) -> str:
        """Get MIME type for export format."""
        mime_types = {
            ExportFormat.PDF: "application/pdf",
            ExportFormat.EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ExportFormat.TEXT: "text/plain",
            ExportFormat.MARKDOWN: "text/markdown",
            ExportFormat.JSON: "application/json"
        }
        return mime_types.get(format, "application/octet-stream")
        
    def _prepare_exporter_options(self, options: ExportOptions) -> Dict[str, Any]:
        """Convert ExportOptions to exporter-specific options dict."""
        return {
            'include_recipes': options.include_recipes,
            'include_shopping': options.include_shopping,
            'include_nutrition': options.include_nutrition,
            'include_costs': options.include_costs,
            'include_packing': options.include_packing,
            'include_charts': options.include_charts,
            'include_formulas': options.include_formulas,
            'page_size': options.page_size,
            'language': options.language,
            'currency': options.currency,
            'compact': options.compact,
            'include_toc': not options.compact,  # No TOC in compact mode
            'include_formatting': True,  # Always include formatting
        }
        
    def _prepare_trip_data(
        self,
        trip_data: Dict[str, Any],
        options: ExportOptions
    ) -> Dict[str, Any]:
        """
        Prepare and validate trip data for export.
        
        Ensures all required fields are present and adds computed fields.
        """
        # Copy data to avoid modifying original
        data = trip_data.copy()
        
        # Ensure required fields
        if 'trip' not in data:
            raise ValueError("Trip data missing 'trip' information")
            
        if 'days' not in data:
            data['days'] = []
            
        # Add computed fields
        trip = data['trip']
        
        # Calculate day count if not present
        if 'day_count' not in trip:
            trip['day_count'] = len(data['days'])
            
        # Add participant list if not present
        if 'participants' not in data:
            data['participants'] = []
            
        # Generate shopping list if requested but not present
        if options.include_shopping and 'shopping_list' not in data:
            data['shopping_list'] = self._generate_shopping_list(data)
            
        # Generate nutrition data if requested but not present
        if options.include_nutrition and 'nutrition' not in data:
            data['nutrition'] = self._generate_nutrition_data(data)
            
        # Generate packing recommendations if requested
        if options.include_packing and 'packing' not in data:
            data['packing'] = self._generate_packing_data(data)
            
        return data
        
    def _generate_shopping_list(self, trip_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate shopping list from trip data."""
        # This would integrate with the shopping list generator
        # For now, return a placeholder
        return {
            'categories': {
                'Zelenina': [],
                'Maso': [],
                'Mléčné výrobky': [],
                'Ostatní': []
            },
            'summary': {
                'total_items': 0,
                'total_weight': 0,
                'total_volume': 0
            }
        }
        
    def _generate_nutrition_data(self, trip_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate nutrition analysis from trip data."""
        # This would calculate nutrition from recipes
        # For now, return a placeholder
        return {
            'daily_averages': {
                'calories': 2000,
                'proteins': 75,
                'carbs': 250,
                'fats': 65,
                'fiber': 25
            },
            'daily': {}
        }
        
    def _generate_packing_data(self, trip_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate packing recommendations from trip data."""
        # This would integrate with the container recommender
        # For now, return a placeholder
        return {
            'containers': [],
            'cooler_size': 30
        }