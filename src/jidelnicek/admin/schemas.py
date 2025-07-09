"""
Admin schemas for Jidelnicek 2.0.

This module defines Pydantic schemas for admin API requests and responses.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator


class UserStatus(str, Enum):
    """User account status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


class UserRole(str, Enum):
    """User roles."""
    USER = "user"
    ADMIN = "admin"


class SortField(str, Enum):
    """Fields available for sorting users."""
    EMAIL = "email"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    LAST_LOGIN = "last_login"
    RECIPE_COUNT = "recipe_count"
    TRIP_COUNT = "trip_count"


class SortOrder(str, Enum):
    """Sort order options."""
    ASC = "asc"
    DESC = "desc"


# User management schemas
class UserFilter(BaseModel):
    """Filters for user listing."""
    email: Optional[str] = Field(None, description="Filter by email (partial match)")
    status: Optional[UserStatus] = Field(None, description="Filter by status")
    role: Optional[UserRole] = Field(None, description="Filter by role")
    email_verified: Optional[bool] = Field(None, description="Filter by email verification status")
    created_after: Optional[datetime] = Field(None, description="Filter users created after date")
    created_before: Optional[datetime] = Field(None, description="Filter users created before date")
    has_logged_in: Optional[bool] = Field(None, description="Filter by login history")


class UserSort(BaseModel):
    """Sorting options for user listing."""
    field: SortField = Field(SortField.CREATED_AT, description="Field to sort by")
    order: SortOrder = Field(SortOrder.DESC, description="Sort order")


class AdminUserSummary(BaseModel):
    """Summary user information for admin listing."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    email: EmailStr
    role: UserRole
    email_verified: bool
    is_active: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]
    recipe_count: int
    trip_count: int
    
    # Computed status
    status: UserStatus
    
    @field_validator('status', mode='before')
    def compute_status(cls, v, info):
        """Compute status from user state."""
        data = info.data
        if data.get('is_archived'):
            return UserStatus.ARCHIVED
        elif not data.get('is_active'):
            return UserStatus.SUSPENDED
        elif data.get('last_login') is None:
            return UserStatus.INACTIVE
        return UserStatus.ACTIVE


class AdminUserDetail(AdminUserSummary):
    """Detailed user information for admin view."""
    # Additional fields for detail view
    language: str
    unit_system: str
    energy_unit: str
    has_pku: bool
    timezone: str
    failed_login_attempts: int
    locked_until: Optional[datetime]
    
    # Related data counts
    session_count: Optional[int] = None
    active_session_count: Optional[int] = None
    
    # Recent activity
    recent_sessions: Optional[List[Dict[str, Any]]] = None
    recent_activity: Optional[List[Dict[str, Any]]] = None


class UserListResponse(BaseModel):
    """Response for user listing endpoint."""
    users: List[AdminUserSummary]
    total: int
    page: int
    per_page: int
    pages: int
    
    # Summary statistics
    stats: Dict[str, int] = Field(
        default_factory=dict,
        description="Summary statistics about users"
    )


class UserCreateRequest(BaseModel):
    """Request to create a new user (admin only)."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.USER
    email_verified: bool = False
    send_welcome_email: bool = True
    
    # User preferences
    language: str = "cs"
    unit_system: str = "metric"
    energy_unit: str = "kcal"
    has_pku: bool = False
    timezone: str = "Europe/Prague"


class UserUpdateRequest(BaseModel):
    """Request to update user information."""
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    email_verified: Optional[bool] = None
    
    # User preferences
    language: Optional[str] = None
    unit_system: Optional[str] = None
    energy_unit: Optional[str] = None
    has_pku: Optional[bool] = None
    timezone: Optional[str] = None
    
    # Admin notes
    reason: Optional[str] = Field(None, description="Reason for update")


class BulkUserOperation(BaseModel):
    """Request for bulk user operations."""
    user_ids: List[UUID] = Field(..., min_length=1, max_length=100)
    operation: Literal["suspend", "activate", "delete", "export"]
    reason: Optional[str] = Field(None, description="Reason for operation")
    send_notification: bool = Field(True, description="Send email notification to affected users")


class BulkOperationResult(BaseModel):
    """Result of a bulk operation."""
    total: int
    successful: int
    failed: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class PasswordResetRequest(BaseModel):
    """Request to reset a user's password."""
    user_id: UUID
    new_password: Optional[str] = Field(None, min_length=8)
    generate_random: bool = Field(False, description="Generate a random password")
    send_email: bool = Field(True, description="Send password to user via email")
    require_change: bool = Field(True, description="Require user to change password on next login")
    reason: str = Field(..., description="Reason for password reset")


