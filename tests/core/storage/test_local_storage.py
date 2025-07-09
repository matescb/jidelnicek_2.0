"""
Tests for local filesystem storage backend.

This module tests the LocalStorageBackend implementation
including file operations, compression, and metadata management.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from io import BytesIO
from datetime import datetime
import gzip
import json

from jidelnicek.core.storage.base import (
    CompressionType, StorageMetadata, StorageError,
    FileNotFoundError, StoragePermissionError
)
from jidelnicek.core.storage.local import LocalStorageBackend


@pytest.fixture
def temp_storage_dir():
    """Create a temporary directory for storage tests."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def local_storage(temp_storage_dir):
    """Create a LocalStorageBackend instance."""
    config = {
        "base_path": temp_storage_dir,
        "compression": "gzip",
        "permissions": 0o600,
        "max_file_size": 10 * 1024 * 1024,  # 10MB
    }
    return LocalStorageBackend(config)


@pytest.fixture
def sample_metadata():
    """Create sample metadata for testing."""
    return StorageMetadata(
        file_id="exports/2024/01/user123/job456/test.pdf",
        filename="test.pdf",
        content_type="application/pdf",
        size=0,  # Will be updated
        checksum="",  # Will be calculated
        created_at=datetime.utcnow(),
        user_id="user123",
        job_id="job456",
        compression=CompressionType.GZIP,
        metadata={"test": "value"},
        tags=["export", "pdf"],
    )


