#!/usr/bin/env python
"""
Run Celery beat scheduler for periodic task scheduling.

This script starts the Celery beat service that schedules periodic
tasks like cleanup jobs.

Usage:
    python scripts/run_celery_beat.py [options]
    
Options:
    --loglevel: Logging level (debug, info, warning, error, critical)
    --pidfile: Path to PID file
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
    """Run the Celery beat scheduler."""
    parser = argparse.ArgumentParser(description="Run Celery beat scheduler")
    parser.add_argument(
        "--loglevel",
        default="info",
        choices=["debug", "info", "warning", "error", "critical"],
        help="Logging level"
    )
    parser.add_argument(
        "--pidfile",
        default="/tmp/celerybeat.pid",
        help="Path to PID file"
    )
    parser.add_argument(
        "--schedule",
        default="/tmp/celerybeat-schedule",
        help="Path to schedule database"
    )
    
    args = parser.parse_args()
    
    # Build beat arguments
    beat_args = [
        "beat",
        f"--loglevel={args.loglevel}",
        f"--pidfile={args.pidfile}",
        f"--schedule={args.schedule}",
    ]
    
    logger.info(f"Starting Celery beat with args: {beat_args}")
    logger.info(f"Redis URL: {settings.redis_url}")
    logger.info(f"Environment: {settings.environment}")
    
    # Start the beat scheduler
    app.start(beat_args)


if __name__ == "__main__":
    main()