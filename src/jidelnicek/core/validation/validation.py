"""
Validation dependencies for FastAPI endpoints.

This module provides comprehensive validation dependencies for:
- Request data validation
- File upload validation
- Permission validation
- API key validation
- User quota validation
- Content type validation
- Schema validation
"""

import json
import logging
from typing import Optional, Dict, Any, List, Union, Callable, Type, Annotated
from pathlib import Path
from datetime import datetime, timedelta
from uuid import UUID
from io import BytesIO
import mimetypes
import hashlib

from fastapi import Depends, HTTPException, status, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from redis.asyncio import Redis
from pydantic import BaseModel, ValidationError, Field
# Optional dependencies for enhanced validation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None

try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
    magic = None

from jidelnicek.core.dependencies import get_db, get_redis_client
from jidelnicek.core.config import settings
from jidelnicek.core.middleware.validation import ValidationException, FileValidationException
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)


class ValidationDependency:
    """Base class for validation dependencies."""
    
    def __init__(self, error_code: str = "VALIDATION_ERROR"):
        self.error_code = error_code
    
    def create_error(self, message: str, details: Optional[List[Dict[str, Any]]] = None) -> HTTPException:
        """Create a standardized validation error."""
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": self.error_code,
                "message": message,
                "details": details or []
            }
        )


