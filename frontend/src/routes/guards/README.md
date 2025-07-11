# Route Guards

This directory contains route protection components and utilities for implementing authentication and authorization in the application.

## Components

### ProtectedRoute

The main component for protecting routes that require authentication.

```tsx
import { ProtectedRoute } from '@/routes/guards';

// Basic usage
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>

// With email verification requirement
<ProtectedRoute requireEmailVerification>
  <ProfilePage />
</ProtectedRoute>

// Custom redirect and loader
<ProtectedRoute 
  redirectTo="/login" 
  loader={CustomLoader}
  rememberLocation={true}
>
  <SecurePage />
</ProtectedRoute>
```

### RoleGuard

Component for role-based access control.

```tsx
import { RoleGuard, UserRole } from '@/routes/guards';

// Single role requirement
<RoleGuard roles={UserRole.ADMIN}>
  <AdminPanel />
</RoleGuard>

// Multiple roles (OR logic by default)
<RoleGuard roles={[UserRole.ADMIN, UserRole.OWNER]}>
  <ManagementPage />
</RoleGuard>

// Require all roles (AND logic)
<RoleGuard roles={[UserRole.ADMIN, UserRole.OWNER]} requireAll>
  <SuperAdminPage />
</RoleGuard>

// Custom fallback component
<RoleGuard 
  roles={UserRole.ADMIN} 
  fallback={CustomForbiddenPage}
  adminOverride={false}
>
  <RestrictedContent />
</RoleGuard>
```

### GuestRoute

Component for routes that should only be accessible to non-authenticated users.

```tsx
import { GuestRoute } from '@/routes/guards';

// Login page - redirects to dashboard if already authenticated
<GuestRoute>
  <LoginPage />
</GuestRoute>

// Custom redirect destination
<GuestRoute redirectTo="/home">
  <RegisterPage />
</GuestRoute>
```

### RouteGuard

Generic guard wrapper for custom guard logic.

```tsx
import { RouteGuard } from '@/routes/guards';

// Custom guard function
const customGuard = async (context) => {
  // Your custom logic here
  return context.user?.subscription === 'premium';
};

<RouteGuard 
  guard={customGuard}
  redirectTo="/upgrade"
  cache={true}
  cacheKey="premium-check"
>
  <PremiumContent />
</RouteGuard>

// With error handling
<RouteGuard 
  guard={complexAsyncGuard}
  onError={(error, context) => console.error('Guard failed:', error)}
  fallback={ErrorComponent}
>
  <ProtectedContent />
</RouteGuard>
```

## Guard Functions

### Basic Guards

```tsx
import { 
  isAuthenticated, 
  isEmailVerified, 
  isAdmin,
  hasRole,
  hasAnyRole 
} from '@/routes/guards';

// Check authentication
if (isAuthenticated(user)) {
  // User is logged in
}

// Check email verification
if (isEmailVerified(user)) {
  // User's email is verified
}

// Check admin role
if (isAdmin(user)) {
  // User is an admin
}

// Check specific role
if (hasRole(user.role, UserRole.OWNER)) {
  // User is an owner
}

// Check multiple roles
if (hasAnyRole(user.role, [UserRole.ADMIN, UserRole.OWNER])) {
  // User has at least one of the roles
}
```

### Resource Guards

```tsx
import { 
  canEditResource, 
  canDeleteResource, 
  canViewPrivateContent 
} from '@/routes/guards';

// Check edit permissions
if (canEditResource(user, resourceOwnerId, true)) {
  // User can edit (owner or admin)
}

// Check delete permissions
if (canDeleteResource(user, resourceOwnerId, false)) {
  // User can delete (owner only, no admin override)
}

// Check view permissions
if (canViewPrivateContent(user, contentOwnerId, isPublic)) {
  // User can view the content
}
```

### Guard Factories

```tsx
import { createGuard, createOrGuard } from '@/routes/guards';

// Create AND guard (all conditions must pass)
const premiumAdminGuard = createGuard([
  (context) => isAdmin(context.user),
  (context) => context.user?.subscription === 'premium',
  async (context) => {
    const result = await checkSomeAsyncCondition(context);
    return result;
  }
]);

// Create OR guard (any condition must pass)
const ownerOrAdminGuard = createOrGuard([
  (context) => isAdmin(context.user),
  (context) => context.params.userId === context.user?.id
]);
```

