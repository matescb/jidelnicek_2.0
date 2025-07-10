"""
Tests for validation dependencies functionality.

This module tests:
- All validation dependencies
- Error handling and edge cases
- Integration with FastAPI endpoints
"""

import json
import pytest
from io import BytesIO
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from httpx import AsyncClient
from fastapi import HTTPException, status, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from pydantic import BaseModel, Field, ValidationError

from jidelnicek.core.validation.validation import (
    ValidationDependency,
    FileUploadValidator,
    PermissionValidator,
    RequestValidator,
    ResponseValidator,
    ContentTypeValidator,
    TimestampValidator,
    SchemaValidator,
    validate_json_schema,
    validate_file_upload,
    validate_permissions,
    validate_request_data,
    validate_api_key,
    validate_user_quota,
    require_permission,
    validate_file,
    validate_schema,
    validate_content_type,
    validate_timestamp
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.config import settings


class TestValidationDependency:
    """Test base ValidationDependency class."""
    
    def test_validation_dependency_creation(self):
        """Test creating ValidationDependency."""
        dependency = ValidationDependency("TEST_ERROR")
        assert dependency.error_code == "TEST_ERROR"
    
    def test_validation_dependency_default_error_code(self):
        """Test ValidationDependency with default error code."""
        dependency = ValidationDependency()
        assert dependency.error_code == "VALIDATION_ERROR"
    
    def test_create_error(self):
        """Test creating error with ValidationDependency."""
        dependency = ValidationDependency("CUSTOM_ERROR")
        
        error = dependency.create_error("Test message", [{"field": "test"}])
        
        assert isinstance(error, HTTPException)
        assert error.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert error.detail["error"]["code"] == "CUSTOM_ERROR"
        assert error.detail["error"]["message"] == "Test message"
        assert error.detail["error"]["details"] == [{"field": "test"}]
    
    def test_create_error_no_details(self):
        """Test creating error without details."""
        dependency = ValidationDependency("CUSTOM_ERROR")
        
        error = dependency.create_error("Test message")
        
        assert error.detail["error"]["details"] == []


class TestFileUploadValidator:
    """Test FileUploadValidator dependency."""
    
    @pytest.fixture
    def validator(self):
        """Create FileUploadValidator instance."""
        return FileUploadValidator(
            max_size=1024 * 1024,  # 1MB
            allowed_extensions=[".jpg", ".png", ".pdf"],
            allowed_mime_types=["image/jpeg", "image/png", "application/pdf"],
            require_image=False,
            max_image_dimensions=(1024, 1024),
            min_image_dimensions=(100, 100),
            allowed_image_formats=["JPEG", "PNG"],
            scan_for_malware=False
        )
    
    @pytest.fixture
    def mock_file(self):
        """Create mock upload file."""
        file = Mock(spec=UploadFile)
        file.filename = "test.pdf"
        file.content_type = "application/pdf"
        file.read = AsyncMock(return_value=b"fake_pdf_data")
        file.seek = AsyncMock()
        return file
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_success(self, validator, mock_file):
        """Test successful file validation."""
        result = await validator(mock_file)
        
        assert result == mock_file
        mock_file.read.assert_called_once()
        mock_file.seek.assert_called_once_with(0)
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_no_filename(self, validator):
        """Test file validation with no filename."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = None
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_file)
        
        assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "No file provided" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_empty_filename(self, validator):
        """Test file validation with empty filename."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = ""
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_file)
        
        assert "No file provided" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_file_too_large(self, validator):
        """Test file validation with oversized file."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "large_file.jpg"
        mock_file.content_type = "image/jpeg"
        mock_file.read = AsyncMock(return_value=b"x" * (2 * 1024 * 1024))  # 2MB
        mock_file.seek = AsyncMock()
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_file)
        
        assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "exceeds maximum allowed size" in exc_info.value.detail["error"]["message"]
        
        # Check error details
        details = exc_info.value.detail["error"]["details"]
        assert any(d["field"] == "file_size" for d in details)
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_invalid_extension(self, validator):
        """Test file validation with invalid extension."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.exe"
        mock_file.content_type = "application/x-executable"
        mock_file.read = AsyncMock(return_value=b"fake_data")
        mock_file.seek = AsyncMock()
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_file)
        
        assert "File extension '.exe' not allowed" in exc_info.value.detail["error"]["message"]
        
        # Check error details
        details = exc_info.value.detail["error"]["details"]
        assert any(d["field"] == "extension" for d in details)
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_invalid_mime_type(self, validator):
        """Test file validation with invalid MIME type."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.jpg"
        mock_file.content_type = "text/plain"
        mock_file.read = AsyncMock(return_value=b"fake_data")
        mock_file.seek = AsyncMock()
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_file)
        
        assert "MIME type 'text/plain' not allowed" in exc_info.value.detail["error"]["message"]
        
        # Check error details
        details = exc_info.value.detail["error"]["details"]
        assert any(d["field"] == "mime_type" for d in details)
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_unsafe_filename(self, validator):
        """Test file validation with unsafe filename."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "../../../etc/passwd.pdf"
        mock_file.content_type = "application/pdf"
        mock_file.read = AsyncMock(return_value=b"fake_data")
        mock_file.seek = AsyncMock()
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_file)
        
        assert "contains unsafe characters" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_image_validation_without_pil(self, validator):
        """Test image validation when PIL is not available."""
        validator.require_image = True
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.jpg"
        mock_file.content_type = "image/jpeg"
        mock_file.read = AsyncMock(return_value=b"fake_jpeg_data")
        mock_file.seek = AsyncMock()
        
        with patch('jidelnicek.core.validation.validation.PIL_AVAILABLE', False):
            # Should not raise exception when PIL is not available
            result = await validator(mock_file)
            assert result == mock_file
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_magic_mime_detection(self, validator):
        """Test MIME type detection with magic library."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.pdf"
        mock_file.content_type = "application/octet-stream"  # Wrong content type
        mock_file.read = AsyncMock(return_value=b"fake_pdf_data")
        mock_file.seek = AsyncMock()
        
        with patch('jidelnicek.core.validation.validation.MAGIC_AVAILABLE', True):
            with patch('jidelnicek.core.validation.validation.magic') as mock_magic:
                mock_magic.from_buffer.return_value = "application/pdf"
                
                # Should pass because magic detects correct MIME type
                result = await validator(mock_file)
                assert result == mock_file
    
    @pytest.mark.asyncio
    async def test_file_upload_validator_magic_error(self, validator):
        """Test handling magic library error."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.pdf"
        mock_file.content_type = "application/pdf"
        mock_file.read = AsyncMock(return_value=b"fake_pdf_data")
        mock_file.seek = AsyncMock()
        
        with patch('jidelnicek.core.validation.validation.MAGIC_AVAILABLE', True):
            with patch('jidelnicek.core.validation.validation.magic') as mock_magic:
                mock_magic.from_buffer.side_effect = Exception("Magic error")
                
                # Should fall back to content type header
                result = await validator(mock_file)
                assert result == mock_file
    
    def test_is_safe_filename_valid_names(self, validator):
        """Test is_safe_filename with valid names."""
        valid_names = [
            "document.pdf",
            "image.jpg",
            "file_name.txt",
            "file-name.png",
            "file.name.doc",
            "test123.jpeg"
        ]
        
        for name in valid_names:
            assert validator._is_safe_filename(name) is True
    
    def test_is_safe_filename_invalid_names(self, validator):
        """Test is_safe_filename with invalid names."""
        invalid_names = [
            "",  # Empty
            None,  # None
            "a" * 256,  # Too long
            "../../../etc/passwd",  # Path traversal
            "file/name.txt",  # Contains slash
            "file\\name.txt",  # Contains backslash
            "file\x00name.txt",  # Contains null byte
            "file\x01name.txt",  # Contains control character
            "file<name>.txt",  # Contains angle brackets
            "file:name.txt",  # Contains colon
            "file|name.txt",  # Contains pipe
            "file?name.txt",  # Contains question mark
            "file*name.txt",  # Contains asterisk
            'file"name.txt',  # Contains quote
        ]
        
        for name in invalid_names:
            assert validator._is_safe_filename(name) is False


