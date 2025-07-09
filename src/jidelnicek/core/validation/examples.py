"""
Example usage of validation dependencies.

This module demonstrates how to use the validation dependencies
in FastAPI endpoints for various validation scenarios.
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, HTTPException
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.validation.validation import (
    require_permission,
    validate_file,
    validate_schema,
    validate_content_type,
    validate_timestamp,
    FileUploadValidator,
    PermissionValidator,
    RequestValidator,
    ValidatedUser,
    ValidatedFile,
    ValidatedImageFile
)
from jidelnicek.auth.models import AuthUser

# Example router
router = APIRouter(prefix="/api/v1/examples", tags=["validation-examples"])


# Example schemas
class CreateRecipeRequest(BaseModel):
    """Schema for creating a recipe."""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    ingredients: List[str] = Field(..., min_items=1, max_items=50)
    instructions: List[str] = Field(..., min_items=1, max_items=20)
    prep_time_minutes: int = Field(..., ge=1, le=1440)
    cook_time_minutes: int = Field(..., ge=0, le=1440)
    servings: int = Field(..., ge=1, le=50)
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")


class UpdateUserProfileRequest(BaseModel):
    """Schema for updating user profile."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    bio: Optional[str] = Field(None, max_length=500)
    preferences: Optional[dict] = None


class FileUploadResponse(BaseModel):
    """Response schema for file uploads."""
    filename: str
    size: int
    content_type: str
    url: str


