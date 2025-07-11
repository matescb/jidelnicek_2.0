import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { ErrorInfo } from 'react';
import { errorLogger, ErrorSeverity, ErrorContext as ErrorContextType } from '@/services/errorLogger';

// Error state interface
export interface AppError {
  id: string;
  error: Error;
  severity: ErrorSeverity;
  timestamp: Date;
  component?: string;
  isDismissed: boolean;
  recoveryAttempts: number;
  recoveryCallbacks?: Array<() => Promise<void>>;
}

// Error context value interface
export interface ErrorContextValue {
  // State
  errors: AppError[];
  activeError: AppError | null;
  isRecovering: boolean;
  
  // Actions
  captureError: (
    error: Error,
    errorInfo?: ErrorInfo,
    severity?: ErrorSeverity,
    context?: Partial<ErrorContextType>
  ) => string;
  dismissError: (errorId: string) => void;
  dismissAll: () => void;
  clearError: (errorId: string) => void;
  clearAll: () => void;
  
  // Recovery
  addRecoveryCallback: (errorId: string, callback: () => Promise<void>) => void;
  attemptRecovery: (errorId: string) => Promise<boolean>;
  
  // History
  getErrorById: (errorId: string) => AppError | undefined;
  getErrorHistory: () => AppError[];
  getErrorCount: (since?: Date) => number;
}

// Create context
const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

// Provider props
interface ErrorProviderProps {
  children: ReactNode;
  maxErrors?: number;
  autoRecovery?: boolean;
  onError?: (error: AppError) => void;
}

