"""
Job management service.

This module provides services for creating, tracking, and managing
background jobs, including export operations and other long-running tasks.
"""

import uuid
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.core.models.job import Job, JobStatus, JobPriority, JobType, JobNotification
from jidelnicek.core.celery_app import app, get_task_info, revoke_task
from jidelnicek.core.services.base import BaseService
from jidelnicek.core.exceptions import NotFoundError, ValidationError
from jidelnicek.core.cache import cache_delete

logger = logging.getLogger(__name__)


class JobService(BaseService[Job]):
    """Service for managing background jobs."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Job, db)
    
    async def create_job(
        self,
        job_type: JobType,
        name: str,
        parameters: Dict[str, Any],
        user_id: Optional[int] = None,
        priority: JobPriority = JobPriority.NORMAL,
        description: Optional[str] = None,
        notify_on_completion: bool = False,
        notify_on_failure: bool = True,
    ) -> Job:
        """
        Create a new job record.
        
        Args:
            job_type: Type of job
            name: Job name
            parameters: Job parameters
            user_id: ID of user who created the job
            priority: Job priority
            description: Job description
            notify_on_completion: Whether to notify on completion
            notify_on_failure: Whether to notify on failure
            
        Returns:
            Created job instance
        """
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Create job record
        job = Job(
            task_id=task_id,
            job_type=job_type,
            name=name,
            description=description,
            status=JobStatus.PENDING,
            priority=priority,
            parameters=parameters,
            user_id=user_id,
            notify_on_completion=notify_on_completion,
            notify_on_failure=notify_on_failure,
            queue_name=self._get_queue_for_priority(priority),
        )
        
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        
        logger.info(f"Created job {job.id} with task_id {task_id}")
        return job
    
    async def submit_job(self, job: Job) -> Job:
        """
        Submit a job to the task queue.
        
        Args:
            job: Job instance to submit
            
        Returns:
            Updated job instance
        """
        try:
            # Get the appropriate task function
            task_func = self._get_task_function(job.job_type)
            if not task_func:
                raise ValidationError(f"Unknown job type: {job.job_type}")
            
            # Submit to Celery
            result = task_func.apply_async(
                kwargs=job.parameters,
                task_id=job.task_id,
                queue=job.queue_name,
                priority=self._get_celery_priority(job.priority),
            )
            
            # Update job status
            job.status = JobStatus.RUNNING
            job.started_at = datetime.utcnow()
            await self.db.commit()
            
            logger.info(f"Submitted job {job.id} to queue {job.queue_name}")
            return job
            
        except Exception as e:
            logger.error(f"Failed to submit job {job.id}: {e}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            await self.db.commit()
            raise
    
    async def get_job(self, job_id: int, user_id: Optional[int] = None) -> Job:
        """
        Get a job by ID.
        
        Args:
            job_id: Job ID
            user_id: Optional user ID for access control
            
        Returns:
            Job instance
        """
        query = select(Job).where(
            and_(
                Job.id == job_id,
                Job.is_deleted == False
            )
        )
        
        if user_id is not None:
            query = query.where(Job.user_id == user_id)
        
        result = await self.db.execute(query)
        job = result.scalar_one_or_none()
        
        if not job:
            raise NotFoundError(f"Job {job_id} not found")
        
        # Update job status from Celery if it's running
        if job.status == JobStatus.RUNNING:
            await self._update_job_from_celery(job)
        
        return job
    
    async def get_job_by_task_id(self, task_id: str) -> Optional[Job]:
        """
        Get a job by task ID.
        
        Args:
            task_id: Celery task ID
            
        Returns:
            Job instance or None
        """
        query = select(Job).where(
            and_(
                Job.task_id == task_id,
                Job.is_deleted == False
            )
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def list_jobs(
        self,
        user_id: Optional[int] = None,
        job_type: Optional[JobType] = None,
        status: Optional[JobStatus] = None,
        priority: Optional[JobPriority] = None,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100,
        order_by: str = "created_at",
        order_desc: bool = True,
    ) -> List[Job]:
        """
        List jobs with filtering and pagination.
        
        Args:
            user_id: Filter by user ID
            job_type: Filter by job type
            status: Filter by status
            priority: Filter by priority
            created_after: Filter by creation date
            created_before: Filter by creation date
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field to order by
            order_desc: Whether to order descending
            
        Returns:
            List of jobs
        """
        query = select(Job).where(Job.is_deleted == False)
        
        # Apply filters
        if user_id is not None:
            query = query.where(Job.user_id == user_id)
        if job_type is not None:
            query = query.where(Job.job_type == job_type)
        if status is not None:
            query = query.where(Job.status == status)
        if priority is not None:
            query = query.where(Job.priority == priority)
        if created_after is not None:
            query = query.where(Job.created_at >= created_after)
        if created_before is not None:
            query = query.where(Job.created_at <= created_before)
        
        # Apply ordering
        order_field = getattr(Job, order_by, Job.created_at)
        if order_desc:
            query = query.order_by(order_field.desc())
        else:
            query = query.order_by(order_field)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        jobs = result.scalars().all()
        
        # Update running jobs from Celery
        for job in jobs:
            if job.status == JobStatus.RUNNING:
                await self._update_job_from_celery(job)
        
        return jobs
    
    async def update_job_progress(
        self,
        job_id: int,
        progress: float,
        progress_message: Optional[str] = None,
        eta: Optional[datetime] = None,
    ) -> Job:
        """
        Update job progress.
        
        Args:
            job_id: Job ID
            progress: Progress percentage (0-100)
            progress_message: Optional progress message
            eta: Optional estimated time of arrival
            
        Returns:
            Updated job instance
        """
        job = await self.get_job(job_id)
        
        job.progress = max(0.0, min(100.0, progress))
        if progress_message is not None:
            job.progress_message = progress_message
        if eta is not None:
            job.eta = eta
        
        await self.db.commit()
        return job
    
    async def complete_job(
        self,
        job_id: int,
        result: Optional[Dict[str, Any]] = None,
    ) -> Job:
        """
        Mark a job as completed.
        
        Args:
            job_id: Job ID
            result: Job result data
            
        Returns:
            Updated job instance
        """
        job = await self.get_job(job_id)
        
        job.status = JobStatus.COMPLETED
        job.progress = 100.0
        job.completed_at = datetime.utcnow()
        if result is not None:
            job.result = result
        
        await self.db.commit()
        
        # Send notification if enabled
        if job.notify_on_completion:
            await self._send_job_notification(job, "completed")
        
        return job
    
    async def fail_job(
        self,
        job_id: int,
        error_message: str,
        error_traceback: Optional[str] = None,
    ) -> Job:
        """
        Mark a job as failed.
        
        Args:
            job_id: Job ID
            error_message: Error message
            error_traceback: Optional error traceback
            
        Returns:
            Updated job instance
        """
        job = await self.get_job(job_id)
        
        job.status = JobStatus.FAILED
        job.completed_at = datetime.utcnow()
        job.error_message = error_message
        if error_traceback is not None:
            job.error_traceback = error_traceback
        
        await self.db.commit()
        
        # Send notification if enabled
        if job.notify_on_failure:
            await self._send_job_notification(job, "failed")
        
        return job
    
    async def cancel_job(self, job_id: int, user_id: Optional[int] = None) -> Job:
        """
        Cancel a job.
        
        Args:
            job_id: Job ID
            user_id: Optional user ID for access control
            
        Returns:
            Updated job instance
        """
        job = await self.get_job(job_id, user_id)
        
        if job.is_terminal:
            raise ValidationError(f"Cannot cancel job in {job.status} state")
        
        # Revoke Celery task
        if job.task_id:
            revoke_task(job.task_id, terminate=True)
        
        # Update job status
        job.status = JobStatus.CANCELLED
        job.completed_at = datetime.utcnow()
        
        await self.db.commit()
        
        # Update progress tracker if it's an export job
        if job.job_type in [JobType.EXPORT_SHOPPING_LIST, JobType.EXPORT_TRIP_DATA, 
                           JobType.EXPORT_RECIPES, JobType.EXPORT_DATASET]:
            from jidelnicek.core.services.progress_tracker import ProgressTracker
            
            # Get export ID from result or parameters
            export_id = None
            if job.result and isinstance(job.result, dict):
                export_id = job.result.get("export_id")
            elif job.parameters and isinstance(job.parameters, dict):
                export_id = job.parameters.get("export_id")
            
            if export_id:
                tracker = ProgressTracker(
                    operation_id=export_id,
                    operation_type=f"export_{job.job_type.value.replace('export_', '')}",
                    user_id=job.user_id or 0
                )
                await tracker.cancel()
        
        logger.info(f"Cancelled job {job.id}")
        return job
    
    async def retry_job(self, job_id: int, user_id: Optional[int] = None) -> Job:
        """
        Retry a failed job.
        
        Args:
            job_id: Job ID
            user_id: Optional user ID for access control
            
        Returns:
            New job instance
        """
        original_job = await self.get_job(job_id, user_id)
        
        if not original_job.can_retry:
            raise ValidationError(f"Job {job_id} cannot be retried")
        
        # Create new job with same parameters
        new_job = await self.create_job(
            job_type=original_job.job_type,
            name=f"{original_job.name} (Retry {original_job.retry_count + 1})",
            parameters=original_job.parameters,
            user_id=original_job.user_id,
            priority=original_job.priority,
            description=original_job.description,
            notify_on_completion=original_job.notify_on_completion,
            notify_on_failure=original_job.notify_on_failure,
        )
        
        # Update retry count
        new_job.retry_count = original_job.retry_count + 1
        new_job.max_retries = original_job.max_retries
        
        # Submit the job
        await self.submit_job(new_job)
        
        return new_job
    
    async def delete_job(self, job_id: int, user_id: Optional[int] = None) -> None:
        """
        Soft delete a job.
        
        Args:
            job_id: Job ID
            user_id: Optional user ID for access control
        """
        job = await self.get_job(job_id, user_id)
        
        job.is_deleted = True
        job.deleted_at = datetime.utcnow()
        
        await self.db.commit()
        
        logger.info(f"Deleted job {job.id}")
    
    async def cleanup_old_jobs(self, days: int = 30) -> int:
        """
        Clean up old completed/failed jobs.
        
        Args:
            days: Number of days to keep jobs
            
        Returns:
            Number of jobs cleaned up
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        query = select(Job).where(
            and_(
                Job.status.in_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]),
                Job.completed_at < cutoff_date,
                Job.is_deleted == False
            )
        )
        
        result = await self.db.execute(query)
        jobs = result.scalars().all()
        
        for job in jobs:
            job.is_deleted = True
            job.deleted_at = datetime.utcnow()
        
        await self.db.commit()
        
        logger.info(f"Cleaned up {len(jobs)} old jobs")
        return len(jobs)
    
    async def get_job_statistics(
        self,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get job statistics.
        
        Args:
            user_id: Optional user ID filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            Statistics dictionary
        """
        base_query = select(Job).where(Job.is_deleted == False)
        
        if user_id is not None:
            base_query = base_query.where(Job.user_id == user_id)
        if start_date is not None:
            base_query = base_query.where(Job.created_at >= start_date)
        if end_date is not None:
            base_query = base_query.where(Job.created_at <= end_date)
        
        # Count by status
        status_counts = {}
        for status in JobStatus:
            query = base_query.where(Job.status == status)
            result = await self.db.execute(select(func.count()).select_from(query.subquery()))
            status_counts[status.value] = result.scalar() or 0
        
        # Count by type
        type_counts = {}
        for job_type in JobType:
            query = base_query.where(Job.job_type == job_type)
            result = await self.db.execute(select(func.count()).select_from(query.subquery()))
            type_counts[job_type.value] = result.scalar() or 0
        
        # Average duration for completed jobs
        duration_query = base_query.where(
            and_(
                Job.status == JobStatus.COMPLETED,
                Job.started_at.isnot(None),
                Job.completed_at.isnot(None)
            )
        )
        result = await self.db.execute(
            select(
                func.avg(
                    func.extract('epoch', Job.completed_at - Job.started_at)
                )
            ).select_from(duration_query.subquery())
        )
        avg_duration = result.scalar() or 0
        
        return {
            "total_jobs": sum(status_counts.values()),
            "by_status": status_counts,
            "by_type": type_counts,
            "average_duration_seconds": float(avg_duration),
            "success_rate": (
                status_counts.get(JobStatus.COMPLETED.value, 0) /
                max(sum(status_counts.values()), 1) * 100
            ),
        }
    
    def _get_queue_for_priority(self, priority: JobPriority) -> str:
        """Get queue name for priority."""
        priority_to_queue = {
            JobPriority.LOW: "low",
            JobPriority.NORMAL: "default",
            JobPriority.HIGH: "high",
            JobPriority.CRITICAL: "high",
        }
        return priority_to_queue.get(priority, "default")
    
    def _get_celery_priority(self, priority: JobPriority) -> int:
        """Get Celery priority value."""
        priority_to_celery = {
            JobPriority.LOW: 1,
            JobPriority.NORMAL: 5,
            JobPriority.HIGH: 8,
            JobPriority.CRITICAL: 10,
        }
        return priority_to_celery.get(priority, 5)
    
    def _get_task_function(self, job_type: JobType):
        """Get Celery task function for job type."""
        from jidelnicek.tasks import (
            export_shopping_list,
            export_trip_data,
            export_recipes,
            export_large_dataset,
        )
        
        task_mapping = {
            JobType.EXPORT_SHOPPING_LIST: export_shopping_list,
            JobType.EXPORT_TRIP_DATA: export_trip_data,
            JobType.EXPORT_RECIPES: export_recipes,
            JobType.EXPORT_DATASET: export_large_dataset,
        }
        
        return task_mapping.get(job_type)
    
    async def _update_job_from_celery(self, job: Job) -> None:
        """Update job status from Celery."""
        try:
            task_info = get_task_info(job.task_id)
            
            # Map Celery status to JobStatus
            celery_to_job_status = {
                "PENDING": JobStatus.PENDING,
                "STARTED": JobStatus.RUNNING,
                "SUCCESS": JobStatus.COMPLETED,
                "FAILURE": JobStatus.FAILED,
                "RETRY": JobStatus.RETRYING,
                "REVOKED": JobStatus.CANCELLED,
            }
            
            new_status = celery_to_job_status.get(task_info["status"], job.status)
            
            if new_status != job.status:
                job.status = new_status
                
                if new_status == JobStatus.COMPLETED:
                    job.completed_at = task_info.get("date_done")
                    job.result = task_info.get("result")
                elif new_status == JobStatus.FAILED:
                    job.completed_at = task_info.get("date_done")
                    job.error_message = str(task_info.get("info", ""))
                    job.error_traceback = task_info.get("traceback")
            
            # Update progress if available
            if task_info.get("info") and isinstance(task_info["info"], dict):
                meta = task_info["info"]
                if "current" in meta and "total" in meta:
                    job.progress = (meta["current"] / meta["total"]) * 100
                if "status" in meta:
                    job.progress_message = meta["status"]
                    
        except Exception as e:
            logger.error(f"Failed to update job {job.id} from Celery: {e}")
    
    async def _send_job_notification(self, job: Job, event: str) -> None:
        """Send job notification."""
        # TODO: Implement actual notification logic
        # This could send emails, webhooks, etc.
        logger.info(f"Would send {event} notification for job {job.id}")
        
        # Record notification
        notification = JobNotification(
            job_id=job.id,
            notification_type="email",
            recipient=f"user_{job.user_id}@example.com",
            subject=f"Job {job.name} {event}",
            message=f"Your job '{job.name}' has {event}.",
            delivered=False,  # Would be updated by actual notification service
        )
        
        self.db.add(notification)
        await self.db.commit()