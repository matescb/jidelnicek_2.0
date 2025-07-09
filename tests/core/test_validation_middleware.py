"""
Tests for the validation middleware functionality.

This module tests:
- ValidationMiddleware functionality
- Exception handling and error formatting
- File upload validation
- Permission validation
- Request/response validation
"""

import json
import pytest
from io import BytesIO
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

from httpx import AsyncClient
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.datastructures import UploadFile

from jidelnicek.core.middleware.validation import (
    ValidationMiddleware,
    ValidationException,
    FileValidationException,
    format_validation_error,
    create_validation_error_response,
    validation_exception_handler,
    response_validation_exception_handler,
    pydantic_validation_exception_handler,
    custom_validation_exception_handler,
    validate_json_payload,
    validate_content_type,
    validate_request_timestamp
)
from jidelnicek.core.config import settings


class TestValidationException:
    """Test ValidationException class."""
    
    def test_validation_exception_creation(self):
        """Test creating ValidationException with default values."""
        exc = ValidationException("Test error message")
        
        assert exc.message == "Test error message"
        assert exc.errors == []
        assert exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert exc.error_code == "VALIDATION_ERROR"
        assert str(exc) == "Test error message"
    
    def test_validation_exception_with_details(self):
        """Test ValidationException with custom details."""
        errors = [{"field": "email", "message": "Invalid email format"}]
        exc = ValidationException(
            message="Validation failed",
            errors=errors,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="CUSTOM_ERROR"
        )
        
        assert exc.message == "Validation failed"
        assert exc.errors == errors
        assert exc.status_code == status.HTTP_400_BAD_REQUEST
        assert exc.error_code == "CUSTOM_ERROR"
    
    def test_validation_exception_to_dict(self):
        """Test converting ValidationException to dictionary."""
        errors = [{"field": "name", "message": "Name is required"}]
        exc = ValidationException(
            message="Validation error",
            errors=errors,
            error_code="FIELD_ERROR"
        )
        
        result = exc.to_dict()
        
        expected = {
            "error": {
                "code": "FIELD_ERROR",
                "message": "Validation error",
                "details": errors
            }
        }
        
        assert result == expected


class TestFileValidationException:
    """Test FileValidationException class."""
    
    def test_file_validation_exception_basic(self):
        """Test creating FileValidationException with basic info."""
        exc = FileValidationException(
            message="File too large",
            filename="test.jpg",
            file_size=1024000,
            max_size=512000
        )
        
        assert exc.message == "File too large"
        assert exc.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert exc.error_code == "FILE_VALIDATION_ERROR"
        assert len(exc.errors) == 2  # filename and file_size details
    
    def test_file_validation_exception_with_extensions(self):
        """Test FileValidationException with allowed extensions."""
        exc = FileValidationException(
            message="Invalid file type",
            filename="test.txt",
            allowed_extensions=[".jpg", ".png"]
        )
        
        assert exc.message == "Invalid file type"
        assert exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert any(detail["field"] == "allowed_extensions" for detail in exc.errors)
    
    def test_file_validation_exception_to_dict(self):
        """Test converting FileValidationException to dictionary."""
        exc = FileValidationException(
            message="Invalid file",
            filename="test.exe"
        )
        
        result = exc.to_dict()
        
        assert result["error"]["code"] == "FILE_VALIDATION_ERROR"
        assert result["error"]["message"] == "Invalid file"
        assert len(result["error"]["details"]) == 1
        assert result["error"]["details"][0]["field"] == "filename"


