"""
Integration examples showing how to use validation in endpoints.

This module provides practical examples of how to integrate the validation
system into FastAPI endpoints, including:
- File upload validation
- Request/response validation
- Permission validation
- Custom validation scenarios
"""

import json
import pytest
from io import BytesIO
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any
from uuid import uuid4

from httpx import AsyncClient
from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from jidelnicek.core.validation.validation import (
    FileUploadValidator,
    PermissionValidator,
    RequestValidator,
    ContentTypeValidator,
    TimestampValidator,
    SchemaValidator,
    require_permission,
    validate_file,
    validate_content_type,
    validate_timestamp,
    validate_schema
)
from jidelnicek.core.middleware.validation import ValidationMiddleware
from jidelnicek.auth.models import AuthUser


class TestValidationIntegrationExamples:
    """Examples of validation integration in endpoints."""
    
    def test_file_upload_endpoint_example(self):
        """Example of file upload validation in an endpoint."""
        app = FastAPI()
        
        # Custom file validator for profile images
        profile_image_validator = FileUploadValidator(
            max_size=2 * 1024 * 1024,  # 2MB
            allowed_extensions=['.jpg', '.jpeg', '.png'],
            require_image=True,
            max_image_dimensions=(1024, 1024),
            min_image_dimensions=(100, 100)
        )
        
        @app.post("/profile/avatar")
        async def upload_avatar(
            file: UploadFile = Depends(profile_image_validator),
            current_user: AuthUser = Depends(require_permission("profile:update"))
        ):
            """Upload user avatar with validation."""
            # File is already validated by the dependency
            return {
                "message": "Avatar uploaded successfully",
                "filename": file.filename,
                "size": len(await file.read()),
                "user_id": str(current_user.id)
            }
        
        # Test that the endpoint is properly structured
        assert "/profile/avatar" in [route.path for route in app.routes]
    
    def test_request_validation_endpoint_example(self):
        """Example of request validation in an endpoint."""
        app = FastAPI()
        
        class CreateUserRequest(BaseModel):
            email: str = Field(..., regex=r'^[^@]+@[^@]+\.[^@]+$')
            name: str = Field(..., min_length=2, max_length=100)
            age: int = Field(..., ge=13, le=120)
            preferences: Dict[str, Any] = Field(default_factory=dict)
        
        # Custom request validator
        user_request_validator = RequestValidator(
            schema=CreateUserRequest,
            validate_json=True,
            max_json_size=1024 * 10,  # 10KB
            required_headers=["Content-Type", "Accept"],
            validate_timestamp=True,
            max_timestamp_age=60
        )
        
        @app.post("/users")
        async def create_user(
            user_data: CreateUserRequest = Depends(user_request_validator),
            current_user: AuthUser = Depends(require_permission("users:create"))
        ):
            """Create user with comprehensive validation."""
            # Request data is already validated
            return {
                "message": "User created successfully",
                "user_data": user_data.dict(),
                "created_by": str(current_user.id)
            }
        
        # Test that the endpoint is properly structured
        assert "/users" in [route.path for route in app.routes]
    
    def test_content_type_validation_example(self):
        """Example of content type validation."""
        app = FastAPI()
        
        @app.post("/api/data")
        async def process_data(
            request: Request,
            _: None = Depends(validate_content_type(["application/json", "application/xml"]))
        ):
            """Process data with content type validation."""
            # Content type is already validated
            return {"message": "Data processed successfully"}
        
        # Test that the endpoint is properly structured
        assert "/api/data" in [route.path for route in app.routes]
    
    def test_timestamp_validation_example(self):
        """Example of timestamp validation for API security."""
        app = FastAPI()
        
        @app.post("/api/secure-endpoint")
        async def secure_endpoint(
            request: Request,
            timestamp = Depends(validate_timestamp(max_age_seconds=300, allow_future=False))
        ):
            """Secure endpoint with timestamp validation."""
            # Timestamp is already validated
            return {
                "message": "Secure operation completed",
                "timestamp": timestamp.isoformat()
            }
        
        # Test that the endpoint is properly structured
        assert "/api/secure-endpoint" in [route.path for route in app.routes]
    
    def test_schema_validation_example(self):
        """Example of schema validation for complex data."""
        app = FastAPI()
        
        class ComplexDataSchema(BaseModel):
            operation: str = Field(..., regex=r'^(create|update|delete)$')
            data: Dict[str, Any]
            metadata: Dict[str, str] = Field(default_factory=dict)
            
            class Config:
                extra = "forbid"  # Forbid extra fields
        
        @app.post("/api/complex-operation")
        async def complex_operation(
            validated_data: ComplexDataSchema = Depends(validate_schema(ComplexDataSchema))
        ):
            """Complex operation with schema validation."""
            # Data is already validated against schema
            return {
                "message": "Complex operation completed",
                "operation": validated_data.operation,
                "data_keys": list(validated_data.data.keys())
            }
        
        # Test that the endpoint is properly structured
        assert "/api/complex-operation" in [route.path for route in app.routes]
    
    def test_combined_validation_example(self):
        """Example of combining multiple validation types."""
        app = FastAPI()
        
        class ArticleCreateRequest(BaseModel):
            title: str = Field(..., min_length=5, max_length=200)
            content: str = Field(..., min_length=10)
            tags: list[str] = Field(default_factory=list)
            is_published: bool = Field(default=False)
        
        # Multiple validation layers
        article_validator = RequestValidator(
            schema=ArticleCreateRequest,
            validate_json=True,
            required_headers=["Content-Type"],
            validate_timestamp=True
        )
        
        article_image_validator = FileUploadValidator(
            max_size=5 * 1024 * 1024,  # 5MB
            allowed_extensions=['.jpg', '.jpeg', '.png'],
            require_image=True
        )
        
        @app.post("/articles")
        async def create_article(
            article_data: ArticleCreateRequest = Depends(article_validator),
            featured_image: UploadFile = Depends(article_image_validator),
            current_user: AuthUser = Depends(require_permission("articles:create", require_verified=True)),
            _: None = Depends(validate_content_type(["application/json"]))
        ):
            """Create article with comprehensive validation."""
            return {
                "message": "Article created successfully",
                "article": article_data.dict(),
                "image_filename": featured_image.filename,
                "author_id": str(current_user.id)
            }
        
        # Test that the endpoint is properly structured
        assert "/articles" in [route.path for route in app.routes]
    
    def test_middleware_integration_example(self):
        """Example of integrating validation middleware."""
        app = FastAPI()
        
        # Add validation middleware
        app.add_middleware(
            ValidationMiddleware,
            max_request_size=10 * 1024 * 1024,  # 10MB
            allowed_extensions=['.jpg', '.jpeg', '.png', '.pdf'],
            log_validation_errors=True
        )
        
        @app.post("/upload")
        async def upload_file(file: UploadFile = File(...)):
            """Upload file with middleware validation."""
            # File is pre-validated by middleware
            return {
                "message": "File uploaded successfully",
                "filename": file.filename
            }
        
        # Test that middleware is properly configured
        middleware_classes = [type(middleware).__name__ for middleware in app.user_middleware]
        assert "ValidationMiddleware" in middleware_classes
    
    def test_custom_validation_dependency_example(self):
        """Example of creating custom validation dependency."""
        app = FastAPI()
        
        class CustomBusinessValidator:
            """Custom business logic validator."""
            
            def __init__(self, required_role: str):
                self.required_role = required_role
            
            async def __call__(
                self,
                current_user: AuthUser = Depends(require_permission("business:access")),
                db: AsyncSession = Depends(lambda: None)  # Mock dependency
            ):
                """Validate business-specific requirements."""
                # Custom validation logic
                if current_user.role != self.required_role:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "error": {
                                "code": "INSUFFICIENT_BUSINESS_ROLE",
                                "message": f"Required role: {self.required_role}, current role: {current_user.role}"
                            }
                        }
                    )
                
                return current_user
        
        # Use custom validator
        manager_validator = CustomBusinessValidator("manager")
        
        @app.post("/business/manager-action")
        async def manager_action(
            current_user: AuthUser = Depends(manager_validator)
        ):
            """Manager-only action with custom validation."""
            return {
                "message": "Manager action completed",
                "user_id": str(current_user.id),
                "role": current_user.role
            }
        
        # Test that the endpoint is properly structured
        assert "/business/manager-action" in [route.path for route in app.routes]
    
    def test_error_handling_example(self):
        """Example of comprehensive error handling with validation."""
        app = FastAPI()
        
        class DataProcessingRequest(BaseModel):
            operation: str = Field(..., regex=r'^(analyze|transform|export)$')
            data: Dict[str, Any]
            options: Dict[str, Any] = Field(default_factory=dict)
        
        @app.post("/data/process")
        async def process_data(
            request_data: DataProcessingRequest = Depends(validate_schema(DataProcessingRequest)),
            current_user: AuthUser = Depends(require_permission("data:process"))
        ):
            """Process data with comprehensive error handling."""
            try:
                # Simulate data processing
                if request_data.operation == "analyze":
                    if not request_data.data:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "error": {
                                    "code": "EMPTY_DATA",
                                    "message": "Data cannot be empty for analysis"
                                }
                            }
                        )
                
                return {
                    "message": f"Data {request_data.operation} completed successfully",
                    "operation": request_data.operation,
                    "data_size": len(request_data.data),
                    "processed_by": str(current_user.id)
                }
                
            except Exception as e:
                # Handle unexpected errors
                if isinstance(e, HTTPException):
                    raise e
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error": {
                            "code": "PROCESSING_ERROR",
                            "message": "An error occurred during data processing"
                        }
                    }
                )
        
        # Test that the endpoint is properly structured
        assert "/data/process" in [route.path for route in app.routes]
    
    def test_validation_performance_example(self):
        """Example of optimized validation for performance."""
        app = FastAPI()
        
        # Cached validation dependencies
        class CachedValidator:
            """Validation with caching for performance."""
            
            def __init__(self):
                self._cache = {}
            
            async def __call__(self, request: Request):
                """Validate with caching."""
                # Simple cache key based on request
                cache_key = f"{request.method}:{request.url.path}"
                
                if cache_key in self._cache:
                    # Return cached validation result
                    return self._cache[cache_key]
                
                # Perform validation
                result = {"validated": True, "cached": False}
                
                # Cache result
                self._cache[cache_key] = result
                
                return result
        
        cached_validator = CachedValidator()
        
        @app.get("/cached-endpoint")
        async def cached_endpoint(
            validation_result: Dict[str, Any] = Depends(cached_validator)
        ):
            """Endpoint with cached validation."""
            return {
                "message": "Cached validation completed",
                "validation_result": validation_result
            }
        
        # Test that the endpoint is properly structured
        assert "/cached-endpoint" in [route.path for route in app.routes]
    
    def test_validation_testing_example(self):
        """Example of testing validation in endpoints."""
        app = FastAPI()
        
        class TestableValidator:
            """Validator designed for easy testing."""
            
            def __init__(self, fail_validation: bool = False):
                self.fail_validation = fail_validation
            
            async def __call__(self, request: Request):
                """Validate with controllable failure."""
                if self.fail_validation:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "error": {
                                "code": "TEST_VALIDATION_ERROR",
                                "message": "Test validation failed"
                            }
                        }
                    )
                
                return {"test_validation": "passed"}
        
        # Create testable endpoints
        success_validator = TestableValidator(fail_validation=False)
        failure_validator = TestableValidator(fail_validation=True)
        
        @app.post("/test/success")
        async def test_success(
            result: Dict[str, Any] = Depends(success_validator)
        ):
            """Test endpoint that should succeed."""
            return {"status": "success", "validation": result}
        
        @app.post("/test/failure")
        async def test_failure(
            result: Dict[str, Any] = Depends(failure_validator)
        ):
            """Test endpoint that should fail validation."""
            return {"status": "failure", "validation": result}
        
        # Test that the endpoints are properly structured
        test_paths = ["/test/success", "/test/failure"]
        endpoint_paths = [route.path for route in app.routes]
        
        for path in test_paths:
            assert path in endpoint_paths


