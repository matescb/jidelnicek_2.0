import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '@/App';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import * as authService from '@/services/auth';

// Mock auth service
vi.mock('@/services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshToken: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Test wrapper with all providers
const createWrapper = (initialEntries: string[] = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Routing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Full Application Routing', () => {
    it('should render home page for unauthenticated users', () => {
      vi.mocked(authService.getCurrentUser).mockReturnValue(null);

      render(<App />, { wrapper: createWrapper() });

      expect(screen.getByText(/Welcome to Jídelníček/i)).toBeInTheDocument();
      expect(screen.getByText(/Login/i)).toBeInTheDocument();
      expect(screen.getByText(/Register/i)).toBeInTheDocument();
    });

    it('should redirect to dashboard after login', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue(null);
      vi.mocked(authService.login).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', roles: ['user'] },
        token: 'test-token',
      });

      render(<App />, { wrapper: createWrapper(['/login']) });

      // Fill login form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
        expect(window.location.pathname).toBe('/dashboard');
      });
    });

    it('should handle deep links to protected resources', async () => {
      // Start unauthenticated
      vi.mocked(authService.getCurrentUser).mockReturnValue(null);

      render(<App />, { wrapper: createWrapper(['/recipes/123']) });

      // Should redirect to login
      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toContain('redirect=/recipes/123');

      // Simulate successful login
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      // Re-render as authenticated
      render(<App />, { wrapper: createWrapper(['/recipes/123']) });

      await waitFor(() => {
        expect(screen.getByText(/Recipe Details/i)).toBeInTheDocument();
        expect(window.location.pathname).toBe('/recipes/123');
      });
    });
  });

  describe('Protected Route Navigation', () => {
    it('should allow navigation between protected routes when authenticated', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/dashboard']) });

      // Navigate to recipes
      await user.click(screen.getByText(/Recipes/i));
      expect(window.location.pathname).toBe('/recipes');

      // Navigate to meal plans
      await user.click(screen.getByText(/Meal Plans/i));
      expect(window.location.pathname).toBe('/meal-plans');

      // Navigate back to dashboard
      await user.click(screen.getByText(/Dashboard/i));
      expect(window.location.pathname).toBe('/dashboard');
    });

    it('should handle role-based routing', async () => {
      // Regular user
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'user@example.com',
        roles: ['user'],
      });

      const { rerender } = render(<App />, { wrapper: createWrapper(['/admin']) });

      // Should show access denied
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();

      // Admin user
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '2',
        email: 'admin@example.com',
        roles: ['admin'],
      });

      rerender(<App />);

      // Should show admin panel
      await waitFor(() => {
        expect(screen.getByText(/Admin Panel/i)).toBeInTheDocument();
      });
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should update breadcrumbs on navigation', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/dashboard']) });

      // Check initial breadcrumb
      expect(screen.getByText('Dashboard')).toBeInTheDocument();

      // Navigate to recipes
      await user.click(screen.getByRole('link', { name: /Recipes/i }));

      // Check breadcrumb update
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getAllByText('Recipes')[0]).toBeInTheDocument();

      // Navigate to specific recipe
      await user.click(screen.getByText('Pasta Carbonara'));

      // Check nested breadcrumb
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getAllByText('Recipes')[0]).toBeInTheDocument();
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
    });

    it('should handle breadcrumb clicks', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/recipes/123/edit']) });

      // Click on Recipes breadcrumb
      const recipesBreadcrumb = screen.getAllByText('Recipes')[0];
      await user.click(recipesBreadcrumb);

      expect(window.location.pathname).toBe('/recipes');
    });
  });

  describe('Navigation Guards', () => {
    it('should guard unsaved changes', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn().mockReturnValue(false);
      
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/recipes/new']) });

      // Make changes to form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Recipe');

      // Try to navigate away
      await user.click(screen.getByText(/Dashboard/i));

      // Confirm dialog should appear
      expect(window.confirm).toHaveBeenCalledWith(
        'You have unsaved changes. Do you want to leave?'
      );

      // Should stay on current page
      expect(window.location.pathname).toBe('/recipes/new');
    });

    it('should allow navigation after saving', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/recipes/new']) });

      // Fill and save form
      await user.type(screen.getByLabelText(/title/i), 'New Recipe');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText(/Recipe saved/i)).toBeInTheDocument();
      });

      // Navigate away without confirmation
      await user.click(screen.getByText(/Dashboard/i));
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  describe('Route Transitions', () => {
    it('should show loading states during navigation', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      // Mock slow data loading
      const slowLoader = () => new Promise(resolve => 
        setTimeout(() => resolve({ data: 'loaded' }), 100)
      );

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route 
              path="/slow" 
              element={<React.Suspense fallback={<div>Loading...</div>}>
                <div>Slow Page</div>
              </React.Suspense>}
              loader={slowLoader}
            />
          </Routes>
          <a href="/slow">Go to slow page</a>
        </MemoryRouter>
      );

      await user.click(screen.getByText('Go to slow page'));

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Should eventually show content
      await waitFor(() => {
        expect(screen.getByText('Slow Page')).toBeInTheDocument();
      });
    });

    it('should handle navigation errors gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      // Mock API error
      const errorLoader = () => Promise.reject(new Error('Failed to load'));

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route 
              path="/error" 
              element={<div>Error Page</div>}
              errorElement={<div>Something went wrong!</div>}
              loader={errorLoader}
            />
          </Routes>
          <a href="/error">Go to error page</a>
        </MemoryRouter>
      );

      await user.click(screen.getByText('Go to error page'));

      await waitFor(() => {
        expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Navigation', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      window.dispatchEvent(new Event('resize'));
    });

    it('should handle mobile menu navigation', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/dashboard']) });

      // Open mobile menu
      const menuButton = screen.getByLabelText(/menu/i);
      await user.click(menuButton);

      // Navigate via mobile menu
      const recipesLink = screen.getByRole('link', { name: /Recipes/i });
      await user.click(recipesLink);

      // Menu should close and navigation should occur
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/recipes');
    });

    it('should truncate breadcrumbs on mobile', () => {
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { 
        wrapper: createWrapper(['/recipes/italian/pasta/carbonara']) 
      });

      // Should show ellipsis for truncated breadcrumbs
      expect(screen.getByText('...')).toBeInTheDocument();
      
      // Should show last two items
      expect(screen.getByText('Pasta')).toBeInTheDocument();
      expect(screen.getByText('Carbonara')).toBeInTheDocument();
      
      // Should not show all items
      expect(screen.queryByText('Recipes')).not.toBeInTheDocument();
      expect(screen.queryByText('Italian')).not.toBeInTheDocument();
    });
  });

  describe('Session Management', () => {
    it('should handle session expiration', async () => {
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/dashboard']) });

      // Simulate token expiration
      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('Token expired')
      );

      // Trigger an API call that would check the token
      await waitFor(() => {
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
      });
    });

    it('should preserve location after re-authentication', async () => {
      const user = userEvent.setup();
      
      // Start authenticated
      vi.mocked(authService.getCurrentUser).mockReturnValue({
        id: '1',
        email: 'test@example.com',
        roles: ['user'],
      });

      render(<App />, { wrapper: createWrapper(['/recipes/123']) });

      // Simulate logout
      await user.click(screen.getByText(/Logout/i));
      
      // Should redirect to login with return URL
      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toContain('redirect=/recipes/123');

      // Re-authenticate
      vi.mocked(authService.login).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', roles: ['user'] },
        token: 'new-token',
      });

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Should return to original location
      await waitFor(() => {
        expect(window.location.pathname).toBe('/recipes/123');
      });
    });
  });
});