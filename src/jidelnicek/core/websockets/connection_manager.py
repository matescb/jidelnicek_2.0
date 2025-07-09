"""
WebSocket connection manager for handling multiple connections.

This module manages WebSocket connections, handles broadcasting,
and provides room-based communication for targeted messaging.
"""

import json
import logging
from typing import Dict, Set, Optional, Any, List
from datetime import datetime
import asyncio

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from jidelnicek.core.cache import cache_get, cache_set
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections and message broadcasting.
    
    Supports:
    - Connection tracking
    - Room-based messaging
    - Broadcasting to all connections
    - User-specific messaging
    - Connection health monitoring
    """
    
    def __init__(self):
        # Track active connections by user ID
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Track connection metadata
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        # Room subscriptions
        self.room_subscriptions: Dict[str, Set[WebSocket]] = {}
        # Connection heartbeat timestamps
        self.last_heartbeat: Dict[WebSocket, datetime] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Accept and register a new WebSocket connection.
        
        Args:
            websocket: The WebSocket connection
            user_id: User ID associated with the connection
            metadata: Optional metadata for the connection
        """
        await websocket.accept()
        
        async with self._lock:
            # Add to active connections
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
            
            # Store metadata
            self.connection_metadata[websocket] = {
                "user_id": user_id,
                "connected_at": datetime.utcnow(),
                "rooms": set(),
                **(metadata or {})
            }
            
            # Initialize heartbeat
            self.last_heartbeat[websocket] = datetime.utcnow()
        
        # Send welcome message
        await self.send_personal_message(
            {
                "type": "connection",
                "status": "connected",
                "timestamp": datetime.utcnow().isoformat()
            },
            websocket
        )
        
        logger.info(f"WebSocket connected for user {user_id}")
    
    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Disconnect and clean up a WebSocket connection.
        
        Args:
            websocket: The WebSocket connection to disconnect
        """
        async with self._lock:
            # Get user ID from metadata
            metadata = self.connection_metadata.get(websocket, {})
            user_id = metadata.get("user_id")
            
            if user_id and user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            
            # Remove from all rooms
            for room_id in list(metadata.get("rooms", [])):
                await self._leave_room_internal(websocket, room_id)
            
            # Clean up metadata
            self.connection_metadata.pop(websocket, None)
            self.last_heartbeat.pop(websocket, None)
        
        # Close connection if still open
        if websocket.application_state == WebSocketState.CONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass
        
        logger.info(f"WebSocket disconnected for user {user_id}")
    
    async def join_room(self, websocket: WebSocket, room_id: str) -> None:
        """
        Add a connection to a room for targeted messaging.
        
        Args:
            websocket: The WebSocket connection
            room_id: Room ID to join
        """
        async with self._lock:
            # Add to room
            if room_id not in self.room_subscriptions:
                self.room_subscriptions[room_id] = set()
            self.room_subscriptions[room_id].add(websocket)
            
            # Update metadata
            if websocket in self.connection_metadata:
                self.connection_metadata[websocket]["rooms"].add(room_id)
        
        # Notify about room join
        await self.send_personal_message(
            {
                "type": "room",
                "action": "joined",
                "room_id": room_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            websocket
        )
        
        logger.debug(f"WebSocket joined room {room_id}")
    
    async def leave_room(self, websocket: WebSocket, room_id: str) -> None:
        """
        Remove a connection from a room.
        
        Args:
            websocket: The WebSocket connection
            room_id: Room ID to leave
        """
        async with self._lock:
            await self._leave_room_internal(websocket, room_id)
        
        # Notify about room leave
        await self.send_personal_message(
            {
                "type": "room",
                "action": "left",
                "room_id": room_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            websocket
        )
        
        logger.debug(f"WebSocket left room {room_id}")
    
    async def _leave_room_internal(self, websocket: WebSocket, room_id: str) -> None:
        """Internal method to leave a room without lock."""
        if room_id in self.room_subscriptions:
            self.room_subscriptions[room_id].discard(websocket)
            if not self.room_subscriptions[room_id]:
                del self.room_subscriptions[room_id]
        
        if websocket in self.connection_metadata:
            self.connection_metadata[websocket]["rooms"].discard(room_id)
    
    async def send_personal_message(
        self,
        message: Dict[str, Any],
        websocket: WebSocket
    ) -> bool:
        """
        Send a message to a specific WebSocket connection.
        
        Args:
            message: Message data to send
            websocket: Target WebSocket connection
            
        Returns:
            True if message was sent successfully
        """
        if websocket.application_state != WebSocketState.CONNECTED:
            return False
        
        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Error sending message to websocket: {e}")
            await self.disconnect(websocket)
            return False
    
    async def broadcast_to_user(
        self,
        user_id: str,
        message: Dict[str, Any]
    ) -> int:
        """
        Broadcast a message to all connections for a specific user.
        
        Args:
            user_id: Target user ID
            message: Message data to send
            
        Returns:
            Number of connections that received the message
        """
        sent_count = 0
        
        async with self._lock:
            connections = list(self.active_connections.get(user_id, []))
        
        for websocket in connections:
            if await self.send_personal_message(message, websocket):
                sent_count += 1
        
        return sent_count
    
    async def broadcast_to_room(
        self,
        room_id: str,
        message: Dict[str, Any],
        exclude_websocket: Optional[WebSocket] = None
    ) -> int:
        """
        Broadcast a message to all connections in a room.
        
        Args:
            room_id: Target room ID
            message: Message data to send
            exclude_websocket: Optional WebSocket to exclude from broadcast
            
        Returns:
            Number of connections that received the message
        """
        sent_count = 0
        
        async with self._lock:
            connections = list(self.room_subscriptions.get(room_id, []))
        
        for websocket in connections:
            if websocket != exclude_websocket:
                if await self.send_personal_message(message, websocket):
                    sent_count += 1
        
        return sent_count
    
    async def broadcast_to_all(
        self,
        message: Dict[str, Any],
        exclude_websocket: Optional[WebSocket] = None
    ) -> int:
        """
        Broadcast a message to all connected clients.
        
        Args:
            message: Message data to send
            exclude_websocket: Optional WebSocket to exclude from broadcast
            
        Returns:
            Number of connections that received the message
        """
        sent_count = 0
        
        async with self._lock:
            all_connections = []
            for connections in self.active_connections.values():
                all_connections.extend(connections)
        
        for websocket in all_connections:
            if websocket != exclude_websocket:
                if await self.send_personal_message(message, websocket):
                    sent_count += 1
        
        return sent_count
    
    async def handle_heartbeat(self, websocket: WebSocket) -> None:
        """
        Update heartbeat timestamp for a connection.
        
        Args:
            websocket: The WebSocket connection
        """
        async with self._lock:
            self.last_heartbeat[websocket] = datetime.utcnow()
    
    async def check_connection_health(self) -> List[WebSocket]:
        """
        Check connection health and return stale connections.
        
        Returns:
            List of stale WebSocket connections
        """
        stale_connections = []
        current_time = datetime.utcnow()
        heartbeat_timeout = settings.websocket_heartbeat_timeout  # Default: 60 seconds
        
        async with self._lock:
            for websocket, last_beat in list(self.last_heartbeat.items()):
                time_since_heartbeat = (current_time - last_beat).total_seconds()
                if time_since_heartbeat > heartbeat_timeout:
                    stale_connections.append(websocket)
        
        # Disconnect stale connections
        for websocket in stale_connections:
            logger.warning("Disconnecting stale WebSocket connection")
            await self.disconnect(websocket)
        
        return stale_connections
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """
        Get statistics about current connections.
        
        Returns:
            Connection statistics
        """
        async with self._lock:
            total_connections = sum(
                len(connections) for connections in self.active_connections.values()
            )
            
            return {
                "total_connections": total_connections,
                "unique_users": len(self.active_connections),
                "active_rooms": len(self.room_subscriptions),
                "rooms": {
                    room_id: len(connections)
                    for room_id, connections in self.room_subscriptions.items()
                }
            }
    
    async def send_export_progress(
        self,
        user_id: str,
        export_id: str,
        progress: int,
        total: int,
        status: str,
        eta: Optional[int] = None,
        speed: Optional[float] = None
    ) -> int:
        """
        Send export progress update to a user.
        
        Args:
            user_id: Target user ID
            export_id: Export job ID
            progress: Current progress value
            total: Total progress value
            status: Status message
            eta: Estimated time to completion in seconds
            speed: Processing speed (items/second)
            
        Returns:
            Number of connections that received the update
        """
        message = {
            "type": "export_progress",
            "export_id": export_id,
            "progress": progress,
            "total": total,
            "percentage": round((progress / total) * 100, 2) if total > 0 else 0,
            "status": status,
            "eta": eta,
            "speed": speed,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Also store in Redis for SSE fallback
        await cache_set(
            f"export_progress:{export_id}",
            json.dumps(message),
            expire=3600  # 1 hour
        )
        
        return await self.broadcast_to_user(user_id, message)


# Global connection manager instance
connection_manager = ConnectionManager()