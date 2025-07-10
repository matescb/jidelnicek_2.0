/**
 * Async field validator hook
 * 
 * Specialized hook for handling asynchronous field validation
 * with enhanced features like caching, debouncing, and loading states.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ZodSchema } from 'zod';
import { 
  AsyncValidator, 
  ValidationResult,
  useAsyncValidator,
  AsyncValidationOptions,
  createCachedValidator,
  createDebouncedValidator
} from '../utils/asyncValidation';

export interface UseAsyncFieldValidatorOptions<T = any> {
  /**
   * Optional Zod schema for synchronous validation
   */
  schema?: ZodSchema<T>;
  /**
   * Async validator function
   */
  asyncValidator: AsyncValidator<T>;
  /**
   * Validation options
   */
  options?: AsyncValidationOptions;
  /**
   * Dependencies that should trigger cache clear
   */
  dependencies?: any[];
  /**
   * Transform value before validation
   */
  transform?: (value: any) => T;
  /**
   * Validate on mount
   */
  validateOnMount?: boolean;
  /**
   * Initial value for mount validation
   */
  initialValue?: T;
}

export interface UseAsyncFieldValidatorReturn<T = any> {
  /**
   * Validate the field value
   */
  validate: (value: T, options?: { debounce?: boolean }) => Promise<string | null>;
  /**
   * Current validation error
   */
  error: string | null;
  /**
   * Whether async validation is in progress
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
   * Clear validation error and cache
   */
  clearError: () => void;
  /**
   * Reset all validation state
   */
  reset: () => void;
  /**
   * Last validated value
   */
  lastValue: T | null;
  /**
   * Validation timestamp
   */
  validatedAt: number | null;
  /**
   * Whether last result was from cache
   */
  wasCached: boolean;
}

/**
 * Hook for async field validation
 * 
 * @example
 * ```tsx
 * const emailValidator = useAsyncFieldValidator({
 *   schema: emailSchema,
 *   asyncValidator: createEmailUniquenessValidator(checkEmailApi),
 *   options: {
 *     debounceMs: 500,
 *     cacheTTL: 60000, // 1 minute
 *   }
 * });
 * 
 * <input
 *   onChange={(e) => emailValidator.validate(e.target.value)}
 *   onBlur={(e) => emailValidator.validate(e.target.value, { debounce: false })}
 * />
 * {emailValidator.isValidating && <Spinner />}
 * {emailValidator.error && <Error>{emailValidator.error}</Error>}
 * ```
 */
