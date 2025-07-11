import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { BreadcrumbProvider, useBreadcrumb } from '../components/BreadcrumbContext';
import { AutoBreadcrumbs } from '../components/AutoBreadcrumbs';
import { renderHook } from '@testing-library/react';

// Mock useMediaQuery for mobile tests
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false), // Default to desktop
}));

const TestWrapper = ({ 
  children, 
  initialEntries = ['/'] 
}: { 
  children: React.ReactNode;
  initialEntries?: string[];
}) => (
  <MemoryRouter initialEntries={initialEntries}>
    <BreadcrumbProvider>
      {children}
    </BreadcrumbProvider>
  </MemoryRouter>
);

describe('Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render breadcrumb items', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Recipes', path: '/recipes' },
      { label: 'Pasta', path: '/recipes/pasta' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} />
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  it('should render links for all items except last', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Recipes', path: '/recipes' },
      { label: 'Pasta', path: '/recipes/pasta' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} />
      </TestWrapper>
    );

    const homeLink = screen.getByText('Home').closest('a');
    const recipesLink = screen.getByText('Recipes').closest('a');
    const pastaText = screen.getByText('Pasta');

    expect(homeLink).toHaveAttribute('href', '/');
    expect(recipesLink).toHaveAttribute('href', '/recipes');
    expect(pastaText.closest('a')).not.toBeInTheDocument();
  });

  it('should render separators between items', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Recipes', path: '/recipes' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} />
      </TestWrapper>
    );

    const separators = screen.getAllByText('/');
    expect(separators).toHaveLength(1);
  });

  it('should support custom separator', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Recipes', path: '/recipes' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} separator="›" />
      </TestWrapper>
    );

    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('should handle empty items array', () => {
    render(
      <TestWrapper>
        <Breadcrumbs items={[]} />
      </TestWrapper>
    );

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeEmptyDOMElement();
  });

  it('should support custom render function', () => {
    const items = [
      { label: 'Home', path: '/', icon: '🏠' },
      { label: 'Recipes', path: '/recipes', icon: '📖' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs 
          items={items}
          renderItem={(item) => (
            <span>
              {item.icon} {item.label}
            </span>
          )}
        />
      </TestWrapper>
    );

    expect(screen.getByText('🏠 Home')).toBeInTheDocument();
    expect(screen.getByText('📖 Recipes')).toBeInTheDocument();
  });

  it('should add aria-current to last item', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Current Page', path: '/current' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} />
      </TestWrapper>
    );

    const currentItem = screen.getByText('Current Page');
    expect(currentItem).toHaveAttribute('aria-current', 'page');
  });
});

describe('Mobile Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock as mobile
    vi.mocked(require('@/hooks/useMediaQuery').useMediaQuery).mockReturnValue(true);
  });

  it('should truncate on mobile showing only last 2 items', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Recipes', path: '/recipes' },
      { label: 'Italian', path: '/recipes/italian' },
      { label: 'Pasta', path: '/recipes/italian/pasta' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} mobileMaxItems={2} />
      </TestWrapper>
    );

    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Recipes')).not.toBeInTheDocument();
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByText('Italian')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  it('should expand breadcrumbs on ellipsis click', async () => {
    const user = userEvent.setup();
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Recipes', path: '/recipes' },
      { label: 'Italian', path: '/recipes/italian' },
      { label: 'Pasta', path: '/recipes/italian/pasta' },
    ];

    render(
      <TestWrapper>
        <Breadcrumbs items={items} mobileMaxItems={2} />
      </TestWrapper>
    );

    const ellipsis = screen.getByText('...');
    await user.click(ellipsis);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('Italian')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });
});

