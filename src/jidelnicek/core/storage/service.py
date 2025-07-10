"""
Storage service for managing file operations.

This module provides a high-level service interface for file storage
operations, including upload, download, metadata management, and
access control.
"""

import os
import uuid
import mimetypes
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO, List, Union
from functools import lru_cache

from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Session
from sqlalchemy.sql import func

from jidelnicek.core.database import Base
from jidelnicek.core.config import get_settings
from jidelnicek.core.exceptions import (
    NotFoundError, PermissionError, ValidationError
)
from .base import (
    StorageBackend, StorageMetadata, StorageError,
    FileNotFoundError as StorageFileNotFoundError,
    StoragePermissionError, CompressionType
)
from .local import LocalStorageBackend

# Optional imports for cloud storage backends
try:
    from .s3 import S3StorageBackend
except ImportError:
    S3StorageBackend = None

try:
    from .azure import AzureStorageBackend
except ImportError:
    AzureStorageBackend = None


class StoredFile(Base):
    """
    Database model for tracking stored files.
    
    This model maintains metadata about files stored in the storage backend,
    providing database-level querying and access control.
    """
    
    __tablename__ = "stored_files"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # File identification
    file_id = Column(String(255), unique=True, nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    
    # Storage information
    storage_backend = Column(String(50), nullable=False)  # local, s3, azure
    storage_path = Column(Text, nullable=False)  # Backend-specific path/URI
    file_size = Column(Integer, nullable=False)
    original_size = Column(Integer)  # Before compression
    checksum = Column(String(64), nullable=False)
    compression = Column(String(20), default="none")
    
    # Ownership and access
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=True, index=True)
    user = relationship("AuthUser", back_populates="stored_files")
    job_id = Column(String(255), ForeignKey("jobs.task_id"), nullable=True, index=True)
    job = relationship("Job", backref="stored_files")
    
    # Access control
    is_public = Column(Boolean, default=False)
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))  # Auto-delete after this time
    
    # Metadata
    file_metadata = Column(JSON, default=dict)
    tags = Column(JSON, default=list)
    description = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Soft delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True))
    
    def __repr__(self):
        return f"<StoredFile(id={self.id}, file_id={self.file_id}, filename={self.filename})>"


