"""
Example usage of the background job processing system.

This script demonstrates how to create and manage background jobs
for export operations in the Jídelníček 2.0 application.
"""

import asyncio
from datetime import datetime, timedelta
import logging

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from jidelnicek.core.config import settings
from jidelnicek.core.models.job import JobType, JobPriority, JobStatus
from jidelnicek.core.services.job_service import JobService
from jidelnicek.auth.models import User
from jidelnicek.core.celery_app import app as celery_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_export_jobs_example(db: AsyncSession, user_id: int):
    """
    Example of creating various export jobs.
    
    Args:
        db: Database session
        user_id: ID of the user creating the jobs
    """
    job_service = JobService(db)
    
    # Example 1: Create a shopping list export job
    logger.info("Creating shopping list export job...")
    shopping_list_job = await job_service.create_job(
        job_type=JobType.EXPORT_SHOPPING_LIST,
        name="Export Shopping List for Summer Camp 2024",
        parameters={
            "trip_id": 123,
            "format": "pdf",
            "options": {
                "group_by_category": True,
                "include_prices": False,
                "include_quantities": True,
            },
            "user_id": user_id,
        },
        user_id=user_id,
        priority=JobPriority.HIGH,
        description="Shopping list for 50 participants, 7-day summer camp",
        notify_on_completion=True,
        notify_on_failure=True,
    )
    
    # Submit the job to Celery
    shopping_list_job = await job_service.submit_job(shopping_list_job)
    logger.info(f"Shopping list export job created: ID={shopping_list_job.id}, Status={shopping_list_job.status}")
    
    # Example 2: Create a trip data export job
    logger.info("Creating trip data export job...")
    trip_export_job = await job_service.create_job(
        job_type=JobType.EXPORT_TRIP_DATA,
        name="Complete Trip Data Export - Summer Camp 2024",
        parameters={
            "trip_id": 123,
            "format": "excel",
            "include_shopping_list": True,
            "include_meal_plans": True,
            "include_participants": True,
            "include_qr_codes": True,
            "user_id": user_id,
        },
        user_id=user_id,
        priority=JobPriority.NORMAL,
        description="Full export including all trip data and QR codes",
        notify_on_completion=True,
    )
    
    trip_export_job = await job_service.submit_job(trip_export_job)
    logger.info(f"Trip export job created: ID={trip_export_job.id}, Status={trip_export_job.status}")
    
    # Example 3: Create a recipe export job (low priority)
    logger.info("Creating recipe export job...")
    recipe_export_job = await job_service.create_job(
        job_type=JobType.EXPORT_RECIPES,
        name="Export All Recipes with Images",
        parameters={
            "recipe_ids": None,  # Export all recipes
            "format": "pdf",
            "include_images": True,
            "include_nutrition": True,
            "include_instructions": True,
            "user_id": user_id,
        },
        user_id=user_id,
        priority=JobPriority.LOW,
        description="Complete recipe book export with images and nutrition facts",
        notify_on_completion=True,
    )
    
    recipe_export_job = await job_service.submit_job(recipe_export_job)
    logger.info(f"Recipe export job created: ID={recipe_export_job.id}, Status={recipe_export_job.status}")
    
    return [shopping_list_job, trip_export_job, recipe_export_job]


async def monitor_jobs_example(db: AsyncSession, job_ids: list[int]):
    """
    Example of monitoring job progress and status.
    
    Args:
        db: Database session
        job_ids: List of job IDs to monitor
    """
    job_service = JobService(db)
    
    logger.info("Monitoring job progress...")
    
    # Poll jobs every 5 seconds for 2 minutes
    end_time = datetime.utcnow() + timedelta(minutes=2)
    
    while datetime.utcnow() < end_time:
        all_complete = True
        
        for job_id in job_ids:
            job = await job_service.get_job(job_id)
            
            logger.info(
                f"Job {job.id} ({job.name}): "
                f"Status={job.status.value}, "
                f"Progress={job.progress:.1f}%, "
                f"Message={job.progress_message or 'N/A'}"
            )
            
            if job.status not in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                all_complete = False
            
            # Handle completed jobs
            if job.status == JobStatus.COMPLETED and job.result:
                logger.info(f"Job {job.id} completed! Export available at: {job.result.get('download_url')}")
            
            # Handle failed jobs
            elif job.status == JobStatus.FAILED:
                logger.error(f"Job {job.id} failed: {job.error_message}")
                
                # Retry if possible
                if job.can_retry:
                    logger.info(f"Retrying job {job.id}...")
                    new_job = await job_service.retry_job(job.id)
                    logger.info(f"Retry job created: ID={new_job.id}")
        
        if all_complete:
            logger.info("All jobs completed!")
            break
        
        # Wait before next check
        await asyncio.sleep(5)


async def manage_jobs_example(db: AsyncSession, user_id: int):
    """
    Example of managing jobs (list, cancel, delete).
    
    Args:
        db: Database session
        user_id: ID of the user
    """
    job_service = JobService(db)
    
    # List all jobs for the user
    logger.info("Listing user's jobs...")
    jobs = await job_service.list_jobs(
        user_id=user_id,
        order_by="created_at",
        order_desc=True,
        limit=10,
    )
    
    for job in jobs:
        logger.info(
            f"Job {job.id}: {job.name} - "
            f"Status={job.status.value}, "
            f"Created={job.created_at.isoformat()}"
        )
    
    # Get job statistics
    logger.info("Getting job statistics...")
    stats = await job_service.get_job_statistics(user_id=user_id)
    logger.info(f"Job statistics: {stats}")
    
    # Cancel a running job (example)
    running_jobs = await job_service.list_jobs(
        user_id=user_id,
        status=JobStatus.RUNNING,
        limit=1,
    )
    
    if running_jobs:
        job_to_cancel = running_jobs[0]
        logger.info(f"Cancelling job {job_to_cancel.id}...")
        cancelled_job = await job_service.cancel_job(job_to_cancel.id, user_id)
        logger.info(f"Job {cancelled_job.id} cancelled")
    
    # Clean up old completed jobs
    logger.info("Cleaning up old jobs...")
    cleaned_count = await job_service.cleanup_old_jobs(days=30)
    logger.info(f"Cleaned up {cleaned_count} old jobs")


async def main():
    """Main example function."""
    # Create database engine and session
    engine = create_async_engine(str(settings.database_url))
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # For this example, we'll use user_id=1
        # In a real application, this would be the authenticated user
        user_id = 1
        
        try:
            # Create export jobs
            jobs = await create_export_jobs_example(db, user_id)
            job_ids = [job.id for job in jobs]
            
            # Monitor job progress
            await monitor_jobs_example(db, job_ids)
            
            # Manage jobs
            await manage_jobs_example(db, user_id)
            
        except Exception as e:
            logger.error(f"Error in example: {e}")
            raise
        finally:
            await db.close()
    
    await engine.dispose()


if __name__ == "__main__":
    # Note: Make sure Celery workers are running before executing this script
    # Run: python scripts/run_celery_worker.py
    
    logger.info("Starting background jobs example...")
    asyncio.run(main())
    logger.info("Example completed!")