class FileUploadValidator(ValidationDependency):
    """Dependency for validating file uploads."""
    
    def __init__(
        self,
        max_size: Optional[int] = None,
        allowed_extensions: Optional[List[str]] = None,
        allowed_mime_types: Optional[List[str]] = None,
        require_image: bool = False,
        max_image_dimensions: Optional[tuple] = None,
        min_image_dimensions: Optional[tuple] = None,
        allowed_image_formats: Optional[List[str]] = None,
        scan_for_malware: bool = False
    ):
        super().__init__("FILE_VALIDATION_ERROR")
        self.max_size = max_size or settings.max_upload_size
        self.allowed_extensions = allowed_extensions or settings.allowed_upload_extensions
        self.allowed_mime_types = allowed_mime_types or [
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf", "text/plain", "application/json",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]
        self.require_image = require_image
        self.max_image_dimensions = max_image_dimensions or (4096, 4096)
        self.min_image_dimensions = min_image_dimensions or (32, 32)
        self.allowed_image_formats = allowed_image_formats or ["JPEG", "PNG", "GIF", "WEBP"]
        self.scan_for_malware = scan_for_malware
    
    async def __call__(self, file: UploadFile = File(...)) -> UploadFile:
        """Validate uploaded file."""
        if not file.filename:
            raise self.create_error("No file provided")
        
        # Read file content
        content = await file.read()
        await file.seek(0)  # Reset file pointer
        
        # Validate file size
        if len(content) > self.max_size:
            raise self.create_error(
                f"File size {len(content)} bytes exceeds maximum allowed size of {self.max_size} bytes",
                [{"field": "file_size", "value": len(content), "max_allowed": self.max_size}]
            )
        
        # Validate file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in self.allowed_extensions:
            raise self.create_error(
                f"File extension '{file_ext}' not allowed",
                [{"field": "extension", "value": file_ext, "allowed": self.allowed_extensions}]
            )
        
        # Validate MIME type
        mime_type = file.content_type
        if MAGIC_AVAILABLE and magic:
            try:
                mime_type = magic.from_buffer(content, mime=True)
            except Exception as e:
                logger.warning(f"Could not detect MIME type with magic: {e}")
                # Fall back to content type header
                mime_type = file.content_type
        
        if mime_type and mime_type not in self.allowed_mime_types:
            raise self.create_error(
                f"MIME type '{mime_type}' not allowed",
                [{"field": "mime_type", "value": mime_type, "allowed": self.allowed_mime_types}]
            )
        
        # Image-specific validation
        if self.require_image or mime_type.startswith("image/"):
            await self._validate_image(content, file.filename)
        
        # Malware scanning
        if self.scan_for_malware:
            await self._scan_for_malware(content, file.filename)
        
        # Validate filename safety
        if not self._is_safe_filename(file.filename):
            raise self.create_error(
                f"Filename '{file.filename}' contains unsafe characters",
                [{"field": "filename", "value": file.filename}]
            )
        
        return file
    
    async def _validate_image(self, content: bytes, filename: str) -> None:
        """Validate image-specific properties."""
        if not PIL_AVAILABLE or not Image:
            logger.warning("PIL not available, skipping image validation")
            return
        
        try:
            with Image.open(BytesIO(content)) as img:
                # Check image format
                if img.format not in self.allowed_image_formats:
                    raise self.create_error(
                        f"Image format '{img.format}' not allowed",
                        [{"field": "image_format", "value": img.format, "allowed": self.allowed_image_formats}]
                    )
                
                # Check dimensions
                width, height = img.size
                max_width, max_height = self.max_image_dimensions
                min_width, min_height = self.min_image_dimensions
                
                if width > max_width or height > max_height:
                    raise self.create_error(
                        f"Image dimensions {width}x{height} exceed maximum allowed {max_width}x{max_height}",
                        [{"field": "dimensions", "value": f"{width}x{height}", "max_allowed": f"{max_width}x{max_height}"}]
                    )
                
                if width < min_width or height < min_height:
                    raise self.create_error(
                        f"Image dimensions {width}x{height} below minimum required {min_width}x{min_height}",
                        [{"field": "dimensions", "value": f"{width}x{height}", "min_required": f"{min_width}x{min_height}"}]
                    )
        
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise self.create_error(
                f"Invalid image file: {str(e)}",
                [{"field": "image_validation", "error": str(e)}]
            )
    
    async def _scan_for_malware(self, content: bytes, filename: str) -> None:
        """Scan file for malware (placeholder - implement with actual scanner)."""
        # This is a placeholder for malware scanning
        # In production, integrate with ClamAV or similar
        
        # Simple hash-based check against known malware signatures
        file_hash = hashlib.sha256(content).hexdigest()
        
        # Known malware hashes (example - in production use proper malware database)
        known_malware_hashes = set()
        
        if file_hash in known_malware_hashes:
            raise self.create_error(
                "File contains malware",
                [{"field": "malware_scan", "hash": file_hash}]
            )
    
    def _is_safe_filename(self, filename: str) -> bool:
        """Check if filename is safe for storage."""
        if not filename or len(filename) > 255:
            return False
        
        # Check for path traversal attempts
        if ".." in filename or "/" in filename or "\\" in filename:
            return False
        
        # Check for null bytes and control characters
        if any(ord(c) < 32 for c in filename):
            return False
        
        # Check for invalid characters
        invalid_chars = ['<', '>', ':', '"', '|', '?', '*']
        if any(char in filename for char in invalid_chars):
            return False
        
        return True


class PermissionValidator(ValidationDependency):
    """Dependency for validating user permissions."""
    
    def __init__(self, required_permission: str, require_verified: bool = False):
        super().__init__("PERMISSION_DENIED")
        self.required_permission = required_permission
        self.require_verified = require_verified
    
    async def __call__(
        self,
        current_user: AuthUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        redis_client: Optional[Redis] = Depends(get_redis_client)
    ) -> AuthUser:
        """Validate user permissions."""
        # Check if user is verified (if required)
        if self.require_verified and not current_user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "EMAIL_NOT_VERIFIED",
                    "message": "Email verification required for this action"
                }
            )
        
        # Check if user has required permission
        if not await self._check_permission(current_user, self.required_permission, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "PERMISSION_DENIED",
                    "message": f"Permission '{self.required_permission}' required",
                    "details": [{"required_permission": self.required_permission}]
                }
            )
        
        return current_user
    
    async def _check_permission(self, user: AuthUser, permission: str, db: AsyncSession) -> bool:
        """Check if user has the required permission."""
        # Admin has all permissions
        if user.is_admin:
            return True
        
        # Map permissions to roles/conditions
        permission_map = {
            # Recipe permissions
            "recipes:read": True,  # All authenticated users can read recipes
            "recipes:create": True,  # All authenticated users can create recipes
            "recipes:update": lambda u: True,  # Users can update their own recipes
            "recipes:delete": lambda u: True,  # Users can delete their own recipes
            
            # User permissions
            "users:read": lambda u: u.is_admin,
            "users:create": lambda u: u.is_admin,
            "users:update": lambda u: u.is_admin,
            "users:delete": lambda u: u.is_admin,
            
            # Admin permissions
            "admin:access": lambda u: u.is_admin,
            "admin:users": lambda u: u.is_admin,
            "admin:reports": lambda u: u.is_admin,
            "admin:system": lambda u: u.is_admin,
            
            # Menu permissions
            "menus:read": True,
            "menus:create": lambda u: u.is_admin,
            "menus:update": lambda u: u.is_admin,
            "menus:delete": lambda u: u.is_admin,
            
            # Order permissions
            "orders:read": True,
            "orders:create": True,
            "orders:update": lambda u: True,  # Users can update their own orders
            "orders:cancel": lambda u: True,  # Users can cancel their own orders
            
            # Profile permissions
            "profile:read": True,
            "profile:update": True,
            "profile:delete": lambda u: True,  # Users can delete their own profile
        }
        
        permission_check = permission_map.get(permission, False)
        
        if isinstance(permission_check, bool):
            return permission_check
        elif callable(permission_check):
            return permission_check(user)
        else:
            return False


