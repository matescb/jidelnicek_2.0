"""
Azure Blob Storage backend implementation.

This module provides a storage backend that saves files to Azure Blob Storage
with proper organization, security, and metadata tracking.
"""

import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, BinaryIO, List
from io import BytesIO
from azure.storage.blob import (
    BlobServiceClient, ContainerClient, BlobClient,
    BlobSasPermissions, generate_blob_sas,
    ContentSettings
)
from azure.core.exceptions import ResourceNotFoundError, ResourceExistsError

from .base import (
    StorageBackend, StorageMetadata, StorageError,
    FileNotFoundError, StoragePermissionError,
    CompressionType
)
from .local import LocalStorageBackend


class AzureStorageBackend(StorageBackend):
    """
    Azure Blob Storage backend.
    
    Stores files in Azure Blob Storage with metadata stored as
    blob metadata and properties.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Azure storage backend.
        
        Args:
            config: Configuration with keys:
                - connection_string: Azure Storage connection string
                - container_name: Blob container name
                - account_name: Storage account name (if not using connection string)
                - account_key: Storage account key (if not using connection string)
                - sas_token: SAS token (if not using connection string or key)
                - compression: Default compression type
                - tier: Blob tier (Hot, Cool, Archive)
                - max_file_size: Maximum file size in bytes
        """
        super().__init__(config)
        
        self.container_name = config["container_name"]
        self.default_compression = CompressionType(
            config.get("compression", CompressionType.GZIP)
        )
        self.tier = config.get("tier", "Hot")
        self.max_file_size = config.get("max_file_size", 5 * 1024 * 1024 * 1024)  # 5GB
        
        # Initialize Azure client
        if config.get("connection_string"):
            self.blob_service_client = BlobServiceClient.from_connection_string(
                config["connection_string"]
            )
            # Extract account name and key for SAS generation
            self._parse_connection_string(config["connection_string"])
        elif config.get("account_name") and config.get("account_key"):
            self.account_name = config["account_name"]
            self.account_key = config["account_key"]
            self.blob_service_client = BlobServiceClient(
                account_url=f"https://{self.account_name}.blob.core.windows.net",
                credential=self.account_key
            )
        elif config.get("account_name") and config.get("sas_token"):
            self.account_name = config["account_name"]
            self.account_key = None
            self.blob_service_client = BlobServiceClient(
                account_url=f"https://{self.account_name}.blob.core.windows.net",
                credential=config["sas_token"]
            )
        else:
            raise StorageError("Azure credentials not configured properly")
        
        # Get container client
        self.container_client = self.blob_service_client.get_container_client(
            self.container_name
        )
        
        # Local storage instance for compression utilities
        self._local_storage = LocalStorageBackend({"base_path": "/tmp"})
        
        # Verify container exists
        self._verify_container()
    
    def _parse_connection_string(self, connection_string: str):
        """Parse connection string to extract account name and key."""
        parts = dict(part.split("=", 1) for part in connection_string.split(";") if "=" in part)
        self.account_name = parts.get("AccountName")
        self.account_key = parts.get("AccountKey")
    
    def _verify_container(self):
        """Verify that the container exists and is accessible."""
        try:
            self.container_client.get_container_properties()
        except ResourceNotFoundError:
            # Create container if it doesn't exist
            try:
                self.container_client.create_container()
            except ResourceExistsError:
                pass  # Container was created by another process
            except Exception as e:
                raise StorageError(f"Failed to create container: {e}")
        except Exception as e:
            raise StorageError(f"Failed to access container: {e}")
    
    def _get_blob_name(self, file_id: str) -> str:
        """Convert file ID to blob name."""
        # Azure blob names use forward slashes
        return file_id.replace("\\", "/")
    
    def _get_metadata_blob_name(self, file_id: str) -> str:
        """Get blob name for metadata."""
        return f"{self._get_blob_name(file_id)}.meta.json"
    
    def _prepare_blob_metadata(self, metadata: StorageMetadata) -> Dict[str, str]:
        """Prepare metadata for blob properties."""
        # Azure blob metadata values must be strings
        return {
            "filename": metadata.filename,
            "checksum": metadata.checksum,
            "user_id": str(metadata.user_id) if metadata.user_id else "",
            "job_id": metadata.job_id or "",
            "compression": metadata.compression,
            "original_size": str(metadata.original_size) if metadata.original_size else "0",
        }
    
    def _prepare_blob_tags(self, metadata: StorageMetadata) -> Dict[str, str]:
        """Prepare tags for blob."""
        tags = {}
        
        # Add standard tags
        if metadata.user_id:
            tags["UserId"] = str(metadata.user_id)
        if metadata.job_id:
            tags["JobId"] = metadata.job_id
        
        # Add custom tags
        for i, tag in enumerate(metadata.tags or []):
            if i < 10:  # Azure supports up to 10 tags
                # Azure tag values must be alphanumeric
                safe_tag = "".join(c if c.isalnum() else "_" for c in tag)
                tags[f"Tag{i}"] = safe_tag
        
        return tags
    
    async def store(
        self,
        file_id: str,
        file_data: BinaryIO,
        metadata: StorageMetadata,
        overwrite: bool = False
    ) -> str:
        """Store a file in Azure Blob Storage."""
        blob_name = self._get_blob_name(file_id)
        metadata_blob_name = self._get_metadata_blob_name(file_id)
        
        # Get blob client
        blob_client = self.container_client.get_blob_client(blob_name)
        
        # Check if blob exists
        if not overwrite:
            try:
                blob_client.get_blob_properties()
                raise StoragePermissionError(f"File already exists: {file_id}")
            except ResourceNotFoundError:
                pass  # File doesn't exist, proceed
        
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
        compressed_data, original_size = await self._local_storage._compress_data(
            data, compression
        )
        
        # Update metadata
        metadata.compression = compression
        metadata.original_size = original_size
        metadata.size = len(compressed_data)
        metadata.checksum = self.calculate_checksum(data)
        
        try:
            # Upload blob
            blob_client.upload_blob(
                compressed_data,
                overwrite=overwrite,
                content_settings=ContentSettings(content_type=metadata.content_type),
                metadata=self._prepare_blob_metadata(metadata),
                tags=self._prepare_blob_tags(metadata),
                standard_blob_tier=self.tier,
            )
            
            # Store metadata separately for richer querying
            metadata_dict = {
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
            }
            
            metadata_blob_client = self.container_client.get_blob_client(
                metadata_blob_name
            )
            metadata_blob_client.upload_blob(
                json.dumps(metadata_dict, indent=2),
                overwrite=True,
                content_settings=ContentSettings(content_type="application/json"),
            )
            
            return f"azure://{self.container_name}/{blob_name}"
            
        except Exception as e:
            raise StorageError(f"Failed to store file in Azure: {e}")
    
    async def retrieve(self, file_id: str) -> tuple[BinaryIO, StorageMetadata]:
        """Retrieve a file from Azure Blob Storage."""
        blob_name = self._get_blob_name(file_id)
        metadata_blob_name = self._get_metadata_blob_name(file_id)
        
        try:
            # Get metadata
            metadata_blob_client = self.container_client.get_blob_client(
                metadata_blob_name
            )
            metadata_data = metadata_blob_client.download_blob().readall()
            metadata_dict = json.loads(metadata_data)
            
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
            
            # Get file
            blob_client = self.container_client.get_blob_client(blob_name)
            compressed_data = blob_client.download_blob().readall()
            
            # Decompress
            decompressed_data = await self._local_storage._decompress_data(
                compressed_data,
                metadata.compression
            )
            
            return BytesIO(decompressed_data), metadata
            
        except ResourceNotFoundError:
            raise FileNotFoundError(f"File not found: {file_id}")
        except Exception as e:
            raise StorageError(f"Failed to retrieve file from Azure: {e}")
    
    async def delete(self, file_id: str) -> bool:
        """Delete a file from Azure Blob Storage."""
        blob_name = self._get_blob_name(file_id)
        metadata_blob_name = self._get_metadata_blob_name(file_id)
        
        try:
            # Delete blob
            blob_client = self.container_client.get_blob_client(blob_name)
            blob_client.delete_blob()
            
            # Delete metadata
            metadata_blob_client = self.container_client.get_blob_client(
                metadata_blob_name
            )
            try:
                metadata_blob_client.delete_blob()
            except ResourceNotFoundError:
                pass  # Metadata might not exist
            
            return True
            
        except ResourceNotFoundError:
            return False
        except Exception as e:
            raise StorageError(f"Failed to delete file from Azure: {e}")
    
    async def exists(self, file_id: str) -> bool:
        """Check if a file exists in Azure."""
        blob_name = self._get_blob_name(file_id)
        blob_client = self.container_client.get_blob_client(blob_name)
        
        try:
            blob_client.get_blob_properties()
            return True
        except ResourceNotFoundError:
            return False
        except Exception as e:
            raise StorageError(f"Failed to check file existence: {e}")
    
    async def list_files(
        self,
        prefix: Optional[str] = None,
        user_id: Optional[str] = None,  # UUID as string
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[StorageMetadata]:
        """List files in Azure with optional filtering."""
        results = []
        count = 0
        
        # Build prefix for listing
        name_prefix = ""
        if prefix:
            name_prefix = self._get_blob_name(prefix)
        
        # List blobs
        blobs = self.container_client.list_blobs(
            name_starts_with=name_prefix,
            include=["metadata", "tags"]
        )
        
        for blob in blobs:
            # Skip metadata blobs
            if blob.name.endswith(".meta.json"):
                continue
            
            # Skip if we haven't reached offset
            if count < offset:
                count += 1
                continue
            
            # Stop if we've reached the limit
            if len(results) >= limit:
                break
            
            # Get metadata
            try:
                metadata_blob_name = f"{blob.name}.meta.json"
                metadata_blob_client = self.container_client.get_blob_client(
                    metadata_blob_name
                )
                metadata_data = metadata_blob_client.download_blob().readall()
                metadata_dict = json.loads(metadata_data)
                
                # Apply filters
                if user_id and str(metadata_dict.get("user_id")) != user_id:
                    continue
                if job_id and metadata_dict.get("job_id") != job_id:
                    continue
                
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
                # Skip files without metadata
                continue
        
        return results
    
    async def get_metadata(self, file_id: str) -> StorageMetadata:
        """Get metadata for a file."""
        metadata_blob_name = self._get_metadata_blob_name(file_id)
        
        try:
            metadata_blob_client = self.container_client.get_blob_client(
                metadata_blob_name
            )
            metadata_data = metadata_blob_client.download_blob().readall()
            metadata_dict = json.loads(metadata_data)
            
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
            
        except ResourceNotFoundError:
            raise FileNotFoundError(f"File not found: {file_id}")
        except Exception as e:
            raise StorageError(f"Failed to get metadata: {e}")
    
    async def update_metadata(
        self,
        file_id: str,
        metadata: Dict[str, Any],
        merge: bool = True
    ) -> StorageMetadata:
        """Update metadata for a file."""
        metadata_blob_name = self._get_metadata_blob_name(file_id)
        
        try:
            # Get existing metadata
            existing_metadata = await self.get_metadata(file_id)
            existing_dict = {
                "file_id": existing_metadata.file_id,
                "filename": existing_metadata.filename,
                "content_type": existing_metadata.content_type,
                "size": existing_metadata.size,
                "checksum": existing_metadata.checksum,
                "created_at": existing_metadata.created_at.isoformat(),
                "updated_at": existing_metadata.updated_at.isoformat() 
                    if existing_metadata.updated_at else None,
                "user_id": existing_metadata.user_id,
                "job_id": existing_metadata.job_id,
                "compression": existing_metadata.compression,
                "original_size": existing_metadata.original_size,
                "metadata": existing_metadata.metadata,
                "tags": existing_metadata.tags,
            }
            
            # Update metadata
            if merge:
                if "metadata" in metadata:
                    existing_dict["metadata"] = {
                        **existing_dict.get("metadata", {}),
                        **metadata["metadata"]
                    }
                    metadata.pop("metadata")
                if "tags" in metadata:
                    existing_tags = set(existing_dict.get("tags", []))
                    new_tags = set(metadata["tags"])
                    existing_dict["tags"] = list(existing_tags | new_tags)
                    metadata.pop("tags")
                existing_dict.update(metadata)
            else:
                existing_dict = metadata
            
            # Update timestamp
            existing_dict["updated_at"] = datetime.utcnow().isoformat()
            
            # Write updated metadata
            metadata_blob_client = self.container_client.get_blob_client(
                metadata_blob_name
            )
            metadata_blob_client.upload_blob(
                json.dumps(existing_dict, indent=2),
                overwrite=True,
                content_settings=ContentSettings(content_type="application/json"),
            )
            
            # Update blob tags
            blob_name = self._get_blob_name(file_id)
            blob_client = self.container_client.get_blob_client(blob_name)
            new_metadata = await self.get_metadata(file_id)
            tags = self._prepare_blob_tags(new_metadata)
            
            if tags:
                blob_client.set_blob_tags(tags)
            
            return new_metadata
            
        except Exception as e:
            raise StorageError(f"Failed to update metadata: {e}")
    
    async def generate_signed_url(
        self,
        file_id: str,
        expires_in: int = 3600,
        method: str = "GET"
    ) -> str:
        """Generate a SAS URL for temporary access."""
        blob_name = self._get_blob_name(file_id)
        
        # Check if file exists
        if not await self.exists(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")
        
        # Check if we have account key for SAS generation
        if not self.account_key:
            raise NotImplementedError(
                "SAS URL generation requires account key"
            )
        
        # Map HTTP methods to SAS permissions
        permission_map = {
            "GET": BlobSasPermissions(read=True),
            "PUT": BlobSasPermissions(write=True, create=True),
            "DELETE": BlobSasPermissions(delete=True),
        }
        
        permissions = permission_map.get(method.upper())
        if not permissions:
            raise StorageError(f"Unsupported method for SAS URL: {method}")
        
        try:
            # Generate SAS token
            sas_token = generate_blob_sas(
                account_name=self.account_name,
                container_name=self.container_name,
                blob_name=blob_name,
                account_key=self.account_key,
                permission=permissions,
                expiry=datetime.utcnow() + timedelta(seconds=expires_in),
            )
            
            # Construct URL
            blob_client = self.container_client.get_blob_client(blob_name)
            return f"{blob_client.url}?{sas_token}"
            
        except Exception as e:
            raise StorageError(f"Failed to generate SAS URL: {e}")
    
    async def get_usage_stats(
        self,
        user_id: Optional[str] = None  # UUID as string
    ) -> Dict[str, Any]:
        """Get storage usage statistics."""
        total_size = 0
        total_files = 0
        compression_stats = {t.value: 0 for t in CompressionType}
        
        # List all metadata blobs
        blobs = self.container_client.list_blobs(
            name_ends_with=".meta.json"
        )
        
        for blob in blobs:
            try:
                # Get metadata
                blob_client = self.container_client.get_blob_client(blob.name)
                metadata_data = blob_client.download_blob().readall()
                metadata_dict = json.loads(metadata_data)
                
                # Filter by user if specified
                if user_id and str(metadata_dict.get("user_id")) != user_id:
                    continue
                
                total_files += 1
                total_size += metadata_dict.get("size", 0)
                compression = metadata_dict.get("compression", "none")
                compression_stats[compression] += 1
                
            except Exception:
                # Skip invalid metadata
                continue
        
        # Get container properties
        container_props = self.container_client.get_container_properties()
        
        return {
            "total_files": total_files,
            "total_size": total_size,
            "compression_stats": compression_stats,
            "container_name": self.container_name,
            "account_name": self.account_name,
            "last_modified": container_props.get("last_modified"),
        }