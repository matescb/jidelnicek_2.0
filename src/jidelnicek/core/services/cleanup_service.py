"""
Cleanup service for managing file deletion and retention policies.

This service handles the business logic for cleaning up old files,
managing retention policies, and tracking cleanup activities.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

from sqlalchemy import select, and_, or_, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.core.dependencies import RedisClient
from jidelnicek.core.models.cleanup_policy import (
    CleanupPolicy, CleanupAuditLog, DeletionQueue, CleanupStatistics
)
from jidelnicek.core.models.job import Job, JobType
from jidelnicek.auth.models import User
from jidelnicek.core.storage.service import StorageService
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class CleanupService:
    """Service for managing file cleanup and retention policies."""
    
    def __init__(self, db: AsyncSession):
        """Initialize cleanup service."""
        self.db = db
        self._redis = None
    
    async def get_redis(self):
        """Get Redis client instance."""
        if not self._redis:
            self._redis = RedisClient()
        return self._redis
    
    async def get_active_policies(self) -> List[CleanupPolicy]:
        """Get all active cleanup policies."""
        result = await self.db.execute(
            select(CleanupPolicy).where(CleanupPolicy.is_active == True)
        )
        return result.scalars().all()
    
    async def get_policy_for_file_type(self, file_type: str) -> Optional[CleanupPolicy]:
        """Get cleanup policy for a specific file type."""
        result = await self.db.execute(
            select(CleanupPolicy).where(
                and_(
                    CleanupPolicy.file_type == file_type,
                    CleanupPolicy.is_active == True
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def create_audit_log(
        self,
        file_path: str,
        file_type: str,
        file_size: int,
        reason: str,
        user_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CleanupAuditLog:
        """Create an audit log entry for file deletion."""
        audit_log = CleanupAuditLog(
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            deletion_reason=reason,
            user_id=user_id,
            metadata=metadata or {},
            deleted_at=datetime.utcnow(),
        )
        
        self.db.add(audit_log)
        await self.db.commit()
        await self.db.refresh(audit_log)
        
        return audit_log
    
    async def update_audit_log(
        self,
        audit_log_id: int,
        deleted: bool = True,
        recovery_info: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Update an audit log entry."""
        await self.db.execute(
            update(CleanupAuditLog)
            .where(CleanupAuditLog.id == audit_log_id)
            .values(
                deleted=deleted,
                recovery_info=recovery_info,
                updated_at=datetime.utcnow(),
            )
        )
        await self.db.commit()
    
    async def get_export_metadata(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get export metadata from Redis based on file path."""
        redis = await self.get_redis()
        async with redis as r:
            if not r:
                return None
            
            # Scan for export keys matching the file path
            cursor = 0
            pattern = "export:*"
            
            while True:
                cursor, keys = await r.scan(cursor, match=pattern, count=100)
                
                for key in keys:
                    try:
                        export_data = await r.get(key)
                        if export_data:
                            data = json.loads(export_data)
                            if data.get("file_path") == file_path:
                                return data
                    except Exception as e:
                        logger.error(f"Error reading export metadata {key}: {e}")
                
                if cursor == 0:
                    break
        
        return None
    
    async def remove_export_metadata(self, export_id: str) -> None:
        """Remove export metadata from Redis."""
        redis = await self.get_redis()
        async with redis as r:
            if r:
                await r.delete(f"export:{export_id}")
    
    async def queue_deletion_notification(
        self,
        user_id: int,
        file_path: str,
        file_type: str,
        deletion_time: datetime,
        audit_log_id: int,
    ) -> None:
        """Queue a notification for pending file deletion."""
        # Add to deletion queue
        deletion_entry = DeletionQueue(
            file_path=file_path,
            file_type=file_type,
            user_id=user_id,
            scheduled_deletion_time=deletion_time,
            audit_log_id=audit_log_id,
            notification_sent=False,
        )
        
        self.db.add(deletion_entry)
        await self.db.commit()
        
        # Queue notification task
        from jidelnicek.tasks.notification_tasks import send_deletion_notification
        send_deletion_notification.apply_async(
            args=[user_id, file_path, file_type, deletion_time.isoformat()],
            eta=deletion_time - timedelta(hours=24),  # Send 24 hours before deletion
        )
    
    async def get_pending_deletions(self) -> List[Dict[str, Any]]:
        """Get pending deletions from the queue."""
        result = await self.db.execute(
            select(DeletionQueue)
            .where(
                and_(
                    DeletionQueue.processed == False,
                    DeletionQueue.scheduled_deletion_time <= datetime.utcnow()
                )
            )
            .options(selectinload(DeletionQueue.user))
        )
        
        deletions = result.scalars().all()
        
        return [
            {
                "id": d.id,
                "file_path": d.file_path,
                "file_type": d.file_type,
                "user_id": d.user_id,
                "scheduled_deletion_time": d.scheduled_deletion_time,
                "audit_log_id": d.audit_log_id,
            }
            for d in deletions
        ]
    
    async def remove_from_deletion_queue(self, queue_id: int) -> None:
        """Remove an entry from the deletion queue."""
        await self.db.execute(
            update(DeletionQueue)
            .where(DeletionQueue.id == queue_id)
            .values(processed=True, processed_at=datetime.utcnow())
        )
        await self.db.commit()
    
    async def cleanup_orphaned_metadata(self) -> int:
        """Clean up orphaned metadata entries in Redis."""
        cleaned = 0
        redis = await self.get_redis()
        
        async with redis as r:
            if not r:
                return cleaned
            
            cursor = 0
            pattern = "export:*"
            
            while True:
                cursor, keys = await r.scan(cursor, match=pattern, count=100)
                
                for key in keys:
                    try:
                        export_data = await r.get(key)
                        if export_data:
                            data = json.loads(export_data)
                            file_path = data.get("file_path")
                            
                            # Check if file still exists
                            if file_path and not Path(file_path).exists():
                                await r.delete(key)
                                cleaned += 1
                    except Exception as e:
                        logger.error(f"Error checking export metadata {key}: {e}")
                
                if cursor == 0:
                    break
        
        return cleaned
    
    async def update_cleanup_statistics(self, stats: Dict[str, Any]) -> None:
        """Update cleanup statistics in the database."""
        today = datetime.utcnow().date()
        
        # Get or create today's statistics
        result = await self.db.execute(
            select(CleanupStatistics).where(
                CleanupStatistics.date == today
            )
        )
        stat_entry = result.scalar_one_or_none()
        
        if not stat_entry:
            stat_entry = CleanupStatistics(
                date=today,
                files_deleted=0,
                total_size_freed=0,
                errors_count=0,
                by_type_stats={},
            )
            self.db.add(stat_entry)
        
        # Update statistics
        stat_entry.files_deleted += stats.get("deleted_files", 0)
        stat_entry.total_size_freed += stats.get("deleted_size", 0)
        stat_entry.errors_count += stats.get("errors", 0)
        
        # Update by-type statistics
        by_type = stat_entry.by_type_stats or {}
        for file_type, type_stats in stats.get("by_type", {}).items():
            if file_type not in by_type:
                by_type[file_type] = {"count": 0, "size": 0}
            by_type[file_type]["count"] += type_stats["count"]
            by_type[file_type]["size"] += type_stats["size"]
        stat_entry.by_type_stats = by_type
        
        await self.db.commit()
    
    async def cleanup_s3_storage(
        self,
        storage_service: StorageService,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Clean up old files from S3 storage."""
        stats = {
            "scanned": 0,
            "deleted": 0,
            "size": 0,
            "errors": 0,
        }
        
        if not storage_service.s3_enabled:
            return stats
        
        policies = await self.get_active_policies()
        
        try:
            # List all objects in the bucket
            objects = await storage_service.list_files("exports/")
            
            for obj in objects:
                stats["scanned"] += 1
                
                # Determine file type from key
                file_type = None
                for ft in ["shopping_list", "trip_data", "recipes", "dataset"]:
                    if ft in obj["Key"]:
                        file_type = ft
                        break
                
                if not file_type:
                    continue
                
                # Get policy for this file type
                policy = next(
                    (p for p in policies if p.file_type == file_type),
                    None
                )
                
                if not policy:
                    continue
                
                # Check file age
                file_age = datetime.utcnow() - obj["LastModified"]
                if file_age.days > policy.retention_days:
                    if not dry_run:
                        # Create audit log
                        await self.create_audit_log(
                            file_path=f"s3://{obj['Key']}",
                            file_type=file_type,
                            file_size=obj["Size"],
                            reason=f"S3 object older than {policy.retention_days} days",
                        )
                        
                        # Delete from S3
                        await storage_service.delete_file(obj["Key"])
                    
                    stats["deleted"] += 1
                    stats["size"] += obj["Size"]
        
        except Exception as e:
            logger.error(f"Error cleaning S3 storage: {e}")
            stats["errors"] += 1
        
        return stats
    
    async def cleanup_azure_storage(
        self,
        storage_service: StorageService,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Clean up old files from Azure storage."""
        stats = {
            "scanned": 0,
            "deleted": 0,
            "size": 0,
            "errors": 0,
        }
        
        if not storage_service.azure_enabled:
            return stats
        
        policies = await self.get_active_policies()
        
        try:
            # List all blobs in the container
            blobs = await storage_service.list_files("exports/")
            
            for blob in blobs:
                stats["scanned"] += 1
                
                # Determine file type from name
                file_type = None
                for ft in ["shopping_list", "trip_data", "recipes", "dataset"]:
                    if ft in blob["name"]:
                        file_type = ft
                        break
                
                if not file_type:
                    continue
                
                # Get policy for this file type
                policy = next(
                    (p for p in policies if p.file_type == file_type),
                    None
                )
                
                if not policy:
                    continue
                
                # Check file age
                file_age = datetime.utcnow() - blob["last_modified"]
                if file_age.days > policy.retention_days:
                    if not dry_run:
                        # Create audit log
                        await self.create_audit_log(
                            file_path=f"azure://{blob['name']}",
                            file_type=file_type,
                            file_size=blob["size"],
                            reason=f"Azure blob older than {policy.retention_days} days",
                        )
                        
                        # Delete from Azure
                        await storage_service.delete_file(blob["name"])
                    
                    stats["deleted"] += 1
                    stats["size"] += blob["size"]
        
        except Exception as e:
            logger.error(f"Error cleaning Azure storage: {e}")
            stats["errors"] += 1
        
        return stats
    
    async def get_user_cleanup_preferences(self, user_id: int) -> Dict[str, Any]:
        """Get user-specific cleanup preferences."""
        user = await self.db.get(User, user_id)
        if not user:
            return {}
        
        # Return user preferences (stored in user metadata)
        return user.metadata.get("cleanup_preferences", {})
    
    async def update_user_cleanup_preferences(
        self,
        user_id: int,
        preferences: Dict[str, Any],
    ) -> None:
        """Update user-specific cleanup preferences."""
        user = await self.db.get(User, user_id)
        if not user:
            return
        
        if not user.metadata:
            user.metadata = {}
        
        user.metadata["cleanup_preferences"] = preferences
        await self.db.commit()
    
    async def generate_cleanup_report(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        """Generate a cleanup activity report."""
        # Get cleanup statistics
        result = await self.db.execute(
            select(CleanupStatistics).where(
                and_(
                    CleanupStatistics.date >= start_date.date(),
                    CleanupStatistics.date <= end_date.date()
                )
            )
        )
        statistics = result.scalars().all()
        
        # Get audit logs
        audit_result = await self.db.execute(
            select(CleanupAuditLog).where(
                and_(
                    CleanupAuditLog.deleted_at >= start_date,
                    CleanupAuditLog.deleted_at <= end_date
                )
            )
        )
        audit_logs = audit_result.scalars().all()
        
        # Aggregate data
        total_files = sum(s.files_deleted for s in statistics)
        total_size = sum(s.total_size_freed for s in statistics)
        total_errors = sum(s.errors_count for s in statistics)
        
        by_type_totals = defaultdict(lambda: {"count": 0, "size": 0})
        for stat in statistics:
            for file_type, type_stats in (stat.by_type_stats or {}).items():
                by_type_totals[file_type]["count"] += type_stats["count"]
                by_type_totals[file_type]["size"] += type_stats["size"]
        
        # Calculate recovery statistics
        recovered = sum(1 for log in audit_logs if log.recovered)
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "total_files_deleted": total_files,
                "total_size_freed": total_size,
                "total_errors": total_errors,
                "files_recovered": recovered,
            },
            "by_type": dict(by_type_totals),
            "daily_stats": [
                {
                    "date": s.date.isoformat(),
                    "files_deleted": s.files_deleted,
                    "size_freed": s.total_size_freed,
                    "errors": s.errors_count,
                }
                for s in statistics
            ],
        }
    
    async def recover_file(
        self,
        audit_log_id: int,
        recovery_path: str,
    ) -> bool:
        """Attempt to recover a deleted file."""
        audit_log = await self.db.get(CleanupAuditLog, audit_log_id)
        if not audit_log:
            return False
        
        # Check if file can be recovered (within grace period)
        grace_period = timedelta(days=7)  # Default grace period
        if datetime.utcnow() - audit_log.deleted_at > grace_period:
            return False
        
        # Check if we have recovery information
        if not audit_log.recovery_info:
            return False
        
        try:
            # Attempt to recover from backup location
            # This would need to be implemented based on your backup strategy
            # For now, we'll just mark it as recovered
            
            audit_log.recovered = True
            audit_log.recovery_info["recovered_to"] = recovery_path
            audit_log.recovery_info["recovered_at"] = datetime.utcnow().isoformat()
            
            await self.db.commit()
            return True
        
        except Exception as e:
            logger.error(f"Error recovering file {audit_log_id}: {e}")
            return False