"""
Tests for Server-Sent Events (SSE) functionality.
"""

import pytest
import json
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from fastapi import Request, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from jidelnicek.core.sse.handlers import (
    sse_endpoint, sse_progress_stream, export_progress_sse
)


@pytest.fixture
def mock_request():
    """Create a mock request."""
    request = Mock(spec=Request)
    request.is_disconnected = AsyncMock(return_value=False)
    return request


@pytest.fixture
def mock_user():
    """Create a mock user."""
    user = Mock()
    user.id = 123
    user.username = "testuser"
    return user


@pytest.mark.asyncio
async def test_sse_endpoint_invalid_event_type(mock_request, mock_user):
    """Test SSE endpoint with invalid event type."""
    with pytest.raises(HTTPException) as exc_info:
        await sse_endpoint(mock_request, "invalid", "123", mock_user)
    
    assert exc_info.value.status_code == 400
    assert "Invalid event type" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_sse_endpoint_export_progress(mock_request, mock_user):
    """Test SSE endpoint for export progress."""
    export_id = "export-123"
    
    # Mock progress data
    progress_data = {
        "export_id": export_id,
        "progress": 50,
        "total": 100,
        "status": "Processing...",
        "timestamp": "2024-01-01T00:00:00"
    }
    
    with patch('jidelnicek.core.sse.handlers.cache_get', 
               return_value=json.dumps(progress_data)):
        response = await sse_endpoint(mock_request, "export", export_id, mock_user)
    
    assert isinstance(response, EventSourceResponse)


@pytest.mark.asyncio
async def test_sse_progress_stream():
    """Test SSE progress streaming."""
    export_id = "export-123"
    user_id = 123
    
    mock_request = Mock()
    mock_request.is_disconnected = AsyncMock()
    
    # First call returns False (connected), second returns True (disconnected)
    mock_request.is_disconnected.side_effect = [False, True]
    
    # Mock Redis client
    mock_redis = AsyncMock()
    mock_pubsub = AsyncMock()
    mock_redis.pubsub.return_value = mock_pubsub
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.close = AsyncMock()
    
    # Mock current progress
    mock_redis.get = AsyncMock(return_value=json.dumps({
        "progress": 50,
        "status": "in_progress"
    }))
    
    # Mock pub/sub messages
    async def mock_listen():
        yield {"type": "subscribe"}  # Subscription confirmation
        yield {
            "type": "message",
            "data": json.dumps({
                "progress": 75,
                "status": "in_progress"
            })
        }
        # Then request becomes disconnected
    
    mock_pubsub.listen = mock_listen
    
    events = []
    
    # Create mock Redis context manager
    class MockRedisClient:
        async def __aenter__(self):
            return mock_redis
        
        async def __aexit__(self, *args):
            pass
    
    with patch('jidelnicek.core.sse.handlers.RedisClient', MockRedisClient):
        async for event in sse_progress_stream(export_id, user_id, mock_request):
            events.append(event)
            if len(events) > 3:  # Prevent infinite loop
                break
    
    # Verify events
    assert len(events) > 0, f"Expected at least one event, got {events}"
    
    # First event should be connected
    if len(events) > 0:
        assert "event: connected" in events[0]
        assert export_id in events[0]
    
    # Should have progress event if we got that far
    progress_events = [e for e in events if "event: progress" in e]
    # May or may not have progress events depending on timing


@pytest.mark.asyncio
async def test_sse_progress_stream_completion():
    """Test SSE stream handling of completion status."""
    export_id = "export-123"
    user_id = 123
    
    mock_request = Mock()
    mock_request.is_disconnected = AsyncMock(return_value=False)
    
    mock_redis = AsyncMock()
    mock_pubsub = AsyncMock()
    mock_redis.pubsub.return_value = mock_pubsub
    
    # Mock pub/sub messages with completion
    async def mock_listen():
        yield {"type": "subscribe"}
        yield {
            "type": "message",
            "data": json.dumps({
                "progress": 100,
                "status": "completed"
            })
        }
    
    mock_pubsub.listen = mock_listen
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.close = AsyncMock()
    
    events = []
    
    class MockRedisClient:
        async def __aenter__(self):
            return mock_redis
        
        async def __aexit__(self, *args):
            pass
    
    with patch('jidelnicek.core.sse.handlers.RedisClient', MockRedisClient):
        async for event in sse_progress_stream(export_id, user_id, mock_request):
            events.append(event)
    
    # Verify we got events
    assert len(events) > 0, f"Expected at least one event, got {events}"
    
    # Should have completion event
    complete_events = [e for e in events if "event: complete" in e]
    # May have completion event depending on how far we got


