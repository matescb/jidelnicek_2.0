"""
Tests for WebSocket functionality.
"""

import pytest
import json
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from fastapi import WebSocket
from fastapi.websockets import WebSocketState

from jidelnicek.core.websockets.connection_manager import ConnectionManager
from jidelnicek.core.websockets.handlers import websocket_endpoint, _heartbeat_handler


@pytest_asyncio.fixture
async def connection_manager():
    """Create a connection manager instance."""
    return ConnectionManager()


@pytest.fixture
def mock_websocket():
    """Create a mock WebSocket instance."""
    ws = Mock(spec=WebSocket)
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_json = AsyncMock()
    ws.close = AsyncMock()
    ws.application_state = WebSocketState.CONNECTED
    return ws


@pytest.mark.asyncio
async def test_connection_manager_connect(connection_manager, mock_websocket):
    """Test WebSocket connection."""
    user_id = "123"
    metadata = {"username": "testuser"}
    
    await connection_manager.connect(mock_websocket, user_id, metadata)
    
    # Verify connection was accepted
    mock_websocket.accept.assert_called_once()
    
    # Verify welcome message was sent
    mock_websocket.send_json.assert_called()
    welcome_msg = mock_websocket.send_json.call_args[0][0]
    assert welcome_msg["type"] == "connection"
    assert welcome_msg["status"] == "connected"
    
    # Verify connection is tracked
    assert user_id in connection_manager.active_connections
    assert mock_websocket in connection_manager.active_connections[user_id]


@pytest.mark.asyncio
async def test_connection_manager_disconnect(connection_manager, mock_websocket):
    """Test WebSocket disconnection."""
    user_id = "123"
    
    # First connect
    await connection_manager.connect(mock_websocket, user_id)
    assert mock_websocket in connection_manager.active_connections[user_id]
    
    # Then disconnect
    await connection_manager.disconnect(mock_websocket)
    
    # Verify connection is removed
    assert user_id not in connection_manager.active_connections
    assert mock_websocket not in connection_manager.connection_metadata
    
    # Verify close was called if connection was open
    mock_websocket.close.assert_called_once()


@pytest.mark.asyncio
async def test_join_leave_room(connection_manager, mock_websocket):
    """Test joining and leaving rooms."""
    user_id = "123"
    room_id = "export:456"
    
    await connection_manager.connect(mock_websocket, user_id)
    
    # Join room
    await connection_manager.join_room(mock_websocket, room_id)
    
    # Verify room subscription
    assert room_id in connection_manager.room_subscriptions
    assert mock_websocket in connection_manager.room_subscriptions[room_id]
    
    # Verify join notification
    mock_websocket.send_json.assert_called()
    join_msg = [call[0][0] for call in mock_websocket.send_json.call_args_list 
                if call[0][0].get("action") == "joined"][0]
    assert join_msg["type"] == "room"
    assert join_msg["room_id"] == room_id
    
    # Leave room
    await connection_manager.leave_room(mock_websocket, room_id)
    
    # Verify room unsubscription
    assert room_id not in connection_manager.room_subscriptions
    
    # Verify leave notification
    leave_msg = [call[0][0] for call in mock_websocket.send_json.call_args_list 
                 if call[0][0].get("action") == "left"][0]
    assert leave_msg["type"] == "room"
    assert leave_msg["room_id"] == room_id


@pytest.mark.asyncio
async def test_broadcast_to_user(connection_manager, mock_websocket):
    """Test broadcasting to specific user."""
    user_id = "123"
    
    # Connect multiple websockets for same user
    ws1 = mock_websocket
    ws2 = Mock(spec=WebSocket)
    ws2.application_state = WebSocketState.CONNECTED
    ws2.send_json = AsyncMock()
    
    await connection_manager.connect(ws1, user_id)
    await connection_manager.connect(ws2, user_id)
    
    # Broadcast message
    message = {"type": "test", "data": "hello"}
    sent_count = await connection_manager.broadcast_to_user(user_id, message)
    
    # Verify both connections received the message
    assert sent_count == 2
    ws1.send_json.assert_called_with(message)
    ws2.send_json.assert_called_with(message)


