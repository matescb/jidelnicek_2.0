"""
AWS S3 storage backend implementation.

This module provides a storage backend that saves files to Amazon S3
with proper organization, security, and metadata tracking.
"""

import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, BinaryIO, List
from io import BytesIO
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from .base import (
    StorageBackend, StorageMetadata, StorageError,
    FileNotFoundError, StoragePermissionError,
    CompressionType
)
from .local import LocalStorageBackend


class S3StorageBackend(StorageBackend):
    """
    AWS S3 storage backend.
    
    Stores files in S3 with metadata stored as object tags and
    custom metadata headers.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize S3 storage backend.
        
        Args:
            config: Configuration with keys:
                - bucket_name: S3 bucket name
                - region: AWS region
                - access_key_id: AWS access key ID
                - secret_access_key: AWS secret access key
                - endpoint_url: Custom endpoint URL (for S3-compatible services)
                - compression: Default compression type
                - storage_class: S3 storage class (STANDARD, GLACIER, etc.)
                - server_side_encryption: Enable SSE (AES256, aws:kms)
                - kms_key_id: KMS key ID for SSE-KMS
                - max_file_size: Maximum file size in bytes
        """
        super().__init__(config)
        
        self.bucket_name = config["bucket_name"]
        self.region = config.get("region", "us-east-1")
        self.default_compression = CompressionType(
            config.get("compression", CompressionType.GZIP)
        )
        self.storage_class = config.get("storage_class", "STANDARD")
        self.server_side_encryption = config.get("server_side_encryption")
        self.kms_key_id = config.get("kms_key_id")
        self.max_file_size = config.get("max_file_size", 5 * 1024 * 1024 * 1024)  # 5GB
        
        # Initialize S3 client
        session_config = {
            "region_name": self.region,
        }
        
        if config.get("access_key_id") and config.get("secret_access_key"):
            session_config["aws_access_key_id"] = config["access_key_id"]
            session_config["aws_secret_access_key"] = config["secret_access_key"]
        
        if config.get("endpoint_url"):
            session_config["endpoint_url"] = config["endpoint_url"]
        
        self.s3_client = boto3.client("s3", **session_config)
        
        # Local storage instance for compression utilities
        self._local_storage = LocalStorageBackend({"base_path": "/tmp"})
        
        # Verify bucket exists
        self._verify_bucket()
    
    def _verify_bucket(self):
        """Verify that the S3 bucket exists and is accessible."""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "404":
                raise StorageError(f"Bucket not found: {self.bucket_name}")
            elif error_code == "403":
                raise StoragePermissionError(f"Access denied to bucket: {self.bucket_name}")
            else:
                raise StorageError(f"Failed to access bucket: {e}")
        except NoCredentialsError:
            raise StorageError("AWS credentials not configured")
    
    def _get_s3_key(self, file_id: str) -> str:
        """Convert file ID to S3 key."""
        # S3 keys use forward slashes
        return file_id.replace("\\", "/")
    
    def _get_metadata_key(self, file_id: str) -> str:
        """Get S3 key for metadata object."""
        return f"{self._get_s3_key(file_id)}.meta.json"
    
    def _prepare_s3_metadata(self, metadata: StorageMetadata) -> Dict[str, str]:
        """Prepare metadata for S3 object headers."""
        # S3 metadata values must be strings
        return {
            "filename": metadata.filename,
            "content-type": metadata.content_type,
            "checksum": metadata.checksum,
            "user-id": str(metadata.user_id) if metadata.user_id else "",
            "job-id": metadata.job_id or "",
            "compression": metadata.compression,
            "original-size": str(metadata.original_size) if metadata.original_size else "0",
        }
    
    def _prepare_s3_tags(self, metadata: StorageMetadata) -> str:
        """Prepare tags for S3 object."""
        tags = []
        
        # Add standard tags
        if metadata.user_id:
            tags.append(f"UserId={metadata.user_id}")
        if metadata.job_id:
            tags.append(f"JobId={metadata.job_id}")
        
        # Add custom tags
        for tag in metadata.tags or []:
            # S3 tag keys must be alphanumeric + limited special chars
            safe_tag = tag.replace(" ", "_").replace(":", "_")
            tags.append(f"Tag_{safe_tag}=true")
        
        return "&".join(tags)
    
    async def store(
        self,
        file_id: str,
        file_data: BinaryIO,
        metadata: StorageMetadata,
        overwrite: bool = False
    ) -> str:
        """Store a file in S3."""
        s3_key = self._get_s3_key(file_id)
        metadata_key = self._get_metadata_key(file_id)
        
        # Check if file exists
        if not overwrite:
            try:
                self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
                raise StoragePermissionError(f"File already exists: {file_id}")
            except ClientError as e:
                if e.response["Error"]["Code"] != "404":
                    raise StorageError(f"Failed to check file existence: {e}")
        
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
        
        # Prepare S3 parameters
        put_params = {
            "Bucket": self.bucket_name,
            "Key": s3_key,
            "Body": compressed_data,
            "ContentType": metadata.content_type,
            "Metadata": self._prepare_s3_metadata(metadata),
            "StorageClass": self.storage_class,
        }
        
        # Add tags if any
        tags = self._prepare_s3_tags(metadata)
        if tags:
            put_params["Tagging"] = tags
        
        # Add server-side encryption
        if self.server_side_encryption:
            put_params["ServerSideEncryption"] = self.server_side_encryption
            if self.kms_key_id and self.server_side_encryption == "aws:kms":
                put_params["SSEKMSKeyId"] = self.kms_key_id
        
        try:
            # Upload file
            self.s3_client.put_object(**put_params)
            
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
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=metadata_key,
                Body=json.dumps(metadata_dict, indent=2),
                ContentType="application/json",
            )
            
            return f"s3://{self.bucket_name}/{s3_key}"
            
        except ClientError as e:
            raise StorageError(f"Failed to store file in S3: {e}")
    
    async def retrieve(self, file_id: str) -> tuple[BinaryIO, StorageMetadata]:
        """Retrieve a file from S3."""
        s3_key = self._get_s3_key(file_id)
        metadata_key = self._get_metadata_key(file_id)
        
        try:
            # Get metadata
            metadata_response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=metadata_key
            )
            metadata_dict = json.loads(metadata_response["Body"].read())
            
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
            file_response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            compressed_data = file_response["Body"].read()
            
            # Decompress
            decompressed_data = await self._local_storage._decompress_data(
                compressed_data,
                metadata.compression
            )
            
            return BytesIO(decompressed_data), metadata
            
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File not found: {file_id}")
            raise StorageError(f"Failed to retrieve file from S3: {e}")
    
    async def delete(self, file_id: str) -> bool:
        """Delete a file from S3."""
        s3_key = self._get_s3_key(file_id)
        metadata_key = self._get_metadata_key(file_id)
        
        try:
            # Check if file exists
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            
            # Delete file and metadata
            self.s3_client.delete_objects(
                Bucket=self.bucket_name,
                Delete={
                    "Objects": [
                        {"Key": s3_key},
                        {"Key": metadata_key},
                    ]
                }
            )
            
            return True
            
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise StorageError(f"Failed to delete file from S3: {e}")
    
    async def exists(self, file_id: str) -> bool:
        """Check if a file exists in S3."""
        s3_key = self._get_s3_key(file_id)
        
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise StorageError(f"Failed to check file existence: {e}")
    
    async def list_files(
        self,
        prefix: Optional[str] = None,
        user_id: Optional[str] = None,  # UUID as string
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[StorageMetadata]:
        """List files in S3 with optional filtering."""
        results = []
        
        # Build prefix for S3 listing
        s3_prefix = ""
        if prefix:
            s3_prefix = self._get_s3_key(prefix)
        
        # S3 pagination
        paginator = self.s3_client.get_paginator("list_objects_v2")
        page_iterator = paginator.paginate(
            Bucket=self.bucket_name,
            Prefix=s3_prefix,
            PaginationConfig={
                "MaxItems": limit + offset,
                "PageSize": 1000,
            }
        )
        
        count = 0
        for page in page_iterator:
            if "Contents" not in page:
                continue
            
            for obj in page["Contents"]:
                # Skip metadata files
                if obj["Key"].endswith(".meta.json"):
                    continue
                
                # Skip if we haven't reached offset
                if count < offset:
                    count += 1
                    continue
                
                # Stop if we've reached the limit
                if len(results) >= limit:
                    return results
                
                # Get metadata
                try:
                    metadata_key = f"{obj['Key']}.meta.json"
                    metadata_response = self.s3_client.get_object(
                        Bucket=self.bucket_name,
                        Key=metadata_key
                    )
                    metadata_dict = json.loads(metadata_response["Body"].read())
                    
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
                    
                except ClientError:
                    # Skip files without metadata
                    continue
        
        return results
    
    async def get_metadata(self, file_id: str) -> StorageMetadata:
        """Get metadata for a file."""
        metadata_key = self._get_metadata_key(file_id)
        
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=metadata_key
            )
            metadata_dict = json.loads(response["Body"].read())
            
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
            
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File not found: {file_id}")
            raise StorageError(f"Failed to get metadata: {e}")
    
    async def update_metadata(
        self,
        file_id: str,
        metadata: Dict[str, Any],
        merge: bool = True
    ) -> StorageMetadata:
        """Update metadata for a file."""
        metadata_key = self._get_metadata_key(file_id)
        
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
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=metadata_key,
                Body=json.dumps(existing_dict, indent=2),
                ContentType="application/json",
            )
            
            # Update object tags
            s3_key = self._get_s3_key(file_id)
            new_metadata = await self.get_metadata(file_id)
            tags = self._prepare_s3_tags(new_metadata)
            
            if tags:
                self.s3_client.put_object_tagging(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Tagging={"TagSet": [
                        {"Key": k, "Value": v}
                        for tag in tags.split("&")
                        for k, v in [tag.split("=")]
                    ]}
                )
            
            return new_metadata
            
        except Exception as e:
            raise StorageError(f"Failed to update metadata: {e}")
    
    async def generate_signed_url(
        self,
        file_id: str,
        expires_in: int = 3600,
        method: str = "GET"
    ) -> str:
        """Generate a presigned URL for temporary access."""
        s3_key = self._get_s3_key(file_id)
        
        # Check if file exists
        if not await self.exists(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")
        
        # Map HTTP methods to S3 operations
        operation_map = {
            "GET": "get_object",
            "PUT": "put_object",
            "DELETE": "delete_object",
        }
        
        operation = operation_map.get(method.upper())
        if not operation:
            raise StorageError(f"Unsupported method for signed URL: {method}")
        
        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod=operation,
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key,
                },
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            raise StorageError(f"Failed to generate signed URL: {e}")
    
    async def get_usage_stats(
        self,
        user_id: Optional[str] = None  # UUID as string
    ) -> Dict[str, Any]:
        """Get storage usage statistics."""
        total_size = 0
        total_files = 0
        compression_stats = {t.value: 0 for t in CompressionType}
        
        # List all metadata files
        paginator = self.s3_client.get_paginator("list_objects_v2")
        page_iterator = paginator.paginate(
            Bucket=self.bucket_name,
            Suffix=".meta.json",
        )
        
        for page in page_iterator:
            if "Contents" not in page:
                continue
            
            for obj in page["Contents"]:
                if not obj["Key"].endswith(".meta.json"):
                    continue
                
                try:
                    # Get metadata
                    response = self.s3_client.get_object(
                        Bucket=self.bucket_name,
                        Key=obj["Key"]
                    )
                    metadata_dict = json.loads(response["Body"].read())
                    
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
        
        # Get bucket size (requires CloudWatch metrics or S3 Inventory)
        # This is a simplified version
        bucket_stats = {
            "bucket_name": self.bucket_name,
            "region": self.region,
            "storage_class": self.storage_class,
        }
        
        return {
            "total_files": total_files,
            "total_size": total_size,
            "compression_stats": compression_stats,
            "bucket_stats": bucket_stats,
        }