class TestPermissionValidator:
    """Test PermissionValidator dependency."""
    
    @pytest.fixture
    def validator(self):
        """Create PermissionValidator instance."""
        return PermissionValidator("recipes:read", require_verified=True)
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        user = Mock(spec=AuthUser)
        user.id = uuid4()
        user.email = "test@example.com"
        user.email_verified = True
        user.is_admin = False
        user.role = "user"
        user.is_active = True
        return user
    
    @pytest.fixture
    def mock_admin_user(self):
        """Create mock admin user."""
        user = Mock(spec=AuthUser)
        user.id = uuid4()
        user.email = "admin@example.com"
        user.email_verified = True
        user.is_admin = True
        user.role = "admin"
        user.is_active = True
        return user
    
    @pytest.fixture
    def mock_unverified_user(self):
        """Create mock unverified user."""
        user = Mock(spec=AuthUser)
        user.id = uuid4()
        user.email = "unverified@example.com"
        user.email_verified = False
        user.is_admin = False
        user.role = "user"
        user.is_active = True
        return user
    
    @pytest.mark.asyncio
    async def test_permission_validator_success(self, validator, mock_user):
        """Test successful permission validation."""
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        
        result = await validator(mock_user, mock_db, mock_redis)
        
        assert result == mock_user
    
    @pytest.mark.asyncio
    async def test_permission_validator_unverified_user(self, validator, mock_unverified_user):
        """Test permission validation with unverified user."""
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_unverified_user, mock_db, mock_redis)
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert exc_info.value.detail["error"]["code"] == "EMAIL_NOT_VERIFIED"
    
    @pytest.mark.asyncio
    async def test_permission_validator_admin_user(self, validator, mock_admin_user):
        """Test permission validation with admin user."""
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        
        result = await validator(mock_admin_user, mock_db, mock_redis)
        
        assert result == mock_admin_user
    
    @pytest.mark.asyncio
    async def test_permission_validator_no_verification_required(self, mock_unverified_user):
        """Test permission validation without verification requirement."""
        validator = PermissionValidator("recipes:read", require_verified=False)
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        
        result = await validator(mock_unverified_user, mock_db, mock_redis)
        
        assert result == mock_unverified_user
    
    @pytest.mark.asyncio
    async def test_permission_validator_insufficient_permissions(self, mock_user):
        """Test permission validation with insufficient permissions."""
        validator = PermissionValidator("admin:access", require_verified=False)
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_user, mock_db, mock_redis)
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert exc_info.value.detail["error"]["code"] == "PERMISSION_DENIED"
    
    @pytest.mark.asyncio
    async def test_check_permission_admin_all_permissions(self, validator, mock_admin_user):
        """Test that admin has all permissions."""
        mock_db = Mock(spec=AsyncSession)
        
        permissions = [
            "recipes:read", "recipes:create", "recipes:update", "recipes:delete",
            "users:read", "users:create", "users:update", "users:delete",
            "admin:access", "admin:users", "admin:reports", "admin:system"
        ]
        
        for permission in permissions:
            result = await validator._check_permission(mock_admin_user, permission, mock_db)
            assert result is True
    
    @pytest.mark.asyncio
    async def test_check_permission_user_allowed_permissions(self, validator, mock_user):
        """Test user permissions for allowed operations."""
        mock_db = Mock(spec=AsyncSession)
        
        allowed_permissions = [
            "recipes:read", "recipes:create", "recipes:update", "recipes:delete",
            "menus:read", "orders:read", "orders:create", "orders:update", "orders:cancel",
            "profile:read", "profile:update", "profile:delete"
        ]
        
        for permission in allowed_permissions:
            result = await validator._check_permission(mock_user, permission, mock_db)
            assert result is True
    
    @pytest.mark.asyncio
    async def test_check_permission_user_denied_permissions(self, validator, mock_user):
        """Test user permissions for denied operations."""
        mock_db = Mock(spec=AsyncSession)
        
        denied_permissions = [
            "users:read", "users:create", "users:update", "users:delete",
            "admin:access", "admin:users", "admin:reports", "admin:system",
            "menus:create", "menus:update", "menus:delete"
        ]
        
        for permission in denied_permissions:
            result = await validator._check_permission(mock_user, permission, mock_db)
            assert result is False
    
    @pytest.mark.asyncio
    async def test_check_permission_unknown_permission(self, validator, mock_user):
        """Test unknown permission."""
        mock_db = Mock(spec=AsyncSession)
        
        result = await validator._check_permission(mock_user, "unknown:permission", mock_db)
        assert result is False