class StorageService:
    """
    High-level service for file storage operations.
    
    This service manages file uploads, downloads, and metadata while
    coordinating between the database and storage backends.
    """
    
    def __init__(self, db: Session, backend: Optional[StorageBackend] = None):
        """
        Initialize storage service.
        
        Args:
            db: Database session
            backend: Storage backend to use (auto-detected if None)
        """
        self.db = db
        self.settings = get_settings()
        
        # Initialize backend if not provided
        if backend is None:
            backend = self._create_backend()
        self.backend = backend
    
    def _create_backend(self) -> StorageBackend:
        """Create storage backend based on configuration."""
        backend_type = self.settings.storage_backend
        
        if backend_type == "local":
            return LocalStorageBackend({
                "base_path": self.settings.storage_local_path,
                "compression": self.settings.storage_compression,
                "permissions": 0o600,
                "max_file_size": self.settings.storage_max_file_size,
            })
        elif backend_type == "s3":
            if S3StorageBackend is None:
                raise StorageError("S3 storage backend is not available. Install boto3 to use S3 storage.")
            return S3StorageBackend({
                "bucket_name": self.settings.storage_s3_bucket,
                "region": self.settings.storage_s3_region,
                "access_key_id": self.settings.storage_s3_access_key,
                "secret_access_key": self.settings.storage_s3_secret_key,
                "compression": self.settings.storage_compression,
                "storage_class": self.settings.storage_s3_storage_class,
                "server_side_encryption": self.settings.storage_s3_encryption,
                "max_file_size": self.settings.storage_max_file_size,
            })
        elif backend_type == "azure":
            if AzureStorageBackend is None:
                raise StorageError("Azure storage backend is not available. Install azure-storage-blob to use Azure storage.")
            return AzureStorageBackend({
                "connection_string": self.settings.storage_azure_connection_string,
                "container_name": self.settings.storage_azure_container,
                "compression": self.settings.storage_compression,
                "tier": self.settings.storage_azure_tier,
                "max_file_size": self.settings.storage_max_file_size,
            })
        else:
            raise StorageError(f"Unknown storage backend: {backend_type}")
    
    def _generate_file_id(
        self,
        user_id: Optional[str],  # UUID as string
        job_id: Optional[str],
        filename: str
    ) -> str:
        """
        Generate a unique file ID with directory structure.
        
        Returns:
            File ID in format: exports/{year}/{month}/{user_id}/{job_id}/{uuid}_{filename}
        """
        now = datetime.utcnow()
        parts = [
            "exports",
            str(now.year),
            f"{now.month:02d}",
        ]
        
        if user_id:
            parts.append(str(user_id))
        else:
            parts.append("anonymous")
        
        if job_id:
            parts.append(job_id)
        else:
            parts.append("direct")
        
        # Generate unique filename
        file_uuid = uuid.uuid4().hex[:8]
        safe_filename = "".join(
            c if c.isalnum() or c in ".-_" else "_"
            for c in filename
        )
        parts.append(f"{now.strftime('%Y%m%d_%H%M%S')}_{file_uuid}_{safe_filename}")
        
        return "/".join(parts)
    
    async def upload(
        self,
        file_data: BinaryIO,
        filename: str,
        user_id: Optional[str] = None,  # UUID as string
        job_id: Optional[str] = None,
        content_type: Optional[str] = None,
        compression: Optional[CompressionType] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        is_public: bool = False,
        expires_in_days: Optional[int] = None,
    ) -> StoredFile:
        """
        Upload a file to storage.
        
        Args:
            file_data: Binary file data
            filename: Original filename
            user_id: ID of user uploading the file
            job_id: ID of associated job
            content_type: MIME content type
            compression: Compression type to use
            metadata: Additional metadata
            tags: List of tags
            description: File description
            is_public: Whether file is publicly accessible
            expires_in_days: Auto-delete after this many days
            
        Returns:
            StoredFile database record
            
        Raises:
            StorageError: If upload fails
            ValidationError: If validation fails
        """
        # Validate filename
        if not filename or "/" in filename or "\\" in filename:
            raise ValidationError("Invalid filename")
        
        # Detect content type if not provided
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"
        
        # Generate file ID
        file_id = self._generate_file_id(user_id, job_id, filename)
        
        # Create storage metadata
        storage_metadata = StorageMetadata(
            file_id=file_id,
            filename=filename,
            content_type=content_type,
            size=0,  # Will be updated by backend
            checksum="",  # Will be calculated by backend
            created_at=datetime.utcnow(),
            user_id=user_id,
            job_id=job_id,
            compression=compression or CompressionType.NONE,
            metadata=metadata or {},
            tags=tags or [],
        )
        
        # Upload to backend
        try:
            storage_path = await self.backend.store(
                file_id=file_id,
                file_data=file_data,
                metadata=storage_metadata,
                overwrite=False
            )
            
            # Get updated metadata with size and checksum
            storage_metadata = await self.backend.get_metadata(file_id)
            
        except StoragePermissionError:
            # File already exists, generate new ID
            file_id = self._generate_file_id(user_id, job_id, f"{uuid.uuid4().hex[:4]}_{filename}")
            storage_metadata.file_id = file_id
            storage_path = await self.backend.store(
                file_id=file_id,
                file_data=file_data,
                metadata=storage_metadata,
                overwrite=False
            )
            storage_metadata = await self.backend.get_metadata(file_id)
        
        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        # Create database record
        stored_file = StoredFile(
            file_id=file_id,
            filename=filename,
            content_type=content_type,
            storage_backend=self.settings.storage_backend,
            storage_path=storage_path,
            file_size=storage_metadata.size,
            original_size=storage_metadata.original_size,
            checksum=storage_metadata.checksum,
            compression=storage_metadata.compression,
            user_id=user_id,
            job_id=job_id,
            is_public=is_public,
            metadata=metadata or {},
            tags=tags or [],
            description=description,
            expires_at=expires_at,
        )
        
        self.db.add(stored_file)
        self.db.commit()
        self.db.refresh(stored_file)
        
        return stored_file
    
    async def download(
        self,
        file_id: str,
        user_id: Optional[str] = None,  # UUID as string
        check_permissions: bool = True
    ) -> tuple[BinaryIO, StoredFile]:
        """
        Download a file from storage.
        
        Args:
            file_id: File ID to download
            user_id: ID of user requesting download
            check_permissions: Whether to check access permissions
            
        Returns:
            Tuple of (file data, database record)
            
        Raises:
            NotFoundError: If file not found
            PermissionDeniedError: If access denied
            StorageError: If download fails
        """
        # Get database record
        stored_file = self.db.query(StoredFile).filter(
            StoredFile.file_id == file_id,
            StoredFile.is_deleted == False
        ).first()
        
        if not stored_file:
            raise NotFoundError(f"File not found: {file_id}")
        
        # Check permissions
        if check_permissions and not stored_file.is_public:
            if user_id != stored_file.user_id:
                raise PermissionDeniedError("Access denied to file")
        
        # Check expiration
        if stored_file.expires_at and stored_file.expires_at < datetime.utcnow():
            raise NotFoundError("File has expired")
        
        # Download from backend
        try:
            file_data, _ = await self.backend.retrieve(file_id)
        except StorageFileNotFoundError:
            # Mark as deleted in database
            stored_file.is_deleted = True
            stored_file.deleted_at = datetime.utcnow()
            self.db.commit()
            raise NotFoundError(f"File not found in storage: {file_id}")
        
        # Update access statistics
        stored_file.access_count += 1
        stored_file.last_accessed = datetime.utcnow()
        self.db.commit()
        
        return file_data, stored_file
    
    async def delete(
        self,
        file_id: str,
        user_id: Optional[str] = None,  # UUID as string
        check_permissions: bool = True,
        soft_delete: bool = True
    ) -> bool:
        """
        Delete a file from storage.
        
        Args:
            file_id: File ID to delete
            user_id: ID of user requesting deletion
            check_permissions: Whether to check permissions
            soft_delete: If True, only mark as deleted; if False, permanently delete
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            PermissionDeniedError: If access denied
        """
        # Get database record
        stored_file = self.db.query(StoredFile).filter(
            StoredFile.file_id == file_id,
            StoredFile.is_deleted == False
        ).first()
        
        if not stored_file:
            return False
        
        # Check permissions
        if check_permissions and user_id != stored_file.user_id:
            raise PermissionDeniedError("Access denied to file")
        
        if soft_delete:
            # Soft delete - mark as deleted in database
            stored_file.is_deleted = True
            stored_file.deleted_at = datetime.utcnow()
            self.db.commit()
        else:
            # Hard delete - remove from storage and database
            try:
                await self.backend.delete(file_id)
            except StorageError:
                pass  # File might already be deleted
            
            self.db.delete(stored_file)
            self.db.commit()
        
        return True
    
    async def list_files(
        self,
        user_id: Optional[str] = None,  # UUID as string
        job_id: Optional[str] = None,
        is_public: Optional[bool] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[StoredFile]:
        """
        List files with optional filtering.
        
        Args:
            user_id: Filter by user ID
            job_id: Filter by job ID
            is_public: Filter by public status
            tags: Filter by tags (files must have all specified tags)
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of StoredFile records
        """
        query = self.db.query(StoredFile).filter(
            StoredFile.is_deleted == False
        )
        
        if user_id is not None:
            query = query.filter(StoredFile.user_id == user_id)
        
        if job_id is not None:
            query = query.filter(StoredFile.job_id == job_id)
        
        if is_public is not None:
            query = query.filter(StoredFile.is_public == is_public)
        
        if tags:
            # Filter by tags using JSON operations
            for tag in tags:
                query = query.filter(StoredFile.tags.contains([tag]))
        
        # Order by creation date descending
        query = query.order_by(StoredFile.created_at.desc())
        
        # Apply pagination
        query = query.limit(limit).offset(offset)
        
        return query.all()
    
    async def update_metadata(
        self,
        file_id: str,
        user_id: Optional[str] = None,  # UUID as string
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        is_public: Optional[bool] = None,
        check_permissions: bool = True
    ) -> StoredFile:
        """
        Update file metadata.
        
        Args:
            file_id: File ID to update
            user_id: ID of user requesting update
            metadata: New metadata to merge
            tags: New tags to add
            description: New description
            is_public: New public status
            check_permissions: Whether to check permissions
            
        Returns:
            Updated StoredFile record
            
        Raises:
            NotFoundError: If file not found
            PermissionDeniedError: If access denied
        """
        # Get database record
        stored_file = self.db.query(StoredFile).filter(
            StoredFile.file_id == file_id,
            StoredFile.is_deleted == False
        ).first()
        
        if not stored_file:
            raise NotFoundError(f"File not found: {file_id}")
        
        # Check permissions
        if check_permissions and user_id != stored_file.user_id:
            raise PermissionDeniedError("Access denied to file")
        
        # Update database record
        if metadata is not None:
            stored_file.metadata = {**stored_file.metadata, **metadata}
        
        if tags is not None:
            # Merge tags
            existing_tags = set(stored_file.tags or [])
            new_tags = set(tags)
            stored_file.tags = list(existing_tags | new_tags)
        
        if description is not None:
            stored_file.description = description
        
        if is_public is not None:
            stored_file.is_public = is_public
        
        stored_file.updated_at = datetime.utcnow()
        
        # Update backend metadata
        backend_metadata = {}
        if metadata:
            backend_metadata["metadata"] = metadata
        if tags:
            backend_metadata["tags"] = stored_file.tags
        
        if backend_metadata:
            await self.backend.update_metadata(
                file_id=file_id,
                metadata=backend_metadata,
                merge=True
            )
        
        self.db.commit()
        self.db.refresh(stored_file)
        
        return stored_file
    
    async def generate_download_url(
        self,
        file_id: str,
        user_id: Optional[str] = None,  # UUID as string
        expires_in: int = 3600,
        check_permissions: bool = True
    ) -> str:
        """
        Generate a temporary download URL.
        
        Args:
            file_id: File ID
            user_id: ID of user requesting URL
            expires_in: URL expiration in seconds
            check_permissions: Whether to check permissions
            
        Returns:
            Temporary download URL
            
        Raises:
            NotFoundError: If file not found
            PermissionDeniedError: If access denied
            NotImplementedError: If backend doesn't support signed URLs
        """
        # Get database record
        stored_file = self.db.query(StoredFile).filter(
            StoredFile.file_id == file_id,
            StoredFile.is_deleted == False
        ).first()
        
        if not stored_file:
            raise NotFoundError(f"File not found: {file_id}")
        
        # Check permissions
        if check_permissions and not stored_file.is_public:
            if user_id != stored_file.user_id:
                raise PermissionDeniedError("Access denied to file")
        
        # Generate signed URL
        try:
            url = await self.backend.generate_signed_url(
                file_id=file_id,
                expires_in=expires_in,
                method="GET"
            )
            
            # Update access count
            stored_file.access_count += 1
            stored_file.last_accessed = datetime.utcnow()
            self.db.commit()
            
            return url
            
        except NotImplementedError:
            # Fallback to application-level URL generation
            # This would integrate with your web framework
            raise NotImplementedError(
                "Direct download URLs not supported for this storage backend"
            )
    
    async def cleanup_expired_files(self) -> int:
        """
        Delete expired files from storage.
        
        Returns:
            Number of files deleted
        """
        # Find expired files
        expired_files = self.db.query(StoredFile).filter(
            StoredFile.expires_at < datetime.utcnow(),
            StoredFile.is_deleted == False
        ).all()
        
        count = 0
        for file in expired_files:
            try:
                # Delete from storage
                await self.backend.delete(file.file_id)
                
                # Mark as deleted
                file.is_deleted = True
                file.deleted_at = datetime.utcnow()
                count += 1
                
            except Exception:
                # Log error but continue
                pass
        
        self.db.commit()
        return count
    
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
        # Get backend statistics
        backend_stats = await self.backend.get_usage_stats(user_id)
        
        # Get database statistics
        query = self.db.query(StoredFile).filter(
            StoredFile.is_deleted == False
        )
        
        if user_id:
            query = query.filter(StoredFile.user_id == user_id)
        
        db_stats = {
            "total_files": query.count(),
            "total_size": sum(f.file_size for f in query.all()),
            "public_files": query.filter(StoredFile.is_public == True).count(),
            "files_by_type": {},
        }
        
        # Count files by content type
        for file in query.all():
            content_type = file.content_type.split("/")[0]
            db_stats["files_by_type"][content_type] = \
                db_stats["files_by_type"].get(content_type, 0) + 1
        
        return {
            **backend_stats,
            **db_stats,
        }


@lru_cache()
def get_storage_service() -> StorageService:
    """
    Get cached storage service instance.
    
    Note: This returns a service without database session.
    You must provide the session when using the service.
    
    Returns:
        StorageService instance
    """
    return StorageService(db=None)