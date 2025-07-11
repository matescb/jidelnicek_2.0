import { useMemo } from 'react';
import { useBreakpoint } from './useBreakpoint';
import { useWindowSize } from './useWindowSize';
import { useTouchDetection } from './useTouchDetection';
import { useDeviceOrientation } from './useDeviceOrientation';
import { useMediaQuery } from './useMediaQuery';
import { DEVICE_TYPES, MEDIA_QUERIES, DeviceType } from './constants';

interface ResponsiveState {
  // Device type
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  
  // Breakpoint info
  breakpoint: ReturnType<typeof useBreakpoint>;
  
  // Window dimensions
  windowSize: ReturnType<typeof useWindowSize>;
  width: number;
  height: number;
  
  // Touch capabilities
  touch: ReturnType<typeof useTouchDetection>;
  isTouch: boolean;
  hasHover: boolean;
  
  // Orientation
  orientation: ReturnType<typeof useDeviceOrientation>;
  isPortrait: boolean;
  isLandscape: boolean;
  
  // Utility flags
  isSSR: boolean;
  isBrowser: boolean;
  isRetina: boolean;
  prefersReducedMotion: boolean;
  prefersDarkMode: boolean;
  prefersHighContrast: boolean;
}

/**
 * Main responsive hook combining all responsive utilities
 * @returns Comprehensive responsive state object
 */
export function useResponsive(): ResponsiveState {
  // Get all responsive data
  const breakpoint = useBreakpoint();
  const windowSize = useWindowSize();
  const touch = useTouchDetection();
  const orientation = useDeviceOrientation();
  
  // Additional media queries
  const isRetina = useMediaQuery(MEDIA_QUERIES.retina);
  const prefersReducedMotion = useMediaQuery(MEDIA_QUERIES.reducedMotion);
  const prefersDarkMode = useMediaQuery(MEDIA_QUERIES.darkMode);
  const prefersHighContrast = useMediaQuery(MEDIA_QUERIES.highContrast);
  
  // Device type detection
  const isMobileQuery = useMediaQuery(MEDIA_QUERIES.mobile);
  const isTabletQuery = useMediaQuery(MEDIA_QUERIES.tablet);
  const isDesktopQuery = useMediaQuery(MEDIA_QUERIES.desktop);
  
  // Determine device type
  const deviceType = useMemo((): DeviceType => {
    if (isMobileQuery) return DEVICE_TYPES.MOBILE;
    if (isTabletQuery) return DEVICE_TYPES.TABLET;
    return DEVICE_TYPES.DESKTOP;
  }, [isMobileQuery, isTabletQuery]);
  
  // SSR detection
  const isSSR = typeof window === 'undefined';
  const isBrowser = !isSSR;
  
  return {
    // Device type
    deviceType,
    isMobile: deviceType === DEVICE_TYPES.MOBILE,
    isTablet: deviceType === DEVICE_TYPES.TABLET,
    isDesktop: deviceType === DEVICE_TYPES.DESKTOP,
    
    // Breakpoint info
    breakpoint,
    
    // Window dimensions
    windowSize,
    width: windowSize.width,
    height: windowSize.height,
    
    // Touch capabilities
    touch,
    isTouch: touch.hasTouch,
    hasHover: touch.hasHover,
    
    // Orientation
    orientation,
    isPortrait: orientation.isPortrait,
    isLandscape: orientation.isLandscape,
    
    // Utility flags
    isSSR,
    isBrowser,
    isRetina,
    prefersReducedMotion,
    prefersDarkMode,
    prefersHighContrast,
  };
}

/**
 * Hook for device type detection
 * @returns Current device type
 */
export function useDeviceType(): DeviceType {
  const { deviceType } = useResponsive();
  return deviceType;
}

/**
 * Hook for checking if device is mobile
 * @returns Boolean indicating if device is mobile
 */
export function useIsMobile(): boolean {
  const { isMobile } = useResponsive();
  return isMobile;
}

/**
 * Hook for checking if device is tablet
 * @returns Boolean indicating if device is tablet
 */
export function useIsTablet(): boolean {
  const { isTablet } = useResponsive();
  return isTablet;
}

/**
 * Hook for checking if device is desktop
 * @returns Boolean indicating if device is desktop
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useResponsive();
  return isDesktop;
}

/**
 * Hook for checking if code is running on server (SSR)
 * @returns Boolean indicating SSR environment
 */
export function useIsSSR(): boolean {
  return typeof window === 'undefined';
}

/**
 * Hook for checking if code is running in browser
 * @returns Boolean indicating browser environment
 */
export function useIsBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Hook for checking user preferences
 * @returns Object with user preference flags
 */
export function useUserPreferences(): {
  prefersReducedMotion: boolean;
  prefersDarkMode: boolean;
  prefersHighContrast: boolean;
} {
  const prefersReducedMotion = useMediaQuery(MEDIA_QUERIES.reducedMotion);
  const prefersDarkMode = useMediaQuery(MEDIA_QUERIES.darkMode);
  const prefersHighContrast = useMediaQuery(MEDIA_QUERIES.highContrast);
  
  return {
    prefersReducedMotion,
    prefersDarkMode,
    prefersHighContrast,
  };
}