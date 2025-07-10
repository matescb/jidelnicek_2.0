"""Custom exceptions for export operations."""

from typing import Optional, Dict, Any
from datetime import datetime


class ExportException(Exception):
    """Base exception for all export-related errors."""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None,
        recoverable: bool = True
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.recoverable = recoverable
        self.timestamp = datetime.utcnow()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging/API responses."""
        return {
            "error": self.__class__.__name__,
            "export_message": self.message,  # Renamed from 'message' to avoid LogRecord conflicts
            "error_code": self.error_code,
            "details": self.details,
            "recoverable": self.recoverable,
            "error_timestamp": self.timestamp.isoformat()  # Renamed from 'timestamp' to avoid conflicts
        }


class DependencyMissingError(ExportException):
    """Raised when a required dependency for export is missing."""
    
    def __init__(self, dependency: str, export_format: str, fallback_format: Optional[str] = None):
        super().__init__(
            message=f"Missing dependency '{dependency}' for {export_format} export",
            error_code="EXPORT_DEPENDENCY_MISSING",
            details={
                "dependency": dependency,
                "format": export_format,
                "fallback_format": fallback_format
            },
            recoverable=True
        )
        self.dependency = dependency
        self.export_format = export_format
        self.fallback_format = fallback_format


class ExportFormatError(ExportException):
    """Raised when export format is invalid or unsupported."""
    
    def __init__(self, format_type: str, supported_formats: list):
        super().__init__(
            message=f"Unsupported export format: {format_type}",
            error_code="EXPORT_FORMAT_UNSUPPORTED",
            details={
                "requested_format": format_type,
                "supported_formats": supported_formats
            },
            recoverable=True
        )


class ExportDataError(ExportException):
    """Raised when export data is invalid or corrupted."""
    
    def __init__(self, reason: str, data_type: str):
        super().__init__(
            message=f"Export data error: {reason}",
            error_code="EXPORT_DATA_ERROR",
            details={
                "reason": reason,
                "data_type": data_type
            },
            recoverable=False
        )


class ExportResourceError(ExportException):
    """Raised when system resources are exhausted during export."""
    
    def __init__(self, resource_type: str, limit_exceeded: str):
        super().__init__(
            message=f"Resource limit exceeded: {resource_type}",
            error_code="EXPORT_RESOURCE_LIMIT",
            details={
                "resource_type": resource_type,
                "limit": limit_exceeded
            },
            recoverable=True
        )


class ExportPermissionError(ExportException):
    """Raised when user lacks permission for export operation."""
    
    def __init__(self, operation: str, required_permission: str):
        super().__init__(
            message=f"Permission denied for export operation: {operation}",
            error_code="EXPORT_PERMISSION_DENIED",
            details={
                "operation": operation,
                "required_permission": required_permission
            },
            recoverable=False
        )


class ExportTimeoutError(ExportException):
    """Raised when export operation times out."""
    
    def __init__(self, operation: str, timeout_seconds: int):
        super().__init__(
            message=f"Export operation timed out after {timeout_seconds} seconds",
            error_code="EXPORT_TIMEOUT",
            details={
                "operation": operation,
                "timeout_seconds": timeout_seconds
            },
            recoverable=True
        )


class ExportGenerationError(ExportException):
    """Raised when file generation fails during export."""
    
    def __init__(self, file_type: str, reason: str):
        super().__init__(
            message=f"Failed to generate {file_type}: {reason}",
            error_code="EXPORT_GENERATION_FAILED",
            details={
                "file_type": file_type,
                "reason": reason
            },
            recoverable=True
        )


class ExportNetworkError(ExportException):
    """Raised when network issues occur during export (e.g., email sending)."""
    
    def __init__(self, operation: str, network_error: str):
        super().__init__(
            message=f"Network error during {operation}: {network_error}",
            error_code="EXPORT_NETWORK_ERROR",
            details={
                "operation": operation,
                "network_error": network_error
            },
            recoverable=True
        )


class ExportStorageError(ExportException):
    """Raised when storage operations fail during export."""
    
    def __init__(self, operation: str, path: str, reason: str):
        super().__init__(
            message=f"Storage error during {operation}: {reason}",
            error_code="EXPORT_STORAGE_ERROR",
            details={
                "operation": operation,
                "path": path,
                "reason": reason
            },
            recoverable=True
        )


class ExportValidationError(ExportException):
    """Raised when export validation fails."""
    
    def __init__(self, validation_errors: Dict[str, Any]):
        super().__init__(
            message="Export validation failed",
            error_code="EXPORT_VALIDATION_ERROR",
            details={"validation_errors": validation_errors},
            recoverable=False
        )