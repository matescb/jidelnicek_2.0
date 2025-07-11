import { describe, it, expect, vi } from 'vitest';
import {
  isAuthenticated,
  isEmailVerified,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isAdmin,
  isOwner,
  canEditResource,
  canDeleteResource,
  canViewPrivateContent,
  hasFeature,
  hasAllFeatures,
  hasAnyFeature,
  hasTimeAccess,
  createGuard,
  createOrGuard,
} from '../guards';
import { UserRole } from '../../types';
import type { User } from '@/store/slices/authStore';
import type { RouteGuardContext } from '../../types';

// Mock user data
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  emailVerified: true,
  role: 'user',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockAdmin: User = {
  ...mockUser,
  id: 'admin-123',
  role: 'admin',
};

describe('Authentication Guards', () => {
  describe('isAuthenticated', () => {
    it('should return true for authenticated user', () => {
      expect(isAuthenticated(mockUser)).toBe(true);
    });

    it('should return false for null user', () => {
      expect(isAuthenticated(null)).toBe(false);
    });
  });

  describe('isEmailVerified', () => {
    it('should return true for verified email', () => {
      expect(isEmailVerified(mockUser)).toBe(true);
    });

    it('should return false for unverified email', () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      expect(isEmailVerified(unverifiedUser)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isEmailVerified(null)).toBe(false);
    });
  });
});

describe('Role Guards', () => {
  describe('hasRole', () => {
    it('should return true when user has the required role', () => {
      expect(hasRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
    });

    it('should return false when user does not have the required role', () => {
      expect(hasRole(UserRole.GUEST, UserRole.ADMIN)).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true when user has any of the required roles', () => {
      expect(hasAnyRole(UserRole.ADMIN, [UserRole.ADMIN, UserRole.OWNER])).toBe(true);
      expect(hasAnyRole(UserRole.OWNER, [UserRole.ADMIN, UserRole.OWNER])).toBe(true);
    });

    it('should return false when user has none of the required roles', () => {
      expect(hasAnyRole(UserRole.GUEST, [UserRole.ADMIN, UserRole.OWNER])).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true when all required roles are the same and match user role', () => {
      expect(hasAllRoles(UserRole.ADMIN, [UserRole.ADMIN, UserRole.ADMIN])).toBe(true);
    });

    it('should return false when required roles differ (single-role system)', () => {
      expect(hasAllRoles(UserRole.ADMIN, [UserRole.ADMIN, UserRole.OWNER])).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', () => {
      expect(isAdmin(mockAdmin)).toBe(true);
    });

    it('should return false for non-admin user', () => {
      expect(isAdmin(mockUser)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isAdmin(null)).toBe(false);
    });
  });
});

describe('Ownership Guards', () => {
  describe('isOwner', () => {
    it('should return true when user owns the resource', () => {
      expect(isOwner(mockUser, 'user-123')).toBe(true);
    });

    it('should return false when user does not own the resource', () => {
      expect(isOwner(mockUser, 'other-user-123')).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isOwner(null, 'user-123')).toBe(false);
    });
  });

  describe('canEditResource', () => {
    it('should allow owner to edit', () => {
      expect(canEditResource(mockUser, 'user-123')).toBe(true);
    });

    it('should allow admin to edit when override is enabled', () => {
      expect(canEditResource(mockAdmin, 'other-user-123', true)).toBe(true);
    });

    it('should not allow admin to edit when override is disabled', () => {
      expect(canEditResource(mockAdmin, 'other-user-123', false)).toBe(false);
    });

    it('should not allow non-owner non-admin to edit', () => {
      expect(canEditResource(mockUser, 'other-user-123')).toBe(false);
    });
  });

  describe('canViewPrivateContent', () => {
    it('should allow viewing public content', () => {
      expect(canViewPrivateContent(null, 'any-id', true)).toBe(true);
    });

    it('should allow owner to view private content', () => {
      expect(canViewPrivateContent(mockUser, 'user-123', false)).toBe(true);
    });

    it('should allow admin to view private content', () => {
      expect(canViewPrivateContent(mockAdmin, 'other-user-123', false)).toBe(true);
    });

    it('should not allow non-owner to view private content', () => {
      expect(canViewPrivateContent(mockUser, 'other-user-123', false)).toBe(false);
    });
  });
});

describe('Feature Guards', () => {
  const features = ['feature1', 'feature2', 'feature3'];

  describe('hasFeature', () => {
    it('should return true when feature exists', () => {
      expect(hasFeature(features, 'feature1')).toBe(true);
    });

    it('should return false when feature does not exist', () => {
      expect(hasFeature(features, 'feature4')).toBe(false);
    });
  });

  describe('hasAllFeatures', () => {
    it('should return true when all features exist', () => {
      expect(hasAllFeatures(features, ['feature1', 'feature2'])).toBe(true);
    });

    it('should return false when any feature is missing', () => {
      expect(hasAllFeatures(features, ['feature1', 'feature4'])).toBe(false);
    });
  });

  describe('hasAnyFeature', () => {
    it('should return true when any feature exists', () => {
      expect(hasAnyFeature(features, ['feature1', 'feature4'])).toBe(true);
    });

    it('should return false when no features exist', () => {
      expect(hasAnyFeature(features, ['feature4', 'feature5'])).toBe(false);
    });
  });
});

describe('Time-based Guards', () => {
  describe('hasTimeAccess', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const future = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

    it('should return true when no time constraints', () => {
      expect(hasTimeAccess()).toBe(true);
    });

    it('should return true when current time is within range', () => {
      expect(hasTimeAccess(past, future)).toBe(true);
    });

    it('should return false when current time is before start', () => {
      expect(hasTimeAccess(future)).toBe(false);
    });

    it('should return false when current time is after end', () => {
      expect(hasTimeAccess(undefined, past)).toBe(false);
    });
  });
});

describe('Guard Factories', () => {
  const mockContext: RouteGuardContext = {
    user: mockUser,
    route: {
      id: 'test-route',
      path: '/test',
      component: null as any,
      meta: { title: 'Test' },
    },
    params: {},
    query: {},
  };

  describe('createGuard', () => {
    it('should pass when all conditions are true', async () => {
      const guard = createGuard([
        () => true,
        () => true,
        async () => true,
      ]);

      expect(await guard(mockContext)).toBe(true);
    });

    it('should fail when any condition is false', async () => {
      const guard = createGuard([
        () => true,
        () => false,
        () => true,
      ]);

      expect(await guard(mockContext)).toBe(false);
    });

    it('should stop checking after first false', async () => {
      const spy = vi.fn(() => true);
      const guard = createGuard([
        () => false,
        spy,
      ]);

      expect(await guard(mockContext)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('createOrGuard', () => {
    it('should pass when any condition is true', async () => {
      const guard = createOrGuard([
        () => false,
        () => true,
        () => false,
      ]);

      expect(await guard(mockContext)).toBe(true);
    });

    it('should fail when all conditions are false', async () => {
      const guard = createOrGuard([
        () => false,
        async () => false,
        () => false,
      ]);

      expect(await guard(mockContext)).toBe(false);
    });

    it('should stop checking after first true', async () => {
      const spy = vi.fn(() => true);
      const guard = createOrGuard([
        () => true,
        spy,
      ]);

      expect(await guard(mockContext)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});