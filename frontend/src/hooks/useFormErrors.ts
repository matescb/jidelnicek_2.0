/**
 * Form error management hook
 * 
 * This hook provides utilities for extracting, formatting, and managing
 * form errors with support for field-level and form-level errors,
 * error message localization, and error clearing functionality.
 */

import { useState, useCallback, useMemo } from 'react';
import { FieldErrors, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

export interface FormError {
  field?: string;
  message: string;
  type?: string;
  code?: string;
}

export interface UseFormErrorsOptions {
  /**
   * Enable error message translation
   */
  enableTranslation?: boolean;
  /**
   * Translation namespace for error messages
   */
  translationNamespace?: string;
  /**
   * Custom error formatter
   */
  errorFormatter?: (error: any) => string;
  /**
   * Maximum number of errors to display
   */
  maxErrors?: number;
}

export interface UseFormErrorsReturn {
  /**
   * All form errors
   */
  errors: FormError[];
  /**
   * Field-specific errors
   */
  fieldErrors: Record<string, string>;
  /**
   * Form-level errors (not tied to specific fields)
   */
  formErrors: string[];
  /**
   * Add error(s)
   */
  addError: (error: FormError | FormError[]) => void;
  /**
   * Add field error
   */
  addFieldError: (field: string, message: string) => void;
  /**
   * Add form-level error
   */
  addFormError: (message: string) => void;
  /**
   * Clear all errors
   */
  clearErrors: () => void;
  /**
   * Clear specific field error
   */
  clearFieldError: (field: string) => void;
  /**
   * Clear form-level errors
   */
  clearFormErrors: () => void;
  /**
   * Set errors from React Hook Form
   */
  setFromFieldErrors: (errors: FieldErrors) => void;
  /**
   * Set errors from Zod validation
   */
  setFromZodError: (error: ZodError) => void;
  /**
   * Get error message for specific field
   */
  getFieldError: (field: string) => string | undefined;
  /**
   * Check if there are any errors
   */
  hasErrors: boolean;
  /**
   * Check if specific field has error
   */
  hasFieldError: (field: string) => boolean;
  /**
   * Format error for display
   */
  formatError: (error: any) => string;
  /**
   * Get all errors as a single string
   */
  getErrorSummary: (separator?: string) => string;
}

/**
 * Hook for managing form errors
 * 
 * @example
 * ```tsx
 * const formErrors = useFormErrors({
 *   enableTranslation: true,
 *   translationNamespace: 'errors'
 * });
 * 
 * // Set errors from React Hook Form
 * formErrors.setFromFieldErrors(form.formState.errors);
 * 
 * // Add custom error
 * formErrors.addFieldError('email', 'Email already exists');
 * 
 * // Display field error
 * {formErrors.getFieldError('email') && (
 *   <span>{formErrors.getFieldError('email')}</span>
 * )}
 * 
 * // Display form-level errors
 * {formErrors.formErrors.map((error, index) => (
 *   <div key={index}>{error}</div>
 * ))}
 * ```
 */
export function useFormErrors({
  enableTranslation = false,
  translationNamespace = 'errors',
  errorFormatter,
  maxErrors = 10,
}: UseFormErrorsOptions = {}): UseFormErrorsReturn {
  const { t } = useTranslation(translationNamespace);
  const [errors, setErrors] = useState<FormError[]>([]);

  // Format error message
  const formatError = useCallback(
    (error: any): string => {
      if (errorFormatter) {
        return errorFormatter(error);
      }

      // Handle different error types
      if (typeof error === 'string') {
        return enableTranslation ? t(error) : error;
      }

      if (error instanceof Error) {
        const message = error.message;
        return enableTranslation ? t(message, { defaultValue: message }) : message;
      }

      if (error && typeof error === 'object') {
        if ('message' in error) {
          const message = error.message;
          return enableTranslation ? t(message, { defaultValue: message }) : message;
        }
        
        if ('type' in error && 'message' in error) {
          const key = `${error.type}.${error.message}`;
          return enableTranslation ? t(key, { defaultValue: error.message }) : error.message;
        }
      }

      return enableTranslation ? t('common.unknownError') : 'Unknown error';
    },
    [enableTranslation, t, errorFormatter]
  );

  // Add error(s)
  const addError = useCallback(
    (error: FormError | FormError[]) => {
      setErrors(prev => {
        const newErrors = Array.isArray(error) ? error : [error];
        const combined = [...prev, ...newErrors];
        return combined.slice(0, maxErrors);
      });
    },
    [maxErrors]
  );

  // Add field error
  const addFieldError = useCallback(
    (field: string, message: string) => {
      addError({ field, message: formatError(message) });
    },
    [addError, formatError]
  );

  // Add form-level error
  const addFormError = useCallback(
    (message: string) => {
      addError({ message: formatError(message) });
    },
    [addError, formatError]
  );

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Clear specific field error
  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => prev.filter(error => error.field !== field));
  }, []);

  // Clear form-level errors
  const clearFormErrors = useCallback(() => {
    setErrors(prev => prev.filter(error => error.field !== undefined));
  }, []);

  // Set errors from React Hook Form
  const setFromFieldErrors = useCallback(
    (fieldErrors: FieldErrors) => {
      const newErrors: FormError[] = [];
      
      const processErrors = (errors: FieldErrors, parentField = '') => {
        Object.entries(errors).forEach(([field, error]) => {
          const fullField = parentField ? `${parentField}.${field}` : field;
          
          if (error && typeof error === 'object') {
            if ('message' in error && error.message) {
              newErrors.push({
                field: fullField,
                message: formatError(error.message),
                type: error.type,
              });
            } else if (!('message' in error)) {
              // Nested errors
              processErrors(error as FieldErrors, fullField);
            }
          }
        });
      };

      processErrors(fieldErrors);
      setErrors(newErrors.slice(0, maxErrors));
    },
    [formatError, maxErrors]
  );

  // Set errors from Zod validation
  const setFromZodError = useCallback(
    (zodError: ZodError) => {
      const newErrors: FormError[] = zodError.errors.map(error => ({
        field: error.path.join('.'),
        message: formatError(error.message),
        code: error.code,
      }));
      setErrors(newErrors.slice(0, maxErrors));
    },
    [formatError, maxErrors]
  );

  // Get field error
  const getFieldError = useCallback(
    (field: string): string | undefined => {
      const error = errors.find(e => e.field === field);
      return error?.message;
    },
    [errors]
  );

  // Check if field has error
  const hasFieldError = useCallback(
    (field: string): boolean => {
      return errors.some(e => e.field === field);
    },
    [errors]
  );

  // Get error summary
  const getErrorSummary = useCallback(
    (separator = ', '): string => {
      return errors.map(e => e.message).join(separator);
    },
    [errors]
  );

  // Computed values
  const fieldErrors = useMemo(() => {
    return errors
      .filter(e => e.field)
      .reduce((acc, error) => {
        acc[error.field!] = error.message;
        return acc;
      }, {} as Record<string, string>);
  }, [errors]);

  const formErrors = useMemo(() => {
    return errors
      .filter(e => !e.field)
      .map(e => e.message);
  }, [errors]);

  const hasErrors = errors.length > 0;

  return {
    errors,
    fieldErrors,
    formErrors,
    addError,
    addFieldError,
    addFormError,
    clearErrors,
    clearFieldError,
    clearFormErrors,
    setFromFieldErrors,
    setFromZodError,
    getFieldError,
    hasErrors,
    hasFieldError,
    formatError,
    getErrorSummary,
  };
}

/**
 * Hook for displaying form errors in a list
 */
export function useFormErrorList(errors: UseFormErrorsReturn) {
  const { t } = useTranslation();

  const errorListItems = useMemo(() => {
    return errors.errors.map((error, index) => ({
      id: `${error.field || 'form'}-${index}`,
      field: error.field,
      message: error.message,
      isFieldError: !!error.field,
    }));
  }, [errors.errors]);

  const ErrorList = useCallback(
    ({ className = '' }: { className?: string }) => {
      if (!errors.hasErrors) return null;

      return (
        <div className={`space-y-2 ${className}`}>
          {errors.formErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                {t('errors.formErrors')}
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {errors.formErrors.map((error, index) => (
                  <li key={`form-${index}`} className="text-sm text-red-600">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(errors.fieldErrors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                {t('errors.fieldErrors')}
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {Object.entries(errors.fieldErrors).map(([field, error]) => (
                  <li key={field} className="text-sm text-red-600">
                    <span className="font-medium">{field}:</span> {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    },
    [errors, t]
  );

  return {
    errorListItems,
    ErrorList,
  };
}