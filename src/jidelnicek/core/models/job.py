"""
Job tracking models for background tasks.

This module defines database models for tracking the status and progress
of background jobs, particularly export operations.
"""

from sqlalchemy import (
    Column, Integer, String, DateTime, Text, JSON,
    ForeignKey, Enum as SQLEnum, Index, Boolean, Float
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from jidelnicek.db.base import Base


class JobStatus(str, enum.Enum):
    """Job status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class JobPriority(str, enum.Enum):
    """Job priority enumeration."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class JobType(str, enum.Enum):
    """Job type enumeration."""
    EXPORT_SHOPPING_LIST = "export_shopping_list"
    EXPORT_TRIP_DATA = "export_trip_data"
    EXPORT_RECIPES = "export_recipes"
    EXPORT_DATASET = "export_dataset"
    IMPORT_DATA = "import_data"
    GENERATE_REPORT = "generate_report"
    SEND_EMAIL = "send_email"
    CLEANUP = "cleanup"
    OTHER = "other"


class Job(Base):
    """
    Model for tracking background jobs.
    
    This model stores information about background tasks, their status,
    progress, and results. It's used to provide users with feedback
    about long-running operations.
    """
    
    __tablename__ = "jobs"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Job identification
    task_id = Column(String(255), unique=True, nullable=False, index=True)
    job_type = Column(SQLEnum(JobType), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Status tracking
    status = Column(SQLEnum(JobStatus), nullable=False, default=JobStatus.PENDING, index=True)
    priority = Column(SQLEnum(JobPriority), nullable=False, default=JobPriority.NORMAL, index=True)
    progress = Column(Float, default=0.0)  # 0.0 to 100.0
    progress_message = Column(String(500))
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    eta = Column(DateTime(timezone=True))  # Estimated time of arrival
    
    # User association
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user = relationship("User", back_populates="jobs")
    
    # Job parameters and results
    parameters = Column(JSON, default=dict)
    result = Column(JSON)
    error_message = Column(Text)
    error_traceback = Column(Text)
    
    # Retry information
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    retry_delay = Column(Integer, default=60)  # seconds
    
    # Resource tracking
    queue_name = Column(String(50), default="default")
    worker_name = Column(String(255))
    
    # Notification settings
    notify_on_completion = Column(Boolean, default=False)
    notify_on_failure = Column(Boolean, default=True)
    notification_sent = Column(Boolean, default=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True))
    
    # Indexes for common queries
    __table_args__ = (
        Index("idx_job_user_status", "user_id", "status"),
        Index("idx_job_type_status", "job_type", "status"),
        Index("idx_job_created_at", "created_at"),
        Index("idx_job_priority_status", "priority", "status"),
    )
    
    def __repr__(self):
        return f"<Job(id={self.id}, task_id={self.task_id}, type={self.job_type}, status={self.status})>"
    
    @property
    def is_terminal(self) -> bool:
        """Check if job is in a terminal state."""
        return self.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]
    
    @property
    def can_retry(self) -> bool:
        """Check if job can be retried."""
        return (
            self.status == JobStatus.FAILED and
            self.retry_count < self.max_retries
        )
    
    @property
    def duration(self) -> float:
        """Get job duration in seconds."""
        if not self.started_at:
            return 0.0
        
        end_time = self.completed_at or datetime.utcnow()
        return (end_time - self.started_at).total_seconds()
    
    def to_dict(self) -> dict:
        """Convert job to dictionary representation."""
        return {
            "id": self.id,
            "task_id": self.task_id,
            "job_type": self.job_type.value,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "priority": self.priority.value,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "eta": self.eta.isoformat() if self.eta else None,
            "duration": self.duration,
            "user_id": self.user_id,
            "parameters": self.parameters,
            "result": self.result,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "queue_name": self.queue_name,
            "worker_name": self.worker_name,
        }


class JobNotification(Base):
    """
    Model for tracking job notifications.
    
    This model stores information about notifications sent for job
    status changes, helping prevent duplicate notifications.
    """
    
    __tablename__ = "job_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Job association
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    job = relationship("Job", backref="notifications")
    
    # Notification details
    notification_type = Column(String(50), nullable=False)  # email, sms, push, webhook
    recipient = Column(String(255), nullable=False)
    subject = Column(String(500))
    message = Column(Text)
    
    # Status
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    delivered = Column(Boolean, default=False)
    delivery_error = Column(Text)
    
    # Metadata
    metadata = Column(JSON, default=dict)
    
    def __repr__(self):
        return f"<JobNotification(id={self.id}, job_id={self.job_id}, type={self.notification_type})>"