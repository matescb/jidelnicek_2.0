"""Database models for monitoring and error tracking."""

from sqlalchemy import (
    Column, Integer, String, DateTime, JSON, Text, Boolean,
    ForeignKey, Index, Float
)
from sqlalchemy.orm import relationship
from datetime import datetime

from ..database import Base


class ErrorLog(Base):
    """Model for storing error logs."""
    
    __tablename__ = "error_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    error_id = Column(String(50), unique=True, index=True, nullable=False)
    error_type = Column(String(100), index=True, nullable=False)
    error_code = Column(String(50), index=True)
    error_message = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    context = Column(JSON, nullable=False, default=dict)
    traceback = Column(Text)
    system_info = Column(JSON)
    recoverable = Column(Boolean, default=True)
    recovery_attempted = Column(Boolean, default=False)
    recovery_strategy = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="error_logs")
    
    # Indexes for common queries
    __table_args__ = (
        Index("idx_error_type_created", "error_type", "created_at"),
        Index("idx_user_errors", "user_id", "created_at"),
        Index("idx_error_code_created", "error_code", "created_at"),
    )


class ErrorPattern(Base):
    """Model for tracking error patterns."""
    
    __tablename__ = "error_patterns"
    
    id = Column(Integer, primary_key=True, index=True)
    pattern_key = Column(String(200), unique=True, index=True, nullable=False)
    error_type = Column(String(100), nullable=False)
    export_format = Column(String(50))
    count = Column(Integer, default=0)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, index=True)
    alert_sent = Column(Boolean, default=False)
    alert_threshold = Column(Integer, default=10)
    
    __table_args__ = (
        Index("idx_pattern_activity", "last_seen", "count"),
    )


class ExportMetric(Base):
    """Model for storing export metrics."""
    
    __tablename__ = "export_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(100), index=True, nullable=False)
    export_format = Column(String(50), index=True)
    value = Column(Float, nullable=False)
    tags = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index("idx_metric_time", "metric_name", "timestamp"),
        Index("idx_format_metric", "export_format", "metric_name", "timestamp"),
    )


class PerformanceLog(Base):
    """Model for tracking export performance."""
    
    __tablename__ = "performance_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation = Column(String(100), index=True, nullable=False)
    export_format = Column(String(50), index=True)
    duration_ms = Column(Integer, nullable=False)
    record_count = Column(Integer)
    file_size_bytes = Column(Integer)
    memory_used_mb = Column(Float)
    cpu_percent = Column(Float)
    success = Column(Boolean, default=True)
    error_id = Column(String(50), ForeignKey("error_logs.error_id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    error = relationship("ErrorLog", backref="performance_logs")
    user = relationship("User", back_populates="performance_logs")
    
    __table_args__ = (
        Index("idx_perf_operation", "operation", "created_at"),
        Index("idx_perf_format", "export_format", "created_at"),
        Index("idx_perf_duration", "duration_ms", "created_at"),
    )


class RecoveryLog(Base):
    """Model for tracking error recovery attempts."""
    
    __tablename__ = "recovery_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    error_id = Column(String(50), ForeignKey("error_logs.error_id"), nullable=False)
    strategy = Column(String(50), nullable=False)
    success = Column(Boolean, nullable=False)
    result = Column(JSON)
    duration_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    error = relationship("ErrorLog", backref="recovery_attempts")
    
    __table_args__ = (
        Index("idx_recovery_error", "error_id", "created_at"),
        Index("idx_recovery_strategy", "strategy", "success"),
    )