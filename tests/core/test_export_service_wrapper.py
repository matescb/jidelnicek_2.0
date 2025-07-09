"""Tests for export service wrapper functionality."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
import asyncio
from datetime import datetime

from jidelnicek.core.services.export_service_wrapper import (
    ExportServiceWrapper,
    with_export_error_handling,
    ExportResourceManager
)
from jidelnicek.core.exceptions.export_exceptions import (
    DependencyMissingError,
    ExportResourceError,
    ExportTimeoutError,
    ExportException
)
from jidelnicek.core.services.error_recovery import ErrorRecoveryService
from jidelnicek.core.services.export_error_logger import ExportErrorLogger
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
def error_logger(tmp_path, metrics_collector):
    """Create error logger."""
    return ExportErrorLogger(tmp_path / "logs", metrics_collector)


@pytest.fixture
def export_wrapper(recovery_service, error_logger, metrics_collector):
    """Create export service wrapper."""
    return ExportServiceWrapper(
        recovery_service,
        error_logger,
        metrics_collector,
        timeout_seconds=5
    )


class TestExportServiceWrapper:
    """Test export service wrapper functionality."""
    
    @pytest.mark.asyncio
    async def test_wrap_export_method_success(self, export_wrapper):
        """Test wrapping successful export method."""
        @export_wrapper.wrap_export_method("pdf", ["reportlab"])
        async def export_pdf(data):
            return f"PDF: {data}"
        
        # Mock dependency check
        with patch.object(export_wrapper, '_check_dependencies'):
            result = await export_pdf("test data")
            assert result == "PDF: test data"
    
    @pytest.mark.asyncio
    async def test_wrap_export_method_dependency_missing(self, export_wrapper):
        """Test handling missing dependencies."""
        @export_wrapper.wrap_export_method("pdf", ["reportlab"])
        async def export_pdf(data):
            return f"PDF: {data}"
        
        # Simulate missing dependency
        with patch('builtins.__import__', side_effect=ImportError):
            with pytest.raises(DependencyMissingError) as exc_info:
                await export_pdf("test data")
            
            assert exc_info.value.dependency == "reportlab"
            assert exc_info.value.export_format == "pdf"
    
    @pytest.mark.asyncio
    async def test_wrap_export_method_timeout(self, export_wrapper):
        """Test handling export timeout."""
        export_wrapper.timeout_seconds = 0.1  # Very short timeout
        
        @export_wrapper.wrap_export_method("xlsx")
        async def export_xlsx(data):
            await asyncio.sleep(1)  # Longer than timeout
            return f"XLSX: {data}"
        
        with pytest.raises(ExportTimeoutError) as exc_info:
            await export_xlsx("test data")
        
        assert exc_info.value.details["timeout_seconds"] == 0.1
    
    @pytest.mark.asyncio
    async def test_wrap_export_method_unexpected_error(self, export_wrapper):
        """Test handling unexpected errors."""
        @export_wrapper.wrap_export_method("csv")
        async def export_csv(data):
            raise ValueError("Unexpected error")
        
        with pytest.raises(ExportException) as exc_info:
            await export_csv("test data")
        
        assert exc_info.value.error_code == "EXPORT_UNEXPECTED"
        assert exc_info.value.details["original_error"] == "ValueError"
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_integration(self, export_wrapper):
        """Test circuit breaker integration."""
        call_count = 0
        
        @export_wrapper.wrap_export_method("json")
        async def flaky_export(data):
            nonlocal call_count
            call_count += 1
            if call_count < 4:
                raise ExportException("Temporary failure", "TEMP_ERROR")
            return f"JSON: {data}"
        
        # First 3 calls should fail
        for i in range(3):
            with pytest.raises(ExportException):
                await flaky_export("test")
        
        # Circuit should be open now
        with pytest.raises(ExportException) as exc_info:
            await flaky_export("test")
        assert exc_info.value.error_code == "CIRCUIT_BREAKER_OPEN"
    
    @pytest.mark.asyncio
    async def test_fallback_format_handling(self, export_wrapper):
        """Test fallback format handling."""
        # Create wrapped function that fails with missing dependency
        @export_wrapper.wrap_export_method("pdf", ["missing_lib"])
        async def export_pdf(data):
            return f"PDF: {data}"
        
        # Mock the fallback handling
        with patch('builtins.__import__', side_effect=ImportError):
            with patch.object(
                export_wrapper,
                '_try_fallback_format',
                return_value={
                    "content": b"HTML fallback",
                    "format": "html",
                    "fallback_used": True
                }
            ) as mock_fallback:
                result = await export_pdf("test data")
                
                assert result["fallback_used"] is True
                assert result["format"] == "html"
                mock_fallback.assert_called_once()


class TestExportErrorHandlingDecorator:
    """Test export error handling decorator."""
    
    @pytest.mark.asyncio
    async def test_decorator_with_wrapper(self):
        """Test decorator with export wrapper."""
        class ExportService:
            def __init__(self):
                self._export_wrapper = Mock()
                self._export_wrapper.wrap_export_method.return_value = lambda f: f
            
            @with_export_error_handling("pdf", ["reportlab"])
            async def export_pdf(self, data):
                return f"PDF: {data}"
        
        service = ExportService()
        result = await service.export_pdf("test")
        assert result == "PDF: test"
    
    @pytest.mark.asyncio
    async def test_decorator_without_wrapper(self):
        """Test decorator without export wrapper (fallback mode)."""
        class ExportService:
            @with_export_error_handling("pdf")
            async def export_pdf(self, data):
                raise ValueError("Test error")
        
        service = ExportService()
        
        with pytest.raises(ValueError):
            await service.export_pdf("test")


class TestExportResourceManager:
    """Test export resource manager."""
    
    @pytest.mark.asyncio
    async def test_resource_acquisition(self):
        """Test resource acquisition."""
        manager = ExportResourceManager(max_concurrent_exports=2)
        
        # Acquire resources for two exports
        assert await manager.acquire_resources("export1", 50)
        assert await manager.acquire_resources("export2", 50)
        
        # Third should wait (we'll just check state)
        assert len(manager.active_exports) == 2
    
    @pytest.mark.asyncio
    async def test_resource_release(self):
        """Test resource release."""
        manager = ExportResourceManager()
        
        await manager.acquire_resources("export1", 50)
        assert "export1" in manager.active_exports
        
        manager.release_resources("export1")
        assert "export1" not in manager.active_exports
    
    @pytest.mark.asyncio
    async def test_memory_check(self):
        """Test memory availability check."""
        manager = ExportResourceManager()
        
        # Mock low memory situation
        with patch('psutil.virtual_memory') as mock_memory:
            mock_memory.return_value.available = 50 * 1024 * 1024  # 50MB
            
            with pytest.raises(ExportResourceError) as exc_info:
                await manager.acquire_resources("export1", 100)  # Request 100MB
            
            assert "memory" in exc_info.value.details["resource_type"]
    
    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test resource manager as context manager."""
        manager = ExportResourceManager()
        
        async with manager:
            await manager.acquire_resources("export1", 50)
            assert len(manager.active_exports) == 1
        
        # Resources should be cleaned up after exit
        # (In real implementation, would check cleanup)


