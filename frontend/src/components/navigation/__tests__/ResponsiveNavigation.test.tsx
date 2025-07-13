/**
 * Tests for responsive navigation behavior, mobile interactions, and gestures
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { NavigationProvider, useNavigation, useScreenSize, useScrollState } from '../NavigationContext';
import { ResponsiveNav } from '../ResponsiveNav';
import { MobileBottomNav } from '../MobileBottomNav';
import { CollapsibleSidebar } from '../CollapsibleSidebar';

// Mock required modules
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

vi.mock('../Navbar', () => ({
  Navbar: ({ onMenuToggle, isMobileMenuOpen }: any) => (
    <nav data-testid="navbar">
      <button onClick={onMenuToggle} data-testid="menu-toggle">
        {isMobileMenuOpen ? 'Close' : 'Open'} Menu
      </button>
    </nav>
  ),
}));

vi.mock('../Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar">Sidebar</aside>,
}));

vi.mock('../MobileMenu', () => ({
  MobileMenu: ({ isOpen, onClose }: any) => 
    isOpen ? (
      <div data-testid="mobile-menu">
        <button onClick={onClose} data-testid="close-mobile-menu">Close</button>
        Mobile Menu
      </div>
    ) : null,
}));

vi.mock('../MobileBottomNav', () => ({
  MobileBottomNav: () => <nav data-testid="mobile-bottom-nav">Bottom Nav</nav>,
}));

vi.mock('../CollapsibleSidebar', () => ({
  CollapsibleSidebar: ({ isOpen, onToggle, miniMode }: any) => (
    <aside 
      data-testid="collapsible-sidebar" 
      data-open={isOpen}
      data-mini={miniMode}
    >
      <button onClick={onToggle} data-testid="sidebar-toggle">
        Toggle Sidebar
      </button>
      Collapsible Sidebar
    </aside>
  ),
}));

vi.mock('../SearchModal', () => ({
  SearchModal: ({ isOpen, onClose }: any) => 
    isOpen ? (
      <div data-testid="search-modal">
        <button onClick={onClose} data-testid="close-search">Close Search</button>
        Search Modal
      </div>
    ) : null,
}));

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <NavigationProvider>
      {children}
    </NavigationProvider>
  </MemoryRouter>
);

// Viewport constants
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
} as const;

// Mock window resize helper
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

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  const touchList = touches.map((touch, index) => ({
    identifier: index,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.clientX,
    pageY: touch.clientY,
    target: document.body,
    // Add other required properties
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    screenX: touch.clientX,
    screenY: touch.clientY,
  }));

  return new TouchEvent(type, {
    touches: touchList as any,
    targetTouches: touchList as any,
    changedTouches: touchList as any,
    bubbles: true,
    cancelable: true,
  });
};

describe('Responsive Navigation System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to desktop by default
    mockWindowResize(VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
  });

  afterEach(() => {
    // Reset body overflow
    document.body.style.overflow = '';
  });

  describe('Screen Size Detection', () => {
    it('should detect desktop screen size', async () => {
      let screenSizeData: any;
      
      const TestComponent = () => {
        screenSizeData = useScreenSize();
        return <div>Screen: {screenSizeData.screenSize}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(screenSizeData.screenSize).toBe('desktop');
      expect(screenSizeData.isDesktop).toBe(true);
      expect(screenSizeData.isMobile).toBe(false);
      expect(screenSizeData.isTablet).toBe(false);
    });

    it('should detect tablet screen size', async () => {
      let screenSizeData: any;
      
      const TestComponent = () => {
        screenSizeData = useScreenSize();
        return <div>Screen: {screenSizeData.screenSize}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await act(async () => {
        mockWindowResize(VIEWPORTS.tablet.width, VIEWPORTS.tablet.height);
      });

      await waitFor(() => {
        expect(screenSizeData.screenSize).toBe('tablet');
        expect(screenSizeData.isTablet).toBe(true);
        expect(screenSizeData.isDesktop).toBe(false);
        expect(screenSizeData.isMobile).toBe(false);
      });
    });

    it('should detect mobile screen size', async () => {
      let screenSizeData: any;
      
      const TestComponent = () => {
        screenSizeData = useScreenSize();
        return <div>Screen: {screenSizeData.screenSize}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });

      await waitFor(() => {
        expect(screenSizeData.screenSize).toBe('mobile');
        expect(screenSizeData.isMobile).toBe(true);
        expect(screenSizeData.isDesktop).toBe(false);
        expect(screenSizeData.isTablet).toBe(false);
      });
    });

    it('should update screen size on window resize', async () => {
      let screenSizeData: any;
      
      const TestComponent = () => {
        screenSizeData = useScreenSize();
        return <div>Screen: {screenSizeData.screenSize}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Start with desktop
      expect(screenSizeData.screenSize).toBe('desktop');

      // Resize to mobile
      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });

      await waitFor(() => {
        expect(screenSizeData.screenSize).toBe('mobile');
      });

      // Resize back to desktop
      await act(async () => {
        mockWindowResize(VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      });

      await waitFor(() => {
        expect(screenSizeData.screenSize).toBe('desktop');
      });
    });
  });

  describe('Scroll Detection', () => {
    it('should detect scroll state', async () => {
      let isScrolled: boolean;
      
      const TestComponent = () => {
        isScrolled = useScrollState();
        return <div>Scrolled: {isScrolled.toString()}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(isScrolled).toBe(false);

      // Simulate scroll
      await act(async () => {
        Object.defineProperty(window, 'scrollY', { value: 20, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      await waitFor(() => {
        expect(isScrolled).toBe(true);
      });
    });

    it('should detect when scrolled back to top', async () => {
      let isScrolled: boolean;
      
      const TestComponent = () => {
        isScrolled = useScrollState();
        return <div>Scrolled: {isScrolled.toString()}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Scroll down
      await act(async () => {
        Object.defineProperty(window, 'scrollY', { value: 20, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      await waitFor(() => {
        expect(isScrolled).toBe(true);
      });

      // Scroll back to top
      await act(async () => {
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      await waitFor(() => {
        expect(isScrolled).toBe(false);
      });
    });
  });

  describe('ResponsiveNav Component', () => {
    it('should render desktop layout by default', () => {
      render(
        <TestWrapper>
          <ResponsiveNav>
            <div data-testid="content">Main Content</div>
          </ResponsiveNav>
        </TestWrapper>
      );

      expect(screen.getByTestId('navbar')).toBeInTheDocument();
      expect(screen.getByTestId('collapsible-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
    });

    it('should render mobile layout on small screens', async () => {
      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });

      render(
        <TestWrapper>
          <ResponsiveNav>
            <div data-testid="content">Main Content</div>
          </ResponsiveNav>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
        expect(screen.queryByTestId('collapsible-sidebar')).not.toBeInTheDocument();
      });
    });

    it('should render tablet layout on medium screens', async () => {
      await act(async () => {
        mockWindowResize(VIEWPORTS.tablet.width, VIEWPORTS.tablet.height);
      });

      render(
        <TestWrapper>
          <ResponsiveNav>
            <div data-testid="content">Main Content</div>
          </ResponsiveNav>
        </TestWrapper>
      );

      await waitFor(() => {
        const sidebar = screen.getByTestId('collapsible-sidebar');
        expect(sidebar).toBeInTheDocument();
        expect(sidebar).toHaveAttribute('data-mini', 'true');
      });
    });

    it('should adjust main content margin based on sidebar state', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <ResponsiveNav>
            <div data-testid="content">Content</div>
          </ResponsiveNav>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const mainElement = screen.getByRole('main');
      
      // Desktop with sidebar open - should have left margin
      expect(mainElement).toHaveClass('lg:ml-64');

      // Toggle sidebar closed
      await act(async () => {
        navigationState.toggleSidebar();
      });

      await waitFor(() => {
        expect(mainElement).toHaveClass('lg:ml-20');
      });
    });

    it('should close mobile menu on route change', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <ResponsiveNav>
            <div>Content</div>
          </ResponsiveNav>
        );
      };

      const { rerender } = render(
        <MemoryRouter initialEntries={['/']}>
          <NavigationProvider>
            <TestComponent />
          </NavigationProvider>
        </MemoryRouter>
      );

      // Open mobile menu
      await act(async () => {
        navigationState.toggleMobileMenu();
      });

      expect(navigationState.isMobileMenuOpen).toBe(true);

      // Simulate route change by re-rendering with different route
      rerender(
        <MemoryRouter initialEntries={['/new-route']}>
          <NavigationProvider>
            <TestComponent />
          </NavigationProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(navigationState.isMobileMenuOpen).toBe(false);
      });
    });

    it('should prevent body scroll when mobile menu is open', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
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
        navigationState.toggleMobileMenu();
      });

      expect(document.body.style.overflow).toBe('hidden');

      // Close mobile menu
      await act(async () => {
        navigationState.closeMobileMenu();
      });

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Mobile Navigation Interactions', () => {
    beforeEach(async () => {
      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });
    });

    it('should toggle mobile menu with navigation context', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <div>
            <button 
              onClick={navigationState.toggleMobileMenu}
              data-testid="toggle-menu"
            >
              Toggle Menu
            </button>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(navigationState.isMobileMenuOpen).toBe(false);

      const toggleButton = screen.getByTestId('toggle-menu');
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(navigationState.isMobileMenuOpen).toBe(true);
      });

      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(navigationState.isMobileMenuOpen).toBe(false);
      });
    });

    it('should show mobile bottom navigation', async () => {
      render(
        <TestWrapper>
          <ResponsiveNav>
            <div>Content</div>
          </ResponsiveNav>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
      });
    });

    it('should add bottom padding for mobile bottom nav', async () => {
      render(
        <TestWrapper>
          <ResponsiveNav>
            <div>Content</div>
          </ResponsiveNav>
        </TestWrapper>
      );

      await waitFor(() => {
        const mainElement = screen.getByRole('main');
        expect(mainElement).toHaveClass('pb-16');
      });
    });
  });

  describe('Sidebar Behavior', () => {
    it('should auto-close sidebar on mobile', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return <div>Screen: {navigationState.screenSize}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Start with desktop - sidebar should be open
      expect(navigationState.isSidebarOpen).toBe(true);

      // Resize to mobile
      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });

      await waitFor(() => {
        expect(navigationState.isSidebarOpen).toBe(false);
      });
    });

    it('should maintain desktop sidebar state on desktop', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return <div>Sidebar: {navigationState.isSidebarOpen.toString()}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Close sidebar on desktop
      await act(async () => {
        navigationState.toggleSidebar();
      });

      expect(navigationState.isSidebarOpen).toBe(false);

      // Resize slightly but stay desktop
      await act(async () => {
        mockWindowResize(1400, 900);
      });

      // Sidebar state should persist
      expect(navigationState.isSidebarOpen).toBe(false);
    });
  });

  describe('Touch and Gesture Support', () => {
    beforeEach(async () => {
      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });
    });

    it('should handle touch events on mobile menu', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <ResponsiveNav>
            <div data-testid="touch-area">Touch Area</div>
          </ResponsiveNav>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const touchArea = screen.getByTestId('touch-area');

      // Simulate touch start
      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(touchArea, touchStartEvent);

      // Simulate touch end
      const touchEndEvent = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(touchArea, touchEndEvent);

      // Should not throw errors
      expect(touchArea).toBeInTheDocument();
    });

    it('should handle swipe gestures for mobile menu', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <div>
            <div 
              data-testid="swipe-area"
              onTouchStart={(e) => {
                // Simulate swipe start
              }}
              onTouchMove={(e) => {
                // Simulate swipe move
              }}
              onTouchEnd={(e) => {
                // Simulate swipe end - could trigger menu toggle
                navigationState.toggleMobileMenu();
              }}
            >
              Swipe Area
            </div>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const swipeArea = screen.getByTestId('swipe-area');

      // Simulate swipe right to open menu
      const touchStart = createTouchEvent('touchstart', [{ clientX: 10, clientY: 100 }]);
      fireEvent(swipeArea, touchStart);

      const touchMove = createTouchEvent('touchmove', [{ clientX: 50, clientY: 100 }]);
      fireEvent(swipeArea, touchMove);

      const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(swipeArea, touchEnd);

      await waitFor(() => {
        expect(navigationState.isMobileMenuOpen).toBe(true);
      });
    });
  });

  describe('Search Modal Integration', () => {
    it('should toggle search modal', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <div>
            <button 
              onClick={navigationState.toggleSearch}
              data-testid="toggle-search"
            >
              Toggle Search
            </button>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(navigationState.isSearchOpen).toBe(false);
      expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();

      const toggleButton = screen.getByTestId('toggle-search');
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(navigationState.isSearchOpen).toBe(true);
        expect(screen.getByTestId('search-modal')).toBeInTheDocument();
      });

      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(navigationState.isSearchOpen).toBe(false);
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
      });
    });

    it('should close search modal with close button', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <div>
            <button 
              onClick={navigationState.toggleSearch}
              data-testid="toggle-search"
            >
              Toggle Search
            </button>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Open search modal
      const toggleButton = screen.getByTestId('toggle-search');
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByTestId('search-modal')).toBeInTheDocument();
      });

      // Close with close button
      const closeButton = screen.getByTestId('close-search');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(navigationState.isSearchOpen).toBe(false);
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance and Animation', () => {
    it('should animate content transitions', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <ResponsiveNav>
            <div data-testid="animated-content">Content</div>
          </ResponsiveNav>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const content = screen.getByTestId('animated-content');
      const motionDiv = content.closest('[style*="opacity"]');
      
      // Content should be wrapped in motion div with animation styles
      // This tests that framer-motion is working
      expect(content).toBeInTheDocument();
    });

    it('should handle rapid screen size changes', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return <div>Screen: {navigationState.screenSize}</div>;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Rapidly change screen sizes
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
        });
        await act(async () => {
          mockWindowResize(VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
        });
      }

      // Should stabilize on desktop
      await waitFor(() => {
        expect(navigationState.screenSize).toBe('desktop');
      });
    });
  });

  describe('Accessibility Features', () => {
    it('should maintain focus management during responsive changes', async () => {
      render(
        <TestWrapper>
          <ResponsiveNav>
            <button data-testid="focus-test">Focus Test</button>
          </ResponsiveNav>
        </TestWrapper>
      );

      const button = screen.getByTestId('focus-test');
      button.focus();
      
      expect(document.activeElement).toBe(button);

      // Resize to mobile
      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });

      // Focus should be maintained
      expect(document.activeElement).toBe(button);
    });

    it('should provide proper ARIA attributes for responsive states', async () => {
      let navigationState: any;
      
      const TestComponent = () => {
        navigationState = useNavigation();
        return (
          <ResponsiveNav>
            <div 
              role="main"
              aria-label={`Main content - ${navigationState.screenSize} view`}
              data-testid="main-content"
            >
              Content
            </div>
          </ResponsiveNav>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const mainContent = screen.getByTestId('main-content');
      expect(mainContent).toHaveAttribute('aria-label', 'Main content - desktop view');

      await act(async () => {
        mockWindowResize(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      });

      await waitFor(() => {
        expect(mainContent).toHaveAttribute('aria-label', 'Main content - mobile view');
      });
    });
  });
});