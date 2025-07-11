import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { 
  BreadcrumbProvider, 
  Breadcrumbs, 
  SimpleBreadcrumbs,
  useBreadcrumbTitle,
  useSetBreadcrumbs,
} from '../index';

// Test component that displays current location
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

// Test component that uses breadcrumb hooks
const TestPageWithTitle = ({ title }: { title: string }) => {
  useBreadcrumbTitle(title);
  return <div>Test Page</div>;
};

const TestPageWithCustomBreadcrumbs = () => {
  const setBreadcrumbs = useSetBreadcrumbs();
  
  React.useEffect(() => {
    const cleanup = setBreadcrumbs([
      { id: 'custom-1', label: 'Custom Home', path: '/' },
      { id: 'custom-2', label: 'Custom Page', isActive: true },
    ]);
    return cleanup;
  }, [setBreadcrumbs]);
  
  return <div>Custom Breadcrumbs Page</div>;
};

describe('Breadcrumbs', () => {
  const renderWithRouter = (ui: React.ReactElement, { route = '/' } = {}) => {
    window.history.pushState({}, 'Test page', route);
    
    return render(
      <BrowserRouter>
        <BreadcrumbProvider>
          {ui}
          <LocationDisplay />
        </BreadcrumbProvider>
      </BrowserRouter>
    );
  };

  describe('Auto-generated breadcrumbs', () => {
    it('renders home breadcrumb for root path', () => {
      renderWithRouter(<Breadcrumbs />, { route: '/' });
      
      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('generates breadcrumbs from path segments', () => {
      renderWithRouter(<Breadcrumbs />, { route: '/recipes/123/edit' });
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Recipes')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('marks the last breadcrumb as active', () => {
      renderWithRouter(<Breadcrumbs />, { route: '/recipes/new' });
      
      const newBreadcrumb = screen.getByText('New');
      expect(newBreadcrumb.closest('span')).toHaveAttribute('aria-current', 'page');
    });

    it('makes non-active breadcrumbs clickable', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Breadcrumbs />, { route: '/recipes/123/edit' });
      
      const recipeLink = screen.getByText('Recipes');
      expect(recipeLink.tagName).toBe('A');
      expect(recipeLink).toHaveAttribute('href', '/recipes');
      
      await user.click(recipeLink);
      expect(screen.getByTestId('location')).toHaveTextContent('/recipes');
    });
  });

  describe('Custom breadcrumb title', () => {
    it('updates the current breadcrumb title', () => {
      renderWithRouter(
        <Routes>
          <Route path="/test" element={
            <>
              <Breadcrumbs />
              <TestPageWithTitle title="Custom Title" />
            </>
          } />
        </Routes>,
        { route: '/test' }
      );
      
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });
  });

  describe('Custom breadcrumbs', () => {
    it('replaces auto-generated breadcrumbs with custom ones', () => {
      renderWithRouter(
        <>
          <Breadcrumbs />
          <TestPageWithCustomBreadcrumbs />
        </>,
        { route: '/some/deep/path' }
      );
      
      expect(screen.getByText('Custom Home')).toBeInTheDocument();
      expect(screen.getByText('Custom Page')).toBeInTheDocument();
      expect(screen.queryByText('Some')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep')).not.toBeInTheDocument();
      expect(screen.queryByText('Path')).not.toBeInTheDocument();
    });
  });

  describe('Responsive behavior', () => {
    it('truncates breadcrumbs on mobile', () => {
      renderWithRouter(
        <Breadcrumbs mobileMaxItems={2} />,
        { route: '/a/b/c/d/e' }
      );
      
      // Note: Testing responsive behavior requires mocking window size
      // or using CSS media query testing utilities
      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    });
  });

  describe('SimpleBreadcrumbs', () => {
    it('renders standalone breadcrumbs without provider', () => {
      const items = [
        { label: 'Home', path: '/' },
        { label: 'Products', path: '/products' },
        { label: 'Electronics' },
      ];
      
      render(
        <BrowserRouter>
          <SimpleBreadcrumbs items={items} />
        </BrowserRouter>
      );
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });

    it('supports custom separator', () => {
      const items = [
        { label: 'One' },
        { label: 'Two' },
      ];
      
      render(
        <BrowserRouter>
          <SimpleBreadcrumbs items={items} separator={<span>/</span>} />
        </BrowserRouter>
      );
      
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithRouter(<Breadcrumbs />, { route: '/recipes' });
      
      const nav = screen.getByLabelText('Breadcrumb');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
      
      const currentPage = screen.getByText('Recipes');
      expect(currentPage.closest('span')).toHaveAttribute('aria-current', 'page');
    });
  });
});