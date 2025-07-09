"""
Database models for export functionality.

Defines models for tracking export jobs, presets, and history.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
import uuid

from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, Text,
    ForeignKey, Enum, JSON, Float, Index, BigInteger
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from ....db.base import Base
from ..schemas.export_schemas import ExportType, ExportFormat, ExportStatus


class ExportJob(Base):
    """Model for tracking export jobs."""
    
    __tablename__ = "export_jobs"
    __table_args__ = (
        Index("idx_export_jobs_user_status", "user_id", "status"),
        Index("idx_export_jobs_batch", "batch_id"),
        Index("idx_export_jobs_created", "created_at"),
    )
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User reference
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Export details
    export_type = Column(Enum(ExportType), nullable=False)
    export_format = Column(Enum(ExportFormat), nullable=False)
    item_ids = Column(JSON, nullable=False)  # List of item IDs to export
    options = Column(JSON, nullable=False, default=dict)
    
    # Job status
    status = Column(Enum(ExportStatus), nullable=False, default=ExportStatus.PENDING)
    progress = Column(Float, default=0.0)  # 0-100
    total_items = Column(Integer)
    processed_items = Column(Integer, default=0)
    
    # Batch handling
    batch_id = Column(PostgresUUID(as_uuid=True), index=True)
    
    # Result storage
    file_path = Column(String(500))  # Path in storage service
    file_size = Column(BigInteger)  # Size in bytes
    mime_type = Column(String(100))
    
    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    expires_at = Column(DateTime)  # When the export file will be deleted
    
    # Usage tracking
    download_count = Column(Integer, default=0)
    last_downloaded_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="export_jobs")
    
    def __repr__(self):
        return f"<ExportJob {self.id} - {self.export_type.value}/{self.export_format.value} - {self.status.value}>"


class ExportPreset(Base):
    """Model for storing export presets/templates."""
    
    __tablename__ = "export_presets"
    __table_args__ = (
        Index("idx_export_presets_user", "user_id"),
        Index("idx_export_presets_public", "is_public"),
    )
    
    # Primary key
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User reference (null for system presets)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    # Preset details
    name = Column(String(100), nullable=False)
    description = Column(Text)
    export_type = Column(Enum(ExportType), nullable=False)
    export_format = Column(Enum(ExportFormat), nullable=False)
    options = Column(JSON, nullable=False, default=dict)
    
    # Visibility
    is_public = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="export_presets")
    
    def __repr__(self):
        return f"<ExportPreset {self.id} - {self.name}>"


class ExportQuota(Base):
    """Model for tracking user export quotas."""
    
    __tablename__ = "export_quotas"
    
    # Primary key
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    
    # Daily limits
    exports_today = Column(Integer, default=0)
    daily_limit = Column(Integer, default=100)
    daily_reset_at = Column(DateTime)
    
    # Monthly limits
    exports_this_month = Column(Integer, default=0)
    monthly_limit = Column(Integer, default=1000)
    monthly_reset_at = Column(DateTime)
    
    # Size limits
    total_size_bytes = Column(BigInteger, default=0)
    size_limit_bytes = Column(BigInteger, default=1073741824)  # 1GB default
    
    # Custom limits by format
    format_limits = Column(JSON, default=dict)  # {"pdf": 50, "excel": 100, ...}
    format_usage = Column(JSON, default=dict)   # {"pdf": 10, "excel": 25, ...}
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="export_quota", uselist=False)
    
    def __repr__(self):
        return f"<ExportQuota user_id={self.user_id} daily={self.exports_today}/{self.daily_limit}>"


class ExportStatistics(Base):
    """Model for aggregated export statistics."""
    
    __tablename__ = "export_statistics"
    __table_args__ = (
        Index("idx_export_stats_date", "date"),
        Index("idx_export_stats_user_date", "user_id", "date"),
    )
    
    # Composite primary key
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    date = Column(DateTime, nullable=False)
    
    # Export counts
    total_exports = Column(Integer, default=0)
    successful_exports = Column(Integer, default=0)
    failed_exports = Column(Integer, default=0)
    
    # Breakdown by type
    exports_by_type = Column(JSON, default=dict)  # {"trip": 10, "recipe": 5, ...}
    
    # Breakdown by format
    exports_by_format = Column(JSON, default=dict)  # {"pdf": 8, "excel": 7, ...}
    
    # Performance metrics
    total_duration_ms = Column(BigInteger, default=0)
    average_duration_ms = Column(Float)
    min_duration_ms = Column(Integer)
    max_duration_ms = Column(Integer)
    
    # Size metrics
    total_size_bytes = Column(BigInteger, default=0)
    average_size_bytes = Column(Float)
    
    # Error tracking
    error_types = Column(JSON, default=dict)  # {"validation": 2, "generation": 1, ...}
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="export_statistics")
    
    def __repr__(self):
        return f"<ExportStatistics user_id={self.user_id} date={self.date} total={self.total_exports}>"