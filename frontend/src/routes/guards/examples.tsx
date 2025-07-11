/**
 * Example implementations of route guards
 * This file demonstrates various ways to use the route guard system
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { 
  ProtectedRoute, 
  RoleGuard, 
  GuestRoute, 
  RouteGuard,
  UserRole,
  createGuard,
  createOrGuard,
  hasFeature,
  hasTimeAccess,
  type RouteGuardContext
} from './index';

// Example pages (these would be your actual components)
const LoginPage = () => <div>Login</div>;
const RegisterPage = () => <div>Register</div>;
const DashboardPage = () => <div>Dashboard</div>;
const AdminPanel = () => <div>Admin Panel</div>;
const UserProfile = () => <div>User Profile</div>;
const PremiumContent = () => <div>Premium Content</div>;
const EventPage = () => <div>Event Page</div>;

/**
 * Example 1: Basic route protection
 */
export const BasicProtectedRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/about" element={<div>About Page</div>} />
    
    {/* Guest-only routes */}
    <Route path="/login" element={
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    } />
    
    <Route path="/register" element={
      <GuestRoute redirectTo="/dashboard">
        <RegisterPage />
      </GuestRoute>
    } />
    
    {/* Protected routes */}
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    } />
    
    <Route path="/profile" element={
      <ProtectedRoute requireEmailVerification>
        <UserProfile />
      </ProtectedRoute>
    } />
  </Routes>
);

/**
 * Example 2: Role-based access control
 */
export const RoleBasedRoutes = () => (
  <Routes>
    {/* Admin only */}
    <Route path="/admin/*" element={
      <ProtectedRoute>
        <RoleGuard roles={UserRole.ADMIN}>
          <AdminPanel />
        </RoleGuard>
      </ProtectedRoute>
    } />
    
    {/* Multiple roles allowed */}
    <Route path="/manage/*" element={
      <ProtectedRoute>
        <RoleGuard roles={[UserRole.ADMIN, UserRole.OWNER]}>
          <div>Management Dashboard</div>
        </RoleGuard>
      </ProtectedRoute>
    } />
    
    {/* Custom forbidden page */}
    <Route path="/restricted" element={
      <ProtectedRoute>
        <RoleGuard 
          roles={UserRole.ADMIN}
          fallback={({ requiredRoles }) => (
            <div className="error-page">
              <h1>Access Restricted</h1>
              <p>You need {requiredRoles.join(' or ')} role to access this page.</p>
              <a href="/dashboard">Return to Dashboard</a>
            </div>
          )}
        >
          <div>Restricted Content</div>
        </RoleGuard>
      </ProtectedRoute>
    } />
  </Routes>
);

/**
 * Example 3: Custom business logic guards
 */

// Subscription guard
const hasActiveSubscription = async (context: RouteGuardContext): Promise<boolean> => {
  if (!context.user) return false;
  
  try {
    // Simulate API call to check subscription
    const response = await fetch(`/api/users/${context.user.id}/subscription`);
    const data = await response.json();
    return data.status === 'active';
  } catch {
    return false;
  }
};

// Feature flag guard
const hasFeatureAccess = (feature: string) => (context: RouteGuardContext): boolean => {
  // In real app, feature flags might come from user data or app config
  const userFeatures = ['feature1', 'feature2', 'premium'];
  return hasFeature(userFeatures, feature);
};

// Time-based guard for events
const isEventActive = async (context: RouteGuardContext): Promise<boolean> => {
  const { eventId } = context.params;
  
  try {
    // Simulate API call to get event details
    const response = await fetch(`/api/events/${eventId}`);
    const event = await response.json();
    
    return hasTimeAccess(
      new Date(event.startTime),
      new Date(event.endTime)
    );
  } catch {
    return false;
  }
};

export const CustomGuardRoutes = () => (
  <Routes>
    {/* Subscription-based access */}
    <Route path="/premium" element={
      <ProtectedRoute>
        <RouteGuard 
          guard={hasActiveSubscription}
          redirectTo="/upgrade"
          cache={true}
          cacheKey="subscription-check"
        >
          <PremiumContent />
        </RouteGuard>
      </ProtectedRoute>
    } />
    
    {/* Feature flag based access */}
    <Route path="/beta/*" element={
      <ProtectedRoute>
        <RouteGuard 
          guard={hasFeatureAccess('beta')}
          fallback={() => (
            <div>
              <h1>Beta Access Required</h1>
              <p>This feature is currently in beta.</p>
            </div>
          )}
        >
          <div>Beta Features</div>
        </RouteGuard>
      </ProtectedRoute>
    } />
    
    {/* Time-based access */}
    <Route path="/events/:eventId" element={
      <RouteGuard 
        guard={isEventActive}
        fallback={() => (
          <div>
            <h1>Event Not Available</h1>
            <p>This event is not currently active.</p>
          </div>
        )}
      >
        <EventPage />
      </RouteGuard>
    } />
  </Routes>
);

