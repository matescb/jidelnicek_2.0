"""
Cleanup tasks for removing old export files and data.

This module contains Celery tasks for automated cleanup of old export files,
temporary data, and other ephemeral content based on configurable retention policies.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

from celery import Task, group
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.celery_app import app
from jidelnicek.core.dependencies import DatabaseSession, RedisClient
from jidelnicek.core.config import settings
from jidelnicek.core.models.job import Job, JobType, JobStatus
from jidelnicek.core.services.cleanup_service import CleanupService
from jidelnicek.core.models.cleanup_policy import CleanupPolicy, CleanupAuditLog
from jidelnicek.auth.models import User

logger = logging.getLogger(__name__)


class CleanupTask(Task):
    """Base class for cleanup tasks with common functionality."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        logger.error(f"Cleanup task {task_id} failed: {exc}")
        self.update_job_status(task_id, "failed", error=str(exc))
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success."""
        logger.info(f"Cleanup task {task_id} completed successfully")
        self.update_job_status(task_id, "completed", result=retval)
    
    def update_job_status(self, task_id: str, status: str, **kwargs):
        """Update job status in database."""
        try:
            import asyncio
            asyncio.run(self._update_job_status_async(task_id, status, **kwargs))
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
    
    async def _update_job_status_async(self, task_id: str, status: str, **kwargs):
        """Async method to update job status."""
        async with DatabaseSession() as db:
            job = await db.execute(
                select(Job).where(Job.task_id == task_id)
            )
            job = job.scalar_one_or_none()
            if job:
                job.status = JobStatus(status)
                if status == "completed":
                    job.completed_at = datetime.utcnow()
                    job.progress = 100.0
                if "error" in kwargs:
                    job.error_message = kwargs["error"]
                if "result" in kwargs:
                    job.result = kwargs["result"]
                await db.commit()


@app.task(
    bind=True,
    base=CleanupTask,
    name="jidelnicek.tasks.cleanup_tasks.cleanup_export_files",
    max_retries=3,
    default_retry_delay=300,
    queue="maintenance",
    time_limit=3600,
    soft_time_limit=3300,
)
def cleanup_export_files(
    self,
    dry_run: bool = False,
    force: bool = False,
) -> Dict[str, Any]:
    """
    Clean up old export files based on retention policies.
    
    Args:
        dry_run: If True, only simulate cleanup without deleting files
        force: If True, ignore grace periods
        
    Returns:
        Cleanup statistics
    """
    import asyncio
    
    try:
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Starting export file cleanup..."
            }
        )
        
        result = asyncio.run(_cleanup_export_files_async(self, dry_run, force))
        return result
        
    except SoftTimeLimitExceeded:
        logger.error("Export file cleanup timed out")
        raise
    except Exception as e:
        logger.error(f"Failed to cleanup export files: {e}")
        raise self.retry(exc=e)


async def _cleanup_export_files_async(
    task: Task,
    dry_run: bool,
    force: bool,
) -> Dict[str, Any]:
    """Async implementation of export file cleanup."""
    async with DatabaseSession() as db:
        cleanup_service = CleanupService(db)
        
        # Get cleanup policies
        policies = await cleanup_service.get_active_policies()
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": "Loading cleanup policies..."
            }
        )
        
        stats = {
            "scanned_files": 0,
            "deleted_files": 0,
            "deleted_size": 0,
            "errors": 0,
            "notifications_queued": 0,
            "by_type": defaultdict(lambda: {"count": 0, "size": 0}),
        }
        
        # Process each file type
        export_base_dir = Path(settings.upload_path) / "exports"
        if not export_base_dir.exists():
            return stats
        
        file_types = {
            "shopping_lists": "shopping_list",
            "trips": "trip_data",
            "recipes": "recipes",
            "datasets": "dataset",
        }
        
        progress_step = 80 / len(file_types)
        current_progress = 10
        
        for dir_name, file_type in file_types.items():
            current_progress += progress_step
            task.update_state(
                state="PROGRESS",
                meta={
                    "current": int(current_progress),
                    "total": 100,
                    "status": f"Processing {file_type} exports..."
                }
            )
            
            export_dir = export_base_dir / dir_name
            if not export_dir.exists():
                continue
            
            # Get policy for this file type
            policy = next(
                (p for p in policies if p.file_type == file_type),
                None
            )
            
            if not policy:
                logger.warning(f"No cleanup policy found for {file_type}")
                continue
            
            # Process files in this directory
            for file_path in export_dir.rglob("*"):
                if file_path.is_file():
                    stats["scanned_files"] += 1
                    
                    try:
                        file_stats = file_path.stat()
                        file_age_days = (
                            datetime.utcnow() - 
                            datetime.fromtimestamp(file_stats.st_mtime)
                        ).days
                        
                        should_delete = False
                        reason = ""
                        
                        # Check retention period
                        if file_age_days > policy.retention_days:
                            should_delete = True
                            reason = f"File older than {policy.retention_days} days"
                        
                        # Check if within grace period (unless forced)
                        if should_delete and not force and policy.grace_period_hours > 0:
                            grace_cutoff = (
                                datetime.utcnow() - 
                                timedelta(hours=policy.grace_period_hours)
                            )
                            if datetime.fromtimestamp(file_stats.st_mtime) > grace_cutoff:
                                should_delete = False
                                reason = "Within grace period"
                        
                        if should_delete:
                            # Get associated export metadata
                            export_metadata = await cleanup_service.get_export_metadata(
                                str(file_path)
                            )
                            
                            # Create audit log entry
                            if not dry_run:
                                audit_log = await cleanup_service.create_audit_log(
                                    file_path=str(file_path),
                                    file_type=file_type,
                                    file_size=file_stats.st_size,
                                    reason=reason,
                                    user_id=export_metadata.get("created_by") if export_metadata else None,
                                    metadata={
                                        "export_id": export_metadata.get("id") if export_metadata else None,
                                        "created_at": export_metadata.get("created_at") if export_metadata else None,
                                    }
                                )
                                
                                # Queue notification if needed
                                if policy.notify_before_deletion and export_metadata:
                                    user_id = export_metadata.get("created_by")
                                    if user_id:
                                        await cleanup_service.queue_deletion_notification(
                                            user_id=user_id,
                                            file_path=str(file_path),
                                            file_type=file_type,
                                            deletion_time=datetime.utcnow() + timedelta(hours=policy.grace_period_hours),
                                            audit_log_id=audit_log.id,
                                        )
                                        stats["notifications_queued"] += 1
                                
                                # Delete the file
                                file_path.unlink()
                                
                                # Remove export metadata from Redis
                                if export_metadata and export_metadata.get("id"):
                                    await cleanup_service.remove_export_metadata(
                                        export_metadata["id"]
                                    )
                            
                            stats["deleted_files"] += 1
                            stats["deleted_size"] += file_stats.st_size
                            stats["by_type"][file_type]["count"] += 1
                            stats["by_type"][file_type]["size"] += file_stats.st_size
                            
                            logger.info(
                                f"{'Would delete' if dry_run else 'Deleted'} {file_path}: {reason}"
                            )
                    
                    except Exception as e:
                        logger.error(f"Error processing file {file_path}: {e}")
                        stats["errors"] += 1
        
        task.update_state(
            state="PROGRESS",
            meta={
                "current": 95,
                "total": 100,
                "status": "Finalizing cleanup..."
            }
        )
        
        # Clean up orphaned Redis entries
        await cleanup_service.cleanup_orphaned_metadata()
        
        # Update cleanup statistics
        await cleanup_service.update_cleanup_statistics(stats)
        
        return stats


@app.task(
    bind=True,
    base=CleanupTask,
    name="jidelnicek.tasks.cleanup_tasks.cleanup_cloud_storage",
    max_retries=2,
    default_retry_delay=600,
    queue="maintenance",
)
def cleanup_cloud_storage(
    self,
    storage_type: str = "all",
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Clean up old files from cloud storage.
    
    Args:
        storage_type: Type of storage to clean ("s3", "azure", "all")
        dry_run: If True, only simulate cleanup
        
    Returns:
        Cleanup statistics
    """
    import asyncio
    
    try:
        result = asyncio.run(_cleanup_cloud_storage_async(self, storage_type, dry_run))
        return result
    except Exception as e:
        logger.error(f"Failed to cleanup cloud storage: {e}")
        raise self.retry(exc=e)


