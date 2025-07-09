"""Global error handling middleware for export operations."""

import logging
import traceback
from typing import Callable, Optional, Dict, Any
from functools import wraps
from datetime import datetime

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.exc import SQLAlchemyError

from ..exceptions.export_exceptions import (
    ExportException,
    DependencyMissingError,
    ExportResourceError,
    ExportTimeoutError
)
from ..services.error_recovery import ErrorRecoveryService
from ..services.notification_service import NotificationService
from ..monitoring.metrics import MetricsCollector

logger = logging.getLogger(__name__)


class ExportErrorHandler:
    """Handles export-related errors with recovery strategies."""
    
    def __init__(
        self,
        recovery_service: ErrorRecoveryService,
        notification_service: NotificationService,
        metrics_collector: MetricsCollector
    ):
        self.recovery_service = recovery_service
        self.notification_service = notification_service
        self.metrics_collector = metrics_collector
        
    def handle_export_error(
        self,
        error: Exception,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle export errors with appropriate recovery strategies."""
        # Log error with context
        self._log_error(error, context)
        
        # Track error metrics
        self._track_error_metrics(error, context)
        
        # Determine recovery strategy
        recovery_strategy = self._determine_recovery_strategy(error)
        
        # Attempt recovery if possible
        recovery_result = None
        if recovery_strategy and isinstance(error, ExportException) and error.recoverable:
            recovery_result = self.recovery_service.attempt_recovery(
                error, recovery_strategy, context
            )
        
        # Send notifications for critical errors
        if self._is_critical_error(error):
            self._send_error_notification(error, context)
        
        # Build error response
        return self._build_error_response(error, recovery_result)
    
    def _log_error(self, error: Exception, context: Dict[str, Any]) -> None:
        """Log error with full context."""
        error_data = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "context": context,
            "timestamp": datetime.utcnow().isoformat(),
            "traceback": traceback.format_exc()
        }
        
        if isinstance(error, ExportException):
            error_data.update(error.to_dict())
            logger.error(f"Export error: {error.error_code}", extra=error_data)
        else:
            logger.error("Unexpected error during export", extra=error_data)
    
    def _track_error_metrics(self, error: Exception, context: Dict[str, Any]) -> None:
        """Track error metrics for monitoring."""
        error_type = type(error).__name__
        export_format = context.get("export_format", "unknown")
        
        self.metrics_collector.increment(
            "export_errors_total",
            tags={
                "error_type": error_type,
                "export_format": export_format,
                "recoverable": str(isinstance(error, ExportException) and error.recoverable)
            }
        )
    
    def _determine_recovery_strategy(self, error: Exception) -> Optional[str]:
        """Determine appropriate recovery strategy based on error type."""
        if isinstance(error, DependencyMissingError):
            return "fallback_format"
        elif isinstance(error, ExportResourceError):
            return "reduce_resource_usage"
        elif isinstance(error, ExportTimeoutError):
            return "async_processing"
        elif isinstance(error, ExportException):
            return "retry_with_backoff"
        return None
    
    def _is_critical_error(self, error: Exception) -> bool:
        """Determine if error is critical and requires notification."""
        critical_error_types = [
            ExportResourceError,
            SQLAlchemyError
        ]
        return any(isinstance(error, error_type) for error_type in critical_error_types)
    
    def _send_error_notification(self, error: Exception, context: Dict[str, Any]) -> None:
        """Send notification for critical errors."""
        try:
            self.notification_service.send_admin_notification(
                subject=f"Critical Export Error: {type(error).__name__}",
                message=self._format_error_notification(error, context)
            )
        except Exception as e:
            logger.error(f"Failed to send error notification: {e}")
    
    def _format_error_notification(self, error: Exception, context: Dict[str, Any]) -> str:
        """Format error notification message."""
        return f"""
Critical export error occurred:

Error Type: {type(error).__name__}
Message: {str(error)}
Time: {datetime.utcnow().isoformat()}
Context: {context}

Please investigate immediately.
"""
    
    def _build_error_response(
        self,
        error: Exception,
        recovery_result: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build user-friendly error response."""
        if isinstance(error, ExportException):
            response = {
                "error": error.error_code,
                "message": self._get_user_friendly_message(error),
                "details": error.details,
                "recoverable": error.recoverable
            }
        else:
            response = {
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred during export",
                "recoverable": False
            }
        
        if recovery_result:
            response["recovery"] = recovery_result
        
        return response
    
    def _get_user_friendly_message(self, error: ExportException) -> str:
        """Get user-friendly error message with translations."""
        # TODO: Implement translation based on user locale
        messages = {
            "EXPORT_DEPENDENCY_MISSING": "The requested export format is not available. Please try a different format.",
            "EXPORT_FORMAT_UNSUPPORTED": "The export format you requested is not supported.",
            "EXPORT_DATA_ERROR": "There was a problem with the data. Please try again.",
            "EXPORT_RESOURCE_LIMIT": "The system is busy. Please try again in a few moments.",
            "EXPORT_PERMISSION_DENIED": "You don't have permission to perform this export.",
            "EXPORT_TIMEOUT": "The export took too long. Please try a smaller date range.",
            "EXPORT_GENERATION_FAILED": "Failed to generate the export file. Please try again.",
            "EXPORT_NETWORK_ERROR": "Network error occurred. Please check your connection.",
            "EXPORT_STORAGE_ERROR": "Storage error occurred. Please contact support.",
            "EXPORT_VALIDATION_ERROR": "Invalid export parameters. Please check your input."
        }
        return messages.get(error.error_code, error.message)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for handling errors in HTTP requests."""
    
    def __init__(self, app, error_handler: ExportErrorHandler):
        super().__init__(app)
        self.error_handler = error_handler
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle errors in HTTP requests."""
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            context = {
                "path": request.url.path,
                "method": request.method,
                "headers": dict(request.headers),
                "query_params": dict(request.query_params)
            }
            
            error_response = self.error_handler.handle_export_error(e, context)
            
            # Determine status code
            status_code = 500
            if isinstance(e, HTTPException):
                status_code = e.status_code
            elif isinstance(e, ExportException):
                status_code = self._get_status_code_for_export_error(e)
            
            return JSONResponse(
                status_code=status_code,
                content=error_response
            )
    
    def _get_status_code_for_export_error(self, error: ExportException) -> int:
        """Map export errors to HTTP status codes."""
        status_map = {
            "EXPORT_PERMISSION_DENIED": 403,
            "EXPORT_FORMAT_UNSUPPORTED": 400,
            "EXPORT_VALIDATION_ERROR": 400,
            "EXPORT_RESOURCE_LIMIT": 503,
            "EXPORT_TIMEOUT": 504,
            "EXPORT_DEPENDENCY_MISSING": 501
        }
        return status_map.get(error.error_code, 500)


def handle_export_errors(func: Callable) -> Callable:
    """Decorator for handling errors in export functions."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ExportException:
            raise  # Re-raise export exceptions to be handled by middleware
        except Exception as e:
            # Convert unexpected errors to ExportException
            raise ExportException(
                message=str(e),
                error_code="EXPORT_UNEXPECTED_ERROR",
                details={"original_error": type(e).__name__},
                recoverable=True
            )
    return wrapper