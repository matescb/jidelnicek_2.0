"""
Job management API endpoints.

This module provides API endpoints for creating, tracking, and managing
background jobs, particularly for export operations.
"""

import logging
from typing import Optional, List
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.schemas.job import (
    JobCreate, JobUpdate, JobResponse, JobListResponse, JobStatistics,
    ShoppingListExportCreate, TripExportCreate, RecipeExportCreate,
    ExportResult
)
from jidelnicek.core.models.job import JobStatus, JobPriority, JobType
from jidelnicek.core.services.job_service import JobService
from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.auth.models import User
from jidelnicek.core.cache import cached, cache_delete
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Create a new background job.
    
    This endpoint creates a new job and submits it to the task queue
    for asynchronous processing.
    """
    job_service = JobService(db)
    
    # Create job
    job = await job_service.create_job(
        job_type=job_data.job_type,
        name=job_data.name,
        parameters=job_data.parameters,
        user_id=current_user.id,
        priority=job_data.priority,
        description=job_data.description,
        notify_on_completion=job_data.notify_on_completion,
        notify_on_failure=job_data.notify_on_failure,
    )
    
    # Submit to queue
    try:
        job = await job_service.submit_job(job)
    except Exception as e:
        logger.error(f"Failed to submit job: {e}")
        # Job record exists but failed to submit
        # User can retry later
    
    return JobResponse.model_validate(job)


@router.get("/{job_id}", response_model=JobResponse)
@cached("job", expire=60)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Get job details by ID.
    
    Returns the current status and details of a specific job.
    """
    job_service = JobService(db)
    job = await job_service.get_job(job_id, current_user.id)
    return JobResponse.model_validate(job)


@router.get("/", response_model=JobListResponse)
async def list_jobs(
    status: Optional[JobStatus] = None,
    job_type: Optional[JobType] = None,
    priority: Optional[JobPriority] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    order_by: str = Query("created_at", pattern="^(created_at|started_at|completed_at|priority|status)$"),
    order_desc: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobListResponse:
    """
    List jobs with filtering and pagination.
    
    Returns a paginated list of jobs for the current user.
    """
    job_service = JobService(db)
    
    jobs = await job_service.list_jobs(
        user_id=current_user.id,
        job_type=job_type,
        status=status,
        priority=priority,
        created_after=created_after,
        created_before=created_before,
        skip=skip,
        limit=limit,
        order_by=order_by,
        order_desc=order_desc,
    )
    
    # Get total count
    total_jobs = await job_service.count(user_id=current_user.id)
    
    return JobListResponse(
        jobs=[JobResponse.model_validate(job) for job in jobs],
        total=total_jobs,
        skip=skip,
        limit=limit,
    )


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    job_update: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Update job details.
    
    Allows updating certain job properties like name, description, and notification settings.
    """
    job_service = JobService(db)
    
    job = await job_service.get_job(job_id, current_user.id)
    
    # Update fields
    update_data = job_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)
    
    await db.commit()
    await db.refresh(job)
    
    # Clear cache
    await cache_delete(f"job:{job_id}")
    
    return JobResponse.model_validate(job)


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Cancel a running job.
    
    Attempts to cancel a job that is currently running or pending.
    """
    job_service = JobService(db)
    
    try:
        job = await job_service.cancel_job(job_id, current_user.id)
        
        # Clear cache
        await cache_delete(f"job:{job_id}")
        
        return JobResponse.model_validate(job)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{job_id}/retry", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def retry_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Retry a failed job.
    
    Creates a new job with the same parameters and submits it for processing.
    """
    job_service = JobService(db)
    
    try:
        new_job = await job_service.retry_job(job_id, current_user.id)
        return JobResponse.model_validate(new_job)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a job.
    
    Soft deletes a job record. The job must be in a terminal state
    (completed, failed, or cancelled).
    """
    job_service = JobService(db)
    
    job = await job_service.get_job(job_id, current_user.id)
    
    if not job.is_terminal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete job in {job.status} state"
        )
    
    await job_service.delete_job(job_id, current_user.id)
    
    # Clear cache
    await cache_delete(f"job:{job_id}")


