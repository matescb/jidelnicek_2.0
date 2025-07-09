# Storage Module

The storage module provides a secure, scalable file storage solution for the Jídelníček 2.0 application. It supports multiple storage backends (local filesystem, AWS S3, Azure Blob Storage) with a unified interface.

## Features

- **Multiple Storage Backends**: Local filesystem, AWS S3, Azure Blob Storage
- **Automatic Compression**: Support for gzip, bzip2, xz, and zip compression
- **Secure File Access**: User-based access control with public/private file support
- **Metadata Management**: Rich metadata support with tags and custom attributes
- **File Organization**: Hierarchical directory structure by year/month/user/job
- **Temporary URLs**: Generate signed URLs for secure temporary access
- **File Expiration**: Automatic cleanup of expired files
- **Usage Statistics**: Track storage usage per user and overall

## Architecture

```
storage/
├── base.py          # Abstract base classes and interfaces
├── local.py         # Local filesystem implementation
├── s3.py           # AWS S3 implementation
├── azure.py        # Azure Blob Storage implementation
└── service.py      # High-level service with database integration
```

## Usage

### Basic File Upload

```python
from jidelnicek.core.storage.service import StorageService
from jidelnicek.core.storage.base import CompressionType

# Initialize service
storage_service = StorageService(db_session)

# Upload a file
with open("document.pdf", "rb") as f:
    stored_file = await storage_service.upload(
        file_data=f,
        filename="shopping_list.pdf",
        user_id="user123",
        job_id="job456",
        content_type="application/pdf",
        compression=CompressionType.GZIP,
        metadata={"week": "2024-W03"},
        tags=["shopping", "export"],
        description="Weekly shopping list",
        is_public=False,
        expires_in_days=30
    )

print(f"File stored with ID: {stored_file.file_id}")
```

### File Download

```python
# Download a file
file_data, metadata = await storage_service.download(
    file_id="exports/2024/01/user123/job456/file.pdf",
    user_id="user123"
)

# Save to disk
with open("downloaded.pdf", "wb") as f:
    f.write(file_data.read())
```

### Generate Temporary URL

```python
# Generate a signed URL valid for 1 hour
download_url = await storage_service.generate_download_url(
    file_id="exports/2024/01/user123/job456/file.pdf",
    user_id="user123",
    expires_in=3600  # 1 hour
)

print(f"Download URL: {download_url}")
```

### List User Files

```python
# List all files for a user
files = await storage_service.list_files(
    user_id="user123",
    limit=20,
    offset=0
)

for file in files:
    print(f"{file.filename} - {file.file_size} bytes - {file.created_at}")
```

### Update File Metadata

```python
# Update metadata and tags
updated_file = await storage_service.update_metadata(
    file_id="exports/2024/01/user123/job456/file.pdf",
    user_id="user123",
    metadata={"processed": True},
    tags=["reviewed"],
    description="Updated description",
    is_public=True
)
```

### Delete Files

```python
# Soft delete (marks as deleted but keeps file)
await storage_service.delete(
    file_id="exports/2024/01/user123/job456/file.pdf",
    user_id="user123",
    soft_delete=True
)

# Hard delete (permanently removes file)
await storage_service.delete(
    file_id="exports/2024/01/user123/job456/file.pdf",
    user_id="user123",
    soft_delete=False
)
```

### Storage Statistics

```python
# Get usage statistics
stats = await storage_service.get_usage_stats(user_id="user123")
print(f"Total files: {stats['total_files']}")
print(f"Total size: {stats['total_size']} bytes")
print(f"Public files: {stats['public_files']}")
```

## Configuration

### Environment Variables

See `config/storage.example.env` for detailed configuration examples.

**Local Storage**:
```env
STORAGE_BACKEND=local
STORAGE_LOCAL_PATH=/var/lib/jidelnicek/storage
STORAGE_COMPRESSION=gzip
STORAGE_MAX_FILE_SIZE=104857600
```

