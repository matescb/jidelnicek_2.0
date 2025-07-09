"""
Audit service for tracking system events.

This service provides functionality for logging audit events
related to security, moderation, and administrative actions.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
import json
import logging

from jidelnicek.core.database import Base
from sqlalchemy import Column, String, Text, Integer, DateTime, JSON
from sqlalchemy.sql import func


logger = logging.getLogger(__name__)


class AuditLog(Base):
    """Model for audit log entries."""
    
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    event_data = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)


class AuditService:
    """Service for audit logging operations."""
    
    def __init__(self, db: Session):
        self.db = db
        
    def log_event(
        self,
        event_type: str,
        user_id: int,
        event_data: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """
        Log an audit event.
        
        Args:
            event_type: Type of event (e.g., 'content_reported', 'user_login')
            user_id: ID of the user performing the action
            event_data: Additional data about the event
            ip_address: IP address of the request
            user_agent: User agent string
            
        Returns:
            Created audit log entry
        """
        try:
            audit_log = AuditLog(
                event_type=event_type,
                user_id=user_id,
                event_data=event_data,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self.db.add(audit_log)
            self.db.commit()
            
            logger.info(
                f"Audit event logged: {event_type} by user {user_id}",
                extra={"event_data": event_data}
            )
            
            return audit_log
            
        except Exception as e:
            logger.error(f"Failed to log audit event: {e}")
            self.db.rollback()
            # Don't raise - audit logging should not break the main flow
            return None
    
    def get_user_events(
        self,
        user_id: int,
        event_type: Optional[str] = None,
        limit: int = 100
    ):
        """Get audit events for a specific user."""
        query = self.db.query(AuditLog).filter(
            AuditLog.user_id == user_id
        )
        
        if event_type:
            query = query.filter(AuditLog.event_type == event_type)
        
        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    
    def get_events_by_type(
        self,
        event_type: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000
    ):
        """Get audit events by type within a date range."""
        query = self.db.query(AuditLog).filter(
            AuditLog.event_type == event_type
        )
        
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()