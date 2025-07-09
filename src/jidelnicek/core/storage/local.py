"""
Local filesystem storage backend implementation.

This module provides a storage backend that saves files to the local
filesystem with proper organization, security, and metadata tracking.
"""

import os
import json
import gzip
import bz2
import lzma
import zipfile
import aiofiles
import aiofiles.os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO, List, Union
from io import BytesIO
import tempfile
import shutil

from .base import (
    StorageBackend, StorageMetadata, StorageError,
    FileNotFoundError, StoragePermissionError,
    CompressionType
)


class LocalStorageBackend(StorageBackend):
    """
    Local filesystem storage backend.
    
    Stores files in a hierarchical directory structure with
    metadata stored as JSON sidecar files.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize local storage backend.
        
        Args:
            config: Configuration with keys:
                - base_path: Root directory for storage
                - compression: Default compression type
                - permissions: File permissions (octal)
                - max_file_size: Maximum file size in bytes
        """
        super().__init__(config)
        self.base_path = Path(config.get("base_path", "/var/lib/jidelnicek/storage"))
        self.default_compression = CompressionType(
            config.get("compression", CompressionType.GZIP)
        )
        self.permissions = config.get("permissions", 0o600)
        self.max_file_size = config.get("max_file_size", 100 * 1024 * 1024)  # 100MB
        
        # Create base directory if it doesn't exist
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _get_file_path(self, file_id: str) -> Path:
        """
        Get the full path for a file.
        
        Args:
            file_id: File identifier
            
        Returns:
            Path object for the file
        """
        # Validate file ID
        if not self.validate_file_id(file_id):
            raise StorageError(f"Invalid file ID: {file_id}")
        
        # Create path structure: base/year/month/user_id/job_id/file_id
        parts = file_id.split("/")
        return self.base_path.joinpath(*parts)
    
    def _get_metadata_path(self, file_id: str) -> Path:
        """Get the path for metadata file."""
        file_path = self._get_file_path(file_id)
        return file_path.with_suffix(file_path.suffix + ".meta.json")
    
    async def _compress_data(
        self,
        data: bytes,
        compression: CompressionType
    ) -> tuple[bytes, int]:
        """
        Compress data using specified compression type.
        
        Args:
            data: Raw data to compress
            compression: Compression type to use
            
        Returns:
            Tuple of (compressed data, original size)
        """
        original_size = len(data)
        
        if compression == CompressionType.NONE:
            return data, original_size
        elif compression == CompressionType.GZIP:
            return gzip.compress(data, compresslevel=6), original_size
        elif compression == CompressionType.BZIP2:
            return bz2.compress(data, compresslevel=6), original_size
        elif compression == CompressionType.XZ:
            return lzma.compress(data, preset=6), original_size
        elif compression == CompressionType.ZIP:
            # ZIP requires a file-like object
            buffer = BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("data", data)
            return buffer.getvalue(), original_size
        else:
            raise StorageError(f"Unsupported compression type: {compression}")
    
    async def _decompress_data(
        self,
        data: bytes,
        compression: CompressionType
    ) -> bytes:
        """
        Decompress data using specified compression type.
        
        Args:
            data: Compressed data
            compression: Compression type used
            
        Returns:
            Decompressed data
        """
        if compression == CompressionType.NONE:
            return data
        elif compression == CompressionType.GZIP:
            return gzip.decompress(data)
        elif compression == CompressionType.BZIP2:
            return bz2.decompress(data)
        elif compression == CompressionType.XZ:
            return lzma.decompress(data)
        elif compression == CompressionType.ZIP:
            buffer = BytesIO(data)
            with zipfile.ZipFile(buffer, "r") as zf:
                return zf.read("data")
        else:
            raise StorageError(f"Unsupported compression type: {compression}")
    
    async def store(
        self,
        file_id: str,
        file_data: BinaryIO,
        metadata: StorageMetadata,
        overwrite: bool = False
    ) -> str:
        """Store a file in the local filesystem."""
        file_path = self._get_file_path(file_id)
        metadata_path = self._get_metadata_path(file_id)
        
        # Check if file exists
        if file_path.exists() and not overwrite:
            raise StoragePermissionError(f"File already exists: {file_id}")
        
        # Read data
        data = file_data.read()
        
        # Check file size
        if len(data) > self.max_file_size:
            raise StorageError(
                f"File size ({len(data)} bytes) exceeds maximum "
                f"({self.max_file_size} bytes)"
            )
        
        # Compress if needed
        compression = metadata.compression or self.default_compression
        compressed_data, original_size = await self._compress_data(data, compression)
        
        # Update metadata
        metadata.compression = compression
        metadata.original_size = original_size
        metadata.size = len(compressed_data)
        metadata.checksum = self.calculate_checksum(data)
        
        # Create directory structure
        file_path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        
        # Write file atomically
        temp_file = None
        try:
            # Write to temporary file first
            with tempfile.NamedTemporaryFile(
                dir=file_path.parent,
                delete=False,
                mode="wb"
            ) as temp_file:
                temp_file.write(compressed_data)
                temp_file.flush()
                os.fsync(temp_file.fileno())
            
            # Set permissions
            os.chmod(temp_file.name, self.permissions)
            
            # Atomic rename
            os.rename(temp_file.name, str(file_path))
            
            # Write metadata
            async with aiofiles.open(metadata_path, "w") as f:
                await f.write(json.dumps({
                    "file_id": metadata.file_id,
                    "filename": metadata.filename,
                    "content_type": metadata.content_type,
                    "size": metadata.size,
                    "checksum": metadata.checksum,
                    "created_at": metadata.created_at.isoformat(),
                    "updated_at": metadata.updated_at.isoformat() if metadata.updated_at else None,
                    "user_id": metadata.user_id,
                    "job_id": metadata.job_id,
                    "compression": metadata.compression,
                    "original_size": metadata.original_size,
                    "metadata": metadata.metadata,
                    "tags": metadata.tags,
                }, indent=2))
            
            return str(file_path)
            
        except Exception as e:
            # Clean up temporary file on error
            if temp_file and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            raise StorageError(f"Failed to store file: {e}")
    
    async def retrieve(self, file_id: str) -> tuple[BinaryIO, StorageMetadata]:
        """Retrieve a file from the local filesystem."""
        file_path = self._get_file_path(file_id)
        metadata_path = self._get_metadata_path(file_id)
        
        # Check if file exists
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_id}")
        
        # Read metadata
        try:
            async with aiofiles.open(metadata_path, "r") as f:
                metadata_dict = json.loads(await f.read())
            
            metadata = StorageMetadata(
                file_id=metadata_dict["file_id"],
                filename=metadata_dict["filename"],
                content_type=metadata_dict["content_type"],
                size=metadata_dict["size"],
                checksum=metadata_dict["checksum"],
                created_at=datetime.fromisoformat(metadata_dict["created_at"]),
                updated_at=datetime.fromisoformat(metadata_dict["updated_at"]) 
                    if metadata_dict.get("updated_at") else None,
                user_id=metadata_dict.get("user_id"),
                job_id=metadata_dict.get("job_id"),
                compression=CompressionType(metadata_dict.get("compression", "none")),
                original_size=metadata_dict.get("original_size"),
                metadata=metadata_dict.get("metadata", {}),
                tags=metadata_dict.get("tags", []),
            )
        except Exception as e:
            raise StorageError(f"Failed to read metadata: {e}")
        
        # Read and decompress file
        try:
            async with aiofiles.open(file_path, "rb") as f:
                compressed_data = await f.read()
            
            decompressed_data = await self._decompress_data(
                compressed_data,
                metadata.compression
            )
            
            return BytesIO(decompressed_data), metadata
            
        except Exception as e:
            raise StorageError(f"Failed to retrieve file: {e}")
    
    async def delete(self, file_id: str) -> bool:
        """Delete a file from the local filesystem."""
        file_path = self._get_file_path(file_id)
        metadata_path = self._get_metadata_path(file_id)
        
        # Check if file exists
        if not file_path.exists():
            return False
        
        try:
            # Delete file and metadata
            if file_path.exists():
                await aiofiles.os.remove(file_path)
            if metadata_path.exists():
                await aiofiles.os.remove(metadata_path)
            
            # Clean up empty directories
            parent = file_path.parent
            while parent != self.base_path:
                try:
                    parent.rmdir()  # Only removes if empty
                    parent = parent.parent
                except OSError:
                    break
            
            return True
            
        except Exception as e:
            raise StorageError(f"Failed to delete file: {e}")
    
    async def exists(self, file_id: str) -> bool:
        """Check if a file exists."""
        file_path = self._get_file_path(file_id)
        return file_path.exists()
    
    async def list_files(
        self,
        prefix: Optional[str] = None,
        user_id: Optional[str] = None,  # UUID as string
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[StorageMetadata]:
        """List files with optional filtering."""
        results = []
        count = 0
        
        # Walk through directory structure
        for metadata_file in self.base_path.rglob("*.meta.json"):
            # Skip if we haven't reached offset yet
            if count < offset:
                count += 1
                continue
            
            # Stop if we've reached the limit
            if len(results) >= limit:
                break
            
            try:
                # Read metadata
                async with aiofiles.open(metadata_file, "r") as f:
                    metadata_dict = json.loads(await f.read())
                
                # Apply filters
                if prefix and not metadata_dict["file_id"].startswith(prefix):
                    continue
                if user_id and str(metadata_dict.get("user_id")) != user_id:
                    continue
                if job_id and metadata_dict.get("job_id") != job_id:
                    continue
                
                # Create metadata object
                metadata = StorageMetadata(
                    file_id=metadata_dict["file_id"],
                    filename=metadata_dict["filename"],
                    content_type=metadata_dict["content_type"],
                    size=metadata_dict["size"],
                    checksum=metadata_dict["checksum"],
                    created_at=datetime.fromisoformat(metadata_dict["created_at"]),
                    updated_at=datetime.fromisoformat(metadata_dict["updated_at"]) 
                        if metadata_dict.get("updated_at") else None,
                    user_id=metadata_dict.get("user_id"),
                    job_id=metadata_dict.get("job_id"),
                    compression=CompressionType(metadata_dict.get("compression", "none")),
                    original_size=metadata_dict.get("original_size"),
                    metadata=metadata_dict.get("metadata", {}),
                    tags=metadata_dict.get("tags", []),
                )
                
                results.append(metadata)
                count += 1
                
            except Exception:
                # Skip invalid metadata files
                continue
        
        return results
    
    async def get_metadata(self, file_id: str) -> StorageMetadata:
        """Get metadata for a file."""
        metadata_path = self._get_metadata_path(file_id)
        
        if not metadata_path.exists():
            raise FileNotFoundError(f"File not found: {file_id}")
        
        try:
            async with aiofiles.open(metadata_path, "r") as f:
                metadata_dict = json.loads(await f.read())
            
            return StorageMetadata(
                file_id=metadata_dict["file_id"],
                filename=metadata_dict["filename"],
                content_type=metadata_dict["content_type"],
                size=metadata_dict["size"],
                checksum=metadata_dict["checksum"],
                created_at=datetime.fromisoformat(metadata_dict["created_at"]),
                updated_at=datetime.fromisoformat(metadata_dict["updated_at"]) 
                    if metadata_dict.get("updated_at") else None,
                user_id=metadata_dict.get("user_id"),
                job_id=metadata_dict.get("job_id"),
                compression=CompressionType(metadata_dict.get("compression", "none")),
                original_size=metadata_dict.get("original_size"),
                metadata=metadata_dict.get("metadata", {}),
                tags=metadata_dict.get("tags", []),
            )
        except Exception as e:
            raise StorageError(f"Failed to read metadata: {e}")
    
    async def update_metadata(
        self,
        file_id: str,
        metadata: Dict[str, Any],
        merge: bool = True
    ) -> StorageMetadata:
        """Update metadata for a file."""
        metadata_path = self._get_metadata_path(file_id)
        
        if not metadata_path.exists():
            raise FileNotFoundError(f"File not found: {file_id}")
        
        try:
            # Read existing metadata
            async with aiofiles.open(metadata_path, "r") as f:
                existing = json.loads(await f.read())
            
            # Update metadata
            if merge:
                if "metadata" in metadata:
                    existing["metadata"] = {
                        **existing.get("metadata", {}),
                        **metadata["metadata"]
                    }
                    metadata.pop("metadata")
                if "tags" in metadata:
                    existing_tags = set(existing.get("tags", []))
                    new_tags = set(metadata["tags"])
                    existing["tags"] = list(existing_tags | new_tags)
                    metadata.pop("tags")
                existing.update(metadata)
            else:
                existing = metadata
            
            # Update timestamp
            existing["updated_at"] = datetime.utcnow().isoformat()
            
            # Write updated metadata
            async with aiofiles.open(metadata_path, "w") as f:
                await f.write(json.dumps(existing, indent=2))
            
            # Return updated metadata
            return await self.get_metadata(file_id)
            
        except Exception as e:
            raise StorageError(f"Failed to update metadata: {e}")
    
    async def generate_signed_url(
        self,
        file_id: str,
        expires_in: int = 3600,
        method: str = "GET"
    ) -> str:
        """
        Generate a signed URL for temporary access.
        
        Note: Local storage doesn't support true signed URLs.
        This returns a file:// URL for local access only.
        """
        file_path = self._get_file_path(file_id)
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_id}")
        
        # For local storage, return a file URL
        # In production, this would integrate with a web server
        return f"file://{file_path.absolute()}"
    
    async def get_usage_stats(
        self,
        user_id: Optional[str] = None  # UUID as string
    ) -> Dict[str, Any]:
        """Get storage usage statistics."""
        total_size = 0
        total_files = 0
        compression_stats = {t.value: 0 for t in CompressionType}
        
        # Walk through all metadata files
        for metadata_file in self.base_path.rglob("*.meta.json"):
            try:
                async with aiofiles.open(metadata_file, "r") as f:
                    metadata_dict = json.loads(await f.read())
                
                # Filter by user if specified
                if user_id and str(metadata_dict.get("user_id")) != user_id:
                    continue
                
                total_files += 1
                total_size += metadata_dict.get("size", 0)
                compression = metadata_dict.get("compression", "none")
                compression_stats[compression] += 1
                
            except Exception:
                # Skip invalid metadata files
                continue
        
        # Calculate disk usage
        disk_usage = shutil.disk_usage(str(self.base_path))
        
        return {
            "total_files": total_files,
            "total_size": total_size,
            "compression_stats": compression_stats,
            "disk_total": disk_usage.total,
            "disk_used": disk_usage.used,
            "disk_free": disk_usage.free,
            "disk_percent": (disk_usage.used / disk_usage.total) * 100,
        }