async def _cleanup_cloud_storage_async(
    task: Task,
    storage_type: str,
    dry_run: bool,
) -> Dict[str, Any]:
    """Async implementation of cloud storage cleanup."""
    async with DatabaseSession() as db:
        cleanup_service = CleanupService(db)
        
        stats = {
            "scanned_objects": 0,
            "deleted_objects": 0,
            "deleted_size": 0,
            "errors": 0,
            "by_storage": defaultdict(lambda: {"count": 0, "size": 0}),
        }
        
        # Get storage service based on type
        from jidelnicek.core.storage.service import StorageService
        
        storage_service = StorageService()
        
        if storage_type in ["s3", "all"]:
            # Clean S3 storage
            s3_stats = await cleanup_service.cleanup_s3_storage(
                storage_service=storage_service,
                dry_run=dry_run,
            )
            stats["scanned_objects"] += s3_stats["scanned"]
            stats["deleted_objects"] += s3_stats["deleted"]
            stats["deleted_size"] += s3_stats["size"]
            stats["by_storage"]["s3"] = {
                "count": s3_stats["deleted"],
                "size": s3_stats["size"],
            }
        
        if storage_type in ["azure", "all"]:
            # Clean Azure storage
            azure_stats = await cleanup_service.cleanup_azure_storage(
                storage_service=storage_service,
                dry_run=dry_run,
            )
            stats["scanned_objects"] += azure_stats["scanned"]
            stats["deleted_objects"] += azure_stats["deleted"]
            stats["deleted_size"] += azure_stats["size"]
            stats["by_storage"]["azure"] = {
                "count": azure_stats["deleted"],
                "size": azure_stats["size"],
            }
        
        return stats