## Hooks

### usePermissions

```tsx
import { usePermissions } from '@/routes/guards';

function MyComponent() {
  const { 
    isAuthenticated, 
    isAdmin, 
    checkRole, 
    canEdit, 
    canDelete 
  } = usePermissions();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <div>
      {isAdmin && <AdminControls />}
      {canEdit(resourceId) && <EditButton />}
      {canDelete(resourceId) && <DeleteButton />}
    </div>
  );
}
```

### useRedirectAfterLogin

```tsx
import { useRedirectAfterLogin } from '@/routes/guards';

function LoginPage() {
  const { redirectToIntended } = useRedirectAfterLogin();

  const handleLogin = async () => {
    await login(credentials);
    redirectToIntended(); // Redirects to saved location or dashboard
  };

  return <LoginForm onSubmit={handleLogin} />;
}
```

### useRouteGuard

```tsx
import { useRouteGuard } from '@/routes/guards';

function ConditionalContent() {
  const { isAllowed, isChecking, error } = useRouteGuard(
    async (context) => {
      // Custom guard logic
      return await checkUserPermission(context.user);
    }
  );

  if (isChecking) return <Loading />;
  if (error) return <Error message={error.message} />;
  if (!isAllowed) return <AccessDenied />;

  return <ProtectedContent />;
}
```

### useProtectedAction

```tsx
import { useProtectedAction } from '@/routes/guards';

function ActionButton() {
  const { executeProtected } = useProtectedAction();

  const handleClick = () => {
    executeProtected(
      async () => {
        // This action requires authentication
        await performProtectedAction();
      },
      {
        requireAuth: true,
        redirectTo: '/login',
        saveLocation: true
      }
    );
  };

  return <button onClick={handleClick}>Perform Action</button>;
}
```

## Route Configuration Examples

### In Route Config

```tsx
import { ProtectedRoute, RoleGuard, UserRole } from '@/routes/guards';

const routes = [
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'profile',
        element: (
          <ProtectedRoute requireEmailVerification>
            <ProfilePage />
          </ProtectedRoute>
        )
      },
      {
        path: 'admin',
        element: (
          <RoleGuard roles={UserRole.ADMIN}>
            <AdminPanel />
          </RoleGuard>
        )
      }
    ]
  },
  {
    path: '/auth',
    children: [
      {
        path: 'login',
        element: (
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        )
      }
    ]
  }
];
```

### Nested Guards

```tsx
// Multiple layers of protection
<ProtectedRoute>
  <RoleGuard roles={UserRole.ADMIN}>
    <RouteGuard guard={customBusinessLogicGuard}>
      <SuperSecretPage />
    </RouteGuard>
  </RoleGuard>
</ProtectedRoute>
```

## Best Practices

1. **Use the most specific guard** - Don't use `RouteGuard` for simple auth checks
2. **Cache expensive guards** - Use caching for guards that make API calls
3. **Handle loading states** - Always show appropriate loading UI
4. **Provide meaningful error messages** - Help users understand why access was denied
5. **Remember user intent** - Save intended destinations for post-login redirects
6. **Test guard logic** - Write unit tests for custom guard functions
7. **Use TypeScript** - Leverage types for better guard development experience

## Common Patterns

### Progressive Enhancement

```tsx
// Start with basic auth, add more requirements as needed
<ProtectedRoute>
  <RoleGuard roles={UserRole.PARTICIPANT}>
    <RouteGuard guard={hasActiveSubscription}>
      <PremiumFeature />
    </RouteGuard>
  </RoleGuard>
</ProtectedRoute>
```

### Conditional Rendering

```tsx
function PageWithConditionalContent() {
  const { canEdit, canDelete } = usePermissions();
  
  return (
    <div>
      <ViewContent />
      {canEdit(resourceId) && <EditSection />}
      {canDelete(resourceId) && <DeleteButton />}
    </div>
  );
}
```

### Dynamic Guards

```tsx
// Guard based on route params
const ownerGuard = (context: RouteGuardContext) => {
  const { userId } = context.params;
  return context.user?.id === userId;
};

<RouteGuard guard={ownerGuard}>
  <UserSettings />
</RouteGuard>
```