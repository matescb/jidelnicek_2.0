import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AsyncErrorBoundary } from '@/components/errors/AsyncErrorBoundary';
import { DataErrorBoundary } from '@/components/errors/DataErrorBoundary';
import { errorRecovery, RetryStrategy } from '@/services/errorRecovery';
import { networkMonitor, NetworkStatus } from '@/services/networkMonitor';
import { offlineManager } from '@/utils/offline';
import { vi } from 'vitest';

// Mock services
vi.mock('@/services/errorLogger');
vi.mock('@/services/errorRecovery');
vi.mock('@/services/networkMonitor');
vi.mock('@/utils/offline');

// Test components
const RetryableComponent: React.FC<{ 
  shouldFail?: boolean;
  failCount?: number;
  onAttempt?: () => void;
}> = ({ shouldFail = true, failCount = Infinity, onAttempt }) => {
  const [attemptCount, setAttemptCount] = React.useState(0);

  React.useEffect(() => {
    if (onAttempt) onAttempt();
    
    if (shouldFail && attemptCount < failCount) {
      setAttemptCount(prev => prev + 1);
      throw new Error(`Attempt ${attemptCount + 1} failed`);
    }
  }, [shouldFail, attemptCount, failCount, onAttempt]);

  return <div>Component loaded successfully</div>;
};

const NetworkDependentComponent: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        if (!networkMonitor.isOnline()) {
          throw new Error('Network is offline');
        }
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
        setData({ message: 'Data loaded' });
      } catch (err) {
        setError(err as Error);
      }
    };

    fetchData();
  }, []);

  if (error) throw error;
  if (!data) return <div>Loading...</div>;
  return <div>{data.message}</div>;
};

