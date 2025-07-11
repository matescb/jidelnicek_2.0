// Error boundary components
export { 
  ErrorBoundary, 
  withErrorBoundary, 
  useErrorHandler 
} from '../ErrorBoundary';

// Error context and hooks
export {
  ErrorProvider,
  useErrorContext,
  useErrorCapture,
  useErrorRecovery,
  type ErrorContextValue,
  type AppError
} from '@/contexts/ErrorContext';

// Error logging service
export {
  errorLogger,
  logError,
  logRecovery,
  getErrorHistory,
  shouldRetry,
  ErrorSeverity,
  ErrorCategory,
  type ErrorContext,
  type ErrorLogEntry,
  type ErrorServiceConfig
} from '@/services/errorLogger';

// Error utilities
export {
  classifyError,
  parseStackTrace,
  getUserFriendlyMessage,
  formatErrorForDevelopment,
  isRetryableError,
  extractApiErrorDetails,
  createError,
  aggregateErrors,
  ErrorType
} from '@/utils/errorHelpers';

// Re-export UI components
export { ErrorMessage, ErrorToast } from '@/components/ui/error/ErrorMessage';