"""
Audit service for administrative operations.

This service provides functionality for querying and managing audit logs.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.admin.schemas import AuditLogFilter


class AdminAuditService:
    """Service for managing administrative audit logs."""
    
    def __init__(self, db: AsyncSession):
        """
        Initialize audit service.
        
        Args:
            db: Database session
        """
        self.db = db
    
    async def list_audit_logs(
        self,
        page: int = 1,
        per_page: int = 50,
        filters: Optional[AuditLogFilter] = None
    ) -> Tuple[List[AdminAuditLog], int]:
        """
        List audit logs with pagination and filtering.
        
        Args:
            page: Page number (1-based)
            per_page: Items per page
            filters: Filter criteria
            
        Returns:
            Tuple of (logs, total_count)
        """
        # Build base query
        query = select(AdminAuditLog).options(
            selectinload(AdminAuditLog.admin)
        )
        count_query = select(func.count(AdminAuditLog.id))
        
        # Apply filters
        if filters:
            conditions = []
            
            if filters.admin_id:
                conditions.append(AdminAuditLog.admin_id == filters.admin_id)
            
            if filters.action:
                conditions.append(AdminAuditLog.action == filters.action)
            
            if filters.target_type:
                conditions.append(AdminAuditLog.target_type == filters.target_type)
            
            if filters.target_id:
                conditions.append(AdminAuditLog.target_id == filters.target_id)
            
            if filters.success is not None:
                conditions.append(AdminAuditLog.success == filters.success)
            
            if filters.start_date:
                conditions.append(AdminAuditLog.created_at >= filters.start_date)
            
            if filters.end_date:
                conditions.append(AdminAuditLog.created_at <= filters.end_date)
            
            if conditions:
                where_clause = and_(*conditions)
                query = query.where(where_clause)
                count_query = count_query.where(where_clause)
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total_count = total_result.scalar_one()
        
        # Apply sorting (newest first)
        query = query.order_by(desc(AdminAuditLog.created_at))
        
        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)
        
        # Execute query
        result = await self.db.execute(query)
        logs = result.scalars().all()
        
        return logs, total_count
    
    async def get_audit_log_detail(
        self,
        log_id: UUID
    ) -> Optional[AdminAuditLog]:
        """
        Get detailed audit log entry.
        
        Args:
            log_id: Audit log ID
            
        Returns:
            Audit log entry or None
        """
        result = await self.db.execute(
            select(AdminAuditLog)
            .options(selectinload(AdminAuditLog.admin))
            .where(AdminAuditLog.id == log_id)
        )
        
        return result.scalar_one_or_none()
    
    async def get_user_audit_trail(
        self,
        user_id: UUID,
        limit: int = 100
    ) -> List[AdminAuditLog]:
        """
        Get audit trail for a specific user.
        
        Args:
            user_id: User ID
            limit: Maximum entries to return
            
        Returns:
            List of audit log entries
        """
        result = await self.db.execute(
            select(AdminAuditLog)
            .options(selectinload(AdminAuditLog.admin))
            .where(
                and_(
                    AdminAuditLog.target_type == "user",
                    AdminAuditLog.target_id == user_id
                )
            )
            .order_by(desc(AdminAuditLog.created_at))
            .limit(limit)
        )
        
        return result.scalars().all()
    
    async def get_admin_activity(
        self,
        admin_id: UUID,
        limit: int = 100
    ) -> List[AdminAuditLog]:
        """
        Get recent activity by a specific admin.
        
        Args:
            admin_id: Admin user ID
            limit: Maximum entries to return
            
        Returns:
            List of audit log entries
        """
        result = await self.db.execute(
            select(AdminAuditLog)
            .where(AdminAuditLog.admin_id == admin_id)
            .order_by(desc(AdminAuditLog.created_at))
            .limit(limit)
        )
        
        return result.scalars().all()
    
    async def get_failed_actions(
        self,
        limit: int = 50
    ) -> List[AdminAuditLog]:
        """
        Get recent failed administrative actions.
        
        Args:
            limit: Maximum entries to return
            
        Returns:
            List of failed audit log entries
        """
        result = await self.db.execute(
            select(AdminAuditLog)
            .options(selectinload(AdminAuditLog.admin))
            .where(AdminAuditLog.success == False)
            .order_by(desc(AdminAuditLog.created_at))
            .limit(limit)
        )
        
        return result.scalars().all()
    
    async def export_audit_logs(
        self,
        filters: Optional[AuditLogFilter] = None,
        format: str = "json"
    ) -> Dict[str, Any]:
        """
        Export audit logs for compliance/reporting.
        
        Args:
            filters: Filter criteria
            format: Export format (json, csv)
            
        Returns:
            Exported data
        """
        # Get all matching logs
        logs, total = await self.list_audit_logs(
            page=1,
            per_page=10000,  # Get all
            filters=filters
        )
        
        # Format data
        export_data = []
        for log in logs:
            entry = {
                "id": str(log.id),
                "timestamp": log.created_at.isoformat(),
                "admin_id": str(log.admin_id),
                "admin_email": log.admin.email if log.admin else "Unknown",
                "action": log.action.value,
                "target_type": log.target_type,
                "target_id": str(log.target_id) if log.target_id else None,
                "success": log.success,
                "error_message": log.error_message,
                "ip_address": log.ip_address,
                "reason": log.reason
            }
            
            # Add changes if present
            if log.changes:
                entry["changes"] = log.changes
            
            export_data.append(entry)
        
        return {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "total_entries": len(export_data),
            "filters_applied": filters.model_dump() if filters else None,
            "data": export_data
        }
    
    async def get_statistics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get audit log statistics.
        
        Args:
            start_date: Start date for statistics
            end_date: End date for statistics
            
        Returns:
            Statistics dictionary
        """
        conditions = []
        if start_date:
            conditions.append(AdminAuditLog.created_at >= start_date)
        if end_date:
            conditions.append(AdminAuditLog.created_at <= end_date)
        
        where_clause = and_(*conditions) if conditions else None
        
        # Total actions
        query = select(func.count(AdminAuditLog.id))
        if where_clause is not None:
            query = query.where(where_clause)
        result = await self.db.execute(query)
        total_actions = result.scalar_one()
        
        # Actions by type
        query = select(
            AdminAuditLog.action,
            func.count(AdminAuditLog.id)
        ).group_by(AdminAuditLog.action)
        if where_clause is not None:
            query = query.where(where_clause)
        result = await self.db.execute(query)
        actions_by_type = {
            action.value: count
            for action, count in result
        }
        
        # Success rate
        query = select(
            AdminAuditLog.success,
            func.count(AdminAuditLog.id)
        ).group_by(AdminAuditLog.success)
        if where_clause is not None:
            query = query.where(where_clause)
        result = await self.db.execute(query)
        success_stats = dict(result)
        
        success_rate = (
            (success_stats.get(True, 0) / total_actions * 100)
            if total_actions > 0 else 0
        )
        
        # Most active admins
        query = select(
            AdminAuditLog.admin_id,
            func.count(AdminAuditLog.id)
        ).group_by(AdminAuditLog.admin_id).order_by(
            desc(func.count(AdminAuditLog.id))
        ).limit(5)
        if where_clause is not None:
            query = query.where(where_clause)
        result = await self.db.execute(query)
        
        # Get admin details
        most_active = []
        for admin_id, count in result:
            admin_result = await self.db.execute(
                select(AuthUser).where(AuthUser.id == admin_id)
            )
            admin = admin_result.scalar_one_or_none()
            if admin:
                most_active.append({
                    "admin_id": str(admin_id),
                    "email": admin.email,
                    "action_count": count
                })
        
        return {
            "total_actions": total_actions,
            "actions_by_type": actions_by_type,
            "success_rate": round(success_rate, 2),
            "failed_actions": success_stats.get(False, 0),
            "most_active_admins": most_active,
            "date_range": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            }
        }