class PasswordResetResponse(BaseModel):
    """Response for password reset operation."""
    success: bool
    password: Optional[str] = Field(None, description="Generated password (if applicable)")
    message: str


class UserSessionInfo(BaseModel):
    """Information about a user session."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    expires_at: datetime
    last_accessed: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]
    device_name: Optional[str]
    location: Optional[str]
    is_valid: bool
    is_current: bool = False


class ForceLogoutRequest(BaseModel):
    """Request to force logout a user."""
    user_id: UUID
    reason: str
    logout_all_sessions: bool = Field(True, description="Logout all sessions or just active ones")


# Audit log schemas
class AuditLogFilter(BaseModel):
    """Filters for audit log listing."""
    admin_id: Optional[UUID] = None
    action: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[UUID] = None
    success: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AuditLogEntry(BaseModel):
    """Audit log entry for admin view."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    admin_id: UUID
    admin_email: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[UUID]
    target_ids: Optional[List[str]]
    
    changes: Optional[Dict[str, Any]]
    reason: Optional[str]
    
    ip_address: Optional[str]
    success: bool
    error_message: Optional[str]
    
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """Response for audit log listing."""
    entries: List[AuditLogEntry]
    total: int
    page: int
    per_page: int
    pages: int


# Statistics schemas
class UserStatistics(BaseModel):
    """Overall user statistics for admin dashboard."""
    total_users: int
    active_users: int
    inactive_users: int
    suspended_users: int
    archived_users: int
    
    verified_emails: int
    unverified_emails: int
    
    admin_count: int
    user_count: int
    
    users_with_recipes: int
    users_with_trips: int
    
    registrations_today: int
    registrations_this_week: int
    registrations_this_month: int
    
    active_sessions: int
    
    # Growth metrics
    growth_rate_week: float
    growth_rate_month: float


class AdminDashboard(BaseModel):
    """Admin dashboard data."""
    user_stats: UserStatistics
    recent_registrations: List[AdminUserSummary]
    recent_admin_actions: List[AuditLogEntry]
    system_alerts: List[Dict[str, Any]]


# Advanced audit schemas
class AuditIntegrityStatus(str, Enum):
    """Audit log integrity status."""
    INTACT = "intact"
    COMPROMISED = "compromised"
    UNKNOWN = "unknown"


class AuditIntegrityResult(BaseModel):
    """Result of audit log integrity verification."""
    integrity_status: AuditIntegrityStatus
    total_checked: int
    verified: int
    issues_found: int
    issues: List[Dict[str, Any]]
    verification_timestamp: datetime


class AuditAlert(BaseModel):
    """Security alert from audit system."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    alert_type: str
    severity: str
    title: str
    description: str
    admin_id: Optional[UUID]
    related_audit_logs: List[str]
    detection_metadata: Optional[Dict[str, Any]]
    status: str
    created_at: datetime
    acknowledged_by: Optional[UUID]
    acknowledged_at: Optional[datetime]
    resolution_notes: Optional[str]


class AuditPattern(BaseModel):
    """Detected unusual activity pattern."""
    pattern_type: str
    description: str
    severity: str
    admin_id: Optional[str]
    timestamp: Optional[datetime]
    metadata: Dict[str, Any]


class AuditMetricsPeriod(BaseModel):
    """Performance metrics for a time period."""
    period_start: datetime
    period_end: datetime
    total_actions: int
    success_rate: float
    unique_admins: int
    action_breakdown: Dict[str, int]
    avg_response_time_ms: Optional[float]
    max_response_time_ms: Optional[float]
    alerts_generated: int


class ComplianceReport(BaseModel):
    """Comprehensive compliance audit report."""
    report_metadata: Dict[str, Any]
    summary: Dict[str, Any]
    admin_activity: List[Dict[str, Any]]
    sensitive_operations: List[Dict[str, Any]]
    security_alerts: List[Dict[str, Any]]
    integrity_verification: AuditIntegrityResult
    detailed_logs: Optional[List[Dict[str, Any]]] = None


class AuditSearchResult(BaseModel):
    """Search result from audit logs."""
    query: str
    total: int
    page: int
    per_page: int
    pages: int
    results: List[Dict[str, Any]]


class AuditArchiveResult(BaseModel):
    """Result of audit log archiving operation."""
    archived: int
    archive_cutoff_date: datetime
    permanent_deletion_cutoff: datetime