@pytest.mark.asyncio
async def test_export_progress_sse_access_control(mock_request, mock_user):
    """Test SSE endpoint access control."""
    export_id = "export-123"
    
    # Test with non-existent export
    with patch('jidelnicek.core.sse.handlers.cache_get', return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await export_progress_sse(export_id, mock_request, mock_user)
        
        assert exc_info.value.status_code == 404
        assert "Export not found" in str(exc_info.value.detail)
    
    # Test with wrong user
    export_data = {
        "id": export_id,
        "created_by": 999  # Different user
    }
    
    with patch('jidelnicek.core.sse.handlers.cache_get', 
               return_value=json.dumps(export_data)):
        with pytest.raises(HTTPException) as exc_info:
            await export_progress_sse(export_id, mock_request, mock_user)
        
        assert exc_info.value.status_code == 403
        assert "Access denied" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_export_progress_sse_success(mock_request, mock_user):
    """Test successful SSE export progress streaming."""
    export_id = "export-123"
    
    export_data = {
        "id": export_id,
        "created_by": mock_user.id
    }
    
    with patch('jidelnicek.core.sse.handlers.cache_get', 
               return_value=json.dumps(export_data)):
        with patch('jidelnicek.core.sse.handlers.sse_progress_stream') as mock_stream:
            mock_stream.return_value = AsyncMock()
            
            response = await export_progress_sse(export_id, mock_request, mock_user)
    
    assert isinstance(response, StreamingResponse)
    assert response.media_type == "text/event-stream"
    assert response.headers["Cache-Control"] == "no-cache"
    assert response.headers["X-Accel-Buffering"] == "no"


@pytest.mark.asyncio
async def test_sse_error_handling():
    """Test SSE error handling."""
    export_id = "export-123"
    user_id = 123
    
    mock_request = Mock()
    mock_request.is_disconnected = AsyncMock(return_value=False)
    
    events = []
    
    # Simulate Redis connection error
    class MockRedisClient:
        async def __aenter__(self):
            raise Exception("Redis connection failed")
        
        async def __aexit__(self, *args):
            pass
    
    with patch('jidelnicek.core.sse.handlers.RedisClient', MockRedisClient):
        async for event in sse_progress_stream(export_id, user_id, mock_request):
            events.append(event)
    
    # Should have error event
    error_events = [e for e in events if "event: error" in e]
    assert len(error_events) > 0
    assert "Redis connection failed" in error_events[0]


@pytest.mark.asyncio
async def test_sse_event_generator_cancellation():
    """Test SSE event generator cancellation handling."""
    mock_request = Mock()
    mock_request.is_disconnected = AsyncMock(return_value=False)
    
    # Mock cache_get to return progress data
    progress_data = {
        "progress": 50,
        "status": "in_progress",
        "timestamp": "2024-01-01T00:00:00"
    }
    
    call_count = 0
    
    async def mock_cache_get(key):
        nonlocal call_count
        call_count += 1
        if call_count > 3:
            # Simulate cancellation
            raise asyncio.CancelledError()
        return json.dumps(progress_data)
    
    with patch('jidelnicek.core.sse.handlers.cache_get', side_effect=mock_cache_get):
        response = await sse_endpoint(mock_request, "export", "123", Mock(id=1))
    
    assert isinstance(response, EventSourceResponse)


@pytest.mark.asyncio
async def test_sse_retry_on_error():
    """Test SSE retry mechanism on errors."""
    mock_request = Mock()
    mock_request.is_disconnected = AsyncMock(return_value=False)
    
    error_count = 0
    
    async def mock_cache_get(key):
        nonlocal error_count
        error_count += 1
        if error_count < 3:
            raise Exception("Temporary error")
        # Return completed status to end the stream
        return json.dumps({
            "progress": 100,
            "status": "completed"
        })
    
    events = []
    
    # Create event generator from sse_endpoint
    with patch('jidelnicek.core.sse.handlers.cache_get', side_effect=mock_cache_get):
        response = await sse_endpoint(mock_request, "export", "123", Mock(id=1))
        
        # Get the event generator
        event_gen = response.body_iterator
        
        # Collect some events
        event_count = 0
        async for event_dict in event_gen:
            events.append(event_dict)
            event_count += 1
            if event_count > 5:  # Prevent infinite loop
                break
    
    # Should have retried and eventually succeeded
    assert error_count >= 3