import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '../guards/ProtectedRoute';
import { RoleGuard } from '../guards/RoleGuard';
import { GuestRoute } from '../guards/GuestRoute';
import { RouteGuard } from '../guards/RouteGuard';
import { useAuthGuard, useRoleGuard, useFeatureGuard } from '../guards/hooks';
import { renderHook } from '@testing-library/react';
import * as authHooks from '@/hooks/useAuth';

// Mock useAuth hook
vi.mock('@/hooks/useAuth');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when authenticated', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    const { container } = render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute redirectTo="/login">
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </TestWrapper>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('should show loading state', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when user has required role', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['admin', 'user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <RoleGuard roles={['admin']}>
          <div>Admin Content</div>
        </RoleGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should render fallback when user lacks required role', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <RoleGuard 
          roles={['admin']} 
          fallback={<div>Access Denied</div>}
        >
          <div>Admin Content</div>
        </RoleGuard>
      </TestWrapper>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('should check any role when requireAll is false', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['moderator', 'user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <RoleGuard roles={['admin', 'moderator']} requireAll={false}>
          <div>Moderator Content</div>
        </RoleGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Moderator Content')).toBeInTheDocument();
  });

  it('should require all roles when requireAll is true', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['admin'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <RoleGuard roles={['admin', 'moderator']} requireAll={true}>
          <div>Super Admin Content</div>
        </RoleGuard>
      </TestWrapper>
    );

    expect(screen.queryByText('Super Admin Content')).not.toBeInTheDocument();
  });
});

describe('GuestRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when not authenticated', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <GuestRoute>
          <div>Guest Content</div>
        </GuestRoute>
      </TestWrapper>
    );

    expect(screen.getByText('Guest Content')).toBeInTheDocument();
  });

  it('should redirect when authenticated', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <GuestRoute redirectTo="/dashboard">
                <div>Guest Content</div>
              </GuestRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </TestWrapper>
    );

    expect(screen.queryByText('Guest Content')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });
});

describe('RouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when guard passes', async () => {
    const guardFn = vi.fn().mockResolvedValue(true);

    render(
      <TestWrapper>
        <RouteGuard guard={guardFn}>
          <div>Guarded Content</div>
        </RouteGuard>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Guarded Content')).toBeInTheDocument();
    });

    expect(guardFn).toHaveBeenCalled();
  });

  it('should render fallback when guard fails', async () => {
    const guardFn = vi.fn().mockResolvedValue(false);

    render(
      <TestWrapper>
        <RouteGuard 
          guard={guardFn}
          fallback={<div>Access Denied</div>}
        >
          <div>Guarded Content</div>
        </RouteGuard>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    expect(screen.queryByText('Guarded Content')).not.toBeInTheDocument();
  });

  it('should show loading state while checking', () => {
    const guardFn = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(true), 100))
    );

    render(
      <TestWrapper>
        <RouteGuard 
          guard={guardFn}
          loading={<div>Checking...</div>}
        >
          <div>Guarded Content</div>
        </RouteGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Checking...')).toBeInTheDocument();
  });
});

describe('Guard Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuthGuard', () => {
    it('should return true when authenticated', () => {
      vi.mocked(authHooks.useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', roles: ['user'] },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      } as any);

      const { result } = renderHook(() => useAuthGuard(), {
        wrapper: TestWrapper,
      });

      expect(result.current.canAccess).toBe(true);
      expect(result.current.isChecking).toBe(false);
    });

    it('should redirect when not authenticated', () => {
      vi.mocked(authHooks.useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      } as any);

      const { result } = renderHook(
        () => useAuthGuard({ redirectTo: '/login' }), 
        { wrapper: TestWrapper }
      );

      expect(result.current.canAccess).toBe(false);
      expect(window.location.pathname).toBe('/login');
    });
  });

  describe('useRoleGuard', () => {
    it('should return true when user has required role', () => {
      vi.mocked(authHooks.useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', roles: ['admin'] },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      } as any);

      const { result } = renderHook(
        () => useRoleGuard(['admin']), 
        { wrapper: TestWrapper }
      );

      expect(result.current.hasRole).toBe(true);
      expect(result.current.missingRoles).toEqual([]);
    });

    it('should return missing roles', () => {
      vi.mocked(authHooks.useAuth).mockReturnValue({
        user: { id: '1', email: 'test@example.com', roles: ['user'] },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      } as any);

      const { result } = renderHook(
        () => useRoleGuard(['admin', 'moderator']), 
        { wrapper: TestWrapper }
      );

      expect(result.current.hasRole).toBe(false);
      expect(result.current.missingRoles).toEqual(['admin', 'moderator']);
    });
  });

  describe('useFeatureGuard', () => {
    it('should check feature flags', () => {
      // Mock feature flag system
      const checkFeature = vi.fn().mockReturnValue(true);
      
      const { result } = renderHook(
        () => useFeatureGuard('new-feature', checkFeature), 
        { wrapper: TestWrapper }
      );

      expect(result.current.isEnabled).toBe(true);
      expect(checkFeature).toHaveBeenCalledWith('new-feature');
    });
  });
});