class TestRequestValidator:
    """Test RequestValidator dependency."""
    
    class TestSchema(BaseModel):
        name: str = Field(..., min_length=1, max_length=100)
        email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
        age: int = Field(..., ge=0, le=150)
    
    @pytest.fixture
    def validator(self):
        """Create RequestValidator instance."""
        return RequestValidator(
            schema=self.TestSchema,
            validate_json=True,
            max_json_size=1024,
            required_headers=["Content-Type", "Authorization"],
            validate_timestamp=True,
            max_timestamp_age=300
        )
    
    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = Mock(spec=Request)
        request.headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer token123",
            "X-Timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }
        return request
    
    @pytest.mark.asyncio
    async def test_request_validator_success(self, validator, mock_request):
        """Test successful request validation."""
        valid_data = {
            "name": "John Doe",
            "email": "john@example.com",
            "age": 30
        }
        
        mock_request.body = AsyncMock(return_value=json.dumps(valid_data).encode())
        
        result = await validator(mock_request)
        
        assert isinstance(result, self.TestSchema)
        assert result.name == "John Doe"
        assert result.email == "john@example.com"
        assert result.age == 30
    
    @pytest.mark.asyncio
    async def test_request_validator_missing_header(self, validator, mock_request):
        """Test request validation with missing required header."""
        del mock_request.headers["Authorization"]
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Missing required header: Authorization" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_request_validator_invalid_json(self, validator, mock_request):
        """Test request validation with invalid JSON."""
        mock_request.body = AsyncMock(return_value=b"invalid json")
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Invalid JSON format" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_request_validator_schema_validation_error(self, validator, mock_request):
        """Test request validation with schema validation error."""
        invalid_data = {
            "name": "",  # Too short
            "email": "invalid-email",  # Invalid format
            "age": -5  # Too young
        }
        
        mock_request.body = AsyncMock(return_value=json.dumps(invalid_data).encode())
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Request validation failed" in exc_info.value.detail["error"]["message"]
        assert len(exc_info.value.detail["error"]["details"]) > 0
    
    @pytest.mark.asyncio
    async def test_request_validator_body_too_large(self, validator, mock_request):
        """Test request validation with oversized body."""
        large_data = {"data": "x" * 2048}  # Larger than max_json_size
        
        mock_request.body = AsyncMock(return_value=json.dumps(large_data).encode())
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Request body size" in exc_info.value.detail["error"]["message"]
        assert "exceeds maximum allowed size" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_request_validator_empty_body(self, validator, mock_request):
        """Test request validation with empty body."""
        mock_request.body = AsyncMock(return_value=b"")
        
        result = await validator(mock_request)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_request_validator_no_json_validation(self, mock_request):
        """Test request validation without JSON validation."""
        validator = RequestValidator(
            schema=self.TestSchema,
            validate_json=False,
            required_headers=["Content-Type"]
        )
        
        result = await validator(mock_request)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_validate_timestamp_missing_header(self, validator):
        """Test timestamp validation with missing header."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator._validate_timestamp(mock_request)
        
        assert "Missing X-Timestamp header" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_validate_timestamp_too_old(self, validator):
        """Test timestamp validation with old timestamp."""
        old_time = datetime.now(timezone.utc) - timedelta(seconds=400)
        timestamp_str = old_time.isoformat().replace("+00:00", "Z")
        
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": timestamp_str}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator._validate_timestamp(mock_request)
        
        assert "Request timestamp is too old" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_validate_timestamp_future(self, validator):
        """Test timestamp validation with future timestamp."""
        future_time = datetime.now(timezone.utc) + timedelta(seconds=120)
        timestamp_str = future_time.isoformat().replace("+00:00", "Z")
        
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": timestamp_str}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator._validate_timestamp(mock_request)
        
        assert "Request timestamp is in the future" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_validate_timestamp_invalid_format(self, validator):
        """Test timestamp validation with invalid format."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": "invalid-timestamp"}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator._validate_timestamp(mock_request)
        
        assert "Invalid timestamp format" in exc_info.value.detail["error"]["message"]


