import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface Props {
  /**
   * Child components to render
   */
  children: ReactNode;
  /**
   * Fallback component to render on error
   */
  fallback?: ReactNode;
  /**
   * Callback when error occurs
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Whether to show error details in development
   */
  showDetails?: boolean;
  /**
   * Custom error message
   */
  errorMessage?: string;
  /**
   * Whether to allow resetting the form
   */
  allowReset?: boolean;
  /**
   * Callback when form is reset
   */
  onReset?: () => void;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Form name for error reporting
   */
  formName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary specifically for forms
 */
export class ErrorBoundaryForm extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, formName } = this.props;

    // Log error to console
    console.error(`Form Error Boundary caught error in ${formName || 'form'}:`, error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call error callback if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Report to error tracking service
    if (typeof window !== 'undefined' && (window as any).errorReporter) {
      (window as any).errorReporter.report({
        error,
        errorInfo,
        context: {
          component: 'ErrorBoundaryForm',
          formName,
        },
      });
    }
  }

  handleReset = () => {
    const { onReset } = this.props;

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call reset callback if provided
    if (onReset) {
      onReset();
    }
  };

  render() {
    const { 
      children, 
      fallback, 
      showDetails = process.env.NODE_ENV === 'development',
      errorMessage,
      allowReset = true,
      className,
      formName,
    } = this.props;
    const { hasError, error, errorInfo } = this.state;

    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          errorMessage={errorMessage}
          showDetails={showDetails}
          allowReset={allowReset}
          onReset={this.handleReset}
          className={className}
          formName={formName}
        />
      );
    }

    return children;
  }
}

/**
 * Default error fallback component
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorMessage?: string;
  showDetails?: boolean;
  allowReset?: boolean;
  onReset?: () => void;
  className?: string;
  formName?: string;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorMessage,
  showDetails,
  allowReset,
  onReset,
  className,
  formName,
}) => {
  const [showStack, setShowStack] = React.useState(false);

  return (
    <div
      className={clsx(
        'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
        'rounded-lg p-6',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon 
          className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" 
          aria-hidden="true"
        />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
              {errorMessage || 'Form Error'}
            </h3>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              An error occurred while rendering {formName ? `the ${formName} form` : 'this form'}. 
              {allowReset && ' You can try resetting the form or refreshing the page.'}
            </p>
          </div>

          {showDetails && error && (
            <div className="space-y-2">
              <div className="bg-red-100 dark:bg-red-800/20 rounded p-3">
                <p className="text-sm font-mono text-red-700 dark:text-red-300">
                  {error.message}
                </p>
              </div>

              {errorInfo && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowStack(!showStack)}
                    className={clsx(
                      'text-sm text-red-600 dark:text-red-400',
                      'hover:text-red-700 dark:hover:text-red-300',
                      'underline focus:outline-none focus:ring-2',
                      'focus:ring-red-500 focus:ring-offset-2',
                      'dark:focus:ring-offset-gray-900 rounded'
                    )}
                  >
                    {showStack ? 'Hide' : 'Show'} stack trace
                  </button>

                  {showStack && (
                    <pre className={clsx(
                      'mt-2 text-xs overflow-auto p-3 rounded',
                      'bg-red-100 dark:bg-red-800/20',
                      'text-red-700 dark:text-red-300',
                      'max-h-48'
                    )}>
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {allowReset && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onReset}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2',
                  'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
                  'text-white font-medium text-sm rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-red-500',
                  'focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                  'transition-colors'
                )}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Reset Form
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className={clsx(
                  'px-4 py-2 text-sm font-medium',
                  'text-red-700 dark:text-red-300',
                  'hover:text-red-800 dark:hover:text-red-200',
                  'focus:outline-none focus:ring-2 focus:ring-red-500',
                  'focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                  'rounded-md transition-colors'
                )}
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for using error boundary with forms
 */
export function useFormErrorBoundary() {
  const { t } = useTranslation();
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
    console.error('Form error captured:', error);
  }, []);

  return {
    error,
    resetError,
    captureError,
    ErrorBoundary: React.useCallback(
      ({ children, ...props }: Partial<Props> & { children: ReactNode }) => (
        <ErrorBoundaryForm
          onError={captureError}
          onReset={resetError}
          errorMessage={t('errors.formRenderError', 'Unable to display form')}
          {...props}
        >
          {children}
        </ErrorBoundaryForm>
      ),
      [captureError, resetError, t]
    ),
  };
}

/**
 * With error boundary HOC for forms
 */
export function withFormErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundaryForm {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundaryForm>
    );
  };

  WrappedComponent.displayName = `withFormErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}