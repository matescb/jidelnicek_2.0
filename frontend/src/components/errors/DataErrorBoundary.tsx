import React, { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary, withErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff, Cloud, CloudOff, Database, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ErrorInfo } from 'react';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';
import { classifyError, ErrorType, isRetryableError } from '@/utils/errorHelpers';

interface DataErrorBoundaryProps {
  children: React.ReactNode;
  fallbackData?: any;
  onRetry?: () => Promise<void>;
  cacheKey?: string;
  showOfflineMode?: boolean;
  autoRetry?: boolean;
  retryInterval?: number;
  maxRetries?: number;
}

interface CachedData {
  data: any;
  timestamp: number;
  isStale: boolean;
}

const DataErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  reset: () => void;
  cachedData?: CachedData;
  isOnline: boolean;
  isRetrying: boolean;
  retryCount: number;
  nextRetryIn?: number;
}> = ({ 
  error, 
  retry, 
  reset, 
  cachedData, 
  isOnline, 
  isRetrying, 
  retryCount,
  nextRetryIn 
}) => {
  const { t } = useTranslation();
  const { type } = classifyError(error);

  const isNetworkError = type === ErrorType.NETWORK_ERROR || 
                        type === ErrorType.OFFLINE_ERROR ||
                        type === ErrorType.TIMEOUT_ERROR;

  const isServerError = type === ErrorType.SERVER_ERROR ||
                       type === ErrorType.RATE_LIMIT;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const getErrorIcon = () => {
    if (!isOnline) return <WifiOff className="h-8 w-8" />;
    if (isNetworkError) return <CloudOff className="h-8 w-8" />;
    if (isServerError) return <Cloud className="h-8 w-8" />;
    return <Database className="h-8 w-8" />;
  };

  const getErrorMessage = () => {
    if (!isOnline) return t('errors.data.offline');
    if (type === ErrorType.TIMEOUT_ERROR) return t('errors.data.timeout');
    if (type === ErrorType.RATE_LIMIT) return t('errors.data.rateLimit');
    if (type === ErrorType.SERVER_ERROR) return t('errors.data.serverError');
    if (type === ErrorType.NOT_FOUND) return t('errors.data.notFound');
    return t('errors.data.general');
  };

  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <AnimatePresence mode="wait">
          {isRetrying ? (
            <motion.div
              key="retrying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <RefreshCw className="mx-auto h-8 w-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('errors.data.retrying')}
              </p>
              {nextRetryIn && nextRetryIn > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  {t('errors.data.nextRetryIn', { time: formatTime(nextRetryIn) })}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Error Icon */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={`inline-flex items-center justify-center h-16 w-16 rounded-full
                             ${isOnline ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-800'}
                             ${isOnline ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  {getErrorIcon()}
                </motion.div>
              </div>

              {/* Error Message */}
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {isOnline ? t('errors.data.title') : t('errors.data.offlineTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {getErrorMessage()}
                </p>
                {retryCount > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    {t('errors.data.attempts', { count: retryCount })}
                  </p>
                )}
              </div>

              {/* Cached Data Notice */}
              {cachedData && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {cachedData.isStale 
                          ? t('errors.data.staleCacheAvailable')
                          : t('errors.data.cacheAvailable')
                        }
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {t('errors.data.cacheAge', { 
                          time: formatTime(Math.floor((Date.now() - cachedData.timestamp) / 1000))
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={retry}
                  disabled={!isOnline && !cachedData}
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('common.retry')}
                </Button>

                {cachedData && (
                  <Button
                    variant="outline"
                    onClick={reset}
                    className="flex-1"
                  >
                    {t('errors.data.useCached')}
                  </Button>
                )}

                {!cachedData && (
                  <Button
                    variant="outline"
                    onClick={reset}
                    className="flex-1"
                  >
                    {t('common.cancel')}
                  </Button>
                )}
              </div>

              {/* Offline Mode Tips */}
              {!isOnline && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('errors.data.offlineTips')}
                  </h3>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    <li>• {t('errors.data.offlineTip1')}</li>
                    <li>• {t('errors.data.offlineTip2')}</li>
                    <li>• {t('errors.data.offlineTip3')}</li>
                  </ul>
                </div>
              )}

              {/* Developer Details */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 
                                   dark:hover:text-gray-300 text-center">
                    {t('errors.developerDetails')}
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto 
                                p-4 bg-red-50 dark:bg-red-900/20 rounded-lg max-h-40">
{error.message}
Status: {(error as any).status || 'N/A'}
Type: {type}
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

export class DataErrorBoundary extends ErrorBoundary {
  private retryCount = 0;
  private retryTimeoutId?: NodeJS.Timeout;
  private cacheRef = React.createRef<CachedData>();

  constructor(props: DataErrorBoundaryProps) {
    super({
      ...props,
      level: 'component',
      enableRecovery: true,
      customErrorComponent: ({ error, retry, reset }) => {
        const [isOnline, setIsOnline] = useState(navigator.onLine);
        const [isRetrying, setIsRetrying] = useState(false);
        const [nextRetryIn, setNextRetryIn] = useState<number>(0);

        useEffect(() => {
          const handleOnline = () => setIsOnline(true);
          const handleOffline = () => setIsOnline(false);

          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);

          return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
        }, []);

        const handleRetry = useCallback(async () => {
          setIsRetrying(true);
          
          if (props.onRetry) {
            try {
              await props.onRetry();
              reset();
            } catch (err) {
              retry();
            }
          } else {
            retry();
          }
          
          setIsRetrying(false);
        }, [props.onRetry, retry, reset]);

        // Auto-retry effect
        useEffect(() => {
          if (props.autoRetry && isOnline && isRetryableError(error) && 
              this.retryCount < (props.maxRetries || 3)) {
            const interval = props.retryInterval || 5000;
            const delay = interval * Math.pow(2, this.retryCount); // Exponential backoff

            let countdown = Math.floor(delay / 1000);
            setNextRetryIn(countdown);

            const countdownInterval = setInterval(() => {
              countdown--;
              setNextRetryIn(countdown);
              if (countdown <= 0) {
                clearInterval(countdownInterval);
              }
            }, 1000);

            this.retryTimeoutId = setTimeout(() => {
              this.retryCount++;
              handleRetry();
            }, delay);

            return () => {
              clearTimeout(this.retryTimeoutId);
              clearInterval(countdownInterval);
            };
          }
        }, [isOnline, error]);

        return (
          <DataErrorFallback
            error={error}
            retry={handleRetry}
            reset={reset}
            cachedData={this.cacheRef.current || this.getCachedData()}
            isOnline={isOnline}
            isRetrying={isRetrying}
            retryCount={this.retryCount}
            nextRetryIn={nextRetryIn}
          />
        );
      },
      onError: (error: Error, errorInfo: ErrorInfo) => {
        // Check for cached data
        if (props.cacheKey) {
          this.loadCachedData(props.cacheKey);
        }

        // Log data errors
        errorLogger.logError(error, ErrorSeverity.HIGH, errorInfo, {
          component: 'DataErrorBoundary',
          metadata: {
            cacheKey: props.cacheKey,
            hasCachedData: !!this.cacheRef.current,
            isOnline: navigator.onLine,
            retryCount: this.retryCount
          }
        });
      }
    });
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    super.componentWillUnmount();
  }

  private loadCachedData(cacheKey: string) {
    try {
      const cached = localStorage.getItem(`data-cache-${cacheKey}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const ageInMs = Date.now() - parsedCache.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        this.cacheRef.current = {
          data: parsedCache.data,
          timestamp: parsedCache.timestamp,
          isStale: ageInMs > maxAge
        };
      }
    } catch (err) {
      console.error('Failed to load cached data:', err);
    }
  }

  private getCachedData(): CachedData | undefined {
    const { fallbackData } = this.props as DataErrorBoundaryProps;
    
    if (fallbackData) {
      return {
        data: fallbackData,
        timestamp: Date.now(),
        isStale: true
      };
    }

    return undefined;
  }

  render() {
    const { children } = this.props;

    if (this.state.hasError && this.cacheRef.current && !this.state.isRecovering) {
      // If we have cached data and error boundary is active, 
      // render children with cached data as fallback
      return (
        <>
          {super.render()}
          <div className="hidden">
            {React.cloneElement(children as React.ReactElement, {
              data: this.cacheRef.current.data,
              isStale: true
            })}
          </div>
        </>
      );
    }

    return super.render();
  }
}

// HOC for data components
export function withDataErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<DataErrorBoundaryProps, 'children'>
) {
  return withErrorBoundary(Component, {
    level: 'component',
    ...options
  });
}

// Hook for data error handling with caching
export function useDataErrorHandler(cacheKey?: string) {
  const [cachedData, setCachedData] = useState<any>(null);

  const saveToCacheData = useCallback((data: any) => {
    if (!cacheKey) return;

    try {
      localStorage.setItem(`data-cache-${cacheKey}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Failed to cache data:', err);
    }
  }, [cacheKey]);

  const loadFromCache = useCallback(() => {
    if (!cacheKey) return null;

    try {
      const cached = localStorage.getItem(`data-cache-${cacheKey}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        setCachedData(parsedCache.data);
        return parsedCache.data;
      }
    } catch (err) {
      console.error('Failed to load cached data:', err);
    }

    return null;
  }, [cacheKey]);

  return {
    saveToCacheData,
    loadFromCache,
    cachedData
  };
}