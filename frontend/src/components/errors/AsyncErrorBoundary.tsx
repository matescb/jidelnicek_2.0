import React, { Suspense, useState, useEffect } from 'react';
import { ErrorBoundary, withErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff, AlertCircle, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ErrorInfo } from 'react';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';
import { isRetryableError } from '@/utils/errorHelpers';

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  maxRetries?: number;
  retryDelay?: number;
  onLoadError?: (error: Error) => void;
}

// Loading fallback component
const DefaultLoadingFallback: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('common.loading')}
      </p>
    </div>
  );
};

const AsyncErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  reset: () => void;
  retryCount?: number;
  maxRetries?: number;
}> = ({ error, retry, reset, retryCount = 0, maxRetries = 3 }) => {
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Check if it's a chunk loading error
  const isChunkError = error.message.includes('Loading chunk') || 
                      error.message.includes('Failed to fetch dynamically imported module');
  
  const isNetworkError = error.message.toLowerCase().includes('network') ||
                        error.message.toLowerCase().includes('offline') ||
                        !navigator.onLine;

  const canRetry = retryCount < maxRetries && isRetryableError(error);

  // Auto-retry logic for chunk errors
  useEffect(() => {
    if (isChunkError && canRetry && retryCount === 0) {
      const timer = setTimeout(() => {
        handleRetry();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isChunkError, canRetry, retryCount]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      // If it's a chunk error, try clearing module cache
      if (isChunkError && 'webpackChunkName' in window) {
        // Force reload of failed chunks
        window.location.reload();
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retry();
      }
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setIsRetrying(false);
        setProgress(0);
      }, 300);
    }
  };

  const handleFullReload = () => {
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <AnimatePresence mode="wait">
          {isRetrying ? (
            <motion.div
              key="retrying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <RefreshCw className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('errors.async.retrying')}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-blue-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="mx-auto h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 
                            flex items-center justify-center">
                {isNetworkError ? (
                  <WifiOff className="h-10 w-10 text-red-600 dark:text-red-400" />
                ) : isChunkError ? (
                  <Download className="h-10 w-10 text-red-600 dark:text-red-400" />
                ) : (
                  <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {isNetworkError 
                    ? t('errors.async.networkTitle')
                    : isChunkError 
                    ? t('errors.async.chunkTitle')
                    : t('errors.async.title')
                  }
                </h2>

                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {isNetworkError 
                    ? t('errors.async.networkMessage')
                    : isChunkError 
                    ? t('errors.async.chunkMessage')
                    : t('errors.async.message')
                  }
                </p>

                {retryCount > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {t('errors.async.retryCount', { count: retryCount, max: maxRetries })}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {canRetry ? (
                  <Button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="inline-flex items-center"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('common.retry')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleFullReload}
                    className="inline-flex items-center"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('errors.async.fullReload')}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={reset}
                >
                  {t('common.cancel')}
                </Button>
              </div>

              {/* Helpful tips */}
              {isChunkError && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    {t('errors.async.tips')}
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• {t('errors.async.tip1')}</li>
                    <li>• {t('errors.async.tip2')}</li>
                    <li>• {t('errors.async.tip3')}</li>
                  </ul>
                </div>
              )}

              {/* Developer details */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 
                                   dark:hover:text-gray-300 text-center">
                    {t('errors.developerDetails')}
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto 
                                p-4 bg-red-50 dark:bg-red-900/20 rounded-lg max-h-40">
{error.message}
{error.stack}
                  </pre>
                </details>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export class AsyncErrorBoundary extends ErrorBoundary {
  private retryCount = 0;

  constructor(props: AsyncErrorBoundaryProps) {
    super({
      ...props,
      level: 'component',
      enableRecovery: true,
      customErrorComponent: ({ error, retry, reset }) => (
        <AsyncErrorFallback
          error={error}
          retry={() => {
            this.retryCount++;
            retry();
          }}
          reset={() => {
            this.retryCount = 0;
            reset();
          }}
          retryCount={this.retryCount}
          maxRetries={props.maxRetries}
        />
      ),
      onError: (error: Error, errorInfo: ErrorInfo) => {
        // Log async loading errors
        errorLogger.logError(error, ErrorSeverity.MEDIUM, errorInfo, {
          component: 'AsyncErrorBoundary',
          metadata: {
            retryCount: this.retryCount,
            isChunkError: error.message.includes('chunk'),
            isOnline: navigator.onLine
          }
        });

        if (props.onLoadError) {
          props.onLoadError(error);
        }
      }
    });
  }

  render() {
    const { children, loadingFallback } = this.props as AsyncErrorBoundaryProps;

    if (this.state.hasError) {
      return super.render();
    }

    return (
      <Suspense fallback={loadingFallback || <DefaultLoadingFallback />}>
        {children}
      </Suspense>
    );
  }
}

// HOC with Suspense and error boundary
export function withAsyncErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AsyncErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AsyncErrorBoundary {...options}>
      <Component {...props} />
    </AsyncErrorBoundary>
  );

  WrappedComponent.displayName = `withAsyncErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Lazy load helper with error boundary
export function lazyWithErrorBoundary<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options?: Omit<AsyncErrorBoundaryProps, 'children'>
): React.LazyExoticComponent<T> {
  const LazyComponent = React.lazy(factory);
  
  return React.lazy(() => 
    Promise.resolve({
      default: withAsyncErrorBoundary(LazyComponent, options) as T
    })
  );
}