class TestValidationMiddleware:
    """Test ValidationMiddleware class."""
    
    @pytest.fixture
    def mock_app(self):
        """Create a mock FastAPI app for testing."""
        app = FastAPI()
        
        @app.get("/test")
        async def test_endpoint():
            return {"message": "success"}
        
        return app
    
    @pytest.fixture
    def middleware(self, mock_app):
        """Create ValidationMiddleware instance."""
        return ValidationMiddleware(
            mock_app,
            max_request_size=1024 * 1024,  # 1MB
            allowed_extensions=[".jpg", ".png", ".pdf"],
            log_validation_errors=True
        )
    
    def test_middleware_initialization(self, middleware):
        """Test middleware initialization."""
        assert middleware.max_request_size == 1024 * 1024
        assert middleware.allowed_extensions == [".jpg", ".png", ".pdf"]
        assert middleware.log_validation_errors is True
    
    @pytest.mark.asyncio
    async def test_validate_request_size_valid(self, middleware):
        """Test request size validation with valid size."""
        request = Mock(spec=Request)
        request.headers = {"content-length": "1024"}
        
        # Should not raise exception
        await middleware._validate_request_size(request)
    
    @pytest.mark.asyncio
    async def test_validate_request_size_too_large(self, middleware):
        """Test request size validation with oversized request."""
        request = Mock(spec=Request)
        request.headers = {"content-length": str(2 * 1024 * 1024)}  # 2MB
        
        with pytest.raises(ValidationException) as exc_info:
            await middleware._validate_request_size(request)
        
        assert exc_info.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert "exceeds maximum allowed size" in exc_info.value.message
    
    @pytest.mark.asyncio
    async def test_validate_request_size_invalid_header(self, middleware):
        """Test request size validation with invalid content-length header."""
        request = Mock(spec=Request)
        request.headers = {"content-length": "invalid"}
        
        with pytest.raises(ValidationException) as exc_info:
            await middleware._validate_request_size(request)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid Content-Length header" in exc_info.value.message
    
    @pytest.mark.asyncio
    async def test_is_multipart_request_true(self, middleware):
        """Test detecting multipart request."""
        request = Mock(spec=Request)
        request.headers = {"content-type": "multipart/form-data; boundary=something"}
        
        result = await middleware._is_multipart_request(request)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_is_multipart_request_false(self, middleware):
        """Test detecting non-multipart request."""
        request = Mock(spec=Request)
        request.headers = {"content-type": "application/json"}
        
        result = await middleware._is_multipart_request(request)
        assert result is False
    
    def test_is_safe_filename_valid(self, middleware):
        """Test safe filename validation with valid names."""
        valid_names = [
            "document.pdf",
            "image.jpg",
            "file_name.txt",
            "file-name.png",
            "file.name.doc"
        ]
        
        for name in valid_names:
            assert middleware._is_safe_filename(name) is True
    
    def test_is_safe_filename_invalid(self, middleware):
        """Test safe filename validation with invalid names."""
        invalid_names = [
            "",  # Empty
            "../../../etc/passwd",  # Path traversal
            "file/name.txt",  # Contains slash
            "file\\name.txt",  # Contains backslash
            "file\x00name.txt",  # Contains null byte
            "file<name>.txt",  # Contains invalid characters
            "file:name.txt",  # Contains colon
            "file|name.txt",  # Contains pipe
            "file?name.txt",  # Contains question mark
            "file*name.txt",  # Contains asterisk
            "a" * 256  # Too long
        ]
        
        for name in invalid_names:
            assert middleware._is_safe_filename(name) is False
    
    @pytest.mark.asyncio
    async def test_validate_single_file_valid(self, middleware):
        """Test validating a single valid file."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.jpg"
        mock_file.size = 1024
        
        # Should not raise exception
        await middleware._validate_single_file(mock_file, "image")
    
    @pytest.mark.asyncio
    async def test_validate_single_file_invalid_extension(self, middleware):
        """Test validating file with invalid extension."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.exe"
        mock_file.size = 1024
        
        with pytest.raises(FileValidationException) as exc_info:
            await middleware._validate_single_file(mock_file, "image")
        
        assert "File extension '.exe' not allowed" in exc_info.value.message
    
    @pytest.mark.asyncio
    async def test_validate_single_file_too_large(self, middleware):
        """Test validating file that's too large."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.jpg"
        mock_file.size = 2 * 1024 * 1024  # 2MB
        
        with pytest.raises(FileValidationException) as exc_info:
            await middleware._validate_single_file(mock_file, "image")
        
        assert "exceeds maximum allowed size" in exc_info.value.message
    
    @pytest.mark.asyncio
    async def test_validate_single_file_unsafe_filename(self, middleware):
        """Test validating file with unsafe filename."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "../../../etc/passwd"
        mock_file.size = 1024
        
        with pytest.raises(FileValidationException) as exc_info:
            await middleware._validate_single_file(mock_file, "image")
        
        assert "Invalid filename" in exc_info.value.message
    
    @pytest.mark.asyncio
    async def test_validate_single_file_empty_filename(self, middleware):
        """Test validating file with empty filename."""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = ""
        
        # Should not raise exception for empty filename
        await middleware._validate_single_file(mock_file, "image")
    
    @pytest.mark.asyncio
    async def test_dispatch_successful_request(self, middleware):
        """Test successful request processing."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-length": "1024"}
        mock_request.state = Mock()
        mock_request.state.request_id = "test-123"
        
        mock_response = Mock()
        mock_call_next = AsyncMock(return_value=mock_response)
        
        result = await middleware.dispatch(mock_request, mock_call_next)
        
        assert result == mock_response
        mock_call_next.assert_called_once_with(mock_request)
    
    @pytest.mark.asyncio
    async def test_dispatch_validation_error(self, middleware):
        """Test request processing with validation error."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-length": str(2 * 1024 * 1024)}  # Too large
        mock_request.state = Mock()
        mock_request.state.request_id = "test-123"
        
        mock_call_next = AsyncMock()
        
        result = await middleware.dispatch(mock_request, mock_call_next)
        
        assert isinstance(result, JSONResponse)
        assert result.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        
        # call_next should not be called due to validation error
        mock_call_next.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_dispatch_http_exception(self, middleware):
        """Test request processing with HTTP exception."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-length": "1024"}
        mock_request.state = Mock()
        mock_request.state.request_id = "test-123"
        
        mock_call_next = AsyncMock(side_effect=HTTPException(status_code=404, detail="Not found"))
        
        with pytest.raises(HTTPException):
            await middleware.dispatch(mock_request, mock_call_next)
    
    @pytest.mark.asyncio
    async def test_dispatch_unexpected_error(self, middleware):
        """Test request processing with unexpected error."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-length": "1024"}
        mock_request.state = Mock()
        mock_request.state.request_id = "test-123"
        
        mock_call_next = AsyncMock(side_effect=Exception("Unexpected error"))
        
        with patch.object(settings, 'debug', False):
            result = await middleware.dispatch(mock_request, mock_call_next)
        
        assert isinstance(result, JSONResponse)
        assert result.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        # Check that error details are hidden in production
        content = json.loads(result.body)
        assert "Internal validation error" in content["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_dispatch_unexpected_error_debug(self, middleware):
        """Test request processing with unexpected error in debug mode."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"content-length": "1024"}
        mock_request.state = Mock()
        mock_request.state.request_id = "test-123"
        
        mock_call_next = AsyncMock(side_effect=Exception("Debug error"))
        
        with patch.object(settings, 'debug', True):
            result = await middleware.dispatch(mock_request, mock_call_next)
        
        assert isinstance(result, JSONResponse)
        assert result.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        # Check that error details are shown in debug mode
        content = json.loads(result.body)
        assert "Debug error" in content["error"]["message"]


class TestUtilityFunctions:
    """Test utility functions for validation."""
    
    def test_format_validation_error_with_errors(self):
        """Test formatting validation error with error details."""
        class MockError:
            def errors(self):
                return [
                    {
                        "loc": ("field", "subfield"),
                        "msg": "Field is required",
                        "type": "value_error.missing",
                        "input": None,
                        "ctx": {"limit_value": 10}
                    }
                ]
        
        error = MockError()
        result = format_validation_error(error)
        
        assert result["error"]["code"] == "VALIDATION_ERROR"
        assert result["error"]["message"] == "Request validation failed"
        assert len(result["error"]["details"]) == 1
        
        detail = result["error"]["details"][0]
        assert detail["field"] == "field.subfield"
        assert detail["message"] == "Field is required"
        assert detail["type"] == "value_error.missing"
        assert detail["input"] is None
        assert detail["context"] == {"limit_value": 10}
    
    def test_format_validation_error_no_errors(self):
        """Test formatting validation error without error details."""
        error = Mock()
        error.errors = Mock(return_value=[])
        
        result = format_validation_error(error)
        
        assert result["error"]["code"] == "VALIDATION_ERROR"
        assert result["error"]["message"] == "Request validation failed"
        assert result["error"]["details"] == []
    
    def test_create_validation_error_response(self):
        """Test creating validation error response."""
        class MockError:
            def errors(self):
                return [
                    {
                        "loc": ("email",),
                        "msg": "Invalid email format",
                        "type": "value_error.email"
                    }
                ]
        
        error = MockError()
        request_id = "test-123"
        
        response = create_validation_error_response(error, request_id)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Check headers
        assert response.headers["X-Request-ID"] == request_id
        
        # Check content
        content = json.loads(response.body)
        assert content["error"]["request_id"] == request_id
        assert len(content["error"]["details"]) == 1
    
    def test_create_validation_error_response_no_request_id(self):
        """Test creating validation error response without request ID."""
        error = Mock()
        error.errors = Mock(return_value=[])
        
        response = create_validation_error_response(error)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "X-Request-ID" not in response.headers
    
    def test_validate_json_payload_valid(self):
        """Test validating valid JSON payload."""
        payload = {
            "name": "test",
            "nested": {
                "value": 123,
                "array": [1, 2, 3]
            }
        }
        
        # Should not raise exception
        validate_json_payload(payload)
    
    def test_validate_json_payload_too_deep(self):
        """Test validating JSON payload that's too deep."""
        # Create deeply nested structure
        payload = {"level": {}}
        current = payload["level"]
        
        for i in range(12):  # Deeper than max_depth of 10
            current["level"] = {}
            current = current["level"]
        
        with pytest.raises(ValidationException) as exc_info:
            validate_json_payload(payload, max_depth=10)
        
        assert "exceeds maximum nesting depth" in exc_info.value.message
        assert exc_info.value.error_code == "JSON_TOO_DEEP"
    
    def test_validate_json_payload_with_arrays(self):
        """Test validating JSON payload with nested arrays."""
        payload = {
            "items": [
                {"data": [1, 2, 3]},
                {"data": [4, 5, 6]}
            ]
        }
        
        # Should not raise exception
        validate_json_payload(payload, max_depth=5)
    
    def test_validate_content_type_valid(self):
        """Test validating valid content type."""
        request = Mock(spec=Request)
        request.headers = {"content-type": "application/json; charset=utf-8"}
        
        allowed_types = ["application/json", "application/xml"]
        
        # Should not raise exception
        validate_content_type(request, allowed_types)
    
    def test_validate_content_type_invalid(self):
        """Test validating invalid content type."""
        request = Mock(spec=Request)
        request.headers = {"content-type": "text/plain"}
        
        allowed_types = ["application/json", "application/xml"]
        
        with pytest.raises(ValidationException) as exc_info:
            validate_content_type(request, allowed_types)
        
        assert "Content type 'text/plain' not allowed" in exc_info.value.message
        assert exc_info.value.error_code == "INVALID_CONTENT_TYPE"
    
    def test_validate_content_type_missing(self):
        """Test validating missing content type."""
        request = Mock(spec=Request)
        request.headers = {}
        
        allowed_types = ["application/json"]
        
        with pytest.raises(ValidationException) as exc_info:
            validate_content_type(request, allowed_types)
        
        assert "Content type '' not allowed" in exc_info.value.message
    
    @pytest.mark.asyncio
    async def test_validate_request_timestamp_valid(self):
        """Test validating valid request timestamp."""
        from datetime import datetime, timezone
        
        # Create timestamp that's 30 seconds old
        timestamp = datetime.now(timezone.utc).replace(microsecond=0)
        timestamp_str = timestamp.isoformat().replace("+00:00", "Z")
        
        request = Mock(spec=Request)
        request.headers = {"X-Timestamp": timestamp_str}
        
        # Should not raise exception
        validate_request_timestamp(request, max_age_seconds=60)
    
    @pytest.mark.asyncio
    async def test_validate_request_timestamp_missing(self):
        """Test validating missing request timestamp."""
        request = Mock(spec=Request)
        request.headers = {}
        
        with pytest.raises(ValidationException) as exc_info:
            validate_request_timestamp(request)
        
        assert "Missing X-Timestamp header" in exc_info.value.message
        assert exc_info.value.error_code == "MISSING_TIMESTAMP"
    
    @pytest.mark.asyncio
    async def test_validate_request_timestamp_too_old(self):
        """Test validating timestamp that's too old."""
        from datetime import datetime, timezone, timedelta
        
        # Create timestamp that's 10 minutes old
        timestamp = datetime.now(timezone.utc) - timedelta(minutes=10)
        timestamp_str = timestamp.isoformat().replace("+00:00", "Z")
        
        request = Mock(spec=Request)
        request.headers = {"X-Timestamp": timestamp_str}
        
        with pytest.raises(ValidationException) as exc_info:
            validate_request_timestamp(request, max_age_seconds=300)  # 5 minutes
        
        assert "Request timestamp is too old" in exc_info.value.message
        assert exc_info.value.error_code == "TIMESTAMP_TOO_OLD"
    
    @pytest.mark.asyncio
    async def test_validate_request_timestamp_future(self):
        """Test validating timestamp that's in the future."""
        from datetime import datetime, timezone, timedelta
        
        # Create timestamp that's 2 minutes in the future
        timestamp = datetime.now(timezone.utc) + timedelta(minutes=2)
        timestamp_str = timestamp.isoformat().replace("+00:00", "Z")
        
        request = Mock(spec=Request)
        request.headers = {"X-Timestamp": timestamp_str}
        
        with pytest.raises(ValidationException) as exc_info:
            validate_request_timestamp(request)
        
        assert "Request timestamp is in the future" in exc_info.value.message
        assert exc_info.value.error_code == "TIMESTAMP_FUTURE"
    
    @pytest.mark.asyncio
    async def test_validate_request_timestamp_invalid_format(self):
        """Test validating timestamp with invalid format."""
        request = Mock(spec=Request)
        request.headers = {"X-Timestamp": "invalid-timestamp"}
        
        with pytest.raises(ValidationException) as exc_info:
            validate_request_timestamp(request)
        
        assert "Invalid timestamp format" in exc_info.value.message
        assert exc_info.value.error_code == "INVALID_TIMESTAMP"


class TestExceptionHandlers:
    """Test exception handlers for FastAPI."""
    
    @pytest.mark.asyncio
    async def test_validation_exception_handler(self):
        """Test validation exception handler."""
        from fastapi.exceptions import RequestValidationError
        
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.request_id = "test-123"
        
        # Create mock validation error
        error = Mock(spec=RequestValidationError)
        error.errors = Mock(return_value=[
            {
                "loc": ("email",),
                "msg": "Invalid email",
                "type": "value_error.email"
            }
        ])
        
        response = await validation_exception_handler(request, error)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.headers["X-Request-ID"] == "test-123"
    
    @pytest.mark.asyncio
    async def test_response_validation_exception_handler_debug(self):
        """Test response validation exception handler in debug mode."""
        from fastapi.exceptions import ResponseValidationError
        
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.request_id = "test-123"
        
        error = Mock(spec=ResponseValidationError)
        error.errors = Mock(return_value=[
            {
                "loc": ("response",),
                "msg": "Invalid response",
                "type": "value_error"
            }
        ])
        
        with patch.object(settings, 'debug', True):
            response = await response_validation_exception_handler(request, error)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_response_validation_exception_handler_production(self):
        """Test response validation exception handler in production mode."""
        from fastapi.exceptions import ResponseValidationError
        
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.request_id = "test-123"
        
        error = Mock(spec=ResponseValidationError)
        error.errors = Mock(return_value=[])
        
        with patch.object(settings, 'debug', False):
            response = await response_validation_exception_handler(request, error)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        # Check that error details are hidden
        content = json.loads(response.body)
        assert content["error"]["code"] == "INTERNAL_SERVER_ERROR"
        assert "Internal server error occurred" in content["error"]["message"]
    
    @pytest.mark.asyncio
    async def test_pydantic_validation_exception_handler(self):
        """Test Pydantic validation exception handler."""
        from pydantic import ValidationError
        
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.request_id = "test-123"
        
        # Create mock Pydantic error
        error = Mock(spec=ValidationError)
        error.errors = Mock(return_value=[
            {
                "loc": ("name",),
                "msg": "String too short",
                "type": "value_error.any_str.min_length"
            }
        ])
        
        response = await pydantic_validation_exception_handler(request, error)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert response.headers["X-Request-ID"] == "test-123"
    
    @pytest.mark.asyncio
    async def test_custom_validation_exception_handler(self):
        """Test custom validation exception handler."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.request_id = "test-123"
        
        exc = ValidationException(
            message="Custom validation error",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="CUSTOM_ERROR"
        )
        
        response = await custom_validation_exception_handler(request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.headers["X-Request-ID"] == "test-123"
        
        content = json.loads(response.body)
        assert content["error"]["code"] == "CUSTOM_ERROR"
        assert content["error"]["message"] == "Custom validation error"
        assert content["error"]["request_id"] == "test-123"