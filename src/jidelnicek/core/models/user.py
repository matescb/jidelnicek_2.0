"""
User model alias for core module.

This module provides a simple alias to the AuthUser model for use
in modules that need to reference users without importing the full auth module.
"""

from jidelnicek.auth.models import AuthUser

# Create alias for backward compatibility and simpler imports
User = AuthUser

# Add has_permission method for moderation system
def has_permission(self, permission: str) -> bool:
    """
    Check if user has a specific permission.
    
    Args:
        permission: Permission code to check (e.g., 'moderate_content')
        
    Returns:
        bool: True if user has the permission
    """
    # Check direct permissions through roles
    for role in self.admin_roles:
        for perm in role.all_permissions:
            if perm.code == permission:
                return True
    
    # Check for admin access (has all permissions)
    for role in self.admin_roles:
        if role.code in ['super_admin', 'admin']:
            return True
            
    return False

# Add method to User class
User.has_permission = has_permission

# Add reputation_score property if not present
if not hasattr(User, 'reputation_score'):
    User.reputation_score = 0

__all__ = ['User']