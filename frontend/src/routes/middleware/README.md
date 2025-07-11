# Navigation Middleware System

A comprehensive middleware system for React Router v6 that provides navigation guards, logging, and route protection.

## Setup

Wrap your app with the `NavigationMiddlewareProvider`:

```tsx
import { BrowserRouter } from 'react-router-dom';
import { NavigationMiddlewareProvider } from './routes/middleware';

function App() {
  return (
    <BrowserRouter>
      <NavigationMiddlewareProvider
        globalMiddleware={[
          // Add global middleware here
        ]}
      >
        <Routes>
          {/* Your routes */}
        </Routes>
      </NavigationMiddlewareProvider>
    </BrowserRouter>
  );
}
```

## Basic Usage Examples

### 1. Authentication Middleware

```tsx
import { createAuthMiddleware } from './routes/middleware';

const authMiddleware = createAuthMiddleware(
  () => !!localStorage.getItem('authToken'),
  '/login'
);

// In your app setup
<NavigationMiddlewareProvider
  globalMiddleware={[authMiddleware]}
>
  {/* Your app */}
</NavigationMiddlewareProvider>
```

### 2. Permission-Based Route Protection

```tsx
import { createPermissionMiddleware } from './routes/middleware';

const permissionMiddleware = createPermissionMiddleware(
  () => getCurrentUserPermissions(),
  {
    '/admin.*': ['admin'],
    '/recipes/edit.*': ['editor', 'admin'],
    '/trips/create': ['trip_manager', 'admin'],
  }
);
```

### 3. Unsaved Changes Guard

```tsx
import { UnsavedChangesGuard } from './routes/middleware';

function RecipeEditForm() {
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState({});

  const handleSave = async () => {
    await saveRecipe(formData);
    setHasChanges(false);
  };

  return (
    <UnsavedChangesGuard
      when={hasChanges}
      message="You have unsaved changes to your recipe. Save before leaving?"
      showSaveOption={true}
      onSave={handleSave}
      onDiscard={() => setHasChanges(false)}
    >
      <form>
        {/* Form content */}
      </form>
    </UnsavedChangesGuard>
  );
}
```

### 4. Route Logging and Analytics

```tsx
import { RouteLogger, createAnalyticsMiddleware } from './routes/middleware';

// Simple route logging
<RouteLogger
  enableConsoleLog={true}
  enableLocalStorage={true}
  maxEntries={100}
>
  <App />
</RouteLogger>

// Analytics integration
const analyticsMiddleware = createAnalyticsMiddleware((event, data) => {
  // Send to your analytics service
  gtag('event', event, data);
});
```

### 5. Using Navigation Hooks

```tsx
import { useNavigationGuard, useBeforeUnload } from './routes/middleware';

function ImportantForm() {
  const [isDirty, setIsDirty] = useState(false);

  // Prevent navigation when form is dirty
  useNavigationGuard(
    isDirty,
    async (context) => {
      const confirmed = await showConfirmDialog();
      return confirmed;
    },
    'Form has unsaved changes'
  );

  // Warn on browser close
  useBeforeUnload(isDirty, 'You have unsaved changes!');

  return <form>{/* Form content */}</form>;
}
```

### 6. Route-Level Middleware

```tsx
import { withRouteMiddleware } from './routes/middleware';

// Create a protected component
const ProtectedDashboard = withRouteMiddleware(
  Dashboard,
  [
    createAuthMiddleware(() => isAuthenticated()),
    createPermissionMiddleware(() => permissions, { '/dashboard': ['user'] }),
  ]
);

// Use in routes
<Route path="/dashboard" element={<ProtectedDashboard />} />
```

### 7. Navigation Blocking

```tsx
import { useNavigationBlock } from './routes/middleware';

function MultiStepForm() {
  const { block, unblock } = useNavigationBlock();
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (currentStep > 1 && currentStep < 5) {
      // Block navigation while in middle of form
      const unblockFn = block({
        when: true,
        message: 'Are you sure you want to leave? Your progress will be lost.',
      });

      return unblockFn;
    }
  }, [currentStep, block]);

  return <div>{/* Multi-step form */}</div>;
}
```

### 8. Performance Monitoring

```tsx
import { RoutePerformanceMonitor } from './routes/middleware';

<RoutePerformanceMonitor
  threshold={1000} // Alert on navigations over 1 second
  onSlowNavigation={(entry) => {
    console.error('Slow navigation detected:', entry);
    // Send to monitoring service
  }}
>
  <App />
</RoutePerformanceMonitor>
```

### 9. Feature Flags

