import React, { useState } from 'react';
import { 
  useRetry, 
  useOfflineQueue, 
  useNetworkStatus, 
  useRecoveryStrategy 
} from '@/hooks/useErrorRecovery';
import { 
  errorRecovery, 
  RetryStrategy,
  CircuitState 
} from '@/services/errorRecovery';
import { NetworkStatus, ConnectionQuality } from '@/services/networkMonitor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/loading';
import { useTranslation } from 'react-i18next';

/**
 * Demo component showcasing error recovery and network handling features
 */
export const ErrorRecoveryDemo: React.FC = () => {
  const { t } = useTranslation();
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use error recovery hooks
  const { retry, isRetrying, attempt, lastError } = useRetry({
    strategy: RetryStrategy.EXPONENTIAL,
    maxAttempts: 3,
    showToast: true,
    circuitBreakerKey: 'demo-api'
  });

  const { 
    queueRequest, 
    syncNow, 
    clearQueue, 
    queueSize, 
    syncStatus, 
    isSyncing 
  } = useOfflineQueue({
    priority: 5,
    showToast: true
  });

  const { 
    status, 
    quality, 
    isOnline, 
    networkInfo, 
    checkConnection 
  } = useNetworkStatus({
    showToast: true
  });

  const { 
    recover, 
    suggestions, 
    isRecovering, 
    recoveryAttempts 
  } = useRecoveryStrategy({
    autoRecover: false,
    showSuggestions: true
  });

  // Simulate API calls
  const simulateSuccessfulCall = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return 'Success! Data retrieved from server.';
  };

  const simulateFailingCall = async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    throw new Error('Network request failed');
  };

  const simulateRateLimitedCall = async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const error = new Error('Rate limit exceeded');
    (error as any).response = { status: 429, headers: { 'retry-after': '5' } };
    throw error;
  };

  // Handle API calls with retry
  const handleSuccessfulCall = async () => {
    setIsLoading(true);
    try {
      const result = await retry(simulateSuccessfulCall);
      setApiResponse(result);
    } catch (error) {
      console.error('Call failed after retries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFailingCall = async () => {
    setIsLoading(true);
    try {
      const result = await retry(simulateFailingCall);
      setApiResponse(result);
    } catch (error) {
      console.error('Call failed after retries:', error);
      
      // Try recovery suggestions
      if (error instanceof Error) {
        await recover(simulateFailingCall, error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateLimitedCall = async () => {
    setIsLoading(true);
    try {
      const result = await retry(simulateRateLimitedCall);
      setApiResponse(result);
    } catch (error) {
      console.error('Rate limited:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle offline queue
  const handleOfflineRequest = () => {
    const id = queueRequest(
      '/api/v1/demo/data',
      'POST',
      { 'Content-Type': 'application/json' },
      { message: 'Test data from offline queue' }
    );
    console.log('Queued request:', id);
  };

  // Get circuit breaker status
  const getCircuitStatus = () => {
    const stats = errorRecovery.getRecoveryStats();
    const circuitState = stats.circuitBreakerStates.get('demo-api');
    return circuitState || CircuitState.CLOSED;
  };

  // Network status badge color
  const getStatusColor = (status: NetworkStatus) => {
    switch (status) {
      case NetworkStatus.ONLINE:
        return 'bg-green-500';
      case NetworkStatus.OFFLINE:
        return 'bg-red-500';
      case NetworkStatus.SLOW:
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Connection quality badge color
  const getQualityColor = (quality: ConnectionQuality) => {
    switch (quality) {
      case ConnectionQuality.EXCELLENT:
        return 'bg-green-500';
      case ConnectionQuality.GOOD:
        return 'bg-blue-500';
      case ConnectionQuality.FAIR:
        return 'bg-yellow-500';
      case ConnectionQuality.POOR:
        return 'bg-orange-500';
      case ConnectionQuality.OFFLINE:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Error Recovery & Network Handling Demo</h1>

      {/* Network Status */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Network Status</h2>
        <div className="flex items-center gap-4 mb-4">
          <Badge className={getStatusColor(status)}>
            {t(`network.${status}`)}
          </Badge>
          <Badge className={getQualityColor(quality)}>
            {t(`network.${quality}`)}
          </Badge>
          {networkInfo.averageLatency && (
            <span className="text-sm text-gray-600">
              {t('network.latency', { value: Math.round(networkInfo.averageLatency) })}
            </span>
          )}
        </div>
        <Button onClick={checkConnection} size="sm">
          {t('network.check_connection')}
        </Button>
      </Card>

      {/* Error Recovery */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Error Recovery Demo</h2>
        
        <div className="space-y-4">
          {/* Circuit Breaker Status */}
          <div className="flex items-center gap-2">
            <span>Circuit Breaker:</span>
            <Badge variant={getCircuitStatus() === CircuitState.OPEN ? 'destructive' : 'default'}>
              {getCircuitStatus()}
            </Badge>
          </div>

          {/* Retry Status */}
          {isRetrying && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span>{t('errors.retry_attempt', { current: attempt, total: 3 })}</span>
            </div>
          )}

          {/* Error Display */}
          {lastError && (
            <Alert variant="destructive">
              <p>{lastError.message}</p>
            </Alert>
          )}

          {/* Recovery Suggestions */}
          {suggestions.length > 0 && (
            <Alert>
              <h3 className="font-semibold mb-2">{t('errors.recovery_suggestions')}</h3>
              <ul className="list-disc list-inside">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSuccessfulCall} 
              disabled={isLoading || isRetrying}
              variant="default"
            >
              {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
              Successful Call
            </Button>
            
            <Button 
              onClick={handleFailingCall} 
              disabled={isLoading || isRetrying}
              variant="secondary"
            >
              Failing Call (Will Retry)
            </Button>
            
            <Button 
              onClick={handleRateLimitedCall} 
              disabled={isLoading || isRetrying}
              variant="outline"
            >
              Rate Limited Call
            </Button>
          </div>

          {/* API Response */}
          {apiResponse && (
            <Alert variant="default" className="mt-4">
              <p>{apiResponse}</p>
            </Alert>
          )}
        </div>
      </Card>

      {/* Offline Queue */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Offline Queue</h2>
        
        <div className="space-y-4">
          {/* Queue Status */}
          <div className="flex items-center gap-4">
            <span>{t('offline.queue_size', { count: queueSize })}</span>
            {isSyncing && (
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span>{t('offline.syncing')}</span>
              </div>
            )}
          </div>

          {/* Sync Status */}
          {syncStatus.lastSyncTime && (
            <p className="text-sm text-gray-600">
              {t('offline.last_sync', { 
                time: new Date(syncStatus.lastSyncTime).toLocaleTimeString() 
              })}
            </p>
          )}

          {/* Conflicts */}
          {syncStatus.conflicts.length > 0 && (
            <Alert variant="warning">
              <p>{t('offline.conflicts_detected', { count: syncStatus.conflicts.length })}</p>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={handleOfflineRequest}
              variant="default"
              disabled={!isOnline}
            >
              Queue Request
            </Button>
            
            <Button 
              onClick={syncNow}
              variant="secondary"
              disabled={!isOnline || queueSize === 0 || isSyncing}
            >
              {t('offline.sync_now')}
            </Button>
            
            <Button 
              onClick={clearQueue}
              variant="outline"
              disabled={queueSize === 0}
            >
              {t('offline.clear_queue')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Recovery Stats */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Recovery Statistics</h2>
        <div className="space-y-2">
          <p>Recovery Attempts: {recoveryAttempts}</p>
          <Button 
            onClick={() => {
              const stats = errorRecovery.getRecoveryStats();
              console.log('Recovery Stats:', stats);
              alert(JSON.stringify(stats, null, 2));
            }}
            variant="outline"
            size="sm"
          >
            View Detailed Stats
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ErrorRecoveryDemo;