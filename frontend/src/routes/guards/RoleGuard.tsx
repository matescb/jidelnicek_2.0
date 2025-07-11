import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/slices/authStore';
import { UserRole } from '../types';
import { hasAnyRole, hasAllRoles } from './guards';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Required roles for access */
  roles: UserRole | UserRole[];
  /** Use AND logic for multiple roles (default: OR) */
  requireAll?: boolean;
  /** Component to show for insufficient permissions */
  fallback?: React.ComponentType<{ requiredRoles: UserRole[] }>;
  /** Redirect path for insufficient permissions */
  redirectTo?: string;
  /** Admin users can bypass role checks */
  adminOverride?: boolean;
}

/**
 * Default forbidden component
 */
const DefaultForbidden: React.FC<{ requiredRoles: UserRole[] }> = ({ requiredRoles }) => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-red-600">403</h1>
      <p className="mt-2 text-lg text-gray-600">Access Forbidden</p>
      <p className="mt-1 text-sm text-gray-500">
        You need one of these roles: {requiredRoles.join(', ')}
      </p>
      <button
        onClick={() => window.history.back()}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Go Back
      </button>
    </div>
  </div>
);

/**
 * Role-based access control component
 * Checks if user has required roles before rendering children
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  roles,
  requireAll = false,
  fallback: FallbackComponent = DefaultForbidden,
  redirectTo,
  adminOverride = true,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Ensure user is authenticated first
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  const rolesArray = Array.isArray(roles) ? roles : [roles];
  
  // Check if user is admin and admin override is enabled
  if (adminOverride && user.role === UserRole.ADMIN) {
    return <>{children}</>;
  }

  // Map string role to UserRole enum
  const userRole = user.role as UserRole;

  // Check role permissions
  const hasPermission = requireAll
    ? hasAllRoles(userRole, rolesArray)
    : hasAnyRole(userRole, rolesArray);

  if (!hasPermission) {
    // Redirect if path is provided
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Show fallback component
    return <FallbackComponent requiredRoles={rolesArray} />;
  }

  // User has required permissions
  return <>{children}</>;
};