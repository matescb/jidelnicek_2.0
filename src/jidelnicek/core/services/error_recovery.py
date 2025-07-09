"""Error recovery strategies for export operations."""

import asyncio
import logging
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from functools import wraps
import backoff

from ..exceptions.export_exceptions import (
    ExportException,
    DependencyMissingError,
    ExportResourceError,
    ExportTimeoutError,
    ExportNetworkError
)
from ..cache import cache_manager
from ..monitoring.metrics import MetricsCollector

logger = logging.getLogger(__name__)


class RecoveryStrategy:
    """Base class for recovery strategies."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
    
    async def execute(
        self,
        error: ExportException,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute recovery strategy."""
        raise NotImplementedError


class FallbackFormatStrategy(RecoveryStrategy):
    """Strategy for falling back to alternative export formats."""
    
    FALLBACK_MAPPING = {
        "pdf": ["html", "txt"],
        "xlsx": ["csv", "json"],
        "docx": ["html", "txt"],
        "ics": ["json", "csv"]
    }
    
    async def execute(
        self,
        error: DependencyMissingError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Try fallback export formats."""
        original_format = error.export_format
        fallback_formats = self.FALLBACK_MAPPING.get(original_format, ["json"])
        
        logger.info(
            f"Attempting fallback from {original_format} to {fallback_formats}"
        )
        
        self.metrics_collector.increment(
            "export_fallback_attempts",
            tags={
                "original_format": original_format,
                "reason": "dependency_missing"
            }
        )
        
        return {
            "strategy": "fallback_format",
            "original_format": original_format,
            "available_formats": fallback_formats,
            "message": f"Format {original_format} is not available. "
                      f"Available alternatives: {', '.join(fallback_formats)}"
        }


class ResourceReductionStrategy(RecoveryStrategy):
    """Strategy for reducing resource usage during export."""
    
    async def execute(
        self,
        error: ExportResourceError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Reduce resource usage for export."""
        resource_type = error.details.get("resource_type", "memory")
        
        recommendations = {
            "memory": {
                "batch_size": context.get("batch_size", 1000) // 2,
                "pagination": True,
                "streaming": True
            },
            "cpu": {
                "compression": "none",
                "quality": "draft",
                "parallel_processing": False
            },
            "disk": {
                "temp_cleanup": True,
                "compression": "high",
                "cleanup_interval": 100
            }
        }
        
        reduction_params = recommendations.get(resource_type, {})
        
        logger.info(
            f"Applying resource reduction for {resource_type}: {reduction_params}"
        )
        
        return {
            "strategy": "resource_reduction",
            "resource_type": resource_type,
            "reduction_params": reduction_params,
            "message": "Export will proceed with reduced resource usage"
        }


class AsyncProcessingStrategy(RecoveryStrategy):
    """Strategy for handling timeouts with async processing."""
    
    async def execute(
        self,
        error: ExportTimeoutError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Queue export for async processing."""
        export_id = await self._queue_export(context)
        
        logger.info(f"Export queued for async processing: {export_id}")
        
        self.metrics_collector.increment(
            "export_async_queued",
            tags={"reason": "timeout"}
        )
        
        return {
            "strategy": "async_processing",
            "export_id": export_id,
            "status_url": f"/api/exports/{export_id}/status",
            "message": "Export is being processed. You will be notified when complete."
        }
    
    async def _queue_export(self, context: Dict[str, Any]) -> str:
        """Queue export for background processing."""
        from uuid import uuid4
        export_id = str(uuid4())
        
        # Store export request in cache/queue
        await cache_manager.set(
            f"export_queue:{export_id}",
            {
                "context": context,
                "status": "queued",
                "created_at": datetime.utcnow().isoformat()
            },
            expire=86400  # 24 hours
        )
        
        # TODO: Trigger background task
        
        return export_id


class RetryWithBackoffStrategy(RecoveryStrategy):
    """Strategy for retrying operations with exponential backoff."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        super().__init__(metrics_collector)
        self.max_retries = 3
        self.base_delay = 1.0
    
    async def execute(
        self,
        error: ExportException,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Setup retry parameters for the operation."""
        retry_count = context.get("retry_count", 0)
        
        if retry_count >= self.max_retries:
            return {
                "strategy": "retry_exhausted",
                "retry_count": retry_count,
                "message": "Maximum retry attempts reached"
            }
        
        delay = self.base_delay * (2 ** retry_count)
        
        logger.info(
            f"Scheduling retry {retry_count + 1}/{self.max_retries} "
            f"after {delay}s delay"
        )
        
        return {
            "strategy": "retry_with_backoff",
            "retry_count": retry_count + 1,
            "retry_delay": delay,
            "max_retries": self.max_retries,
            "message": f"Operation will be retried in {delay} seconds"
        }


class ErrorRecoveryService:
    """Service for managing error recovery strategies."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.strategies = {
            "fallback_format": FallbackFormatStrategy(metrics_collector),
            "reduce_resource_usage": ResourceReductionStrategy(metrics_collector),
            "async_processing": AsyncProcessingStrategy(metrics_collector),
            "retry_with_backoff": RetryWithBackoffStrategy(metrics_collector)
        }
        self._recovery_cache = {}
    
    async def attempt_recovery(
        self,
        error: ExportException,
        strategy_name: str,
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Attempt to recover from an error using specified strategy."""
        strategy = self.strategies.get(strategy_name)
        if not strategy:
            logger.warning(f"Unknown recovery strategy: {strategy_name}")
            return None
        
        try:
            # Check if we've recently attempted recovery for similar error
            cache_key = self._get_recovery_cache_key(error, context)
            if cache_key in self._recovery_cache:
                cached_result = self._recovery_cache[cache_key]
                if (datetime.utcnow() - cached_result["timestamp"]).seconds < 300:
                    logger.info("Using cached recovery result")
                    return cached_result["result"]
            
            # Execute recovery strategy
            result = await strategy.execute(error, context)
            
            # Cache successful recovery
            self._recovery_cache[cache_key] = {
                "result": result,
                "timestamp": datetime.utcnow()
            }
            
            # Track recovery success
            self.metrics_collector.increment(
                "export_recovery_success",
                tags={
                    "strategy": strategy_name,
                    "error_type": error.error_code
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Recovery strategy failed: {e}")
            self.metrics_collector.increment(
                "export_recovery_failed",
                tags={
                    "strategy": strategy_name,
                    "error_type": error.error_code
                }
            )
            return None
    
    def _get_recovery_cache_key(
        self,
        error: ExportException,
        context: Dict[str, Any]
    ) -> str:
        """Generate cache key for recovery attempts."""
        return f"{error.error_code}:{context.get('export_format', 'unknown')}"
    
    def clear_recovery_cache(self) -> None:
        """Clear recovery cache."""
        self._recovery_cache.clear()


def with_retry(
    max_attempts: int = 3,
    backoff_factor: float = 2.0,
    exceptions: tuple = (ExportNetworkError, ExportTimeoutError)
):
    """Decorator for adding retry logic to functions."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        @backoff.on_exception(
            backoff.expo,
            exceptions,
            max_tries=max_attempts,
            factor=backoff_factor
        )
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        return wrapper
    return decorator


class CircuitBreaker:
    """Circuit breaker for preventing cascading failures."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    async def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half-open"
            else:
                raise ExportException(
                    message="Service temporarily unavailable",
                    error_code="CIRCUIT_BREAKER_OPEN",
                    details={"recovery_time": self._get_recovery_time()},
                    recoverable=True
                )
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset."""
        return (
            self.last_failure_time and
            (datetime.utcnow() - self.last_failure_time).seconds >= self.recovery_timeout
        )
    
    def _on_success(self) -> None:
        """Handle successful call."""
        self.failure_count = 0
        self.state = "closed"
    
    def _on_failure(self) -> None:
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(
                f"Circuit breaker opened after {self.failure_count} failures"
            )
    
    def _get_recovery_time(self) -> int:
        """Get remaining recovery time in seconds."""
        if not self.last_failure_time:
            return 0
        
        elapsed = (datetime.utcnow() - self.last_failure_time).seconds
        return max(0, self.recovery_timeout - elapsed)