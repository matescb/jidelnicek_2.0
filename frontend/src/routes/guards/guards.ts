import { User } from '@/store/slices/authStore';
import { UserRole, RouteGuardContext } from '../types';

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (user: User | null): boolean => {
  return !!user;
};

/**
 * Check if user's email is verified
 */
export const isEmailVerified = (user: User | null): boolean => {
  return !!user && user.emailVerified;
};

/**
 * Check if user has a specific role
 */
export const hasRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return userRole === requiredRole;
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole);
};

/**
 * Check if user has all of the specified roles
 * Note: In a single-role system, this only passes if the user's role matches all required roles (which must be the same)
 */
export const hasAllRoles = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  // In a single-role system, user can only have all roles if all required roles are the same
  const uniqueRoles = [...new Set(requiredRoles)];
  return uniqueRoles.length === 1 && userRole === uniqueRoles[0];
};

/**
 * Check if user is an admin
 */
export const isAdmin = (user: User | null): boolean => {
  return !!user && user.role === 'admin';
};

/**
 * Check if user owns a resource
 */
export const isOwner = (user: User | null, resourceOwnerId: string): boolean => {
  return !!user && user.id === resourceOwnerId;
};

/**
 * Check if feature flag is enabled
 */
export const hasFeature = (features: string[], requiredFeature: string): boolean => {
  return features.includes(requiredFeature);
};

/**
 * Check if all feature flags are enabled
 */
export const hasAllFeatures = (features: string[], requiredFeatures: string[]): boolean => {
  return requiredFeatures.every(feature => features.includes(feature));
};

/**
 * Check if any feature flag is enabled
 */
export const hasAnyFeature = (features: string[], requiredFeatures: string[]): boolean => {
  return requiredFeatures.some(feature => features.includes(feature));
};

/**
 * Combined authentication and email verification guard
 */
export const isFullyAuthenticated = (user: User | null): boolean => {
  return isAuthenticated(user) && isEmailVerified(user);
};

/**
 * Time-based access guard
 */
export const hasTimeAccess = (startTime?: Date, endTime?: Date): boolean => {
  const now = new Date();
  
  if (startTime && now < startTime) {
    return false;
  }
  
  if (endTime && now > endTime) {
    return false;
  }
  
  return true;
};

/**
 * Subscription-based access guard
 */
export const hasSubscription = (user: User | null, requiredPlan?: string): boolean => {
  if (!user) return false;
  
  // This is a placeholder - implement based on your subscription model
  // For example:
  // return user.subscription?.plan === requiredPlan || user.subscription?.plan === 'premium';
  
  return true; // Default to true if no subscription system
};

/**
 * Custom business logic guards
 */

/**
 * Check if user can access admin features
 */
export const canAccessAdmin = (context: RouteGuardContext): boolean => {
  return isAdmin(context.user);
};

/**
 * Check if user can edit a specific resource
 */
export const canEditResource = (
  user: User | null,
  resourceOwnerId: string,
  allowAdminOverride = true
): boolean => {
  if (!user) return false;
  
  // Owner can always edit
  if (isOwner(user, resourceOwnerId)) {
    return true;
  }
  
  // Admin can edit if override is allowed
  if (allowAdminOverride && isAdmin(user)) {
    return true;
  }
  
  return false;
};

/**
 * Check if user can delete a resource
 */
export const canDeleteResource = (
  user: User | null,
  resourceOwnerId: string,
  allowAdminOverride = true
): boolean => {
  // Use same logic as edit for now
  return canEditResource(user, resourceOwnerId, allowAdminOverride);
};

/**
 * Check if user can view private content
 */
export const canViewPrivateContent = (
  user: User | null,
  contentOwnerId: string,
  isPublic: boolean
): boolean => {
  // Public content is always viewable
  if (isPublic) return true;
  
  // Must be authenticated to view private content
  if (!user) return false;
  
  // Owner can view their own content
  if (isOwner(user, contentOwnerId)) return true;
  
  // Admin can view all content
  if (isAdmin(user)) return true;
  
  return false;
};

/**
 * Complex guard combining multiple conditions
 */
export const complexGuard = async (context: RouteGuardContext): Promise<boolean> => {
  const { user, params } = context;
  
  // Example: Check multiple conditions
  if (!isAuthenticated(user)) {
    return false;
  }
  
  if (!isEmailVerified(user)) {
    return false;
  }
  
  // Example: Check resource ownership
  if (params.userId && !canEditResource(user, params.userId)) {
    return false;
  }
  
  // Example: Check time-based access
  // const event = await fetchEvent(params.eventId);
  // if (!hasTimeAccess(event.startTime, event.endTime)) {
  //   return false;
  // }
  
  return true;
};

/**
 * Create a custom guard function
 */
export const createGuard = (
  conditions: Array<(context: RouteGuardContext) => boolean | Promise<boolean>>
) => {
  return async (context: RouteGuardContext): Promise<boolean> => {
    for (const condition of conditions) {
      const result = await condition(context);
      if (!result) {
        return false;
      }
    }
    return true;
  };
};

/**
 * Create an OR guard (any condition must pass)
 */
export const createOrGuard = (
  conditions: Array<(context: RouteGuardContext) => boolean | Promise<boolean>>
) => {
  return async (context: RouteGuardContext): Promise<boolean> => {
    for (const condition of conditions) {
      const result = await condition(context);
      if (result) {
        return true;
      }
    }
    return false;
  };
};