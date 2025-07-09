"""
Pydantic schemas for cleanup management.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, validator


class CleanupPolicyBase(BaseModel):
    """Base schema for cleanup policies."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    file_type: str = Field(..., regex="^(shopping_list|trip_data|recipes|dataset)$")
    retention_days: int = Field(..., ge=1, le=3650)
    grace_period_hours: int = Field(24, ge=0, le=168)
    file_pattern: Optional[str] = None
    min_file_size: Optional[int] = Field(None, ge=0)
    max_file_size: Optional[int] = Field(None, ge=0)
    storage_location: str = Field("local", regex="^(local|s3|azure)$")
    allow_user_override: bool = True
    min_retention_days: Optional[int] = Field(None, ge=1)
    max_retention_days: Optional[int] = Field(None, ge=1)
    notify_before_deletion: bool = True
    notification_hours_before: int = Field(24, ge=0, le=168)
    is_active: bool = True
    priority: int = Field(0, ge=0, le=100)


class CleanupPolicyCreate(CleanupPolicyBase):
    """Schema for creating a cleanup policy."""
    pass


class CleanupPolicyUpdate(BaseModel):
    """Schema for updating a cleanup policy."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    retention_days: Optional[int] = Field(None, ge=1, le=3650)
    grace_period_hours: Optional[int] = Field(None, ge=0, le=168)
    file_pattern: Optional[str] = None
    min_file_size: Optional[int] = Field(None, ge=0)
    max_file_size: Optional[int] = Field(None, ge=0)
    allow_user_override: Optional[bool] = None
    min_retention_days: Optional[int] = Field(None, ge=1)
    max_retention_days: Optional[int] = Field(None, ge=1)
    notify_before_deletion: Optional[bool] = None
    notification_hours_before: Optional[int] = Field(None, ge=0, le=168)
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0, le=100)


class CleanupPolicyResponse(CleanupPolicyBase):
    """Schema for cleanup policy response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class CleanupAuditLogResponse(BaseModel):
    """Schema for cleanup audit log response."""
    id: int
    file_path: str
    file_type: str
    file_size: int
    file_hash: Optional[str]
    deletion_reason: str
    deleted_at: datetime
    deleted: bool
    policy_id: Optional[int]
    user_id: Optional[int]
    recovered: bool
    recovery_info: Optional[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class CleanupStatisticsResponse(BaseModel):
    """Schema for cleanup statistics response."""
    id: int
    date: datetime
    files_deleted: int
    total_size_freed: int
    errors_count: int
    by_type_stats: Dict[str, Dict[str, int]]
    local_files_deleted: int
    cloud_files_deleted: int
    cleanup_duration_seconds: Optional[float]
    average_file_size: Optional[float]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class UserCleanupPreferenceBase(BaseModel):
    """Base schema for user cleanup preferences."""
    shopping_list_retention_days: Optional[int] = Field(None, ge=1, le=365)
    trip_data_retention_days: Optional[int] = Field(None, ge=1, le=730)
    recipe_export_retention_days: Optional[int] = Field(None, ge=1, le=1095)
    dataset_export_retention_days: Optional[int] = Field(None, ge=1, le=1825)
    enable_deletion_notifications: bool = True
    notification_email: Optional[str] = None
    notification_lead_time_hours: int = Field(24, ge=1, le=168)
    auto_backup_before_deletion: bool = False
    backup_location: Optional[str] = Field(None, regex="^(local|cloud)$")


class UserCleanupPreferenceUpdate(UserCleanupPreferenceBase):
    """Schema for updating user cleanup preferences."""
    pass


class UserCleanupPreferenceResponse(UserCleanupPreferenceBase):
    """Schema for user cleanup preference response."""
    user_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class CleanupStatusResponse(BaseModel):
    """Schema for cleanup task status response."""
    message: str
    tasks: List[Dict[str, str]]
    dry_run: bool
    force: bool


class CleanupReportResponse(BaseModel):
    """Schema for cleanup report response."""
    task_id: str
    status: str
    start_date: datetime
    end_date: datetime
    email_to: Optional[str]


class CleanupSummary(BaseModel):
    """Schema for cleanup summary statistics."""
    total_files_deleted: int
    total_size_freed: int
    total_size_freed_mb: float
    total_errors: int
    files_recovered: int
    
    @validator("total_size_freed_mb", pre=True, always=True)
    def calculate_mb(cls, v, values):
        """Calculate MB from bytes."""
        if "total_size_freed" in values:
            return values["total_size_freed"] / (1024 * 1024)
        return 0.0


class CleanupReportData(BaseModel):
    """Schema for full cleanup report data."""
    period: Dict[str, str]
    summary: CleanupSummary
    by_type: Dict[str, Dict[str, int]]
    daily_stats: List[Dict[str, Any]]