@router.get("/statistics/summary", response_model=JobStatistics)
@cached("job_stats", expire=300)
async def get_job_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobStatistics:
    """
    Get job statistics.
    
    Returns statistics about jobs including counts by status and type,
    average duration, and success rate.
    """
    job_service = JobService(db)
    
    stats = await job_service.get_job_statistics(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
    )
    
    return JobStatistics(**stats)


# Export-specific endpoints

@router.post("/export/shopping-list", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def export_shopping_list(
    export_data: ShoppingListExportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Create a shopping list export job.
    
    Exports a shopping list for a specific trip in the requested format.
    """
    job_service = JobService(db)
    
    # Prepare parameters
    parameters = {
        "trip_id": export_data.trip_id,
        "format": export_data.format,
        "options": {
            "group_by_category": export_data.group_by_category,
            "include_prices": export_data.include_prices,
            "include_quantities": export_data.include_quantities,
            **export_data.options,
        },
        "user_id": current_user.id,
    }
    
    # Create and submit job
    job = await job_service.create_job(
        job_type=JobType.EXPORT_SHOPPING_LIST,
        name=f"Export Shopping List (Trip {export_data.trip_id})",
        parameters=parameters,
        user_id=current_user.id,
        priority=export_data.priority,
        notify_on_completion=export_data.notify_on_completion,
    )
    
    job = await job_service.submit_job(job)
    return JobResponse.model_validate(job)


@router.post("/export/trip", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def export_trip_data(
    export_data: TripExportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Create a trip data export job.
    
    Exports complete trip data including meal plans, shopping lists, and participants.
    """
    job_service = JobService(db)
    
    # Prepare parameters
    parameters = {
        "trip_id": export_data.trip_id,
        "format": export_data.format,
        "include_shopping_list": export_data.include_shopping_list,
        "include_meal_plans": export_data.include_meal_plans,
        "include_participants": export_data.include_participants,
        "include_qr_codes": export_data.include_qr_codes,
        "user_id": current_user.id,
    }
    
    # Create and submit job
    job = await job_service.create_job(
        job_type=JobType.EXPORT_TRIP_DATA,
        name=f"Export Trip Data (Trip {export_data.trip_id})",
        parameters=parameters,
        user_id=current_user.id,
        priority=export_data.priority,
        notify_on_completion=export_data.notify_on_completion,
    )
    
    job = await job_service.submit_job(job)
    return JobResponse.model_validate(job)


@router.post("/export/recipes", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def export_recipes(
    export_data: RecipeExportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    """
    Create a recipe export job.
    
    Exports recipes in the requested format with optional images and nutrition information.
    """
    job_service = JobService(db)
    
    # Prepare parameters
    parameters = {
        "recipe_ids": export_data.recipe_ids,
        "format": export_data.format,
        "include_images": export_data.include_images,
        "include_nutrition": export_data.include_nutrition,
        "include_instructions": export_data.include_instructions,
        "user_id": current_user.id,
    }
    
    # Create and submit job
    job = await job_service.create_job(
        job_type=JobType.EXPORT_RECIPES,
        name=f"Export Recipes ({len(export_data.recipe_ids) if export_data.recipe_ids else 'All'})",
        parameters=parameters,
        user_id=current_user.id,
        priority=export_data.priority,
        notify_on_completion=export_data.notify_on_completion,
    )
    
    job = await job_service.submit_job(job)
    return JobResponse.model_validate(job)


# Export download endpoint (separate from jobs router)
export_router = APIRouter(prefix="/api/v1/exports", tags=["exports"])


@export_router.get("/{export_id}/download")
async def download_export(
    export_id: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """
    Download an exported file.
    
    Returns the exported file if it exists and hasn't expired.
    """
    from jidelnicek.core.cache import cache_get
    
    # Get export metadata from Redis
    export_data = await cache_get(f"export:{export_id}")
    
    if not export_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found or has expired"
        )
    
    # Check if user has access
    if export_data.get("created_by") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if file exists
    file_path = Path(export_data["file_path"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file not found"
        )
    
    # Return file
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream",
    )