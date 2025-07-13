/**
 * Enhanced responsive testing utilities
 */

import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { BREAKPOINTS } from '../../hooks/responsive/constants';

/**
 * Extended viewport presets for comprehensive testing
 */
export const VIEWPORT_PRESETS = {
  // Mobile devices
  mobile: {
    small: { width: 320, height: 568 }, // iPhone SE
    medium: { width: 375, height: 667 }, // iPhone 8
    large: { width: 414, height: 896 }, // iPhone 11 Pro Max
  },
  // Tablets
  tablet: {
    portrait: { width: 768, height: 1024 }, // iPad portrait
    landscape: { width: 1024, height: 768 }, // iPad landscape
    mini: { width: 744, height: 1133 }, // iPad Mini
    pro: { width: 1024, height: 1366 }, // iPad Pro
  },
  // Desktop
  desktop: {
    small: { width: 1280, height: 720 }, // HD
    medium: { width: 1440, height: 900 }, // MacBook Air
    large: { width: 1920, height: 1080 }, // Full HD
    wide: { width: 2560, height: 1440 }, // QHD
    ultrawide: { width: 3440, height: 1440 }, // Ultrawide
  },
  // Special cases
  special: {
    square: { width: 800, height: 800 },
    vertical: { width: 480, height: 1200 },
    tiny: { width: 240, height: 320 },
  },
} as const;

/**
 * Device pixel ratios for testing
 */
export const DEVICE_PIXEL_RATIOS = {
  standard: 1,
  retina: 2,
  highDpi: 3,
} as const;

/**
 * Touch simulation utilities
 */
export interface TouchEventOptions {
  clientX: number;
  clientY: number;
  force?: number;
  radiusX?: number;
  radiusY?: number;
}

export const createTouchEvent = (
  type: string,
  touches: TouchEventOptions[]
) => {
  const touchList = touches.map((touch, index) => ({
    identifier: index,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.clientX,
    pageY: touch.clientY,
    screenX: touch.clientX,
    screenY: touch.clientY,
    target: document.body,
    radiusX: touch.radiusX || 0,
    radiusY: touch.radiusY || 0,
    rotationAngle: 0,
    force: touch.force || 1,
  }));

  return new TouchEvent(type, {
    touches: touchList as any,
    targetTouches: touchList as any,
    changedTouches: touchList as any,
    bubbles: true,
    cancelable: true,
  });
};

/**
 * Enhanced window resize with device pixel ratio
 */
export const mockWindowResize = (
  width: number,
  height: number,
  devicePixelRatio: number = 1
) => {
  act(() => {
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
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: devicePixelRatio,
    });
    window.dispatchEvent(new Event('resize'));
  });
};

/**
 * Mock device orientation
 */
export const mockDeviceOrientation = (
  orientation: 'portrait' | 'landscape'
) => {
  const angle = orientation === 'portrait' ? 0 : 90;
  
  Object.defineProperty(window.screen, 'orientation', {
    writable: true,
    configurable: true,
    value: {
      angle,
      type: orientation === 'portrait' ? 'portrait-primary' : 'landscape-primary',
    },
  });
  
  // Mock orientation media query
  const mediaQuery = `(orientation: ${orientation})`;
  mockMediaQuery(mediaQuery, true);
  
  window.dispatchEvent(new Event('orientationchange'));
};

/**
 * Enhanced media query mocking with multiple queries
 */
export const mockMediaQueries = (queries: Record<string, boolean>) => {
  const mediaQueryLists: Record<string, any> = {};
  
  Object.entries(queries).forEach(([query, matches]) => {
    const mediaQueryList = {
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
    };
    
    mediaQueryLists[query] = mediaQueryList;
  });
  
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => {
      return mediaQueryLists[query] || {
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
      };
    }),
  });
  
  return mediaQueryLists;
};

/**
 * Single media query mock (maintaining backward compatibility)
 */
export const mockMediaQuery = (query: string, matches: boolean) => {
  return mockMediaQueries({ [query]: matches })[query];
};

/**
 * Test responsive breakpoint behavior
 */