@app.task(
    bind=True,
    base=CleanupTask,
    name="jidelnicek.tasks.cleanup_tasks.cleanup_temp_files",
    queue="maintenance",
)
def cleanup_temp_files(self) -> Dict[str, Any]:
    """
    Clean up temporary files and directories.
    
    Returns:
        Cleanup statistics
    """
    import asyncio
    return asyncio.run(_cleanup_temp_files_async())


async def _cleanup_temp_files_async() -> Dict[str, Any]:
    """Async implementation of temp file cleanup."""
    stats = {
        "deleted_files": 0,
        "deleted_size": 0,
        "errors": 0,
    }
    
    # Clean system temp directory
    import tempfile
    temp_dir = Path(tempfile.gettempdir())
    
    # Pattern for our temp files
    patterns = [
        "jidelnicek_*",
        "export_*",
        "upload_*",
    ]
    
    cutoff_time = datetime.utcnow() - timedelta(hours=24)
    
    for pattern in patterns:
        for temp_file in temp_dir.glob(pattern):
            try:
                if temp_file.is_file():
                    file_mtime = datetime.fromtimestamp(temp_file.stat().st_mtime)
                    if file_mtime < cutoff_time:
                        file_size = temp_file.stat().st_size
                        temp_file.unlink()
                        stats["deleted_files"] += 1
                        stats["deleted_size"] += file_size
                elif temp_file.is_dir():
                    # Remove empty directories
                    if not any(temp_file.iterdir()):
                        temp_file.rmdir()
                        stats["deleted_files"] += 1
            except Exception as e:
                logger.error(f"Error cleaning temp file {temp_file}: {e}")
                stats["errors"] += 1
    
    return stats


@app.task(
    bind=True,
    base=CleanupTask,
    name="jidelnicek.tasks.cleanup_tasks.process_deletion_queue",
    queue="maintenance",
)
def process_deletion_queue(self) -> Dict[str, Any]:
    """
    Process queued file deletions after grace period.
    
    Returns:
        Processing statistics
    """
    import asyncio
    return asyncio.run(_process_deletion_queue_async())


async def _process_deletion_queue_async() -> Dict[str, Any]:
    """Async implementation of deletion queue processing."""
    async with DatabaseSession() as db:
        cleanup_service = CleanupService(db)
        
        stats = {
            "processed": 0,
            "deleted": 0,
            "skipped": 0,
            "errors": 0,
        }
        
        # Get pending deletions
        pending_deletions = await cleanup_service.get_pending_deletions()
        
        for deletion in pending_deletions:
            stats["processed"] += 1
            
            try:
                file_path = Path(deletion["file_path"])
                
                # Check if file still exists
                if not file_path.exists():
                    stats["skipped"] += 1
                    continue
                
                # Check if grace period has expired
                if datetime.utcnow() < deletion["scheduled_deletion_time"]:
                    stats["skipped"] += 1
                    continue
                
                # Delete the file
                file_path.unlink()
                stats["deleted"] += 1
                
                # Update audit log
                await cleanup_service.update_audit_log(
                    audit_log_id=deletion["audit_log_id"],
                    deleted=True,
                )
                
                # Remove from queue
                await cleanup_service.remove_from_deletion_queue(deletion["id"])
                
            except Exception as e:
                logger.error(f"Error processing deletion {deletion['id']}: {e}")
                stats["errors"] += 1
        
        return stats


