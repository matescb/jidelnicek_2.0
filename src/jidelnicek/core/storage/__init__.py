"""
Storage module for secure file handling.

This module provides abstractions for storing files across different
backends (local filesystem, S3, Azure Blob, etc.) with security,
compression, and metadata tracking.
"""

from .base import StorageBackend, StorageMetadata, StorageError
from .local import LocalStorageBackend
from .service import StorageService, get_storage_service

__all__ = [
    "StorageBackend",
    "StorageMetadata",
    "StorageError",
    "LocalStorageBackend",
    "StorageService",
    "get_storage_service",
]