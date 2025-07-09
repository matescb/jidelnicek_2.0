# Validation Dependencies and Middleware

This directory contains the comprehensive validation system for the Jídelníček 2.0 API, providing request/response validation, file upload validation, and permission checking.

## Overview

The validation system consists of:

1. **Validation Middleware** (`validation.py` in middleware/) - Handles request-level validation
2. **Validation Dependencies** (`validation.py`) - Provides endpoint-level validation dependencies
3. **Exception Handlers** - Format validation errors consistently

## Key Features

### 🔒 Security Validation
- File upload validation with malware scanning
- Permission-based access control
- API key validation
- Request timestamp validation
- Content type validation

### 📁 File Upload Validation
- File size limits
- Extension whitelist
- MIME type validation
- Image dimension validation
- Malware scanning
- Filename sanitization

### 🔑 Permission Validation
- Role-based access control
- Resource-specific permissions
- Email verification requirements
- User quota validation

### 📊 Request/Response Validation
- Schema validation with Pydantic
- JSON structure validation
- Content type validation
- Request size limits
- Response validation

## Usage Examples

### Basic File Upload Validation

```python
from fastapi import UploadFile
from jidelnicek.core.dependencies.validation import validate_file

@router.post("/upload/image")
async def upload_image(
    file: UploadFile = validate_file(
        max_size=5 * 1024 * 1024,  # 5MB
        allowed_extensions=[".jpg", ".jpeg", ".png"],
        require_image=True
    )
):
    return {"filename": file.filename, "size": file.size}
```

### Permission-Based Access Control

```python
from jidelnicek.core.dependencies.validation import require_permission

@router.get("/admin/users")
async def get_users(
    user: AuthUser = require_permission("admin:users", require_verified=True)
):
    return {"message": f"Hello admin {user.display_name}!"}
```

### Schema Validation

```python
from pydantic import BaseModel
from jidelnicek.core.dependencies.validation import validate_schema

class CreateRecipeRequest(BaseModel):
    title: str
    ingredients: List[str]
    prep_time_minutes: int

@router.post("/recipes")
async def create_recipe(
    data: CreateRecipeRequest = validate_schema(CreateRecipeRequest)
):
    return {"message": "Recipe created", "data": data}
```

### Multiple Validation Dependencies

```python
@router.post("/complex/operation")
async def complex_operation(
    user: AuthUser = require_permission("admin:system", require_verified=True),
    file: UploadFile = validate_file(max_size=50 * 1024 * 1024),
    _: None = validate_content_type(["multipart/form-data"]),
    timestamp: datetime = validate_timestamp(max_age_seconds=300)
):
    return {"message": "Operation completed"}
```

## Available Dependencies

### File Validation Dependencies

#### `FileUploadValidator`
Comprehensive file upload validation with image processing support.

```python
file_validator = FileUploadValidator(
    max_size=10 * 1024 * 1024,  # 10MB
    allowed_extensions=[".jpg", ".png", ".pdf"],
    allowed_mime_types=["image/jpeg", "image/png", "application/pdf"],
    require_image=True,
    max_image_dimensions=(4096, 4096),
    min_image_dimensions=(32, 32),
    scan_for_malware=True
)
```

#### `validate_file()` Factory Function
Convenient factory function for file validation.

```python
validate_file(
    max_size=None,
    allowed_extensions=None,
    require_image=False
)
```

### Permission Validation Dependencies

#### `PermissionValidator`
Role-based permission checking.

```python
permission_validator = PermissionValidator(
    required_permission="recipes:create",
    require_verified=True
)
```

#### `require_permission()` Factory Function
Convenient factory function for permission validation.

```python
require_permission(
    permission="admin:users",
    require_verified=False
)
```

### Request Validation Dependencies

#### `RequestValidator`
Comprehensive request validation including JSON schema validation.

```python
request_validator = RequestValidator(
    schema=MySchema,
    validate_json=True,
    max_json_size=1024 * 1024,  # 1MB
    required_headers=["X-API-Key"],
    validate_timestamp=True,
    max_timestamp_age=300  # 5 minutes
)
```

#### `ContentTypeValidator`
Validates request content type.

```python
content_type_validator = ContentTypeValidator(
    allowed_types=["application/json", "multipart/form-data"]
)
```

#### `TimestampValidator`
Validates request timestamps to prevent replay attacks.

```python
timestamp_validator = TimestampValidator(
    max_age_seconds=300,
    allow_future=False
)
```

### Schema Validation Dependencies

#### `SchemaValidator`
Validates data against Pydantic schemas.

```python
schema_validator = SchemaValidator(schema=MySchema)
```

## Error Handling

### Validation Exceptions

The system provides structured error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "file_size",
        "message": "File too large",
        "value": 10485760,
        "max_allowed": 5242880
      }
    ],
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Custom Validation Exceptions

```python
from jidelnicek.core.middleware.validation import ValidationException

raise ValidationException(
    message="Custom validation failed",
    errors=[{"field": "custom_field", "message": "Invalid value"}],
    status_code=422,
    error_code="CUSTOM_VALIDATION_ERROR"
)
```

## Configuration

### Environment Variables

The validation system uses the following configuration from `settings`:

```python
# File Upload Settings
max_upload_size: int = 10485760  # 10MB
allowed_upload_extensions: List[str] = [".jpg", ".png", ".pdf"]
upload_path: str = "uploads"
secure_uploads: bool = True

# Security Settings
csrf_enabled: bool = True
rate_limit_enabled: bool = True
hsts_enabled: bool = True

# Validation Settings
debug: bool = False  # Controls error detail exposure
```

### Middleware Configuration

The `ValidationMiddleware` is configured in `main.py`:

