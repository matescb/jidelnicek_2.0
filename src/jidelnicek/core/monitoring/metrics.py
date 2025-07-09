"""Metrics collection for monitoring and observability."""

import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from collections import defaultdict, deque
import asyncio
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class MetricsCollector:
    """Collects and manages application metrics."""
    
    def __init__(self, flush_interval: int = 60):
        self.flush_interval = flush_interval
        self._metrics = defaultdict(lambda: defaultdict(float))
        self._timings = defaultdict(list)
        self._events = deque(maxlen=10000)
        self._flush_task = None
        self._running = False
    
    async def start(self):
        """Start the metrics collector."""
        self._running = True
        self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info("Metrics collector started")
    
    async def stop(self):
        """Stop the metrics collector."""
        self._running = False
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        logger.info("Metrics collector stopped")
    
    def increment(
        self,
        metric_name: str,
        value: float = 1,
        tags: Optional[Dict[str, str]] = None
    ):
        """Increment a counter metric."""
        key = self._get_metric_key(metric_name, tags)
        self._metrics["counters"][key] += value
        
        # Record event
        self._record_event("increment", metric_name, value, tags)
    
    def gauge(
        self,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None
    ):
        """Set a gauge metric."""
        key = self._get_metric_key(metric_name, tags)
        self._metrics["gauges"][key] = value
        
        # Record event
        self._record_event("gauge", metric_name, value, tags)
    
    def timing(
        self,
        metric_name: str,
        duration_ms: float,
        tags: Optional[Dict[str, str]] = None
    ):
        """Record a timing metric."""
        key = self._get_metric_key(metric_name, tags)
        self._timings[key].append(duration_ms)
        
        # Keep only recent timings
        if len(self._timings[key]) > 1000:
            self._timings[key] = self._timings[key][-1000:]
        
        # Record event
        self._record_event("timing", metric_name, duration_ms, tags)
    
    @asynccontextmanager
    async def timer(
        self,
        metric_name: str,
        tags: Optional[Dict[str, str]] = None
    ):
        """Context manager for timing operations."""
        start_time = time.time()
        try:
            yield
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self.timing(metric_name, duration_ms, tags)
    
    def _get_metric_key(
        self,
        metric_name: str,
        tags: Optional[Dict[str, str]] = None
    ) -> str:
        """Generate a unique key for a metric with tags."""
        if not tags:
            return metric_name
        
        tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{metric_name},{tag_str}"
    
    def _record_event(
        self,
        event_type: str,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None
    ):
        """Record a metric event."""
        self._events.append({
            "timestamp": datetime.utcnow(),
            "type": event_type,
            "metric": metric_name,
            "value": value,
            "tags": tags or {}
        })
    
    async def _flush_loop(self):
        """Periodically flush metrics."""
        while self._running:
            try:
                await asyncio.sleep(self.flush_interval)
                await self._flush_metrics()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error flushing metrics: {e}")
    
    async def _flush_metrics(self):
        """Flush metrics to storage/monitoring system."""
        # TODO: Implement actual metric flushing to monitoring system
        # For now, just log summary
        
        if self._metrics["counters"]:
            logger.info(f"Counters: {dict(self._metrics['counters'])}")
        
        if self._metrics["gauges"]:
            logger.info(f"Gauges: {dict(self._metrics['gauges'])}")
        
        if self._timings:
            timing_summary = {}
            for key, values in self._timings.items():
                if values:
                    timing_summary[key] = {
                        "count": len(values),
                        "mean": sum(values) / len(values),
                        "min": min(values),
                        "max": max(values)
                    }
            if timing_summary:
                logger.info(f"Timings: {timing_summary}")
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get current metrics summary."""
        summary = {
            "counters": dict(self._metrics["counters"]),
            "gauges": dict(self._metrics["gauges"]),
            "timings": {}
        }
        
        # Calculate timing statistics
        for key, values in self._timings.items():
            if values:
                summary["timings"][key] = {
                    "count": len(values),
                    "mean": sum(values) / len(values),
                    "min": min(values),
                    "max": max(values),
                    "p50": self._percentile(values, 50),
                    "p95": self._percentile(values, 95),
                    "p99": self._percentile(values, 99)
                }
        
        return summary
    
    def get_recent_events(
        self,
        metric_name: Optional[str] = None,
        minutes: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent metric events."""
        cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)
        
        events = []
        for event in self._events:
            if event["timestamp"] < cutoff_time:
                continue
            
            if metric_name and event["metric"] != metric_name:
                continue
            
            events.append(event)
        
        return events
    
    def _percentile(self, values: List[float], percentile: float) -> float:
        """Calculate percentile of values."""
        if not values:
            return 0
        
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        
        if index >= len(sorted_values):
            return sorted_values[-1]
        
        return sorted_values[index]
    
    def reset(self):
        """Reset all metrics."""
        self._metrics.clear()
        self._timings.clear()
        self._events.clear()


class ExportMetrics:
    """Specialized metrics for export operations."""
    
    def __init__(self, collector: MetricsCollector):
        self.collector = collector
    
    def record_export_start(
        self,
        export_format: str,
        user_id: Optional[int] = None
    ):
        """Record export operation start."""
        self.collector.increment(
            "exports_started",
            tags={
                "format": export_format,
                "user_id": str(user_id) if user_id else "anonymous"
            }
        )
    
    def record_export_success(
        self,
        export_format: str,
        duration_ms: float,
        file_size: int,
        record_count: int,
        user_id: Optional[int] = None
    ):
        """Record successful export."""
        tags = {
            "format": export_format,
            "user_id": str(user_id) if user_id else "anonymous"
        }
        
        self.collector.increment("exports_completed", tags=tags)
        self.collector.timing("export_duration", duration_ms, tags=tags)
        self.collector.gauge("export_file_size", file_size, tags=tags)
        self.collector.gauge("export_record_count", record_count, tags=tags)
    
    def record_export_failure(
        self,
        export_format: str,
        error_type: str,
        duration_ms: float,
        user_id: Optional[int] = None
    ):
        """Record failed export."""
        tags = {
            "format": export_format,
            "error_type": error_type,
            "user_id": str(user_id) if user_id else "anonymous"
        }
        
        self.collector.increment("exports_failed", tags=tags)
        self.collector.timing("export_failure_duration", duration_ms, tags=tags)
    
    def record_fallback_used(
        self,
        original_format: str,
        fallback_format: str,
        reason: str
    ):
        """Record fallback format usage."""
        self.collector.increment(
            "export_fallbacks",
            tags={
                "original_format": original_format,
                "fallback_format": fallback_format,
                "reason": reason
            }
        )
    
    def record_resource_usage(
        self,
        export_format: str,
        memory_mb: float,
        cpu_percent: float
    ):
        """Record resource usage during export."""
        tags = {"format": export_format}
        
        self.collector.gauge("export_memory_usage_mb", memory_mb, tags=tags)
        self.collector.gauge("export_cpu_usage_percent", cpu_percent, tags=tags)


# Global metrics collector instance
metrics_collector = MetricsCollector()
export_metrics = ExportMetrics(metrics_collector)