@app.task(
    bind=True,
    base=CleanupTask,
    name="jidelnicek.tasks.cleanup_tasks.cleanup_old_jobs",
    queue="maintenance",
)
def cleanup_old_jobs(
    self,
    days_to_keep: int = 30,
) -> Dict[str, Any]:
    """
    Clean up old job records from the database.
    
    Args:
        days_to_keep: Number of days to keep job records
        
    Returns:
        Cleanup statistics
    """
    import asyncio
    return asyncio.run(_cleanup_old_jobs_async(days_to_keep))


async def _cleanup_old_jobs_async(days_to_keep: int) -> Dict[str, Any]:
    """Async implementation of old jobs cleanup."""
    async with DatabaseSession() as db:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Count jobs to delete
        count_result = await db.execute(
            select(func.count(Job.id)).where(
                and_(
                    Job.created_at < cutoff_date,
                    Job.status.in_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]),
                    Job.is_deleted == False,
                )
            )
        )
        count = count_result.scalar()
        
        # Soft delete old jobs
        await db.execute(
            select(Job).where(
                and_(
                    Job.created_at < cutoff_date,
                    Job.status.in_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]),
                    Job.is_deleted == False,
                )
            ).update(
                {
                    Job.is_deleted: True,
                    Job.deleted_at: datetime.utcnow(),
                }
            )
        )
        
        await db.commit()
        
        return {
            "deleted_jobs": count,
            "cutoff_date": cutoff_date.isoformat(),
        }


@app.task(
    bind=True,
    base=CleanupTask,
    name="jidelnicek.tasks.cleanup_tasks.generate_cleanup_report",
    queue="low",
)
def generate_cleanup_report(
    self,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    email_to: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a cleanup activity report.
    
    Args:
        start_date: Report start date (ISO format)
        end_date: Report end date (ISO format)
        email_to: Email address to send report to
        
    Returns:
        Report data
    """
    import asyncio
    return asyncio.run(_generate_cleanup_report_async(
        start_date, end_date, email_to
    ))


async def _generate_cleanup_report_async(
    start_date: Optional[str],
    end_date: Optional[str],
    email_to: Optional[str],
) -> Dict[str, Any]:
    """Async implementation of cleanup report generation."""
    async with DatabaseSession() as db:
        cleanup_service = CleanupService(db)
        
        # Parse dates
        if start_date:
            start = datetime.fromisoformat(start_date)
        else:
            start = datetime.utcnow() - timedelta(days=30)
        
        if end_date:
            end = datetime.fromisoformat(end_date)
        else:
            end = datetime.utcnow()
        
        # Generate report
        report = await cleanup_service.generate_cleanup_report(
            start_date=start,
            end_date=end,
        )
        
        # Send email if requested
        if email_to:
            # TODO: Implement email sending
            pass
        
        return report


# Schedule periodic cleanup tasks
app.conf.beat_schedule.update({
    "cleanup-export-files-daily": {
        "task": "jidelnicek.tasks.cleanup_tasks.cleanup_export_files",
        "schedule": timedelta(days=1),
        "kwargs": {"dry_run": False, "force": False},
        "options": {"queue": "maintenance", "priority": 1},
    },
    "cleanup-cloud-storage-weekly": {
        "task": "jidelnicek.tasks.cleanup_tasks.cleanup_cloud_storage",
        "schedule": timedelta(days=7),
        "kwargs": {"storage_type": "all", "dry_run": False},
        "options": {"queue": "maintenance", "priority": 0},
    },
    "cleanup-temp-files-hourly": {
        "task": "jidelnicek.tasks.cleanup_tasks.cleanup_temp_files",
        "schedule": timedelta(hours=1),
        "options": {"queue": "maintenance", "priority": 2},
    },
    "process-deletion-queue-every-15min": {
        "task": "jidelnicek.tasks.cleanup_tasks.process_deletion_queue",
        "schedule": timedelta(minutes=15),
        "options": {"queue": "maintenance", "priority": 3},
    },
    "cleanup-old-jobs-weekly": {
        "task": "jidelnicek.tasks.cleanup_tasks.cleanup_old_jobs",
        "schedule": timedelta(days=7),
        "kwargs": {"days_to_keep": 30},
        "options": {"queue": "maintenance", "priority": 0},
    },
    "generate-cleanup-report-monthly": {
        "task": "jidelnicek.tasks.cleanup_tasks.generate_cleanup_report",
        "schedule": timedelta(days=30),
        "options": {"queue": "low", "priority": 0},
    },
})