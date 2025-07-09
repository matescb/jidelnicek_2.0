"""
Validation middleware for FastAPI request/response validation.

This module provides comprehensive validation middleware for handling:
- Request payload validation
- Response validation
- Custom validation errors
- File upload validation
- Request size limits
"""

import json
import logging
from typing import Optional, Dict, Any, Union, List
from pathlib import Path
from datetime import datetime

from fastapi import Request, Response, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.encoders import jsonable_encoder
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import UploadFile
from pydantic import ValidationError

from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class ValidationException(Exception):
    """Custom exception for validation errors."""
    
    def __init__(
        self,
        message: str,
        errors: Optional[List[Dict[str, Any]]] = None,
        status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code: str = "VALIDATION_ERROR"
    ):
        self.message = message
        self.errors = errors or []
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            "error": {
                "code": self.error_code,
                "message": self.message,
                "details": self.errors
            }
        }


class FileValidationException(ValidationException):
    """Exception for file upload validation errors."""
    
    def __init__(
        self,
        message: str,
        filename: Optional[str] = None,
        file_size: Optional[int] = None,
        max_size: Optional[int] = None,
        allowed_extensions: Optional[List[str]] = None
    ):
        details = []
        if filename:
            details.append({"field": "filename", "value": filename})
        if file_size and max_size:
            details.append({
                "field": "file_size",
                "value": file_size,
                "max_allowed": max_size
            })
        if allowed_extensions:
            details.append({
                "field": "allowed_extensions",
                "value": allowed_extensions
            })
        
        super().__init__(
            message=message,
            errors=details,
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if file_size and max_size and file_size > max_size else status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="FILE_VALIDATION_ERROR"
        )


class ValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for comprehensive request/response validation.
    
    Features:
    - Request size validation
    - File upload validation
    - Custom error formatting
    - Request/response logging
    """
    
    def __init__(
        self,
        app,
        max_request_size: int = settings.max_upload_size,
        allowed_extensions: Optional[List[str]] = None,
        log_validation_errors: bool = True
    ):
        super().__init__(app)
        self.max_request_size = max_request_size
        self.allowed_extensions = allowed_extensions or settings.allowed_upload_extensions
        self.log_validation_errors = log_validation_errors
    
    async def dispatch(self, request: Request, call_next):
        """Process request and response with validation."""
        request_id = getattr(request.state, "request_id", "unknown")
        
        try:
            # Validate request size
            await self._validate_request_size(request)
            
            # Validate file uploads if present
            if await self._is_multipart_request(request):
                await self._validate_file_uploads(request)
            
            # Process request
            response = await call_next(request)
            
            # Log successful validation
            if self.log_validation_errors:
                logger.debug(f"Request {request_id}: Validation passed")
            
            return response
            
        except ValidationException as e:
            # Handle custom validation errors
            if self.log_validation_errors:
                logger.warning(f"Request {request_id}: Validation failed - {e.message}")
            
            return JSONResponse(
                status_code=e.status_code,
                content=e.to_dict(),
                headers={"X-Request-ID": request_id}
            )
        
        except HTTPException as e:
            # Re-raise HTTP exceptions
            raise e
        
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Request {request_id}: Unexpected validation error - {str(e)}", exc_info=True)
            
            if settings.debug:
                error_detail = str(e)
            else:
                error_detail = "Internal validation error"
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": {
                        "code": "VALIDATION_MIDDLEWARE_ERROR",
                        "message": error_detail,
                        "request_id": request_id
                    }
                },
                headers={"X-Request-ID": request_id}
            )
    
    async def _validate_request_size(self, request: Request) -> None:
        """Validate that request size doesn't exceed limit."""
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > self.max_request_size:
                    raise ValidationException(
                        message=f"Request size {size} bytes exceeds maximum allowed size of {self.max_request_size} bytes",
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        error_code="REQUEST_TOO_LARGE"
                    )
            except ValueError:
                raise ValidationException(
                    message="Invalid Content-Length header",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error_code="INVALID_CONTENT_LENGTH"
                )
    
    async def _is_multipart_request(self, request: Request) -> bool:
        """Check if request contains multipart/form-data."""
        content_type = request.headers.get("content-type", "")
        return content_type.startswith("multipart/form-data")
    
    async def _validate_file_uploads(self, request: Request) -> None:
        """Validate file uploads in multipart requests."""
        try:
            # Get form data
            form = await request.form()
            
            for field_name, field_value in form.items():
                if isinstance(field_value, UploadFile):
                    await self._validate_single_file(field_value, field_name)
        
        except Exception as e:
            logger.error(f"Error validating file uploads: {str(e)}")
            raise ValidationException(
                message="Error processing file uploads",
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="FILE_UPLOAD_ERROR"
            )
    
    async def _validate_single_file(self, file: UploadFile, field_name: str) -> None:
        """Validate a single uploaded file."""
        if not file.filename:
            return  # Skip empty files
        
        # Validate file extension
        if self.allowed_extensions:
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in self.allowed_extensions:
                raise FileValidationException(
                    message=f"File extension '{file_ext}' not allowed for field '{field_name}'",
                    filename=file.filename,
                    allowed_extensions=self.allowed_extensions
                )
        
        # Validate file size
        if hasattr(file, 'size') and file.size:
            if file.size > self.max_request_size:
                raise FileValidationException(
                    message=f"File '{file.filename}' size exceeds maximum allowed size",
                    filename=file.filename,
                    file_size=file.size,
                    max_size=self.max_request_size
                )
        
        # Validate filename
        if not self._is_safe_filename(file.filename):
            raise FileValidationException(
                message=f"Invalid filename '{file.filename}' for field '{field_name}'",
                filename=file.filename
            )
    
    def _is_safe_filename(self, filename: str) -> bool:
        """Check if filename is safe for storage."""
        if not filename:
            return False
        
        # Check for path traversal attempts
        if ".." in filename or "/" in filename or "\\" in filename:
            return False
        
        # Check for null bytes
        if "\x00" in filename:
            return False
        
        # Check length
        if len(filename) > 255:
            return False
        
        # Check for invalid characters
        invalid_chars = ['<', '>', ':', '"', '|', '?', '*']
        if any(char in filename for char in invalid_chars):
            return False
        
        return True


