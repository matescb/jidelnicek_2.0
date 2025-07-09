"""
Base storage interface and common types.

This module defines the abstract base class for storage backends
and common data structures used across all implementations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any, BinaryIO, List
from enum import Enum
import hashlib


class StorageError(Exception):
    """Base exception for storage operations."""
    pass


class FileNotFoundError(StorageError):
    """Raised when a requested file is not found."""
    pass


class StoragePermissionError(StorageError):
    """Raised when access to a file is denied."""
    pass


class StorageQuotaExceededError(StorageError):
    """Raised when storage quota is exceeded."""
    pass


class CompressionType(str, Enum):
    """Supported compression types."""
    NONE = "none"
    GZIP = "gzip"
    BZIP2 = "bzip2"
    XZ = "xz"
    ZIP = "zip"


@dataclass
class StorageMetadata:
    """Metadata for stored files."""
    
    file_id: str
    filename: str
    content_type: str
    size: int
    checksum: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: Optional[str] = None  # UUID as string
    job_id: Optional[str] = None
    compression: CompressionType = CompressionType.NONE
    original_size: Optional[int] = None
    metadata: Dict[str, Any] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.tags is None:
            self.tags = []


class StorageBackend(ABC):
    """
    Abstract base class for storage backends.
    
    All storage implementations must inherit from this class
    and implement the required methods.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the storage backend.
        
        Args:
            config: Backend-specific configuration
        """
        self.config = config
    
    @abstractmethod
    async def store(
        self,
        file_id: str,
        file_data: BinaryIO,
        metadata: StorageMetadata,
        overwrite: bool = False
    ) -> str:
        """
        Store a file in the backend.
        
        Args:
            file_id: Unique identifier for the file
            file_data: Binary file data
            metadata: File metadata
            overwrite: Whether to overwrite existing files
            
        Returns:
            Storage path/URI of the stored file
            
        Raises:
            StorageError: If storage operation fails
            StoragePermissionError: If file exists and overwrite=False
        """
        pass
    
    @abstractmethod
    async def retrieve(self, file_id: str) -> tuple[BinaryIO, StorageMetadata]:
        """
        Retrieve a file from the backend.
        
        Args:
            file_id: Unique identifier for the file
            
        Returns:
            Tuple of (file data, metadata)
            
        Raises:
            FileNotFoundError: If file doesn't exist
            StorageError: If retrieval fails
        """
        pass
    
    @abstractmethod
    async def delete(self, file_id: str) -> bool:
        """
        Delete a file from the backend.
        
        Args:
            file_id: Unique identifier for the file
            
        Returns:
            True if deleted, False if file didn't exist
            
        Raises:
            StorageError: If deletion fails
        """
        pass
    
    @abstractmethod
    async def exists(self, file_id: str) -> bool:
        """
        Check if a file exists in the backend.
        
        Args:
            file_id: Unique identifier for the file
            
        Returns:
            True if file exists, False otherwise
        """
        pass
    
    @abstractmethod
    async def list_files(
        self,
        prefix: Optional[str] = None,
        user_id: Optional[str] = None,  # UUID as string
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[StorageMetadata]:
        """
        List files in the backend with optional filtering.
        
        Args:
            prefix: Filter by file ID prefix
            user_id: Filter by user ID
            job_id: Filter by job ID
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of file metadata
        """
        pass
    
    @abstractmethod
    async def get_metadata(self, file_id: str) -> StorageMetadata:
        """
        Get metadata for a file without retrieving the content.
        
        Args:
            file_id: Unique identifier for the file
            
        Returns:
            File metadata
            
        Raises:
            FileNotFoundError: If file doesn't exist
        """
        pass
    
    @abstractmethod
    async def update_metadata(
        self,
        file_id: str,
        metadata: Dict[str, Any],
        merge: bool = True
    ) -> StorageMetadata:
        """
        Update metadata for a file.
        
        Args:
            file_id: Unique identifier for the file
            metadata: New metadata values
            merge: If True, merge with existing metadata; if False, replace
            
        Returns:
            Updated metadata
            
        Raises:
            FileNotFoundError: If file doesn't exist
        """
        pass
    
    @abstractmethod
    async def generate_signed_url(
        self,
        file_id: str,
        expires_in: int = 3600,
        method: str = "GET"
    ) -> str:
        """
        Generate a signed URL for temporary access to a file.
        
        Args:
            file_id: Unique identifier for the file
            expires_in: URL expiration time in seconds
            method: HTTP method (GET, PUT, DELETE)
            
        Returns:
            Signed URL
            
        Raises:
            FileNotFoundError: If file doesn't exist
            NotImplementedError: If backend doesn't support signed URLs
        """
        pass
    
    @abstractmethod
    async def get_usage_stats(
        self,
        user_id: Optional[str] = None  # UUID as string
    ) -> Dict[str, Any]:
        """
        Get storage usage statistics.
        
        Args:
            user_id: Optional user ID to filter by
            
        Returns:
            Dictionary with usage statistics
        """
        pass
    
    def calculate_checksum(self, data: bytes, algorithm: str = "sha256") -> str:
        """
        Calculate checksum for data.
        
        Args:
            data: Binary data
            algorithm: Hash algorithm to use
            
        Returns:
            Hex digest of the checksum
        """
        h = hashlib.new(algorithm)
        h.update(data)
        return h.hexdigest()
    
    def validate_file_id(self, file_id: str) -> bool:
        """
        Validate file ID format.
        
        Args:
            file_id: File ID to validate
            
        Returns:
            True if valid, False otherwise
        """
        # Basic validation - can be overridden by subclasses
        if not file_id:
            return False
        if len(file_id) > 255:
            return False
        # Check for path traversal attempts
        if ".." in file_id or file_id.startswith("/"):
            return False
        return True