class TestResponseValidator:
    """Test ResponseValidator dependency."""
    
    class TestResponseSchema(BaseModel):
        id: int
        name: str
        status: str
    
    @pytest.fixture
    def validator(self):
        """Create ResponseValidator instance."""
        return ResponseValidator(self.TestResponseSchema)
    
    def test_response_validator_success(self, validator):
        """Test successful response validation."""
        valid_data = {
            "id": 1,
            "name": "Test Item",
            "status": "active"
        }
        
        result = validator(valid_data)
        
        assert isinstance(result, self.TestResponseSchema)
        assert result.id == 1
        assert result.name == "Test Item"
        assert result.status == "active"
    
    def test_response_validator_validation_error_debug(self, validator):
        """Test response validation error in debug mode."""
        invalid_data = {
            "id": "not_an_int",
            "name": "",
            "status": "active"
        }
        
        with patch.object(settings, 'debug', True):
            with pytest.raises(HTTPException) as exc_info:
                validator(invalid_data)
            
            assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
            assert "Response validation failed" in exc_info.value.detail["error"]["message"]
    
    def test_response_validator_validation_error_production(self, validator):
        """Test response validation error in production mode."""
        invalid_data = {
            "id": "not_an_int",
            "name": "",
            "status": "active"
        }
        
        with patch.object(settings, 'debug', False):
            with pytest.raises(HTTPException) as exc_info:
                validator(invalid_data)
            
            assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert exc_info.value.detail == "Internal server error"