**AWS S3**:
```env
STORAGE_BACKEND=s3
STORAGE_S3_BUCKET=jidelnicek-exports
STORAGE_S3_REGION=eu-central-1
STORAGE_S3_ACCESS_KEY=your-access-key
STORAGE_S3_SECRET_KEY=your-secret-key
```

**Azure Blob Storage**:
```env
STORAGE_BACKEND=azure
STORAGE_AZURE_CONNECTION_STRING=your-connection-string
STORAGE_AZURE_CONTAINER=jidelnicek-exports
```

## File Organization

Files are organized in a hierarchical structure:

```
exports/
├── {year}/
│   ├── {month}/
│   │   ├── {user_id}/
│   │   │   ├── {job_id}/
│   │   │   │   ├── {timestamp}_{uuid}_{filename}
│   │   │   │   └── {timestamp}_{uuid}_{filename}.meta.json
│   │   │   └── direct/          # Files without job context
│   │   └── anonymous/           # Files without user context
```

Example:
- `exports/2024/01/user123/job456/20240115_143022_a1b2c3d4_shopping_list.pdf`

## Security Considerations

1. **Access Control**: Files are protected by user ownership. Only file owners can access private files.
2. **Path Validation**: File IDs are validated to prevent path traversal attacks.
3. **Secure Storage**: Files are stored with restricted permissions (0600 for local storage).
4. **Temporary URLs**: Use signed URLs for temporary access without exposing permanent links.
5. **Checksum Verification**: All files have SHA-256 checksums for integrity verification.

## Compression

The storage module supports automatic compression with the following algorithms:

- **gzip**: Fast compression, good for general use (default)
- **bzip2**: Better compression ratio, slower
- **xz**: Best compression ratio, slowest
- **zip**: Compatible with standard ZIP tools
- **none**: No compression

Compression is transparent - files are automatically compressed on upload and decompressed on download.

## Database Schema

The `stored_files` table tracks all stored files:

```sql
CREATE TABLE stored_files (
    id INTEGER PRIMARY KEY,
    file_id VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    storage_backend VARCHAR(50) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    original_size INTEGER,
    checksum VARCHAR(64) NOT NULL,
    compression VARCHAR(20) DEFAULT 'none',
    user_id VARCHAR(36) REFERENCES auth_users(id),
    job_id VARCHAR(255) REFERENCES jobs(task_id),
    is_public BOOLEAN DEFAULT FALSE,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
```

## Error Handling

The storage module uses specific exceptions:

- `StorageError`: General storage operation errors
- `FileNotFoundError`: File doesn't exist
- `StoragePermissionError`: Access denied or file exists
- `StorageQuotaExceededError`: Storage quota exceeded
- `ValidationError`: Invalid input parameters
- `NotFoundError`: Database record not found
- `PermissionDeniedError`: Access control violation

## Performance Tips

1. **Compression**: Use gzip for balanced speed/size. Use none for already compressed files (images, PDFs).
2. **Batch Operations**: Use `list_files` with pagination for large file sets.
3. **Caching**: File metadata is cached in the database for fast queries.
4. **Async Operations**: All storage operations are async for better concurrency.

## Testing

Run storage tests:

```bash
pytest tests/core/storage/test_local_storage.py -v
pytest tests/core/storage/test_storage_service.py -v
```

## Extending Storage Backends

To add a new storage backend:

1. Create a new file in `storage/` (e.g., `gcs.py` for Google Cloud Storage)
2. Inherit from `StorageBackend` base class
3. Implement all abstract methods
4. Add configuration handling in `StorageService._create_backend()`
5. Add configuration validation in `Settings.validate_configuration()`

Example skeleton:

```python
from .base import StorageBackend, StorageMetadata

class GCSStorageBackend(StorageBackend):
    """Google Cloud Storage backend."""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        # Initialize GCS client
    
    async def store(self, file_id: str, file_data: BinaryIO, 
                   metadata: StorageMetadata, overwrite: bool = False) -> str:
        # Implement file storage
        pass
    
    # Implement other required methods...
```