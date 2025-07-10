/**
 * Async validation hook for checking uniqueness and other async validations
 * 
 * This hook provides debounced async validation with caching,
 * loading states, and support for various validation scenarios.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from './useDebounce';

export interface AsyncValidationResult {
  isValid: boolean;
  error?: string;
  data?: any;
}

export interface UseAsyncValidationOptions {
  /**
   * Async validation function
   */
  validator: (value: any, context?: any) => Promise<AsyncValidationResult>;
  /**
   * Debounce delay in milliseconds (default: 500)
   */
  debounceMs?: number;
  /**
   * Enable caching of validation results (default: true)
   */
  enableCache?: boolean;
  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTTL?: number;
  /**
   * Skip validation for these values
   */
  skipValues?: any[];
  /**
   * Context to pass to validator
   */
  context?: any;
  /**
   * Validate on mount with initial value
   */
  validateOnMount?: boolean;
  /**
   * Initial value for validation on mount
   */
  initialValue?: any;
  /**
   * Dependencies that should clear cache
   */
  dependencies?: any[];
}

export interface UseAsyncValidationReturn {
  /**
   * Validate a value
   */
  validate: (value: any) => Promise<AsyncValidationResult>;
  /**
   * Validation result
   */
  result: AsyncValidationResult | null;
  /**
   * Loading state
   */
  isValidating: boolean;
  /**
   * Error message from last validation
   */
  error: string | null;
  /**
   * Whether the last validated value is valid
   */
  isValid: boolean | null;
  /**
   * Clear validation state and cache
   */
  clear: () => void;
  /**
   * Clear cache only
   */
  clearCache: () => void;
  /**
   * Validate with debouncing
   */
  validateDebounced: (value: any) => void;
  /**
   * Cancel ongoing validation
   */
  cancel: () => void;
  /**
   * Last validated value
   */
  lastValue: any;
}

interface CacheEntry {
  result: AsyncValidationResult;
  timestamp: number;
}

/**
 * Hook for async validation
 * 
 * @example
 * ```tsx
 * // Email uniqueness validation
 * const emailValidation = useAsyncValidation({
 *   validator: async (email) => {
 *     const response = await api.checkEmailExists(email);
 *     return {
 *       isValid: !response.exists,
 *       error: response.exists ? 'Email already in use' : undefined
 *     };
 *   },
 *   debounceMs: 500,
 *   skipValues: ['', null, undefined]
 * });
 * 
 * <input
 *   onChange={(e) => emailValidation.validateDebounced(e.target.value)}
 *   onBlur={(e) => emailValidation.validate(e.target.value)}
 * />
 * {emailValidation.isValidating && <span>Checking...</span>}
 * {emailValidation.error && <span>{emailValidation.error}</span>}
 * ```
 */
