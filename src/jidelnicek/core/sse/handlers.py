"""
Server-Sent Events (SSE) endpoint handlers.

This module provides SSE endpoints as a fallback for real-time
communication when WebSockets are not available.
"""

import json
import logging
import asyncio
from typing import AsyncGenerator, Optional
from datetime import datetime

from fastapi import Request, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.auth.models import User
from jidelnicek.core.cache import cache_get, get_redis_client
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


async def sse_endpoint(
    request: Request,
    event_type: str,
    event_id: str,
    current_user: User = Depends(get_current_user),
) -> EventSourceResponse:
    """
    SSE endpoint for real-time event streaming.
    
    Args:
        request: The HTTP request
        event_type: Type of event to stream (export, job, etc.)
        event_id: ID of the specific event
        current_user: Authenticated user
        
    Returns:
        EventSourceResponse streaming events
    """
    # Validate event type
    if event_type not in ["export", "job"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid event type: {event_type}"
        )
    
    # Create event generator
    async def event_generator() -> AsyncGenerator[dict, None]:
        """Generate SSE events."""
        channel_key = f"{event_type}_progress:{event_id}"
        last_event_id = None
        retry_count = 0
        max_retries = 3
        
        try:
            while True:
                # Check if client is still connected
                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected for {event_type}:{event_id}")
                    break
                
                try:
                    # Get progress data from Redis
                    progress_data = await cache_get(channel_key)
                    
                    if progress_data:
                        # Parse and check if it's a new event
                        data = json.loads(progress_data)
                        event_id_str = f"{data.get('timestamp', '')}_{data.get('progress', 0)}"
                        
                        if event_id_str != last_event_id:
                            last_event_id = event_id_str
                            retry_count = 0
                            
                            # Yield the event
                            yield {
                                "event": event_type,
                                "id": event_id_str,
                                "retry": 5000,  # Retry after 5 seconds
                                "data": json.dumps(data)
                            }
                    
                    # Check for completion
                    if progress_data:
                        data = json.loads(progress_data)
                        if data.get("status") in ["completed", "failed", "cancelled"]:
                            # Send final event and close
                            yield {
                                "event": "close",
                                "data": json.dumps({"reason": f"Export {data.get('status')}"})
                            }
                            break
                    
                    # Wait before next check
                    await asyncio.sleep(1)  # Poll every second
                    
                except Exception as e:
                    logger.error(f"Error in SSE event generator: {e}")
                    retry_count += 1
                    
                    if retry_count >= max_retries:
                        yield {
                            "event": "error",
                            "data": json.dumps({"error": "Max retries reached"})
                        }
                        break
                    
                    await asyncio.sleep(2 ** retry_count)  # Exponential backoff
        
        except asyncio.CancelledError:
            logger.info(f"SSE event generator cancelled for {event_type}:{event_id}")
            raise
        finally:
            logger.info(f"SSE event generator finished for {event_type}:{event_id}")
    
    # Return SSE response
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        }
    )


async def sse_progress_stream(
    export_id: str,
    user_id: int,
    request: Request,
) -> AsyncGenerator[str, None]:
    """
    Stream export progress updates via SSE.
    
    Args:
        export_id: Export job ID
        user_id: User ID for access control
        request: The HTTP request
        
    Yields:
        SSE formatted events
    """
    channel_key = f"export_progress:{export_id}"
    last_update = None
    
    # Send initial event
    yield f"event: connected\ndata: {json.dumps({'export_id': export_id})}\n\n"
    
    try:
        redis = get_redis_client()
        if not redis:
            yield f"event: error\ndata: {json.dumps({'error': 'Redis not available'})}\n\n"
            return
            
            # Subscribe to progress updates using Redis pub/sub
            pubsub = redis.pubsub()
            await pubsub.subscribe(channel_key)
            
            try:
                # Send current progress if available
                current_progress = await redis.get(channel_key)
                if current_progress:
                    yield f"event: progress\ndata: {current_progress}\n\n"
                
                # Listen for updates
                async for message in pubsub.listen():
                    if await request.is_disconnected():
                        break
                    
                    if message["type"] == "message":
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode("utf-8")
                        
                        # Parse progress data
                        try:
                            progress = json.loads(data)
                            
                            # Check if this is a new update
                            update_key = f"{progress.get('progress')}_{progress.get('status')}"
                            if update_key != last_update:
                                last_update = update_key
                                yield f"event: progress\ndata: {data}\n\n"
                            
                            # Check for completion
                            if progress.get("status") in ["completed", "failed", "cancelled"]:
                                yield f"event: complete\ndata: {data}\n\n"
                                break
                        
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON in progress update: {data}")
            
            finally:
                await pubsub.unsubscribe(channel_key)
                await pubsub.close()
    
    except Exception as e:
        logger.error(f"Error in SSE progress stream: {e}")
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"


async def export_progress_sse(
    export_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Stream export progress updates via SSE.
    
    Args:
        export_id: Export job ID
        request: The HTTP request
        current_user: Authenticated user
        
    Returns:
        StreamingResponse with SSE events
    """
    # Verify user has access to this export
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
    
    # Create streaming response
    return StreamingResponse(
        sse_progress_stream(export_id, current_user.id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
            "Access-Control-Allow-Origin": "*",  # Adjust based on CORS settings
        }
    )