/**
 * Example 4: Composed guards
 */

// Admin OR owner of resource
const canManageResource = createOrGuard([
  (context) => context.user?.role === UserRole.ADMIN,
  (context) => context.user?.id === context.params.ownerId
]);

// Premium user AND email verified
const premiumVerifiedGuard = createGuard([
  (context) => !!context.user?.emailVerified,
  hasActiveSubscription
]);

export const ComposedGuardRoutes = () => (
  <Routes>
    <Route path="/resources/:ownerId/edit" element={
      <ProtectedRoute>
        <RouteGuard guard={canManageResource}>
          <div>Edit Resource</div>
        </RouteGuard>
      </ProtectedRoute>
    } />
    
    <Route path="/premium-verified/*" element={
      <ProtectedRoute>
        <RouteGuard 
          guard={premiumVerifiedGuard}
          loader={() => <div>Checking access...</div>}
          onError={(error) => console.error('Guard error:', error)}
        >
          <div>Premium Verified Content</div>
        </RouteGuard>
      </ProtectedRoute>
    } />
  </Routes>
);

/**
 * Example 5: Nested route protection
 */
export const NestedProtectedRoutes = () => (
  <Routes>
    <Route path="/app/*" element={
      <ProtectedRoute>
        <div>
          <nav>App Navigation</nav>
          <Routes>
            <Route path="dashboard" element={<DashboardPage />} />
            
            <Route path="admin/*" element={
              <RoleGuard roles={UserRole.ADMIN}>
                <Routes>
                  <Route path="users" element={<div>User Management</div>} />
                  <Route path="settings" element={<div>Admin Settings</div>} />
                  
                  {/* Super admin only */}
                  <Route path="system" element={
                    <RouteGuard guard={(ctx) => ctx.user?.isSuperAdmin === true}>
                      <div>System Configuration</div>
                    </RouteGuard>
                  } />
                </Routes>
              </RoleGuard>
            } />
            
            <Route path="premium/*" element={
              <RouteGuard guard={hasActiveSubscription}>
                <Routes>
                  <Route path="features" element={<div>Premium Features</div>} />
                  <Route path="analytics" element={<div>Advanced Analytics</div>} />
                </Routes>
              </RouteGuard>
            } />
          </Routes>
        </div>
      </ProtectedRoute>
    } />
  </Routes>
);

/**
 * Example 6: Error handling and loading states
 */
export const AdvancedGuardExample = () => {
  // Guard that might fail
  const riskyGuard = async (context: RouteGuardContext): Promise<boolean> => {
    // Simulate potential failure
    if (Math.random() > 0.5) {
      throw new Error('API call failed');
    }
    return true;
  };

  return (
    <Routes>
      <Route path="/risky/*" element={
        <ProtectedRoute>
          <RouteGuard
            guard={riskyGuard}
            loader={() => (
              <div className="loading-container">
                <div className="spinner" />
                <p>Checking permissions...</p>
              </div>
            )}
            fallback={({ context }) => (
              <div className="error-container">
                <h1>Access Check Failed</h1>
                <p>We couldn't verify your permissions. Please try again.</p>
                <button onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            )}
            onError={(error, context) => {
              // Log to error tracking service
              console.error('Guard error:', { error, user: context.user });
            }}
          >
            <div>Protected Content</div>
          </RouteGuard>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

/**
 * Example 7: Integration with route configuration
 */
export const routeConfig = [
  {
    path: '/',
    children: [
      {
        path: 'auth',
        children: [
          {
            path: 'login',
            element: <GuestRoute><LoginPage /></GuestRoute>
          },
          {
            path: 'register',
            element: <GuestRoute><RegisterPage /></GuestRoute>
          }
        ]
      },
      {
        path: 'app',
        element: <ProtectedRoute><div>App Layout</div></ProtectedRoute>,
        children: [
          {
            path: 'dashboard',
            element: <DashboardPage />
          },
          {
            path: 'admin',
            element: <RoleGuard roles={UserRole.ADMIN}><AdminPanel /></RoleGuard>
          },
          {
            path: 'profile',
            element: <ProtectedRoute requireEmailVerification><UserProfile /></ProtectedRoute>
          }
        ]
      }
    ]
  }
];