describe('AutoBreadcrumbs', () => {
  it('should generate breadcrumbs from route', () => {
    render(
      <TestWrapper initialEntries={['/recipes/italian/pasta']}>
        <Routes>
          <Route path="/recipes/italian/pasta" element={<AutoBreadcrumbs />} />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('Italian')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  it('should use route config for labels', () => {
    const routeConfig = {
      '/': { label: 'Dashboard' },
      '/recipes': { label: 'All Recipes' },
      '/recipes/:category': { label: 'Category' },
    };

    render(
      <TestWrapper initialEntries={['/recipes/italian']}>
        <Routes>
          <Route 
            path="/recipes/:category" 
            element={<AutoBreadcrumbs routeConfig={routeConfig} />} 
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('All Recipes')).toBeInTheDocument();
    expect(screen.getByText('Italian')).toBeInTheDocument();
  });

  it('should handle dynamic segments', async () => {
    const routeConfig = {
      '/recipes/:id': { 
        label: async (params: any) => {
          // Simulate API call
          return `Recipe: ${params.id}`;
        }
      },
    };

    render(
      <TestWrapper initialEntries={['/recipes/123']}>
        <Routes>
          <Route 
            path="/recipes/:id" 
            element={<AutoBreadcrumbs routeConfig={routeConfig} />} 
          />
        </Routes>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Recipe: 123')).toBeInTheDocument();
    });
  });

  it('should capitalize segments by default', () => {
    render(
      <TestWrapper initialEntries={['/meal-plans/weekly']}>
        <Routes>
          <Route path="/meal-plans/weekly" element={<AutoBreadcrumbs />} />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Meal Plans')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });

  it('should exclude segments', () => {
    render(
      <TestWrapper initialEntries={['/admin/users/edit/123']}>
        <Routes>
          <Route 
            path="/admin/users/edit/:id" 
            element={<AutoBreadcrumbs excludeSegments={['edit']} />} 
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});

describe('BreadcrumbContext', () => {
  it('should allow setting custom breadcrumbs', () => {
    const TestComponent = () => {
      const { setBreadcrumbs } = useBreadcrumb();
      
      React.useEffect(() => {
        setBreadcrumbs([
          { label: 'Custom', path: '/custom' },
          { label: 'Breadcrumb', path: '/custom/breadcrumb' },
        ]);
      }, [setBreadcrumbs]);

      return <Breadcrumbs />;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Breadcrumb')).toBeInTheDocument();
  });

  it('should append breadcrumbs', () => {
    const TestComponent = () => {
      const { setBreadcrumbs, appendBreadcrumb } = useBreadcrumb();
      
      React.useEffect(() => {
        setBreadcrumbs([
          { label: 'Home', path: '/' },
          { label: 'Recipes', path: '/recipes' },
        ]);
        appendBreadcrumb({ label: 'New Recipe', path: '/recipes/new' });
      }, [setBreadcrumbs, appendBreadcrumb]);

      return <Breadcrumbs />;
    };

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('New Recipe')).toBeInTheDocument();
  });

  it('should clear breadcrumbs', () => {
    const TestComponent = () => {
      const { setBreadcrumbs, clearBreadcrumbs } = useBreadcrumb();
      const [cleared, setCleared] = React.useState(false);
      
      React.useEffect(() => {
        setBreadcrumbs([
          { label: 'Home', path: '/' },
          { label: 'Recipes', path: '/recipes' },
        ]);
      }, [setBreadcrumbs]);

      return (
        <>
          <Breadcrumbs />
          <button onClick={() => {
            clearBreadcrumbs();
            setCleared(true);
          }}>
            Clear
          </button>
          {cleared && <div>Breadcrumbs cleared</div>}
        </>
      );
    };

    const { rerender } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Recipes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear'));

    rerender(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Recipes')).not.toBeInTheDocument();
  });
});

describe('Breadcrumb Hooks', () => {
  it('should update breadcrumbs on route change', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/recipes/italian']}>
          <BreadcrumbProvider>
            {children}
          </BreadcrumbProvider>
        </MemoryRouter>
      ),
    });

    act(() => {
      result.current.setBreadcrumbs([
        { label: 'Home', path: '/' },
        { label: 'Recipes', path: '/recipes' },
        { label: 'Italian', path: '/recipes/italian' },
      ]);
    });

    expect(result.current.breadcrumbs).toHaveLength(3);
    expect(result.current.breadcrumbs[2].label).toBe('Italian');
  });
});