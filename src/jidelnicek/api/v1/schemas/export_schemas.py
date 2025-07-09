"""
Export API schemas.

Defines request and response models for the unified export API.
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator


class ExportType(str, Enum):
    """Types of items that can be exported."""
    TRIP = "trip"
    RECIPE = "recipe"
    SHOPPING_LIST = "shopping_list"


class ExportFormat(str, Enum):
    """Supported export formats."""
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    JSON = "json"
    HTML = "html"
    TEXT = "text"
    MARKDOWN = "markdown"


class ExportStatus(str, Enum):
    """Status of an export job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExportRequest(BaseModel):
    """Base export request."""
    export_type: ExportType
    export_format: ExportFormat
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ExportResponse(BaseModel):
    """Response for synchronous export."""
    filename: str
    mime_type: str
    file_size: int
    content: bytes
    metadata: Optional[Dict[str, Any]] = None


class ExportJobResponse(BaseModel):
    """Response for asynchronous export job."""
    job_id: UUID
    status: ExportStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    export_type: ExportType
    export_format: ExportFormat
    progress: Optional[float] = Field(None, ge=0, le=100)
    error_message: Optional[str] = None
    result_url: Optional[str] = None
    file_size: Optional[int] = None


class ExportHistoryResponse(BaseModel):
    """Export history item."""
    job_id: UUID
    export_type: ExportType
    export_format: ExportFormat
    status: ExportStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    file_size: Optional[int] = None
    filename: Optional[str] = None
    download_count: int = 0
    expires_at: Optional[datetime] = None


class BatchExportItem(BaseModel):
    """Single item in a batch export request."""
    export_type: ExportType
    export_format: ExportFormat
    item_ids: List[Union[int, str]]
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    merge_into_single_file: bool = False


class BatchExportRequest(BaseModel):
    """Request for batch export."""
    exports: List[BatchExportItem]
    notification_email: Optional[str] = None
    webhook_url: Optional[str] = None


class BatchExportResponse(BaseModel):
    """Response for batch export request."""
    batch_id: UUID
    job_count: int
    status: ExportStatus
    created_at: datetime
    jobs: Optional[List[ExportJobResponse]] = None


class ExportPresetRequest(BaseModel):
    """Request to create an export preset."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    export_type: ExportType
    export_format: ExportFormat
    options: Dict[str, Any] = Field(default_factory=dict)
    is_public: bool = False


class ExportPresetResponse(BaseModel):
    """Export preset details."""
    id: UUID
    name: str
    description: Optional[str] = None
    export_type: ExportType
    export_format: ExportFormat
    options: Dict[str, Any]
    is_public: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    usage_count: int = 0


class ExportMetrics(BaseModel):
    """Export metrics for monitoring."""
    total_exports: int
    exports_by_type: Dict[str, int]
    exports_by_format: Dict[str, int]
    average_duration_ms: float
    average_file_size_bytes: float
    success_rate: float
    peak_hour: Optional[int] = None
    most_popular_format: Optional[str] = None


class ExportQuota(BaseModel):
    """User's export quota information."""
    used_today: int
    limit_daily: int
    used_this_month: int
    limit_monthly: int
    next_reset: datetime


# Validation helpers
class ExportOptionsValidator:
    """Validates export options based on format."""
    
    @staticmethod
    def validate_pdf_options(options: Dict[str, Any]) -> Dict[str, Any]:
        """Validate PDF-specific options."""
        valid_options = {
            "page_size": ["A4", "letter", "legal"],
            "orientation": ["portrait", "landscape"],
            "margin": (10, 50),
            "font_size": (8, 14),
            "include_toc": bool,
            "include_page_numbers": bool
        }
        
        validated = {}
        for key, value in options.items():
            if key in valid_options:
                constraint = valid_options[key]
                if isinstance(constraint, list) and value in constraint:
                    validated[key] = value
                elif isinstance(constraint, tuple) and constraint[0] <= value <= constraint[1]:
                    validated[key] = value
                elif isinstance(constraint, type) and isinstance(value, constraint):
                    validated[key] = value
                    
        return validated
    
    @staticmethod
    def validate_excel_options(options: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Excel-specific options."""
        valid_options = {
            "include_formulas": bool,
            "include_charts": bool,
            "freeze_headers": bool,
            "auto_filter": bool,
            "separate_sheets": bool
        }
        
        validated = {}
        for key, value in options.items():
            if key in valid_options and isinstance(value, valid_options[key]):
                validated[key] = value
                
        return validated
    
    @staticmethod
    def validate_csv_options(options: Dict[str, Any]) -> Dict[str, Any]:
        """Validate CSV-specific options."""
        valid_options = {
            "delimiter": [",", ";", "\t", "|"],
            "quote_char": ["\"", "'"],
            "encoding": ["utf-8", "utf-16", "windows-1250"],
            "include_headers": bool
        }
        
        validated = {}
        for key, value in options.items():
            if key in valid_options:
                constraint = valid_options[key]
                if isinstance(constraint, list) and value in constraint:
                    validated[key] = value
                elif isinstance(constraint, type) and isinstance(value, constraint):
                    validated[key] = value
                    
        return validated