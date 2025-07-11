/**
 * Route Guards
 * 
 * This module provides a comprehensive set of route protection components
 * and utilities for implementing authentication and authorization in the application.
 */

// Export guard components
export { ProtectedRoute } from './ProtectedRoute';
export { RoleGuard } from './RoleGuard';
export { GuestRoute } from './GuestRoute';
export { RouteGuard } from './RouteGuard';

// Export guard functions
export {
  // Authentication guards
  isAuthenticated,
  isEmailVerified,
  isFullyAuthenticated,
  
  // Role guards
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isAdmin,
  
  // Ownership guards
  isOwner,
  canEditResource,
  canDeleteResource,
  canViewPrivateContent,
  
  // Feature guards
  hasFeature,
  hasAllFeatures,
  hasAnyFeature,
  
  // Time-based guards
  hasTimeAccess,
  
  // Subscription guards
  hasSubscription,
  
  // Complex guards
  canAccessAdmin,
  complexGuard,
  
  // Guard factories
  createGuard,
  createOrGuard,
} from './guards';

// Export hooks
export {
  useRouteGuard,
  usePermissions,
  useRedirectAfterLogin,
  useFeatureFlags,
  useAuthState,
  useProtectedAction,
} from './hooks';

// Re-export types for convenience
export type { RouteGuardContext } from '../types';