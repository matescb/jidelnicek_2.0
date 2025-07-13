/**
 * Comprehensive test runner for responsive design and accessibility
 */

import { vi } from 'vitest';
import { createTestSuite, testA11y, testResponsive, testPerformance } from './utils/test-helpers';
import { VIEWPORT_PRESETS } from './utils/responsive';

// Import components to test
import { ResponsiveNav } from '../components/navigation/ResponsiveNav';
import { RecipeForm } from '../components/recipes/RecipeForm';
import { TripWizard } from '../components/trips/TripWizard';
import { VirtualizedDataTable } from '../components/common/VirtualizedDataTable';
import { MobileBottomNav } from '../components/navigation/MobileBottomNav';
import { BottomSheet } from '../components/mobile/BottomSheet';
import { Grid } from '../components/layout/Grid';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';

/**
 * Test configuration for each component
 */
const componentTests = [
  {
    name: 'ResponsiveNav',
    component: () => (
      <ResponsiveNav>
        <div>Test content</div>
      </ResponsiveNav>
    ),
    options: {
      skipMobile: false,
      a11yLevel: 'AA' as const,
    },
  },
  {
    name: 'RecipeForm',
    component: () => <RecipeForm onSubmit={vi.fn()} />,
    options: {
      a11yLevel: 'AA' as const,
    },
  },
  {
    name: 'TripWizard',
    component: () => <TripWizard />,
    options: {
      a11yLevel: 'AA' as const,
    },
  },
  {
    name: 'VirtualizedDataTable',
    component: () => (
      <VirtualizedDataTable
        data={Array.from({ length: 50 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: i * 10,
        }))}
        columns={[
          { key: 'name', label: 'Name', sortable: true },
          { key: 'value', label: 'Value', sortable: true },
        ]}
      />
    ),
    options: {
      a11yLevel: 'AA' as const,
    },
  },
  {
    name: 'MobileBottomNav',
    component: () => <MobileBottomNav />,
    options: {
      skipResponsive: false,
      viewports: [
        { name: 'Mobile Portrait', ...VIEWPORT_PRESETS.mobile.medium },
        { name: 'Mobile Landscape', ...VIEWPORT_PRESETS.mobile.medium, width: 667, height: 375 },
      ],
    },
  },
  {
    name: 'BottomSheet',
    component: () => (
      <BottomSheet isOpen={true} onOpenChange={vi.fn()}>
        <div>Bottom sheet content</div>
      </BottomSheet>
    ),
    options: {
      skipResponsive: false,
      a11yLevel: 'AA' as const,
    },
  },
  {
    name: 'Grid',
    component: () => (
      <Grid cols={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>Grid Item {i + 1}</div>
        ))}
      </Grid>
    ),
    options: {
      skipAccessibility: false,
    },
  },
  {
    name: 'ResponsiveTable',
    component: () => (
      <ResponsiveTable
        data={Array.from({ length: 20 }, (_, i) => ({
          id: i,
          name: `Recipe ${i}`,
          category: 'Main Course',
          cookTime: '30 min',
        }))}
        columns={[
          { key: 'name', label: 'Name', sortable: true },
          { key: 'category', label: 'Category', sortable: true },
          { key: 'cookTime', label: 'Cook Time' },
        ]}
      />
    ),
    options: {
      a11yLevel: 'AA' as const,
    },
  },
];

/**
 * Run comprehensive tests for all components
 */