class RequestValidator(ValidationDependency):
    """Dependency for validating request data."""
    
    def __init__(
        self,
        schema: Type[BaseModel],
        validate_json: bool = True,
        max_json_size: Optional[int] = None,
        required_headers: Optional[List[str]] = None,
        validate_timestamp: bool = False,
        max_timestamp_age: int = 300
    ):
        super().__init__("REQUEST_VALIDATION_ERROR")
        self.schema = schema
        self.validate_json = validate_json
        self.max_json_size = max_json_size or 1024 * 1024  # 1MB
        self.required_headers = required_headers or []
        self.validate_timestamp = validate_timestamp
        self.max_timestamp_age = max_timestamp_age
    
    async def __call__(self, request: Request) -> Any:
        """Validate request data."""
        # Validate required headers
        for header in self.required_headers:
            if header not in request.headers:
                raise self.create_error(
                    f"Missing required header: {header}",
                    [{"field": "headers", "missing_header": header}]
                )
        
        # Validate timestamp if required
        if self.validate_timestamp:
            await self._validate_timestamp(request)
        
        # Validate JSON payload if required
        if self.validate_json:
            try:
                body = await request.body()
                if len(body) > self.max_json_size:
                    raise self.create_error(
                        f"Request body size {len(body)} exceeds maximum allowed size of {self.max_json_size}",
                        [{"field": "body_size", "value": len(body), "max_allowed": self.max_json_size}]
                    )
                
                if body:
                    try:
                        json_data = json.loads(body)
                        # Validate against schema
                        return self.schema.model_validate(json_data)
                    except json.JSONDecodeError as e:
                        raise self.create_error(
                            f"Invalid JSON format: {str(e)}",
                            [{"field": "json_format", "error": str(e)}]
                        )
                    except ValidationError as e:
                        raise self.create_error(
                            "Request validation failed",
                            [{"field": err["loc"], "message": err["msg"]} for err in e.errors()]
                        )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                raise self.create_error(f"Error validating request: {str(e)}")
        
        return None
    
    async def _validate_timestamp(self, request: Request) -> None:
        """Validate request timestamp."""
        timestamp_header = request.headers.get("X-Timestamp")
        if not timestamp_header:
            raise self.create_error(
                "Missing X-Timestamp header",
                [{"field": "X-Timestamp", "error": "header_missing"}]
            )
        
        try:
            timestamp = datetime.fromisoformat(timestamp_header.replace("Z", "+00:00"))
            age = (datetime.now().astimezone() - timestamp).total_seconds()
            
            if age > self.max_timestamp_age:
                raise self.create_error(
                    f"Request timestamp is too old. Maximum age: {self.max_timestamp_age} seconds",
                    [{"field": "timestamp", "age": age, "max_age": self.max_timestamp_age}]
                )
            
            if age < -60:  # Allow some clock skew
                raise self.create_error(
                    "Request timestamp is in the future",
                    [{"field": "timestamp", "error": "future_timestamp"}]
                )
        except ValueError:
            raise self.create_error(
                "Invalid timestamp format. Use ISO 8601 format",
                [{"field": "timestamp", "error": "invalid_format"}]
            )


