/**
 * Responsive utility hooks for React applications
 * 
 * This module provides a comprehensive set of hooks for handling responsive design,
 * device detection, and adaptive UI behavior.
 */

// Constants
export * from './constants';

// Media query hooks
export {
  useMediaQuery,
  useAllMediaQueries,
  useAnyMediaQuery,
} from './useMediaQuery';

// Breakpoint hooks
export {
  useBreakpoint,
  useIsBreakpointUp,
  useIsBreakpointDown,
  useIsBreakpointBetween,
  useCurrentBreakpoint,
} from './useBreakpoint';

// Window size hooks
export {
  useWindowSize,
  useViewportSize,
  useIsWindowSize,
  useAspectRatio,
  useWindowOrientation,
} from './useWindowSize';

// Touch detection hooks
export {
  useTouchDetection,
  useIsTouchDevice,
  useHasHover,
  useHasMouse,
  usePrimaryPointer,
} from './useTouchDetection';

// Device orientation hooks
export {
  useDeviceOrientation,
  useIsPortrait,
  useIsLandscape,
  useOrientationAngle,
  useOrientationLock,
} from './useDeviceOrientation';

// Main responsive hook and utilities
export {
  useResponsive,
  useDeviceType,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsSSR,
  useIsBrowser,
  useUserPreferences,
} from './useResponsive';

// Re-export types
export type {
  Breakpoint,
  DeviceType,
  Orientation,
  MediaQueryKey,
} from './constants';