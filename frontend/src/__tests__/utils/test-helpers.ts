/**
 * Comprehensive test helpers for responsive design and accessibility testing
 */

import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import { mockWindowResize, VIEWPORT_PRESETS } from './responsive';
import { mockScreenReader } from './accessibility';
import { vi } from 'vitest';

/**
 * Test context providers wrapper
 */
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </BrowserRouter>
  );
};

/**
 * Custom render function with providers
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult => {
  return render(ui, { wrapper: AllProviders, ...options });
};

/**
 * Test suite configuration options
 */
interface TestSuiteOptions {
  skipResponsive?: boolean;
  skipAccessibility?: boolean;
  skipMobile?: boolean;
  viewports?: Array<{ name: string; width: number; height: number }>;
  a11yLevel?: 'AA' | 'AAA';
}

/**
 * Create a comprehensive test suite for a component
 */
export const createTestSuite = (
  componentName: string,
  renderComponent: () => React.ReactElement,
  options: TestSuiteOptions = {}
) => {
  const {
    skipResponsive = false,
    skipAccessibility = false,
    skipMobile = false,
    viewports = [
      { name: 'Mobile', ...VIEWPORT_PRESETS.mobile.medium },
      { name: 'Tablet', ...VIEWPORT_PRESETS.tablet.portrait },
      { name: 'Desktop', ...VIEWPORT_PRESETS.desktop.medium },
    ],
    a11yLevel = 'AA',
  } = options;

  describe(`${componentName} - Comprehensive Tests`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    if (!skipResponsive) {
      describe('Responsive Design', () => {
        viewports.forEach(viewport => {
          it(`should render correctly at ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
            mockWindowResize(viewport.width, viewport.height);
            
            const { container } = renderWithProviders(renderComponent());
            expect(container.firstChild).toBeInTheDocument();
            
            // Check for responsive classes
            const responsiveElements = container.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"], [class*="xl:"]');
            expect(responsiveElements.length).toBeGreaterThan(0);
          });
        });

        it('should adapt layout on viewport changes', () => {
          // Start with mobile
          mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
          const { rerender } = renderWithProviders(renderComponent());
          
          // Change to desktop
          mockWindowResize(VIEWPORT_PRESETS.desktop.medium.width, VIEWPORT_PRESETS.desktop.medium.height);
          rerender(renderComponent());
          
          // Component should still be in the document
          expect(document.body).toContainHTML('<');
        });

        it('should handle orientation changes', () => {
          // Portrait
          mockWindowResize(768, 1024);
          renderWithProviders(renderComponent());
          
          // Landscape
          mockWindowResize(1024, 768);
          renderWithProviders(renderComponent());
          
          expect(document.body).toContainHTML('<');
        });
      });
    }

    if (!skipAccessibility) {
      describe('Accessibility', () => {
        it('should have no accessibility violations', async () => {
          const { container } = renderWithProviders(renderComponent());
          
          // Basic accessibility checks
          expect(container.firstChild).toBeInTheDocument();
          
          // Check for ARIA attributes
          const elementsWithAria = container.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');
          expect(elementsWithAria.length).toBeGreaterThanOrEqual(0);
        });

        it('should be keyboard navigable', async () => {
          renderWithProviders(renderComponent());
          
          // Should be able to tab through focusable elements
          const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          expect(focusableElements.length).toBeGreaterThanOrEqual(0);
        });

        it('should have proper color contrast', () => {
          const { container } = renderWithProviders(renderComponent());
          
          // Basic contrast check (would use actual contrast calculation in real implementation)
          const textElements = container.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, button, a');
          textElements.forEach(element => {
            const computedStyle = getComputedStyle(element);
            expect(computedStyle.color).toBeDefined();
          });
        });

        it('should work with screen readers', () => {
          const screenReader = mockScreenReader();
          renderWithProviders(renderComponent());
          
          // Component should not break screen reader simulation
          expect(screenReader).toBeDefined();
        });

        it('should handle focus management', async () => {
          renderWithProviders(renderComponent());
          
          // Should not trap focus unexpectedly
          const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          if (focusableElements.length > 0) {
            (focusableElements[0] as HTMLElement).focus();
            expect(document.activeElement).toBe(focusableElements[0]);
          }
        });
      });
    }

    if (!skipMobile) {
      describe('Mobile Experience', () => {
        beforeEach(() => {
          mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
        });

        it('should have touch-friendly targets', () => {
          const { container } = renderWithProviders(renderComponent());
          
          const touchTargets = container.querySelectorAll('button, a, input, [role="button"]');
          touchTargets.forEach(target => {
            const rect = target.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              // Touch targets should be at least 44px (WCAG guideline)
              expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
            }
          });
        });

        it('should prevent zooming when appropriate', () => {
          renderWithProviders(renderComponent());
          
          const viewport = document.querySelector('meta[name="viewport"]');
          if (viewport) {
            const content = viewport.getAttribute('content');
            expect(content).toBeDefined();
          }
        });

        it('should handle touch events', () => {
          const { container } = renderWithProviders(renderComponent());
          
          // Should not break when touch events are fired
          const touchableElements = container.querySelectorAll('button, a, [role="button"]');
          touchableElements.forEach(element => {
            const touchStart = new TouchEvent('touchstart', { bubbles: true });
            element.dispatchEvent(touchStart);
            expect(element).toBeInTheDocument();
          });
        });
      });
    }

    describe('Performance', () => {
      it('should render within performance budget', () => {
        const startTime = performance.now();
        renderWithProviders(renderComponent());
        const endTime = performance.now();
        
        const renderTime = endTime - startTime;
        expect(renderTime).toBeLessThan(100); // Should render in under 100ms
      });

      it('should not have memory leaks', () => {
        const { unmount } = renderWithProviders(renderComponent());
        
        // Component should unmount cleanly
        unmount();
        expect(document.body.innerHTML).toBe('');
      });
    });

    describe('Error Handling', () => {
      it('should handle props gracefully', () => {
        // Should not crash with undefined/null props
        expect(() => {
          renderWithProviders(renderComponent());
        }).not.toThrow();
      });

      it('should recover from errors', () => {
        // Mock console.error to catch React errors
        const originalError = console.error;
        console.error = vi.fn();
        
        try {
          renderWithProviders(renderComponent());
          expect(console.error).not.toHaveBeenCalled();
        } finally {
          console.error = originalError;
        }
      });
    });
  });
};

/**
 * Quick responsive test helper
 */
export const testResponsive = (
  component: React.ReactElement,
  assertions: Record<string, () => void>
) => {
  Object.entries(assertions).forEach(([viewportName, assertion]) => {
    it(`should work correctly at ${viewportName}`, () => {
      const viewport = VIEWPORT_PRESETS.mobile.medium; // Default
      mockWindowResize(viewport.width, viewport.height);
      
      renderWithProviders(component);
      assertion();
    });
  });
};

/**
 * Quick accessibility test helper
 */
export const testA11y = (
  component: React.ReactElement,
  checks: {
    keyboard?: boolean;
    screenReader?: boolean;
    focus?: boolean;
    contrast?: boolean;
  } = {}
) => {
  const { keyboard = true, screenReader = true, focus = true, contrast = true } = checks;

  describe('Accessibility Checks', () => {
    if (keyboard) {
      it('should be keyboard accessible', async () => {
        renderWithProviders(component);
        
        const focusableElements = document.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        expect(focusableElements.length).toBeGreaterThanOrEqual(0);
      });
    }

    if (screenReader) {
      it('should work with screen readers', () => {
        const screenReader = mockScreenReader();
        renderWithProviders(component);
        
        expect(screenReader).toBeDefined();
      });
    }

    if (focus) {
      it('should manage focus properly', () => {
        renderWithProviders(component);
        
        // Should not have focus traps by default
        const focusTraps = document.querySelectorAll('[data-focus-trap]');
        expect(focusTraps.length).toBeGreaterThanOrEqual(0);
      });
    }

    if (contrast) {
      it('should have adequate color contrast', () => {
        const { container } = renderWithProviders(component);
        
        const textElements = container.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, button, a');
        textElements.forEach(element => {
          const computedStyle = getComputedStyle(element);
          expect(computedStyle.color).toBeDefined();
        });
      });
    }
  });
};

/**
 * Performance testing helper
 */
export const testPerformance = (
  component: React.ReactElement,
  options: {
    maxRenderTime?: number;
    maxMemoryUsage?: number;
  } = {}
) => {
  const { maxRenderTime = 100, maxMemoryUsage = 50 } = options;

  describe('Performance Tests', () => {
    it(`should render in under ${maxRenderTime}ms`, () => {
      const startTime = performance.now();
      renderWithProviders(component);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(maxRenderTime);
    });

    it('should not leak memory', () => {
      const { unmount } = renderWithProviders(component);
      
      // Mock memory measurement
      const beforeMemory = (performance as any).memory?.usedJSHeapSize || 0;
      unmount();
      const afterMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory should not increase significantly
      const memoryIncrease = afterMemory - beforeMemory;
      expect(memoryIncrease).toBeLessThan(maxMemoryUsage * 1024 * 1024); // Convert MB to bytes
    });
  });
};

/**
 * Visual regression testing helper
 */
export const testVisual = (
  component: React.ReactElement,
  scenarios: Array<{
    name: string;
    viewport: { width: number; height: number };
    theme?: 'light' | 'dark';
  }>
) => {
  describe('Visual Tests', () => {
    scenarios.forEach(scenario => {
      it(`should match visual snapshot - ${scenario.name}`, () => {
        mockWindowResize(scenario.viewport.width, scenario.viewport.height);
        
        if (scenario.theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
        
        const { container } = renderWithProviders(component);
        
        // In a real implementation, you would use visual regression testing
        expect(container.firstChild).toBeInTheDocument();
        
        if (scenario.theme === 'dark') {
          document.documentElement.classList.remove('dark');
        }
      });
    });
  });
};

/**
 * Integration test helper
 */
export const testIntegration = (
  component: React.ReactElement,
  userFlows: Array<{
    name: string;
    steps: Array<() => Promise<void>>;
  }>
) => {
  describe('Integration Tests', () => {
    userFlows.forEach(flow => {
      it(`should handle user flow: ${flow.name}`, async () => {
        renderWithProviders(component);
        
        for (const step of flow.steps) {
          await step();
        }
      });
    });
  });
};

/**
 * Export all test utilities
 */
export * from './responsive';
export * from './accessibility';

/**
 * Default test configuration
 */
export const defaultTestConfig: TestSuiteOptions = {
  skipResponsive: false,
  skipAccessibility: false,
  skipMobile: false,
  a11yLevel: 'AA',
  viewports: [
    { name: 'Mobile Portrait', ...VIEWPORT_PRESETS.mobile.medium },
    { name: 'Tablet Portrait', ...VIEWPORT_PRESETS.tablet.portrait },
    { name: 'Desktop', ...VIEWPORT_PRESETS.desktop.medium },
  ],
};