export const testBreakpointBehavior = async (
  component: () => JSX.Element,
  tests: Array<{
    viewport: { width: number; height: number };
    expectedBreakpoint: string;
    assertions: () => void;
  }>
) => {
  for (const test of tests) {
    mockWindowResize(test.viewport.width, test.viewport.height);
    
    // Set up media queries for this breakpoint
    const queries: Record<string, boolean> = {};
    Object.entries(BREAKPOINTS).forEach(([bp, minWidth]) => {
      queries[`(min-width: ${minWidth}px)`] = test.viewport.width >= minWidth;
    });
    mockMediaQueries(queries);
    
    await act(async () => {
      test.assertions();
    });
  }
};

/**
 * Simulate swipe gestures with configurable parameters
 */
export const simulateSwipe = async (
  element: HTMLElement,
  options: {
    direction: 'left' | 'right' | 'up' | 'down';
    distance?: number;
    duration?: number;
    startPosition?: { x: number; y: number };
  }
) => {
  const {
    direction,
    distance = 100,
    duration = 300,
    startPosition = { x: element.offsetWidth / 2, y: element.offsetHeight / 2 },
  } = options;
  
  const steps = 10;
  const stepDuration = duration / steps;
  
  let deltaX = 0;
  let deltaY = 0;
  
  switch (direction) {
    case 'left':
      deltaX = -distance;
      break;
    case 'right':
      deltaX = distance;
      break;
    case 'up':
      deltaY = -distance;
      break;
    case 'down':
      deltaY = distance;
      break;
  }
  
  // Start touch
  element.dispatchEvent(
    createTouchEvent('touchstart', [startPosition])
  );
  
  // Move in steps
  for (let i = 1; i <= steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, stepDuration));
    
    const progress = i / steps;
    element.dispatchEvent(
      createTouchEvent('touchmove', [{
        clientX: startPosition.x + deltaX * progress,
        clientY: startPosition.y + deltaY * progress,
      }])
    );
  }
  
  // End touch
  element.dispatchEvent(
    createTouchEvent('touchend', [{
      clientX: startPosition.x + deltaX,
      clientY: startPosition.y + deltaY,
    }])
  );
};

/**
 * Simulate pinch-to-zoom gesture
 */
export const simulatePinch = async (
  element: HTMLElement,
  options: {
    scale: number;
    duration?: number;
    center?: { x: number; y: number };
  }
) => {
  const {
    scale,
    duration = 300,
    center = { x: element.offsetWidth / 2, y: element.offsetHeight / 2 },
  } = options;
  
  const initialDistance = 100;
  const finalDistance = initialDistance * scale;
  const steps = 10;
  const stepDuration = duration / steps;
  
  // Start with two fingers
  element.dispatchEvent(
    createTouchEvent('touchstart', [
      { clientX: center.x - initialDistance / 2, clientY: center.y },
      { clientX: center.x + initialDistance / 2, clientY: center.y },
    ])
  );
  
  // Pinch gesture
  for (let i = 1; i <= steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, stepDuration));
    
    const currentDistance = initialDistance + ((finalDistance - initialDistance) * i) / steps;
    element.dispatchEvent(
      createTouchEvent('touchmove', [
        { clientX: center.x - currentDistance / 2, clientY: center.y },
        { clientX: center.x + currentDistance / 2, clientY: center.y },
      ])
    );
  }
  
  // End gesture
  element.dispatchEvent(
    createTouchEvent('touchend', [
      { clientX: center.x - finalDistance / 2, clientY: center.y },
      { clientX: center.x + finalDistance / 2, clientY: center.y },
    ])
  );
};

/**
 * Test component at multiple viewports
 */
