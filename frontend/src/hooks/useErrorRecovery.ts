import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  errorRecovery, 
  RetryStrategy, 
  RetryConfig,
  executeWithRetry,
  executeWithCircuitBreaker,
  getRecoverySuggestions
} from '@/services/errorRecovery';
import { 
  networkMonitor, 
  NetworkStatus,
  ConnectionQuality,
  NetworkChangeEvent,
  queueOfflineRequest
} from '@/services/networkMonitor';
import { 
  offlineManager,
  SyncStatus,
  ConflictResolution,
  queueForSync
} from '@/utils/offline';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

// Hook options
export interface UseRetryOptions extends Partial<RetryConfig> {
  onSuccess?: (result: any) => void;
  onError?: (error: Error, attempts: number) => void;
  showToast?: boolean;
  circuitBreakerKey?: string;
}

export interface UseOfflineQueueOptions {
  priority?: number;
  showToast?: boolean;
  autoSync?: boolean;
  conflictResolution?: ConflictResolution;
}

export interface UseNetworkStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  onSlowConnection?: () => void;
  showToast?: boolean;
}

export interface UseRecoveryStrategyOptions {
  strategy?: RetryStrategy;
  maxAttempts?: number;
  showSuggestions?: boolean;
  autoRecover?: boolean;
}

/**
 * Hook for retrying failed operations
 */
export function useRetry<T = any>(options: UseRetryOptions = {}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const toast = useToast();
  const { t } = useTranslation();

  const retry = useCallback(async (operation: () => Promise<T>): Promise<T> => {
    setIsRetrying(true);
    setLastError(null);
    setAttempt(0);

    const config: RetryConfig = {
      maxAttempts: options.maxAttempts || 3,
      strategy: options.strategy || RetryStrategy.EXPONENTIAL,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      jitter: options.jitter !== false,
      backoffMultiplier: options.backoffMultiplier || 2
    };

    try {
      let result: T;

      if (options.circuitBreakerKey) {
        result = await executeWithCircuitBreaker(
          options.circuitBreakerKey,
          () => executeWithRetry(operation, config)
        );
      } else {
        result = await executeWithRetry(operation, config);
      }

      if (options.onSuccess) {
        options.onSuccess(result);
      }

      if (options.showToast !== false) {
        toast.success(t('common.success'));
      }

      return result;
    } catch (error) {
      const err = error as Error;
      setLastError(err);

      if (options.onError) {
        options.onError(err, config.maxAttempts);
      }

      if (options.showToast !== false) {
        toast.error(t('errors.operation_failed', { error: err.message }));
      }

      throw err;
    } finally {
      setIsRetrying(false);
    }
  }, [options, toast, t]);

  const reset = useCallback(() => {
    setIsRetrying(false);
    setAttempt(0);
    setLastError(null);
  }, []);

  return {
    retry,
    isRetrying,
    attempt,
    lastError,
    reset
  };
}

/**
 * Hook for managing offline request queue
 */
export function useOfflineQueue(options: UseOfflineQueueOptions = {}) {
  const [queueSize, setQueueSize] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(offlineManager.getSyncStatus());
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const updateQueueSize = () => {
      const requests = networkMonitor.getQueuedRequests();
      setQueueSize(requests.length);
    };

    const handleQueueUpdate = (processed: number, remaining: number) => {
      setQueueSize(remaining);
      
      if (options.showToast !== false && processed > 0) {
        toast.info(t('offline.synced_items', { count: processed }));
      }
    };

    const handleSyncUpdate = (status: SyncStatus) => {
      setSyncStatus(status);
      setIsSyncing(status.inProgress);

      if (options.showToast !== false) {
        if (status.conflicts.length > 0) {
          toast.warning(t('offline.conflicts_detected', { count: status.conflicts.length }));
        }
        
        if (!status.inProgress && status.errors.length > 0) {
          toast.error(t('offline.sync_errors', { count: status.errors.length }));
        }
      }
    };

    networkMonitor.addQueueListener(handleQueueUpdate);
    offlineManager.addSyncListener(handleSyncUpdate);
    updateQueueSize();

    return () => {
      networkMonitor.removeQueueListener(handleQueueUpdate);
      offlineManager.removeSyncListener(handleSyncUpdate);
    };
  }, [options.showToast, toast, t]);

  const queueRequest = useCallback((
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: any
  ): string => {
    try {
      // Queue in network monitor for immediate retry when online
      const id = queueOfflineRequest({
        url,
        method,
        headers,
        body,
        priority: options.priority || 5,
        onSuccess: (response) => {
          if (options.showToast !== false) {
            toast.success(t('offline.request_synced'));
          }
        },
        onError: (error) => {
          // If network monitor fails, queue for later sync
          queueForSync({
            url,
            method,
            headers,
            body,
            priority: options.priority || 5
          });
        }
      });

      if (options.showToast !== false) {
        toast.info(t('offline.request_queued'));
      }

      return id;
    } catch (error) {
      toast.error(t('offline.queue_error'));
      throw error;
    }
  }, [options.priority, options.showToast, toast, t]);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;

    try {
      await offlineManager.sync(options.conflictResolution || ConflictResolution.NEWEST_WINS);
      
      if (options.showToast !== false) {
        toast.success(t('offline.sync_complete'));
      }
    } catch (error) {
      toast.error(t('offline.sync_failed'));
    }
  }, [isSyncing, options.conflictResolution, options.showToast, toast, t]);

  const clearQueue = useCallback(() => {
    networkMonitor.clearQueue();
    offlineManager.clearSyncQueue();
    setQueueSize(0);
    
    if (options.showToast !== false) {
      toast.info(t('offline.queue_cleared'));
    }
  }, [options.showToast, toast, t]);

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'server' | 'merge',
    mergedData?: any
  ) => {
    try {
      await offlineManager.resolveConflict(conflictId, resolution, mergedData);
      
      if (options.showToast !== false) {
        toast.success(t('offline.conflict_resolved'));
      }
    } catch (error) {
      toast.error(t('offline.conflict_resolution_failed'));
    }
  }, [options.showToast, toast, t]);

  return {
    queueRequest,
    syncNow,
    clearQueue,
    resolveConflict,
    queueSize,
    syncStatus,
    isSyncing,
    conflicts: syncStatus.conflicts
  };
}

