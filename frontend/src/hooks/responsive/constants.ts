/**
 * Responsive breakpoint definitions matching Tailwind CSS
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Device type constants
 */
export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
} as const;

/**
 * Orientation constants
 */
export const ORIENTATIONS = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
} as const;

/**
 * Common media queries
 */
export const MEDIA_QUERIES = {
  // Breakpoint queries
  sm: `(min-width: ${BREAKPOINTS.sm}px)`,
  md: `(min-width: ${BREAKPOINTS.md}px)`,
  lg: `(min-width: ${BREAKPOINTS.lg}px)`,
  xl: `(min-width: ${BREAKPOINTS.xl}px)`,
  '2xl': `(min-width: ${BREAKPOINTS['2xl']}px)`,
  
  // Max width queries
  smMax: `(max-width: ${BREAKPOINTS.sm - 1}px)`,
  mdMax: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  lgMax: `(max-width: ${BREAKPOINTS.lg - 1}px)`,
  xlMax: `(max-width: ${BREAKPOINTS.xl - 1}px)`,
  '2xlMax': `(max-width: ${BREAKPOINTS['2xl'] - 1}px)`,
  
  // Feature queries
  touch: '(hover: none) and (pointer: coarse)',
  hover: '(hover: hover) and (pointer: fine)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  darkMode: '(prefers-color-scheme: dark)',
  highContrast: '(prefers-contrast: high)',
  
  // Orientation queries
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  
  // Device-specific queries
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
  
  // Retina/high-DPI screens
  retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',
} as const;

/**
 * Default debounce delay for resize events (in milliseconds)
 */
export const DEFAULT_DEBOUNCE_DELAY = 150;

/**
 * Type definitions
 */
export type Breakpoint = keyof typeof BREAKPOINTS;
export type DeviceType = typeof DEVICE_TYPES[keyof typeof DEVICE_TYPES];
export type Orientation = typeof ORIENTATIONS[keyof typeof ORIENTATIONS];
export type MediaQueryKey = keyof typeof MEDIA_QUERIES;