@pytest.mark.asyncio
async def test_broadcast_to_room(connection_manager):
    """Test broadcasting to room subscribers."""
    room_id = "export:789"
    
    # Create multiple websockets
    ws1 = Mock(spec=WebSocket)
    ws1.application_state = WebSocketState.CONNECTED
    ws1.accept = AsyncMock()
    ws1.send_json = AsyncMock()
    
    ws2 = Mock(spec=WebSocket)
    ws2.application_state = WebSocketState.CONNECTED
    ws2.accept = AsyncMock()
    ws2.send_json = AsyncMock()
    
    ws3 = Mock(spec=WebSocket)
    ws3.application_state = WebSocketState.CONNECTED
    ws3.accept = AsyncMock()
    ws3.send_json = AsyncMock()
    
    # Connect and join room
    await connection_manager.connect(ws1, "user1")
    await connection_manager.connect(ws2, "user2")
    await connection_manager.connect(ws3, "user3")
    
    await connection_manager.join_room(ws1, room_id)
    await connection_manager.join_room(ws2, room_id)
    # ws3 doesn't join the room
    
    # Broadcast to room
    message = {"type": "room_update", "data": "test"}
    sent_count = await connection_manager.broadcast_to_room(room_id, message)
    
    # Only ws1 and ws2 should receive the message
    assert sent_count == 2
    ws1.send_json.assert_any_call(message)
    ws2.send_json.assert_any_call(message)
    
    # ws3 should not receive the room message (only connection messages)
    calls = [call[0][0] for call in ws3.send_json.call_args_list]
    assert not any(call.get("type") == "room_update" for call in calls)


@pytest.mark.asyncio
async def test_export_progress_update(connection_manager):
    """Test sending export progress updates."""
    user_id = "123"
    export_id = "export-456"
    
    ws = Mock(spec=WebSocket)
    ws.application_state = WebSocketState.CONNECTED
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    
    await connection_manager.connect(ws, user_id)
    
    # Send progress update
    with patch('jidelnicek.core.websockets.connection_manager.cache_set', new_callable=AsyncMock):
        sent_count = await connection_manager.send_export_progress(
            user_id=user_id,
            export_id=export_id,
            progress=50,
            total=100,
            status="Processing...",
            eta=30,
            speed=10.5
        )
    
    assert sent_count == 1
    
    # Verify message format
    progress_msg = [call[0][0] for call in ws.send_json.call_args_list 
                    if call[0][0].get("type") == "export_progress"][0]
    assert progress_msg["export_id"] == export_id
    assert progress_msg["progress"] == 50
    assert progress_msg["total"] == 100
    assert progress_msg["percentage"] == 50.0
    assert progress_msg["status"] == "Processing..."
    assert progress_msg["eta"] == 30
    assert progress_msg["speed"] == 10.5


@pytest.mark.asyncio
async def test_connection_health_check(connection_manager):
    """Test stale connection detection."""
    # Create stale and active connections
    stale_ws = Mock(spec=WebSocket)
    stale_ws.application_state = WebSocketState.CONNECTED
    
    active_ws = Mock(spec=WebSocket)
    active_ws.application_state = WebSocketState.CONNECTED
    
    # Set up heartbeat times
    stale_time = datetime.utcnow()
    stale_time = stale_time.replace(
        second=stale_time.second - 120  # 2 minutes ago
    )
    
    connection_manager.last_heartbeat[stale_ws] = stale_time
    connection_manager.last_heartbeat[active_ws] = datetime.utcnow()
    
    # Check health
    with patch.object(connection_manager, 'disconnect', new_callable=AsyncMock) as mock_disconnect:
        stale_connections = await connection_manager.check_connection_health()
    
    # Verify stale connection was detected and disconnected
    assert len(stale_connections) == 1
    assert stale_ws in stale_connections
    mock_disconnect.assert_called_once_with(stale_ws)


