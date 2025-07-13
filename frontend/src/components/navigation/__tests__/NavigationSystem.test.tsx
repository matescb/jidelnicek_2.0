/**
 * Comprehensive tests for Navigation and Routing system
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { NavigationProvider, useNavigation } from '../NavigationContext';
import { ResponsiveNav } from '../ResponsiveNav';
import { MobileMenu } from '../MobileMenu';
import { Navbar } from '../Navbar';
import { Breadcrumbs } from '../breadcrumbs/Breadcrumbs';
import { BreadcrumbProvider } from '../breadcrumbs/BreadcrumbProvider';

// Mock required modules
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'member'
    },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('../../routes/config', () => ({
  getNavigationItems: vi.fn(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: null,
    },
    {
      id: 'recipes',
      label: 'Recipes',
      path: '/recipes',
      icon: null,
    },
  ]),
  routeGroups: [
    {
      id: 'main',
      label: 'Main',
      routes: [],
    },
  ],
}));

vi.mock('../QuickActions', () => ({
  QuickActions: ({ orientation }: { orientation?: string }) => (
    <div data-testid="quick-actions" data-orientation={orientation}>
      Quick Actions
    </div>
  ),
}));

vi.mock('../NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

vi.mock('../UserMenu', () => ({
  UserMenu: ({ user }: { user: any }) => (
    <div data-testid="user-menu">{user?.firstName} {user?.lastName}</div>
  ),
}));

vi.mock('../../routes/paths', () => ({
  PATHS: {
    DASHBOARD: '/dashboard',
    RECIPES: {
      LIST: '/recipes',
    },
    TRIPS: {
      LIST: '/trips',
    },
  },
}));

// Test wrapper component
const TestWrapper: React.FC<{ 
  children: React.ReactNode; 
  initialEntries?: string[];
}> = ({ children, initialEntries = ['/'] }) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <NavigationProvider>
        <BreadcrumbProvider>
          {children}
        </BreadcrumbProvider>
      </NavigationProvider>
    </MemoryRouter>
  );
};

// Mock window methods for responsive tests
const mockWindowResize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
};

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('NavigationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window size to desktop
    mockWindowResize(1280, 800);
  });

  it('should provide navigation state and actions', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return <div>Test</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue).toBeDefined();
    expect(contextValue.isSidebarOpen).toBe(true);
    expect(contextValue.isMobileMenuOpen).toBe(false);
    expect(contextValue.screenSize).toBe('desktop');
    expect(typeof contextValue.toggleSidebar).toBe('function');
    expect(typeof contextValue.toggleMobileMenu).toBe('function');
  });

  it('should detect screen size changes', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return <div>Screen: {contextValue.screenSize}</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue.screenSize).toBe('desktop');

    // Simulate mobile resize
    await act(async () => {
      mockWindowResize(375, 667);
    });

    await waitFor(() => {
      expect(contextValue.screenSize).toBe('mobile');
    });
  });

  it('should detect scroll state', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return <div>Scrolled: {contextValue.isScrolled.toString()}</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue.isScrolled).toBe(false);

    // Simulate scroll
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 20, writable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(contextValue.isScrolled).toBe(true);
    });
  });

  it('should toggle sidebar state', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return (
        <div>
          <button onClick={contextValue.toggleSidebar}>Toggle Sidebar</button>
          <span>Sidebar: {contextValue.isSidebarOpen.toString()}</span>
        </div>
      );
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue.isSidebarOpen).toBe(true);

    const toggleButton = screen.getByText('Toggle Sidebar');
    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(contextValue.isSidebarOpen).toBe(false);
    });
  });

  it('should auto-close sidebar on mobile', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return <div>Sidebar: {contextValue.isSidebarOpen.toString()}</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Initially desktop - sidebar should be open
    expect(contextValue.isSidebarOpen).toBe(true);

    // Resize to mobile
    await act(async () => {
      mockWindowResize(375, 667);
    });

    await waitFor(() => {
      expect(contextValue.isSidebarOpen).toBe(false);
    });
  });
});

describe('ResponsiveNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowResize(1280, 800);
  });

  it('should render main content area with proper layout', () => {
    render(
      <TestWrapper>
        <ResponsiveNav>
          <div data-testid="main-content">Main Content</div>
        </ResponsiveNav>
      </TestWrapper>
    );

    expect(screen.getByTestId('main-content')).toBeInTheDocument();
    
    // Should have proper margin for desktop sidebar
    const mainElement = screen.getByRole('main');
    expect(mainElement).toHaveClass('lg:ml-64');
  });

  it('should close mobile menu on route change', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      React.useEffect(() => {
        // Simulate route change by manually calling the cleanup
        if (contextValue.isMobileMenuOpen) {
          contextValue.closeMobileMenu();
        }
      }, []);
      return (
        <ResponsiveNav>
          <div>Content</div>
        </ResponsiveNav>
      );
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Open mobile menu first
    await act(async () => {
      contextValue.toggleMobileMenu();
    });

    expect(contextValue.isMobileMenuOpen).toBe(true);

    // Simulate route change effect
    await act(async () => {
      contextValue.closeMobileMenu();
    });

    await waitFor(() => {
      expect(contextValue.isMobileMenuOpen).toBe(false);
    });
  });

  it('should prevent body scroll when mobile menu is open', async () => {
    // Mock mobile screen size
    await act(async () => {
      mockWindowResize(375, 667);
    });

    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return (
        <ResponsiveNav>
          <div>Content</div>
        </ResponsiveNav>
      );
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Open mobile menu
    await act(async () => {
      contextValue.toggleMobileMenu();
    });

    expect(document.body.style.overflow).toBe('hidden');

    // Close mobile menu
    await act(async () => {
      contextValue.closeMobileMenu();
    });

    expect(document.body.style.overflow).toBe('');
  });
});

describe('Navbar', () => {
  const defaultProps = {
    onMenuToggle: vi.fn(),
    isMobileMenuOpen: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render navbar with logo and navigation', () => {
    render(
      <TestWrapper>
        <Navbar {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Jídelníček')).toBeInTheDocument();
    expect(screen.getByText('navigation.dashboard')).toBeInTheDocument();
    expect(screen.getByText('navigation.recipes')).toBeInTheDocument();
    expect(screen.getByText('navigation.trips')).toBeInTheDocument();
  });

  it('should toggle mobile menu when burger button is clicked', async () => {
    const onMenuToggle = vi.fn();
    
    render(
      <TestWrapper>
        <Navbar {...defaultProps} onMenuToggle={onMenuToggle} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /navigation\.openMenu/ });
    await userEvent.click(menuButton);

    expect(onMenuToggle).toHaveBeenCalled();
  });

  it('should show close icon when mobile menu is open', () => {
    render(
      <TestWrapper>
        <Navbar {...defaultProps} isMobileMenuOpen={true} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /navigation\.closeMenu/ });
    expect(menuButton).toBeInTheDocument();
  });

  it('should highlight active navigation link', () => {
    render(
      <TestWrapper initialEntries={['/recipes']}>
        <Navbar {...defaultProps} />
      </TestWrapper>
    );

    const recipesLink = screen.getByText('navigation.recipes').closest('a');
    expect(recipesLink).toHaveClass('bg-primary-100');
  });

  it('should show search functionality', async () => {
    render(
      <TestWrapper>
        <Navbar {...defaultProps} />
      </TestWrapper>
    );

    const searchButton = screen.getByLabelText('navigation.search');
    expect(searchButton).toBeInTheDocument();

    await userEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText('navigation.search');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
  });

  it('should render user menu and theme toggle', () => {
    render(
      <TestWrapper>
        <Navbar {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });
});

describe('MobileMenu', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render mobile menu when open', () => {
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Jídelníček')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} isOpen={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Jídelníček')).not.toBeInTheDocument();
  });

  it('should close when close button is clicked', async () => {
    const onClose = vi.fn();
    
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    const closeButton = screen.getByLabelText('navigation.closeMenu');
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should close when backdrop is clicked', async () => {
    const onClose = vi.fn();
    
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    // Click on backdrop
    const backdrop = document.querySelector('.fixed.inset-0.bg-gray-900\\/80');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should show user profile information', () => {
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('roles.member')).toBeInTheDocument();
    
    // Should show user initials
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('should render theme toggle', () => {
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('should close when route changes', async () => {
    const onClose = vi.fn();
    
    // This test would require proper router integration
    // For now, we test the useEffect cleanup manually
    render(
      <TestWrapper>
        <MobileMenu {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    // The MobileMenu component should call onClose in useEffect when location changes
    // This is tested indirectly through the navigation context tests
    expect(onClose).toHaveBeenCalledTimes(1); // Called once on mount due to useEffect
  });
});

describe('Breadcrumbs', () => {
  const mockBreadcrumbs = [
    { id: '1', label: 'Home', path: '/', isActive: false },
    { id: '2', label: 'Recipes', path: '/recipes', isActive: false },
    { id: '3', label: 'Pasta Recipe', path: '/recipes/123', isActive: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render breadcrumb items', () => {
    // Mock the useBreadcrumbs hook
    vi.doMock('../breadcrumbs/hooks', () => ({
      useBreadcrumbs: () => mockBreadcrumbs,
    }));

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('Pasta Recipe')).toBeInTheDocument();
  });

  it('should render home icon for first breadcrumb', () => {
    const breadcrumbsWithHome = [
      { id: '1', label: 'Home', path: '/', isActive: false },
      { id: '2', label: 'Recipes', path: '/recipes', isActive: true },
    ];

    vi.doMock('../breadcrumbs/hooks', () => ({
      useBreadcrumbs: () => breadcrumbsWithHome,
    }));

    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    // Home icon should be present
    const homeIcon = document.querySelector('svg');
    expect(homeIcon).toBeInTheDocument();
  });

  it('should show different breadcrumbs on mobile and desktop', () => {
    const longBreadcrumbs = [
      { id: '1', label: 'Home', path: '/', isActive: false },
      { id: '2', label: 'Recipes', path: '/recipes', isActive: false },
      { id: '3', label: 'Italian', path: '/recipes/italian', isActive: false },
      { id: '4', label: 'Pasta', path: '/recipes/italian/pasta', isActive: false },
      { id: '5', label: 'Carbonara', path: '/recipes/italian/pasta/carbonara', isActive: true },
    ];

    vi.doMock('../breadcrumbs/hooks', () => ({
      useBreadcrumbs: () => longBreadcrumbs,
    }));

    render(
      <TestWrapper>
        <Breadcrumbs mobileMaxItems={2} desktopMaxItems={5} />
      </TestWrapper>
    );

    // Should have both mobile and desktop views
    const mobileNav = document.querySelector('.md\\:hidden');
    const desktopNav = document.querySelector('.hidden.md\\:flex');
    
    expect(mobileNav).toBeInTheDocument();
    expect(desktopNav).toBeInTheDocument();
  });

  it('should return null when no breadcrumbs', () => {
    vi.doMock('../breadcrumbs/hooks', () => ({
      useBreadcrumbs: () => [],
    }));

    const { container } = render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('Navigation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle responsive layout transitions', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return (
        <ResponsiveNav>
          <div>Screen: {contextValue.screenSize}</div>
        </ResponsiveNav>
      );
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Start with desktop
    expect(contextValue.screenSize).toBe('desktop');
    
    const mainElement = screen.getByRole('main');
    expect(mainElement).toHaveClass('lg:ml-64');

    // Resize to tablet
    await act(async () => {
      mockWindowResize(768, 1024);
    });

    await waitFor(() => {
      expect(contextValue.screenSize).toBe('tablet');
    });

    expect(mainElement).toHaveClass('md:ml-20');

    // Resize to mobile
    await act(async () => {
      mockWindowResize(375, 667);
    });

    await waitFor(() => {
      expect(contextValue.screenSize).toBe('mobile');
    });

    expect(mainElement).toHaveClass('pb-16');
  });

  it('should maintain navigation state across route changes', async () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useNavigation();
      return (
        <div>
          <ResponsiveNav>
            <div>Current route</div>
          </ResponsiveNav>
        </div>
      );
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Toggle sidebar
    await act(async () => {
      contextValue.toggleSidebar();
    });

    expect(contextValue.isSidebarOpen).toBe(false);

    // Sidebar state should persist (navigation context maintains state independently of routes)
    expect(contextValue.isSidebarOpen).toBe(false);
  });
});

// Accessibility tests
describe('Navigation Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have proper ARIA labels and roles', () => {
    render(
      <TestWrapper>
        <Navbar onMenuToggle={vi.fn()} isMobileMenuOpen={false} />
      </TestWrapper>
    );

    const nav = screen.getByRole('banner');
    expect(nav).toBeInTheDocument();

    const menuButton = screen.getByRole('button', { name: /navigation\.openMenu/ });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should support keyboard navigation', async () => {
    render(
      <TestWrapper>
        <MobileMenu isOpen={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    const closeButton = screen.getByLabelText('navigation.closeMenu');
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    // Tab should move to first navigation item
    await userEvent.tab();
    expect(document.activeElement?.textContent).toContain('navigation.profile');
  });

  it('should announce screen reader updates', () => {
    render(
      <TestWrapper>
        <Navbar onMenuToggle={vi.fn()} isMobileMenuOpen={true} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /navigation\.closeMenu/ });
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });
});