"""
Celery configuration and application instance.

This module configures Celery for background job processing, particularly
for handling export operations and other long-running tasks.
"""

import os
from celery import Celery
from kombu import Queue, Exchange
from datetime import timedelta
from typing import Dict, Any

from jidelnicek.core.config import settings

# Set default Django settings module for celery
os.environ.setdefault("JIDELNICEK_SETTINGS", "core.config")

# Create Celery app instance
app = Celery("jidelnicek")

# Configure Celery
app.conf.update(
    # Broker settings
    broker_url=str(settings.redis_url),
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
    
    # Result backend settings
    result_backend=str(settings.redis_url),
    result_expires=86400,  # Results expire after 24 hours
    result_persistent=True,
    result_compression="gzip",
    
    # Task settings
    task_serializer="json",
    task_compression="gzip",
    task_track_started=True,
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3300,  # 55 minutes soft limit
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Result serialization
    result_serializer="json",
    accept_content=["json"],
    
    # Timezone
    timezone="UTC",
    enable_utc=True,
    
    # Worker settings
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    worker_disable_rate_limits=False,
    worker_send_task_events=True,
    
    # Beat schedule (for periodic tasks)
    beat_schedule={
        "cleanup-expired-jobs": {
            "task": "jidelnicek.tasks.export_tasks.cleanup_expired_jobs",
            "schedule": timedelta(hours=6),
            "options": {"queue": "maintenance", "priority": 0},
        },
        "cleanup-old-exports": {
            "task": "jidelnicek.tasks.export_tasks.cleanup_old_exports",
            "schedule": timedelta(days=1),
            "options": {"queue": "maintenance", "priority": 0},
        },
    },
)

# Define task queues with different priorities
default_exchange = Exchange("default", type="direct")
priority_exchange = Exchange("priority", type="direct")
maintenance_exchange = Exchange("maintenance", type="direct")

app.conf.task_queues = (
    # Default queue for regular tasks
    Queue("default", default_exchange, routing_key="default", priority=5),
    
    # High priority queue for quick exports
    Queue("high", priority_exchange, routing_key="high", priority=10),
    
    # Low priority queue for large exports
    Queue("low", priority_exchange, routing_key="low", priority=1),
    
    # Maintenance queue for cleanup tasks
    Queue("maintenance", maintenance_exchange, routing_key="maintenance", priority=0),
)

# Task routing
app.conf.task_routes = {
    "jidelnicek.tasks.export_tasks.export_shopping_list": {"queue": "default"},
    "jidelnicek.tasks.export_tasks.export_trip_data": {"queue": "default"},
    "jidelnicek.tasks.export_tasks.export_recipes": {"queue": "low"},
    "jidelnicek.tasks.export_tasks.export_large_dataset": {"queue": "low"},
    "jidelnicek.tasks.export_tasks.cleanup_*": {"queue": "maintenance"},
    "jidelnicek.tasks.cleanup_tasks.*": {"queue": "maintenance"},
}

# Task annotations for retry configuration
app.conf.task_annotations = {
    "*": {
        "rate_limit": "100/m",  # Default rate limit
        "max_retries": 3,
        "default_retry_delay": 60,  # 1 minute
    },
    "jidelnicek.tasks.export_tasks.export_large_dataset": {
        "rate_limit": "10/m",  # Stricter rate limit for heavy tasks
        "max_retries": 2,
        "default_retry_delay": 300,  # 5 minutes
    },
}

# Import task modules to register them
app.autodiscover_tasks(["jidelnicek.tasks"])


def get_task_info(task_id: str) -> Dict[str, Any]:
    """
    Get information about a task.
    
    Args:
        task_id: The task ID
        
    Returns:
        Task information including status, result, etc.
    """
    result = app.AsyncResult(task_id)
    
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
        "info": result.info,
        "date_done": result.date_done,
        "traceback": result.traceback if result.failed() else None,
    }


def revoke_task(task_id: str, terminate: bool = False) -> bool:
    """
    Revoke/cancel a task.
    
    Args:
        task_id: The task ID to revoke
        terminate: Whether to terminate the task if it's running
        
    Returns:
        True if revoked successfully
    """
    try:
        app.control.revoke(task_id, terminate=terminate)
        return True
    except Exception:
        return False


# Export commonly used items
__all__ = ["app", "get_task_info", "revoke_task"]