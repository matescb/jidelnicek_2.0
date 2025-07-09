"""Wrapper for export services with error handling and recovery."""

import logging
from typing import Any, Dict, Optional, Callable, TypeVar, Union
from functools import wraps
import asyncio

from ..exceptions.export_exceptions import (
    ExportException,
    DependencyMissingError,
    ExportTimeoutError,
    ExportResourceError
)
from .error_recovery import ErrorRecoveryService, CircuitBreaker
from .export_error_logger import ExportErrorLogger
from .export_fallback import FallbackExporter
from ..monitoring.metrics import MetricsCollector

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ExportServiceWrapper:
    """Wraps export services with error handling and recovery capabilities."""
    
    def __init__(
        self,
        recovery_service: ErrorRecoveryService,
        error_logger: ExportErrorLogger,
        metrics_collector: MetricsCollector,
        timeout_seconds: int = 300
    ):
        self.recovery_service = recovery_service
        self.error_logger = error_logger
        self.metrics_collector = metrics_collector
        self.timeout_seconds = timeout_seconds
        self.fallback_exporter = FallbackExporter()
        
        # Circuit breakers for different export types
        self.circuit_breakers = {}
    
    def wrap_export_method(
        self,
        export_format: str,
        required_dependencies: Optional[list] = None
    ) -> Callable:
        """Decorator to wrap export methods with error handling."""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs) -> Any:
                context = {
                    "export_format": export_format,
                    "function": func.__name__,
                    "args": str(args)[:100],  # Truncate for logging
                    "kwargs": str(kwargs)[:100]
                }
                
                try:
                    # Check dependencies
                    if required_dependencies:
                        self._check_dependencies(required_dependencies, export_format)
                    
                    # Get or create circuit breaker
                    if export_format not in self.circuit_breakers:
                        self.circuit_breakers[export_format] = CircuitBreaker(
                            failure_threshold=3,
                            recovery_timeout=60
                        )
                    
                    # Execute with timeout and circuit breaker
                    circuit_breaker = self.circuit_breakers[export_format]
                    result = await circuit_breaker.call(
                        self._execute_with_timeout,
                        func,
                        args,
                        kwargs,
                        self.timeout_seconds
                    )
                    
                    # Track success
                    self.metrics_collector.increment(
                        "export_success",
                        tags={"format": export_format}
                    )
                    
                    return result
                    
                except ExportException as e:
                    # Handle known export exceptions
                    return await self._handle_export_error(e, context, args, kwargs)
                    
                except Exception as e:
                    # Handle unexpected exceptions
                    export_error = ExportException(
                        message=str(e),
                        error_code="EXPORT_UNEXPECTED",
                        details={"original_error": type(e).__name__}
                    )
                    return await self._handle_export_error(
                        export_error,
                        context,
                        args,
                        kwargs
                    )
            
            return wrapper
        return decorator
    
    async def _execute_with_timeout(
        self,
        func: Callable,
        args: tuple,
        kwargs: dict,
        timeout: int
    ) -> Any:
        """Execute function with timeout."""
        try:
            return await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            raise ExportTimeoutError(
                operation=func.__name__,
                timeout_seconds=timeout
            )
    
    def _check_dependencies(
        self,
        dependencies: list,
        export_format: str
    ) -> None:
        """Check if required dependencies are available."""
        missing = []
        for dep in dependencies:
            try:
                __import__(dep)
            except ImportError:
                missing.append(dep)
        
        if missing:
            # Determine fallback format
            fallback_map = {
                "pdf": "html",
                "xlsx": "csv",
                "docx": "html"
            }
            fallback = fallback_map.get(export_format, "json")
            
            raise DependencyMissingError(
                dependency=missing[0],
                export_format=export_format,
                fallback_format=fallback
            )
    
    async def _handle_export_error(
        self,
        error: ExportException,
        context: Dict[str, Any],
        args: tuple,
        kwargs: dict
    ) -> Any:
        """Handle export error with recovery strategies."""
        # Log error
        error_id = await self.error_logger.log_export_error(
            error,
            context,
            user_id=kwargs.get("user_id")
        )
        context["error_id"] = error_id
        
        # Try recovery based on error type
        if isinstance(error, DependencyMissingError):
            # Try fallback format
            return await self._try_fallback_format(
                error,
                context,
                args,
                kwargs
            )
        
        elif isinstance(error, ExportResourceError):
            # Try with reduced resources
            recovery_result = await self.recovery_service.attempt_recovery(
                error,
                "reduce_resource_usage",
                context
            )
            
            if recovery_result:
                # Retry with reduced parameters
                new_kwargs = kwargs.copy()
                new_kwargs.update(recovery_result.get("reduction_params", {}))
                
                # Note: This would need the original function reference
                # In practice, you'd store this in the wrapper
                logger.info(f"Retrying with reduced resources: {new_kwargs}")
        
        # Return error response
        raise error
    
    async def _try_fallback_format(
        self,
        error: DependencyMissingError,
        context: Dict[str, Any],
        args: tuple,
        kwargs: dict
    ) -> Any:
        """Try exporting with fallback format."""
        fallback_format = error.fallback_format or "json"
        
        logger.info(
            f"Attempting fallback from {error.export_format} to {fallback_format}"
        )
        
        # Get data from args/kwargs
        # This assumes the first arg is the data to export
        data = args[0] if args else kwargs.get("data", {})
        
        # Use fallback exporter
        if fallback_format == "json":
            result = await self.fallback_exporter.export_to_json(data)
        elif fallback_format == "csv":
            result = await self.fallback_exporter.export_to_csv(data)
        elif fallback_format == "html":
            result = await self.fallback_exporter.export_to_html(
                data,
                title=kwargs.get("title", "Export")
            )
        elif fallback_format == "txt":
            result = await self.fallback_exporter.export_to_txt(data)
        else:
            raise ExportException(
                message=f"No fallback available for {error.export_format}",
                error_code="NO_FALLBACK_AVAILABLE",
                recoverable=False
            )
        
        # Track fallback usage
        self.metrics_collector.increment(
            "export_fallback_used",
            tags={
                "original_format": error.export_format,
                "fallback_format": fallback_format
            }
        )
        
        return {
            "content": result,
            "format": fallback_format,
            "fallback_used": True,
            "original_format": error.export_format,
            "reason": str(error)
        }


