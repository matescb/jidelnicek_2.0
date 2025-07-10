/**
 * Enhanced hook for React Hook Form with Zod validation
 * 
 * This hook wraps useForm with zodResolver and provides additional
 * functionality for form handling including default error handling,
 * form state helpers, and async submission support.
 */

import { useForm, UseFormProps, UseFormReturn, FieldValues, SubmitHandler, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema, ZodTypeDef } from 'zod';
import { useCallback, useState, useRef } from 'react';
import { useToast } from './useToast';
import { AsyncValidator } from '../utils/asyncValidation';
import { useAsyncFieldValidator } from './useAsyncFieldValidator';

export interface UseZodFormOptions<TFieldValues extends FieldValues = FieldValues>
  extends Omit<UseFormProps<TFieldValues>, 'resolver'> {
  /**
   * Zod schema for validation
   */
  schema: ZodSchema<TFieldValues>;
  /**
   * Show toast notifications on errors
   */
  showErrorToast?: boolean;
  /**
   * Custom error handler
   */
  onError?: (error: unknown) => void;
  /**
   * Success handler after form submission
   */
  onSuccess?: (data: TFieldValues) => void | Promise<void>;
  /**
   * Async validators for specific fields
   */
  asyncValidators?: Partial<{
    [K in Path<TFieldValues>]: AsyncValidator<any>;
  }>;
  /**
   * Async validation options
   */
  asyncValidationOptions?: {
    debounceMs?: number;
    cacheTTL?: number;
  };
}

export interface UseZodFormReturn<TFieldValues extends FieldValues = FieldValues>
  extends UseFormReturn<TFieldValues> {
  /**
   * Enhanced submit handler with loading state management
   */
  handleSubmitWithLoading: (
    onSubmit: SubmitHandler<TFieldValues>
  ) => (e?: React.BaseSyntheticEvent) => Promise<void>;
  /**
   * Form submission loading state
   */
  isSubmitting: boolean;
  /**
   * Reset form to default values and clear errors
   */
  resetForm: () => void;
  /**
   * Check if form has any errors
   */
  hasErrors: boolean;
  /**
   * Check if form has been modified
   */
  isDirty: boolean;
  /**
   * Get error message for a specific field
   */
  getFieldError: (fieldName: keyof TFieldValues) => string | undefined;
  /**
   * Async field validators
   */
  asyncFieldValidators: Map<Path<TFieldValues>, ReturnType<typeof useAsyncFieldValidator>>;
  /**
   * Validate a field asynchronously
   */
  validateFieldAsync: (fieldName: Path<TFieldValues>, value: any) => Promise<string | null>;
  /**
   * Check if any async validation is in progress
   */
  isAsyncValidating: boolean;
}

/**
 * Enhanced React Hook Form with Zod validation
 * 
 * @example
 * ```tsx
 * const form = useZodForm({
 *   schema: loginSchema,
 *   defaultValues: {
 *     email: '',
 *     password: ''
 *   },
 *   showErrorToast: true,
 *   onSuccess: async (data) => {
 *     await login(data);
 *   }
 * });
 * 
 * <form onSubmit={form.handleSubmitWithLoading(onSubmit)}>
 *   <input {...form.register('email')} />
 *   {form.getFieldError('email') && (
 *     <span>{form.getFieldError('email')}</span>
 *   )}
 * </form>
 * ```
 */
export function useZodForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues extends FieldValues | undefined = undefined
>({
  schema,
  showErrorToast = true,
  onError,
  onSuccess,
  asyncValidators = {},
  asyncValidationOptions = {},
  ...formOptions
}: UseZodFormOptions<TFieldValues>): UseZodFormReturn<TFieldValues> {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const asyncFieldValidatorsRef = useRef<Map<Path<TFieldValues>, ReturnType<typeof useAsyncFieldValidator>>>(new Map());

  // Initialize form with zod resolver
  const form = useForm<TFieldValues, TContext, TTransformedValues>({
    ...formOptions,
    resolver: zodResolver(schema),
  });

  // Initialize async validators for fields
  Object.entries(asyncValidators).forEach(([fieldName, validator]) => {
    if (!asyncFieldValidatorsRef.current.has(fieldName as Path<TFieldValues>)) {
      const asyncFieldValidator = {
        validate: async (value: any) => {
          const result = await validator(value);
          return result.isValid ? null : result.error || 'Validation failed';
        },
        error: null,
        isValidating: false,
        isValidated: false,
        isValid: true,
        clearError: () => {},
        reset: () => {},
        lastValue: null,
        validatedAt: null,
        wasCached: false,
      };
      asyncFieldValidatorsRef.current.set(fieldName as Path<TFieldValues>, asyncFieldValidator);
    }
  });

  // Validate field asynchronously
  const validateFieldAsync = useCallback(
    async (fieldName: Path<TFieldValues>, value: any): Promise<string | null> => {
      const validator = asyncFieldValidatorsRef.current.get(fieldName);
      if (!validator) return null;
      
      const error = await validator.validate(value);
      if (error) {
        form.setError(fieldName, { type: 'async', message: error });
      } else {
        form.clearErrors(fieldName);
      }
      return error;
    },
    [form]
  );

  // Check if any async validation is in progress
  const isAsyncValidating = Array.from(asyncFieldValidatorsRef.current.values())
    .some(validator => validator.isValidating);

  // Enhanced submit handler with loading state
  const handleSubmitWithLoading = useCallback(
    (onSubmit: SubmitHandler<TFieldValues>) => {
      return form.handleSubmit(async (data) => {
        setIsSubmitting(true);
        try {
          // Run async validations before submit
          const asyncErrors: string[] = [];
          for (const [fieldName, validator] of asyncFieldValidatorsRef.current.entries()) {
            const fieldValue = form.getValues(fieldName);
            const error = await validator.validate(fieldValue);
            if (error) {
              asyncErrors.push(error);
              form.setError(fieldName, { type: 'async', message: error });
            }
          }

          if (asyncErrors.length > 0) {
            if (showErrorToast) {
              showToast({
                type: 'error',
                message: 'Please fix the validation errors',
              });
            }
            return;
          }

          await onSubmit(data);
          if (onSuccess) {
            await onSuccess(data);
          }
        } catch (error) {
          if (onError) {
            onError(error);
          } else if (showErrorToast) {
            showToast({
              type: 'error',
              message: error instanceof Error ? error.message : 'An error occurred',
            });
          }
          throw error;
        } finally {
          setIsSubmitting(false);
        }
      });
    },
    [form, onSuccess, onError, showErrorToast, showToast]
  );

  // Reset form helper
  const resetForm = useCallback(() => {
    form.reset();
    form.clearErrors();
    // Reset async validators
    asyncFieldValidatorsRef.current.forEach(validator => validator.reset());
  }, [form]);

  // Get field error message
  const getFieldError = useCallback(
    (fieldName: keyof TFieldValues): string | undefined => {
      const error = form.formState.errors[fieldName];
      return error?.message;
    },
    [form.formState.errors]
  );

  // Form state helpers
  const hasErrors = Object.keys(form.formState.errors).length > 0;
  const isDirty = form.formState.isDirty;

  return {
    ...form,
    handleSubmitWithLoading,
    isSubmitting,
    resetForm,
    hasErrors,
    isDirty,
    getFieldError,
    asyncFieldValidators: asyncFieldValidatorsRef.current,
    validateFieldAsync,
    isAsyncValidating,
  };
}

// Type helper for extracting form data type from schema
export type InferFormData<T extends ZodSchema> = T extends ZodSchema<infer U, ZodTypeDef, any> ? U : never;