import { useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { BREAKPOINTS, MEDIA_QUERIES, Breakpoint } from './constants';

interface BreakpointState {
  current: Breakpoint | 'xs';
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2xl: boolean;
  isSmUp: boolean;
  isMdUp: boolean;
  isLgUp: boolean;
  isXlUp: boolean;
  is2xlUp: boolean;
  isSmDown: boolean;
  isMdDown: boolean;
  isLgDown: boolean;
  isXlDown: boolean;
  is2xlDown: boolean;
}

/**
 * Hook for breakpoint detection and comparison
 * @returns Object with current breakpoint and comparison helpers
 */
export function useBreakpoint(): BreakpointState {
  // Check all breakpoints
  const queries = [
    MEDIA_QUERIES.sm,
    MEDIA_QUERIES.md,
    MEDIA_QUERIES.lg,
    MEDIA_QUERIES.xl,
    MEDIA_QUERIES['2xl'],
  ];
  
  const matches = useMediaQuery(queries) as boolean[];
  const [sm, md, lg, xl, xxl] = matches;
  
  // Determine current breakpoint
  const current = useMemo((): Breakpoint | 'xs' => {
    if (xxl) return '2xl';
    if (xl) return 'xl';
    if (lg) return 'lg';
    if (md) return 'md';
    if (sm) return 'sm';
    return 'xs';
  }, [sm, md, lg, xl, xxl]);
  
  // Build state object
  const state: BreakpointState = useMemo(() => ({
    current,
    // Exact breakpoint checks
    isXs: current === 'xs',
    isSm: current === 'sm',
    isMd: current === 'md',
    isLg: current === 'lg',
    isXl: current === 'xl',
    is2xl: current === '2xl',
    // Up checks (min-width)
    isSmUp: sm,
    isMdUp: md,
    isLgUp: lg,
    isXlUp: xl,
    is2xlUp: xxl,
    // Down checks (max-width)
    isSmDown: !md,
    isMdDown: !lg,
    isLgDown: !xl,
    isXlDown: !xxl,
    is2xlDown: true,
  }), [current, sm, md, lg, xl, xxl]);
  
  return state;
}

/**
 * Hook for checking if current breakpoint is at least the specified size
 * @param breakpoint - Breakpoint to check against
 * @returns Boolean indicating if current breakpoint is >= specified breakpoint
 */
export function useIsBreakpointUp(breakpoint: Breakpoint): boolean {
  const query = MEDIA_QUERIES[breakpoint];
  return useMediaQuery(query);
}

/**
 * Hook for checking if current breakpoint is at most the specified size
 * @param breakpoint - Breakpoint to check against
 * @returns Boolean indicating if current breakpoint is <= specified breakpoint
 */
export function useIsBreakpointDown(breakpoint: Breakpoint): boolean {
  const breakpointIndex = Object.keys(BREAKPOINTS).indexOf(breakpoint);
  const nextBreakpoint = Object.keys(BREAKPOINTS)[breakpointIndex + 1] as Breakpoint | undefined;
  
  if (!nextBreakpoint) {
    return true; // Always true for largest breakpoint
  }
  
  const query = MEDIA_QUERIES[nextBreakpoint];
  return !useMediaQuery(query);
}

/**
 * Hook for checking if current breakpoint is between two breakpoints
 * @param min - Minimum breakpoint (inclusive)
 * @param max - Maximum breakpoint (inclusive)
 * @returns Boolean indicating if current breakpoint is between min and max
 */
export function useIsBreakpointBetween(
  min: Breakpoint | 'xs',
  max: Breakpoint
): boolean {
  const breakpointKeys = ['xs', ...Object.keys(BREAKPOINTS)] as const;
  const minIndex = breakpointKeys.indexOf(min);
  const maxIndex = breakpointKeys.indexOf(max);
  
  const { current } = useBreakpoint();
  const currentIndex = breakpointKeys.indexOf(current);
  
  return currentIndex >= minIndex && currentIndex <= maxIndex;
}

/**
 * Hook for getting the current breakpoint value
 * @returns Current breakpoint name
 */
export function useCurrentBreakpoint(): Breakpoint | 'xs' {
  const { current } = useBreakpoint();
  return current;
}