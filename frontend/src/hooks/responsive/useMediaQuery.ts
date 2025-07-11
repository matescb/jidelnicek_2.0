import { useEffect, useState, useCallback, useRef } from 'react';
import { DEFAULT_DEBOUNCE_DELAY } from './constants';

interface UseMediaQueryOptions {
  defaultValue?: boolean;
  debounce?: number;
}

/**
 * Hook for listening to media query changes
 * @param query - Media query string or array of queries
 * @param options - Configuration options
 * @returns Boolean or array of booleans indicating match status
 */
export function useMediaQuery(
  query: string,
  options?: UseMediaQueryOptions
): boolean;
export function useMediaQuery(
  queries: string[],
  options?: UseMediaQueryOptions
): boolean[];
export function useMediaQuery(
  queryOrQueries: string | string[],
  options: UseMediaQueryOptions = {}
): boolean | boolean[] {
  const { defaultValue = false, debounce = DEFAULT_DEBOUNCE_DELAY } = options;
  const queries = Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries];
  const isMultiple = Array.isArray(queryOrQueries);
  
  // Initialize with default values for SSR
  const [matches, setMatches] = useState<boolean[]>(() =>
    queries.map(() => defaultValue)
  );
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const mediaQueryListsRef = useRef<MediaQueryList[]>([]);

  // Get current match status
  const getMatches = useCallback(() => {
    if (typeof window === 'undefined') {
      return queries.map(() => defaultValue);
    }
    
    return queries.map((query) => {
      const mql = window.matchMedia(query);
      return mql.matches;
    });
  }, [queries, defaultValue]);

  // Handle media query change
  const handleChange = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const newMatches = getMatches();
      setMatches(newMatches);
    }, debounce);
  }, [getMatches, debounce]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Initialize media query lists
    mediaQueryListsRef.current = queries.map((query) => window.matchMedia(query));
    
    // Set initial values
    setMatches(getMatches());
    
    // Add event listeners
    const listeners = mediaQueryListsRef.current.map((mql) => {
      // Modern browsers
      if (mql.addEventListener) {
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
      }
      // Legacy browsers
      else {
        mql.addListener(handleChange);
        return () => mql.removeListener(handleChange);
      }
    });
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      listeners.forEach((cleanup) => cleanup());
    };
  }, [queries.join(','), handleChange, getMatches]);

  return isMultiple ? matches : matches[0];
}

/**
 * Hook for checking if all provided media queries match
 */
export function useAllMediaQueries(
  queries: string[],
  options?: UseMediaQueryOptions
): boolean {
  const matches = useMediaQuery(queries, options) as boolean[];
  return matches.every(Boolean);
}

/**
 * Hook for checking if any of the provided media queries match
 */
export function useAnyMediaQuery(
  queries: string[],
  options?: UseMediaQueryOptions
): boolean {
  const matches = useMediaQuery(queries, options) as boolean[];
  return matches.some(Boolean);
}