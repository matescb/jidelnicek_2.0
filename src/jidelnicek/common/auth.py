"""
Common authentication utilities.

This module provides authentication helpers that can be used
across different modules.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from jidelnicek.core.models.user import User
from jidelnicek.common.database import get_db


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from the request.
    
    This is a simplified version - in production, this would:
    1. Validate the JWT token
    2. Extract the user ID from the token
    3. Load the user from the database
    4. Check if the user is active
    
    Args:
        credentials: Bearer token from the request
        db: Database session
        
    Returns:
        Current authenticated user
        
    Raises:
        HTTPException: If authentication fails
    """
    # TODO: Implement actual JWT validation
    # For now, this is a placeholder
    
    # In a real implementation:
    # 1. Decode JWT token
    # 2. Get user_id from token
    # 3. Load user from database
    
    # Placeholder - would get from JWT
    user_id = 1
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


def require_permissions(*permissions: str):
    """
    Dependency to require specific permissions.
    
    Args:
        permissions: Permission codes required
        
    Returns:
        Dependency function that checks permissions
    """
    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        for permission in permissions:
            if not current_user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{permission}' required"
                )
        return current_user
    
    return permission_checker