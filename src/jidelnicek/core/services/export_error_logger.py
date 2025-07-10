"""Detailed error logging service for export operations."""

import logging
import json
import traceback
import uuid
import platform
import psutil
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from pathlib import Path
import asyncio
from collections import defaultdict, deque

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..dependencies import get_db
from ..models.monitoring import ErrorLog, ErrorPattern
from ..monitoring.metrics import MetricsCollector

logger = logging.getLogger(__name__)


class ExportErrorLogger:
    """Handles detailed error logging and pattern tracking."""
    
    def __init__(
        self,
        log_dir: Path,
        metrics_collector: MetricsCollector,
        max_memory_logs: int = 1000
    ):
        self.log_dir = log_dir
        self.metrics_collector = metrics_collector
        self.max_memory_logs = max_memory_logs
        
        # In-memory error tracking for pattern detection
        self.recent_errors = deque(maxlen=max_memory_logs)
        self.error_patterns = defaultdict(lambda: {"count": 0, "last_seen": None})
        
        # Ensure log directory exists
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup file handlers for different error levels
        self._setup_file_handlers()
    
    def _setup_file_handlers(self) -> None:
        """Setup rotating file handlers for error logs."""
        from logging.handlers import RotatingFileHandler
        
        # Critical errors log
        critical_handler = RotatingFileHandler(
            self.log_dir / "export_errors_critical.log",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        critical_handler.setLevel(logging.ERROR)
        critical_handler.setFormatter(
            logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
        )
        
        # All errors log (verbose)
        verbose_handler = RotatingFileHandler(
            self.log_dir / "export_errors_all.log",
            maxBytes=50 * 1024 * 1024,  # 50MB
            backupCount=10
        )
        verbose_handler.setLevel(logging.DEBUG)
        verbose_handler.setFormatter(
            logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s\n'
                'Context: %(context)s\n'
                'Traceback: %(exc_info)s\n'
                '---'
            )
        )
        
        # Add handlers to export logger
        export_logger = logging.getLogger("jidelnicek.export")
        export_logger.addHandler(critical_handler)
        export_logger.addHandler(verbose_handler)
    
    async def log_export_error(
        self,
        error: Exception,
        context: Dict[str, Any],
        user_id: Optional[int] = None,
        session: Optional[AsyncSession] = None
    ) -> str:
        """Log export error with full context."""
        error_id = self._generate_error_id()
        
        error_data = {
            "error_id": error_id,
            "timestamp": datetime.utcnow().isoformat(),
            "error_type": type(error).__name__,
            "error_message": str(error),
            "user_id": user_id,
            "context": context,
            "traceback": traceback.format_exc(),
            "system_info": self._get_system_info()
        }
        
        # Add to in-memory tracking
        self.recent_errors.append(error_data)
        
        # Update pattern tracking
        pattern_key = self._get_pattern_key(error, context)
        self.error_patterns[pattern_key]["count"] += 1
        self.error_patterns[pattern_key]["last_seen"] = datetime.utcnow()
        
        # Log to file
        logger.error(
            f"Export error {error_id}: {error}",
            extra={"context": json.dumps(context)},
            exc_info=True  # Use exc_info as keyword argument, not in extra dict
        )
        
        # Save to database if session provided
        if session:
            await self._save_to_database(error_data, session)
        
        # Check for pattern alerts
        await self._check_error_patterns(pattern_key)
        
        # Track metrics
        self.metrics_collector.increment(
            "export_errors_logged",
            tags={
                "error_type": type(error).__name__,
                "export_format": context.get("export_format", "unknown")
            }
        )
        
        return error_id
    
    async def _save_to_database(
        self,
        error_data: Dict[str, Any],
        session: AsyncSession
    ) -> None:
        """Save error to database."""
        try:
            error_log = ErrorLog(
                error_id=error_data["error_id"],
                error_type=error_data["error_type"],
                error_message=error_data["error_message"],
                user_id=error_data["user_id"],
                context=error_data["context"],
                traceback=error_data["traceback"],
                system_info=error_data["system_info"]
            )
            session.add(error_log)
            await session.commit()
        except Exception as e:
            logger.error(f"Failed to save error to database: {e}")
    
    def _generate_error_id(self) -> str:
        """Generate unique error ID."""
        return f"EXP-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information for debugging."""
        return {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage('/').percent
        }
    
    def _get_pattern_key(self, error: Exception, context: Dict[str, Any]) -> str:
        """Generate pattern key for error grouping."""
        return f"{type(error).__name__}:{context.get('export_format', 'unknown')}"
    
    async def _check_error_patterns(self, pattern_key: str) -> None:
        """Check if error pattern requires alert."""
        pattern = self.error_patterns[pattern_key]
        
        # Alert thresholds
        if pattern["count"] >= 10:
            # High frequency alert
            await self._send_pattern_alert(
                pattern_key,
                "High frequency error pattern detected",
                pattern
            )
        elif pattern["count"] >= 5:
            # Check if errors are happening in quick succession
            recent_errors = [
                e for e in self.recent_errors
                if f"{e['error_type']}:{e['context'].get('export_format', 'unknown')}" == pattern_key
            ]
            
            if len(recent_errors) >= 5:
                time_span = (
                    datetime.fromisoformat(recent_errors[-1]["timestamp"]) -
                    datetime.fromisoformat(recent_errors[-5]["timestamp"])
                )
                
                if time_span < timedelta(minutes=5):
                    await self._send_pattern_alert(
                        pattern_key,
                        "Rapid error pattern detected",
                        pattern
                    )
    
    async def _send_pattern_alert(
        self,
        pattern_key: str,
        alert_type: str,
        pattern_data: Dict[str, Any]
    ) -> None:
        """Send alert for error pattern."""
        logger.warning(
            f"{alert_type}: {pattern_key} - "
            f"Count: {pattern_data['count']}, "
            f"Last seen: {pattern_data['last_seen']}"
        )
        
        # TODO: Send actual notification
    
    async def get_error_details(self, error_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed error information by ID."""
        # Check recent errors first
        for error in self.recent_errors:
            if error["error_id"] == error_id:
                return error
        
        # Check database
        async with get_db() as session:
            result = await session.execute(
                select(ErrorLog).where(ErrorLog.error_id == error_id)
            )
            error_log = result.scalar_one_or_none()
            
            if error_log:
                return {
                    "error_id": error_log.error_id,
                    "timestamp": error_log.created_at.isoformat(),
                    "error_type": error_log.error_type,
                    "error_message": error_log.error_message,
                    "user_id": error_log.user_id,
                    "context": error_log.context,
                    "traceback": error_log.traceback,
                    "system_info": error_log.system_info
                }
        
        return None
    
    async def get_error_statistics(
        self,
        time_range: timedelta = timedelta(hours=24)
    ) -> Dict[str, Any]:
        """Get error statistics for monitoring."""
        cutoff_time = datetime.utcnow() - time_range
        
        async with get_db() as session:
            # Total errors
            total_result = await session.execute(
                select(func.count(ErrorLog.id)).where(
                    ErrorLog.created_at >= cutoff_time
                )
            )
            total_errors = total_result.scalar()
            
            # Errors by type
            type_result = await session.execute(
                select(
                    ErrorLog.error_type,
                    func.count(ErrorLog.id).label("count")
                )
                .where(ErrorLog.created_at >= cutoff_time)
                .group_by(ErrorLog.error_type)
            )
            errors_by_type = {
                row.error_type: row.count
                for row in type_result
            }
            
            # Error patterns from memory
            active_patterns = [
                {
                    "pattern": key,
                    "count": data["count"],
                    "last_seen": data["last_seen"].isoformat()
                    if data["last_seen"] else None
                }
                for key, data in self.error_patterns.items()
                if data["count"] > 0
            ]
            
            return {
                "time_range": str(time_range),
                "total_errors": total_errors,
                "errors_by_type": errors_by_type,
                "active_patterns": active_patterns,
                "recent_errors": len(self.recent_errors)
            }
    
    def clear_old_logs(self, days: int = 30) -> None:
        """Clear old log files."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        for log_file in self.log_dir.glob("*.log*"):
            if log_file.stat().st_mtime < cutoff_date.timestamp():
                try:
                    log_file.unlink()
                    logger.info(f"Deleted old log file: {log_file}")
                except Exception as e:
                    logger.error(f"Failed to delete log file {log_file}: {e}")


class ErrorContextEnricher:
    """Enriches error context with additional debugging information."""
    
    @staticmethod
    def enrich_context(
        context: Dict[str, Any],
        request: Optional[Any] = None,
        session: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        """Add additional context for debugging."""
        enriched = context.copy()
        
        # Add request context if available
        if request:
            enriched["request"] = {
                "method": getattr(request, "method", None),
                "url": str(getattr(request, "url", "")),
                "headers": dict(getattr(request, "headers", {})),
                "client": getattr(request, "client", {})
            }
        
        # Add session context if available
        if session:
            enriched["database"] = {
                "in_transaction": session.in_transaction(),
                "is_active": session.is_active
            }
        
        # Add timestamp
        enriched["timestamp"] = datetime.utcnow().isoformat()
        
        return enriched