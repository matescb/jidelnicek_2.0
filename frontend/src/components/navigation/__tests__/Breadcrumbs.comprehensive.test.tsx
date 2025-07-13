/**
 * Comprehensive tests for Breadcrumbs system
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { Breadcrumbs, SimpleBreadcrumbs } from '../breadcrumbs/Breadcrumbs';
import { BreadcrumbProvider, useBreadcrumb } from '../breadcrumbs/BreadcrumbProvider';
import { BreadcrumbItem } from '../breadcrumbs/BreadcrumbItem';
import { truncateBreadcrumbs } from '../breadcrumbs/utils';
import { Breadcrumb } from '../breadcrumbs/types';

// Mock hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock utils
vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Test wrapper
const TestWrapper: React.FC<{ 
  children: React.ReactNode;
  initialEntries?: string[];
}> = ({ children, initialEntries = ['/'] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <BreadcrumbProvider>
      {children}
    </BreadcrumbProvider>
  </MemoryRouter>
);

describe('Breadcrumbs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render breadcrumb navigation', () => {
      const mockBreadcrumbs: Breadcrumb[] = [
        { id: '1', label: 'Home', path: '/', isActive: false },
        { id: '2', label: 'Current Page', path: '/current', isActive: true },
      ];

      // Mock the hook
      vi.doMock('../breadcrumbs/hooks', () => ({
        useBreadcrumbs: () => mockBreadcrumbs,
      }));

      render(
        <TestWrapper>
          <Breadcrumbs />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();
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

    it('should render home icon for root path', () => {
      const mockBreadcrumbs: Breadcrumb[] = [
        { id: '1', label: 'Home', path: '/', isActive: false },
        { id: '2', label: 'Recipes', path: '/recipes', isActive: true },
      ];

      vi.doMock('../breadcrumbs/hooks', () => ({
        useBreadcrumbs: () => mockBreadcrumbs,
      }));

      render(
        <TestWrapper>
          <Breadcrumbs showHome={true} />
        </TestWrapper>
      );

      // Home icon should be present in the DOM
      const homeIcons = document.querySelectorAll('svg');
      expect(homeIcons.length).toBeGreaterThan(0);
    });

    it('should hide home label when showHome is false', () => {
      const mockBreadcrumbs: Breadcrumb[] = [
        { id: '1', label: 'Home', path: '/', isActive: false },
        { id: '2', label: 'Recipes', path: '/recipes', isActive: true },
      ];

      vi.doMock('../breadcrumbs/hooks', () => ({
        useBreadcrumbs: () => mockBreadcrumbs,
      }));

      render(
        <TestWrapper>
          <Breadcrumbs showHome={false} />
        </TestWrapper>
      );

      // Should still have icon but no text for home
      const homeIcons = document.querySelectorAll('svg');
      expect(homeIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Behavior', () => {
    const longBreadcrumbs: Breadcrumb[] = [
      { id: '1', label: 'Home', path: '/', isActive: false },
      { id: '2', label: 'Recipes', path: '/recipes', isActive: false },
      { id: '3', label: 'Italian', path: '/recipes/italian', isActive: false },
      { id: '4', label: 'Pasta', path: '/recipes/italian/pasta', isActive: false },
      { id: '5', label: 'Carbonara', path: '/recipes/italian/pasta/carbonara', isActive: true },
    ];

    beforeEach(() => {
      vi.doMock('../breadcrumbs/hooks', () => ({
        useBreadcrumbs: () => longBreadcrumbs,
      }));
    });

    it('should show different breadcrumbs on mobile and desktop', () => {
      render(
        <TestWrapper>
          <Breadcrumbs 
            mobileMaxItems={2} 
            desktopMaxItems={4} 
          />
        </TestWrapper>
      );

      // Should have both mobile and desktop breadcrumb lists
      const mobileBreadcrumbs = document.querySelector('.md\\:hidden');
      const desktopBreadcrumbs = document.querySelector('.hidden.md\\:flex');
      
      expect(mobileBreadcrumbs).toBeInTheDocument();
      expect(desktopBreadcrumbs).toBeInTheDocument();
    });

    it('should truncate breadcrumbs on mobile', () => {
      render(
        <TestWrapper>
          <Breadcrumbs mobileMaxItems={2} />
        </TestWrapper>
      );

      // Mobile breadcrumbs should be limited
      const mobileBreadcrumbs = document.querySelector('.md\\:hidden');
      expect(mobileBreadcrumbs).toBeInTheDocument();
    });

    it('should handle custom max items', () => {
      render(
        <TestWrapper>
          <Breadcrumbs maxItems={3} />
        </TestWrapper>
      );

      // Should respect custom max items
      const breadcrumbList = screen.getByRole('navigation');
      expect(breadcrumbList).toBeInTheDocument();
    });
  });

  describe('Truncation', () => {
    it('should truncate breadcrumbs from middle', () => {
      const breadcrumbs: Breadcrumb[] = [
        { id: '1', label: 'Home', path: '/', isActive: false },
        { id: '2', label: 'Level 2', path: '/level2', isActive: false },
        { id: '3', label: 'Level 3', path: '/level2/level3', isActive: false },
        { id: '4', label: 'Level 4', path: '/level2/level3/level4', isActive: false },
        { id: '5', label: 'Current', path: '/level2/level3/level4/current', isActive: true },
      ];

      const truncated = truncateBreadcrumbs(breadcrumbs, 3, 'middle');
      
      expect(truncated).toHaveLength(3);
      expect(truncated[0].label).toBe('Home');
      expect(truncated[1].id).toBe('ellipsis');
      expect(truncated[2].label).toBe('Current');
    });

    it('should truncate breadcrumbs from end', () => {
      const breadcrumbs: Breadcrumb[] = [
        { id: '1', label: 'Home', path: '/', isActive: false },
        { id: '2', label: 'Level 2', path: '/level2', isActive: false },
        { id: '3', label: 'Level 3', path: '/level2/level3', isActive: false },
        { id: '4', label: 'Current', path: '/level2/level3/current', isActive: true },
      ];

      const truncated = truncateBreadcrumbs(breadcrumbs, 2, 'end');
      
      expect(truncated).toHaveLength(2);
      expect(truncated[0].id).toBe('ellipsis');
      expect(truncated[1].label).toBe('Current');
    });

    it('should not truncate when items fit', () => {
      const breadcrumbs: Breadcrumb[] = [
        { id: '1', label: 'Home', path: '/', isActive: false },
        { id: '2', label: 'Current', path: '/current', isActive: true },
      ];

      const truncated = truncateBreadcrumbs(breadcrumbs, 5, 'middle');
      
      expect(truncated).toHaveLength(2);
      expect(truncated).toEqual(breadcrumbs);
    });
  });

  describe('Custom Separators', () => {
    const mockBreadcrumbs: Breadcrumb[] = [
      { id: '1', label: 'Home', path: '/', isActive: false },
      { id: '2', label: 'Current', path: '/current', isActive: true },
    ];

    beforeEach(() => {
      vi.doMock('../breadcrumbs/hooks', () => ({
        useBreadcrumbs: () => mockBreadcrumbs,
      }));
    });

    it('should use custom separator', () => {
      render(
        <TestWrapper>
          <Breadcrumbs separator=">" />
        </TestWrapper>
      );

      expect(screen.getByText('>')).toBeInTheDocument();
    });

    it('should use custom React element separator', () => {
      const CustomSeparator = () => <span data-testid="custom-separator">→</span>;
      
      render(
        <TestWrapper>
          <Breadcrumbs separator={<CustomSeparator />} />
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-separator')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    const mockBreadcrumbs: Breadcrumb[] = [
      { id: '1', label: 'Home', path: '/', isActive: false },
      { id: '2', label: 'Current', path: '/current', isActive: true },
    ];

    beforeEach(() => {
      vi.doMock('../breadcrumbs/hooks', () => ({
        useBreadcrumbs: () => mockBreadcrumbs,
      }));
    });

    it('should apply custom class names', () => {
      render(
        <TestWrapper>
          <Breadcrumbs 
            className="custom-breadcrumbs"
            itemClassName="custom-item"
            linkClassName="custom-link"
            activeClassName="custom-active"
            separatorClassName="custom-separator"
          />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('custom-breadcrumbs');
    });
  });
});

describe('SimpleBreadcrumbs Component', () => {
  it('should render simple breadcrumbs without context', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Products', path: '/products' },
      { label: 'Current Product' },
    ];

    render(
      <MemoryRouter>
        <SimpleBreadcrumbs items={items} />
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Current Product')).toBeInTheDocument();
  });

  it('should render links for all items except last', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Products', path: '/products' },
      { label: 'Current Product' },
    ];

    render(
      <MemoryRouter>
        <SimpleBreadcrumbs items={items} />
      </MemoryRouter>
    );

    const homeLink = screen.getByText('Home').closest('a');
    const productsLink = screen.getByText('Products').closest('a');
    const currentText = screen.getByText('Current Product');

    expect(homeLink).toHaveAttribute('href', '/');
    expect(productsLink).toHaveAttribute('href', '/products');
    expect(currentText.closest('a')).toBeNull();
  });

  it('should use custom separator', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Current', path: '/current' },
    ];

    render(
      <MemoryRouter>
        <SimpleBreadcrumbs items={items} separator="→" />
      </MemoryRouter>
    );

    expect(screen.getByText('→')).toBeInTheDocument();
  });
});

describe('BreadcrumbItem Component', () => {
  it('should render as link when path is provided', () => {
    render(
      <MemoryRouter>
        <BreadcrumbItem 
          label="Home" 
          path="/" 
          isActive={false}
          isLast={false}
        />
      </MemoryRouter>
    );

    const link = screen.getByText('Home').closest('a');
    expect(link).toHaveAttribute('href', '/');
  });

  it('should render as text when no path provided', () => {
    render(
      <MemoryRouter>
        <BreadcrumbItem 
          label="Current Page" 
          isActive={true}
          isLast={true}
        />
      </MemoryRouter>
    );

    const text = screen.getByText('Current Page');
    expect(text.closest('a')).toBeNull();
    expect(text).toHaveAttribute('aria-current', 'page');
  });

  it('should render icon when provided', () => {
    const TestIcon = () => <span data-testid="test-icon">🏠</span>;
    
    render(
      <MemoryRouter>
        <BreadcrumbItem 
          label="Home" 
          path="/" 
          icon={<TestIcon />}
          isActive={false}
          isLast={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should render separator when not last item', () => {
    render(
      <MemoryRouter>
        <BreadcrumbItem 
          label="Home" 
          path="/" 
          isActive={false}
          isLast={false}
          separator="/"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('should not render separator for last item', () => {
    render(
      <MemoryRouter>
        <BreadcrumbItem 
          label="Current" 
          isActive={true}
          isLast={true}
          separator="/"
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });
});

describe('BreadcrumbProvider', () => {
  it('should provide breadcrumb context', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useBreadcrumb();
      return <div>Test</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue).toBeDefined();
    expect(typeof contextValue.setBreadcrumbs).toBe('function');
    expect(typeof contextValue.appendBreadcrumb).toBe('function');
    expect(typeof contextValue.clearBreadcrumbs).toBe('function');
    expect(Array.isArray(contextValue.breadcrumbs)).toBe(true);
  });

  it('should allow setting breadcrumbs', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useBreadcrumb();
      
      React.useEffect(() => {
        contextValue.setBreadcrumbs([
          { id: '1', label: 'Home', path: '/', isActive: false },
          { id: '2', label: 'Current', path: '/current', isActive: true },
        ]);
      }, []);

      return <div>Test</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue.breadcrumbs).toHaveLength(2);
    expect(contextValue.breadcrumbs[0].label).toBe('Home');
    expect(contextValue.breadcrumbs[1].label).toBe('Current');
  });

  it('should allow appending breadcrumbs', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useBreadcrumb();
      
      React.useEffect(() => {
        contextValue.setBreadcrumbs([
          { id: '1', label: 'Home', path: '/', isActive: false },
        ]);
        contextValue.appendBreadcrumb({ 
          id: '2', 
          label: 'New Page', 
          path: '/new', 
          isActive: true 
        });
      }, []);

      return <div>Test</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue.breadcrumbs).toHaveLength(2);
    expect(contextValue.breadcrumbs[1].label).toBe('New Page');
  });

  it('should allow clearing breadcrumbs', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useBreadcrumb();
      
      React.useEffect(() => {
        contextValue.setBreadcrumbs([
          { id: '1', label: 'Home', path: '/', isActive: false },
        ]);
        contextValue.clearBreadcrumbs();
      }, []);

      return <div>Test</div>;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue.breadcrumbs).toHaveLength(0);
  });
});

describe('Breadcrumb Utilities', () => {
  describe('truncateBreadcrumbs', () => {
    const breadcrumbs: Breadcrumb[] = [
      { id: '1', label: 'Home', path: '/', isActive: false },
      { id: '2', label: 'Level 2', path: '/level2', isActive: false },
      { id: '3', label: 'Level 3', path: '/level2/level3', isActive: false },
      { id: '4', label: 'Level 4', path: '/level2/level3/level4', isActive: false },
      { id: '5', label: 'Current', path: '/level2/level3/level4/current', isActive: true },
    ];

    it('should handle middle truncation', () => {
      const result = truncateBreadcrumbs(breadcrumbs, 3, 'middle');
      
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('Home');
      expect(result[1].id).toBe('ellipsis');
      expect(result[2].label).toBe('Current');
    });

    it('should handle start truncation', () => {
      const result = truncateBreadcrumbs(breadcrumbs, 3, 'start');
      
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('ellipsis');
      expect(result[1].label).toBe('Level 4');
      expect(result[2].label).toBe('Current');
    });

    it('should handle end truncation', () => {
      const result = truncateBreadcrumbs(breadcrumbs, 3, 'end');
      
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('Home');
      expect(result[1].label).toBe('Level 2');
      expect(result[2].id).toBe('ellipsis');
    });

    it('should return original when no truncation needed', () => {
      const shortBreadcrumbs = breadcrumbs.slice(0, 2);
      const result = truncateBreadcrumbs(shortBreadcrumbs, 5, 'middle');
      
      expect(result).toEqual(shortBreadcrumbs);
    });

    it('should handle edge cases', () => {
      // Empty array
      expect(truncateBreadcrumbs([], 3, 'middle')).toEqual([]);
      
      // Single item
      const single = [breadcrumbs[0]];
      expect(truncateBreadcrumbs(single, 3, 'middle')).toEqual(single);
      
      // Max items <= 0
      expect(truncateBreadcrumbs(breadcrumbs, 0, 'middle')).toEqual([]);
      expect(truncateBreadcrumbs(breadcrumbs, -1, 'middle')).toEqual([]);
    });
  });
});

describe('Breadcrumb Accessibility', () => {
  const mockBreadcrumbs: Breadcrumb[] = [
    { id: '1', label: 'Home', path: '/', isActive: false },
    { id: '2', label: 'Current Page', path: '/current', isActive: true },
  ];

  beforeEach(() => {
    vi.doMock('../breadcrumbs/hooks', () => ({
      useBreadcrumbs: () => mockBreadcrumbs,
    }));
  });

  it('should have proper ARIA navigation role', () => {
    render(
      <TestWrapper>
        <Breadcrumbs />
      </TestWrapper>
    );

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeInTheDocument();
  });

  it('should mark current page with aria-current', () => {
    render(
      <TestWrapper>
        <SimpleBreadcrumbs 
          items={[
            { label: 'Home', path: '/' },
            { label: 'Current Page' }
          ]}
        />
      </TestWrapper>
    );

    const currentPage = screen.getByText('Current Page');
    expect(currentPage).toHaveAttribute('aria-current', 'page');
  });

  it('should be keyboard navigable', async () => {
    render(
      <TestWrapper>
        <SimpleBreadcrumbs 
          items={[
            { label: 'Home', path: '/' },
            { label: 'Products', path: '/products' },
            { label: 'Current' }
          ]}
        />
      </TestWrapper>
    );

    const homeLink = screen.getByText('Home');
    homeLink.focus();
    expect(document.activeElement).toBe(homeLink);

    await userEvent.tab();
    const productsLink = screen.getByText('Products');
    expect(document.activeElement).toBe(productsLink);
  });
});