export function useAsyncFieldValidator<T = any>({
  schema,
  asyncValidator,
  options,
  dependencies = [],
  transform,
  validateOnMount = false,
  initialValue,
}: UseAsyncFieldValidatorOptions<T>): UseAsyncFieldValidatorReturn<T> {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [lastValue, setLastValue] = useState<T | null>(null);
  const [validatedAt, setValidatedAt] = useState<number | null>(null);
  const [wasCached, setWasCached] = useState(false);
  
  const mountedRef = useRef(true);
  const currentValidationRef = useRef<Promise<string | null> | null>(null);

  // Create enhanced async validator
  const enhancedValidator = useCallback<AsyncValidator<T>>(
    async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
      // Sync validation first if schema provided
      if (schema) {
        try {
          await schema.parseAsync(value);
        } catch (err: any) {
          return {
            isValid: false,
            error: err.errors?.[0]?.message || 'Invalid value',
            timestamp: Date.now(),
          };
        }
      }

      // Then async validation
      return asyncValidator(value, signal);
    },
    [schema, asyncValidator]
  );

  // Use async validator with options
  const { validate: asyncValidate, clearCache, cancelAll } = useAsyncValidator(
    enhancedValidator,
    options
  );

  // Main validation function
  const validate = useCallback(
    async (value: T, validateOptions?: { debounce?: boolean }): Promise<string | null> => {
      // Transform value if needed
      const transformedValue = transform ? transform(value) : value;

      // Prevent concurrent validations of the same value
      if (currentValidationRef.current && lastValue === transformedValue) {
        return currentValidationRef.current;
      }

      // Create validation promise
      const validationPromise = (async () => {
        if (!mountedRef.current) return null;

        setIsValidating(true);
        setLastValue(transformedValue);

        try {
          const result = await asyncValidate(transformedValue, validateOptions);
          
          if (!mountedRef.current) return null;

          const errorMessage = result.isValid ? null : result.error || 'Validation failed';
          
          setError(errorMessage);
          setIsValidated(true);
          setValidatedAt(result.timestamp);
          setWasCached(result.cached || false);
          
          return errorMessage;
        } catch (error) {
          if (!mountedRef.current) return null;

          // Handle abort errors silently
          if (error instanceof Error && error.message === 'Validation aborted') {
            return null;
          }

          const errorMessage = error instanceof Error ? error.message : 'Validation failed';
          setError(errorMessage);
          setIsValidated(true);
          setValidatedAt(Date.now());
          setWasCached(false);
          
          return errorMessage;
        } finally {
          if (mountedRef.current) {
            setIsValidating(false);
            currentValidationRef.current = null;
          }
        }
      })();

      currentValidationRef.current = validationPromise;
      return validationPromise;
    },
    [asyncValidate, transform, lastValue]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setIsValidated(false);
    setValidatedAt(null);
    setWasCached(false);
    clearCache();
  }, [clearCache]);

  // Reset all state
  const reset = useCallback(() => {
    setError(null);
    setIsValidating(false);
    setIsValidated(false);
    setLastValue(null);
    setValidatedAt(null);
    setWasCached(false);
    clearCache();
    cancelAll();
    currentValidationRef.current = null;
  }, [clearCache, cancelAll]);

  // Clear cache when dependencies change
  useEffect(() => {
    if (dependencies.length > 0 && isValidated) {
      clearCache();
    }
  }, dependencies);

  // Validate on mount if requested
  useEffect(() => {
    if (validateOnMount && initialValue !== undefined && !isValidated) {
      validate(initialValue, { debounce: false });
    }
  }, [validateOnMount, initialValue, validate, isValidated]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAll();
    };
  }, [cancelAll]);

  return {
    validate,
    error,
    isValidating,
    isValidated,
    isValid: isValidated && error === null,
    clearError,
    reset,
    lastValue,
    validatedAt,
    wasCached,
  };
}

/**
 * Hook for multiple async field validations
 * 
 * @example
 * ```tsx
 * const validations = useMultiAsyncFieldValidation({
 *   email: {
 *     schema: emailSchema,
 *     asyncValidator: emailUniquenessValidator,
 *   },
 *   username: {
 *     asyncValidator: usernameAvailabilityValidator,
 *     options: { debounceMs: 300 }
 *   }
 * });
 * 
 * const allValid = await validations.validateAll({ email, username });
 * ```
 */
export function useMultiAsyncFieldValidation<T extends Record<string, any>>(
  fields: {
    [K in keyof T]: UseAsyncFieldValidatorOptions<T[K]>;
  }
) {
  const validations = {} as {
    [K in keyof T]: UseAsyncFieldValidatorReturn<T[K]>;
  };

  // Create validation hook for each field
  for (const [fieldName, options] of Object.entries(fields)) {
    validations[fieldName as keyof T] = useAsyncFieldValidator(options);
  }

  // Helper to validate all fields
  const validateAll = useCallback(
    async (values: T, options?: { debounce?: boolean }): Promise<boolean> => {
      const results = await Promise.all(
        Object.entries(values).map(async ([fieldName, value]) => {
          if (fieldName in validations) {
            const error = await validations[fieldName as keyof T].validate(
              value,
              options
            );
            return error === null;
          }
          return true;
        })
      );
      return results.every(result => result);
    },
    [validations]
  );

  // Helper to reset all validations
  const resetAll = useCallback(() => {
    Object.values(validations).forEach((validation: any) => validation.reset());
  }, [validations]);

  // Check if all fields are valid
  const allValid = Object.values(validations).every(
    (validation: any) => validation.isValid || !validation.isValidated
  );

  // Check if any field is validating
  const anyValidating = Object.values(validations).some(
    (validation: any) => validation.isValidating
  );

  // Get all errors
  const errors = Object.entries(validations).reduce(
    (acc, [key, validation]: [string, any]) => {
      if (validation.error) {
        acc[key as keyof T] = validation.error;
      }
      return acc;
    },
    {} as Partial<Record<keyof T, string>>
  );

  return {
    ...validations,
    validateAll,
    resetAll,
    allValid,
    anyValidating,
    errors,
  };
}