def with_export_error_handling(
    export_format: str,
    required_dependencies: Optional[list] = None,
    timeout: int = 300
):
    """Decorator for adding error handling to export functions."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # Ensure service has error handling components
            if not hasattr(self, "_export_wrapper"):
                logger.warning(
                    "Export service missing error handling wrapper, "
                    "falling back to basic error handling"
                )
                try:
                    return await func(self, *args, **kwargs)
                except Exception as e:
                    logger.error(f"Export error in {func.__name__}: {e}")
                    raise
            
            # Use wrapper for error handling
            wrapped_func = self._export_wrapper.wrap_export_method(
                export_format,
                required_dependencies
            )(func)
            
            return await wrapped_func(self, *args, **kwargs)
        
        return wrapper
    return decorator


class ExportResourceManager:
    """Manages resources for export operations."""
    
    def __init__(self, max_concurrent_exports: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent_exports)
        self.active_exports = {}
    
    async def acquire_resources(
        self,
        export_id: str,
        estimated_memory_mb: int = 100
    ) -> bool:
        """Acquire resources for export operation."""
        import psutil
        
        # Check available memory
        available_memory = psutil.virtual_memory().available / (1024 * 1024)
        
        if available_memory < estimated_memory_mb * 2:  # Safety margin
            raise ExportResourceError(
                resource_type="memory",
                limit_exceeded=f"Need {estimated_memory_mb}MB, "
                              f"only {available_memory:.0f}MB available"
            )
        
        # Acquire semaphore
        acquired = await self.semaphore.acquire()
        if acquired:
            self.active_exports[export_id] = {
                "started_at": asyncio.get_event_loop().time(),
                "estimated_memory": estimated_memory_mb
            }
        
        return acquired
    
    def release_resources(self, export_id: str) -> None:
        """Release resources after export."""
        if export_id in self.active_exports:
            del self.active_exports[export_id]
            self.semaphore.release()
    
    async def __aenter__(self):
        """Context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        # Clean up any remaining exports
        for export_id in list(self.active_exports.keys()):
            self.release_resources(export_id)