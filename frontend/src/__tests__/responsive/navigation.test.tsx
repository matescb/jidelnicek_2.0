import { vi } from 'vitest';
/**
 * Tests for responsive navigation components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import {
  ResponsiveNav,
  MobileMenu,
  Sidebar,
  SearchModal,
} from '../../components/layout/Navigation';
import { mockWindowResize, viewports, waitForAnimation } from './utils';

// Wrapper component for router context
const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ResponsiveNav', () => {
  const mockNavItems = [
    { label: 'Home', path: '/' },
    { label: 'Recipes', path: '/recipes' },
    { label: 'Meal Plans', path: '/meal-plans' },
    { label: 'Shopping', path: '/shopping' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render desktop navigation', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    render(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} />
      </RouterWrapper>
    );

    // All items should be visible
    mockNavItems.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });

    // Mobile menu button should not be visible
    expect(screen.queryByLabelText(/menu/i)).not.toBeInTheDocument();
  });

  it('should render mobile navigation', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} />
      </RouterWrapper>
    );

    // Items should not be immediately visible
    mockNavItems.forEach((item) => {
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    });

    // Mobile menu button should be visible
    expect(screen.getByLabelText(/menu/i)).toBeInTheDocument();
  });

  it('should toggle mobile menu', async () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} />
      </RouterWrapper>
    );

    const menuButton = screen.getByLabelText(/menu/i);
    
    // Open menu
    fireEvent.click(menuButton);
    await waitFor(() => {
      mockNavItems.forEach((item) => {
        expect(screen.getByText(item.label)).toBeInTheDocument();
      });
    });

    // Close menu
    fireEvent.click(menuButton);
    await waitFor(() => {
      mockNavItems.forEach((item) => {
        expect(screen.queryByText(item.label)).not.toBeInTheDocument();
      });
    });
  });

  it('should handle breakpoint transitions', async () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    const { rerender } = render(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} />
      </RouterWrapper>
    );

    // Desktop view
    expect(screen.queryByLabelText(/menu/i)).not.toBeInTheDocument();

    // Resize to mobile
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    rerender(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} />
      </RouterWrapper>
    );

    // Mobile view
    expect(screen.getByLabelText(/menu/i)).toBeInTheDocument();

    // Resize back to desktop
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
    rerender(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} />
      </RouterWrapper>
    );

    // Desktop view again
    expect(screen.queryByLabelText(/menu/i)).not.toBeInTheDocument();
  });

  it('should show search functionality', () => {
    render(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} showSearch />
      </RouterWrapper>
    );

    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
  });

  it('should handle user menu', () => {
    const mockUser = {
      name: 'John Doe',
      avatar: '/avatar.jpg',
    };

    render(
      <RouterWrapper>
        <ResponsiveNav items={mockNavItems} user={mockUser} />
      </RouterWrapper>
    );

    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    expect(screen.getByAltText(mockUser.name)).toHaveAttribute('src', mockUser.avatar);
  });
});

describe('MobileMenu', () => {
  const mockItems = [
    { label: 'Home', path: '/', icon: '🏠' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  it('should render when open', () => {
    render(
      <RouterWrapper>
        <MobileMenu isOpen={true} onClose={() => {}} items={mockItems} />
      </RouterWrapper>
    );

    mockItems.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('should not render when closed', () => {
    render(
      <RouterWrapper>
        <MobileMenu isOpen={false} onClose={() => {}} items={mockItems} />
      </RouterWrapper>
    );

    mockItems.forEach((item) => {
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    });
  });

  it('should close when backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(
      <RouterWrapper>
        <MobileMenu isOpen={true} onClose={handleClose} items={mockItems} />
      </RouterWrapper>
    );

    const backdrop = screen.getByTestId('menu-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalled();
  });

  it('should close when item is clicked', () => {
    const handleClose = vi.fn();
    render(
      <RouterWrapper>
        <MobileMenu isOpen={true} onClose={handleClose} items={mockItems} />
      </RouterWrapper>
    );

    fireEvent.click(screen.getByText('Home'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('should animate slide-in', async () => {
    const { rerender } = render(
      <RouterWrapper>
        <MobileMenu isOpen={false} onClose={() => {}} items={mockItems} />
      </RouterWrapper>
    );

    rerender(
      <RouterWrapper>
        <MobileMenu isOpen={true} onClose={() => {}} items={mockItems} />
      </RouterWrapper>
    );

    const menu = screen.getByRole('navigation');
    expect(menu).toHaveClass('animate-slide-in');
  });

  it('should be keyboard accessible', () => {
    const handleClose = vi.fn();
    render(
      <RouterWrapper>
        <MobileMenu isOpen={true} onClose={handleClose} items={mockItems} />
      </RouterWrapper>
    );

    // Escape key should close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('should trap focus', () => {
    render(
      <RouterWrapper>
        <MobileMenu isOpen={true} onClose={() => {}} items={mockItems} />
      </RouterWrapper>
    );

    const firstItem = screen.getByText('Home');
    const lastItem = screen.getByText('Settings');

    // Focus should be trapped within menu
    firstItem.focus();
    expect(document.activeElement).toBe(firstItem);

    // Tab to last item
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(lastItem);

    // Tab should wrap to first item
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(firstItem);
  });
});

describe('Sidebar', () => {
  const mockItems = [
    { label: 'Dashboard', path: '/', icon: '📊' },
    { label: 'Recipes', path: '/recipes', icon: '🍳' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  it('should render expanded by default on desktop', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    render(
      <RouterWrapper>
        <Sidebar items={mockItems} />
      </RouterWrapper>
    );

    mockItems.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('should render collapsed on mobile', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <RouterWrapper>
        <Sidebar items={mockItems} />
      </RouterWrapper>
    );

    // Only icons should be visible
    mockItems.forEach((item) => {
      expect(screen.getByText(item.icon)).toBeInTheDocument();
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    });
  });

  it('should toggle collapse state', async () => {
    render(
      <RouterWrapper>
        <Sidebar items={mockItems} />
      </RouterWrapper>
    );

    const toggleButton = screen.getByLabelText(/toggle sidebar/i);

    // Initially expanded
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleButton);
    await waitForAnimation();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggleButton);
    await waitForAnimation();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should highlight active item', () => {
    render(
      <RouterWrapper>
        <Sidebar items={mockItems} activePath="/recipes" />
      </RouterWrapper>
    );

    const recipesItem = screen.getByText('Recipes').closest('a');
    expect(recipesItem).toHaveClass('active');
  });

  it('should handle nested items', () => {
    const nestedItems = [
      {
        label: 'Recipes',
        path: '/recipes',
        icon: '🍳',
        children: [
          { label: 'Breakfast', path: '/recipes/breakfast' },
          { label: 'Dinner', path: '/recipes/dinner' },
        ],
      },
    ];

    render(
      <RouterWrapper>
        <Sidebar items={nestedItems} />
      </RouterWrapper>
    );

    // Parent item
    expect(screen.getByText('Recipes')).toBeInTheDocument();

    // Expand to show children
    const expandButton = screen.getByLabelText(/expand recipes/i);
    fireEvent.click(expandButton);

    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('should persist collapse state', () => {
    const { rerender } = render(
      <RouterWrapper>
        <Sidebar items={mockItems} />
      </RouterWrapper>
    );

    // Collapse
    const toggleButton = screen.getByLabelText(/toggle sidebar/i);
    fireEvent.click(toggleButton);

    // Remount component
    rerender(
      <RouterWrapper>
        <Sidebar items={mockItems} />
      </RouterWrapper>
    );

    // Should remain collapsed
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('SearchModal', () => {
  const mockResults = [
    { id: '1', title: 'Pasta Recipe', type: 'recipe' },
    { id: '2', title: 'Pizza Recipe', type: 'recipe' },
    { id: '3', title: 'Meal Plan', type: 'meal-plan' },
  ];

  it('should render when open', () => {
    render(
      <SearchModal isOpen={true} onClose={() => {}} />
    );

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <SearchModal isOpen={false} onClose={() => {}} />
    );

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it('should focus input when opened', async () => {
    const { rerender } = render(
      <SearchModal isOpen={false} onClose={() => {}} />
    );

    rerender(
      <SearchModal isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toHaveFocus();
    });
  });

  it('should perform search', async () => {
    const handleSearch = vi.fn().mockResolvedValue(mockResults);
    const user = userEvent.setup();

    render(
      <SearchModal isOpen={true} onClose={() => {}} onSearch={handleSearch} />
    );

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'pasta');

    await waitFor(() => {
      expect(handleSearch).toHaveBeenCalledWith('pasta');
    });

    await waitFor(() => {
      expect(screen.getByText('Pasta Recipe')).toBeInTheDocument();
    });
  });

  it('should debounce search input', async () => {
    vi.useFakeTimers();
    const handleSearch = vi.fn().mockResolvedValue(mockResults);
    const user = userEvent.setup({ delay: null });

    render(
      <SearchModal isOpen={true} onClose={() => {}} onSearch={handleSearch} />
    );

    const input = screen.getByPlaceholderText(/search/i);
    
    // Type quickly
    await user.type(input, 'p');
    await user.type(input, 'a');
    await user.type(input, 's');

    // Should not search yet
    expect(handleSearch).not.toHaveBeenCalled();

    // Fast forward debounce
    vi.advanceTimersByTime(300);

    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith('pas');

    vi.useRealTimers();
  });

  it('should navigate with keyboard', async () => {
    const handleSearch = vi.fn().mockResolvedValue(mockResults);
    const handleSelect = vi.fn();

    render(
      <SearchModal
        isOpen={true}
        onClose={() => {}}
        onSearch={handleSearch}
        onSelect={handleSelect}
      />
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, 'recipe');

    await waitFor(() => {
      expect(screen.getByText('Pasta Recipe')).toBeInTheDocument();
    });

    // Arrow down to first result
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('Pasta Recipe').parentElement).toHaveClass('highlighted');

    // Arrow down to second result
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('Pizza Recipe').parentElement).toHaveClass('highlighted');

    // Enter to select
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleSelect).toHaveBeenCalledWith(mockResults[1]);
  });

  it('should close on Escape', () => {
    const handleClose = vi.fn();
    render(
      <SearchModal isOpen={true} onClose={handleClose} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const handleSearch = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockResults), 1000))
    );

    render(
      <SearchModal isOpen={true} onClose={() => {}} onSearch={handleSearch} />
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, 'pasta');

    expect(screen.getByTestId('search-loading')).toBeInTheDocument();
  });

  it('should handle empty results', async () => {
    const handleSearch = vi.fn().mockResolvedValue([]);

    render(
      <SearchModal isOpen={true} onClose={() => {}} onSearch={handleSearch} />
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, 'xyz');

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });
});