// Error Provider Component
export const ErrorProvider: React.FC<ErrorProviderProps> = ({
  children,
  maxErrors = 10,
  autoRecovery = true,
  onError
}) => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [activeError, setActiveError] = useState<AppError | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Capture and log error
  const captureError = useCallback((
    error: Error,
    errorInfo?: ErrorInfo,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Partial<ErrorContextType>
  ): string => {
    // Log to error service
    const errorId = errorLogger.logError(error, severity, errorInfo, context);
    
    // Create app error entry
    const appError: AppError = {
      id: errorId,
      error,
      severity,
      timestamp: new Date(),
      component: context?.component,
      isDismissed: false,
      recoveryAttempts: 0,
      recoveryCallbacks: []
    };

    // Update state
    setErrors(prev => {
      const newErrors = [...prev, appError];
      
      // Limit error history
      if (newErrors.length > maxErrors) {
        return newErrors.slice(-maxErrors);
      }
      
      return newErrors;
    });

    // Set as active error if none exists
    setActiveError(prev => prev || appError);

    // Call error callback
    if (onError) {
      onError(appError);
    }

    // Auto-recovery for recoverable errors
    if (autoRecovery && errorLogger.shouldRetry(errorId)) {
      const timeout = setTimeout(() => {
        attemptRecovery(errorId);
      }, 5000); // Wait 5 seconds before auto-recovery
      
      recoveryTimeouts.current.set(errorId, timeout);
    }

    return errorId;
  }, [maxErrors, autoRecovery, onError]);

  // Dismiss error (hide from UI but keep in history)
  const dismissError = useCallback((errorId: string) => {
    setErrors(prev =>
      prev.map(err =>
        err.id === errorId ? { ...err, isDismissed: true } : err
      )
    );

    // If this was the active error, find next undismissed error
    if (activeError?.id === errorId) {
      setActiveError(
        errors.find(err => !err.isDismissed && err.id !== errorId) || null
      );
    }

    // Clear any pending recovery timeout
    const timeout = recoveryTimeouts.current.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      recoveryTimeouts.current.delete(errorId);
    }
  }, [activeError, errors]);

  // Dismiss all errors
  const dismissAll = useCallback(() => {
    setErrors(prev => prev.map(err => ({ ...err, isDismissed: true })));
    setActiveError(null);
    
    // Clear all recovery timeouts
    recoveryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    recoveryTimeouts.current.clear();
  }, []);

  // Clear error from history
  const clearError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(err => err.id !== errorId));
    
    if (activeError?.id === errorId) {
      setActiveError(errors.find(err => !err.isDismissed && err.id !== errorId) || null);
    }

    // Clear recovery timeout
    const timeout = recoveryTimeouts.current.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      recoveryTimeouts.current.delete(errorId);
    }
  }, [activeError, errors]);

  // Clear all errors
  const clearAll = useCallback(() => {
    setErrors([]);
    setActiveError(null);
    
    // Clear all recovery timeouts
    recoveryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    recoveryTimeouts.current.clear();
  }, []);

  // Add recovery callback
  const addRecoveryCallback = useCallback((errorId: string, callback: () => Promise<void>) => {
    setErrors(prev =>
      prev.map(err =>
        err.id === errorId
          ? {
              ...err,
              recoveryCallbacks: [...(err.recoveryCallbacks || []), callback]
            }
          : err
      )
    );
  }, []);

  // Attempt error recovery
  const attemptRecovery = useCallback(async (errorId: string): Promise<boolean> => {
    const error = errors.find(err => err.id === errorId);
    if (!error || !errorLogger.shouldRetry(errorId)) {
      return false;
    }

    setIsRecovering(true);

    try {
      // Increment recovery attempts
      setErrors(prev =>
        prev.map(err =>
          err.id === errorId
            ? { ...err, recoveryAttempts: err.recoveryAttempts + 1 }
            : err
        )
      );

      // Run recovery callbacks
      if (error.recoveryCallbacks && error.recoveryCallbacks.length > 0) {
        for (const callback of error.recoveryCallbacks) {
          await callback();
        }
      }

      // Log successful recovery
      errorLogger.logRecovery(errorId, 'callbacks');
      errorLogger.incrementRetryCount(errorId);

      // Clear the error after successful recovery
      clearError(errorId);

      return true;
    } catch (recoveryError) {
      // Recovery failed, log the new error
      console.error('Recovery failed:', recoveryError);
      
      // Update retry count
      errorLogger.incrementRetryCount(errorId);
      
      return false;
    } finally {
      setIsRecovering(false);
    }
  }, [errors, clearError]);

  // Get error by ID
  const getErrorById = useCallback((errorId: string): AppError | undefined => {
    return errors.find(err => err.id === errorId);
  }, [errors]);

  // Get error history
  const getErrorHistory = useCallback((): AppError[] => {
    return [...errors];
  }, [errors]);

  // Get error count
  const getErrorCount = useCallback((since?: Date): number => {
    if (!since) {
      return errors.length;
    }
    
    return errors.filter(err => err.timestamp >= since).length;
  }, [errors]);

  // Clean up timeouts on unmount
  React.useEffect(() => {
    return () => {
      recoveryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const value: ErrorContextValue = {
    errors: errors.filter(err => !err.isDismissed),
    activeError,
    isRecovering,
    captureError,
    dismissError,
    dismissAll,
    clearError,
    clearAll,
    addRecoveryCallback,
    attemptRecovery,
    getErrorById,
    getErrorHistory,
    getErrorCount
  };

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
};

// Hook to use error context
export const useErrorContext = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  return context;
};

// Hook to capture errors
export const useErrorCapture = () => {
  const { captureError } = useErrorContext();
  
  return useCallback((
    error: unknown,
    severity?: ErrorSeverity,
    context?: Partial<ErrorContextType>
  ) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return captureError(errorObj, undefined, severity, context);
  }, [captureError]);
};

// Hook for error recovery
export const useErrorRecovery = (errorId?: string) => {
  const { attemptRecovery, addRecoveryCallback, getErrorById } = useErrorContext();
  
  const error = errorId ? getErrorById(errorId) : undefined;
  
  const recover = useCallback(async () => {
    if (!errorId) return false;
    return attemptRecovery(errorId);
  }, [errorId, attemptRecovery]);
  
  const addCallback = useCallback((callback: () => Promise<void>) => {
    if (!errorId) return;
    addRecoveryCallback(errorId, callback);
  }, [errorId, addRecoveryCallback]);
  
  return {
    error,
    recover,
    addCallback,
    canRecover: error ? errorLogger.shouldRetry(error.id) : false
  };
};