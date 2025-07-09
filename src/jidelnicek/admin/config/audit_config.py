"""
Configuration for the audit logging system.

This module defines configuration settings for the audit system including
retention policies, anomaly detection thresholds, and alert settings.
"""

from typing import Dict, Set, Any
from datetime import timedelta
from enum import Enum

from pydantic import BaseModel, Field

from jidelnicek.admin.models import AdminAction


class AuditRetentionPolicy(BaseModel):
    """Retention policy configuration for audit logs."""
    
    # Days to keep in main audit table
    active_days: int = Field(
        default=90,
        description="Days to keep audit logs in active table"
    )
    
    # Days to keep in archive
    archive_days: int = Field(
        default=730,  # 2 years
        description="Days to keep audit logs in archive"
    )
    
    # Days to keep metrics
    metrics_days: int = Field(
        default=365,
        description="Days to keep aggregated metrics"
    )
    
    # Archive batch size
    archive_batch_size: int = Field(
        default=1000,
        description="Number of logs to archive in one batch"
    )


class AnomalyDetectionConfig(BaseModel):
    """Configuration for anomaly detection rules."""
    
    # Failure thresholds
    max_failures_per_hour: int = Field(
        default=10,
        description="Maximum failed operations per hour before alert"
    )
    
    max_failures_per_day: int = Field(
        default=50,
        description="Maximum failed operations per day before alert"
    )
    
    # Activity thresholds
    max_actions_per_minute: int = Field(
        default=30,
        description="Maximum actions per minute before rapid action alert"
    )
    
    max_actions_per_hour: int = Field(
        default=500,
        description="Maximum actions per hour before excessive activity alert"
    )
    
    # Time-based rules
    after_hours_start: int = Field(
        default=22,  # 10 PM
        description="Start of after-hours period (hour in 24h format)"
    )
    
    after_hours_end: int = Field(
        default=6,  # 6 AM
        description="End of after-hours period (hour in 24h format)"
    )
    
    # Bulk operation thresholds
    bulk_operation_threshold: int = Field(
        default=10,
        description="Minimum items for bulk operation alert"
    )
    
    large_bulk_operation_threshold: int = Field(
        default=50,
        description="Threshold for high-severity bulk operation alert"
    )
    
    # Pattern detection
    burst_activity_window_seconds: int = Field(
        default=60,
        description="Time window for burst activity detection"
    )
    
    burst_activity_threshold: int = Field(
        default=10,
        description="Number of actions in window to trigger burst alert"
    )
    
    # Sensitive actions requiring extra monitoring
    sensitive_actions: Set[str] = Field(
        default_factory=lambda: {
            AdminAction.USER_DELETE.value,
            AdminAction.BULK_DELETE.value,
            AdminAction.USER_RESET_PASSWORD.value,
            AdminAction.DATA_EXPORT.value,
            AdminAction.SYSTEM_CONFIG_UPDATE.value,
            AdminAction.USER_FORCE_LOGOUT.value,
            AdminAction.BULK_EXPORT.value
        },
        description="Actions that trigger enhanced monitoring"
    )
    
    # Coordinated activity detection
    coordinated_activity_threshold: int = Field(
        default=3,
        description="Minimum admins performing same action to detect coordination"
    )
    
    coordinated_activity_window_minutes: int = Field(
        default=5,
        description="Time window for coordinated activity detection"
    )


class AlertConfig(BaseModel):
    """Configuration for alert generation and management."""
    
    # Alert retention
    alert_retention_days: int = Field(
        default=90,
        description="Days to keep alerts"
    )
    
    # Alert rate limiting
    max_alerts_per_type_per_hour: int = Field(
        default=5,
        description="Maximum alerts of same type per hour"
    )
    
    # Alert severity thresholds
    severity_thresholds: Dict[str, Dict[str, Any]] = Field(
        default_factory=lambda: {
            "low": {
                "notification": False,
                "auto_acknowledge_hours": 24
            },
            "medium": {
                "notification": True,
                "auto_acknowledge_hours": None
            },
            "high": {
                "notification": True,
                "auto_acknowledge_hours": None,
                "escalate_after_hours": 4
            },
            "critical": {
                "notification": True,
                "auto_acknowledge_hours": None,
                "escalate_after_hours": 1,
                "page_on_call": True
            }
        }
    )
    
    # Alert notification settings
    notification_channels: Dict[str, bool] = Field(
        default_factory=lambda: {
            "email": True,
            "slack": False,
            "webhook": False,
            "sms": False
        }
    )


