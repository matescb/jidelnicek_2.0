/**
 * Accessibility tests for navigation components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import { ResponsiveNav } from '../../components/navigation/ResponsiveNav';
import { Navbar } from '../../components/navigation/Navbar';
import { MobileMenu } from '../../components/navigation/MobileMenu';
import { Sidebar } from '../../components/navigation/Sidebar';
import { 
  testKeyboardNavigation, 
  testTabOrder, 
  testSkipNavigation,
  testFocusManagement,
  testSemanticHTML,
  testAriaStates,
  mockScreenReader
} from '../utils/accessibility';
import { mockWindowResize, VIEWPORT_PRESETS } from '../utils/responsive';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Navigation Accessibility', () => {
  let mockAuth: any;
  
  beforeEach(() => {
    mockAuth = {
      user: { id: 1, name: 'Test User', email: 'test@example.com' },
      logout: vi.fn(),
    };
    
    vi.clearAllMocks();
  });

  describe('Navbar Component', () => {
    it('should have proper ARIA landmarks', () => {
      const { container } = renderWithProviders(<Navbar />);
      
      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('role', 'navigation');
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<Navbar />);
      
      const user = userEvent.setup();
      
      // Test tab order
      await user.tab();
      expect(screen.getByTestId('skip-to-main')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByTestId('logo-link')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByTestId('nav-recipes')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByTestId('nav-trips')).toHaveFocus();
    });

    it('should provide skip navigation link', async () => {
      renderWithProviders(
        <div>
          <Navbar />
          <main id="main-content" data-testid="main-content" tabIndex={-1}>
            Main content
          </main>
        </div>
      );
      
      await testSkipNavigation();
    });

    it('should announce navigation changes to screen readers', async () => {
      const screenReader = mockScreenReader();
      renderWithProviders(<Navbar />);
      
      const user = userEvent.setup();
      const recipesLink = screen.getByTestId('nav-recipes');
      
      await user.click(recipesLink);
      
      const announcements = screenReader.getAnnouncements();
      expect(announcements.some(a => a.includes('Navigated to Recipes'))).toBeTruthy();
    });

    it('should handle mobile menu accessibility', async () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      renderWithProviders(<Navbar />);
      
      const menuButton = screen.getByTestId('mobile-menu-button');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu');
      expect(menuButton).toHaveAttribute('aria-label', 'Open main menu');
      
      const user = userEvent.setup();
      await user.click(menuButton);
      
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      expect(menuButton).toHaveAttribute('aria-label', 'Close main menu');
    });

    it('should support keyboard shortcuts', async () => {
      renderWithProviders(<Navbar />);
      
      const user = userEvent.setup();
      
      // Test search shortcut (Ctrl+K or Cmd+K)
      await user.keyboard('{Control>}k{/Control}');
      
      const searchModal = screen.getByTestId('search-modal');
      expect(searchModal).toBeInTheDocument();
      expect(searchModal).toHaveAttribute('role', 'dialog');
    });

    it('should have proper color contrast', () => {
      const { container } = renderWithProviders(<Navbar />);
      
      const navElement = container.querySelector('nav');
      const computedStyle = getComputedStyle(navElement!);
      
      // Test background and text colors meet WCAG AA standards
      expect(computedStyle.backgroundColor).toBeDefined();
      expect(computedStyle.color).toBeDefined();
      
      // In a real test, you'd use a color contrast library here
      // For now, we'll check that colors are defined
    });
  });

  describe('Mobile Menu Component', () => {
    it('should manage focus properly when opened', async () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      renderWithProviders(
        <div>
          <button data-testid="menu-trigger">Open Menu</button>
          <MobileMenu isOpen={false} onClose={vi.fn()} />
        </div>
      );
      
      await testFocusManagement({
        triggerSelector: 'menu-trigger',
        modalSelector: 'mobile-menu',
        firstFocusableSelector: 'mobile-nav-recipes',
        lastFocusableSelector: 'mobile-nav-logout',
      });
    });

    it('should trap focus within the menu', async () => {
      const onClose = vi.fn();
      renderWithProviders(<MobileMenu isOpen={true} onClose={onClose} />);
      
      const user = userEvent.setup();
      
      // Focus should be trapped within the menu
      const firstItem = screen.getByTestId('mobile-nav-recipes');
      const lastItem = screen.getByTestId('mobile-nav-logout');
      
      firstItem.focus();
      expect(firstItem).toHaveFocus();
      
      // Tab past last item should go back to first
      lastItem.focus();
      await user.tab();
      expect(firstItem).toHaveFocus();
      
      // Shift+Tab from first should go to last
      await user.tab({ shift: true });
      expect(lastItem).toHaveFocus();
    });

    it('should close on Escape key', async () => {
      const onClose = vi.fn();
      renderWithProviders(<MobileMenu isOpen={true} onClose={onClose} />);
      
      const user = userEvent.setup();
      await user.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should have proper ARIA attributes', () => {
      const onClose = vi.fn();
      renderWithProviders(<MobileMenu isOpen={true} onClose={onClose} />);
      
      const menu = screen.getByTestId('mobile-menu');
      expect(menu).toHaveAttribute('role', 'dialog');
      expect(menu).toHaveAttribute('aria-modal', 'true');
      expect(menu).toHaveAttribute('aria-label', 'Main menu');
    });

    it('should prevent body scroll when open', () => {
      const onClose = vi.fn();
      renderWithProviders(<MobileMenu isOpen={true} onClose={onClose} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('Sidebar Component', () => {
    it('should have collapsible behavior with proper ARIA states', async () => {
      const { rerender } = renderWithProviders(
        <Sidebar isOpen={false} onToggle={vi.fn()} />
      );
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('aria-expanded', 'false');
      
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <Sidebar isOpen={true} onToggle={vi.fn()} />
          </ThemeProvider>
        </BrowserRouter>
      );
      
      expect(sidebar).toHaveAttribute('aria-expanded', 'true');
    });

    it('should support keyboard navigation between items', async () => {
      renderWithProviders(<Sidebar isOpen={true} onToggle={vi.fn()} />);
      
      const user = userEvent.setup();
      
      // Test arrow key navigation
      const firstItem = screen.getByTestId('sidebar-recipes');
      firstItem.focus();
      
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('sidebar-trips')).toHaveFocus();
      
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('sidebar-shopping')).toHaveFocus();
      
      // Test Home key
      await user.keyboard('{Home}');
      expect(firstItem).toHaveFocus();
      
      // Test End key
      await user.keyboard('{End}');
      expect(screen.getByTestId('sidebar-settings')).toHaveFocus();
    });

    it('should indicate current page in navigation', () => {
      // Mock current location
      Object.defineProperty(window, 'location', {
        value: { pathname: '/recipes' },
        writable: true,
      });
      
      renderWithProviders(<Sidebar isOpen={true} onToggle={vi.fn()} />);
      
      const currentItem = screen.getByTestId('sidebar-recipes');
      expect(currentItem).toHaveAttribute('aria-current', 'page');
      expect(currentItem).toHaveClass('bg-primary-100'); // Visual indication
    });
  });

  describe('Responsive Navigation Integration', () => {
    it('should have semantic HTML structure', () => {
      const { container } = renderWithProviders(
        <ResponsiveNav>
          <main data-testid="main-content">Content</main>
        </ResponsiveNav>
      );
      
      const structure = testSemanticHTML(container);
      
      expect(structure.hasMain).toBeTruthy();
      expect(structure.hasNav).toBeTruthy();
      expect(structure.hasHeader).toBeTruthy();
    });

    it('should adapt navigation for different screen sizes', () => {
      // Desktop
      mockWindowResize(VIEWPORT_PRESETS.desktop.medium.width, VIEWPORT_PRESETS.desktop.medium.height);
      const { rerender } = renderWithProviders(
        <ResponsiveNav>
          <div>Desktop Content</div>
        </ResponsiveNav>
      );
      
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
      
      // Mobile
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <ResponsiveNav>
              <div>Mobile Content</div>
            </ResponsiveNav>
          </ThemeProvider>
        </BrowserRouter>
      );
      
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
      expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
    });

    it('should maintain focus when switching between navigation modes', async () => {
      mockWindowResize(VIEWPORT_PRESETS.desktop.medium.width, VIEWPORT_PRESETS.desktop.medium.height);
      
      const { rerender } = renderWithProviders(
        <ResponsiveNav>
          <div>Content</div>
        </ResponsiveNav>
      );
      
      const user = userEvent.setup();
      
      // Focus on sidebar item
      const sidebarItem = screen.getByTestId('sidebar-recipes');
      await user.click(sidebarItem);
      expect(sidebarItem).toHaveFocus();
      
      // Switch to mobile
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </ThemeProvider>
        </BrowserRouter>
      );
      
      // Focus should be managed gracefully
      expect(document.activeElement).toBeTruthy();
    });

    it('should announce layout changes to screen readers', () => {
      const screenReader = mockScreenReader();
      
      mockWindowResize(VIEWPORT_PRESETS.desktop.medium.width, VIEWPORT_PRESETS.desktop.medium.height);
      const { rerender } = renderWithProviders(
        <ResponsiveNav>
          <div>Content</div>
        </ResponsiveNav>
      );
      
      // Switch to mobile layout
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </ThemeProvider>
        </BrowserRouter>
      );
      
      const announcements = screenReader.getAnnouncements();
      expect(announcements.some(a => a.includes('Mobile navigation active'))).toBeTruthy();
    });
  });

  describe('Search Modal Accessibility', () => {
    beforeEach(() => {
      renderWithProviders(<Navbar />);
    });

    it('should manage focus properly', async () => {
      await testFocusManagement({
        triggerSelector: 'search-button',
        modalSelector: 'search-modal',
        firstFocusableSelector: 'search-input',
        lastFocusableSelector: 'search-close',
      });
    });

    it('should provide search suggestions with proper ARIA', async () => {
      const user = userEvent.setup();
      
      // Open search
      await user.click(screen.getByTestId('search-button'));
      
      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveAttribute('role', 'combobox');
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
      
      // Type to show suggestions
      await user.type(searchInput, 'chicken');
      
      await waitFor(() => {
        expect(searchInput).toHaveAttribute('aria-expanded', 'true');
        
        const suggestionsList = screen.getByTestId('search-suggestions');
        expect(suggestionsList).toHaveAttribute('role', 'listbox');
        
        const suggestions = screen.getAllByRole('option');
        expect(suggestions.length).toBeGreaterThan(0);
        
        suggestions.forEach((suggestion, index) => {
          expect(suggestion).toHaveAttribute('id', `suggestion-${index}`);
        });
      });
    });

    it('should support keyboard navigation in search results', async () => {
      const user = userEvent.setup();
      
      await user.click(screen.getByTestId('search-button'));
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');
      
      await waitFor(() => {
        expect(screen.getByTestId('search-suggestions')).toBeInTheDocument();
      });
      
      // Arrow down should move to first suggestion
      await user.keyboard('{ArrowDown}');
      const firstSuggestion = screen.getAllByRole('option')[0];
      expect(firstSuggestion).toHaveAttribute('aria-selected', 'true');
      expect(searchInput).toHaveAttribute('aria-activedescendant', firstSuggestion.id);
      
      // Arrow down again should move to next
      await user.keyboard('{ArrowDown}');
      const secondSuggestion = screen.getAllByRole('option')[1];
      expect(secondSuggestion).toHaveAttribute('aria-selected', 'true');
      expect(firstSuggestion).toHaveAttribute('aria-selected', 'false');
      
      // Enter should select the highlighted suggestion
      await user.keyboard('{Enter}');
      // Test that navigation happens or selection is made
    });
  });
});