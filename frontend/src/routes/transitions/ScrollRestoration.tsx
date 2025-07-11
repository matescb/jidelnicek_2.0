import React, { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
}

interface ScrollRestorationProps {
  children?: React.ReactNode;
  enabled?: boolean;
  smooth?: boolean;
  delay?: number;
  excludePaths?: string[];
  onRestore?: (position: ScrollPosition) => void;
  onSave?: (position: ScrollPosition) => void;
  scrollBehavior?: ScrollBehavior;
  offset?: number;
  restoreKey?: string;
}

// Global scroll position storage
const scrollPositions = new Map<string, ScrollPosition>();
const MAX_STORED_POSITIONS = 50;

export const ScrollRestoration: React.FC<ScrollRestorationProps> = ({
  children,
  enabled = true,
  smooth = true,
  delay = 0,
  excludePaths = [],
  onRestore,
  onSave,
  scrollBehavior = 'auto',
  offset = 0,
  restoreKey,
}) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPathRef = useRef<string | null>(null);
  const restorationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save scroll position before navigation
  const saveScrollPosition = useCallback(() => {
    const path = previousPathRef.current;
    if (!path || excludePaths.includes(path)) return;

    const position: ScrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
    };

    const key = restoreKey ? `${path}:${restoreKey}` : path;
    scrollPositions.set(key, position);

    // Call save callback
    if (onSave) {
      onSave(position);
    }

    // Cleanup old positions
    if (scrollPositions.size > MAX_STORED_POSITIONS) {
      const oldestKey = Array.from(scrollPositions.keys())[0];
      scrollPositions.delete(oldestKey);
    }
  }, [excludePaths, restoreKey, onSave]);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    const path = location.pathname + location.search;
    const key = restoreKey ? `${path}:${restoreKey}` : path;
    const savedPosition = scrollPositions.get(key);

    if (savedPosition && navigationType === 'POP') {
      const scrollOptions: ScrollToOptions = {
        left: savedPosition.x,
        top: Math.max(0, savedPosition.y - offset),
        behavior: smooth ? 'smooth' : scrollBehavior,
      };

      if (delay > 0) {
        restorationTimerRef.current = setTimeout(() => {
          window.scrollTo(scrollOptions);
          if (onRestore) {
            onRestore(savedPosition);
          }
        }, delay);
      } else {
        window.scrollTo(scrollOptions);
        if (onRestore) {
          onRestore(savedPosition);
        }
      }
    } else if (navigationType !== 'POP') {
      // For forward navigation, optionally scroll to top
      const scrollToTop = !excludePaths.includes(path);
      if (scrollToTop) {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: smooth ? 'smooth' : scrollBehavior,
        });
      }
    }
  }, [location, navigationType, smooth, delay, excludePaths, onRestore, scrollBehavior, offset, restoreKey]);

  // Handle hash navigation
  const handleHashNavigation = useCallback(() => {
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        const offset = targetElement.offsetTop - 80; // Account for fixed header
        window.scrollTo({
          top: offset,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    }
  }, [location.hash, smooth]);

  useEffect(() => {
    if (!enabled) return;

    // Save previous path
    if (previousPathRef.current && previousPathRef.current !== location.pathname) {
      saveScrollPosition();
    }

    // Update previous path
    previousPathRef.current = location.pathname;

    // Clear any pending restoration
    if (restorationTimerRef.current) {
      clearTimeout(restorationTimerRef.current);
    }

    // Restore position or handle hash navigation
    if (location.hash) {
      // Delay hash navigation to ensure DOM is ready
      setTimeout(handleHashNavigation, 100);
    } else {
      restoreScrollPosition();
    }

    return () => {
      if (restorationTimerRef.current) {
        clearTimeout(restorationTimerRef.current);
      }
    };
  }, [location, enabled, saveScrollPosition, restoreScrollPosition, handleHashNavigation]);

  // Save position on unmount
  useEffect(() => {
    return () => {
      if (previousPathRef.current) {
        saveScrollPosition();
      }
    };
  }, [saveScrollPosition]);

  return <>{children}</>;
};

// Hook for manual scroll management
export const useScrollRestoration = (options: Omit<ScrollRestorationProps, 'children'> = {}) => {
  const location = useLocation();
  const { enabled = true, smooth = true, excludePaths = [] } = options;

  const saveCurrentPosition = useCallback(() => {
    const path = location.pathname + location.search;
    if (excludePaths.includes(path)) return;

    const position: ScrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
    };

    scrollPositions.set(path, position);
  }, [location, excludePaths]);

  const restorePosition = useCallback((path?: string) => {
    const targetPath = path || location.pathname + location.search;
    const savedPosition = scrollPositions.get(targetPath);

    if (savedPosition) {
      window.scrollTo({
        left: savedPosition.x,
        top: savedPosition.y,
        behavior: smooth ? 'smooth' : 'auto',
      });
      return savedPosition;
    }
    return null;
  }, [location, smooth]);

  const scrollToTop = useCallback((options?: ScrollToOptions) => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: smooth ? 'smooth' : 'auto',
      ...options,
    });
  }, [smooth]);

  const scrollToElement = useCallback((elementId: string, offset = 0) => {
    const element = document.getElementById(elementId);
    if (element) {
      const top = element.offsetTop - offset;
      window.scrollTo({
        top,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, [smooth]);

  const getStoredPosition = useCallback((path?: string): ScrollPosition | null => {
    const targetPath = path || location.pathname + location.search;
    return scrollPositions.get(targetPath) || null;
  }, [location]);

  const clearStoredPositions = useCallback(() => {
    scrollPositions.clear();
  }, []);

  return {
    saveCurrentPosition,
    restorePosition,
    scrollToTop,
    scrollToElement,
    getStoredPosition,
    clearStoredPositions,
    enabled,
  };
};

// Component for scroll-to-top button
interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
  smooth?: boolean;
  position?: 'left' | 'right';
  offset?: { bottom?: string; left?: string; right?: string };
  ariaLabel?: string;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  threshold = 300,
  className = '',
  smooth = true,
  position = 'right',
  offset = { bottom: '1rem', right: '1rem' },
  ariaLabel = 'Scroll to top',
}) => {
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  if (!visible) return null;

  const positionStyles = position === 'left' 
    ? { left: offset.left || '1rem' }
    : { right: offset.right || '1rem' };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all transform ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
      } ${className}`}
      style={{
        bottom: offset.bottom || '1rem',
        ...positionStyles,
      }}
      aria-label={ariaLabel}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
};