export const testAtViewports = async (
  renderComponent: () => any,
  viewports: Array<{
    name: string;
    width: number;
    height: number;
    test: () => void | Promise<void>;
  }>
) => {
  for (const viewport of viewports) {
    describe(`at ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      beforeEach(() => {
        mockWindowResize(viewport.width, viewport.height);
      });
      
      it(`should behave correctly at ${viewport.name}`, async () => {
        renderComponent();
        await act(async () => {
          await viewport.test();
        });
      });
    });
  }
};

/**
 * Mock CSS container queries
 */
export const mockContainerQuery = (
  containerSelector: string,
  width: number,
  height: number
) => {
  const container = document.querySelector(containerSelector) as HTMLElement;
  if (!container) return;
  
  Object.defineProperty(container, 'offsetWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(container, 'offsetHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // Trigger resize observer if available
  if (window.ResizeObserver) {
    const resizeEvent = new Event('resize');
    container.dispatchEvent(resizeEvent);
  }
};

/**
 * Test responsive images
 */
export const testResponsiveImages = (container: HTMLElement) => {
  const images = container.querySelectorAll('img[srcset], picture');
  
  images.forEach((img) => {
    if (img.tagName === 'IMG') {
      const srcset = img.getAttribute('srcset');
      const sizes = img.getAttribute('sizes');
      
      expect(srcset).toBeTruthy();
      expect(sizes).toBeTruthy();
    }
    
    if (img.tagName === 'PICTURE') {
      const sources = img.querySelectorAll('source');
      const fallbackImg = img.querySelector('img');
      
      expect(sources.length).toBeGreaterThan(0);
      expect(fallbackImg).toBeTruthy();
    }
  });
};

/**
 * Test responsive typography
 */
export const testResponsiveTypography = (
  element: HTMLElement,
  expectedSizes: Record<string, string>
) => {
  Object.entries(expectedSizes).forEach(([breakpoint, expectedSize]) => {
    const [width] = breakpoint.split('x').map(Number);
    
    mockWindowResize(width, 800);
    
    const computedStyle = getComputedStyle(element);
    expect(computedStyle.fontSize).toBe(expectedSize);
  });
};

/**
 * Test touch targets meet WCAG guidelines
 */
export const testTouchTargets = (container: HTMLElement) => {
  const MINIMUM_TOUCH_TARGET_SIZE = 44; // pixels
  
  const touchTargets = container.querySelectorAll(
    'button, a, input, [role="button"], [role="link"], [tabindex]'
  );
  
  touchTargets.forEach((target) => {
    const rect = target.getBoundingClientRect();
    const computedStyle = getComputedStyle(target as HTMLElement);
    
    const width = Math.max(rect.width, parseFloat(computedStyle.minWidth));
    const height = Math.max(rect.height, parseFloat(computedStyle.minHeight));
    
    expect(width).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_SIZE);
    expect(height).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_SIZE);
  });
};

/**
 * Test responsive grid behavior
 */
export const testResponsiveGrid = (
  gridContainer: HTMLElement,
  expectedColumns: Record<string, number>
) => {
  Object.entries(expectedColumns).forEach(([breakpoint, columns]) => {
    const [width] = breakpoint.split('x').map(Number);
    
    mockWindowResize(width, 800);
    
    const computedStyle = getComputedStyle(gridContainer);
    const gridTemplate = computedStyle.gridTemplateColumns;
    
    if (gridTemplate && gridTemplate !== 'none') {
      const columnCount = gridTemplate.split(' ').length;
      expect(columnCount).toBe(columns);
    }
  });
};

/**
 * Mock reduced motion preference
 */
export const mockReducedMotion = (preferReduced: boolean = true) => {
  mockMediaQuery('(prefers-reduced-motion: reduce)', preferReduced);
};

/**
 * Mock high contrast preference
 */
export const mockHighContrast = (preferHigh: boolean = true) => {
  mockMediaQuery('(prefers-contrast: high)', preferHigh);
};

/**
 * Test component performance at different viewports
 */
export const testResponsivePerformance = async (
  component: () => JSX.Element,
  viewports: Array<{ width: number; height: number }>
) => {
  const results: Array<{
    viewport: string;
    renderTime: number;
    resizeTime: number;
  }> = [];
  
  for (const viewport of viewports) {
    const renderStart = performance.now();
    component();
    const renderEnd = performance.now();
    
    const resizeStart = performance.now();
    mockWindowResize(viewport.width, viewport.height);
    const resizeEnd = performance.now();
    
    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      renderTime: renderEnd - renderStart,
      resizeTime: resizeEnd - resizeStart,
    });
  }
  
  return results;
};