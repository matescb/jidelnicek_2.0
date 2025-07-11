# Migration Guide: Route Guards

This guide helps you migrate from the old auth components to the new route guard system.

## Quick Migration

### 1. Update Imports

**Before:**
```tsx
import { ProtectedRoute } from '@components/auth/ProtectedRoute';
import { PublicRoute } from '@components/auth/PublicRoute';
import { PermissionGate } from '@components/auth/PermissionGate';
```

**After:**
```tsx
import { ProtectedRoute, GuestRoute, RoleGuard } from '@/routes/guards';
```

### 2. Update Protected Routes

**Before:**
```tsx
<ProtectedRoute 
  requireEmailVerification={true}
  requiredRole="admin"
>
  <AdminPage />
</ProtectedRoute>
```

**After:**
```tsx
<ProtectedRoute requireEmailVerification>
  <RoleGuard roles={UserRole.ADMIN}>
    <AdminPage />
  </RoleGuard>
</ProtectedRoute>
```

### 3. Update Public/Guest Routes

**Before:**
```tsx
<PublicRoute>
  <LoginPage />
</PublicRoute>
```

**After:**
```tsx
<GuestRoute>
  <LoginPage />
</GuestRoute>
```

### 4. Update Permission Gates

**Before:**
```tsx
<PermissionGate permissions={['admin', 'owner']}>
  <EditButton />
</PermissionGate>
```

**After:**
```tsx
import { usePermissions } from '@/routes/guards';

function Component() {
  const { checkAnyRole } = usePermissions();
  
  return (
    <>
      {checkAnyRole([UserRole.ADMIN, UserRole.OWNER]) && <EditButton />}
    </>
  );
}
```

## Detailed Changes

### ProtectedRoute Changes

The new `ProtectedRoute` component has enhanced features:

- `showLoader` - Control loading state visibility
- `loader` - Custom loading component
- `redirectTo` - Custom redirect path
- `rememberLocation` - Auto-save intended destination

### New RoleGuard Component

Separate role checking from authentication:

```tsx
// Old way - mixed concerns
<ProtectedRoute requiredRole="admin">

// New way - separated concerns
<ProtectedRoute>
  <RoleGuard roles={UserRole.ADMIN}>
```

Benefits:
- Better composition
- More flexible role checking
- Custom fallback components
- Admin override control

### New Hooks

Replace imperative checks with hooks:

```tsx
// Old way
const isAdmin = user?.role === 'admin';
const canEdit = user?.id === resourceOwnerId || user?.role === 'admin';

// New way
const { isAdmin, canEdit } = usePermissions();
```

### Custom Guards

Create complex permission logic:

```tsx
// Define custom guard
const customGuard = async (context) => {
  // Complex async logic
  const hasPermission = await checkPermission(context.user);
  return hasPermission;
};

// Use in routes
<RouteGuard guard={customGuard}>
  <ProtectedContent />
</RouteGuard>
```

## Common Patterns

### 1. Admin-Only Routes

**Before:**
```tsx
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
```

**After:**
```tsx
<ProtectedRoute>
  <RoleGuard roles={UserRole.ADMIN}>
    <AdminPanel />
  </RoleGuard>
</ProtectedRoute>
```

### 2. Owner or Admin Access

**Before:**
```tsx
{(user?.id === resourceOwnerId || user?.role === 'admin') && <EditButton />}
```

**After:**
```tsx
const { canEdit } = usePermissions();
{canEdit(resourceOwnerId) && <EditButton />}
```

### 3. Email Verification Required

**Before:**
```tsx
<ProtectedRoute requireEmailVerification={true}>
  <ProfilePage />
</ProtectedRoute>
```

**After:**
```tsx
<ProtectedRoute requireEmailVerification>
  <ProfilePage />
</ProtectedRoute>
```

### 4. Guest-Only Routes

**Before:**
```tsx
{!isAuthenticated && <LoginPage />}
```

**After:**
```tsx
<GuestRoute>
  <LoginPage />
</GuestRoute>
```

## Route Configuration

Update your route configuration:

```tsx
// Before
const routes = [
  {
    path: '/admin',
    element: <ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>
  }
];

// After
const routes = [
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <RoleGuard roles={UserRole.ADMIN}>
          <AdminPanel />
        </RoleGuard>
      </ProtectedRoute>
    )
  }
];
```

## Testing Updates

Update your tests to use the new guards:

```tsx
// Before
render(
  <ProtectedRoute requiredRole="admin">
    <TestComponent />
  </ProtectedRoute>
);

// After
render(
  <ProtectedRoute>
    <RoleGuard roles={UserRole.ADMIN}>
      <TestComponent />
    </RoleGuard>
  </ProtectedRoute>
);
```

## Benefits of Migration

1. **Better Separation of Concerns** - Auth and role checks are separate
2. **More Flexible** - Compose guards for complex scenarios
3. **Better TypeScript Support** - Strongly typed roles and contexts
4. **Enhanced Features** - Caching, error handling, custom guards
5. **Improved Testing** - Easier to test individual guards

## Gradual Migration

You can migrate gradually:

1. Start with new routes using new guards
2. Update existing routes one by one
3. Keep old components until fully migrated
4. Remove old components when done

## Need Help?

- Check `examples.tsx` for usage examples
- Read the main README for detailed documentation
- Review the test files for testing patterns