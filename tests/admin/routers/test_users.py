"""
Tests for admin user management API endpoints.
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import patch, AsyncMock

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog, AdminAction


class TestAdminUsersRouter:
    """Test admin users API endpoints."""
    
    async def test_list_users_requires_admin(
        self,
        client: AsyncClient,
        regular_user_headers: dict
    ):
        """Test that listing users requires admin access."""
        response = await client.get(
            "/api/v1/admin/users/",
            headers=regular_user_headers
        )
        
        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]
    
    async def test_list_users_success(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test successful user listing."""
        response = await client.get(
            "/api/v1/admin/users/",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "pages" in data
        assert "stats" in data
        
        assert data["total"] >= len(multiple_users)
        assert len(data["users"]) <= data["per_page"]
    
    async def test_list_users_with_pagination(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test user listing with pagination."""
        # Get first page
        response = await client.get(
            "/api/v1/admin/users/",
            headers=admin_headers,
            params={"page": 1, "per_page": 5}
        )
        
        assert response.status_code == 200
        page1 = response.json()
        assert len(page1["users"]) == 5
        
        # Get second page
        response = await client.get(
            "/api/v1/admin/users/",
            headers=admin_headers,
            params={"page": 2, "per_page": 5}
        )
        
        assert response.status_code == 200
        page2 = response.json()
        
        # Ensure different users on different pages
        page1_ids = {u["id"] for u in page1["users"]}
        page2_ids = {u["id"] for u in page2["users"]}
        assert page1_ids.isdisjoint(page2_ids)
    
    async def test_list_users_with_filters(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test user listing with filters."""
        # Filter by email verification
        response = await client.get(
            "/api/v1/admin/users/",
            headers=admin_headers,
            params={"email_verified": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned users should be verified
        for user in data["users"]:
            assert user["email_verified"] is True
        
        # Filter by email search
        response = await client.get(
            "/api/v1/admin/users/",
            headers=admin_headers,
            params={"email": "user1"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert "user1" in data["users"][0]["email"]
    
    async def test_list_users_with_sorting(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test user listing with sorting."""
        response = await client.get(
            "/api/v1/admin/users/",
            headers=admin_headers,
            params={
                "sort_by": "recipe_count",
                "sort_order": "desc"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify descending order by recipe count
        recipe_counts = [u["recipe_count"] for u in data["users"]]
        assert recipe_counts == sorted(recipe_counts, reverse=True)
    
    async def test_search_users(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test user search."""
        response = await client.get(
            "/api/v1/admin/users/search",
            headers=admin_headers,
            params={"q": "user", "limit": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert len(data["results"]) <= 5
        
        for result in data["results"]:
            assert "user" in result["email"].lower()
    
    async def test_get_user_statistics(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test getting user statistics."""
        response = await client.get(
            "/api/v1/admin/users/statistics",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        stats = response.json()
        
        assert "total_users" in stats
        assert "active_users" in stats
        assert "verified_emails" in stats
        assert "admin_count" in stats
        assert "registrations_today" in stats
        
        assert stats["total_users"] >= len(multiple_users)
    
    async def test_get_user_detail(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test getting user details."""
        response = await client.get(
            f"/api/v1/admin/users/{regular_user.id}",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(regular_user.id)
        assert data["email"] == regular_user.email
        assert "session_count" in data
        assert "active_session_count" in data
        
        # Verify audit log created
        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action == AdminAction.USER_VIEW,
                AdminAuditLog.target_id == regular_user.id
            )
        )
        audit_log = result.scalar_one_or_none()
        assert audit_log is not None
    
    async def test_get_user_detail_not_found(
        self,
        client: AsyncClient,
        admin_headers: dict
    ):
        """Test getting details for non-existent user."""
        response = await client.get(
            f"/api/v1/admin/users/{uuid4()}",
            headers=admin_headers
        )
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]
    
    async def test_create_user(
        self,
        client: AsyncClient,
        admin_headers: dict,
        db_session: AsyncSession
    ):
        """Test creating a new user."""
        user_data = {
            "email": "newuser@test.com",
            "password": "NewUser123!",
            "role": "user",
            "email_verified": False,
            "send_welcome_email": False,
            "language": "en",
            "timezone": "UTC"
        }
        
        response = await client.post(
            "/api/v1/admin/users/",
            headers=admin_headers,
            json=user_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["email"] == user_data["email"]
        assert data["role"] == user_data["role"]
        assert "id" in data
        
        # Verify user was created
        from sqlalchemy import select
        result = await db_session.execute(
            select(AuthUser).where(AuthUser.email == user_data["email"])
        )
        created_user = result.scalar_one()
        assert created_user is not None
    
    async def test_create_user_duplicate_email(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser
    ):
        """Test creating user with duplicate email."""
        user_data = {
            "email": regular_user.email,
            "password": "Test123!",
            "role": "user"
        }
        
        response = await client.post(
            "/api/v1/admin/users/",
            headers=admin_headers,
            json=user_data
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    async def test_update_user(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test updating user information."""
        update_data = {
            "role": "admin",
            "language": "en",
            "reason": "Promotion to admin"
        }
        
        response = await client.patch(
            f"/api/v1/admin/users/{regular_user.id}",
            headers=admin_headers,
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["role"] == "admin"
        assert data["language"] == "en"
        
        # Verify user was updated
        await db_session.refresh(regular_user)
        assert regular_user.role == "admin"
        assert regular_user.language == "en"
    
    async def test_suspend_user(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test suspending a user."""
        response = await client.post(
            f"/api/v1/admin/users/{regular_user.id}/suspend",
            headers=admin_headers,
            params={
                "reason": "Test suspension",
                "notify_user": False
            }
        )
        
        assert response.status_code == 200
        
        # Verify user is suspended
        await db_session.refresh(regular_user)
        assert regular_user.is_active is False
    
    async def test_activate_user(
        self,
        client: AsyncClient,
        admin_headers: dict,
        inactive_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test activating a user."""
        response = await client.post(
            f"/api/v1/admin/users/{inactive_user.id}/activate",
            headers=admin_headers,
            params={
                "reason": "Test activation",
                "notify_user": False
            }
        )
        
        assert response.status_code == 200
        
        # Verify user is activated
        await db_session.refresh(inactive_user)
        assert inactive_user.is_active is True
    
    async def test_reset_user_password(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test resetting user password."""
        reset_data = {
            "user_id": str(regular_user.id),
            "generate_random": True,
            "send_email": False,
            "reason": "User request"
        }
        
        response = await client.post(
            f"/api/v1/admin/users/{regular_user.id}/reset-password",
            headers=admin_headers,
            json=reset_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "password" in data  # Should include generated password
        assert len(data["password"]) >= 12
    
    async def test_force_logout_user(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test force logout user."""
        logout_data = {
            "user_id": str(regular_user.id),
            "reason": "Security test",
            "logout_all_sessions": True
        }
        
        response = await client.post(
            f"/api/v1/admin/users/{regular_user.id}/force-logout",
            headers=admin_headers,
            json=logout_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sessions_invalidated" in data
    
    async def test_bulk_suspend_users(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser],
        db_session: AsyncSession
    ):
        """Test bulk user suspension."""
        user_ids = [str(u.id) for u in multiple_users[:3]]
        
        bulk_data = {
            "user_ids": user_ids,
            "operation": "suspend",
            "reason": "Bulk test",
            "send_notification": False
        }
        
        response = await client.post(
            "/api/v1/admin/users/bulk",
            headers=admin_headers,
            json=bulk_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 3
        assert data["successful"] == 3
        assert data["failed"] == 0
        
        # Verify users are suspended
        for user in multiple_users[:3]:
            await db_session.refresh(user)
            assert user.is_active is False
    
    async def test_export_users_csv(
        self,
        client: AsyncClient,
        admin_headers: dict,
        multiple_users: list[AuthUser]
    ):
        """Test exporting users to CSV."""
        response = await client.get(
            "/api/v1/admin/users/export/csv",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers["content-disposition"]
        
        # Verify CSV content
        content = response.text
        lines = content.strip().split("\n")
        assert len(lines) > 1  # Header + data
        assert "Email" in lines[0]
        assert "Role" in lines[0]
    
    async def test_list_audit_logs(
        self,
        client: AsyncClient,
        admin_headers: dict,
        audit_logs: list[AdminAuditLog]
    ):
        """Test listing audit logs."""
        response = await client.get(
            "/api/v1/admin/users/audit/logs",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "entries" in data
        assert "total" in data
        assert data["total"] >= len(audit_logs)
        
        # Verify log structure
        if data["entries"]:
            log = data["entries"][0]
            assert "id" in log
            assert "admin_email" in log
            assert "action" in log
            assert "created_at" in log
    
    async def test_get_user_audit_trail(
        self,
        client: AsyncClient,
        admin_headers: dict,
        regular_user: AuthUser,
        audit_logs: list[AdminAuditLog]
    ):
        """Test getting user audit trail."""
        response = await client.get(
            f"/api/v1/admin/users/{regular_user.id}/audit-trail",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # All entries should be for this user
        for entry in data:
            assert entry["target_id"] == str(regular_user.id)