def format_validation_error(error: Union[RequestValidationError, ResponseValidationError, ValidationError]) -> Dict[str, Any]:
    """
    Format validation errors into a consistent structure.
    
    Args:
        error: The validation error to format
        
    Returns:
        Formatted error dictionary
    """
    error_details = []
    
    if hasattr(error, 'errors'):
        for err in error.errors():
            error_detail = {
                "field": ".".join(str(loc) for loc in err.get("loc", [])),
                "message": err.get("msg", "Validation error"),
                "type": err.get("type", "validation_error"),
                "input": err.get("input")
            }
            
            # Add context if available
            if "ctx" in err:
                error_detail["context"] = err["ctx"]
            
            error_details.append(error_detail)
    
    return {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "details": error_details
        }
    }


def create_validation_error_response(
    error: Union[RequestValidationError, ResponseValidationError, ValidationError],
    request_id: Optional[str] = None
) -> JSONResponse:
    """
    Create a standardized validation error response.
    
    Args:
        error: The validation error
        request_id: Optional request ID for tracking
        
    Returns:
        JSON response with formatted error
    """
    formatted_error = format_validation_error(error)
    
    if request_id:
        formatted_error["error"]["request_id"] = request_id
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=formatted_error,
        headers={"X-Request-ID": request_id} if request_id else None
    )


# Exception handlers for FastAPI
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.warning(f"Request {request_id}: Validation error - {exc.errors()}")
    
    return create_validation_error_response(exc, request_id)


async def response_validation_exception_handler(request: Request, exc: ResponseValidationError) -> JSONResponse:
    """Handle FastAPI response validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.error(f"Request {request_id}: Response validation error - {exc.errors()}")
    
    # Don't expose internal response validation errors to users
    if settings.debug:
        return create_validation_error_response(exc, request_id)
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Internal server error occurred",
                    "request_id": request_id
                }
            },
            headers={"X-Request-ID": request_id}
        )


async def pydantic_validation_exception_handler(request: Request, exc: ValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.warning(f"Request {request_id}: Pydantic validation error - {exc.errors()}")
    
    return create_validation_error_response(exc, request_id)


async def custom_validation_exception_handler(request: Request, exc: ValidationException) -> JSONResponse:
    """Handle custom validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.warning(f"Request {request_id}: Custom validation error - {exc.message}")
    
    response_data = exc.to_dict()
    if request_id:
        response_data["error"]["request_id"] = request_id
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_data,
        headers={"X-Request-ID": request_id}
    )


# Utility functions for validation
def validate_json_payload(payload: Any, max_depth: int = 10) -> None:
    """
    Validate JSON payload structure and depth.
    
    Args:
        payload: The payload to validate
        max_depth: Maximum allowed nesting depth
        
    Raises:
        ValidationException: If validation fails
    """
    def _check_depth(obj, current_depth=0):
        if current_depth > max_depth:
            raise ValidationException(
                message=f"JSON payload exceeds maximum nesting depth of {max_depth}",
                error_code="JSON_TOO_DEEP"
            )
        
        if isinstance(obj, dict):
            for value in obj.values():
                _check_depth(value, current_depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                _check_depth(item, current_depth + 1)
    
    try:
        _check_depth(payload)
    except RecursionError:
        raise ValidationException(
            message="JSON payload contains circular references",
            error_code="JSON_CIRCULAR_REFERENCE"
        )


def validate_content_type(request: Request, allowed_types: List[str]) -> None:
    """
    Validate request content type.
    
    Args:
        request: The request to validate
        allowed_types: List of allowed content types
        
    Raises:
        ValidationException: If content type is not allowed
    """
    content_type = request.headers.get("content-type", "").split(";")[0].strip()
    
    if content_type not in allowed_types:
        raise ValidationException(
            message=f"Content type '{content_type}' not allowed. Allowed types: {allowed_types}",
            error_code="INVALID_CONTENT_TYPE"
        )


def validate_request_timestamp(request: Request, max_age_seconds: int = 300) -> None:
    """
    Validate request timestamp to prevent replay attacks.
    
    Args:
        request: The request to validate
        max_age_seconds: Maximum age of request in seconds
        
    Raises:
        ValidationException: If timestamp is invalid or too old
    """
    timestamp_header = request.headers.get("X-Timestamp")
    if not timestamp_header:
        raise ValidationException(
            message="Missing X-Timestamp header",
            error_code="MISSING_TIMESTAMP"
        )
    
    try:
        timestamp = datetime.fromisoformat(timestamp_header.replace("Z", "+00:00"))
        age = (datetime.now().astimezone() - timestamp).total_seconds()
        
        if age > max_age_seconds:
            raise ValidationException(
                message=f"Request timestamp is too old. Maximum age: {max_age_seconds} seconds",
                error_code="TIMESTAMP_TOO_OLD"
            )
        
        if age < -60:  # Allow some clock skew
            raise ValidationException(
                message="Request timestamp is in the future",
                error_code="TIMESTAMP_FUTURE"
            )
    
    except ValueError:
        raise ValidationException(
            message="Invalid timestamp format. Use ISO 8601 format",
            error_code="INVALID_TIMESTAMP"
        )