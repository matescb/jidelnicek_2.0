"""
Progress tracking API endpoints.

This module provides API endpoints for real-time progress tracking
of long-running operations via WebSockets and SSE.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request

from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.auth.models import User
from jidelnicek.core.websockets.handlers import websocket_endpoint
from jidelnicek.core.sse.handlers import sse_endpoint, export_progress_sse
from jidelnicek.core.services.progress_tracker import ProgressTracker
from jidelnicek.core.cache import cache_get
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/progress", tags=["progress"])


@router.websocket("/ws")
async def websocket_progress_endpoint(websocket):
    """
    WebSocket endpoint for real-time progress updates.
    
    Connect to this endpoint with authentication token as query parameter:
    ws://localhost:8000/api/v1/progress/ws?token=<your_token>
    
    Message format:
    - Subscribe: {"type": "subscribe", "event_type": "export", "event_id": "<export_id>"}
    - Unsubscribe: {"type": "unsubscribe", "event_type": "export", "event_id": "<export_id>"}
    - Ping: {"type": "ping"}
    
    Receives:
    - Progress updates: {"type": "export_progress", "export_id": "...", "progress": 50, ...}
    - Heartbeat: {"type": "heartbeat", "timestamp": "..."}
    - Pong: {"type": "pong"}
    """
    await websocket_endpoint(websocket)


@router.get("/sse/{event_type}/{event_id}")
async def sse_progress_endpoint(
    request: Request,
    event_type: str,
    event_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Server-Sent Events endpoint for progress tracking.
    
    Use this as a fallback when WebSockets are not available.
    
    Args:
        event_type: Type of event to track (export, job)
        event_id: ID of the specific event
        
    Returns:
        EventSourceResponse streaming progress updates
    """
    return await sse_endpoint(request, event_type, event_id, current_user)


@router.get("/export/{export_id}/sse")
async def export_progress_sse_endpoint(
    export_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    SSE endpoint specifically for export progress.
    
    Args:
        export_id: Export ID to track
        
    Returns:
        StreamingResponse with SSE events
    """
    return await export_progress_sse(export_id, request, current_user)


@router.get("/export/{export_id}")
async def get_export_progress(
    export_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get current progress for an export operation.
    
    Args:
        export_id: Export ID
        
    Returns:
        Current progress information
    """
    # Check if user has access to this export
    export_data = await cache_get(f"export:{export_id}")
    if not export_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found"
        )
    
    export_info = json.loads(export_data)
    if export_info.get("created_by") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get progress data
    progress_tracker = ProgressTracker(
        operation_id=export_id,
        operation_type=f"export_{export_info.get('type', 'unknown')}",
        user_id=current_user.id
    )
    
    progress_info = await progress_tracker.get_progress()
    
    if not progress_info:
        # Return basic info if no progress tracking yet
        return {
            "export_id": export_id,
            "status": "pending",
            "progress": 0,
            "total": 100,
            "message": "Export is queued"
        }
    
    return {
        "export_id": export_id,
        "status": progress_info.status,
        "progress": progress_info.overall_progress,
        "total": 100,
        "message": progress_info.message,
        "started_at": progress_info.started_at.isoformat(),
        "updated_at": progress_info.updated_at.isoformat(),
        "eta_seconds": progress_info.eta_seconds,
        "speed": progress_info.speed,
        "current_step": progress_info.current_step,
        "total_steps": progress_info.total_steps,
        "steps": progress_info.steps
    }


@router.get("/job/{job_id}")
async def get_job_progress(
    job_id: int,
    current_user: User = Depends(get_current_user),
):
    """
    Get current progress for a job.
    
    Args:
        job_id: Job ID
        
    Returns:
        Current progress information from job record
    """
    from jidelnicek.core.dependencies import get_db
    from jidelnicek.core.services.job_service import JobService
    from sqlalchemy.ext.asyncio import AsyncSession
    
    db: AsyncSession = Depends(get_db)
    job_service = JobService(db)
    
    job = await job_service.get_job(job_id, current_user.id)
    
    # Try to get detailed progress from progress tracker
    if job.task_id and job.job_type.value.startswith("export_"):
        # Check if we have export ID in result
        export_id = None
        if job.result and isinstance(job.result, dict):
            export_id = job.result.get("export_id")
        
        if export_id:
            progress_tracker = ProgressTracker(
                operation_id=export_id,
                operation_type=job.job_type.value,
                user_id=current_user.id
            )
            
            progress_info = await progress_tracker.get_progress()
            if progress_info:
                return {
                    "job_id": job_id,
                    "task_id": job.task_id,
                    "export_id": export_id,
                    "status": progress_info.status,
                    "progress": progress_info.overall_progress,
                    "total": 100,
                    "message": progress_info.message,
                    "started_at": progress_info.started_at.isoformat(),
                    "updated_at": progress_info.updated_at.isoformat(),
                    "eta_seconds": progress_info.eta_seconds,
                    "speed": progress_info.speed,
                    "current_step": progress_info.current_step,
                    "total_steps": progress_info.total_steps,
                    "steps": progress_info.steps
                }
    
    # Fallback to basic job progress
    return {
        "job_id": job_id,
        "task_id": job.task_id,
        "status": job.status.value,
        "progress": job.progress or 0,
        "total": 100,
        "message": job.progress_message or f"Job {job.status.value}",
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "updated_at": job.updated_at.isoformat(),
        "eta": job.eta.isoformat() if job.eta else None,
    }