```python
app.add_middleware(
    ValidationMiddleware,
    max_request_size=settings.max_upload_size,
    allowed_extensions=settings.allowed_upload_extensions,
    log_validation_errors=not settings.is_production
)
```

## Best Practices

### 1. Layer Your Validation

Use multiple validation layers for comprehensive protection:

```python
@router.post("/secure/upload")
async def secure_upload(
    # Permission validation
    user: AuthUser = require_permission("files:upload", require_verified=True),
    
    # File validation
    file: UploadFile = validate_file(
        max_size=10 * 1024 * 1024,
        allowed_extensions=[".jpg", ".png"],
        require_image=True
    ),
    
    # Content type validation
    _: None = validate_content_type(["multipart/form-data"]),
    
    # Timestamp validation
    timestamp: datetime = validate_timestamp(max_age_seconds=300)
):
    return {"message": "File uploaded securely"}
```

### 2. Use Type Annotations

Leverage the provided type annotations for better IDE support:

```python
from jidelnicek.core.dependencies.validation import (
    ValidatedUser,
    ValidatedFile,
    ValidatedImageFile
)

@router.post("/upload")
async def upload(
    user: ValidatedUser = Depends(),
    file: ValidatedImageFile = Depends()
):
    return {"user_id": user.id, "filename": file.filename}
```

### 3. Handle Validation Errors Gracefully

Provide meaningful error messages to API consumers:

```python
try:
    validated_data = await validate_request_data(request, MySchema)
except ValidationException as e:
    # Log the error
    logger.warning(f"Validation failed: {e.message}")
    
    # Return user-friendly error
    return JSONResponse(
        status_code=e.status_code,
        content=e.to_dict()
    )
```

### 4. Implement Custom Validation Logic

For complex business rules, implement custom validation:

```python
@router.post("/custom/validation")
async def custom_validation(
    request: Request,
    user: ValidatedUser = Depends()
):
    # Custom business logic validation
    if user.subscription_level == "basic" and await get_user_quota(user.id) > 100:
        raise ValidationException(
            message="Basic subscription users are limited to 100 items",
            error_code="QUOTA_EXCEEDED"
        )
    
    return {"message": "Validation passed"}
```

## Testing

### Unit Testing Validation Dependencies

```python
import pytest
from fastapi.testclient import TestClient
from jidelnicek.core.dependencies.validation import FileUploadValidator

@pytest.mark.asyncio
async def test_file_upload_validation():
    validator = FileUploadValidator(
        max_size=1024,
        allowed_extensions=[".jpg"]
    )
    
    # Test valid file
    valid_file = create_test_upload_file("test.jpg", b"fake image data")
    result = await validator(valid_file)
    assert result.filename == "test.jpg"
    
    # Test invalid file
    invalid_file = create_test_upload_file("test.txt", b"text content")
    with pytest.raises(HTTPException) as exc_info:
        await validator(invalid_file)
    assert exc_info.value.status_code == 422
```

### Integration Testing

```python
def test_validation_middleware(client: TestClient):
    # Test file upload validation
    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.jpg", b"fake image data", "image/jpeg")}
    )
    assert response.status_code == 200
    
    # Test oversized file
    large_file = b"x" * (10 * 1024 * 1024 + 1)  # 10MB + 1 byte
    response = client.post(
        "/api/v1/upload",
        files={"file": ("large.jpg", large_file, "image/jpeg")}
    )
    assert response.status_code == 413
    assert "REQUEST_TOO_LARGE" in response.json()["error"]["code"]
```

## Monitoring and Logging

### Validation Metrics

Monitor validation performance and error rates:

```python
import logging
from prometheus_client import Counter, Histogram

validation_errors = Counter(
    "validation_errors_total",
    "Total validation errors",
    ["error_type", "endpoint"]
)

validation_duration = Histogram(
    "validation_duration_seconds",
    "Validation processing time",
    ["validation_type"]
)
```

### Log Validation Events

```python
logger.info(f"File validation passed: {file.filename} ({file.size} bytes)")
logger.warning(f"Validation failed: {error.message} - User: {user.id}")
logger.error(f"Validation system error: {str(exception)}")
```

## Security Considerations

1. **File Upload Security**: Always validate file types, scan for malware, and store uploads outside the web root
2. **Permission Validation**: Implement least privilege access and regularly audit permissions
3. **Input Validation**: Validate all inputs, including headers, query parameters, and request bodies
4. **Rate Limiting**: Implement rate limiting to prevent abuse of validation endpoints
5. **Error Information**: Don't expose sensitive information in validation error messages

## Performance Optimization

1. **Caching**: Cache validation results where appropriate
2. **Async Processing**: Use async validation for I/O-bound operations
3. **Batch Validation**: Process multiple files in batches for better performance
4. **Resource Limits**: Set appropriate limits to prevent resource exhaustion

## Extending the System

To add new validation types:

1. Create a new validator class inheriting from `ValidationDependency`
2. Implement the `__call__` method
3. Add factory functions for convenience
4. Register exception handlers if needed
5. Add tests and documentation

Example:

```python
class CustomValidator(ValidationDependency):
    def __init__(self, custom_param: str):
        super().__init__("CUSTOM_VALIDATION_ERROR")
        self.custom_param = custom_param
    
    async def __call__(self, request: Request) -> Any:
        # Custom validation logic
        if not self._validate_custom_logic(request):
            raise self.create_error("Custom validation failed")
        return request

def validate_custom(custom_param: str) -> Callable:
    return Depends(CustomValidator(custom_param))
```

This validation system provides a robust, scalable foundation for securing and validating API requests in the Jídelníček 2.0 application.