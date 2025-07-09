"""
Progress tracking service for long-running operations.

This service provides progress tracking functionality with ETA calculations,
speed measurements, and real-time updates via WebSockets/SSE.
"""

import json
import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import asyncio

from jidelnicek.core.cache import cache_get, cache_set, RedisClient
from jidelnicek.core.websockets.connection_manager import connection_manager

logger = logging.getLogger(__name__)


@dataclass
class ProgressStep:
    """Represents a single step in a multi-step operation."""
    name: str
    weight: float = 1.0  # Relative weight of this step
    progress: int = 0
    total: int = 100
    status: str = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class ProgressInfo:
    """Complete progress information for an operation."""
    operation_id: str
    operation_type: str
    user_id: int
    total_steps: int
    current_step: int
    overall_progress: float
    status: str
    message: str
    started_at: datetime
    updated_at: datetime
    eta_seconds: Optional[int] = None
    speed: Optional[float] = None
    steps: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class ProgressTracker:
    """
    Tracks progress for long-running operations with ETA calculation.
    
    Features:
    - Multi-step progress tracking
    - ETA calculation based on historical data
    - Speed measurements
    - Real-time updates via WebSocket/SSE
    - Progress persistence in Redis
    """
    
    def __init__(self, operation_id: str, operation_type: str, user_id: int):
        self.operation_id = operation_id
        self.operation_type = operation_type
        self.user_id = user_id
        self.steps: List[ProgressStep] = []
        self.current_step_index = 0
        self.started_at = datetime.utcnow()
        self.last_update = datetime.utcnow()
        self.items_processed = 0
        self.total_items = 0
        self.historical_speeds: List[float] = []
        self.metadata: Dict[str, Any] = {}
        self._update_lock = asyncio.Lock()
    
    async def initialize(
        self,
        steps: List[Dict[str, Any]],
        total_items: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize the progress tracker with steps.
        
        Args:
            steps: List of step definitions with name and optional weight
            total_items: Total number of items to process (for speed calculation)
            metadata: Additional metadata to store with progress
        """
        self.steps = [
            ProgressStep(
                name=step["name"],
                weight=step.get("weight", 1.0),
                total=step.get("total", 100)
            )
            for step in steps
        ]
        
        if total_items:
            self.total_items = total_items
        
        if metadata:
            self.metadata = metadata
        
        # Load historical speed data
        await self._load_historical_speeds()
        
        # Send initial progress
        await self._update_progress("Initializing...")
    
    async def start_step(self, step_index: int, message: Optional[str] = None) -> None:
        """
        Start a specific step.
        
        Args:
            step_index: Index of the step to start
            message: Optional status message
        """
        async with self._update_lock:
            if 0 <= step_index < len(self.steps):
                self.current_step_index = step_index
                step = self.steps[step_index]
                step.started_at = datetime.utcnow()
                step.status = "in_progress"
                step.progress = 0
                
                message = message or f"Starting: {step.name}"
                await self._update_progress(message)
    
    async def update_step_progress(
        self,
        progress: int,
        total: Optional[int] = None,
        message: Optional[str] = None,
        items_processed: Optional[int] = None
    ) -> None:
        """
        Update progress for the current step.
        
        Args:
            progress: Current progress value
            total: Optional total value (updates step total)
            message: Optional status message
            items_processed: Number of items processed (for speed calculation)
        """
        async with self._update_lock:
            if self.current_step_index < len(self.steps):
                step = self.steps[self.current_step_index]
                step.progress = progress
                
                if total is not None:
                    step.total = total
                
                if items_processed is not None:
                    self.items_processed = items_processed
                
                # Calculate speed if we have items
                if self.items_processed > 0:
                    elapsed = (datetime.utcnow() - self.started_at).total_seconds()
                    if elapsed > 0:
                        current_speed = self.items_processed / elapsed
                        self.historical_speeds.append(current_speed)
                        # Keep only recent speed measurements
                        if len(self.historical_speeds) > 10:
                            self.historical_speeds.pop(0)
                
                await self._update_progress(message or f"Processing: {step.name}")
    
    async def complete_step(
        self,
        message: Optional[str] = None,
        auto_next: bool = True
    ) -> None:
        """
        Complete the current step.
        
        Args:
            message: Optional completion message
            auto_next: Automatically start the next step
        """
        async with self._update_lock:
            if self.current_step_index < len(self.steps):
                step = self.steps[self.current_step_index]
                step.completed_at = datetime.utcnow()
                step.status = "completed"
                step.progress = step.total
                
                message = message or f"Completed: {step.name}"
                
                # Auto-advance to next step
                if auto_next and self.current_step_index + 1 < len(self.steps):
                    self.current_step_index += 1
                    next_step = self.steps[self.current_step_index]
                    next_step.started_at = datetime.utcnow()
                    next_step.status = "in_progress"
                    message = f"Starting: {next_step.name}"
                
                await self._update_progress(message)
    
    async def complete(
        self,
        status: str = "completed",
        message: Optional[str] = None
    ) -> None:
        """
        Complete the entire operation.
        
        Args:
            status: Final status (completed, failed, cancelled)
            message: Optional completion message
        """
        async with self._update_lock:
            # Complete any remaining steps
            for step in self.steps:
                if step.status != "completed":
                    step.status = status
                    if not step.completed_at:
                        step.completed_at = datetime.utcnow()
            
            # Save historical speed data
            await self._save_historical_speeds()
            
            # Send final update
            await self._update_progress(
                message or f"Operation {status}",
                status=status
            )
    
    async def fail(self, error: str) -> None:
        """
        Mark the operation as failed.
        
        Args:
            error: Error message
        """
        await self.complete(status="failed", message=f"Failed: {error}")
    
    async def cancel(self) -> None:
        """Mark the operation as cancelled."""
        await self.complete(status="cancelled", message="Operation cancelled")
    
    def _calculate_overall_progress(self) -> float:
        """
        Calculate overall progress based on weighted steps.
        
        Returns:
            Overall progress percentage (0-100)
        """
        if not self.steps:
            return 0.0
        
        total_weight = sum(step.weight for step in self.steps)
        weighted_progress = 0.0
        
        for step in self.steps:
            if step.status == "completed":
                weighted_progress += step.weight
            elif step.status == "in_progress" and step.total > 0:
                step_progress = (step.progress / step.total) * step.weight
                weighted_progress += step_progress
        
        return (weighted_progress / total_weight) * 100 if total_weight > 0 else 0.0
    
    def _calculate_eta(self) -> Optional[int]:
        """
        Calculate estimated time to completion.
        
        Returns:
            ETA in seconds, or None if cannot be calculated
        """
        overall_progress = self._calculate_overall_progress()
        
        if overall_progress <= 0 or overall_progress >= 100:
            return None
        
        elapsed = (datetime.utcnow() - self.started_at).total_seconds()
        
        # Method 1: Based on overall progress
        if elapsed > 0:
            total_time = (elapsed / overall_progress) * 100
            remaining_time = total_time - elapsed
            
            # Method 2: Based on item processing speed (if available)
            if self.historical_speeds and self.total_items > 0:
                avg_speed = sum(self.historical_speeds) / len(self.historical_speeds)
                items_remaining = self.total_items - self.items_processed
                speed_based_eta = items_remaining / avg_speed if avg_speed > 0 else None
                
                # Use the more conservative estimate
                if speed_based_eta:
                    remaining_time = max(remaining_time, speed_based_eta)
            
            return int(remaining_time) if remaining_time > 0 else None
        
        return None
    
    def _get_current_speed(self) -> Optional[float]:
        """
        Get current processing speed.
        
        Returns:
            Items per second, or None if not applicable
        """
        if self.historical_speeds:
            return sum(self.historical_speeds) / len(self.historical_speeds)
        return None
    
    async def _update_progress(self, message: str, status: str = "in_progress") -> None:
        """
        Send progress update via WebSocket and store in Redis.
        
        Args:
            message: Status message
            status: Current status
        """
        progress_info = ProgressInfo(
            operation_id=self.operation_id,
            operation_type=self.operation_type,
            user_id=self.user_id,
            total_steps=len(self.steps),
            current_step=self.current_step_index + 1,
            overall_progress=self._calculate_overall_progress(),
            status=status,
            message=message,
            started_at=self.started_at,
            updated_at=datetime.utcnow(),
            eta_seconds=self._calculate_eta() if status == "in_progress" else None,
            speed=self._get_current_speed(),
            steps=[
                {
                    "name": step.name,
                    "status": step.status,
                    "progress": step.progress,
                    "total": step.total,
                    "percentage": (step.progress / step.total * 100) if step.total > 0 else 0
                }
                for step in self.steps
            ],
            metadata=self.metadata
        )
        
        # Convert to dict
        progress_dict = asdict(progress_info)
        progress_dict["started_at"] = progress_info.started_at.isoformat()
        progress_dict["updated_at"] = progress_info.updated_at.isoformat()
        
        # Store in Redis
        progress_key = f"{self.operation_type}_progress:{self.operation_id}"
        await cache_set(
            progress_key,
            json.dumps(progress_dict),
            expire=3600  # 1 hour
        )
        
        # Publish to Redis pub/sub for SSE
        async with RedisClient() as redis:
            if redis:
                await redis.publish(progress_key, json.dumps(progress_dict))
        
        # Send via WebSocket
        await connection_manager.send_export_progress(
            user_id=str(self.user_id),
            export_id=self.operation_id,
            progress=int(progress_info.overall_progress),
            total=100,
            status=message,
            eta=progress_info.eta_seconds,
            speed=progress_info.speed
        )
        
        # Also broadcast to room subscribers
        room_id = f"{self.operation_type}:{self.operation_id}"
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": f"{self.operation_type}_progress",
                "data": progress_dict
            }
        )
        
        self.last_update = datetime.utcnow()
    
    async def _load_historical_speeds(self) -> None:
        """Load historical speed data for better ETA calculation."""
        speed_key = f"historical_speeds:{self.operation_type}:{self.user_id}"
        speeds_data = await cache_get(speed_key)
        
        if speeds_data:
            try:
                self.historical_speeds = json.loads(speeds_data)
            except json.JSONDecodeError:
                pass
    
    async def _save_historical_speeds(self) -> None:
        """Save historical speed data for future ETA calculations."""
        if self.historical_speeds:
            speed_key = f"historical_speeds:{self.operation_type}:{self.user_id}"
            await cache_set(
                speed_key,
                json.dumps(self.historical_speeds[-10:]),  # Keep last 10 speeds
                expire=86400 * 7  # 7 days
            )
    
    async def get_progress(self) -> Optional[ProgressInfo]:
        """
        Get current progress information.
        
        Returns:
            Current progress info or None if not found
        """
        progress_key = f"{self.operation_type}_progress:{self.operation_id}"
        progress_data = await cache_get(progress_key)
        
        if progress_data:
            data = json.loads(progress_data)
            return ProgressInfo(
                operation_id=data["operation_id"],
                operation_type=data["operation_type"],
                user_id=data["user_id"],
                total_steps=data["total_steps"],
                current_step=data["current_step"],
                overall_progress=data["overall_progress"],
                status=data["status"],
                message=data["message"],
                started_at=datetime.fromisoformat(data["started_at"]),
                updated_at=datetime.fromisoformat(data["updated_at"]),
                eta_seconds=data.get("eta_seconds"),
                speed=data.get("speed"),
                steps=data.get("steps"),
                metadata=data.get("metadata")
            )
        
        return None


class ExportProgressTracker(ProgressTracker):
    """Specialized progress tracker for export operations."""
    
    def __init__(self, export_id: str, export_type: str, user_id: int):
        super().__init__(
            operation_id=export_id,
            operation_type=f"export_{export_type}",
            user_id=user_id
        )
    
    async def initialize_export(
        self,
        total_items: int,
        export_format: str,
        include_compression: bool = False,
        include_upload: bool = False
    ) -> None:
        """
        Initialize export progress tracking with standard steps.
        
        Args:
            total_items: Total number of items to export
            export_format: Export format (pdf, excel, etc.)
            include_compression: Whether compression step is needed
            include_upload: Whether upload step is needed
        """
        steps = [
            {"name": "Data preparation", "weight": 0.2},
            {"name": f"Generating {export_format.upper()}", "weight": 0.5},
        ]
        
        if include_compression:
            steps.append({"name": "Compressing file", "weight": 0.2})
        
        if include_upload:
            steps.append({"name": "Uploading to storage", "weight": 0.1})
        
        # Finalization step
        steps.append({"name": "Finalizing export", "weight": 0.1})
        
        await self.initialize(
            steps=steps,
            total_items=total_items,
            metadata={
                "format": export_format,
                "include_compression": include_compression,
                "include_upload": include_upload
            }
        )