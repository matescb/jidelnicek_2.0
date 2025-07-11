import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { MobileMenu } from '../components/MobileMenu';
import { UserMenu } from '../components/UserMenu';
import { NavLink } from '../components/NavLink';
import * as authHooks from '@/hooks/useAuth';

// Mock hooks
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false), // Default to desktop
}));

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

describe('Navbar', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);
  });

  it('should render navbar with logo and navigation items', () => {
    render(
      <TestWrapper>
        <Navbar />
      </TestWrapper>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByAltText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
  });

  it('should show user menu when authenticated', () => {
    render(
      <TestWrapper>
        <Navbar />
      </TestWrapper>
    );

    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('should show login link when not authenticated', () => {
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
        <Navbar />
      </TestWrapper>
    );

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.queryByText(mockUser.name)).not.toBeInTheDocument();
  });

  it('should toggle mobile menu', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Navbar />
      </TestWrapper>
    );

    const menuButton = screen.getByLabelText('Toggle menu');
    await user.click(menuButton);

    expect(screen.getByRole('navigation', { name: 'Mobile menu' })).toBeInTheDocument();
  });

  it('should highlight active route', () => {
    render(
      <MemoryRouter initialEntries={['/recipes']}>
        <QueryClientProvider client={queryClient}>
          <Navbar />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const recipesLink = screen.getByText('Recipes').closest('a');
    expect(recipesLink).toHaveClass('active');
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);
  });

  it('should render sidebar with navigation items', () => {
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('Meal Plans')).toBeInTheDocument();
  });

  it('should collapse and expand sidebar', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    const collapseButton = screen.getByLabelText('Collapse sidebar');
    await user.click(collapseButton);

    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true');

    await user.click(collapseButton);
    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'false');
  });

  it('should show tooltips when collapsed', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Sidebar defaultCollapsed={true} />
      </TestWrapper>
    );

    const dashboardIcon = screen.getByLabelText('Dashboard');
    await user.hover(dashboardIcon);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Dashboard');
    });
  });

  it('should filter items based on user role', () => {
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
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('should persist collapse state', async () => {
    const user = userEvent.setup();
    
    const { rerender } = render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    const collapseButton = screen.getByLabelText('Collapse sidebar');
    await user.click(collapseButton);

    // Simulate remount
    rerender(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true');
  });
});

describe('MobileMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', roles: ['user'] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);
  });

  it('should render mobile menu when open', () => {
    render(
      <TestWrapper>
        <MobileMenu isOpen={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <TestWrapper>
        <MobileMenu isOpen={false} onClose={vi.fn()} />
      </TestWrapper>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should call onClose when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <TestWrapper>
        <MobileMenu isOpen={true} onClose={onClose} />
      </TestWrapper>
    );

    const backdrop = screen.getByTestId('mobile-menu-backdrop');
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it('should close when navigation item clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <TestWrapper>
        <MobileMenu isOpen={true} onClose={onClose} />
      </TestWrapper>
    );

    const dashboardLink = screen.getByText('Dashboard');
    await user.click(dashboardLink);

    expect(onClose).toHaveBeenCalled();
  });

  it('should trap focus within menu', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileMenu isOpen={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    const closeButton = screen.getByLabelText('Close menu');
    closeButton.focus();

    await user.tab();
    expect(screen.getByText('Dashboard')).toHaveFocus();

    // Tab through all items and back to close button
    const menuItems = screen.getAllByRole('link');
    for (let i = 0; i < menuItems.length; i++) {
      await user.tab();
    }

    expect(closeButton).toHaveFocus();
  });
});

describe('UserMenu', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    avatar: '/avatar.jpg',
    roles: ['user'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);
  });

  it('should render user avatar and name', () => {
    render(
      <TestWrapper>
        <UserMenu />
      </TestWrapper>
    );

    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    expect(screen.getByAltText(mockUser.name)).toHaveAttribute('src', mockUser.avatar);
  });

  it('should toggle dropdown menu', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <UserMenu />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /user menu/i });
    await user.click(menuButton);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <div>
          <UserMenu />
          <button>Outside button</button>
        </div>
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /user menu/i });
    await user.click(menuButton);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByText('Outside button'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should handle logout', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn();
    
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: mockLogout,
      register: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <UserMenu />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /user menu/i });
    await user.click(menuButton);

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should navigate to profile', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <UserMenu />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /user menu/i });
    await user.click(menuButton);

    const profileLink = screen.getByText('Profile');
    await user.click(profileLink);

    expect(window.location.pathname).toBe('/profile');
  });
});

describe('NavLink', () => {
  it('should render active state correctly', () => {
    render(
      <MemoryRouter initialEntries={['/recipes']}>
        <NavLink to="/recipes">Recipes</NavLink>
      </MemoryRouter>
    );

    const link = screen.getByText('Recipes');
    expect(link).toHaveClass('active');
  });

  it('should handle exact matching', () => {
    render(
      <MemoryRouter initialEntries={['/recipes/new']}>
        <NavLink to="/recipes" exact>Recipes</NavLink>
      </MemoryRouter>
    );

    const link = screen.getByText('Recipes');
    expect(link).not.toHaveClass('active');
  });

  it('should apply custom active class', () => {
    render(
      <MemoryRouter initialEntries={['/recipes']}>
        <NavLink to="/recipes" activeClassName="custom-active">
          Recipes
        </NavLink>
      </MemoryRouter>
    );

    const link = screen.getByText('Recipes');
    expect(link).toHaveClass('custom-active');
  });
});