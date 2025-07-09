# FastAPI Validation System

## Overview

This FastAPI validation system provides comprehensive request/response validation, file upload validation, and dependency injection for the Jídelníček 2.0 application.

## Components Created

### 1. Validation Middleware (`src/jidelnicek/core/middleware/validation.py`)

- **ValidationMiddleware**: Handles request-level validation
- **ValidationException**: Custom exception for validation errors
- **FileValidationException**: Specialized exception for file validation errors
- Exception handlers for consistent error formatting

### 2. Validation Dependencies (`src/jidelnicek/core/validation/validation.py`)

- **FileUploadValidator**: Comprehensive file upload validation
- **PermissionValidator**: Role-based permission checking
- **RequestValidator**: Request data validation
- **ResponseValidator**: Response data validation
- **ContentTypeValidator**: Content type validation
- **TimestampValidator**: Timestamp validation for security
- **SchemaValidator**: Pydantic schema validation

### 3. Package Structure

```
src/jidelnicek/core/
├── middleware/
│   ├── __init__.py
│   ├── security.py (existing)
│   └── validation.py (new)
├── validation/
│   ├── __init__.py (new)
│   ├── validation.py (new)
│   ├── examples.py (new)
│   └── README.md (new)
└── dependencies.py (existing)
```

## Features

### 🔒 Security Features

- File upload validation with size and type restrictions
- Permission-based access control
- Request timestamp validation (anti-replay)
- Content type validation
- Filename sanitization
- Malware scanning support (extensible)

### 📁 File Upload Validation

- File size limits
- Extension whitelist
- MIME type validation
- Image dimension validation (with PIL)
- Filename safety checks
- Batch file processing support

### 🔑 Permission System

- Role-based access control
- Resource-specific permissions
- Email verification requirements
- User quota validation

### 📊 Request/Response Validation

- Pydantic schema validation
- JSON structure validation
- Request size limits
- Custom validation logic support

## Usage Examples

### Basic File Upload

```python
from fastapi import APIRouter, UploadFile
from jidelnicek.core.validation.validation import validate_file

router = APIRouter()

@router.post("/upload")
async def upload_file(
    file: UploadFile = validate_file(
        max_size=5 * 1024 * 1024,  # 5MB
        allowed_extensions=[".jpg", ".png", ".pdf"],
        require_image=True
    )
):
    return {"filename": file.filename, "size": file.size}
```

### Permission-Based Access

```python
from jidelnicek.core.validation.validation import require_permission
from jidelnicek.auth.models import AuthUser

@router.get("/admin/users")
async def get_users(
    user: AuthUser = require_permission("admin:users", require_verified=True)
):
    return {"message": f"Hello admin {user.display_name}!"}
```

### Schema Validation

```python
from pydantic import BaseModel
from jidelnicek.core.validation.validation import validate_schema

class CreateRecipeRequest(BaseModel):
    title: str
    ingredients: list[str]
    prep_time_minutes: int

@router.post("/recipes")
async def create_recipe(
    data: CreateRecipeRequest = validate_schema(CreateRecipeRequest)
):
    return {"message": "Recipe created", "data": data}
```

### Complex Validation

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

## Error Handling

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

## Configuration

### Environment Variables

The system uses these settings from `jidelnicek.core.config`:

```python
# File Upload Settings
max_upload_size: int = 10485760  # 10MB
allowed_upload_extensions: List[str] = [".jpg", ".png", ".pdf"]

# Security Settings
csrf_enabled: bool = True
rate_limit_enabled: bool = True
debug: bool = False
```

### Middleware Registration

In `main.py`:

```python
from jidelnicek.core.middleware.validation import (
    ValidationMiddleware,
    validation_exception_handler,
    response_validation_exception_handler,
    pydantic_validation_exception_handler,
    custom_validation_exception_handler,
    ValidationException
)
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from pydantic import ValidationError

# Add middleware
app.add_middleware(
    ValidationMiddleware,
    max_request_size=settings.max_upload_size,
    allowed_extensions=settings.allowed_upload_extensions,
    log_validation_errors=not settings.is_production
)

# Register exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ResponseValidationError, response_validation_exception_handler)
app.add_exception_handler(ValidationError, pydantic_validation_exception_handler)
app.add_exception_handler(ValidationException, custom_validation_exception_handler)
```

## Available Validators

### FileUploadValidator

```python
FileUploadValidator(
    max_size=10 * 1024 * 1024,  # 10MB
    allowed_extensions=[".jpg", ".png", ".pdf"],
    allowed_mime_types=["image/jpeg", "image/png"],
    require_image=True,
    max_image_dimensions=(4096, 4096),
    min_image_dimensions=(32, 32),
    scan_for_malware=False
)
```

### PermissionValidator

```python
PermissionValidator(
    required_permission="recipes:create",
    require_verified=True
)
```

### RequestValidator

```python
RequestValidator(
    schema=MySchema,
    validate_json=True,
    max_json_size=1024 * 1024,
    required_headers=["X-API-Key"],
    validate_timestamp=True,
    max_timestamp_age=300
)
```

### ContentTypeValidator

```python
ContentTypeValidator(
    allowed_types=["application/json", "multipart/form-data"]
)
```

### TimestampValidator

```python
TimestampValidator(
    max_age_seconds=300,
    allow_future=False
)
```

## Permission System

The permission system supports these permission patterns:

```python
# Recipe permissions
"recipes:read"     # Read recipes
"recipes:create"   # Create recipes
"recipes:update"   # Update recipes
"recipes:delete"   # Delete recipes

# User permissions
"users:read"       # Read user data (admin only)
"users:create"     # Create users (admin only)
"users:update"     # Update users (admin only)
"users:delete"     # Delete users (admin only)

# Admin permissions
"admin:access"     # Access admin interface
"admin:users"      # Manage users
"admin:reports"    # Generate reports
"admin:system"     # System administration

# Menu permissions
"menus:read"       # Read menus
"menus:create"     # Create menus (admin only)
"menus:update"     # Update menus (admin only)
"menus:delete"     # Delete menus (admin only)

# Order permissions
"orders:read"      # Read orders
"orders:create"    # Create orders
"orders:update"    # Update orders
"orders:cancel"    # Cancel orders
```

## Optional Dependencies

The system gracefully handles missing optional dependencies:

- **Pillow (PIL)**: For image validation and processing
- **python-magic**: For advanced MIME type detection

If these are not installed, the system falls back to basic validation.

## Testing

Use the provided test script to verify the system:

```bash
python validate_imports.py
```

## Extension Points

### Custom Validators

Create custom validators by inheriting from `ValidationDependency`:

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
```

### Custom Error Handlers

Add custom error handlers for specific validation scenarios:

```python
@app.exception_handler(CustomValidationError)
async def custom_validation_handler(request: Request, exc: CustomValidationError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.to_dict()}
    )
```

## Security Considerations

1. **File Security**: Always validate file types and scan for malware
2. **Permission Security**: Implement least privilege access
3. **Input Validation**: Validate all inputs including headers and query parameters
4. **Rate Limiting**: Prevent abuse of validation endpoints
5. **Error Disclosure**: Don't expose sensitive information in error messages

## Performance Optimization

1. **Async Processing**: All validators are async for better performance
2. **Batch Validation**: Support for validating multiple files at once
3. **Resource Limits**: Configurable limits to prevent resource exhaustion
4. **Caching**: Validation results can be cached where appropriate

This validation system provides a robust, secure, and scalable foundation for API validation in the Jídelníček 2.0 application.