/**
 * Hook for monitoring network status
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const [status, setStatus] = useState<NetworkStatus>(networkMonitor.getStatus());
  const [quality, setQuality] = useState<ConnectionQuality>(networkMonitor.getConnectionQuality());
  const [isOnline, setIsOnline] = useState(networkMonitor.isOnline());
  const [networkInfo, setNetworkInfo] = useState(networkMonitor.getNetworkInfo());
  const previousStatus = useRef<NetworkStatus>(status);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handleNetworkChange = (event: NetworkChangeEvent) => {
      setStatus(event.currentStatus);
      setQuality(event.connectionQuality);
      setIsOnline(event.currentStatus === NetworkStatus.ONLINE);
      setNetworkInfo(networkMonitor.getNetworkInfo());

      // Handle status transitions
      if (event.previousStatus !== event.currentStatus) {
        if (event.currentStatus === NetworkStatus.ONLINE) {
          if (options.onOnline) {
            options.onOnline();
          }
          
          if (options.showToast !== false) {
            toast.success(t('network.back_online'));
          }
        } else if (event.currentStatus === NetworkStatus.OFFLINE) {
          if (options.onOffline) {
            options.onOffline();
          }
          
          if (options.showToast !== false) {
            toast.error(t('network.went_offline'));
          }
        } else if (event.currentStatus === NetworkStatus.SLOW) {
          if (options.onSlowConnection) {
            options.onSlowConnection();
          }
          
          if (options.showToast !== false) {
            toast.warning(t('network.slow_connection'));
          }
        }
      }

      previousStatus.current = event.currentStatus;
    };

    networkMonitor.addListener(handleNetworkChange);

    // Get initial state
    setNetworkInfo(networkMonitor.getNetworkInfo());

    return () => {
      networkMonitor.removeListener(handleNetworkChange);
    };
  }, [options, toast, t]);

  const checkConnection = useCallback(async () => {
    // Force a network check
    networkMonitor.startMonitoring();
    
    // Wait a bit for the check to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const info = networkMonitor.getNetworkInfo();
    setNetworkInfo(info);
    setStatus(info.status);
    setQuality(info.quality);
    setIsOnline(info.status === NetworkStatus.ONLINE);
    
    return info;
  }, []);

  return {
    status,
    quality,
    isOnline,
    networkInfo,
    checkConnection
  };
}

/**
 * Hook for managing error recovery strategies
 */
export function useRecoveryStrategy(options: UseRecoveryStrategyOptions = {}) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const toast = useToast();
  const { t } = useTranslation();
  const { retry } = useRetry({
    strategy: options.strategy,
    maxAttempts: options.maxAttempts,
    showToast: false
  });

  const recover = useCallback(async <T,>(
    operation: () => Promise<T>,
    error?: Error
  ): Promise<T | null> => {
    setIsRecovering(true);
    setRecoveryAttempts(prev => prev + 1);

    try {
      // If we have an error, get recovery suggestions
      if (error && options.showSuggestions !== false) {
        const errorSuggestions = getRecoverySuggestions(error);
        setSuggestions(errorSuggestions);
        
        // Show suggestions to user
        if (errorSuggestions.length > 0) {
          toast.info(
            <div>
              <strong>{t('errors.recovery_suggestions')}</strong>
              <ul className="mt-2 list-disc list-inside">
                {errorSuggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>,
            { duration: 5000 }
          );
        }
      }

      // Auto-recover if enabled
      if (options.autoRecover !== false) {
        const result = await retry(operation);
        
        toast.success(t('errors.recovery_successful'));
        return result;
      }

      return null;
    } catch (recoveryError) {
      toast.error(t('errors.recovery_failed'));
      throw recoveryError;
    } finally {
      setIsRecovering(false);
    }
  }, [options, retry, toast, t]);

  const resetRecovery = useCallback(() => {
    setIsRecovering(false);
    setSuggestions([]);
    setRecoveryAttempts(0);
  }, []);

  const getRecoveryStats = useCallback(() => {
    return errorRecovery.getRecoveryStats();
  }, []);

  return {
    recover,
    resetRecovery,
    getRecoveryStats,
    isRecovering,
    suggestions,
    recoveryAttempts
  };
}