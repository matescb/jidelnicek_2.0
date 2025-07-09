"""
Job schemas for API requests and responses.

This module defines Pydantic schemas for job-related operations,
including creation, updates, and responses.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from jidelnicek.core.models.job import JobStatus, JobPriority, JobType


class JobCreate(BaseModel):
    """Schema for creating a job."""
    
    job_type: JobType = Field(..., description="Type of job to create")
    name: str = Field(..., min_length=1, max_length=255, description="Job name")
    description: Optional[str] = Field(None, description="Job description")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Job parameters")
    priority: JobPriority = Field(JobPriority.NORMAL, description="Job priority")
    notify_on_completion: bool = Field(False, description="Notify when job completes")
    notify_on_failure: bool = Field(True, description="Notify when job fails")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "job_type": "export_shopping_list",
                "name": "Export Shopping List for Summer Camp",
                "description": "Export shopping list for 50 participants",
                "parameters": {
                    "trip_id": 123,
                    "format": "pdf",
                    "options": {
                        "group_by_category": True,
                        "include_prices": False
                    }
                },
                "priority": "normal",
                "notify_on_completion": True,
                "notify_on_failure": True
            }
        }
    )


class JobUpdate(BaseModel):
    """Schema for updating a job."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[JobPriority] = None
    notify_on_completion: Optional[bool] = None
    notify_on_failure: Optional[bool] = None


class JobResponse(BaseModel):
    """Schema for job response."""
    
    id: int
    task_id: str
    job_type: JobType
    name: str
    description: Optional[str]
    status: JobStatus
    priority: JobPriority
    progress: float = Field(ge=0, le=100)
    progress_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    eta: Optional[datetime]
    duration: float = Field(ge=0, description="Duration in seconds")
    user_id: Optional[int]
    parameters: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    retry_count: int
    max_retries: int
    queue_name: str
    worker_name: Optional[str]
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "job_type": "export_shopping_list",
                "name": "Export Shopping List for Summer Camp",
                "description": "Export shopping list for 50 participants",
                "status": "running",
                "priority": "normal",
                "progress": 45.5,
                "progress_message": "Processing meal plans...",
                "created_at": "2024-01-15T10:30:00Z",
                "started_at": "2024-01-15T10:30:05Z",
                "completed_at": None,
                "eta": "2024-01-15T10:35:00Z",
                "duration": 0,
                "user_id": 123,
                "parameters": {
                    "trip_id": 123,
                    "format": "pdf"
                },
                "result": None,
                "error_message": None,
                "retry_count": 0,
                "max_retries": 3,
                "queue_name": "default",
                "worker_name": "worker-01"
            }
        }
    )


class JobListResponse(BaseModel):
    """Schema for job list response."""
    
    jobs: List[JobResponse]
    total: int
    skip: int
    limit: int
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "jobs": [
                    {
                        "id": 1,
                        "task_id": "550e8400-e29b-41d4-a716-446655440000",
                        "job_type": "export_shopping_list",
                        "name": "Export Shopping List",
                        "status": "completed",
                        "progress": 100,
                        "created_at": "2024-01-15T10:30:00Z"
                    }
                ],
                "total": 25,
                "skip": 0,
                "limit": 10
            }
        }
    )


class JobStatistics(BaseModel):
    """Schema for job statistics."""
    
    total_jobs: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    average_duration_seconds: float
    success_rate: float
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_jobs": 150,
                "by_status": {
                    "pending": 5,
                    "running": 3,
                    "completed": 120,
                    "failed": 15,
                    "cancelled": 7,
                    "retrying": 0
                },
                "by_type": {
                    "export_shopping_list": 80,
                    "export_trip_data": 40,
                    "export_recipes": 20,
                    "export_dataset": 10
                },
                "average_duration_seconds": 45.7,
                "success_rate": 80.0
            }
        }
    )


class ExportJobCreate(BaseModel):
    """Schema for creating export jobs."""
    
    format: str = Field("pdf", pattern="^(pdf|excel|csv|json|text|html)$")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    priority: JobPriority = Field(JobPriority.NORMAL)
    notify_on_completion: bool = Field(False)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "format": "pdf",
                "options": {
                    "include_images": True,
                    "page_size": "A4"
                },
                "priority": "high",
                "notify_on_completion": True
            }
        }
    )


class ShoppingListExportCreate(ExportJobCreate):
    """Schema for creating shopping list export job."""
    
    trip_id: int = Field(..., gt=0)
    group_by_category: bool = Field(True)
    include_prices: bool = Field(False)
    include_quantities: bool = Field(True)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trip_id": 123,
                "format": "pdf",
                "group_by_category": True,
                "include_prices": False,
                "include_quantities": True,
                "priority": "normal",
                "notify_on_completion": True
            }
        }
    )


class TripExportCreate(ExportJobCreate):
    """Schema for creating trip export job."""
    
    trip_id: int = Field(..., gt=0)
    include_shopping_list: bool = Field(True)
    include_meal_plans: bool = Field(True)
    include_participants: bool = Field(True)
    include_qr_codes: bool = Field(False)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trip_id": 123,
                "format": "pdf",
                "include_shopping_list": True,
                "include_meal_plans": True,
                "include_participants": True,
                "include_qr_codes": False,
                "priority": "normal"
            }
        }
    )


class RecipeExportCreate(ExportJobCreate):
    """Schema for creating recipe export job."""
    
    recipe_ids: Optional[List[int]] = Field(None, description="Recipe IDs to export (None for all)")
    include_images: bool = Field(True)
    include_nutrition: bool = Field(True)
    include_instructions: bool = Field(True)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "recipe_ids": [1, 2, 3, 4, 5],
                "format": "pdf",
                "include_images": True,
                "include_nutrition": True,
                "include_instructions": True,
                "priority": "low"
            }
        }
    )


class ExportResult(BaseModel):
    """Schema for export result."""
    
    export_id: str
    file_path: str
    file_size: int
    format: str
    download_url: str
    expires_at: datetime
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "export_id": "550e8400-e29b-41d4-a716-446655440000",
                "file_path": "/exports/shopping_lists/shopping_list_123_20240115_103000.pdf",
                "file_size": 245760,
                "format": "pdf",
                "download_url": "/api/v1/exports/550e8400-e29b-41d4-a716-446655440000/download",
                "expires_at": "2024-01-22T10:30:00Z"
            }
        }
    )