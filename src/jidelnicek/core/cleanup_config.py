"""
Configuration for cleanup policies and retention settings.

This module defines default cleanup policies and configurations
that can be customized through environment variables or database settings.
"""

from typing import Dict, Any
from datetime import timedelta

# Default retention periods (in days)
DEFAULT_RETENTION_DAYS = {
    "shopping_list": 7,      # Shopping lists kept for 1 week
    "trip_data": 30,         # Trip data kept for 1 month
    "recipes": 90,           # Recipe exports kept for 3 months
    "dataset": 180,          # Large datasets kept for 6 months
    "temp_files": 1,         # Temporary files kept for 1 day
}

# Grace periods before permanent deletion (in hours)
DEFAULT_GRACE_PERIODS = {
    "shopping_list": 24,     # 1 day grace period
    "trip_data": 48,         # 2 days grace period
    "recipes": 72,           # 3 days grace period
    "dataset": 168,          # 1 week grace period
}

# Minimum and maximum retention limits
RETENTION_LIMITS = {
    "shopping_list": {"min": 1, "max": 30},
    "trip_data": {"min": 7, "max": 365},
    "recipes": {"min": 30, "max": 730},
    "dataset": {"min": 90, "max": 1095},
}

# File size limits for cleanup (in MB)
FILE_SIZE_LIMITS = {
    "shopping_list": {"min": 0, "max": 50},      # Max 50MB
    "trip_data": {"min": 0, "max": 100},         # Max 100MB
    "recipes": {"min": 0, "max": 500},           # Max 500MB
    "dataset": {"min": 0, "max": None},          # No max limit
}

# Cleanup schedule configuration
CLEANUP_SCHEDULE = {
    "export_files": {
        "schedule": timedelta(days=1),           # Run daily
        "time": "02:00",                         # Run at 2 AM UTC
        "priority": 1,
    },
    "cloud_storage": {
        "schedule": timedelta(days=7),           # Run weekly
        "time": "03:00",                         # Run at 3 AM UTC
        "priority": 0,
    },
    "temp_files": {
        "schedule": timedelta(hours=1),          # Run hourly
        "priority": 2,
    },
    "deletion_queue": {
        "schedule": timedelta(minutes=15),       # Run every 15 minutes
        "priority": 3,
    },
    "old_jobs": {
        "schedule": timedelta(days=7),           # Run weekly
        "time": "04:00",                         # Run at 4 AM UTC
        "priority": 0,
    },
}

# Notification configuration
NOTIFICATION_CONFIG = {
    "enable_email": True,
    "enable_in_app": True,
    "default_lead_time_hours": 24,              # Notify 24 hours before deletion
    "reminder_intervals": [24, 6, 1],           # Send reminders at 24h, 6h, and 1h
}

# Storage configuration
STORAGE_CONFIG = {
    "enable_local_cleanup": True,
    "enable_s3_cleanup": True,
    "enable_azure_cleanup": True,
    "backup_before_deletion": False,
    "backup_location": "archive",                # Subdirectory for backups
}

# Audit and reporting configuration
AUDIT_CONFIG = {
    "retention_days": 365,                       # Keep audit logs for 1 year
    "include_file_hash": True,                   # Calculate SHA256 for files
    "detailed_metadata": True,                   # Store detailed file metadata
    "monthly_reports": True,                     # Generate monthly reports
}

