"""Tests for export error handling and recovery."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
import asyncio
from datetime import datetime, timedelta

from jidelnicek.core.exceptions.export_exceptions import (
    ExportException,
    DependencyMissingError,
    ExportResourceError,
    ExportTimeoutError,
    ExportPermissionError,
    ExportDataError,
    ExportGenerationError
)
from jidelnicek.core.middleware.error_handler import (
    ExportErrorHandler,
    ErrorHandlingMiddleware,
    handle_export_errors
)
from jidelnicek.core.services.error_recovery import (
    ErrorRecoveryService,
    FallbackFormatStrategy,
    ResourceReductionStrategy,
    AsyncProcessingStrategy,
    RetryWithBackoffStrategy,
    CircuitBreaker
)
from jidelnicek.core.services.export_error_logger import (
    ExportErrorLogger,
    ErrorContextEnricher
)
from jidelnicek.core.monitoring.metrics import MetricsCollector


@pytest.fixture
def metrics_collector():
    """Create metrics collector."""
    return MetricsCollector()


@pytest.fixture
def recovery_service(metrics_collector):
    """Create error recovery service."""
    return ErrorRecoveryService(metrics_collector)


@pytest.fixture
def notification_service():
    """Create mock notification service."""
    service = AsyncMock()
    service.send_admin_notification = AsyncMock(return_value=True)
    return service


@pytest.fixture
def error_logger(tmp_path, metrics_collector):
    """Create error logger."""
    return ExportErrorLogger(tmp_path / "logs", metrics_collector)


@pytest.fixture
def error_handler(recovery_service, notification_service, metrics_collector):
    """Create error handler."""
    return ExportErrorHandler(
        recovery_service,
        notification_service,
        metrics_collector
    )


class TestExportExceptions:
    """Test custom export exceptions."""
    
    def test_export_exception_base(self):
        """Test base export exception."""
        error = ExportException(
            message="Test error",
            error_code="TEST_ERROR",
            details={"key": "value"},
            recoverable=True
        )
        
        assert str(error) == "Test error"
        assert error.error_code == "TEST_ERROR"
        assert error.details == {"key": "value"}
        assert error.recoverable is True
        assert isinstance(error.timestamp, datetime)
        
        # Test to_dict
        error_dict = error.to_dict()
        assert error_dict["error"] == "ExportException"
        assert error_dict["export_message"] == "Test error"  # Updated field name
        assert error_dict["error_code"] == "TEST_ERROR"
    
    def test_dependency_missing_error(self):
        """Test dependency missing error."""
        error = DependencyMissingError(
            dependency="reportlab",
            export_format="pdf",
            fallback_format="html"
        )
        
        assert "reportlab" in str(error)
        assert error.dependency == "reportlab"
        assert error.export_format == "pdf"
        assert error.fallback_format == "html"
        assert error.recoverable is True
    
    def test_export_resource_error(self):
        """Test resource error."""
        error = ExportResourceError(
            resource_type="memory",
            limit_exceeded="500MB"
        )
        
        assert "memory" in str(error)
        assert error.details["resource_type"] == "memory"
        assert error.recoverable is True
    
    def test_export_permission_error(self):
        """Test permission error."""
        error = ExportPermissionError(
            operation="export_all_users",
            required_permission="admin"
        )
        
        assert "Permission denied" in str(error)
        assert error.recoverable is False


class TestErrorHandler:
    """Test error handler functionality."""
    
    @pytest.mark.asyncio
    async def test_handle_export_error_with_recovery(self, error_handler):
        """Test handling error with recovery."""
        error = DependencyMissingError("reportlab", "pdf", "html")
        context = {"export_format": "pdf", "user_id": 123}
        
        with patch.object(
            error_handler.recovery_service,
            'attempt_recovery',
            return_value={"strategy": "fallback_format", "format": "html"}
        ):
            result = error_handler.handle_export_error(error, context)
            
            assert result["error"] == "EXPORT_DEPENDENCY_MISSING"
            assert result["recoverable"] is True
            assert "recovery" in result
    
    @pytest.mark.asyncio
    async def test_handle_critical_error(self, error_handler, notification_service):
        """Test handling critical error with notification."""
        error = ExportResourceError("memory", "1GB")
        context = {"export_format": "xlsx"}
        
        result = error_handler.handle_export_error(error, context)
        
        # Should send notification for critical error
        notification_service.send_admin_notification.assert_called_once()
        assert result["error"] == "EXPORT_RESOURCE_LIMIT"
    
    def test_user_friendly_messages(self, error_handler):
        """Test user-friendly error messages."""
        errors = [
            (DependencyMissingError("lib", "pdf"), "The requested export format is not available"),
            (ExportPermissionError("op", "perm"), "You don't have permission"),
            (ExportTimeoutError("op", 60), "The export took too long")
        ]
        
        for error, expected_substring in errors:
            message = error_handler._get_user_friendly_message(error)
            assert expected_substring in message


class TestErrorRecovery:
    """Test error recovery strategies."""
    
    @pytest.mark.asyncio
    async def test_fallback_format_strategy(self, metrics_collector):
        """Test fallback format recovery."""
        strategy = FallbackFormatStrategy(metrics_collector)
        error = DependencyMissingError("reportlab", "pdf")
        context = {"export_format": "pdf"}
        
        result = await strategy.execute(error, context)
        
        assert result["strategy"] == "fallback_format"
        assert result["original_format"] == "pdf"
        assert "html" in result["available_formats"]
    
    @pytest.mark.asyncio
    async def test_resource_reduction_strategy(self, metrics_collector):
        """Test resource reduction recovery."""
        strategy = ResourceReductionStrategy(metrics_collector)
        error = ExportResourceError("memory", "500MB")
        context = {"batch_size": 1000}
        
        result = await strategy.execute(error, context)
        
        assert result["strategy"] == "resource_reduction"
        assert result["reduction_params"]["batch_size"] == 500
        assert result["reduction_params"]["pagination"] is True
    
    @pytest.mark.asyncio
    async def test_async_processing_strategy(self, metrics_collector):
        """Test async processing recovery."""
        strategy = AsyncProcessingStrategy(metrics_collector)
        error = ExportTimeoutError("export", 300)
        context = {"export_format": "xlsx"}
        
        with patch('jidelnicek.core.cache.cache_manager.set', new_callable=AsyncMock):
            result = await strategy.execute(error, context)
            
            assert result["strategy"] == "async_processing"
            assert "export_id" in result
            assert "status_url" in result
    
    @pytest.mark.asyncio
    async def test_retry_with_backoff_strategy(self, metrics_collector):
        """Test retry with backoff recovery."""
        strategy = RetryWithBackoffStrategy(metrics_collector)
        error = ExportException("Temporary error", "TEMP_ERROR")
        
        # First retry
        context = {"retry_count": 0}
        result = await strategy.execute(error, context)
        
        assert result["strategy"] == "retry_with_backoff"
        assert result["retry_count"] == 1
        assert result["retry_delay"] == 1.0
        
        # Max retries exceeded
        context = {"retry_count": 3}
        result = await strategy.execute(error, context)
        
        assert result["strategy"] == "retry_exhausted"


class TestCircuitBreaker:
    """Test circuit breaker functionality."""
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_states(self):
        """Test circuit breaker state transitions."""
        breaker = CircuitBreaker(
            failure_threshold=2,
            recovery_timeout=1,
            expected_exception=ExportException
        )
        
        async def failing_func():
            raise ExportException("Test", "TEST")
        
        async def success_func():
            return "success"
        
        # Circuit should be closed initially
        assert breaker.state == "closed"
        
        # First failure
        with pytest.raises(ExportException):
            await breaker.call(failing_func)
        assert breaker.state == "closed"
        
        # Second failure - circuit opens
        with pytest.raises(ExportException):
            await breaker.call(failing_func)
        assert breaker.state == "open"
        
        # Circuit is open - should fail fast
        with pytest.raises(ExportException) as exc_info:
            await breaker.call(success_func)
        assert exc_info.value.error_code == "CIRCUIT_BREAKER_OPEN"
        
        # Wait for recovery timeout
        await asyncio.sleep(1.1)
        
        # Circuit should attempt reset (half-open)
        result = await breaker.call(success_func)
        assert result == "success"
        assert breaker.state == "closed"


class TestErrorLogger:
    """Test error logging functionality."""
    
    @pytest.mark.asyncio
    async def test_log_export_error(self, error_logger):
        """Test logging export error."""
        error = ExportException("Test error", "TEST_ERROR")
        context = {"export_format": "pdf", "user_id": 123}
        
        error_id = await error_logger.log_export_error(
            error,
            context,
            user_id=123
        )
        
        assert error_id.startswith("EXP-")
        assert len(error_logger.recent_errors) == 1
        
        # Check error details retrieval
        details = await error_logger.get_error_details(error_id)
        assert details is not None
        assert details["error_type"] == "ExportException"
        assert details["context"]["export_format"] == "pdf"
    
    @pytest.mark.asyncio
    async def test_error_pattern_detection(self, error_logger):
        """Test error pattern detection."""
        # Generate multiple similar errors
        for i in range(5):
            error = ExportException(f"Error {i}", "TEST_ERROR")
            context = {"export_format": "pdf"}
            await error_logger.log_export_error(error, context)
        
        # Check pattern detection
        pattern_key = "ExportException:pdf"
        assert error_logger.error_patterns[pattern_key]["count"] == 5
    
    def test_context_enrichment(self):
        """Test error context enrichment."""
        context = {"export_format": "pdf"}
        
        # Mock request
        request = Mock()
        request.method = "POST"
        request.url = "http://test/export"
        request.headers = {"User-Agent": "Test"}
        request.client = {"host": "127.0.0.1"}
        
        enriched = ErrorContextEnricher.enrich_context(context, request)
        
        assert "request" in enriched
        assert enriched["request"]["method"] == "POST"
        assert "timestamp" in enriched


class TestErrorHandlingMiddleware:
    """Test error handling middleware."""
    
    @pytest.mark.asyncio
    async def test_middleware_handles_export_exceptions(self, error_handler):
        """Test middleware handles export exceptions."""
        middleware = ErrorHandlingMiddleware(None, error_handler)
        
        # Mock request
        request = Mock()
        request.url.path = "/api/export"
        request.method = "POST"
        request.headers = {}
        request.query_params = {}
        
        # Mock call_next that raises ExportException
        async def call_next_error(request):
            raise ExportPermissionError("export", "admin")
        
        response = await middleware.dispatch(request, call_next_error)
        
        assert response.status_code == 403
        response_data = response.body
        # Would need to parse JSON response in actual test


class TestHandleExportErrorsDecorator:
    """Test handle_export_errors decorator."""
    
    @pytest.mark.asyncio
    async def test_decorator_converts_exceptions(self):
        """Test decorator converts regular exceptions to ExportException."""
        @handle_export_errors
        async def test_func():
            raise ValueError("Test error")
        
        with pytest.raises(ExportException) as exc_info:
            await test_func()
        
        assert exc_info.value.error_code == "EXPORT_UNEXPECTED_ERROR"
        assert exc_info.value.details["original_error"] == "ValueError"
    
    @pytest.mark.asyncio
    async def test_decorator_preserves_export_exceptions(self):
        """Test decorator preserves ExportException."""
        @handle_export_errors
        async def test_func():
            raise ExportPermissionError("op", "perm")
        
        with pytest.raises(ExportPermissionError):
            await test_func()