class ResponseValidator(ValidationDependency):
    """Dependency for validating response data."""
    
    def __init__(self, schema: Type[BaseModel]):
        super().__init__("RESPONSE_VALIDATION_ERROR")
        self.schema = schema
    
    def __call__(self, response_data: Any) -> Any:
        """Validate response data."""
        try:
            return self.schema.model_validate(response_data)
        except ValidationError as e:
            logger.error(f"Response validation failed: {e.errors()}")
            if settings.debug:
                raise self.create_error(
                    "Response validation failed",
                    [{"field": err["loc"], "message": err["msg"]} for err in e.errors()]
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Internal server error"
                )


class ContentTypeValidator(ValidationDependency):
    """Dependency for validating request content type."""
    
    def __init__(self, allowed_types: List[str]):
        super().__init__("INVALID_CONTENT_TYPE")
        self.allowed_types = allowed_types
    
    async def __call__(self, request: Request) -> None:
        """Validate request content type."""
        content_type = request.headers.get("content-type", "").split(";")[0].strip()
        
        if content_type not in self.allowed_types:
            raise self.create_error(
                f"Content type '{content_type}' not allowed",
                [{"field": "content_type", "value": content_type, "allowed": self.allowed_types}]
            )


class TimestampValidator(ValidationDependency):
    """Dependency for validating request timestamps."""
    
    def __init__(self, max_age_seconds: int = 300, allow_future: bool = False):
        super().__init__("INVALID_TIMESTAMP")
        self.max_age_seconds = max_age_seconds
        self.allow_future = allow_future
    
    async def __call__(self, request: Request) -> datetime:
        """Validate and return request timestamp."""
        timestamp_header = request.headers.get("X-Timestamp")
        if not timestamp_header:
            raise self.create_error(
                "Missing X-Timestamp header",
                [{"field": "X-Timestamp", "error": "header_missing"}]
            )
        
        try:
            timestamp = datetime.fromisoformat(timestamp_header.replace("Z", "+00:00"))
            now = datetime.now().astimezone()
            age = (now - timestamp).total_seconds()
            
            if age > self.max_age_seconds:
                raise self.create_error(
                    f"Request timestamp is too old. Maximum age: {self.max_age_seconds} seconds",
                    [{"field": "timestamp", "age": age, "max_age": self.max_age_seconds}]
                )
            
            if not self.allow_future and age < -60:  # Allow some clock skew
                raise self.create_error(
                    "Request timestamp is in the future",
                    [{"field": "timestamp", "error": "future_timestamp"}]
                )
            
            return timestamp
        
        except ValueError:
            raise self.create_error(
                "Invalid timestamp format. Use ISO 8601 format",
                [{"field": "timestamp", "error": "invalid_format"}]
            )


