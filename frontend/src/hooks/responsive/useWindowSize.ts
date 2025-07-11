import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_DEBOUNCE_DELAY } from './constants';

interface WindowSize {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
}

interface UseWindowSizeOptions {
  debounce?: number;
  initialWidth?: number;
  initialHeight?: number;
  includeScrollbar?: boolean;
}

/**
 * Hook for tracking window dimensions
 * @param options - Configuration options
 * @returns Object with current window dimensions
 */
export function useWindowSize(options: UseWindowSizeOptions = {}): WindowSize {
  const {
    debounce = DEFAULT_DEBOUNCE_DELAY,
    initialWidth = 0,
    initialHeight = 0,
    includeScrollbar = true,
  } = options;
  
  // Initialize state with SSR-safe values
  const [windowSize, setWindowSize] = useState<WindowSize>(() => ({
    width: initialWidth,
    height: initialHeight,
    innerWidth: initialWidth,
    innerHeight: initialHeight,
    outerWidth: initialWidth,
    outerHeight: initialHeight,
  }));
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Get current window size
  const getWindowSize = useCallback((): WindowSize => {
    if (typeof window === 'undefined') {
      return {
        width: initialWidth,
        height: initialHeight,
        innerWidth: initialWidth,
        innerHeight: initialHeight,
        outerWidth: initialWidth,
        outerHeight: initialHeight,
      };
    }
    
    // Get dimensions
    const width = includeScrollbar
      ? window.innerWidth
      : document.documentElement.clientWidth;
    const height = includeScrollbar
      ? window.innerHeight
      : document.documentElement.clientHeight;
    
    return {
      width,
      height,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
    };
  }, [initialWidth, initialHeight, includeScrollbar]);
  
  // Handle resize event
  const handleResize = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setWindowSize(getWindowSize());
    }, debounce);
  }, [getWindowSize, debounce]);
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Set initial size
    setWindowSize(getWindowSize());
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation change on mobile devices
    if ('orientationchange' in window) {
      window.addEventListener('orientationchange', handleResize);
    }
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if ('orientationchange' in window) {
        window.removeEventListener('orientationchange', handleResize);
      }
    };
  }, [handleResize, getWindowSize]);
  
  return windowSize;
}

/**
 * Hook for tracking viewport dimensions (simplified version)
 * @param options - Configuration options
 * @returns Object with width and height
 */
export function useViewportSize(options?: UseWindowSizeOptions): {
  width: number;
  height: number;
} {
  const { width, height } = useWindowSize(options);
  return { width, height };
}

/**
 * Hook for checking if window is at least a certain size
 * @param minWidth - Minimum width to check
 * @param minHeight - Optional minimum height to check
 * @returns Boolean indicating if window meets size requirements
 */
export function useIsWindowSize(
  minWidth: number,
  minHeight?: number
): boolean {
  const { width, height } = useWindowSize();
  
  if (minHeight !== undefined) {
    return width >= minWidth && height >= minHeight;
  }
  
  return width >= minWidth;
}

/**
 * Hook for getting window aspect ratio
 * @returns Current aspect ratio
 */
export function useAspectRatio(): number {
  const { width, height } = useWindowSize();
  return height > 0 ? width / height : 0;
}

/**
 * Hook for checking if window is in portrait or landscape orientation
 * @returns Object with orientation info
 */
export function useWindowOrientation(): {
  isPortrait: boolean;
  isLandscape: boolean;
  aspectRatio: number;
} {
  const aspectRatio = useAspectRatio();
  
  return {
    isPortrait: aspectRatio < 1,
    isLandscape: aspectRatio >= 1,
    aspectRatio,
  };
}