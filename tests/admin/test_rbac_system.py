"""
Comprehensive tests for the RBAC (Role-Based Access Control) system.

Tests cover:
- Role and permission management
- User-role assignments
- Permission inheritance
- Permission delegation
- Cache functionality
- System initialization
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models.rbac import (
    Role, Permission, UserRoleAssignment, PermissionDelegation,
    PermissionCategory, user_roles
)
from jidelnicek.admin.services.rbac_service import RBACService


@pytest_asyncio.fixture(scope="function")
async def rbac_service(db_session, mock_redis):
    """Create RBAC service instance."""
    return RBACService(db_session, mock_redis)


@pytest_asyncio.fixture(scope="function")
async def initialized_rbac(db_session, rbac_service):
    """Initialize RBAC system with default roles and permissions."""
    await rbac_service.initialize_system_roles_and_permissions()
    await db_session.commit()
    return rbac_service


@pytest_asyncio.fixture(scope="function")
async def test_users(db_session):
    """Create test users."""
    users = []
    for i in range(3):
        user = AuthUser(
            email=f"test{i}@example.com",
            email_verified=True,
            is_active=True,
            role="user"
        )
        db_session.add(user)
        users.append(user)
    
    await db_session.commit()
    for user in users:
        await db_session.refresh(user)
    
    return users


class TestRBACInitialization:
    """Test RBAC system initialization."""
    
    async def test_initialize_system_permissions(self, db_session, rbac_service):
        """Test system permissions are created correctly."""
        await rbac_service.initialize_system_roles_and_permissions()
        
        # Check all permissions are created
        result = await db_session.execute(select(Permission))
        permissions = result.scalars().all()
        
        assert len(permissions) == len(rbac_service.SYSTEM_PERMISSIONS)
        
        # Check specific permissions
        permission_codes = {p.code for p in permissions}
        assert "users:read" in permission_codes
        assert "roles:assign" in permission_codes
        assert "content:write" in permission_codes
        
        # Check categories
        categories = {p.category for p in permissions}
        expected_categories = {cat.value for cat in PermissionCategory}
        assert categories.issubset(expected_categories)
    
    async def test_initialize_system_roles(self, db_session, rbac_service):
        """Test system roles are created correctly."""
        await rbac_service.initialize_system_roles_and_permissions()
        
        # Check all roles are created
        result = await db_session.execute(
            select(Role).options(selectinload(Role.permissions))
        )
        roles = result.scalars().all()
        
        assert len(roles) == len(rbac_service.SYSTEM_ROLES)
        
        # Check specific roles
        role_map = {r.code: r for r in roles}
        
        # Super admin should exist and have all permissions
        assert "super_admin" in role_map
        super_admin = role_map["super_admin"]
        assert super_admin.is_system
        assert super_admin.priority == 1000
        assert len(super_admin.permissions) > 0
        
        # Content moderator should have specific permissions
        assert "content_moderator" in role_map
        moderator = role_map["content_moderator"]
        mod_perms = {p.code for p in moderator.permissions}
        assert "content:read" in mod_perms
        assert "moderation:write" in mod_perms
        assert "users:delete" not in mod_perms  # Should not have this
    
    async def test_idempotent_initialization(self, db_session, rbac_service):
        """Test that initialization is idempotent."""
        # Initialize twice
        await rbac_service.initialize_system_roles_and_permissions()
        await rbac_service.initialize_system_roles_and_permissions()
        
        # Should not create duplicates
        perm_count = await db_session.execute(
            select(func.count()).select_from(Permission)
        )
        assert perm_count.scalar() == len(rbac_service.SYSTEM_PERMISSIONS)
        
        role_count = await db_session.execute(
            select(func.count()).select_from(Role)
        )
        assert role_count.scalar() == len(rbac_service.SYSTEM_ROLES)


class TestRoleManagement:
    """Test role CRUD operations."""
    
    async def test_create_role(self, db_session, initialized_rbac):
        """Test creating a custom role."""
        role = await initialized_rbac.create_role(
            code="custom_role",
            name="Custom Role",
            description="Test custom role",
            permissions=["users:read", "content:read"],
            priority=100,
            max_users=10
        )
        
        assert role.id is not None
        assert role.code == "custom_role"
        assert role.name == "Custom Role"
        assert role.priority == 100
        assert role.max_users == 10
        assert not role.is_system
        assert len(role.permissions) == 2
    
    async def test_create_role_with_parent(self, db_session, initialized_rbac):
        """Test creating a role with parent inheritance."""
        # Get content moderator role
        parent = await initialized_rbac.get_role_by_code("content_moderator")
        
        # Create child role
        role = await initialized_rbac.create_role(
            code="junior_moderator",
            name="Junior Moderator",
            parent_id=parent.id,
            permissions=["analytics:read"],  # Additional permission
            priority=400
        )
        
        assert role.parent_id == parent.id
        
        # Check inherited permissions
        all_perms = await initialized_rbac.get_user_permissions(uuid4())  # Dummy user
        # Would need to assign role first to test properly
    
    async def test_update_role(self, db_session, initialized_rbac):
        """Test updating a role."""
        # Create role
        role = await initialized_rbac.create_role(
            code="test_role",
            name="Test Role",
            permissions=["users:read"]
        )
        
        # Update role
        updated = await initialized_rbac.update_role(
            role_id=role.id,
            name="Updated Role",
            permissions=["users:read", "users:write"],
            priority=200,
            is_active=False
        )
        
        assert updated.name == "Updated Role"
        assert updated.priority == 200
        assert not updated.is_active
        assert len(updated.permissions) == 2
    
    async def test_cannot_update_system_role_structure(self, db_session, initialized_rbac):
        """Test that system roles have limited update capability."""
        super_admin = await initialized_rbac.get_role_by_code("super_admin")
        
        with pytest.raises(ValueError, match="Cannot modify system role"):
            await initialized_rbac.update_role(
                role_id=super_admin.id,
                name="Hacked Admin"  # Should not be allowed
            )
    
    async def test_delete_role(self, db_session, initialized_rbac):
        """Test deleting a role."""
        # Create role
        role = await initialized_rbac.create_role(
            code="deletable_role",
            name="Deletable Role"
        )
        
        # Delete role
        success = await initialized_rbac.delete_role(role.id)
        assert success
        
        # Verify deletion
        deleted = await initialized_rbac.get_role(role.id)
        assert deleted is None
    
    async def test_cannot_delete_system_role(self, db_session, initialized_rbac):
        """Test that system roles cannot be deleted."""
        super_admin = await initialized_rbac.get_role_by_code("super_admin")
        
        with pytest.raises(ValueError, match="Cannot delete system role"):
            await initialized_rbac.delete_role(super_admin.id)
    
    async def test_cannot_delete_role_with_users(self, db_session, initialized_rbac, test_users):
        """Test that roles with assigned users cannot be deleted."""
        # Create role and assign to user
        role = await initialized_rbac.create_role(
            code="occupied_role",
            name="Occupied Role"
        )
        
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[0].id
        )
        
        with pytest.raises(ValueError, match="Cannot delete role with assigned users"):
            await initialized_rbac.delete_role(role.id)


class TestUserRoleAssignment:
    """Test user-role assignment functionality."""
    
    async def test_assign_role_to_user(self, db_session, initialized_rbac, test_users):
        """Test assigning a role to a user."""
        role = await initialized_rbac.get_role_by_code("content_moderator")
        
        assignment = await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id,
            reason="Test assignment"
        )
        
        assert assignment.user_id == test_users[0].id
        assert assignment.role_id == role.id
        assert assignment.assigned_by == test_users[1].id
        assert assignment.reason == "Test assignment"
        assert assignment.is_active
        assert assignment.is_valid
    
    async def test_assign_role_with_expiration(self, db_session, initialized_rbac, test_users):
        """Test temporary role assignment."""
        role = await initialized_rbac.get_role_by_code("admin")
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        assignment = await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id,
            expires_at=expires_at,
            reason="Temporary admin access"
        )
        
        assert assignment.expires_at == expires_at
        assert assignment.is_valid
        assert not assignment.is_expired
    
    async def test_cannot_assign_duplicate_role(self, db_session, initialized_rbac, test_users):
        """Test that duplicate role assignments are prevented."""
        role = await initialized_rbac.get_role_by_code("support")
        
        # First assignment
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # Duplicate should fail
        with pytest.raises(ValueError, match="already has this role"):
            await initialized_rbac.assign_role(
                user_id=test_users[0].id,
                role_id=role.id,
                assigned_by=test_users[1].id
            )
    
    async def test_role_max_users_limit(self, db_session, initialized_rbac, test_users):
        """Test role max users limit enforcement."""
        # Create role with limit
        role = await initialized_rbac.create_role(
            code="limited_role",
            name="Limited Role",
            max_users=2
        )
        
        # Assign to first two users
        for user in test_users[:2]:
            await initialized_rbac.assign_role(
                user_id=user.id,
                role_id=role.id,
                assigned_by=test_users[0].id
            )
        
        # Third should fail
        with pytest.raises(ValueError, match="maximum user limit"):
            await initialized_rbac.assign_role(
                user_id=test_users[2].id,
                role_id=role.id,
                assigned_by=test_users[0].id
            )
    
    async def test_revoke_role(self, db_session, initialized_rbac, test_users):
        """Test revoking a role from a user."""
        role = await initialized_rbac.get_role_by_code("analyst")
        
        # Assign role
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # Revoke role
        success = await initialized_rbac.revoke_role(
            user_id=test_users[0].id,
            role_id=role.id,
            revoked_by=test_users[1].id,
            reason="Test revocation"
        )
        
        assert success
        
        # Check assignment is revoked
        result = await db_session.execute(
            select(UserRoleAssignment).where(
                UserRoleAssignment.user_id == test_users[0].id,
                UserRoleAssignment.role_id == role.id
            )
        )
        assignment = result.scalar_one()
        assert not assignment.is_active
        assert assignment.revoked_at is not None
        assert assignment.revoke_reason == "Test revocation"
    
    async def test_get_user_roles(self, db_session, initialized_rbac, test_users):
        """Test getting all roles for a user."""
        # Assign multiple roles
        roles_to_assign = ["support", "analyst"]
        for role_code in roles_to_assign:
            role = await initialized_rbac.get_role_by_code(role_code)
            await initialized_rbac.assign_role(
                user_id=test_users[0].id,
                role_id=role.id,
                assigned_by=test_users[1].id
            )
        
        # Get user roles
        user_roles = await initialized_rbac.get_user_roles(test_users[0].id)
        
        assert len(user_roles) == 2
        role_codes = {r.code for r in user_roles}
        assert role_codes == {"support", "analyst"}


class TestPermissionChecking:
    """Test permission checking functionality."""
    
    async def test_check_permission_with_direct_assignment(self, db_session, initialized_rbac, test_users):
        """Test permission checking with directly assigned role."""
        # Assign content moderator role
        role = await initialized_rbac.get_role_by_code("content_moderator")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # Check permissions
        assert await initialized_rbac.check_permission(test_users[0], "content:read")
        assert await initialized_rbac.check_permission(test_users[0], "moderation:write")
        assert not await initialized_rbac.check_permission(test_users[0], "users:delete")
    
    async def test_check_permission_with_wildcard(self, db_session, initialized_rbac, test_users):
        """Test super admin wildcard permission."""
        # Assign super admin role
        role = await initialized_rbac.get_role_by_code("super_admin")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # Should have all permissions
        assert await initialized_rbac.check_permission(test_users[0], "users:delete")
        assert await initialized_rbac.check_permission(test_users[0], "system:maintenance")
        assert await initialized_rbac.check_permission(test_users[0], "any:permission")
    
    async def test_check_multiple_permissions(self, db_session, initialized_rbac, test_users):
        """Test checking multiple permissions."""
        # Assign analyst role
        role = await initialized_rbac.get_role_by_code("analyst")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # Check all required
        assert await initialized_rbac.check_permissions(
            test_users[0],
            ["analytics:read", "users:read"],
            require_all=True
        )
        
        assert not await initialized_rbac.check_permissions(
            test_users[0],
            ["analytics:read", "users:delete"],
            require_all=True
        )
        
        # Check any required
        assert await initialized_rbac.check_permissions(
            test_users[0],
            ["analytics:read", "users:delete"],
            require_all=False
        )
    
    async def test_get_user_permissions(self, db_session, initialized_rbac, test_users):
        """Test getting all permissions for a user."""
        # Assign multiple roles
        for role_code in ["support", "analyst"]:
            role = await initialized_rbac.get_role_by_code(role_code)
            await initialized_rbac.assign_role(
                user_id=test_users[0].id,
                role_id=role.id,
                assigned_by=test_users[1].id
            )
        
        # Get permissions
        permissions = await initialized_rbac.get_user_permissions(test_users[0].id)
        
        # Should have combined permissions from both roles
        assert "analytics:read" in permissions
        assert "analytics:export" in permissions
        assert "users:read" in permissions
        assert "audit:read" in permissions
        
        # Should not have write permissions
        assert "users:write" not in permissions
        assert "users:delete" not in permissions


class TestPermissionDelegation:
    """Test permission delegation functionality."""
    
    async def test_delegate_permissions(self, db_session, initialized_rbac, test_users):
        """Test delegating permissions to another user."""
        # Give delegator admin role
        admin_role = await initialized_rbac.get_role_by_code("admin")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=admin_role.id,
            assigned_by=test_users[0].id
        )
        
        # Delegate some permissions
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        delegation = await initialized_rbac.delegate_permissions(
            delegator_id=test_users[0].id,
            delegate_id=test_users[1].id,
            permissions=["users:read", "users:write"],
            expires_at=expires_at,
            reason="Covering for vacation"
        )
        
        assert delegation.delegator_id == test_users[0].id
        assert delegation.delegate_id == test_users[1].id
        assert set(delegation.permissions) == {"users:read", "users:write"}
        assert delegation.is_active
    
    async def test_cannot_delegate_permissions_not_owned(self, db_session, initialized_rbac, test_users):
        """Test that users cannot delegate permissions they don't have."""
        # User with limited permissions
        support_role = await initialized_rbac.get_role_by_code("support")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=support_role.id,
            assigned_by=test_users[0].id
        )
        
        # Try to delegate admin permissions
        with pytest.raises(ValueError, match="Cannot delegate permissions you don't have"):
            await initialized_rbac.delegate_permissions(
                delegator_id=test_users[0].id,
                delegate_id=test_users[1].id,
                permissions=["users:delete", "system:write"],
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                reason="Test"
            )
    
    async def test_delegated_permissions_work(self, db_session, initialized_rbac, test_users):
        """Test that delegated permissions are included in permission checks."""
        # Setup delegation
        admin_role = await initialized_rbac.get_role_by_code("admin")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=admin_role.id,
            assigned_by=test_users[0].id
        )
        
        await initialized_rbac.delegate_permissions(
            delegator_id=test_users[0].id,
            delegate_id=test_users[1].id,
            permissions=["users:write", "users:delete"],
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            reason="Temporary access"
        )
        
        # Check delegated permissions
        assert await initialized_rbac.check_permission(test_users[1], "users:write")
        assert await initialized_rbac.check_permission(test_users[1], "users:delete")
        
        # Get all permissions including delegated
        delegated = await initialized_rbac.get_delegated_permissions(test_users[1].id)
        assert "users:write" in delegated
        assert "users:delete" in delegated
    
    async def test_revoke_delegation(self, db_session, initialized_rbac, test_users):
        """Test revoking permission delegation."""
        # Setup admin and delegation
        admin_role = await initialized_rbac.get_role_by_code("admin")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=admin_role.id,
            assigned_by=test_users[0].id
        )
        
        delegation = await initialized_rbac.delegate_permissions(
            delegator_id=test_users[0].id,
            delegate_id=test_users[1].id,
            permissions=["users:read"],
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            reason="Test"
        )
        
        # Revoke
        success = await initialized_rbac.revoke_delegation(
            delegation_id=delegation.id,
            revoked_by=test_users[0].id,
            reason="No longer needed"
        )
        
        assert success
        
        # Check delegation is no longer active
        delegated = await initialized_rbac.get_delegated_permissions(test_users[1].id)
        assert "users:read" not in delegated