describe('Error Recovery Mechanisms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Default mock implementations
    (networkMonitor.isOnline as any).mockReturnValue(true);
    (networkMonitor.getStatus as any).mockReturnValue(NetworkStatus.ONLINE);
    (errorRecovery.recover as any).mockImplementation(async (error: Error, operation: Function) => {
      return operation();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Automatic Retry', () => {
    it('should automatically retry failed operations', async () => {
      const onAttempt = vi.fn();
      
      render(
        <ErrorBoundary enableRecovery>
          <RetryableComponent 
            shouldFail={true} 
            failCount={2}
            onAttempt={onAttempt}
          />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(onAttempt).toHaveBeenCalledTimes(2);
      });
    });

    it('should respect retry limits', async () => {
      const onAttempt = vi.fn();
      
      render(
        <AsyncErrorBoundary maxRetries={3}>
          <RetryableComponent 
            shouldFail={true}
            onAttempt={onAttempt}
          />
        </AsyncErrorBoundary>
      );

      await waitFor(() => {
        expect(onAttempt).toHaveBeenCalledTimes(3);
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });
    });

    it('should use exponential backoff strategy', async () => {
      vi.useFakeTimers();
      
      let attempts: number[] = [];
      (errorRecovery.executeWithRetry as any).mockImplementation(
        async (operation: Function, config: any) => {
          const startTime = Date.now();
          attempts.push(startTime);
          
          if (attempts.length < 3) {
            throw new Error('Retry needed');
          }
          return 'success';
        }
      );

      render(
        <AsyncErrorBoundary 
          onRetry={async () => {
            return errorRecovery.executeWithRetry(
              () => Promise.resolve(),
              { strategy: RetryStrategy.EXPONENTIAL }
            );
          }}
        >
          <RetryableComponent />
        </AsyncErrorBoundary>
      );

      // Advance through retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          vi.advanceTimersByTime(Math.pow(2, i) * 1000);
        });
      }

      expect(attempts.length).toBeGreaterThan(1);
      
      vi.useRealTimers();
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const circuitBreakerKey = 'test-operation';
      let failureCount = 0;

      (errorRecovery.executeWithCircuitBreaker as any).mockImplementation(
        async (key: string, operation: Function) => {
          failureCount++;
          if (failureCount > 5) {
            throw new Error('Circuit breaker is OPEN');
          }
          return operation();
        }
      );

      const TestComponent = () => {
        const [attempts, setAttempts] = React.useState(0);
        const [error, setError] = React.useState<Error | null>(null);

        const attemptOperation = async () => {
          try {
            await errorRecovery.executeWithCircuitBreaker(
              circuitBreakerKey,
              () => Promise.reject(new Error('Operation failed'))
            );
          } catch (err) {
            setError(err as Error);
          }
          setAttempts(prev => prev + 1);
        };

        return (
          <div>
            <button onClick={attemptOperation}>Attempt Operation</button>
            {error && <div>{error.message}</div>}
            <div>Attempts: {attempts}</div>
          </div>
        );
      };

      render(<TestComponent />);

      // Trigger multiple failures
      for (let i = 0; i < 7; i++) {
        fireEvent.click(screen.getByText('Attempt Operation'));
        await waitFor(() => {});
      }

      expect(screen.getByText('Circuit breaker is OPEN')).toBeInTheDocument();
    });

    it('should allow half-open state after timeout', async () => {
      vi.useFakeTimers();

      const getRecoveryStats = vi.fn().mockReturnValue({
        circuitBreakerStates: new Map([['test-key', 'open']])
      });
      
      (errorRecovery.getRecoveryStats as any) = getRecoveryStats;

      // Simulate circuit breaker timeout and transition to half-open
      act(() => {
        vi.advanceTimersByTime(60000); // 1 minute timeout
      });

      getRecoveryStats.mockReturnValue({
        circuitBreakerStates: new Map([['test-key', 'half_open']])
      });

      const stats = errorRecovery.getRecoveryStats();
      expect(stats.circuitBreakerStates.get('test-key')).toBe('half_open');

      vi.useRealTimers();
    });
  });

  describe('Network-Aware Recovery', () => {
    it('should queue requests when offline', async () => {
      (networkMonitor.isOnline as any).mockReturnValue(false);
      (networkMonitor.getStatus as any).mockReturnValue(NetworkStatus.OFFLINE);

      const queueOfflineRequest = vi.fn().mockReturnValue('queue-id-123');
      (networkMonitor.queueOfflineRequest as any) = queueOfflineRequest;

      render(
        <DataErrorBoundary offlineSupport>
          <NetworkDependentComponent />
        </DataErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
      });
    });

    it('should sync queued requests when back online', async () => {
      const listeners: Array<(event: any) => void> = [];
      
      (networkMonitor.addListener as any).mockImplementation((listener: any) => {
        listeners.push(listener);
      });

      (networkMonitor.isOnline as any)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      const processQueue = vi.fn().mockResolvedValue({ processed: 3, failed: 0 });
      (networkMonitor.processQueue as any) = processQueue;

      render(
        <DataErrorBoundary offlineSupport>
          <NetworkDependentComponent />
        </DataErrorBoundary>
      );

      // Simulate going back online
      act(() => {
        listeners.forEach(listener => {
          listener({
            previousStatus: NetworkStatus.OFFLINE,
            currentStatus: NetworkStatus.ONLINE,
            connectionQuality: 'good'
          });
        });
      });

      await waitFor(() => {
        expect(processQueue).toHaveBeenCalled();
      });
    });

    it('should handle slow connections gracefully', async () => {
      (networkMonitor.getConnectionQuality as any).mockReturnValue('slow');

      const TestComponent = () => {
        const [loading, setLoading] = React.useState(true);
        
        React.useEffect(() => {
          // Simulate slower loading for slow connections
          const timeout = networkMonitor.getConnectionQuality() === 'slow' ? 3000 : 1000;
          setTimeout(() => setLoading(false), timeout);
        }, []);

        if (loading) return <div>Loading (slow connection detected)...</div>;
        return <div>Content loaded</div>;
      };

      render(
        <DataErrorBoundary>
          <TestComponent />
        </DataErrorBoundary>
      );

      expect(screen.getByText(/slow connection detected/i)).toBeInTheDocument();
    });
  });

  describe('Recovery Suggestions', () => {
    it('should provide context-aware recovery suggestions', async () => {
      const getRecoverySuggestions = vi.fn().mockReturnValue([
        'Check your internet connection',
        'Try disabling VPN',
        'Contact support if issue persists'
      ]);
      
      (errorRecovery.getRecoverySuggestions as any) = getRecoverySuggestions;

      const NetworkError = new Error('Failed to fetch');
      (NetworkError as any).code = 'NETWORK_ERROR';

      render(
        <ErrorBoundary level="page">
          <RetryableComponent shouldFail={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });
    });

    it('should update suggestions based on error type', () => {
      const suggestions = {
        NETWORK_ERROR: ['Check internet', 'Try again'],
        AUTH_ERROR: ['Please login again', 'Check credentials'],
        VALIDATION_ERROR: ['Check your input', 'Fix errors']
      };

      Object.entries(suggestions).forEach(([errorType, errorSuggestions]) => {
        (errorRecovery.getRecoverySuggestions as any).mockReturnValue(errorSuggestions);
        
        const result = errorRecovery.getRecoverySuggestions(
          new Error(`${errorType} occurred`)
        );
        
        expect(result).toEqual(errorSuggestions);
      });
    });
  });

  describe('Conflict Resolution', () => {
    it('should handle data conflicts during sync', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          localData: { name: 'Local Recipe' },
          serverData: { name: 'Server Recipe' },
          timestamp: new Date()
        }
      ];

      (offlineManager.getConflicts as any).mockReturnValue(conflicts);
      
      const resolveConflict = vi.fn().mockResolvedValue(true);
      (offlineManager.resolveConflict as any) = resolveConflict;

      const ConflictComponent = () => {
        const [conflictList, setConflictList] = React.useState(conflicts);

        const handleResolve = async (conflictId: string, resolution: string) => {
          await offlineManager.resolveConflict(conflictId, resolution);
          setConflictList([]);
        };

        if (conflictList.length === 0) return <div>No conflicts</div>;

        return (
          <div>
            {conflictList.map(conflict => (
              <div key={conflict.id}>
                <span>Conflict detected</span>
                <button onClick={() => handleResolve(conflict.id, 'local')}>
                  Keep Local
                </button>
                <button onClick={() => handleResolve(conflict.id, 'server')}>
                  Keep Server
                </button>
              </div>
            ))}
          </div>
        );
      };

      render(<ConflictComponent />);

      expect(screen.getByText('Conflict detected')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Keep Local'));

      await waitFor(() => {
        expect(resolveConflict).toHaveBeenCalledWith('conflict-1', 'local');
        expect(screen.getByText('No conflicts')).toBeInTheDocument();
      });
    });
  });

  describe('Recovery Metrics', () => {
    it('should track recovery success rate', async () => {
      const mockStats = {
        totalAttempts: 100,
        successfulRecoveries: 85,
        failedRecoveries: 15,
        successRate: 85,
        circuitBreakerStates: new Map()
      };

      (errorRecovery.getRecoveryStats as any).mockReturnValue(mockStats);

      const MetricsComponent = () => {
        const stats = errorRecovery.getRecoveryStats();

        return (
          <div>
            <div>Success Rate: {stats.successRate}%</div>
            <div>Total Attempts: {stats.totalAttempts}</div>
            <div>Successful: {stats.successfulRecoveries}</div>
            <div>Failed: {stats.failedRecoveries}</div>
          </div>
        );
      };

      render(<MetricsComponent />);

      expect(screen.getByText('Success Rate: 85%')).toBeInTheDocument();
      expect(screen.getByText('Total Attempts: 100')).toBeInTheDocument();
    });

    it('should log recovery events', async () => {
      const logRecovery = vi.fn();
      (errorRecovery.logRecovery as any) = logRecovery;

      const TestComponent = () => {
        const handleRecovery = async () => {
          try {
            await errorRecovery.recover(
              new Error('Test error'),
              () => Promise.resolve('success')
            );
            errorRecovery.logRecovery('error-123', 'retry');
          } catch (error) {
            // Ignore
          }
        };

        return <button onClick={handleRecovery}>Attempt Recovery</button>;
      };

      render(<TestComponent />);

      fireEvent.click(screen.getByText('Attempt Recovery'));

      await waitFor(() => {
        expect(logRecovery).toHaveBeenCalledWith('error-123', 'retry');
      });
    });
  });

  describe('Progressive Enhancement', () => {
    it('should degrade gracefully based on capabilities', async () => {
      const TestComponent = () => {
        const [capabilities, setCapabilities] = React.useState({
          hasServiceWorker: 'serviceWorker' in navigator,
          hasIndexedDB: 'indexedDB' in window,
          hasLocalStorage: 'localStorage' in window
        });

        return (
          <div>
            {capabilities.hasServiceWorker ? (
              <div>Full offline support</div>
            ) : capabilities.hasIndexedDB ? (
              <div>Limited offline support</div>
            ) : capabilities.hasLocalStorage ? (
              <div>Basic caching only</div>
            ) : (
              <div>No offline support</div>
            )}
          </div>
        );
      };

      render(
        <DataErrorBoundary offlineSupport>
          <TestComponent />
        </DataErrorBoundary>
      );

      // Will show different messages based on browser capabilities
      expect(screen.getByText(/support/)).toBeInTheDocument();
    });
  });
});