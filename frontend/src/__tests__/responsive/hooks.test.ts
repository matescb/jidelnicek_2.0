/**
 * Tests for responsive hooks
 */

import { renderHook, act } from '@testing-library/react';
import {
  useMediaQuery,
  useBreakpoint,
  useResponsive,
  useWindowSize,
} from '../../hooks/useResponsive';
import { mockWindowResize, mockMediaQuery, viewports } from './utils';

describe('useMediaQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct match status', () => {
    const query = '(min-width: 768px)';
    mockMediaQuery(query, true);

    const { result } = renderHook(() => useMediaQuery(query));
    expect(result.current).toBe(true);
  });

  it('should update on media query change', () => {
    const query = '(min-width: 768px)';
    const mediaQueryList = mockMediaQuery(query, false);

    const { result } = renderHook(() => useMediaQuery(query));
    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      mediaQueryList.matches = true;
      const listeners = mediaQueryList.addEventListener.mock.calls
        .filter(([event]) => event === 'change')
        .map(([, listener]) => listener);
      listeners.forEach((listener) => listener({ matches: true } as any));
    });

    expect(result.current).toBe(true);
  });

  it('should handle SSR safely', () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    global.window = originalWindow;
  });

  it('should clean up listeners on unmount', () => {
    const query = '(min-width: 768px)';
    const mediaQueryList = mockMediaQuery(query, true);

    const { unmount } = renderHook(() => useMediaQuery(query));
    unmount();

    expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });
});

describe('useBreakpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should detect mobile breakpoint', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    mockMediaQuery('(max-width: 639px)', true);
    mockMediaQuery('(min-width: 640px) and (max-width: 767px)', false);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', false);
    mockMediaQuery('(min-width: 1024px) and (max-width: 1279px)', false);
    mockMediaQuery('(min-width: 1280px)', false);

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('xs');
  });

  it('should detect tablet breakpoint', () => {
    mockWindowResize(viewports.tablet.width, viewports.tablet.height);
    mockMediaQuery('(max-width: 639px)', false);
    mockMediaQuery('(min-width: 640px) and (max-width: 767px)', false);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', true);
    mockMediaQuery('(min-width: 1024px) and (max-width: 1279px)', false);
    mockMediaQuery('(min-width: 1280px)', false);

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('md');
  });

  it('should detect desktop breakpoint', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
    mockMediaQuery('(max-width: 639px)', false);
    mockMediaQuery('(min-width: 640px) and (max-width: 767px)', false);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', false);
    mockMediaQuery('(min-width: 1024px) and (max-width: 1279px)', false);
    mockMediaQuery('(min-width: 1280px)', true);

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('xl');
  });

  it('should update on window resize', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    mockMediaQuery('(max-width: 639px)', true);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', false);

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('xs');

    // Resize to tablet
    act(() => {
      mockWindowResize(viewports.tablet.width, viewports.tablet.height);
      mockMediaQuery('(max-width: 639px)', false);
      mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', true);
    });

    expect(result.current).toBe('md');
  });
});

describe('useResponsive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should detect mobile device', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    mockMediaQuery('(max-width: 767px)', true);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', false);
    mockMediaQuery('(min-width: 1024px)', false);

    const { result } = renderHook(() => useResponsive());
    expect(result.current).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouch: false,
    });
  });

  it('should detect tablet device', () => {
    mockWindowResize(viewports.tablet.width, viewports.tablet.height);
    mockMediaQuery('(max-width: 767px)', false);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', true);
    mockMediaQuery('(min-width: 1024px)', false);

    const { result } = renderHook(() => useResponsive());
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isTouch: false,
    });
  });

  it('should detect desktop device', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
    mockMediaQuery('(max-width: 767px)', false);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', false);
    mockMediaQuery('(min-width: 1024px)', true);

    const { result } = renderHook(() => useResponsive());
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouch: false,
    });
  });

  it('should detect touch capability', () => {
    // Mock touch support
    Object.defineProperty(window, 'ontouchstart', {
      value: () => {},
      writable: true,
    });

    mockWindowResize(viewports.tablet.width, viewports.tablet.height);
    mockMediaQuery('(max-width: 767px)', false);
    mockMediaQuery('(min-width: 768px) and (max-width: 1023px)', true);
    mockMediaQuery('(min-width: 1024px)', false);

    const { result } = renderHook(() => useResponsive());
    expect(result.current.isTouch).toBe(true);

    // Clean up
    delete (window as any).ontouchstart;
  });
});

describe('useWindowSize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
  });

  it('should return initial window size', () => {
    const { result } = renderHook(() => useWindowSize());
    expect(result.current).toEqual({
      width: viewports.desktop.width,
      height: viewports.desktop.height,
    });
  });

  it('should update on window resize', () => {
    const { result } = renderHook(() => useWindowSize());
    expect(result.current).toEqual({
      width: viewports.desktop.width,
      height: viewports.desktop.height,
    });

    act(() => {
      mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    });

    expect(result.current).toEqual({
      width: viewports.mobile.width,
      height: viewports.mobile.height,
    });
  });

  it('should debounce resize events', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useWindowSize());

    // Trigger multiple rapid resizes
    act(() => {
      mockWindowResize(1000, 800);
      mockWindowResize(1100, 800);
      mockWindowResize(1200, 800);
    });

    // Should not update immediately
    expect(result.current.width).toBe(viewports.desktop.width);

    // Fast forward debounce timer
    act(() => {
      jest.advanceTimersByTime(150);
    });

    // Should update to last resize
    expect(result.current.width).toBe(1200);

    jest.useRealTimers();
  });

  it('should handle SSR safely', () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    const { result } = renderHook(() => useWindowSize());
    expect(result.current).toEqual({
      width: 0,
      height: 0,
    });

    global.window = originalWindow;
  });

  it('should clean up resize listener on unmount', () => {
    const removeEventListener = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useWindowSize());
    
    unmount();
    
    expect(removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});