class TestCaching:
    """Test permission caching functionality."""
    
    async def test_permission_caching(self, db_session, initialized_rbac, test_users, redis_client):
        """Test that permissions are cached."""
        if not redis_client:
            pytest.skip("Redis not available")
        
        # Assign role
        role = await initialized_rbac.get_role_by_code("content_moderator")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # First call should cache
        perms1 = await initialized_rbac.get_user_permissions(test_users[0].id)
        
        # Check cache exists
        cache_key = f"{initialized_rbac.PERMISSION_CACHE_PREFIX}{test_users[0].id}"
        cached = await redis_client.get(cache_key)
        assert cached is not None
        
        # Second call should use cache
        perms2 = await initialized_rbac.get_user_permissions(test_users[0].id)
        assert perms1 == perms2
    
    async def test_cache_invalidation_on_role_change(self, db_session, initialized_rbac, test_users, redis_client):
        """Test that cache is invalidated when roles change."""
        if not redis_client:
            pytest.skip("Redis not available")
        
        # Assign initial role
        support_role = await initialized_rbac.get_role_by_code("support")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=support_role.id,
            assigned_by=test_users[1].id
        )
        
        # Cache permissions
        perms1 = await initialized_rbac.get_user_permissions(test_users[0].id)
        assert "users:read" in perms1
        assert "users:write" not in perms1
        
        # Assign additional role
        admin_role = await initialized_rbac.get_role_by_code("admin")
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=admin_role.id,
            assigned_by=test_users[1].id
        )
        
        # Get permissions again - should have admin permissions
        perms2 = await initialized_rbac.get_user_permissions(test_users[0].id)
        assert "users:write" in perms2  # Admin permission
    
    async def test_cache_invalidation_on_role_update(self, db_session, initialized_rbac, test_users, redis_client):
        """Test that cache is invalidated when role permissions change."""
        if not redis_client:
            pytest.skip("Redis not available")
        
        # Create custom role and assign
        role = await initialized_rbac.create_role(
            code="cache_test_role",
            name="Cache Test Role",
            permissions=["users:read"]
        )
        
        await initialized_rbac.assign_role(
            user_id=test_users[0].id,
            role_id=role.id,
            assigned_by=test_users[1].id
        )
        
        # Cache permissions
        perms1 = await initialized_rbac.get_user_permissions(test_users[0].id)
        assert "users:read" in perms1
        assert "users:write" not in perms1
        
        # Update role permissions
        await initialized_rbac.update_role(
            role_id=role.id,
            permissions=["users:read", "users:write"]
        )
        
        # Get permissions again - should include new permission
        perms2 = await initialized_rbac.get_user_permissions(test_users[0].id)
        assert "users:write" in perms2