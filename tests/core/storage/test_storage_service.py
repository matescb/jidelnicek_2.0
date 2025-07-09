"""
Tests for the storage service.

This module tests the high-level storage service that manages
file operations, access control, and database integration.
"""

import pytest
import tempfile
import shutil
from io import BytesIO
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from sqlalchemy.orm import Session

from jidelnicek.core.storage.base import CompressionType, StorageError
from jidelnicek.core.storage.service import StorageService, StoredFile
from jidelnicek.core.storage.local import LocalStorageBackend
from jidelnicek.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError


@pytest.fixture
def temp_storage_dir():
    """Create a temporary directory for storage tests."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    db = Mock(spec=Session)
    db.query = Mock()
    db.add = Mock()
    db.commit = Mock()
    db.refresh = Mock()
    db.delete = Mock()
    return db


@pytest.fixture
def local_backend(temp_storage_dir):
    """Create a local storage backend."""
    config = {
        "base_path": temp_storage_dir,
        "compression": "gzip",
        "permissions": 0o600,
        "max_file_size": 10 * 1024 * 1024,
    }
    return LocalStorageBackend(config)


@pytest.fixture
def storage_service(mock_db, local_backend):
    """Create a storage service instance."""
    return StorageService(db=mock_db, backend=local_backend)


@pytest.fixture
def sample_user_id():
    """Generate a sample user UUID."""
    return str(uuid4())


@pytest.fixture
def sample_job_id():
    """Generate a sample job ID."""
    return f"job_{uuid4().hex[:8]}"


class TestStorageService:
    """Test storage service functionality."""
    
    @pytest.mark.asyncio
    async def test_upload_file(self, storage_service, mock_db, sample_user_id, sample_job_id):
        """Test uploading a file through the service."""
        # Prepare test data
        test_data = b"This is test content for upload"
        file_data = BytesIO(test_data)
        filename = "test_document.pdf"
        
        # Mock database operations
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        # Upload file
        stored_file = await storage_service.upload(
            file_data=file_data,
            filename=filename,
            user_id=sample_user_id,
            job_id=sample_job_id,
            content_type="application/pdf",
            compression=CompressionType.GZIP,
            metadata={"source": "test"},
            tags=["test", "document"],
            description="Test document upload",
            is_public=False,
            expires_in_days=30,
        )
        
        # Verify file was stored
        assert stored_file.file_id
        assert stored_file.filename == filename
        assert stored_file.user_id == sample_user_id
        assert stored_file.job_id == sample_job_id
        assert stored_file.content_type == "application/pdf"
        assert stored_file.metadata == {"source": "test"}
        assert stored_file.tags == ["test", "document"]
        assert stored_file.description == "Test document upload"
        assert stored_file.is_public is False
        
        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called()
        mock_db.refresh.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_upload_invalid_filename(self, storage_service):
        """Test uploading with invalid filename."""
        file_data = BytesIO(b"test")
        
        # Test empty filename
        with pytest.raises(ValidationError):
            await storage_service.upload(
                file_data=file_data,
                filename="",
            )
        
        # Test filename with slashes
        with pytest.raises(ValidationError):
            await storage_service.upload(
                file_data=file_data,
                filename="path/to/file.txt",
            )
    
    @pytest.mark.asyncio
    async def test_download_file(self, storage_service, mock_db, sample_user_id):
        """Test downloading a file."""
        # First upload a file
        test_data = b"Download test content"
        file_data = BytesIO(test_data)
        
        stored_file = await storage_service.upload(
            file_data=file_data,
            filename="download_test.txt",
            user_id=sample_user_id,
            content_type="text/plain",
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Download the file
        downloaded_data, db_record = await storage_service.download(
            file_id=stored_file.file_id,
            user_id=sample_user_id,
            check_permissions=True
        )
        
        # Verify content
        content = downloaded_data.read()
        assert content == test_data
        assert db_record.file_id == stored_file.file_id
        
        # Verify access count was incremented
        assert stored_file.access_count == 1
        assert stored_file.last_accessed is not None
    
    @pytest.mark.asyncio
    async def test_download_permission_denied(self, storage_service, mock_db, sample_user_id):
        """Test downloading a file without permission."""
        # Create a mock file owned by different user
        stored_file = StoredFile(
            file_id="test/file.pdf",
            filename="file.pdf",
            content_type="application/pdf",
            storage_backend="local",
            storage_path="/path/to/file",
            file_size=100,
            checksum="abc123",
            user_id="different_user_id",
            is_public=False,
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Try to download with different user
        with pytest.raises(PermissionDeniedError):
            await storage_service.download(
                file_id=stored_file.file_id,
                user_id=sample_user_id,
                check_permissions=True
            )
    
    @pytest.mark.asyncio
    async def test_download_public_file(self, storage_service, mock_db):
        """Test downloading a public file."""
        # First upload a public file
        test_data = b"Public content"
        file_data = BytesIO(test_data)
        
        stored_file = await storage_service.upload(
            file_data=file_data,
            filename="public.txt",
            user_id="owner_id",
            is_public=True,
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Download with different user should work for public file
        downloaded_data, _ = await storage_service.download(
            file_id=stored_file.file_id,
            user_id="different_user",
            check_permissions=True
        )
        
        assert downloaded_data.read() == test_data
    
    @pytest.mark.asyncio
    async def test_delete_file(self, storage_service, mock_db, sample_user_id):
        """Test deleting a file."""
        # First upload a file
        file_data = BytesIO(b"Delete test")
        stored_file = await storage_service.upload(
            file_data=file_data,
            filename="delete_test.txt",
            user_id=sample_user_id,
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Soft delete
        deleted = await storage_service.delete(
            file_id=stored_file.file_id,
            user_id=sample_user_id,
            check_permissions=True,
            soft_delete=True
        )
        
        assert deleted is True
        assert stored_file.is_deleted is True
        assert stored_file.deleted_at is not None
        mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_hard_delete_file(self, storage_service, mock_db, sample_user_id):
        """Test permanently deleting a file."""
        # First upload a file
        file_data = BytesIO(b"Hard delete test")
        stored_file = await storage_service.upload(
            file_data=file_data,
            filename="hard_delete_test.txt",
            user_id=sample_user_id,
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Hard delete
        deleted = await storage_service.delete(
            file_id=stored_file.file_id,
            user_id=sample_user_id,
            check_permissions=True,
            soft_delete=False
        )
        
        assert deleted is True
        mock_db.delete.assert_called_once_with(stored_file)
        mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_list_files(self, storage_service, mock_db, sample_user_id):
        """Test listing files with filters."""
        # Create mock files
        files = [
            StoredFile(
                file_id=f"file{i}",
                filename=f"file{i}.txt",
                content_type="text/plain",
                storage_backend="local",
                storage_path=f"/path/file{i}",
                file_size=100 * i,
                checksum=f"checksum{i}",
                user_id=sample_user_id if i < 3 else "other_user",
                is_public=i % 2 == 0,
                tags=["tag1"] if i < 2 else ["tag2"],
                created_at=datetime.utcnow(),
            )
            for i in range(5)
        ]
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.all.return_value = files[:3]  # Return first 3
        mock_db.query.return_value = mock_query
        
        # List files for user
        user_files = await storage_service.list_files(
            user_id=sample_user_id,
            limit=10,
            offset=0
        )
        
        assert len(user_files) == 3
        mock_db.query.assert_called_with(StoredFile)
    
    @pytest.mark.asyncio
    async def test_update_metadata(self, storage_service, mock_db, sample_user_id):
        """Test updating file metadata."""
        # Create a mock file
        stored_file = StoredFile(
            file_id="test/metadata.txt",
            filename="metadata.txt",
            content_type="text/plain",
            storage_backend="local",
            storage_path="/path/to/file",
            file_size=100,
            checksum="abc123",
            user_id=sample_user_id,
            metadata={"original": "value"},
            tags=["original"],
            created_at=datetime.utcnow(),
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Mock backend update
        with patch.object(storage_service.backend, 'update_metadata', new_callable=AsyncMock):
            # Update metadata
            updated = await storage_service.update_metadata(
                file_id=stored_file.file_id,
                user_id=sample_user_id,
                metadata={"new": "data"},
                tags=["new-tag"],
                description="Updated description",
                is_public=True,
            )
            
            # Verify updates
            assert updated.metadata == {"original": "value", "new": "data"}
            assert "original" in updated.tags
            assert "new-tag" in updated.tags
            assert updated.description == "Updated description"
            assert updated.is_public is True
            assert updated.updated_at is not None
    
    @pytest.mark.asyncio
    async def test_generate_download_url(self, storage_service, mock_db, sample_user_id):
        """Test generating temporary download URLs."""
        # Create a mock file
        stored_file = StoredFile(
            file_id="test/download_url.pdf",
            filename="download_url.pdf",
            content_type="application/pdf",
            storage_backend="local",
            storage_path="/path/to/file",
            file_size=1000,
            checksum="xyz789",
            user_id=sample_user_id,
            is_public=False,
            access_count=0,
            created_at=datetime.utcnow(),
        )
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = stored_file
        mock_db.query.return_value = mock_query
        
        # Mock backend URL generation
        expected_url = "file:///path/to/file"
        with patch.object(storage_service.backend, 'generate_signed_url', 
                         new_callable=AsyncMock, return_value=expected_url):
            # Generate URL
            url = await storage_service.generate_download_url(
                file_id=stored_file.file_id,
                user_id=sample_user_id,
                expires_in=3600,
            )
            
            assert url == expected_url
            assert stored_file.access_count == 1
            assert stored_file.last_accessed is not None
    
    @pytest.mark.asyncio
    async def test_cleanup_expired_files(self, storage_service, mock_db):
        """Test cleaning up expired files."""
        # Create mock expired files
        expired_files = [
            StoredFile(
                file_id=f"expired{i}",
                filename=f"expired{i}.txt",
                content_type="text/plain",
                storage_backend="local",
                storage_path=f"/path/expired{i}",
                file_size=100,
                checksum=f"checksum{i}",
                expires_at=datetime.utcnow() - timedelta(days=1),
                is_deleted=False,
                created_at=datetime.utcnow() - timedelta(days=30),
            )
            for i in range(3)
        ]
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = expired_files
        mock_db.query.return_value = mock_query
        
        # Mock backend delete
        with patch.object(storage_service.backend, 'delete', 
                         new_callable=AsyncMock, return_value=True):
            # Run cleanup
            count = await storage_service.cleanup_expired_files()
            
            assert count == 3
            for file in expired_files:
                assert file.is_deleted is True
                assert file.deleted_at is not None
    
    @pytest.mark.asyncio
    async def test_get_usage_stats(self, storage_service, mock_db, sample_user_id):
        """Test getting storage usage statistics."""
        # Create mock files
        files = [
            StoredFile(
                file_id=f"stats{i}",
                filename=f"stats{i}.txt",
                content_type="text/plain" if i < 2 else "image/png",
                storage_backend="local",
                storage_path=f"/path/stats{i}",
                file_size=1000 * (i + 1),
                checksum=f"checksum{i}",
                user_id=sample_user_id,
                is_public=i == 0,
                created_at=datetime.utcnow(),
            )
            for i in range(3)
        ]
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.all.return_value = files
        mock_db.query.return_value = mock_query
        
        # Mock backend stats
        backend_stats = {
            "total_files": 3,
            "total_size": 6000,
            "compression_stats": {"gzip": 2, "none": 1},
            "disk_total": 100000000,
            "disk_used": 50000000,
            "disk_free": 50000000,
            "disk_percent": 50.0,
        }
        
        with patch.object(storage_service.backend, 'get_usage_stats',
                         new_callable=AsyncMock, return_value=backend_stats):
            # Get stats
            stats = await storage_service.get_usage_stats(user_id=sample_user_id)
            
            assert stats["total_files"] == 3
            assert stats["total_size"] == 6000
            assert stats["public_files"] == 1
            assert stats["files_by_type"]["text"] == 2
            assert stats["files_by_type"]["image"] == 1
            assert stats["disk_percent"] == 50.0
    
    @pytest.mark.asyncio
    async def test_file_id_generation(self, storage_service):
        """Test file ID generation format."""
        # Test with user and job
        file_id = storage_service._generate_file_id(
            user_id="user123",
            job_id="job456",
            filename="test file.pdf"
        )
        
        parts = file_id.split("/")
        assert parts[0] == "exports"
        assert parts[1] == str(datetime.utcnow().year)
        assert parts[2] == f"{datetime.utcnow().month:02d}"
        assert parts[3] == "user123"
        assert parts[4] == "job456"
        assert "test_file.pdf" in parts[5]  # Sanitized filename
        
        # Test without user
        file_id = storage_service._generate_file_id(
            user_id=None,
            job_id="job789",
            filename="anonymous.txt"
        )
        
        parts = file_id.split("/")
        assert parts[3] == "anonymous"
        
        # Test without job
        file_id = storage_service._generate_file_id(
            user_id="user456",
            job_id=None,
            filename="direct.txt"
        )
        
        parts = file_id.split("/")
        assert parts[4] == "direct"