# Example 1: Simple permission validation
@router.get("/admin/users")
async def get_users(
    user: AuthUser = require_permission("admin:users"),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint requiring admin permissions."""
    return {"message": f"Hello admin {user.display_name}! Here are the users..."}


# Example 2: File upload validation
@router.post("/upload/image", response_model=FileUploadResponse)
async def upload_image(
    file: UploadFile = validate_file(
        max_size=5 * 1024 * 1024,  # 5MB
        allowed_extensions=[".jpg", ".jpeg", ".png", ".gif"],
        require_image=True
    ),
    user: ValidatedUser = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint for image upload with validation."""
    return FileUploadResponse(
        filename=file.filename,
        size=file.size or 0,
        content_type=file.content_type or "application/octet-stream",
        url=f"/uploads/{file.filename}"
    )


# Example 3: Multiple file uploads with different validation
@router.post("/recipe/create-with-images")
async def create_recipe_with_images(
    recipe_data: str = Form(...),  # JSON string
    main_image: UploadFile = validate_file(
        max_size=10 * 1024 * 1024,  # 10MB
        allowed_extensions=[".jpg", ".jpeg", ".png"],
        require_image=True
    ),
    additional_images: List[UploadFile] = File(default=[]),
    user: ValidatedUser = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint for creating recipe with image uploads."""
    import json
    
    # Parse recipe data
    try:
        recipe_dict = json.loads(recipe_data)
        recipe = CreateRecipeRequest.model_validate(recipe_dict)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid recipe data: {str(e)}"
        )
    
    # Validate additional images
    image_validator = FileUploadValidator(
        max_size=5 * 1024 * 1024,  # 5MB for additional images
        allowed_extensions=[".jpg", ".jpeg", ".png"],
        require_image=True
    )
    
    validated_additional_images = []
    for image in additional_images:
        if image.filename:  # Skip empty files
            validated_image = await image_validator(image)
            validated_additional_images.append(validated_image)
    
    return {
        "message": "Recipe created successfully",
        "recipe": recipe.model_dump(),
        "main_image": main_image.filename,
        "additional_images": [img.filename for img in validated_additional_images]
    }


# Example 4: Schema validation with custom dependency
@router.post("/user/profile")
async def update_user_profile(
    profile_data: UpdateUserProfileRequest = validate_schema(UpdateUserProfileRequest),
    user: ValidatedUser = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint for updating user profile with schema validation."""
    return {
        "message": "Profile updated successfully",
        "user_id": str(user.id),
        "updated_data": profile_data.model_dump(exclude_none=True)
    }


# Example 5: Content type validation
@router.post("/data/import")
async def import_data(
    request: Request,
    user: ValidatedUser = Depends(),
    _: None = validate_content_type(["application/json", "application/xml"]),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint requiring specific content types."""
    content_type = request.headers.get("content-type", "")
    body = await request.body()
    
    return {
        "message": "Data imported successfully",
        "content_type": content_type,
        "size": len(body)
    }


# Example 6: Timestamp validation for API security
@router.post("/secure/transaction")
async def secure_transaction(
    request: Request,
    user: ValidatedUser = Depends(),
    timestamp: datetime = validate_timestamp(max_age_seconds=60),  # 1 minute
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint with timestamp validation for security."""
    return {
        "message": "Transaction processed",
        "timestamp": timestamp.isoformat(),
        "user_id": str(user.id)
    }


# Example 7: Multiple validation dependencies
@router.post("/complex/operation")
async def complex_operation(
    request: Request,
    user: AuthUser = require_permission("admin:system", require_verified=True),
    file: UploadFile = validate_file(
        max_size=50 * 1024 * 1024,  # 50MB
        allowed_extensions=[".zip", ".tar.gz", ".json"]
    ),
    _: None = validate_content_type(["multipart/form-data"]),
    timestamp: datetime = validate_timestamp(max_age_seconds=300),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint combining multiple validation dependencies."""
    return {
        "message": "Complex operation completed",
        "admin_user": user.display_name,
        "file_size": file.size,
        "timestamp": timestamp.isoformat(),
        "verified": user.email_verified
    }


# Example 8: Custom validation with error handling
@router.post("/validate/custom")
async def custom_validation_example(
    request: Request,
    user: ValidatedUser = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint with custom validation logic."""
    from jidelnicek.core.middleware.validation import ValidationException
    
    # Custom validation logic
    body = await request.body()
    
    if len(body) == 0:
        raise ValidationException(
            message="Request body cannot be empty",
            error_code="EMPTY_BODY"
        )
    
    # Custom business logic validation
    if user.display_name and "admin" in user.display_name.lower():
        # Special handling for admin users
        pass
    
    return {
        "message": "Custom validation passed",
        "user_type": "admin" if user.is_admin else "user",
        "body_size": len(body)
    }


# Example 9: Conditional validation
@router.post("/conditional/validation")
async def conditional_validation(
    request: Request,
    user: ValidatedUser = Depends(),
    operation_type: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint with conditional validation based on operation type."""
    from jidelnicek.core.middleware.validation import ValidationException
    
    # Conditional validation based on operation type
    if operation_type == "upload":
        if not file:
            raise ValidationException(
                message="File is required for upload operation",
                error_code="MISSING_FILE"
            )
        
        # Validate file if provided
        file_validator = FileUploadValidator(
            max_size=10 * 1024 * 1024,
            allowed_extensions=[".jpg", ".png", ".pdf"]
        )
        await file_validator(file)
    
    elif operation_type == "delete":
        # For delete operations, ensure user has permission
        if not user.is_admin:
            raise ValidationException(
                message="Delete operations require admin privileges",
                error_code="INSUFFICIENT_PRIVILEGES"
            )
    
    return {
        "message": f"Operation '{operation_type}' completed",
        "has_file": file is not None,
        "filename": file.filename if file else None
    }


# Example 10: Batch validation
@router.post("/batch/process")
async def batch_process(
    request: Request,
    user: ValidatedUser = Depends(),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Example endpoint for batch file processing with validation."""
    from jidelnicek.core.middleware.validation import ValidationException
    
    if len(files) > 10:
        raise ValidationException(
            message="Maximum 10 files allowed in batch operation",
            error_code="TOO_MANY_FILES"
        )
    
    # Validate each file
    file_validator = FileUploadValidator(
        max_size=5 * 1024 * 1024,  # 5MB per file
        allowed_extensions=[".jpg", ".png", ".pdf", ".doc", ".docx"]
    )
    
    validated_files = []
    for i, file in enumerate(files):
        if file.filename:  # Skip empty files
            try:
                validated_file = await file_validator(file)
                validated_files.append(validated_file)
            except HTTPException as e:
                raise ValidationException(
                    message=f"File {i+1} validation failed: {e.detail}",
                    error_code="FILE_VALIDATION_FAILED"
                )
    
    return {
        "message": "Batch processing completed",
        "processed_files": len(validated_files),
        "file_names": [f.filename for f in validated_files]
    }