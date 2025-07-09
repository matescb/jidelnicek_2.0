"""
Background task for cleaning up expired sessions.

This module provides a background task that runs periodically
to remove expired sessions from the database.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import DatabaseSession
from jidelnicek.auth.services.token_service import TokenService

logger = logging.getLogger(__name__)


async def cleanup_expired_sessions():
    """
    Clean up expired sessions from the database.
    
    This function:
    - Removes sessions that have passed their expiration time
    - Logs cleanup statistics
    - Handles errors gracefully
    """
    try:
        async with DatabaseSession() as db:
            token_service = TokenService(db, None)
            
            # Record start time
            start_time = datetime.now(timezone.utc)
            
            # Perform cleanup
            cleaned_count = await token_service.cleanup_expired_sessions()
            
            # Calculate duration
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            if cleaned_count > 0:
                logger.info(
                    f"Session cleanup completed: {cleaned_count} expired sessions removed "
                    f"in {duration:.2f} seconds"
                )
            else:
                logger.debug(f"Session cleanup completed: No expired sessions found")
                
    except Exception as e:
        logger.error(f"Error during session cleanup: {str(e)}", exc_info=True)


async def run_session_cleanup_task(interval_hours: int = 1):
    """
    Run session cleanup task at regular intervals.
    
    Args:
        interval_hours: Hours between cleanup runs (default: 1)
    """
    logger.info(f"Starting session cleanup task with {interval_hours} hour interval")
    
    while True:
        try:
            # Run cleanup
            await cleanup_expired_sessions()
            
            # Wait for next run
            await asyncio.sleep(interval_hours * 3600)
            
        except asyncio.CancelledError:
            logger.info("Session cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Unexpected error in session cleanup task: {str(e)}")
            # Wait a bit before retrying
            await asyncio.sleep(300)  # 5 minutes


def start_session_cleanup_background_task():
    """
    Start the session cleanup background task.
    
    This should be called when the application starts.
    """
    asyncio.create_task(run_session_cleanup_task())