class TestContentTypeValidator:
    """Test ContentTypeValidator dependency."""
    
    @pytest.fixture
    def validator(self):
        """Create ContentTypeValidator instance."""
        return ContentTypeValidator(["application/json", "application/xml"])
    
    @pytest.mark.asyncio
    async def test_content_type_validator_success(self, validator):
        """Test successful content type validation."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-type": "application/json; charset=utf-8"}
        
        # Should not raise exception
        await validator(mock_request)
    
    @pytest.mark.asyncio
    async def test_content_type_validator_invalid(self, validator):
        """Test content type validation with invalid type."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-type": "text/plain"}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Content type 'text/plain' not allowed" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_content_type_validator_missing(self, validator):
        """Test content type validation with missing header."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Content type '' not allowed" in exc_info.value.detail["error"]["message"]


class TestTimestampValidator:
    """Test TimestampValidator dependency."""
    
    @pytest.fixture
    def validator(self):
        """Create TimestampValidator instance."""
        return TimestampValidator(max_age_seconds=300, allow_future=False)
    
    @pytest.mark.asyncio
    async def test_timestamp_validator_success(self, validator):
        """Test successful timestamp validation."""
        current_time = datetime.now(timezone.utc)
        timestamp_str = current_time.isoformat().replace("+00:00", "Z")
        
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": timestamp_str}
        
        result = await validator(mock_request)
        
        assert isinstance(result, datetime)
        assert abs((result - current_time).total_seconds()) < 5  # Allow small difference
    
    @pytest.mark.asyncio
    async def test_timestamp_validator_missing_header(self, validator):
        """Test timestamp validation with missing header."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Missing X-Timestamp header" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_timestamp_validator_too_old(self, validator):
        """Test timestamp validation with old timestamp."""
        old_time = datetime.now(timezone.utc) - timedelta(seconds=400)
        timestamp_str = old_time.isoformat().replace("+00:00", "Z")
        
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": timestamp_str}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Request timestamp is too old" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_timestamp_validator_future_allowed(self):
        """Test timestamp validation with future timestamp allowed."""
        validator = TimestampValidator(max_age_seconds=300, allow_future=True)
        
        future_time = datetime.now(timezone.utc) + timedelta(seconds=120)
        timestamp_str = future_time.isoformat().replace("+00:00", "Z")
        
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": timestamp_str}
        
        result = await validator(mock_request)
        
        assert isinstance(result, datetime)
    
    @pytest.mark.asyncio
    async def test_timestamp_validator_future_not_allowed(self, validator):
        """Test timestamp validation with future timestamp not allowed."""
        future_time = datetime.now(timezone.utc) + timedelta(seconds=120)
        timestamp_str = future_time.isoformat().replace("+00:00", "Z")
        
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": timestamp_str}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Request timestamp is in the future" in exc_info.value.detail["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_timestamp_validator_invalid_format(self, validator):
        """Test timestamp validation with invalid format."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Timestamp": "invalid-timestamp"}
        
        with pytest.raises(HTTPException) as exc_info:
            await validator(mock_request)
        
        assert "Invalid timestamp format" in exc_info.value.detail["error"]["message"]


class TestSchemaValidator:
    """Test SchemaValidator dependency."""
    
    class TestSchema(BaseModel):
        name: str
        value: int
    
    @pytest.fixture
    def validator(self):
        """Create SchemaValidator instance."""
        return SchemaValidator(self.TestSchema)
    
    def test_schema_validator_success(self, validator):
        """Test successful schema validation."""
        valid_data = {"name": "test", "value": 42}
        
        result = validator(valid_data)
        
        assert isinstance(result, self.TestSchema)
        assert result.name == "test"
        assert result.value == 42
    
    def test_schema_validator_validation_error(self, validator):
        """Test schema validation with error."""
        invalid_data = {"name": "test", "value": "not_an_int"}
        
        with pytest.raises(HTTPException) as exc_info:
            validator(invalid_data)
        
        assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Data validation failed" in exc_info.value.detail["error"]["message"]
        assert len(exc_info.value.detail["error"]["details"]) > 0


class TestConvenienceFunctions:
    """Test convenience functions for validation."""
    
    class TestSchema(BaseModel):
        name: str
        age: int
    
    @pytest.mark.asyncio
    async def test_validate_json_schema(self):
        """Test validate_json_schema function."""
        data = {"name": "John", "age": 30}
        
        result = await validate_json_schema(data, self.TestSchema)
        
        assert isinstance(result, self.TestSchema)
        assert result.name == "John"
        assert result.age == 30
    
    @pytest.mark.asyncio
    async def test_validate_file_upload(self):
        """Test validate_file_upload function."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.pdf"
        mock_file.content_type = "application/pdf"
        mock_file.read = AsyncMock(return_value=b"fake_pdf_data")
        mock_file.seek = AsyncMock()
        
        result = await validate_file_upload(
            mock_file,
            max_size=1024 * 1024,
            allowed_extensions=[".pdf"],
            require_image=False
        )
        
        assert result == mock_file
    
    @pytest.mark.asyncio
    async def test_validate_permissions(self):
        """Test validate_permissions function."""
        mock_user = Mock(spec=AuthUser)
        mock_user.email_verified = True
        mock_user.is_admin = True
        
        mock_db = Mock(spec=AsyncSession)
        
        result = await validate_permissions(
            mock_user,
            "admin:access",
            mock_db,
            require_verified=True
        )
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_request_data(self):
        """Test validate_request_data function."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Content-Type": "application/json"}
        mock_request.body = AsyncMock(return_value=json.dumps({"name": "John", "age": 30}).encode())
        
        result = await validate_request_data(
            mock_request,
            self.TestSchema,
            validate_json=True,
            required_headers=["Content-Type"]
        )
        
        assert isinstance(result, self.TestSchema)
        assert result.name == "John"
        assert result.age == 30
    
    @pytest.mark.asyncio
    async def test_validate_api_key_valid(self):
        """Test validate_api_key function with valid key."""
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        mock_redis.sismember = AsyncMock(return_value=False)
        
        result = await validate_api_key(
            "a" * 32,  # 32 character key
            mock_db,
            mock_redis
        )
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_api_key_invalid(self):
        """Test validate_api_key function with invalid key."""
        mock_db = Mock(spec=AsyncSession)
        
        result = await validate_api_key("short", mock_db)
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_validate_api_key_blacklisted(self):
        """Test validate_api_key function with blacklisted key."""
        mock_db = Mock(spec=AsyncSession)
        mock_redis = Mock(spec=Redis)
        mock_redis.sismember = AsyncMock(return_value=True)
        
        result = await validate_api_key(
            "a" * 32,  # 32 character key
            mock_db,
            mock_redis
        )
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_validate_user_quota_within_limit(self):
        """Test validate_user_quota function within limit."""
        mock_user = Mock(spec=AuthUser)
        mock_db = Mock(spec=AsyncSession)
        
        result = await validate_user_quota(
            mock_user,
            "recipes",
            mock_db
        )
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_validate_user_quota_unknown_resource(self):
        """Test validate_user_quota function with unknown resource."""
        mock_user = Mock(spec=AuthUser)
        mock_db = Mock(spec=AsyncSession)
        
        result = await validate_user_quota(
            mock_user,
            "unknown_resource",
            mock_db
        )
        
        assert result is True  # No limit for unknown resource


class TestDependencyFactories:
    """Test dependency factory functions."""
    
    def test_require_permission_factory(self):
        """Test require_permission factory function."""
        dependency = require_permission("admin:access", require_verified=True)
        
        # Should return a Depends object
        assert hasattr(dependency, 'dependency')
        assert isinstance(dependency.dependency, PermissionValidator)
        assert dependency.dependency.required_permission == "admin:access"
        assert dependency.dependency.require_verified is True
    
    def test_validate_file_factory(self):
        """Test validate_file factory function."""
        dependency = validate_file(
            max_size=1024 * 1024,
            allowed_extensions=[".jpg", ".png"],
            require_image=True
        )
        
        # Should return a Depends object
        assert hasattr(dependency, 'dependency')
        assert isinstance(dependency.dependency, FileUploadValidator)
        assert dependency.dependency.max_size == 1024 * 1024
        assert dependency.dependency.allowed_extensions == [".jpg", ".png"]
        assert dependency.dependency.require_image is True
    
    def test_validate_schema_factory(self):
        """Test validate_schema factory function."""
        class TestSchema(BaseModel):
            name: str
        
        dependency = validate_schema(TestSchema)
        
        # Should return a Depends object
        assert hasattr(dependency, 'dependency')
        assert isinstance(dependency.dependency, SchemaValidator)
        assert dependency.dependency.schema == TestSchema
    
    def test_validate_content_type_factory(self):
        """Test validate_content_type factory function."""
        dependency = validate_content_type(["application/json", "application/xml"])
        
        # Should return a Depends object
        assert hasattr(dependency, 'dependency')
        assert isinstance(dependency.dependency, ContentTypeValidator)
        assert dependency.dependency.allowed_types == ["application/json", "application/xml"]
    
    def test_validate_timestamp_factory(self):
        """Test validate_timestamp factory function."""
        dependency = validate_timestamp(max_age_seconds=600, allow_future=True)
        
        # Should return a Depends object
        assert hasattr(dependency, 'dependency')
        assert isinstance(dependency.dependency, TimestampValidator)
        assert dependency.dependency.max_age_seconds == 600
        assert dependency.dependency.allow_future is True