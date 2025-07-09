"""
Tests for RBAC API endpoints.

Tests cover:
- Role CRUD operations via API
- Permission listing
- User role assignments
- Permission delegation endpoints
- Authorization checks
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models.rbac import Role, Permission
from jidelnicek.admin.services.rbac_service import RBACService


@pytest.fixture
async def super_admin_user(db_session: AsyncSession) -> AuthUser:
    """Create a super admin user."""
    user = AuthUser(
        email="superadmin@example.com",
        email_verified=True,
        is_active=True,
        role="admin"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    # Initialize RBAC and assign super admin role
    rbac_service = RBACService(db_session, None)
    await rbac_service.initialize_system_roles_and_permissions()
    
    super_admin_role = await rbac_service.get_role_by_code("super_admin")
    await rbac_service.assign_role(
        user_id=user.id,
        role_id=super_admin_role.id,
        assigned_by=user.id
    )
    
    await db_session.commit()
    return user


@pytest.fixture
async def admin_token(super_admin_user: AuthUser, async_client: AsyncClient) -> str:
    """Get auth token for super admin user."""
    # Set password for login
    from jidelnicek.auth.utils.password import hash_password
    super_admin_user.password_hash = hash_password("TestPassword123!")
    
    db_session = async_client.app.state.db
    db_session.add(super_admin_user)
    await db_session.commit()
    
    # Login to get token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": super_admin_user.email,
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
async def regular_user(db_session: AsyncSession) -> AuthUser:
    """Create a regular user."""
    user = AuthUser(
        email="regular@example.com",
        email_verified=True,
        is_active=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def regular_token(regular_user: AuthUser, async_client: AsyncClient) -> str:
    """Get auth token for regular user."""
    from jidelnicek.auth.utils.password import hash_password
    regular_user.password_hash = hash_password("TestPassword123!")
    
    db_session = async_client.app.state.db
    db_session.add(regular_user)
    await db_session.commit()
    
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": regular_user.email,
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    return response.json()["access_token"]


class TestPermissionEndpoints:
    """Test permission-related endpoints."""
    
    async def test_list_permissions(self, async_client: AsyncClient, admin_token: str):
        """Test listing all permissions."""
        response = await async_client.get(
            "/api/v1/admin/roles/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        permissions = response.json()
        assert isinstance(permissions, list)
        assert len(permissions) > 0
        
        # Check permission structure
        perm = permissions[0]
        assert "id" in perm
        assert "code" in perm
        assert "name" in perm
        assert "category" in perm
        assert "is_active" in perm
    
    async def test_list_permissions_by_category(self, async_client: AsyncClient, admin_token: str):
        """Test filtering permissions by category."""
        response = await async_client.get(
            "/api/v1/admin/roles/permissions?category=users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        permissions = response.json()
        assert all(p["category"] == "users" for p in permissions)
    
    async def test_permissions_require_auth(self, async_client: AsyncClient):
        """Test that permission endpoints require authentication."""
        response = await async_client.get("/api/v1/admin/roles/permissions")
        assert response.status_code == 401


class TestRoleEndpoints:
    """Test role management endpoints."""
    
    async def test_list_roles(self, async_client: AsyncClient, admin_token: str):
        """Test listing roles with pagination."""
        response = await async_client.get(
            "/api/v1/admin/roles/?skip=0&limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        
        # Check system roles exist
        role_codes = {r["code"] for r in data["items"]}
        assert "super_admin" in role_codes
        assert "admin" in role_codes
        assert "content_moderator" in role_codes
    
    async def test_get_role_hierarchy(self, async_client: AsyncClient, admin_token: str):
        """Test getting role hierarchy tree."""
        response = await async_client.get(
            "/api/v1/admin/roles/hierarchy",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        hierarchy = response.json()
        assert isinstance(hierarchy, list)
        
        # Find super admin in hierarchy
        super_admin = next((r for r in hierarchy if r["code"] == "super_admin"), None)
        assert super_admin is not None
        assert super_admin["priority"] == 1000
    
    async def test_get_role_by_id(self, async_client: AsyncClient, admin_token: str, db_session: AsyncSession):
        """Test getting a specific role."""
        # Get a role ID
        result = await db_session.execute(
            select(Role).where(Role.code == "content_moderator")
        )
        role = result.scalar_one()
        
        response = await async_client.get(
            f"/api/v1/admin/roles/{role.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(role.id)
        assert data["code"] == "content_moderator"
        assert len(data["permissions"]) > 0
    
    async def test_create_role(self, async_client: AsyncClient, admin_token: str):
        """Test creating a new role."""
        response = await async_client.post(
            "/api/v1/admin/roles/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": "test_role",
                "name": "Test Role",
                "description": "A test role",
                "permissions": ["users:read", "content:read"],
                "priority": 100,
                "max_users": 5
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "test_role"
        assert data["name"] == "Test Role"
        assert data["priority"] == 100
        assert data["max_users"] == 5
        assert len(data["permissions"]) == 2
    
    async def test_update_role(self, async_client: AsyncClient, admin_token: str, db_session: AsyncSession):
        """Test updating a role."""
        # Create a role to update
        response = await async_client.post(
            "/api/v1/admin/roles/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": "updatable_role",
                "name": "Updatable Role",
                "permissions": ["users:read"]
            }
        )
        role_id = response.json()["id"]
        
        # Update the role
        response = await async_client.put(
            f"/api/v1/admin/roles/{role_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "Updated Role Name",
                "permissions": ["users:read", "users:write"],
                "priority": 200,
                "is_active": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Role Name"
        assert data["priority"] == 200
        assert not data["is_active"]
        assert len(data["permissions"]) == 2
    
    async def test_delete_role(self, async_client: AsyncClient, admin_token: str):
        """Test deleting a role."""
        # Create a role to delete
        response = await async_client.post(
            "/api/v1/admin/roles/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": "deletable_role",
                "name": "Deletable Role"
            }
        )
        role_id = response.json()["id"]
        
        # Delete the role
        response = await async_client.delete(
            f"/api/v1/admin/roles/{role_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 204
        
        # Verify deletion
        response = await async_client.get(
            f"/api/v1/admin/roles/{role_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
    
    async def test_cannot_delete_system_role(self, async_client: AsyncClient, admin_token: str, db_session: AsyncSession):
        """Test that system roles cannot be deleted."""
        # Get super admin role
        result = await db_session.execute(
            select(Role).where(Role.code == "super_admin")
        )
        role = result.scalar_one()
        
        response = await async_client.delete(
            f"/api/v1/admin/roles/{role.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        assert "Cannot delete system role" in response.json()["detail"]


class TestRoleAssignmentEndpoints:
    """Test role assignment endpoints."""
    
    async def test_assign_role_to_user(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test assigning a role to a user."""
        # Get analyst role
        result = await db_session.execute(
            select(Role).where(Role.code == "analyst")
        )
        role = result.scalar_one()
        
        response = await async_client.post(
            "/api/v1/admin/roles/assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": str(regular_user.id),
                "role_id": str(role.id),
                "reason": "Test assignment"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == str(regular_user.id)
        assert data["role_id"] == str(role.id)
        assert data["reason"] == "Test assignment"
        assert data["is_valid"]
    
    async def test_assign_temporary_role(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test assigning a temporary role."""
        # Get support role
        result = await db_session.execute(
            select(Role).where(Role.code == "support")
        )
        role = result.scalar_one()
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        response = await async_client.post(
            "/api/v1/admin/roles/assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": str(regular_user.id),
                "role_id": str(role.id),
                "expires_at": expires_at.isoformat(),
                "reason": "Temporary support coverage"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["expires_at"] is not None
        assert not data["is_expired"]
    
    async def test_revoke_role(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test revoking a role from a user."""
        # First assign a role
        result = await db_session.execute(
            select(Role).where(Role.code == "analyst")
        )
        role = result.scalar_one()
        
        await async_client.post(
            "/api/v1/admin/roles/assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": str(regular_user.id),
                "role_id": str(role.id)
            }
        )
        
        # Now revoke it
        response = await async_client.post(
            "/api/v1/admin/roles/revoke",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": str(regular_user.id),
                "role_id": str(role.id),
                "reason": "No longer needed"
            }
        )
        
        assert response.status_code == 204
    
    async def test_get_user_roles(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test getting all roles for a user."""
        # Assign multiple roles
        rbac_service = RBACService(db_session, None)
        
        for role_code in ["support", "analyst"]:
            role = await rbac_service.get_role_by_code(role_code)
            await async_client.post(
                "/api/v1/admin/roles/assign",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "user_id": str(regular_user.id),
                    "role_id": str(role.id)
                }
            )
        
        # Get user roles
        response = await async_client.get(
            f"/api/v1/admin/roles/users/{regular_user.id}/roles",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        roles = response.json()
        assert len(roles) == 2
        role_codes = {r["code"] for r in roles}
        assert role_codes == {"support", "analyst"}
    
    async def test_get_user_permissions(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test getting all permissions for a user."""
        # Assign analyst role
        result = await db_session.execute(
            select(Role).where(Role.code == "analyst")
        )
        role = result.scalar_one()
        
        await async_client.post(
            "/api/v1/admin/roles/assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": str(regular_user.id),
                "role_id": str(role.id)
            }
        )
        
        # Get user permissions
        response = await async_client.get(
            f"/api/v1/admin/roles/users/{regular_user.id}/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        permissions = response.json()
        assert "analytics:read" in permissions
        assert "analytics:export" in permissions
        assert "users:read" in permissions


class TestPermissionDelegationEndpoints:
    """Test permission delegation endpoints."""
    
    async def test_delegate_permissions(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser
    ):
        """Test delegating permissions to another user."""
        expires_at = datetime.now(timezone.utc) + timedelta(days=1)
        
        response = await async_client.post(
            "/api/v1/admin/roles/delegate",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "delegate_id": str(regular_user.id),
                "permissions": ["users:read", "users:write"],
                "expires_at": expires_at.isoformat(),
                "reason": "Covering administrative tasks during vacation"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["delegate_id"] == str(regular_user.id)
        assert set(data["permissions"]) == {"users:read", "users:write"}
        assert data["is_active"]
    
    async def test_revoke_delegation(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser
    ):
        """Test revoking a permission delegation."""
        # First create a delegation
        expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
        
        response = await async_client.post(
            "/api/v1/admin/roles/delegate",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "delegate_id": str(regular_user.id),
                "permissions": ["analytics:read"],
                "expires_at": expires_at.isoformat(),
                "reason": "Temporary analytics access"
            }
        )
        delegation_id = response.json()["id"]
        
        # Revoke it
        response = await async_client.delete(
            f"/api/v1/admin/roles/delegations/{delegation_id}?reason=No longer needed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 204


class TestAuthorizationChecks:
    """Test authorization checks for RBAC endpoints."""
    
    async def test_regular_user_cannot_access_role_management(
        self,
        async_client: AsyncClient,
        regular_token: str
    ):
        """Test that regular users cannot access role management endpoints."""
        # Try to list roles
        response = await async_client.get(
            "/api/v1/admin/roles/",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code == 403
        
        # Try to create a role
        response = await async_client.post(
            "/api/v1/admin/roles/",
            headers={"Authorization": f"Bearer {regular_token}"},
            json={
                "code": "hacker_role",
                "name": "Hacker Role"
            }
        )
        assert response.status_code == 403
    
    async def test_role_based_endpoint_access(
        self,
        async_client: AsyncClient,
        admin_token: str,
        regular_user: AuthUser,
        regular_token: str,
        db_session: AsyncSession
    ):
        """Test that role-based permissions work for API endpoints."""
        # Give regular user content moderator role
        result = await db_session.execute(
            select(Role).where(Role.code == "content_moderator")
        )
        role = result.scalar_one()
        
        await async_client.post(
            "/api/v1/admin/roles/assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": str(regular_user.id),
                "role_id": str(role.id)
            }
        )
        
        # Now regular user should be able to access content-related endpoints
        # (would need actual content endpoints to test this properly)
        
        # But still cannot manage roles
        response = await async_client.post(
            "/api/v1/admin/roles/",
            headers={"Authorization": f"Bearer {regular_token}"},
            json={
                "code": "test_role",
                "name": "Test Role"
            }
        )
        assert response.status_code == 403