class TestValidationUsagePatterns:
    """Examples of common validation usage patterns."""
    
    def test_api_versioning_validation(self):
        """Example of validation for API versioning."""
        app = FastAPI()
        
        class APIVersionValidator:
            """Validate API version compatibility."""
            
            def __init__(self, supported_versions: list[str]):
                self.supported_versions = supported_versions
            
            async def __call__(self, request: Request):
                """Validate API version."""
                api_version = request.headers.get("API-Version", "v1")
                
                if api_version not in self.supported_versions:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "error": {
                                "code": "UNSUPPORTED_API_VERSION",
                                "message": f"API version {api_version} is not supported",
                                "supported_versions": self.supported_versions
                            }
                        }
                    )
                
                return {"api_version": api_version}
        
        version_validator = APIVersionValidator(["v1", "v2"])
        
        @app.get("/api/data")
        async def get_data(
            version_info: Dict[str, str] = Depends(version_validator)
        ):
            """Get data with version validation."""
            return {
                "data": "sample data",
                "api_version": version_info["api_version"]
            }
        
        # Test that the endpoint is properly structured
        assert "/api/data" in [route.path for route in app.routes]
    
    def test_rate_limiting_validation(self):
        """Example of rate limiting validation."""
        app = FastAPI()
        
        class RateLimitValidator:
            """Validate rate limiting."""
            
            def __init__(self, max_requests_per_minute: int):
                self.max_requests_per_minute = max_requests_per_minute
                self._requests = {}  # In-memory storage for demo
            
            async def __call__(self, request: Request):
                """Validate rate limit."""
                client_ip = request.client.host
                current_time = int(request.state.get("timestamp", 0))
                
                # Simple rate limiting logic
                if client_ip in self._requests:
                    if self._requests[client_ip] >= self.max_requests_per_minute:
                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail={
                                "error": {
                                    "code": "RATE_LIMIT_EXCEEDED",
                                    "message": f"Rate limit exceeded. Maximum {self.max_requests_per_minute} requests per minute"
                                }
                            }
                        )
                
                # Update request count
                self._requests[client_ip] = self._requests.get(client_ip, 0) + 1
                
                return {"rate_limit_remaining": self.max_requests_per_minute - self._requests[client_ip]}
        
        rate_limiter = RateLimitValidator(max_requests_per_minute=100)
        
        @app.get("/api/limited")
        async def limited_endpoint(
            rate_info: Dict[str, int] = Depends(rate_limiter)
        ):
            """Rate limited endpoint."""
            return {
                "message": "Request processed",
                "rate_limit_remaining": rate_info["rate_limit_remaining"]
            }
        
        # Test that the endpoint is properly structured
        assert "/api/limited" in [route.path for route in app.routes]
    
    def test_conditional_validation(self):
        """Example of conditional validation based on user context."""
        app = FastAPI()
        
        class ConditionalValidator:
            """Validate based on user conditions."""
            
            def __init__(self, admin_bypass: bool = True):
                self.admin_bypass = admin_bypass
            
            async def __call__(
                self,
                request: Request,
                current_user: AuthUser = Depends(require_permission("basic:access"))
            ):
                """Conditionally validate based on user role."""
                # Admin users bypass certain validations
                if self.admin_bypass and current_user.is_admin:
                    return {"validation": "bypassed", "reason": "admin_user"}
                
                # Regular validation for non-admin users
                content_length = request.headers.get("content-length", "0")
                if int(content_length) > 1024:  # 1KB limit for regular users
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail={
                            "error": {
                                "code": "REQUEST_TOO_LARGE",
                                "message": "Request size exceeds limit for regular users"
                            }
                        }
                    )
                
                return {"validation": "passed", "user_type": "regular"}
        
        conditional_validator = ConditionalValidator(admin_bypass=True)
        
        @app.post("/api/conditional")
        async def conditional_endpoint(
            validation_result: Dict[str, str] = Depends(conditional_validator)
        ):
            """Endpoint with conditional validation."""
            return {
                "message": "Request processed",
                "validation_result": validation_result
            }
        
        # Test that the endpoint is properly structured
        assert "/api/conditional" in [route.path for route in app.routes]