```tsx
import { createFeatureFlagMiddleware } from './routes/middleware';

const featureFlagMiddleware = createFeatureFlagMiddleware(
  async () => ({
    newRecipeEditor: true,
    advancedTrips: false,
    betaFeatures: isUserBeta(),
  }),
  {
    '/recipes/new': 'newRecipeEditor',
    '/trips/advanced': 'advancedTrips',
    '/beta/.*': 'betaFeatures',
  }
);
```

### 10. Complex Example - Full Setup

```tsx
import {
  NavigationMiddlewareProvider,
  createAuthMiddleware,
  createPermissionMiddleware,
  createAnalyticsMiddleware,
  createRouteLoggingMiddleware,
  createMaintenanceModeMiddleware,
  RouteLogger,
} from './routes/middleware';

function App() {
  const globalMiddleware = [
    // Check maintenance mode first
    createMaintenanceModeMiddleware(
      () => checkMaintenanceStatus(),
      '/maintenance',
      ['/api/status']
    ),

    // Authentication check
    createAuthMiddleware(() => isAuthenticated(), '/login'),

    // Permission check
    createPermissionMiddleware(() => getUserPermissions(), {
      '/admin/.*': ['admin'],
      '/recipes/(create|edit)': ['editor'],
    }),

    // Analytics tracking
    createAnalyticsMiddleware((event, data) => {
      analytics.track(event, data);
    }),

    // Debug logging in development
    createRouteLoggingMiddleware(
      (entry) => console.log('Navigation:', entry),
      { includeTimestamp: true, includeUserInfo: true }
    ),
  ];

  return (
    <BrowserRouter>
      <NavigationMiddlewareProvider
        globalMiddleware={globalMiddleware}
        options={{
          onError: (error) => {
            console.error('Middleware error:', error);
            Sentry.captureException(error);
          },
          fallbackRoute: '/error',
        }}
        chainOptions={{
          stopOnFailure: true,
          parallel: false,
          timeout: 3000,
        }}
      >
        <RouteLogger enableLocalStorage={true}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recipes/*" element={<RecipeRoutes />} />
            <Route path="/trips/*" element={<TripRoutes />} />
            <Route path="/admin/*" element={<AdminRoutes />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Routes>
        </RouteLogger>
      </NavigationMiddlewareProvider>
    </BrowserRouter>
  );
}
```

## API Reference

### Middleware Functions

- `createAuthMiddleware(isAuthenticated, loginRoute)` - Authentication check
- `createPermissionMiddleware(getPermissions, routePermissions)` - Permission validation
- `createUnsavedChangesMiddleware(hasChanges, message)` - Unsaved changes guard
- `createAnalyticsMiddleware(trackEvent)` - Analytics tracking
- `createRouteLoggingMiddleware(logger, options)` - Route logging
- `createMaintenanceModeMiddleware(isMaintenanceMode, maintenanceRoute, allowedRoutes)` - Maintenance mode
- `createFeatureFlagMiddleware(getFlags, routeFlags)` - Feature flag checks
- `createRateLimitMiddleware(maxPerMinute)` - Rate limiting
- `createDebugMiddleware(enabled)` - Debug logging

### Hooks

- `useNavigationGuard(when, handler, message)` - Prevent navigation conditionally
- `useBeforeUnload(when, message)` - Browser close warning
- `useRouteMiddleware(middleware)` - Apply middleware to component
- `useNavigationBlock()` - Temporarily block navigation
- `useNavigationHistory(maxSize)` - Track navigation history
- `useRouteTransition(onEnter, onExit)` - Route transition callbacks
- `useConfirmNavigation(when, message)` - Confirm before navigation
- `useUnsavedChanges(options)` - Unsaved changes management

### Components

- `NavigationMiddlewareProvider` - Main provider component
- `UnsavedChangesGuard` - Unsaved changes dialog component
- `RouteLogger` - Route logging component
- `RoutePerformanceMonitor` - Performance monitoring component

## Advanced Patterns

### Custom Middleware

```tsx
const customMiddleware: NavigationMiddleware = async (context) => {
  // Custom logic here
  if (shouldBlock(context)) {
    return {
      allow: false,
      redirect: '/blocked',
      reason: 'Custom reason',
    };
  }
  
  return { allow: true };
};
```

### Conditional Middleware

```tsx
const conditionalMiddleware: NavigationMiddleware = async (context) => {
  // Only check certain routes
  if (!context.to.pathname.startsWith('/protected')) {
    return { allow: true };
  }
  
  // Your logic here
  return checkAccess(context);
};
```

### Async Middleware

```tsx
const asyncMiddleware: NavigationMiddleware = async (context) => {
  try {
    const hasAccess = await checkRemotePermissions(context.to.pathname);
    return { allow: hasAccess };
  } catch (error) {
    return {
      allow: false,
      redirect: '/error',
      reason: 'Failed to check permissions',
    };
  }
};
```