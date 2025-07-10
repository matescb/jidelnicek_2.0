"""Monitoring and metrics collection package."""

from .metrics import MetricsCollector, ExportMetrics, metrics_collector, export_metrics

# Import from the monitoring.py module (need to use absolute import to avoid circular reference)
import sys
import importlib.util
from pathlib import Path

# Load monitoring.py module directly
monitoring_path = Path(__file__).parent.parent / "monitoring.py"  
spec = importlib.util.spec_from_file_location("monitoring_module", monitoring_path)
monitoring_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitoring_module)

# Re-export the needed objects
query_monitor = monitoring_module.query_monitor
pool_monitor = monitoring_module.pool_monitor
check_database_performance = monitoring_module.check_database_performance
QueryAnalyzer = monitoring_module.QueryAnalyzer
setup_query_monitoring = monitoring_module.setup_query_monitoring
setup_connection_pool_monitoring = monitoring_module.setup_connection_pool_monitoring

__all__ = [
    "MetricsCollector",
    "ExportMetrics", 
    "metrics_collector",
    "export_metrics",
    "query_monitor",
    "pool_monitor", 
    "check_database_performance",
    "QueryAnalyzer",
    "setup_query_monitoring",
    "setup_connection_pool_monitoring"
]