"""
WebSocket endpoint handlers.

This module provides the WebSocket endpoint handlers for real-time
communication features.
"""

import json
import logging
from typing import Optional
import asyncio
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.websockets import WebSocketState

from jidelnicek.auth.dependencies.auth import get_current_user_ws
from jidelnicek.auth.models import User
from jidelnicek.core.cache import cache_get
from .connection_manager import connection_manager

logger = logging.getLogger(__name__)


async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
) -> None:
    """
    Main WebSocket endpoint for real-time communication.
    
    Supports:
    - Export progress tracking
    - Real-time notifications
    - Heartbeat/ping-pong
    
    Args:
        websocket: The WebSocket connection
        token: Authentication token (passed as query parameter)
    """
    user = None
    
    try:
        # Authenticate user
        if not token:
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        user = await get_current_user_ws(token)
        if not user:
            await websocket.close(code=4001, reason="Invalid authentication")
            return
        
        # Connect the websocket
        await connection_manager.connect(
            websocket,
            str(user.id),
            metadata={"username": user.username}
        )
        
        # Start heartbeat task
        heartbeat_task = asyncio.create_task(
            _heartbeat_handler(websocket, str(user.id))
        )
        
        try:
            # Handle incoming messages
            while True:
                # Receive message
                try:
                    data = await websocket.receive_json()
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid JSON format"
                    })
                    continue
                
                # Process message based on type
                message_type = data.get("type")
                
                if message_type == "ping":
                    # Respond to ping
                    await connection_manager.handle_heartbeat(websocket)
                    await websocket.send_json({"type": "pong"})
                
                elif message_type == "subscribe":
                    # Subscribe to specific events
                    event_type = data.get("event_type")
                    event_id = data.get("event_id")
                    
                    if event_type == "export" and event_id:
                        # Join export progress room
                        room_id = f"export:{event_id}"
                        await connection_manager.join_room(websocket, room_id)
                        
                        # Send current progress if available
                        progress_data = await cache_get(f"export_progress:{event_id}")
                        if progress_data:
                            await websocket.send_json(json.loads(progress_data))
                    
                    elif event_type == "job" and event_id:
                        # Join job status room
                        room_id = f"job:{event_id}"
                        await connection_manager.join_room(websocket, room_id)
                
                elif message_type == "unsubscribe":
                    # Unsubscribe from events
                    event_type = data.get("event_type")
                    event_id = data.get("event_id")
                    
                    if event_type == "export" and event_id:
                        room_id = f"export:{event_id}"
                        await connection_manager.leave_room(websocket, room_id)
                    
                    elif event_type == "job" and event_id:
                        room_id = f"job:{event_id}"
                        await connection_manager.leave_room(websocket, room_id)
                
                else:
                    # Unknown message type
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    })
        
        finally:
            # Cancel heartbeat task
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user.id if user else 'unknown'}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.close(code=4000, reason="Internal error")
    finally:
        # Clean up connection
        await connection_manager.disconnect(websocket)


async def _heartbeat_handler(websocket: WebSocket, user_id: str) -> None:
    """
    Handle periodic heartbeat checks for a WebSocket connection.
    
    Args:
        websocket: The WebSocket connection
        user_id: User ID for the connection
    """
    try:
        while websocket.application_state == WebSocketState.CONNECTED:
            # Wait for heartbeat interval
            await asyncio.sleep(30)  # Send heartbeat every 30 seconds
            
            # Send heartbeat
            try:
                await websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": datetime.utcnow().isoformat()
                })
            except Exception:
                # Connection likely closed
                break
    except asyncio.CancelledError:
        # Task cancelled, normal shutdown
        pass
    except Exception as e:
        logger.error(f"Heartbeat handler error: {e}")