class SchemaValidator(ValidationDependency):
    """Dependency for validating data against Pydantic schemas."""
    
    def __init__(self, schema: Type[BaseModel]):
        super().__init__("SCHEMA_VALIDATION_ERROR")
        self.schema = schema
    
    def __call__(self, data: Any) -> Any:
        """Validate data against schema."""
        try:
            return self.schema.model_validate(data)
        except ValidationError as e:
            raise self.create_error(
                "Data validation failed",
                [{"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]} for err in e.errors()]
            )


# Convenience functions for common validation patterns
async def validate_json_schema(data: Dict[str, Any], schema: Type[BaseModel]) -> BaseModel:
    """Validate JSON data against a Pydantic schema."""
    validator = SchemaValidator(schema)
    return validator(data)


async def validate_file_upload(
    file: UploadFile,
    max_size: Optional[int] = None,
    allowed_extensions: Optional[List[str]] = None,
    require_image: bool = False
) -> UploadFile:
    """Validate a file upload."""
    validator = FileUploadValidator(
        max_size=max_size,
        allowed_extensions=allowed_extensions,
        require_image=require_image
    )
    return await validator(file)


async def validate_permissions(
    user: AuthUser,
    required_permission: str,
    db: AsyncSession,
    require_verified: bool = False
) -> bool:
    """Validate user permissions."""
    validator = PermissionValidator(required_permission, require_verified)
    try:
        await validator(user, db, None)
        return True
    except HTTPException:
        return False


async def validate_request_data(
    request: Request,
    schema: Type[BaseModel],
    validate_json: bool = True,
    required_headers: Optional[List[str]] = None
) -> Any:
    """Validate request data."""
    validator = RequestValidator(
        schema=schema,
        validate_json=validate_json,
        required_headers=required_headers
    )
    return await validator(request)


async def validate_api_key(
    api_key: str,
    db: AsyncSession,
    redis_client: Optional[Redis] = None
) -> bool:
    """Validate API key (placeholder for API key validation)."""
    # This is a placeholder - implement actual API key validation
    # In production, check against database of valid API keys
    
    # Simple example validation
    if not api_key or len(api_key) < 32:
        return False
    
    # Check if API key is blacklisted in Redis
    if redis_client:
        try:
            is_blacklisted = await redis_client.sismember("blacklisted_api_keys", api_key)
            if is_blacklisted:
                return False
        except Exception as e:
            logger.warning(f"Error checking API key blacklist: {e}")
    
    return True


async def validate_user_quota(
    user: AuthUser,
    resource_type: str,
    db: AsyncSession,
    redis_client: Optional[Redis] = None
) -> bool:
    """Validate user quota for a resource type."""
    # Define quota limits
    quota_limits = {
        "recipes": 100,
        "uploads": 50,
        "api_requests": 1000,
        "orders": 30
    }
    
    limit = quota_limits.get(resource_type, 0)
    if limit == 0:
        return True  # No limit for this resource type
    
    # Check current usage (this is a simplified example)
    # In production, implement proper quota tracking
    
    try:
        # Count current usage from database
        # This is a placeholder - implement actual counting logic
        current_usage = 0
        
        # Check if user has exceeded quota
        return current_usage < limit
        
    except Exception as e:
        logger.error(f"Error checking user quota: {e}")
        return True  # Allow on error to avoid blocking users


# Dependency factory functions
def require_permission(permission: str, require_verified: bool = False) -> Callable:
    """Factory function to create permission validation dependency."""
    return Depends(PermissionValidator(permission, require_verified))


def validate_file(
    max_size: Optional[int] = None,
    allowed_extensions: Optional[List[str]] = None,
    require_image: bool = False
) -> Callable:
    """Factory function to create file validation dependency."""
    return Depends(FileUploadValidator(
        max_size=max_size,
        allowed_extensions=allowed_extensions,
        require_image=require_image
    ))


def validate_schema(schema: Type[BaseModel]) -> Callable:
    """Factory function to create schema validation dependency."""
    return Depends(SchemaValidator(schema))


def validate_content_type(allowed_types: List[str]) -> Callable:
    """Factory function to create content type validation dependency."""
    return Depends(ContentTypeValidator(allowed_types))


def validate_timestamp(max_age_seconds: int = 300, allow_future: bool = False) -> Callable:
    """Factory function to create timestamp validation dependency."""
    return Depends(TimestampValidator(max_age_seconds, allow_future))


# Convenience type annotations
ValidatedUser = Annotated[AuthUser, Depends(get_current_user)]
ValidatedUserOptional = Annotated[Optional[AuthUser], Depends(get_current_user_optional)]
ValidatedFile = Annotated[UploadFile, Depends(FileUploadValidator())]
ValidatedImageFile = Annotated[UploadFile, Depends(FileUploadValidator(require_image=True))]