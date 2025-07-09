#!/usr/bin/env python
"""
Run Celery worker for background task processing.

This script starts a Celery worker that processes background jobs
such as export operations.

Usage:
    python scripts/run_celery_worker.py [options]
    
Options:
    --loglevel: Logging level (debug, info, warning, error, critical)
    --concurrency: Number of concurrent worker processes
    --queues: Comma-separated list of queues to process
    --max-tasks-per-child: Maximum tasks per worker before restart
"""

import sys
import os
import argparse
import logging

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from jidelnicek.core.celery_app import app
from jidelnicek.core.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Run the Celery worker."""
    parser = argparse.ArgumentParser(description="Run Celery worker")
    parser.add_argument(
        "--loglevel",
        default="info",
        choices=["debug", "info", "warning", "error", "critical"],
        help="Logging level"
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=4,
        help="Number of concurrent worker processes"
    )
    parser.add_argument(
        "--queues",
        default="default,high,low",
        help="Comma-separated list of queues to process"
    )
    parser.add_argument(
        "--max-tasks-per-child",
        type=int,
        default=1000,
        help="Maximum tasks per worker before restart"
    )
    parser.add_argument(
        "--autoscale",
        help="Autoscale workers (e.g., '10,3' for max 10, min 3)"
    )
    parser.add_argument(
        "--without-heartbeat",
        action="store_true",
        help="Disable heartbeat (useful for debugging)"
    )
    
    args = parser.parse_args()
    
    # Build worker arguments
    worker_args = [
        "worker",
        f"--loglevel={args.loglevel}",
        f"--concurrency={args.concurrency}",
        f"--queues={args.queues}",
        f"--max-tasks-per-child={args.max_tasks_per_child}",
        "--time-limit=3600",  # Hard time limit of 1 hour
        "--soft-time-limit=3300",  # Soft time limit of 55 minutes
    ]
    
    if args.autoscale:
        worker_args.append(f"--autoscale={args.autoscale}")
    
    if args.without_heartbeat:
        worker_args.append("--without-heartbeat")
    
    # Add environment-specific options
    if settings.is_development:
        worker_args.extend([
            "--pool=solo",  # Use solo pool in development (no multiprocessing)
            "--purge",  # Purge messages when starting
        ])
    
    logger.info(f"Starting Celery worker with args: {worker_args}")
    logger.info(f"Redis URL: {settings.redis_url}")
    logger.info(f"Environment: {settings.environment}")
    
    # Start the worker
    app.worker_main(worker_args)


if __name__ == "__main__":
    main()