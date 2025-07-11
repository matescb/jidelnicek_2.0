/**
 * Test utilities for responsive testing
 */

import { act } from '@testing-library/react';

/**
 * Mock window resize
 */
export const mockWindowResize = (width: number, height: number) => {
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
    window.dispatchEvent(new Event('resize'));
  });
};

/**
 * Mock media query
 */
export const mockMediaQuery = (query: string, matches: boolean) => {
  const mediaQueryList = {
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    onchange: null,
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((q) => {
      if (q === query) {
        return mediaQueryList;
      }
      return {
        ...mediaQueryList,
        matches: false,
        media: q,
      };
    }),
  });

  return mediaQueryList;
};

/**
 * Mock touch event
 */
export const createTouchEvent = (
  type: string,
  touches: Array<{ clientX: number; clientY: number }>
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
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
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
 * Mock pointer event
 */
export const createPointerEvent = (
  type: string,
  options: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    pointerType?: string;
  }
) => {
  return new PointerEvent(type, {
    clientX: options.clientX,
    clientY: options.clientY,
    pointerId: options.pointerId || 1,
    pointerType: options.pointerType || 'touch',
    bubbles: true,
    cancelable: true,
  });
};

/**
 * Viewport presets
 */
export const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

/**
 * Wait for animations
 */
export const waitForAnimation = (duration = 300) => {
  return new Promise((resolve) => setTimeout(resolve, duration));
};

/**
 * Mock intersection observer
 */
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  window.IntersectionObserver = mockIntersectionObserver as any;
  return mockIntersectionObserver;
};

/**
 * Mock resize observer
 */
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  window.ResizeObserver = mockResizeObserver as any;
  return mockResizeObserver;
};

/**
 * Get computed styles helper
 */
export const getComputedStyles = (element: HTMLElement) => {
  const styles = window.getComputedStyle(element);
  return {
    width: styles.width,
    height: styles.height,
    display: styles.display,
    flexDirection: styles.flexDirection,
    gridTemplateColumns: styles.gridTemplateColumns,
    fontSize: styles.fontSize,
    padding: styles.padding,
    margin: styles.margin,
  };
};

/**
 * Simulate swipe gesture
 */
export const simulateSwipe = async (
  element: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  duration = 300
) => {
  const steps = 10;
  const deltaX = (endX - startX) / steps;
  const deltaY = (endY - startY) / steps;
  const stepDuration = duration / steps;

  // Start
  element.dispatchEvent(
    createTouchEvent('touchstart', [{ clientX: startX, clientY: startY }])
  );

  // Move
  for (let i = 1; i <= steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, stepDuration));
    element.dispatchEvent(
      createTouchEvent('touchmove', [
        {
          clientX: startX + deltaX * i,
          clientY: startY + deltaY * i,
        },
      ])
    );
  }

  // End
  element.dispatchEvent(
    createTouchEvent('touchend', [{ clientX: endX, clientY: endY }])
  );
};

/**
 * Simulate pinch gesture
 */
export const simulatePinch = async (
  element: HTMLElement,
  scale: number,
  duration = 300
) => {
  const centerX = element.offsetWidth / 2;
  const centerY = element.offsetHeight / 2;
  const initialDistance = 100;
  const finalDistance = initialDistance * scale;
  const steps = 10;
  const stepDuration = duration / steps;

  // Start with two fingers
  element.dispatchEvent(
    createTouchEvent('touchstart', [
      { clientX: centerX - initialDistance / 2, clientY: centerY },
      { clientX: centerX + initialDistance / 2, clientY: centerY },
    ])
  );

  // Move fingers
  for (let i = 1; i <= steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, stepDuration));
    const currentDistance =
      initialDistance + ((finalDistance - initialDistance) * i) / steps;
    element.dispatchEvent(
      createTouchEvent('touchmove', [
        { clientX: centerX - currentDistance / 2, clientY: centerY },
        { clientX: centerX + currentDistance / 2, clientY: centerY },
      ])
    );
  }

  // End
  element.dispatchEvent(
    createTouchEvent('touchend', [
      { clientX: centerX - finalDistance / 2, clientY: centerY },
      { clientX: centerX + finalDistance / 2, clientY: centerY },
    ])
  );
};