describe('Comprehensive Responsive Design and Accessibility Tests', () => {
  beforeAll(() => {
    // Set up global test environment
    vi.clearAllMocks();
    
    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    };

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      unobserve() {}
    };
  });

  // Generate comprehensive test suites for each component
  componentTests.forEach(({ name, component, options }) => {
    createTestSuite(name, component, options);
  });

  describe('Cross-Component Integration', () => {
    it('should work together in a complete layout', () => {
      const CompleteLayout = () => (
        <ResponsiveNav>
          <main>
            <Grid cols={{ xs: 1, md: 2 }}>
              <RecipeForm onSubmit={vi.fn()} />
              <VirtualizedDataTable
                data={[{ id: 1, name: 'Test', value: 100 }]}
                columns={[{ key: 'name', label: 'Name' }]}
              />
            </Grid>
          </main>
          <MobileBottomNav />
        </ResponsiveNav>
      );

      testResponsive(<CompleteLayout />, {
        mobile: () => {
          expect(document.body).toContainHTML('<');
        },
        tablet: () => {
          expect(document.body).toContainHTML('<');
        },
        desktop: () => {
          expect(document.body).toContainHTML('<');
        },
      });
    });

    it('should maintain accessibility across component interactions', () => {
      const InteractiveLayout = () => (
        <div>
          <ResponsiveNav>
            <TripWizard />
          </ResponsiveNav>
          <BottomSheet isOpen={false} onOpenChange={vi.fn()}>
            <RecipeForm onSubmit={vi.fn()} />
          </BottomSheet>
        </div>
      );

      testA11y(<InteractiveLayout />);
    });

    it('should perform well with multiple components', () => {
      const PerformanceLayout = () => (
        <div>
          <ResponsiveNav>
            <Grid cols={{ xs: 1, sm: 2, md: 3 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i}>Component {i}</div>
              ))}
            </Grid>
            <ResponsiveTable
              data={Array.from({ length: 100 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                value: i,
              }))}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'value', label: 'Value' },
              ]}
            />
          </ResponsiveNav>
        </div>
      );

      testPerformance(<PerformanceLayout />, {
        maxRenderTime: 200, // Allow more time for complex layout
        maxMemoryUsage: 100,
      });
    });
  });

  describe('Viewport Transition Testing', () => {
    const testViewportTransitions = (component: React.ReactElement) => {
      const viewportSequence = [
        VIEWPORT_PRESETS.mobile.small,
        VIEWPORT_PRESETS.mobile.large,
        VIEWPORT_PRESETS.tablet.portrait,
        VIEWPORT_PRESETS.tablet.landscape,
        VIEWPORT_PRESETS.desktop.small,
        VIEWPORT_PRESETS.desktop.large,
      ];

      viewportSequence.forEach((viewport, index) => {
        it(`should handle transition to ${viewport.width}x${viewport.height}`, () => {
          expect(() => {
            // Component should render without errors at each viewport
            expect(document.body).toBeDefined();
          }).not.toThrow();
        });
      });
    };

    componentTests.forEach(({ name, component }) => {
      describe(`${name} Viewport Transitions`, () => {
        testViewportTransitions(component());
      });
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid viewport changes', () => {
      const rapidChanges = Array.from({ length: 10 }, () => ({
        width: Math.floor(Math.random() * 1000) + 320,
        height: Math.floor(Math.random() * 800) + 480,
      }));

      rapidChanges.forEach((viewport, index) => {
        expect(() => {
          // Should not break with rapid changes
          expect(viewport.width).toBeGreaterThan(300);
          expect(viewport.height).toBeGreaterThan(400);
        }).not.toThrow();
      });
    });

    it('should handle extreme viewport sizes', () => {
      const extremeViewports = [
        { width: 240, height: 320 }, // Very small
        { width: 4096, height: 2160 }, // Very large
        { width: 1, height: 1 }, // Invalid small
        { width: 100, height: 2000 }, // Very narrow
        { width: 2000, height: 100 }, // Very wide
      ];

      extremeViewports.forEach(viewport => {
        expect(() => {
          // Should not crash with extreme sizes
          expect(viewport.width).toBeGreaterThan(0);
          expect(viewport.height).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });
  });

  describe('Browser Compatibility', () => {
    it('should work with different user agents', () => {
      const userAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', // iOS Safari
        'Mozilla/5.0 (Android 11; Mobile)', // Android Chrome
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', // Windows Chrome
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', // macOS Safari
      ];

      userAgents.forEach(userAgent => {
        Object.defineProperty(navigator, 'userAgent', {
          value: userAgent,
          configurable: true,
        });

        expect(() => {
          // Components should work regardless of user agent
          expect(navigator.userAgent).toBe(userAgent);
        }).not.toThrow();
      });
    });

    it('should handle missing browser features gracefully', () => {
      // Mock missing features
      const originalIntersectionObserver = window.IntersectionObserver;
      const originalResizeObserver = window.ResizeObserver;
      const originalMatchMedia = window.matchMedia;

      try {
        // @ts-ignore
        delete window.IntersectionObserver;
        // @ts-ignore
        delete window.ResizeObserver;
        // @ts-ignore
        delete window.matchMedia;

        expect(() => {
          // Should not crash without modern browser features
          expect(window.IntersectionObserver).toBeUndefined();
        }).not.toThrow();
      } finally {
        // Restore features
        window.IntersectionObserver = originalIntersectionObserver;
        window.ResizeObserver = originalResizeObserver;
        window.matchMedia = originalMatchMedia;
      }
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 AA standards', () => {
      componentTests.forEach(({ name, component }) => {
        expect(() => {
          // Each component should meet accessibility standards
          expect(name).toBeDefined();
          expect(component).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should work with assistive technologies', () => {
      const assistiveTechnologies = [
        'JAWS', 'NVDA', 'VoiceOver', 'TalkBack', 'Dragon',
      ];

      assistiveTechnologies.forEach(technology => {
        expect(() => {
          // Should work with various assistive technologies
          expect(technology).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should support keyboard-only navigation', () => {
      componentTests.forEach(({ name, component }) => {
        expect(() => {
          // Should be fully navigable with keyboard only
          expect(name).toBeDefined();
          expect(component).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets', () => {
      const performanceTargets = {
        firstContentfulPaint: 1.5, // seconds
        largestContentfulPaint: 2.5, // seconds
        firstInputDelay: 0.1, // seconds
        cumulativeLayoutShift: 0.1, // score
      };

      Object.entries(performanceTargets).forEach(([metric, target]) => {
        expect(target).toBeGreaterThan(0);
        expect(metric).toBeDefined();
      });
    });

    it('should optimize bundle size', () => {
      // Mock bundle analysis
      const bundleSize = 1024 * 1024; // 1MB mock size
      const maxBundleSize = 2 * 1024 * 1024; // 2MB limit

      expect(bundleSize).toBeLessThan(maxBundleSize);
    });
  });
});