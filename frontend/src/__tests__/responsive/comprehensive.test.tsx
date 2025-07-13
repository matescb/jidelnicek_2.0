/**
 * Comprehensive responsive design tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import { ResponsiveNav } from '../../components/navigation/ResponsiveNav';
import { RecipeListView } from '../../components/recipes/RecipeListView';
import { TripWizard } from '../../components/trips/TripWizard';
import { Grid } from '../../components/layout/Grid';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { 
  mockWindowResize, 
  mockMediaQueries,
  mockDeviceOrientation,
  VIEWPORT_PRESETS,
  testBreakpointBehavior,
  testAtViewports,
  simulateSwipe,
  simulatePinch,
  testTouchTargets,
  testResponsiveGrid,
  testResponsiveImages,
  testResponsiveTypography
} from '../utils/responsive';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Comprehensive Responsive Design', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Breakpoint System', () => {
    it('should handle all major breakpoints correctly', async () => {
      const TestComponent = () => (
        <div>
          <div data-testid="xs-only" className="block sm:hidden">XS Only</div>
          <div data-testid="sm-up" className="hidden sm:block">SM and up</div>
          <div data-testid="md-up" className="hidden md:block">MD and up</div>
          <div data-testid="lg-up" className="hidden lg:block">LG and up</div>
          <div data-testid="xl-up" className="hidden xl:block">XL and up</div>
        </div>
      );

      await testBreakpointBehavior(
        () => renderWithProviders(<TestComponent />).container,
        [
          {
            viewport: VIEWPORT_PRESETS.mobile.small,
            expectedBreakpoint: 'xs',
            assertions: () => {
              expect(screen.getByTestId('xs-only')).toBeVisible();
              expect(screen.getByTestId('sm-up')).not.toBeVisible();
            },
          },
          {
            viewport: VIEWPORT_PRESETS.tablet.portrait,
            expectedBreakpoint: 'md',
            assertions: () => {
              expect(screen.getByTestId('xs-only')).not.toBeVisible();
              expect(screen.getByTestId('sm-up')).toBeVisible();
              expect(screen.getByTestId('md-up')).toBeVisible();
              expect(screen.getByTestId('lg-up')).not.toBeVisible();
            },
          },
          {
            viewport: VIEWPORT_PRESETS.desktop.medium,
            expectedBreakpoint: 'xl',
            assertions: () => {
              expect(screen.getByTestId('lg-up')).toBeVisible();
              expect(screen.getByTestId('xl-up')).toBeVisible();
            },
          },
        ]
      );
    });

    it('should handle custom breakpoints', () => {
      mockWindowResize(600, 800); // Between sm and md
      
      mockMediaQueries({
        '(min-width: 640px)': false,
        '(min-width: 768px)': false,
        '(max-width: 639px)': true,
      });

      renderWithProviders(
        <div data-testid="custom-breakpoint" className="block sm:hidden md:block">
          Custom behavior
        </div>
      );

      const element = screen.getByTestId('custom-breakpoint');
      expect(element).toBeVisible();
    });
  });

  describe('Navigation Responsiveness', () => {
    it('should adapt navigation for different screen sizes', () => {
      const viewports = [
        {
          name: 'Mobile Portrait',
          ...VIEWPORT_PRESETS.mobile.medium,
          test: () => {
            expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
            expect(screen.queryByTestId('desktop-sidebar')).not.toBeInTheDocument();
          },
        },
        {
          name: 'Tablet Portrait',
          ...VIEWPORT_PRESETS.tablet.portrait,
          test: () => {
            expect(screen.getByTestId('tablet-nav')).toBeInTheDocument();
            expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
          },
        },
        {
          name: 'Desktop',
          ...VIEWPORT_PRESETS.desktop.medium,
          test: () => {
            expect(screen.getByTestId('desktop-sidebar')).toBeInTheDocument();
            expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
          },
        },
      ];

      testAtViewports(
        () => renderWithProviders(
          <ResponsiveNav>
            <div>Content</div>
          </ResponsiveNav>
        ),
        viewports
      );
    });

    it('should handle orientation changes', async () => {
      mockWindowResize(VIEWPORT_PRESETS.tablet.portrait.width, VIEWPORT_PRESETS.tablet.portrait.height);
      mockDeviceOrientation('portrait');
      
      const { rerender } = renderWithProviders(
        <ResponsiveNav>
          <div>Content</div>
        </ResponsiveNav>
      );

      expect(screen.getByTestId('portrait-nav')).toBeInTheDocument();

      // Rotate to landscape
      mockWindowResize(VIEWPORT_PRESETS.tablet.landscape.width, VIEWPORT_PRESETS.tablet.landscape.height);
      mockDeviceOrientation('landscape');

      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <ResponsiveNav>
              <div>Content</div>
            </ResponsiveNav>
          </ThemeProvider>
        </BrowserRouter>
      );

      expect(screen.getByTestId('landscape-nav')).toBeInTheDocument();
    });
  });

  describe('Grid System Responsiveness', () => {
    it('should adapt grid layouts across breakpoints', () => {
      renderWithProviders(
        <Grid
          data-testid="responsive-grid"
          cols={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }}
          gap={4}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} data-testid={`grid-item-${i}`}>
              Item {i + 1}
            </div>
          ))}
        </Grid>
      );

      const grid = screen.getByTestId('responsive-grid');

      testResponsiveGrid(grid, {
        '320x568': 1, // Mobile
        '768x1024': 3, // Tablet
        '1280x720': 4, // Desktop
        '1920x1080': 5, // Large desktop
      });
    });

    it('should handle nested grids', () => {
      renderWithProviders(
        <Grid cols={{ xs: 1, md: 2 }} data-testid="outer-grid">
          <Grid cols={{ xs: 2, sm: 3 }} data-testid="nested-grid-1">
            <div>Nested Item 1</div>
            <div>Nested Item 2</div>
            <div>Nested Item 3</div>
          </Grid>
          <div>Regular Item</div>
        </Grid>
      );

      mockWindowResize(VIEWPORT_PRESETS.tablet.portrait.width, VIEWPORT_PRESETS.tablet.portrait.height);

      const outerGrid = screen.getByTestId('outer-grid');
      const nestedGrid = screen.getByTestId('nested-grid-1');

      const outerStyle = getComputedStyle(outerGrid);
      const nestedStyle = getComputedStyle(nestedGrid);

      expect(outerStyle.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
      expect(nestedStyle.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    });
  });

  describe('Table Responsiveness', () => {
    const tableData = [
      { id: 1, name: 'Recipe 1', category: 'Main Course', cookTime: '30 min' },
      { id: 2, name: 'Recipe 2', category: 'Dessert', cookTime: '45 min' },
      { id: 3, name: 'Recipe 3', category: 'Appetizer', cookTime: '15 min' },
    ];

    const columns = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'cookTime', label: 'Cook Time', sortable: false },
    ];

    it('should transform table to cards on mobile', () => {
      // Desktop view - should be table
      mockWindowResize(VIEWPORT_PRESETS.desktop.medium.width, VIEWPORT_PRESETS.desktop.medium.height);
      
      const { rerender } = renderWithProviders(
        <ResponsiveTable
          data={tableData}
          columns={columns}
          data-testid="responsive-table"
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.queryByTestId('card-view')).not.toBeInTheDocument();

      // Mobile view - should be cards
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);

      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <ResponsiveTable
              data={tableData}
              columns={columns}
              data-testid="responsive-table"
            />
          </ThemeProvider>
        </BrowserRouter>
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByTestId('card-view')).toBeInTheDocument();
    });

    it('should handle horizontal scrolling on tablet', () => {
      mockWindowResize(VIEWPORT_PRESETS.tablet.portrait.width, VIEWPORT_PRESETS.tablet.portrait.height);

      renderWithProviders(
        <ResponsiveTable
          data={tableData}
          columns={columns}
          data-testid="scrollable-table"
        />
      );

      const tableContainer = screen.getByTestId('table-container');
      expect(tableContainer).toHaveClass('overflow-x-auto');
    });
  });

  describe('Touch and Gesture Support', () => {
    it('should handle swipe gestures on mobile', async () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);

      const onSwipe = vi.fn();
      renderWithProviders(
        <div
          data-testid="swipeable-container"
          className="w-full h-64 bg-gray-200"
          onTouchStart={() => {}}
          onTouchMove={() => {}}
          onTouchEnd={() => onSwipe()}
        >
          Swipe me
        </div>
      );

      const container = screen.getByTestId('swipeable-container');

      await simulateSwipe(container, {
        direction: 'left',
        distance: 100,
        duration: 300,
      });

      expect(onSwipe).toHaveBeenCalled();
    });

    it('should support pinch-to-zoom gestures', async () => {
      const onPinch = vi.fn();
      renderWithProviders(
        <div
          data-testid="pinchable-container"
          className="w-full h-64 bg-gray-200"
          onTouchStart={() => {}}
          onTouchMove={() => {}}
          onTouchEnd={() => onPinch()}
        >
          Pinch to zoom
        </div>
      );

      const container = screen.getByTestId('pinchable-container');

      await simulatePinch(container, {
        scale: 2,
        duration: 500,
      });

      expect(onPinch).toHaveBeenCalled();
    });

    it('should have appropriate touch targets', () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);

      const { container } = renderWithProviders(
        <div>
          <button data-testid="touch-button">Touch Button</button>
          <a href="#" data-testid="touch-link">Touch Link</a>
          <input type="text" data-testid="touch-input" />
        </div>
      );

      testTouchTargets(container);
    });
  });

  describe('Image Responsiveness', () => {
    it('should use responsive image techniques', () => {
      const { container } = renderWithProviders(
        <div>
          <img
            src="/recipe-image.jpg"
            srcSet="/recipe-image-320.jpg 320w, /recipe-image-640.jpg 640w, /recipe-image-1280.jpg 1280w"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            alt="Recipe Image"
            data-testid="responsive-image"
          />
          <picture data-testid="responsive-picture">
            <source media="(max-width: 768px)" srcSet="/mobile-recipe.jpg" />
            <source media="(max-width: 1200px)" srcSet="/tablet-recipe.jpg" />
            <img src="/desktop-recipe.jpg" alt="Recipe" />
          </picture>
        </div>
      );

      testResponsiveImages(container);
    });

    it('should handle art direction', () => {
      renderWithProviders(
        <picture data-testid="art-direction-picture">
          <source 
            media="(max-width: 768px)" 
            srcSet="/recipe-hero-mobile.jpg" 
            data-testid="mobile-source"
          />
          <source 
            media="(min-width: 769px)" 
            srcSet="/recipe-hero-desktop.jpg" 
            data-testid="desktop-source"
          />
          <img src="/recipe-hero-fallback.jpg" alt="Recipe Hero" />
        </picture>
      );

      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      const mobileSource = screen.getByTestId('mobile-source');
      expect(mobileSource).toBeInTheDocument();
    });
  });

  describe('Typography Responsiveness', () => {
    it('should scale typography appropriately', () => {
      renderWithProviders(
        <div>
          <h1 data-testid="responsive-heading" className="text-2xl md:text-4xl lg:text-6xl">
            Responsive Heading
          </h1>
          <p data-testid="responsive-text" className="text-sm md:text-base lg:text-lg">
            Responsive paragraph text
          </p>
        </div>
      );

      const heading = screen.getByTestId('responsive-heading');
      const text = screen.getByTestId('responsive-text');

      testResponsiveTypography(heading, {
        '320x568': '1.5rem', // text-2xl
        '768x1024': '2.25rem', // text-4xl
        '1280x720': '3.75rem', // text-6xl
      });

      testResponsiveTypography(text, {
        '320x568': '0.875rem', // text-sm
        '768x1024': '1rem', // text-base
        '1280x720': '1.125rem', // text-lg
      });
    });

    it('should handle fluid typography', () => {
      renderWithProviders(
        <h1
          data-testid="fluid-heading"
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          }}
        >
          Fluid Typography
        </h1>
      );

      const heading = screen.getByTestId('fluid-heading');
      
      // Test at different viewport widths
      mockWindowResize(320, 568);
      let computedStyle = getComputedStyle(heading);
      expect(parseFloat(computedStyle.fontSize)).toBeGreaterThanOrEqual(24); // 1.5rem

      mockWindowResize(1920, 1080);
      computedStyle = getComputedStyle(heading);
      expect(parseFloat(computedStyle.fontSize)).toBeLessThanOrEqual(48); // 3rem
    });
  });

  describe('Performance at Different Viewports', () => {
    it('should maintain performance across breakpoints', async () => {
      const viewports = [
        VIEWPORT_PRESETS.mobile.small,
        VIEWPORT_PRESETS.tablet.portrait,
        VIEWPORT_PRESETS.desktop.medium,
        VIEWPORT_PRESETS.desktop.wide,
      ];

      for (const viewport of viewports) {
        const startTime = performance.now();
        
        mockWindowResize(viewport.width, viewport.height);
        
        renderWithProviders(
          <RecipeListView
            recipes={Array.from({ length: 50 }, (_, i) => ({
              id: i,
              title: `Recipe ${i}`,
              description: `Description for recipe ${i}`,
              cookTime: 30,
              servings: 4,
            }))}
          />
        );

        const renderTime = performance.now() - startTime;
        
        // Performance should be reasonable (under 100ms for render)
        expect(renderTime).toBeLessThan(100);
        
        // Check that content is rendered
        expect(screen.getAllByText(/Recipe/).length).toBeGreaterThan(0);
      }
    });

    it('should lazy load content appropriately', async () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);

      renderWithProviders(
        <RecipeListView
          recipes={Array.from({ length: 100 }, (_, i) => ({
            id: i,
            title: `Recipe ${i}`,
            description: `Description for recipe ${i}`,
            cookTime: 30,
            servings: 4,
          }))}
          virtualizeThreshold={20}
        />
      );

      // Initially, only a subset should be rendered
      const renderedItems = screen.getAllByTestId(/recipe-card/);
      expect(renderedItems.length).toBeLessThan(100);
      expect(renderedItems.length).toBeGreaterThan(0);
    });
  });

  describe('Dark Mode Responsiveness', () => {
    it('should adapt responsive styles for dark mode', () => {
      // Mock dark mode preference
      mockMediaQueries({
        '(prefers-color-scheme: dark)': true,
      });

      const { container } = renderWithProviders(
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
          <div data-testid="responsive-card" className="bg-gray-100 dark:bg-gray-800 p-4 md:p-6 lg:p-8">
            Dark mode responsive content
          </div>
        </div>
      );

      const card = screen.getByTestId('responsive-card');
      const computedStyle = getComputedStyle(card);
      
      // Check that dark mode styles are applied
      expect(computedStyle.backgroundColor).toContain('gray'); // Should be dark
    });
  });

  describe('Print Styles', () => {
    it('should have print-friendly responsive layouts', () => {
      // Mock print media query
      mockMediaQueries({
        'print': true,
      });

      renderWithProviders(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-1">
          <div data-testid="print-item-1">Print Item 1</div>
          <div data-testid="print-item-2">Print Item 2</div>
          <div data-testid="print-item-3">Print Item 3</div>
        </div>
      );

      // In print mode, should be single column
      const container = screen.getByTestId('print-item-1').parentElement;
      const computedStyle = getComputedStyle(container!);
      expect(computedStyle.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
    });
  });

  describe('Accessibility in Responsive Design', () => {
    it('should maintain touch target sizes', () => {
      const viewports = [
        VIEWPORT_PRESETS.mobile.small,
        VIEWPORT_PRESETS.mobile.medium,
        VIEWPORT_PRESETS.tablet.portrait,
      ];

      viewports.forEach(viewport => {
        mockWindowResize(viewport.width, viewport.height);

        const { container } = renderWithProviders(
          <div>
            <button className="min-h-[44px] min-w-[44px] p-2">Touch Button</button>
            <a href="#" className="inline-block min-h-[44px] min-w-[44px] p-2">Touch Link</a>
          </div>
        );

        testTouchTargets(container);
      });
    });

    it('should provide appropriate focus indicators at all sizes', async () => {
      const user = userEvent.setup();
      
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);

      renderWithProviders(
        <button data-testid="focus-button" className="focus:ring-4 focus:ring-blue-500">
          Focus Me
        </button>
      );

      const button = screen.getByTestId('focus-button');
      await user.tab();

      expect(button).toHaveFocus();
      
      const computedStyle = getComputedStyle(button);
      expect(computedStyle.outline).toBeDefined();
    });
  });
});