class TestLocalStorageBackend:
    """Test local storage backend functionality."""
    
    @pytest.mark.asyncio
    async def test_store_file(self, local_storage, sample_metadata):
        """Test storing a file."""
        # Prepare test data
        test_data = b"This is test content for the file"
        file_data = BytesIO(test_data)
        
        # Store file
        storage_path = await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=False
        )
        
        # Verify file was stored
        assert storage_path
        assert Path(storage_path).exists()
        
        # Verify metadata was stored
        metadata_path = Path(storage_path).with_suffix(".pdf.meta.json")
        assert metadata_path.exists()
        
        # Verify metadata content
        with open(metadata_path) as f:
            stored_metadata = json.load(f)
        
        assert stored_metadata["file_id"] == sample_metadata.file_id
        assert stored_metadata["filename"] == sample_metadata.filename
        assert stored_metadata["checksum"]  # Should be calculated
        assert stored_metadata["size"] > 0  # Should be compressed size
        assert stored_metadata["original_size"] == len(test_data)
    
    @pytest.mark.asyncio
    async def test_store_file_overwrite_protection(self, local_storage, sample_metadata):
        """Test that overwrite protection works."""
        test_data = b"Original content"
        file_data = BytesIO(test_data)
        
        # Store file first time
        await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=False
        )
        
        # Try to store again without overwrite
        file_data.seek(0)
        with pytest.raises(StoragePermissionError):
            await local_storage.store(
                file_id=sample_metadata.file_id,
                file_data=file_data,
                metadata=sample_metadata,
                overwrite=False
            )
        
        # Store with overwrite should work
        file_data.seek(0)
        await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=True
        )
    
    @pytest.mark.asyncio
    async def test_retrieve_file(self, local_storage, sample_metadata):
        """Test retrieving a stored file."""
        # Store a file first
        test_data = b"This is test content for retrieval"
        file_data = BytesIO(test_data)
        
        await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=False
        )
        
        # Retrieve the file
        retrieved_data, retrieved_metadata = await local_storage.retrieve(
            file_id=sample_metadata.file_id
        )
        
        # Verify content
        content = retrieved_data.read()
        assert content == test_data
        
        # Verify metadata
        assert retrieved_metadata.file_id == sample_metadata.file_id
        assert retrieved_metadata.filename == sample_metadata.filename
        assert retrieved_metadata.checksum
        assert retrieved_metadata.compression == CompressionType.GZIP
    
    @pytest.mark.asyncio
    async def test_retrieve_nonexistent_file(self, local_storage):
        """Test retrieving a file that doesn't exist."""
        with pytest.raises(FileNotFoundError):
            await local_storage.retrieve("nonexistent/file.pdf")
    
    @pytest.mark.asyncio
    async def test_delete_file(self, local_storage, sample_metadata):
        """Test deleting a file."""
        # Store a file first
        test_data = b"File to be deleted"
        file_data = BytesIO(test_data)
        
        storage_path = await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=False
        )
        
        # Verify file exists
        assert Path(storage_path).exists()
        
        # Delete the file
        deleted = await local_storage.delete(sample_metadata.file_id)
        assert deleted is True
        
        # Verify file is gone
        assert not Path(storage_path).exists()
        
        # Delete again should return False
        deleted = await local_storage.delete(sample_metadata.file_id)
        assert deleted is False
    
    @pytest.mark.asyncio
    async def test_exists(self, local_storage, sample_metadata):
        """Test checking if a file exists."""
        # Check non-existent file
        exists = await local_storage.exists(sample_metadata.file_id)
        assert exists is False
        
        # Store a file
        test_data = b"File existence test"
        file_data = BytesIO(test_data)
        
        await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=False
        )
        
        # Check existing file
        exists = await local_storage.exists(sample_metadata.file_id)
        assert exists is True
    
    @pytest.mark.asyncio
    async def test_compression_types(self, local_storage, sample_metadata):
        """Test different compression types."""
        test_data = b"A" * 1000  # Repetitive data for good compression
        
        compression_types = [
            CompressionType.NONE,
            CompressionType.GZIP,
            CompressionType.BZIP2,
            CompressionType.XZ,
            CompressionType.ZIP,
        ]
        
        for compression_type in compression_types:
            file_id = f"test/compression/{compression_type.value}.txt"
            metadata = StorageMetadata(
                file_id=file_id,
                filename=f"{compression_type.value}.txt",
                content_type="text/plain",
                size=0,
                checksum="",
                created_at=datetime.utcnow(),
                compression=compression_type,
            )
            
            # Store with specific compression
            file_data = BytesIO(test_data)
            await local_storage.store(
                file_id=file_id,
                file_data=file_data,
                metadata=metadata,
                overwrite=False
            )
            
            # Retrieve and verify
            retrieved_data, retrieved_metadata = await local_storage.retrieve(file_id)
            assert retrieved_data.read() == test_data
            assert retrieved_metadata.compression == compression_type
            
            # Check compression effectiveness
            if compression_type != CompressionType.NONE:
                assert retrieved_metadata.size < retrieved_metadata.original_size
    
    @pytest.mark.asyncio
    async def test_list_files(self, local_storage):
        """Test listing files with filtering."""
        # Store multiple files
        file_ids = [
            "exports/2024/01/user123/job1/file1.pdf",
            "exports/2024/01/user123/job2/file2.pdf",
            "exports/2024/01/user456/job3/file3.pdf",
            "exports/2024/02/user123/job4/file4.pdf",
        ]
        
        for file_id in file_ids:
            metadata = StorageMetadata(
                file_id=file_id,
                filename=Path(file_id).name,
                content_type="application/pdf",
                size=0,
                checksum="",
                created_at=datetime.utcnow(),
                user_id=file_id.split("/")[3],
                job_id=file_id.split("/")[4],
            )
            
            file_data = BytesIO(b"Test content")
            await local_storage.store(
                file_id=file_id,
                file_data=file_data,
                metadata=metadata,
                overwrite=False
            )
        
        # List all files
        all_files = await local_storage.list_files()
        assert len(all_files) == 4
        
        # List with prefix
        jan_files = await local_storage.list_files(prefix="exports/2024/01/")
        assert len(jan_files) == 3
        
        # List by user
        user123_files = await local_storage.list_files(user_id="user123")
        assert len(user123_files) == 3
        
        # List by job
        job1_files = await local_storage.list_files(job_id="job1")
        assert len(job1_files) == 1
        
        # Test pagination
        page1 = await local_storage.list_files(limit=2, offset=0)
        assert len(page1) == 2
        
        page2 = await local_storage.list_files(limit=2, offset=2)
        assert len(page2) == 2
    
    @pytest.mark.asyncio
    async def test_update_metadata(self, local_storage, sample_metadata):
        """Test updating file metadata."""
        # Store a file
        test_data = b"Metadata update test"
        file_data = BytesIO(test_data)
        
        await local_storage.store(
            file_id=sample_metadata.file_id,
            file_data=file_data,
            metadata=sample_metadata,
            overwrite=False
        )
        
        # Update metadata
        new_metadata = {
            "metadata": {"updated": True, "version": 2},
            "tags": ["new-tag"],
        }
        
        updated = await local_storage.update_metadata(
            file_id=sample_metadata.file_id,
            metadata=new_metadata,
            merge=True
        )
        
        # Verify merge
        assert updated.metadata["test"] == "value"  # Original preserved
        assert updated.metadata["updated"] is True  # New added
        assert "export" in updated.tags  # Original preserved
        assert "new-tag" in updated.tags  # New added
        assert updated.updated_at is not None
    
    @pytest.mark.asyncio
    async def test_get_usage_stats(self, local_storage):
        """Test getting storage usage statistics."""
        # Store some files
        for i in range(3):
            metadata = StorageMetadata(
                file_id=f"test/stats/file{i}.txt",
                filename=f"file{i}.txt",
                content_type="text/plain",
                size=0,
                checksum="",
                created_at=datetime.utcnow(),
                user_id="user123" if i < 2 else "user456",
                compression=CompressionType.GZIP if i < 2 else CompressionType.NONE,
            )
            
            file_data = BytesIO(b"X" * 100)
            await local_storage.store(
                file_id=metadata.file_id,
                file_data=file_data,
                metadata=metadata,
                overwrite=False
            )
        
        # Get overall stats
        stats = await local_storage.get_usage_stats()
        assert stats["total_files"] == 3
        assert stats["total_size"] > 0
        assert stats["compression_stats"]["gzip"] == 2
        assert stats["compression_stats"]["none"] == 1
        
        # Get user-specific stats
        user_stats = await local_storage.get_usage_stats(user_id="user123")
        assert user_stats["total_files"] == 2
    
    @pytest.mark.asyncio
    async def test_invalid_file_id(self, local_storage):
        """Test validation of file IDs."""
        invalid_ids = [
            "",  # Empty
            "../etc/passwd",  # Path traversal
            "/absolute/path",  # Absolute path
            "x" * 300,  # Too long
        ]
        
        for invalid_id in invalid_ids:
            with pytest.raises(StorageError, match="Invalid file ID"):
                metadata = StorageMetadata(
                    file_id=invalid_id,
                    filename="test.txt",
                    content_type="text/plain",
                    size=0,
                    checksum="",
                    created_at=datetime.utcnow(),
                )
                
                file_data = BytesIO(b"test")
                await local_storage.store(
                    file_id=invalid_id,
                    file_data=file_data,
                    metadata=metadata,
                    overwrite=False
                )
    
    @pytest.mark.asyncio
    async def test_max_file_size(self, local_storage):
        """Test maximum file size limit."""
        # Try to store a file that's too large
        large_data = b"X" * (11 * 1024 * 1024)  # 11MB
        file_data = BytesIO(large_data)
        
        metadata = StorageMetadata(
            file_id="test/large_file.bin",
            filename="large_file.bin",
            content_type="application/octet-stream",
            size=0,
            checksum="",
            created_at=datetime.utcnow(),
        )
        
        with pytest.raises(StorageError, match="exceeds maximum"):
            await local_storage.store(
                file_id=metadata.file_id,
                file_data=file_data,
                metadata=metadata,
                overwrite=False
            )