# Default cleanup policies
DEFAULT_POLICIES = [
    {
        "name": "Shopping List Cleanup",
        "description": "Clean up old shopping list exports",
        "file_type": "shopping_list",
        "retention_days": DEFAULT_RETENTION_DAYS["shopping_list"],
        "grace_period_hours": DEFAULT_GRACE_PERIODS["shopping_list"],
        "file_pattern": r"shopping_list_\d+_\d{8}_\d{6}\.\w+",
        "storage_location": "local",
        "notify_before_deletion": True,
        "notification_hours_before": 24,
        "allow_user_override": True,
        "is_active": True,
        "priority": 10,
    },
    {
        "name": "Trip Data Cleanup",
        "description": "Clean up old trip data exports",
        "file_type": "trip_data",
        "retention_days": DEFAULT_RETENTION_DAYS["trip_data"],
        "grace_period_hours": DEFAULT_GRACE_PERIODS["trip_data"],
        "file_pattern": r"trip_\d+_\d{8}_\d{6}\.\w+",
        "storage_location": "local",
        "notify_before_deletion": True,
        "notification_hours_before": 48,
        "allow_user_override": True,
        "is_active": True,
        "priority": 10,
    },
    {
        "name": "Recipe Export Cleanup",
        "description": "Clean up old recipe exports",
        "file_type": "recipes",
        "retention_days": DEFAULT_RETENTION_DAYS["recipes"],
        "grace_period_hours": DEFAULT_GRACE_PERIODS["recipes"],
        "file_pattern": r"recipes_\d{8}_\d{6}\.\w+",
        "storage_location": "local",
        "notify_before_deletion": True,
        "notification_hours_before": 72,
        "allow_user_override": True,
        "is_active": True,
        "priority": 5,
    },
    {
        "name": "Dataset Export Cleanup",
        "description": "Clean up old dataset exports",
        "file_type": "dataset",
        "retention_days": DEFAULT_RETENTION_DAYS["dataset"],
        "grace_period_hours": DEFAULT_GRACE_PERIODS["dataset"],
        "file_pattern": r"\w+_\d{8}_\d{6}\.\w+",
        "storage_location": "local",
        "notify_before_deletion": True,
        "notification_hours_before": 168,
        "allow_user_override": True,
        "is_active": True,
        "priority": 1,
    },
]

# Cloud storage specific policies
CLOUD_POLICIES = [
    {
        "name": "S3 Shopping List Cleanup",
        "description": "Clean up old shopping list exports from S3",
        "file_type": "shopping_list",
        "retention_days": DEFAULT_RETENTION_DAYS["shopping_list"] + 7,  # Extra week for cloud
        "grace_period_hours": 0,  # No grace period for cloud
        "storage_location": "s3",
        "notify_before_deletion": False,  # Already notified for local
        "allow_user_override": True,
        "is_active": True,
        "priority": 8,
    },
    {
        "name": "Azure Trip Data Cleanup",
        "description": "Clean up old trip data exports from Azure",
        "file_type": "trip_data",
        "retention_days": DEFAULT_RETENTION_DAYS["trip_data"] + 14,  # Extra 2 weeks for cloud
        "grace_period_hours": 0,
        "storage_location": "azure",
        "notify_before_deletion": False,
        "allow_user_override": True,
        "is_active": True,
        "priority": 8,
    },
]

def get_cleanup_config() -> Dict[str, Any]:
    """Get the complete cleanup configuration."""
    return {
        "retention_days": DEFAULT_RETENTION_DAYS,
        "grace_periods": DEFAULT_GRACE_PERIODS,
        "retention_limits": RETENTION_LIMITS,
        "file_size_limits": FILE_SIZE_LIMITS,
        "schedule": CLEANUP_SCHEDULE,
        "notifications": NOTIFICATION_CONFIG,
        "storage": STORAGE_CONFIG,
        "audit": AUDIT_CONFIG,
        "default_policies": DEFAULT_POLICIES,
        "cloud_policies": CLOUD_POLICIES,
    }

def get_policy_for_file_type(file_type: str, storage_location: str = "local") -> Dict[str, Any]:
    """Get the default policy for a specific file type and storage location."""
    all_policies = DEFAULT_POLICIES + CLOUD_POLICIES
    
    for policy in all_policies:
        if policy["file_type"] == file_type and policy["storage_location"] == storage_location:
            return policy
    
    # Return a generic policy if not found
    return {
        "name": f"{file_type.title()} Cleanup",
        "file_type": file_type,
        "retention_days": 30,
        "grace_period_hours": 24,
        "storage_location": storage_location,
        "notify_before_deletion": True,
        "allow_user_override": True,
        "is_active": True,
        "priority": 0,
    }