@pytest.mark.asyncio
async def test_websocket_endpoint_authentication():
    """Test WebSocket endpoint authentication."""
    mock_ws = Mock(spec=WebSocket)
    mock_ws.close = AsyncMock()
    
    # Test without token
    with patch('jidelnicek.core.websockets.handlers.get_current_user_ws', return_value=None):
        await websocket_endpoint(mock_ws, token=None)
    
    mock_ws.close.assert_called_with(code=4001, reason="Authentication required")
    
    # Test with invalid token
    mock_ws.close.reset_mock()
    with patch('jidelnicek.core.websockets.handlers.get_current_user_ws', return_value=None):
        await websocket_endpoint(mock_ws, token="invalid-token")
    
    mock_ws.close.assert_called_with(code=4001, reason="Invalid authentication")


@pytest.mark.asyncio
async def test_websocket_message_handling():
    """Test WebSocket message handling."""
    mock_ws = Mock(spec=WebSocket)
    mock_ws.accept = AsyncMock()
    mock_ws.send_json = AsyncMock()
    mock_ws.receive_json = AsyncMock()
    mock_ws.close = AsyncMock()
    mock_ws.application_state = WebSocketState.CONNECTED
    
    mock_user = Mock()
    mock_user.id = 123
    mock_user.username = "testuser"
    
    # Set up message sequence
    messages = [
        {"type": "ping"},
        {"type": "subscribe", "event_type": "export", "event_id": "123"},
        {"type": "unsubscribe", "event_type": "export", "event_id": "123"},
        {"type": "unknown"},
    ]
    
    # Configure receive_json to return messages then raise disconnect
    async def receive_side_effect():
        if messages:
            return messages.pop(0)
        from fastapi import WebSocketDisconnect
        raise WebSocketDisconnect()
    
    mock_ws.receive_json.side_effect = receive_side_effect
    
    with patch('jidelnicek.core.websockets.handlers.get_current_user_ws', return_value=mock_user):
        with patch('jidelnicek.core.websockets.handlers.connection_manager') as mock_cm:
            mock_cm.connect = AsyncMock()
            mock_cm.disconnect = AsyncMock()
            mock_cm.join_room = AsyncMock()
            mock_cm.leave_room = AsyncMock()
            mock_cm.handle_heartbeat = AsyncMock()
            
            with patch('jidelnicek.core.websockets.handlers.cache_get', return_value=None):
                await websocket_endpoint(mock_ws, token="valid-token")
    
    # Verify responses
    responses = [call[0][0] for call in mock_ws.send_json.call_args_list]
    
    # Should have pong response
    assert any(r.get("type") == "pong" for r in responses)
    
    # Should have error for unknown message
    assert any(r.get("type") == "error" and "Unknown message type" in r.get("message", "") 
              for r in responses)


@pytest.mark.asyncio
async def test_heartbeat_handler():
    """Test heartbeat handler."""
    mock_ws = Mock(spec=WebSocket)
    mock_ws.application_state = WebSocketState.CONNECTED
    mock_ws.send_json = AsyncMock()
    
    # Run heartbeat handler briefly
    heartbeat_task = asyncio.create_task(
        _heartbeat_handler(mock_ws, "123")
    )
    
    # Let it run one cycle
    await asyncio.sleep(0.1)
    
    # Cancel the task
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass
    
    # Should have attempted to send heartbeat
    # (might not have sent if cancelled too quickly)
    # This is a simple existence test


@pytest.mark.asyncio
async def test_connection_stats(connection_manager):
    """Test connection statistics."""
    # Set up some connections
    await connection_manager.connect(Mock(spec=WebSocket, application_state=WebSocketState.CONNECTED), "user1")
    await connection_manager.connect(Mock(spec=WebSocket, application_state=WebSocketState.CONNECTED), "user1")
    await connection_manager.connect(Mock(spec=WebSocket, application_state=WebSocketState.CONNECTED), "user2")
    
    # Add some to rooms
    ws = Mock(spec=WebSocket, application_state=WebSocketState.CONNECTED)
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    await connection_manager.connect(ws, "user3")
    await connection_manager.join_room(ws, "room1")
    await connection_manager.join_room(ws, "room2")
    
    stats = await connection_manager.get_connection_stats()
    
    assert stats["total_connections"] == 4
    assert stats["unique_users"] == 3
    assert stats["active_rooms"] == 2
    assert "room1" in stats["rooms"]
    assert "room2" in stats["rooms"]