class PerformanceConfig(BaseModel):
    """Configuration for performance monitoring."""
    
    # Metric aggregation periods
    aggregation_periods: List[str] = Field(
        default_factory=lambda: ["hour", "day", "week", "month"],
        description="Time periods for metric aggregation"
    )
    
    # Performance thresholds
    slow_response_threshold_ms: float = Field(
        default=1000.0,
        description="Response time threshold for slow operation alerts"
    )
    
    very_slow_response_threshold_ms: float = Field(
        default=5000.0,
        description="Response time threshold for critical performance alerts"
    )
    
    # Metric calculation settings
    calculate_percentiles: List[int] = Field(
        default_factory=lambda: [50, 90, 95, 99],
        description="Percentiles to calculate for response times"
    )


class ComplianceConfig(BaseModel):
    """Configuration for compliance and reporting."""
    
    # Report generation
    auto_generate_reports: bool = Field(
        default=True,
        description="Automatically generate periodic compliance reports"
    )
    
    report_generation_schedule: str = Field(
        default="0 0 1 * *",  # First day of month
        description="Cron schedule for report generation"
    )
    
    # Data privacy
    redact_sensitive_data: bool = Field(
        default=True,
        description="Redact sensitive data in logs and reports"
    )
    
    sensitive_fields: Set[str] = Field(
        default_factory=lambda: {
            "password", "new_password", "current_password",
            "token", "api_key", "secret", "credit_card",
            "ssn", "tax_id", "bank_account"
        },
        description="Fields to redact from audit logs"
    )
    
    # Compliance standards
    compliance_standards: List[str] = Field(
        default_factory=lambda: ["GDPR", "SOC2"],
        description="Compliance standards to follow"
    )
    
    # Export settings
    export_formats: List[str] = Field(
        default_factory=lambda: ["json", "csv", "pdf"],
        description="Supported export formats"
    )
    
    max_export_rows: int = Field(
        default=10000,
        description="Maximum rows in a single export"
    )


class AuditSystemConfig(BaseModel):
    """Complete audit system configuration."""
    
    # Feature flags
    enabled: bool = Field(
        default=True,
        description="Enable audit logging system"
    )
    
    enable_integrity_checks: bool = Field(
        default=True,
        description="Enable cryptographic integrity verification"
    )
    
    enable_anomaly_detection: bool = Field(
        default=True,
        description="Enable anomaly detection"
    )
    
    enable_auto_archiving: bool = Field(
        default=True,
        description="Enable automatic archiving of old logs"
    )
    
    enable_performance_tracking: bool = Field(
        default=True,
        description="Enable performance metric tracking"
    )
    
    # Sub-configurations
    retention: AuditRetentionPolicy = Field(
        default_factory=AuditRetentionPolicy
    )
    
    anomaly_detection: AnomalyDetectionConfig = Field(
        default_factory=AnomalyDetectionConfig
    )
    
    alerts: AlertConfig = Field(
        default_factory=AlertConfig
    )
    
    performance: PerformanceConfig = Field(
        default_factory=PerformanceConfig
    )
    
    compliance: ComplianceConfig = Field(
        default_factory=ComplianceConfig
    )
    
    # Database settings
    use_separate_database: bool = Field(
        default=False,
        description="Use separate database for audit logs"
    )
    
    audit_database_url: Optional[str] = Field(
        default=None,
        description="Connection string for audit database"
    )
    
    # Middleware settings
    middleware_enabled: bool = Field(
        default=True,
        description="Enable automatic audit logging via middleware"
    )
    
    middleware_excluded_paths: Set[str] = Field(
        default_factory=lambda: {
            "/admin/health",
            "/admin/metrics",
            "/admin/dashboard"
        },
        description="Paths to exclude from automatic audit logging"
    )
    
    # Scheduled tasks
    archiving_schedule: str = Field(
        default="0 2 * * *",  # 2 AM daily
        description="Cron schedule for archiving old logs"
    )
    
    metrics_calculation_schedule: str = Field(
        default="*/15 * * * *",  # Every 15 minutes
        description="Cron schedule for metric calculation"
    )
    
    integrity_check_schedule: str = Field(
        default="0 */6 * * *",  # Every 6 hours
        description="Cron schedule for integrity verification"
    )


# Default configuration instance
default_audit_config = AuditSystemConfig()


def get_audit_config() -> AuditSystemConfig:
    """
    Get the audit system configuration.
    
    This can be extended to load from environment variables,
    configuration files, or other sources.
    
    Returns:
        AuditSystemConfig instance
    """
    # In a real implementation, this would load from various sources
    # For now, return default configuration
    return default_audit_config