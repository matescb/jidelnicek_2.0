/**
 * Form submission handling hook
 * 
 * This hook manages form submission with loading states,
 * success/error callbacks, automatic error handling,
 * and prevention of double submissions.
 */

import { useState, useCallback, useRef } from 'react';
import { useToast } from './useToast';

export interface UseFormSubmitOptions<TData = any, TResponse = any> {
  /**
   * Submission handler function
   */
  onSubmit: (data: TData) => Promise<TResponse> | TResponse;
  /**
   * Success callback
   */
  onSuccess?: (response: TResponse, data: TData) => void | Promise<void>;
  /**
   * Error callback
   */
  onError?: (error: Error, data: TData) => void;
  /**
   * Show success toast
   */
  showSuccessToast?: boolean;
  /**
   * Show error toast
   */
  showErrorToast?: boolean;
  /**
   * Success toast message
   */
  successMessage?: string | ((response: TResponse) => string);
  /**
   * Error toast message
   */
  errorMessage?: string | ((error: Error) => string);
  /**
   * Reset form after successful submission
   */
  resetOnSuccess?: boolean;
  /**
   * Form reset function
   */
  onReset?: () => void;
  /**
   * Prevent double submissions
   */
  preventDoubleSubmit?: boolean;
  /**
   * Minimum submission duration (for better UX)
   */
  minDuration?: number;
  /**
   * Transform data before submission
   */
  transformData?: (data: TData) => any;
  /**
   * Validate before submission (return error message if invalid)
   */
  validate?: (data: TData) => string | null | Promise<string | null>;
}

export interface UseFormSubmitReturn<TData = any, TResponse = any> {
  /**
   * Submit handler
   */
  handleSubmit: (data: TData) => Promise<TResponse | undefined>;
  /**
   * Loading state
   */
  isLoading: boolean;
  /**
   * Success state
   */
  isSuccess: boolean;
  /**
   * Error state
   */
  isError: boolean;
  /**
   * Last error
   */
  error: Error | null;
  /**
   * Last response
   */
  response: TResponse | null;
  /**
   * Reset submission state
   */
  reset: () => void;
  /**
   * Submission count
   */
  submitCount: number;
  /**
   * Last submission timestamp
   */
  lastSubmitTime: number | null;
  /**
   * Can submit (not loading and no double submit)
   */
  canSubmit: boolean;
}

/**
 * Hook for handling form submissions
 * 
 * @example
 * ```tsx
 * const submission = useFormSubmit({
 *   onSubmit: async (data) => {
 *     return await api.createUser(data);
 *   },
 *   onSuccess: (response) => {
 *     navigate(`/users/${response.id}`);
 *   },
 *   showSuccessToast: true,
 *   successMessage: 'User created successfully',
 *   resetOnSuccess: true
 * });
 * 
 * const form = useZodForm({
 *   schema: userSchema,
 *   onSubmit: submission.handleSubmit
 * });
 * 
 * <form onSubmit={form.handleSubmit(submission.handleSubmit)}>
 *   <button disabled={!submission.canSubmit}>
 *     {submission.isLoading ? 'Creating...' : 'Create User'}
 *   </button>
 * </form>
 * ```
 */
