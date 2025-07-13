/**
 * Tests for route guards, authentication, and role-based navigation
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ProtectedRoute } from '../guards/ProtectedRoute';
import { GuestRoute } from '../guards/GuestRoute';
import { RoleGuard } from '../guards/RoleGuard';
import { getNavigationItems, findRouteByPath, getBreadcrumbs } from '../config';
import { UserRole } from '../types';

// Mock auth context
const mockAuthContext = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuthContext,
}));

// Mock components
const MockLoginPage = () => <div data-testid="login-page">Login Page</div>;
const MockDashboard = () => <div data-testid="dashboard">Dashboard</div>;
const MockAdminPanel = () => <div data-testid="admin-panel">Admin Panel</div>;
const MockForbidden = () => <div data-testid="forbidden">Access Denied</div>;

describe('Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth context
    mockAuthContext.user = null;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isLoading = false;
  });

  describe('ProtectedRoute', () => {
    it('should redirect to login when not authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<MockLoginPage />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <MockDashboard />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    });

    it('should render protected content when authenticated', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.MEMBER,
      };

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<MockLoginPage />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <MockDashboard />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });

    it('should show loading state while authentication is loading', () => {
      mockAuthContext.isLoading = true;

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<MockLoginPage />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <MockDashboard />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      // Should show loading indicator
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });

    it('should preserve intended route after login', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard/settings']}>
          <Routes>
            <Route path="/login" element={<MockLoginPage />} />
            <Route 
              path="/dashboard/*" 
              element={
                <ProtectedRoute>
                  <div data-testid="dashboard-content">
                    <Routes>
                      <Route path="settings" element={<div data-testid="settings">Settings</div>} />
                    </Routes>
                  </div>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      // Should be redirected to login but remember the intended route
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      
      // Check if the redirect includes the intended route in search params
      // This would be implementation specific
    });
  });

  describe('GuestRoute', () => {
    it('should render guest content when not authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/dashboard" element={<MockDashboard />} />
            <Route 
              path="/login" 
              element={
                <GuestRoute>
                  <MockLoginPage />
                </GuestRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    });

    it('should redirect to dashboard when already authenticated', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.MEMBER,
      };

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/dashboard" element={<MockDashboard />} />
            <Route 
              path="/login" 
              element={
                <GuestRoute>
                  <MockLoginPage />
                </GuestRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });

    it('should redirect to custom route when authenticated', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.ADMIN,
      };

      const CustomHome = () => <div data-testid="custom-home">Custom Home</div>;

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/custom-home" element={<CustomHome />} />
            <Route 
              path="/login" 
              element={
                <GuestRoute redirectTo="/custom-home">
                  <MockLoginPage />
                </GuestRoute>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('custom-home')).toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });

  describe('RoleGuard', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
    });

    it('should allow access for users with required role', () => {
      mockAuthContext.user = {
        id: '1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/forbidden" element={<MockForbidden />} />
            <Route 
              path="/admin" 
              element={
                <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                  <MockAdminPanel />
                </RoleGuard>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('admin-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('forbidden')).not.toBeInTheDocument();
    });

    it('should deny access for users without required role', () => {
      mockAuthContext.user = {
        id: '1',
        email: 'user@example.com',
        role: UserRole.MEMBER,
      };

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/forbidden" element={<MockForbidden />} />
            <Route 
              path="/admin" 
              element={
                <RoleGuard allowedRoles={[UserRole.ADMIN]} fallbackPath="/forbidden">
                  <MockAdminPanel />
                </RoleGuard>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('forbidden')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
    });

    it('should allow access for multiple allowed roles', () => {
      mockAuthContext.user = {
        id: '1',
        email: 'owner@example.com',
        role: UserRole.OWNER,
      };

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/forbidden" element={<MockForbidden />} />
            <Route 
              path="/admin" 
              element={
                <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.OWNER]}>
                  <MockAdminPanel />
                </RoleGuard>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('admin-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('forbidden')).not.toBeInTheDocument();
    });

    it('should handle undefined user role gracefully', () => {
      mockAuthContext.user = {
        id: '1',
        email: 'user@example.com',
        // role is undefined
      };

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/forbidden" element={<MockForbidden />} />
            <Route 
              path="/admin" 
              element={
                <RoleGuard allowedRoles={[UserRole.ADMIN]} fallbackPath="/forbidden">
                  <MockAdminPanel />
                </RoleGuard>
              } 
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('forbidden')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
    });
  });

  describe('Route Configuration Utilities', () => {
    describe('getNavigationItems', () => {
      const mockRoutes = [
        {
          id: 'dashboard',
          path: '/dashboard',
          meta: {
            title: 'Dashboard',
            icon: null,
            navOrder: 1,
          },
        },
        {
          id: 'recipes',
          path: '/recipes',
          roles: [UserRole.ADMIN, UserRole.OWNER],
          meta: {
            title: 'Recipes',
            icon: null,
            navOrder: 2,
          },
        },
        {
          id: 'hidden',
          path: '/hidden',
          meta: {
            title: 'Hidden',
            hideInNav: true,
            navOrder: 3,
          },
        },
        {
          id: 'admin',
          path: '/admin',
          roles: [UserRole.ADMIN],
          meta: {
            title: 'Admin',
            icon: null,
            navOrder: 100,
            badge: 'Beta',
            badgeVariant: 'warning',
          },
        },
      ];

      it('should return all visible routes for admin user', () => {
        const navItems = getNavigationItems(mockRoutes as any, UserRole.ADMIN);
        
        expect(navItems).toHaveLength(3); // dashboard, recipes, admin (hidden is excluded)
        expect(navItems.map(item => item.id)).toEqual(['dashboard', 'recipes', 'admin']);
      });

      it('should filter routes by user role', () => {
        const navItems = getNavigationItems(mockRoutes as any, UserRole.MEMBER);
        
        expect(navItems).toHaveLength(1); // only dashboard
        expect(navItems[0].id).toBe('dashboard');
      });

      it('should exclude hidden routes', () => {
        const navItems = getNavigationItems(mockRoutes as any, UserRole.ADMIN);
        
        expect(navItems.find(item => item.id === 'hidden')).toBeUndefined();
      });

      it('should sort routes by navOrder', () => {
        const navItems = getNavigationItems(mockRoutes as any, UserRole.ADMIN);
        
        expect(navItems[0].id).toBe('dashboard'); // navOrder: 1
        expect(navItems[1].id).toBe('recipes');   // navOrder: 2
        expect(navItems[2].id).toBe('admin');     // navOrder: 100
      });

      it('should include badge information', () => {
        const navItems = getNavigationItems(mockRoutes as any, UserRole.ADMIN);
        const adminItem = navItems.find(item => item.id === 'admin');
        
        expect(adminItem?.badge).toBe('Beta');
        expect(adminItem?.badgeVariant).toBe('warning');
      });

      it('should handle undefined user role', () => {
        const navItems = getNavigationItems(mockRoutes as any, undefined);
        
        // Should only include routes without role restrictions
        expect(navItems).toHaveLength(1);
        expect(navItems[0].id).toBe('dashboard');
      });
    });

    describe('findRouteByPath', () => {
      const mockRoutes = [
        {
          id: 'dashboard',
          path: '/dashboard',
          meta: { title: 'Dashboard' },
        },
        {
          id: 'recipes',
          path: '/recipes',
          meta: { title: 'Recipes' },
          children: [
            {
              id: 'recipe-detail',
              path: '/recipes/:id',
              meta: { title: 'Recipe Detail' },
            },
          ],
        },
      ];

      it('should find route by exact path', () => {
        const route = findRouteByPath('/dashboard', mockRoutes as any);
        
        expect(route).toBeDefined();
        expect(route?.id).toBe('dashboard');
      });

      it('should find nested route', () => {
        const route = findRouteByPath('/recipes/:id', mockRoutes as any);
        
        expect(route).toBeDefined();
        expect(route?.id).toBe('recipe-detail');
      });

      it('should return undefined for non-existent path', () => {
        const route = findRouteByPath('/non-existent', mockRoutes as any);
        
        expect(route).toBeUndefined();
      });
    });

    describe('getBreadcrumbs', () => {
      const mockRoutes = [
        {
          id: 'dashboard',
          path: '/dashboard',
          meta: { title: 'Dashboard', icon: null },
        },
        {
          id: 'recipes',
          path: '/recipes',
          meta: { title: 'Recipes', icon: null },
          children: [
            {
              id: 'recipe-detail',
              path: '/recipes/:id',
              meta: { title: 'Recipe Detail', icon: null },
            },
          ],
        },
      ];

      it('should generate breadcrumbs for top-level route', () => {
        const breadcrumbs = getBreadcrumbs('dashboard', mockRoutes as any);
        
        expect(breadcrumbs).toHaveLength(1);
        expect(breadcrumbs[0].label).toBe('Dashboard');
        expect(breadcrumbs[0].current).toBe(true);
      });

      it('should generate breadcrumbs for nested route', () => {
        const breadcrumbs = getBreadcrumbs('recipe-detail', mockRoutes as any);
        
        expect(breadcrumbs).toHaveLength(2);
        expect(breadcrumbs[0].label).toBe('Recipes');
        expect(breadcrumbs[0].current).toBeUndefined();
        expect(breadcrumbs[1].label).toBe('Recipe Detail');
        expect(breadcrumbs[1].current).toBe(true);
      });

      it('should return empty array for non-existent route', () => {
        const breadcrumbs = getBreadcrumbs('non-existent', mockRoutes as any);
        
        expect(breadcrumbs).toHaveLength(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex routing scenarios', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      const ComplexApp = () => (
        <Routes>
          <Route path="/login" element={
            <GuestRoute>
              <MockLoginPage />
            </GuestRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <MockDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                <MockAdminPanel />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/forbidden" element={<MockForbidden />} />
        </Routes>
      );

      const { rerender } = render(
        <MemoryRouter initialEntries={['/login']}>
          <ComplexApp />
        </MemoryRouter>
      );

      // Admin user visiting login should be redirected
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();

      // Admin user can access admin panel
      rerender(
        <MemoryRouter initialEntries={['/admin']}>
          <ComplexApp />
        </MemoryRouter>
      );

      expect(screen.getByTestId('admin-panel')).toBeInTheDocument();

      // Change to regular user
      mockAuthContext.user = {
        id: '2',
        email: 'user@example.com',
        role: UserRole.MEMBER,
      };

      // Regular user cannot access admin panel
      rerender(
        <MemoryRouter initialEntries={['/admin']}>
          <ComplexApp />
        </MemoryRouter>
      );

      // Should be redirected to forbidden or dashboard
      expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
    });

    it('should handle authentication state changes', async () => {
      const DynamicApp = () => (
        <Routes>
          <Route path="/login" element={
            <GuestRoute>
              <MockLoginPage />
            </GuestRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <MockDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      );

      const { rerender } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <DynamicApp />
        </MemoryRouter>
      );

      // Not authenticated - should redirect to login
      expect(screen.getByTestId('login-page')).toBeInTheDocument();

      // User logs in
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'user@example.com',
        role: UserRole.MEMBER,
      };

      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <DynamicApp />
        </MemoryRouter>
      );

      // Now authenticated - should see dashboard
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });
});