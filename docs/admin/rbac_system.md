# Role-Based Access Control (RBAC) System

## Overview

The Jidelnicek 2.0 admin interface implements a comprehensive Role-Based Access Control (RBAC) system with granular permissions, role hierarchy, and permission delegation capabilities.

## Key Features

- **Granular Permissions**: Fine-grained control over specific actions
- **Role Hierarchy**: Roles can inherit permissions from parent roles
- **Permission Delegation**: Temporary permission sharing between users
- **Custom Roles**: Create custom roles beyond system defaults
- **Audit Trail**: All role assignments and changes are logged
- **Performance**: Redis caching for fast permission checks
- **Expiring Assignments**: Temporary role assignments with auto-expiration

## System Architecture

### Permission Model

Permissions follow the format: `category:action`

Examples:
- `users:read` - View user data
- `users:write` - Edit user data
- `users:delete` - Delete users
- `roles:assign` - Assign roles to users

### Permission Categories

- **users**: User management
- **roles**: Role and permission management
- **content**: Content moderation
- **recipes**: Recipe management
- **ingredients**: Ingredient management
- **moderation**: Content moderation actions
- **analytics**: Analytics and reporting
- **system**: System configuration
- **audit**: Audit log access
- **settings**: Application settings

### Predefined Roles

1. **Super Administrator** (`super_admin`)
   - Priority: 1000
   - Has wildcard permission (`*`) - full system access
   - Cannot be deleted or structurally modified

2. **Administrator** (`admin`)
   - Priority: 900
   - Inherits from Super Administrator
   - Administrative access with most permissions

3. **Content Moderator** (`content_moderator`)
   - Priority: 500
   - Can moderate user-generated content
   - Permissions: content operations, moderation, user viewing

4. **Support Staff** (`support`)
   - Priority: 400
   - Can view user data and help with issues
   - Read-only access to most resources

5. **Data Analyst** (`analyst`)
   - Priority: 300
   - Can view analytics and generate reports
   - Read access to users and content

## Usage

### Initialization

Initialize the RBAC system and create a super admin user:

```bash
python -m jidelnicek.admin.cli.rbac_init
```

### API Endpoints

#### Permission Management

- `GET /api/v1/admin/roles/permissions` - List all permissions
- `GET /api/v1/admin/roles/permissions?category={category}` - Filter by category

#### Role Management

- `GET /api/v1/admin/roles/` - List roles (paginated)
- `GET /api/v1/admin/roles/{role_id}` - Get specific role
- `POST /api/v1/admin/roles/` - Create new role
- `PUT /api/v1/admin/roles/{role_id}` - Update role
- `DELETE /api/v1/admin/roles/{role_id}` - Delete role
- `GET /api/v1/admin/roles/hierarchy` - Get role hierarchy tree

#### User Role Assignment

- `POST /api/v1/admin/roles/assign` - Assign role to user
- `POST /api/v1/admin/roles/revoke` - Revoke role from user
- `GET /api/v1/admin/roles/users/{user_id}/roles` - Get user's roles
- `GET /api/v1/admin/roles/users/{user_id}/permissions` - Get user's permissions

#### Permission Delegation

- `POST /api/v1/admin/roles/delegate` - Delegate permissions
- `DELETE /api/v1/admin/roles/delegations/{delegation_id}` - Revoke delegation

### Using Permissions in Code

#### Dependency Injection

```python
from fastapi import Depends
from jidelnicek.admin.dependencies.rbac import RequirePermissions

@router.get("/sensitive-data")
async def get_sensitive_data(
    user: AuthUser = Depends(RequirePermissions(["users:read", "audit:read"]))
):
    # User has all required permissions
    return {"data": "sensitive"}
```

#### Any Permission Check

```python
from jidelnicek.admin.dependencies.rbac import RequireAnyPermission

@router.get("/content")
async def get_content(
    user: AuthUser = Depends(RequireAnyPermission(["content:read", "moderation:read"]))
):
    # User has at least one of the permissions
    return {"content": "data"}
```

#### Manual Permission Check

```python
from jidelnicek.admin.services.rbac_service import RBACService

async def check_user_permission(user: AuthUser, permission: str) -> bool:
    rbac_service = RBACService(db, redis)
    return await rbac_service.check_permission(user, permission)
```

### Creating Custom Roles

```python
# Create a custom role with specific permissions
role = await rbac_service.create_role(
    code="report_manager",
    name="Report Manager",
    description="Can manage and generate reports",
    permissions=["analytics:read", "analytics:export", "users:read"],
    priority=350,
    max_users=5  # Limit to 5 users
)
```

### Role Assignment with Expiration

```python
# Assign temporary admin access
assignment = await rbac_service.assign_role(
    user_id=user.id,
    role_id=admin_role.id,
    assigned_by=current_user.id,
    expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    reason="Temporary coverage during vacation"
)
```

### Permission Delegation

```python
# Delegate specific permissions to another user
delegation = await rbac_service.delegate_permissions(
    delegator_id=current_user.id,
    delegate_id=other_user.id,
    permissions=["users:read", "users:write"],
    expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
    reason="Covering shift duties"
)
```

## Security Considerations

1. **Wildcard Permission**: Only super admins have the `*` permission
2. **System Roles**: Cannot be deleted, limited modification allowed
3. **Permission Validation**: Users can only delegate permissions they possess
4. **Audit Trail**: All role assignments and changes are logged
5. **Cache Invalidation**: Permission caches are invalidated on role changes
6. **Expiration Checks**: Expired assignments are automatically excluded

## Performance

- **Redis Caching**: User permissions cached for 1 hour
- **Batch Operations**: Efficient queries for permission checking
- **Indexed Queries**: Database indexes on frequently queried fields
- **Lazy Loading**: Permissions loaded only when needed

## Migration

When upgrading from the legacy role system:

1. Run the RBAC initialization to create system roles
2. Existing admin users automatically get appropriate permissions
3. The legacy `role` field is maintained for backward compatibility
4. New permission checks work alongside legacy checks

## Best Practices

1. **Least Privilege**: Assign minimum required permissions
2. **Use Role Hierarchy**: Create child roles for variations
3. **Temporary Assignments**: Use expiration for temporary access
4. **Audit Regularly**: Review role assignments periodically
5. **Document Custom Roles**: Maintain documentation for custom roles
6. **Test Permissions**: Always test permission configurations

## Troubleshooting

### User Cannot Access Resource

1. Check user's roles: `GET /api/v1/admin/roles/users/{user_id}/roles`
2. Check user's permissions: `GET /api/v1/admin/roles/users/{user_id}/permissions`
3. Verify role is active and not expired
4. Check for delegated permissions
5. Review audit logs for recent changes

### Cache Issues

If permissions seem incorrect:
1. Redis cache expires after 1 hour
2. Force cache invalidation by updating user's roles
3. Check Redis connectivity

### Performance Issues

1. Enable Redis caching for better performance
2. Review number of roles per user (minimize if possible)
3. Check for circular role hierarchies
4. Monitor database query performance