export function useFormSubmit<TData = any, TResponse = any>({
  onSubmit,
  onSuccess,
  onError,
  showSuccessToast = false,
  showErrorToast = true,
  successMessage = 'Success!',
  errorMessage,
  resetOnSuccess = false,
  onReset,
  preventDoubleSubmit = true,
  minDuration = 0,
  transformData,
  validate,
}: UseFormSubmitOptions<TData, TResponse>): UseFormSubmitReturn<TData, TResponse> {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [response, setResponse] = useState<TResponse | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [lastSubmitTime, setLastSubmitTime] = useState<number | null>(null);
  const submissionInProgress = useRef(false);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setResponse(null);
    submissionInProgress.current = false;
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  const handleSubmit = useCallback(
    async (data: TData): Promise<TResponse | undefined> => {
      // Prevent double submission
      if (preventDoubleSubmit && submissionInProgress.current) {
        return undefined;
      }

      // Mark submission as in progress
      submissionInProgress.current = true;
      setIsLoading(true);
      setIsError(false);
      setIsSuccess(false);
      setError(null);

      const startTime = Date.now();

      try {
        // Validate if validator provided
        if (validate) {
          const validationError = await validate(data);
          if (validationError) {
            throw new Error(validationError);
          }
        }

        // Transform data if transformer provided
        const submitData = transformData ? transformData(data) : data;

        // Submit the form
        const result = await onSubmit(submitData);

        // Ensure minimum duration if specified
        const elapsedTime = Date.now() - startTime;
        if (minDuration > 0 && elapsedTime < minDuration) {
          await new Promise(resolve => setTimeout(resolve, minDuration - elapsedTime));
        }

        // Update state
        setResponse(result);
        setIsSuccess(true);
        setSubmitCount(prev => prev + 1);
        setLastSubmitTime(Date.now());

        // Show success toast
        if (showSuccessToast) {
          const message = typeof successMessage === 'function'
            ? successMessage(result)
            : successMessage;
          toast({
            title: message,
            variant: 'success',
          });
        }

        // Call success callback
        if (onSuccess) {
          await onSuccess(result, data);
        }

        // Reset form if requested
        if (resetOnSuccess) {
          reset();
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Submission failed');
        
        // Update state
        setError(error);
        setIsError(true);
        setSubmitCount(prev => prev + 1);
        setLastSubmitTime(Date.now());

        // Show error toast
        if (showErrorToast) {
          const message = errorMessage
            ? (typeof errorMessage === 'function' ? errorMessage(error) : errorMessage)
            : error.message;
          toast({
            title: message,
            variant: 'error',
          });
        }

        // Call error callback
        if (onError) {
          onError(error, data);
        }

        // Re-throw to allow form libraries to handle
        throw error;
      } finally {
        setIsLoading(false);
        submissionInProgress.current = false;
      }
    },
    [
      onSubmit,
      onSuccess,
      onError,
      showSuccessToast,
      showErrorToast,
      successMessage,
      errorMessage,
      resetOnSuccess,
      reset,
      preventDoubleSubmit,
      minDuration,
      transformData,
      validate,
      toast,
    ]
  );

  const canSubmit = !isLoading && (!preventDoubleSubmit || !submissionInProgress.current);

  return {
    handleSubmit,
    isLoading,
    isSuccess,
    isError,
    error,
    response,
    reset,
    submitCount,
    lastSubmitTime,
    canSubmit,
  };
}

/**
 * Hook for handling multiple form submissions with shared state
 */
export function useMultiFormSubmit() {
  const [activeSubmissions, setActiveSubmissions] = useState<Set<string>>(new Set());
  const [successfulSubmissions, setSuccessfulSubmissions] = useState<Set<string>>(new Set());
  const [failedSubmissions, setFailedSubmissions] = useState<Map<string, Error>>(new Map());

  const createSubmitHandler = useCallback(
    <TData = any, TResponse = any>(
      id: string,
      options: UseFormSubmitOptions<TData, TResponse>
    ) => {
      const wrappedOptions: UseFormSubmitOptions<TData, TResponse> = {
        ...options,
        onSubmit: async (data) => {
          setActiveSubmissions(prev => new Set(prev).add(id));
          try {
            const result = await options.onSubmit(data);
            setSuccessfulSubmissions(prev => new Set(prev).add(id));
            setFailedSubmissions(prev => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            return result;
          } catch (error) {
            setFailedSubmissions(prev => new Map(prev).set(id, error as Error));
            setSuccessfulSubmissions(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            throw error;
          } finally {
            setActiveSubmissions(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        },
      };

      return useFormSubmit(wrappedOptions);
    },
    []
  );

  const isAnyLoading = activeSubmissions.size > 0;
  const allSuccessful = (ids: string[]) => ids.every(id => successfulSubmissions.has(id));
  const anyFailed = (ids: string[]) => ids.some(id => failedSubmissions.has(id));

  const reset = useCallback(() => {
    setActiveSubmissions(new Set());
    setSuccessfulSubmissions(new Set());
    setFailedSubmissions(new Map());
  }, []);

  return {
    createSubmitHandler,
    activeSubmissions,
    successfulSubmissions,
    failedSubmissions,
    isAnyLoading,
    allSuccessful,
    anyFailed,
    reset,
  };
}