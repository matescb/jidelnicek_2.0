"""
Export utilities for admin data.

This module provides functions for exporting user and audit data in various formats.
"""

from typing import List, Dict, Any, Optional, IO
from datetime import datetime
import csv
import json
from uuid import UUID

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog


def export_users_to_csv(
    users: List[AuthUser],
    output: IO[str],
    include_sensitive: bool = False
) -> None:
    """
    Export users to CSV format.
    
    Args:
        users: List of users to export
        output: Output stream
        include_sensitive: Include sensitive information
    """
    writer = csv.writer(output)
    
    # Define headers
    headers = [
        "ID", "Email", "Role", "Status", "Email Verified",
        "Created At", "Updated At", "Last Login",
        "Language", "Timezone", "Unit System", "Energy Unit",
        "Has PKU", "Recipe Count", "Trip Count"
    ]
    
    if include_sensitive:
        headers.extend([
            "Failed Login Attempts", "Locked Until"
        ])
    
    writer.writerow(headers)
    
    # Write user data
    for user in users:
        # Determine status
        if user.is_archived:
            status = "archived"
        elif not user.is_active:
            status = "suspended"
        elif not user.last_login:
            status = "inactive"
        else:
            status = "active"
        
        row = [
            str(user.id),
            user.email,
            user.role,
            status,
            "Yes" if user.email_verified else "No",
            user.created_at.isoformat() if user.created_at else "",
            user.updated_at.isoformat() if user.updated_at else "",
            user.last_login.isoformat() if user.last_login else "",
            user.language,
            user.timezone,
            user.unit_system,
            user.energy_unit,
            "Yes" if user.has_pku else "No",
            user.recipe_count,
            user.trip_count
        ]
        
        if include_sensitive:
            row.extend([
                user.failed_login_attempts,
                user.locked_until.isoformat() if user.locked_until else ""
            ])
        
        writer.writerow(row)


def export_users_to_json(
    users: List[AuthUser],
    include_sensitive: bool = False
) -> List[Dict[str, Any]]:
    """
    Export users to JSON format.
    
    Args:
        users: List of users to export
        include_sensitive: Include sensitive information
        
    Returns:
        List of user dictionaries
    """
    export_data = []
    
    for user in users:
        # Determine status
        if user.is_archived:
            status = "archived"
        elif not user.is_active:
            status = "suspended"
        elif not user.last_login:
            status = "inactive"
        else:
            status = "active"
        
        user_data = {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "status": status,
            "email_verified": user.email_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "preferences": {
                "language": user.language,
                "timezone": user.timezone,
                "unit_system": user.unit_system,
                "energy_unit": user.energy_unit,
                "has_pku": user.has_pku
            },
            "statistics": {
                "recipe_count": user.recipe_count,
                "trip_count": user.trip_count
            }
        }
        
        if include_sensitive:
            user_data["security"] = {
                "failed_login_attempts": user.failed_login_attempts,
                "locked_until": user.locked_until.isoformat() if user.locked_until else None
            }
        
        export_data.append(user_data)
    
    return export_data


def export_audit_logs(
    logs: List[AdminAuditLog],
    format: str = "json"
) -> Dict[str, Any]:
    """
    Export audit logs.
    
    Args:
        logs: List of audit logs
        format: Export format (json, csv)
        
    Returns:
        Exported data dictionary
    """
    export_data = {
        "export_date": datetime.utcnow().isoformat(),
        "total_entries": len(logs),
        "format": format,
        "data": []
    }
    
    for log in logs:
        entry = {
            "id": str(log.id),
            "timestamp": log.created_at.isoformat(),
            "admin_id": str(log.admin_id),
            "admin_email": log.admin.email if log.admin else "Unknown",
            "action": log.action.value if hasattr(log.action, 'value') else log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id) if log.target_id else None,
            "target_ids": log.target_ids,
            "success": log.success,
            "error_message": log.error_message,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "reason": log.reason
        }
        
        # Include changes if present
        if log.changes:
            entry["changes"] = log.changes
        
        # Include metadata if present
        if log.metadata:
            entry["metadata"] = log.metadata
        
        export_data["data"].append(entry)
    
    return export_data


def sanitize_export_data(
    data: Dict[str, Any],
    remove_fields: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Sanitize export data by removing sensitive fields.
    
    Args:
        data: Data to sanitize
        remove_fields: Fields to remove
        
    Returns:
        Sanitized data
    """
    if remove_fields is None:
        remove_fields = [
            "password_hash",
            "reset_token",
            "verification_token",
            "token_hash"
        ]
    
    def _sanitize_dict(d: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {}
        for key, value in d.items():
            if key not in remove_fields:
                if isinstance(value, dict):
                    sanitized[key] = _sanitize_dict(value)
                elif isinstance(value, list):
                    sanitized[key] = [
                        _sanitize_dict(item) if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    sanitized[key] = value
        return sanitized
    
    return _sanitize_dict(data)