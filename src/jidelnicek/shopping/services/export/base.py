"""
Base classes and interfaces for shopping list exporters.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from enum import Enum
from pathlib import Path
import logging

from jidelnicek.shopping.services.shopping_list_generator import ShoppingList


logger = logging.getLogger(__name__)


class ExportFormat(Enum):
    """Supported export formats."""
    TEXT = "text"
    JSON = "json"
    CSV = "csv"
    EXCEL = "excel"
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "markdown"


class ShoppingListExporter(ABC):
    """
    Abstract base class for shopping list exporters.
    
    Each exporter must implement the export method to convert
    a ShoppingList into the desired format.
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize the exporter.
        
        Args:
            options: Format-specific export options
        """
        self.options = options or {}
        
    @abstractmethod
    def export(self, shopping_list: ShoppingList) -> bytes:
        """
        Export shopping list to bytes.
        
        Args:
            shopping_list: The shopping list to export
            
        Returns:
            The exported content as bytes
        """
        pass
        
    @abstractmethod
    def get_file_extension(self) -> str:
        """
        Get the file extension for this export format.
        
        Returns:
            File extension with dot (e.g., '.txt', '.pdf')
        """
        pass
        
    @abstractmethod
    def get_mime_type(self) -> str:
        """
        Get the MIME type for this export format.
        
        Returns:
            MIME type string (e.g., 'text/plain', 'application/pdf')
        """
        pass
        
    def export_to_file(self, shopping_list: ShoppingList, file_path: Path) -> None:
        """
        Export shopping list to a file.
        
        Args:
            shopping_list: The shopping list to export
            file_path: Path where to save the file
        """
        content = self.export(shopping_list)
        
        # Ensure directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write file
        with open(file_path, 'wb') as f:
            f.write(content)
            
        logger.info(f"Exported shopping list to {file_path}")