/**
 * Single field validation hook for on-demand validation
 * 
 * This hook provides field-level validation with support for
 * debounced validation, async validation, and validation state management.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ZodSchema, ZodError } from 'zod';
import { useDebouncedCallback } from './useDebounce';

export interface UseFieldValidationOptions<T = any> {
  /**
   * Zod schema for validation
   */
  schema: ZodSchema<T>;
  /**
   * Debounce delay in milliseconds (default: 300)
   */
  debounceMs?: number;
  /**
   * Enable debounced validation (default: true)
   */
  enableDebounce?: boolean;
  /**
   * Async validation function
   */
  asyncValidator?: (value: T) => Promise<string | null>;
  /**
   * Dependencies that should trigger revalidation
   */
  dependencies?: any[];
  /**
   * Validate on mount (default: false)
   */
  validateOnMount?: boolean;
  /**
   * Transform value before validation
   */
  transform?: (value: any) => T;
}

export interface UseFieldValidationReturn<T = any> {
  /**
   * Validate the field value
   */
  validate: (value: T) => Promise<string | null>;
  /**
   * Validation error message
   */
  error: string | null;
  /**
   * Whether validation is in progress
   */
  isValidating: boolean;
  /**
   * Whether the field has been validated
   */
  isValidated: boolean;
  /**
   * Whether the field is valid
   */
  isValid: boolean;
  /**
   * Clear validation error
   */
  clearError: () => void;
  /**
   * Reset validation state
   */
  reset: () => void;
  /**
   * Validate with debouncing
   */
  validateDebounced: (value: T) => void;
}

/**
 * Hook for single field validation
 * 
 * @example
 * ```tsx
 * const emailValidation = useFieldValidation({
 *   schema: emailSchema,
 *   debounceMs: 500,
 *   asyncValidator: async (email) => {
 *     const exists = await checkEmailExists(email);
 *     return exists ? 'Email already in use' : null;
 *   }
 * });
 * 
 * <input
 *   onChange={(e) => emailValidation.validateDebounced(e.target.value)}
 *   onBlur={(e) => emailValidation.validate(e.target.value)}
 * />
 * {emailValidation.error && <span>{emailValidation.error}</span>}
 * ```
 */
export function useFieldValidation<T = any>({
  schema,
  debounceMs = 300,
  enableDebounce = true,
  asyncValidator,
  dependencies = [],
  validateOnMount = false,
  transform,
}: UseFieldValidationOptions<T>): UseFieldValidationReturn<T> {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const validationCache = useRef<Map<string, string | null>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Core validation function
  const validate = useCallback(
    async (value: T): Promise<string | null> => {
      // Cancel any ongoing validation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this validation
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      setIsValidating(true);
      setIsValidated(false);

      try {
        // Transform value if needed
        const transformedValue = transform ? transform(value) : value;

        // Check cache
        const cacheKey = JSON.stringify(transformedValue);
        if (validationCache.current.has(cacheKey) && !asyncValidator) {
          const cachedError = validationCache.current.get(cacheKey)!;
          setError(cachedError);
          setIsValidated(true);
          setIsValidating(false);
          return cachedError;
        }

        // Schema validation
        try {
          await schema.parseAsync(transformedValue);
        } catch (err) {
          if (err instanceof ZodError) {
            const errorMessage = err.errors[0]?.message || 'Invalid value';
            setError(errorMessage);
            validationCache.current.set(cacheKey, errorMessage);
            setIsValidated(true);
            setIsValidating(false);
            return errorMessage;
          }
          throw err;
        }

        // Async validation if provided
        if (asyncValidator && !signal.aborted) {
          const asyncError = await asyncValidator(transformedValue);
          if (signal.aborted) return null;
          
          if (asyncError) {
            setError(asyncError);
            validationCache.current.set(cacheKey, asyncError);
            setIsValidated(true);
            setIsValidating(false);
            return asyncError;
          }
        }

        // Validation passed
        setError(null);
        validationCache.current.set(cacheKey, null);
        setIsValidated(true);
        setIsValidating(false);
        return null;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return null;
        }
        const errorMessage = error instanceof Error ? error.message : 'Validation failed';
        setError(errorMessage);
        setIsValidated(true);
        setIsValidating(false);
        return errorMessage;
      }
    },
    [schema, asyncValidator, transform]
  );

  // Debounced validation
  const debouncedValidate = useDebouncedCallback(validate, enableDebounce ? debounceMs : 0);
  
  const validateDebounced = useCallback(
    (value: T) => {
      if (enableDebounce) {
        debouncedValidate(value);
      } else {
        validate(value);
      }
    },
    [validate, debouncedValidate, enableDebounce]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setIsValidated(false);
  }, []);

  // Reset validation state
  const reset = useCallback(() => {
    setError(null);
    setIsValidating(false);
    setIsValidated(false);
    validationCache.current.clear();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Re-validate when dependencies change
  useEffect(() => {
    if (dependencies.length > 0 && isValidated) {
      validationCache.current.clear();
    }
  }, dependencies);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    validate,
    error,
    isValidating,
    isValidated,
    isValid: isValidated && error === null,
    clearError,
    reset,
    validateDebounced,
  };
}

/**
 * Hook for validating multiple fields
 * 
 * @example
 * ```tsx
 * const validations = useMultiFieldValidation({
 *   email: { schema: emailSchema },
 *   username: { 
 *     schema: usernameSchema,
 *     asyncValidator: checkUsernameAvailable
 *   }
 * });
 * ```
 */
export function useMultiFieldValidation<T extends Record<string, any>>(
  fields: {
    [K in keyof T]: UseFieldValidationOptions<T[K]>;
  }
) {
  const validations = {} as {
    [K in keyof T]: UseFieldValidationReturn<T[K]>;
  };

  // Create validation hook for each field
  for (const [fieldName, options] of Object.entries(fields)) {
    validations[fieldName as keyof T] = useFieldValidation(options);
  }

  // Helper to validate all fields
  const validateAll = async (values: T): Promise<boolean> => {
    const results = await Promise.all(
      Object.entries(values).map(async ([fieldName, value]) => {
        if (fieldName in validations) {
          const error = await validations[fieldName as keyof T].validate(value);
          return error === null;
        }
        return true;
      })
    );
    return results.every(result => result);
  };

  // Helper to reset all validations
  const resetAll = () => {
    Object.values(validations).forEach((validation: any) => validation.reset());
  };

  // Check if all fields are valid
  const allValid = Object.values(validations).every(
    (validation: any) => validation.isValid || !validation.isValidated
  );

  // Check if any field is validating
  const anyValidating = Object.values(validations).some(
    (validation: any) => validation.isValidating
  );

  return {
    ...validations,
    validateAll,
    resetAll,
    allValid,
    anyValidating,
  };
}