export function useAsyncValidation({
  validator,
  debounceMs = 500,
  enableCache = true,
  cacheTTL = 5 * 60 * 1000, // 5 minutes
  skipValues = ['', null, undefined],
  context,
  validateOnMount = false,
  initialValue,
  dependencies = [],
}: UseAsyncValidationOptions): UseAsyncValidationReturn {
  const [result, setResult] = useState<AsyncValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValue, setLastValue] = useState<any>(initialValue);
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get cache key for a value
  const getCacheKey = useCallback(
    (value: any): string => {
      return JSON.stringify({ value, context });
    },
    [context]
  );

  // Check if value should be skipped
  const shouldSkipValidation = useCallback(
    (value: any): boolean => {
      return skipValues.some(skipValue => value === skipValue);
    },
    [skipValues]
  );

  // Clear cache
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  // Clear validation state
  const clear = useCallback(() => {
    setResult(null);
    setIsValidating(false);
    setLastValue(undefined);
    clearCache();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [clearCache]);

  // Cancel ongoing validation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsValidating(false);
  }, []);

  // Core validation function
  const validate = useCallback(
    async (value: any): Promise<AsyncValidationResult> => {
      // Cancel any ongoing validation
      cancel();

      // Update last value
      setLastValue(value);

      // Skip validation for certain values
      if (shouldSkipValidation(value)) {
        const result = { isValid: true };
        setResult(result);
        return result;
      }

      // Check cache
      if (enableCache) {
        const cacheKey = getCacheKey(value);
        const cached = cache.current.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          setResult(cached.result);
          return cached.result;
        }
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      setIsValidating(true);

      try {
        // Perform validation
        const validationResult = await validator(value, context);

        // Check if aborted
        if (signal.aborted) {
          return { isValid: false, error: 'Validation cancelled' };
        }

        // Cache result
        if (enableCache) {
          const cacheKey = getCacheKey(value);
          cache.current.set(cacheKey, {
            result: validationResult,
            timestamp: Date.now(),
          });
        }

        // Update state
        setResult(validationResult);
        setIsValidating(false);

        return validationResult;
      } catch (error) {
        // Check if aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return { isValid: false, error: 'Validation cancelled' };
        }

        const errorResult: AsyncValidationResult = {
          isValid: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        };

        setResult(errorResult);
        setIsValidating(false);

        return errorResult;
      }
    },
    [validator, context, enableCache, getCacheKey, cacheTTL, shouldSkipValidation, cancel]
  );

  // Debounced validation
  const debouncedValidate = useDebounce(validate, debounceMs);
  
  const validateDebounced = useCallback(
    (value: any) => {
      setLastValue(value);
      if (shouldSkipValidation(value)) {
        setResult({ isValid: true });
        setIsValidating(false);
      } else {
        setIsValidating(true);
        debouncedValidate(value);
      }
    },
    [debouncedValidate, shouldSkipValidation]
  );

  // Clear cache when dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      clearCache();
    }
  }, dependencies);

  // Validate on mount if requested
  useEffect(() => {
    if (validateOnMount && initialValue !== undefined) {
      validate(initialValue);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Computed values
  const error = result?.error || null;
  const isValid = result?.isValid ?? null;

  return {
    validate,
    result,
    isValidating,
    error,
    isValid,
    clear,
    clearCache,
    validateDebounced,
    cancel,
    lastValue,
  };
}

/**
 * Preset hook for email uniqueness validation
 */
export function useEmailUniqueness(
  checkEmail: (email: string) => Promise<boolean>,
  options?: Partial<UseAsyncValidationOptions>
) {
  return useAsyncValidation({
    validator: async (email: string) => {
      try {
        const exists = await checkEmail(email);
        return {
          isValid: !exists,
          error: exists ? 'Email is already in use' : undefined,
        };
      } catch (error) {
        return {
          isValid: false,
          error: 'Unable to verify email availability',
        };
      }
    },
    debounceMs: 500,
    skipValues: ['', null, undefined],
    ...options,
  });
}

/**
 * Preset hook for username availability validation
 */
export function useUsernameAvailability(
  checkUsername: (username: string) => Promise<boolean>,
  options?: Partial<UseAsyncValidationOptions>
) {
  return useAsyncValidation({
    validator: async (username: string) => {
      try {
        const exists = await checkUsername(username);
        return {
          isValid: !exists,
          error: exists ? 'Username is already taken' : undefined,
        };
      } catch (error) {
        return {
          isValid: false,
          error: 'Unable to verify username availability',
        };
      }
    },
    debounceMs: 500,
    skipValues: ['', null, undefined],
    ...options,
  });
}

/**
 * Preset hook for general async field validation
 */
export function useAsyncFieldValidation<T = any>(
  fieldName: string,
  validator: (value: T) => Promise<{ valid: boolean; message?: string }>,
  options?: Partial<UseAsyncValidationOptions>
) {
  return useAsyncValidation({
    validator: async (value: T) => {
      try {
        const result = await validator(value);
        return {
          isValid: result.valid,
          error: result.message,
        };
      } catch (error) {
        return {
          isValid: false,
          error: `${fieldName} validation failed`,
        };
      }
    },
    ...options,
  });
}