class TestIntegrationScenarios:
    """Test integration scenarios."""
    
    @pytest.mark.asyncio
    async def test_complete_export_flow_with_recovery(
        self,
        export_wrapper,
        error_logger
    ):
        """Test complete export flow with error and recovery."""
        # Simulate export service
        class MockExportService:
            def __init__(self):
                self._export_wrapper = export_wrapper
            
            @with_export_error_handling("xlsx", ["openpyxl"])
            async def export_xlsx(self, data, user_id=None):
                # Simulate missing dependency
                raise ImportError("No module named 'openpyxl'")
        
        service = MockExportService()
        
        # Mock dependency check to raise error
        with patch('builtins.__import__', side_effect=ImportError):
            with patch.object(
                export_wrapper.fallback_exporter,
                'export_to_csv',
                return_value=b"CSV fallback content"
            ):
                result = await service.export_xlsx(
                    {"data": "test"},
                    user_id=123
                )
                
                # Should have used fallback
                assert result["fallback_used"] is True
                assert result["format"] == "csv"
                assert result["content"] == b"CSV fallback content"
    
    @pytest.mark.asyncio
    async def test_concurrent_exports_with_resource_limits(self):
        """Test handling concurrent exports with resource limits."""
        manager = ExportResourceManager(max_concurrent_exports=2)
        
        async def export_task(export_id: str, duration: float):
            await manager.acquire_resources(export_id, 50)
            try:
                await asyncio.sleep(duration)
                return f"Export {export_id} completed"
            finally:
                manager.release_resources(export_id)
        
        # Start 3 exports, but only 2 can run concurrently
        tasks = [
            export_task("export1", 0.1),
            export_task("export2", 0.1),
            export_task("export3", 0.1)
        ]
        
        results = await asyncio.gather(*tasks)
        assert len(results) == 3
        assert all("completed" in r for r in results)