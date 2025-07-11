import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useRetry, 
  useOfflineQueue, 
  useNetworkStatus, 
  useRecoveryStrategy 
} from '../useErrorRecovery';
import { 
  errorRecovery, 
  RetryStrategy, 
  executeWithRetry, 
  executeWithCircuitBreaker 
} from '@/services/errorRecovery';
import { 
  networkMonitor, 
  NetworkStatus, 
  ConnectionQuality 
} from '@/services/networkMonitor';
import { 
  offlineManager, 
  SyncStatus, 
  ConflictResolution 
} from '@/utils/offline';
import { useToast } from '@/hooks/useToast';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/services/errorRecovery');
vi.mock('@/services/networkMonitor');
vi.mock('@/utils/offline');
vi.mock('@/hooks/useToast');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    }
  })
}));

describe('useRetry Hook', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue(mockToast);
    (executeWithRetry as any).mockImplementation((op: Function) => op());
    (executeWithCircuitBreaker as any).mockImplementation((key: string, op: Function) => op());
  });

  it('should retry failed operations', async () => {
    const { result } = renderHook(() => useRetry({
      maxAttempts: 3,
      strategy: RetryStrategy.EXPONENTIAL
    }));

    let attempts = 0;
    const operation = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    let outcome: any;
    await act(async () => {
      outcome = await result.current.retry(operation);
    });

    expect(outcome).toBe('success');
    expect(result.current.isRetrying).toBe(false);
  });

  it('should handle retry with circuit breaker', async () => {
    const { result } = renderHook(() => useRetry({
      circuitBreakerKey: 'test-key'
    }));

    const operation = vi.fn().mockResolvedValue('circuit success');

    await act(async () => {
      await result.current.retry(operation);
    });

    expect(executeWithCircuitBreaker).toHaveBeenCalledWith(
      'test-key',
      expect.any(Function)
    );
  });

  it('should call success callback', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRetry({
      onSuccess,
      showToast: false
    }));

    const operation = vi.fn().mockResolvedValue('success data');

    await act(async () => {
      await result.current.retry(operation);
    });

    expect(onSuccess).toHaveBeenCalledWith('success data');
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('should call error callback on failure', async () => {
    const onError = vi.fn();
    (executeWithRetry as any).mockRejectedValue(new Error('Final failure'));

    const { result } = renderHook(() => useRetry({
      onError,
      maxAttempts: 2
    }));

    const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

    await act(async () => {
      try {
        await result.current.retry(operation);
      } catch (error) {
        // Expected
      }
    });

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      2
    );
    expect(result.current.lastError).toEqual(expect.any(Error));
  });

  it('should reset state', async () => {
    const { result } = renderHook(() => useRetry());

    const operation = vi.fn().mockRejectedValue(new Error('Error'));
    
    await act(async () => {
      try {
        await result.current.retry(operation);
      } catch (error) {
        // Expected
      }
    });

    expect(result.current.lastError).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.lastError).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.attempt).toBe(0);
  });
});

describe('useOfflineQueue Hook', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  };

  const mockSyncStatus: SyncStatus = {
    inProgress: false,
    lastSync: new Date(),
    pendingChanges: 0,
    conflicts: [],
    errors: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue(mockToast);
    (networkMonitor.getQueuedRequests as any).mockReturnValue([]);
    (networkMonitor.queueOfflineRequest as any).mockReturnValue('queue-123');
    (offlineManager.getSyncStatus as any).mockReturnValue(mockSyncStatus);
    (offlineManager.sync as any).mockResolvedValue(undefined);
    (offlineManager.resolveConflict as any).mockResolvedValue(undefined);
  });

  it('should queue requests when offline', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      const id = result.current.queueRequest(
        '/api/test',
        'POST',
        { 'Content-Type': 'application/json' },
        { data: 'test' }
      );
      expect(id).toBe('queue-123');
    });

    expect(networkMonitor.queueOfflineRequest).toHaveBeenCalledWith({
      url: '/api/test',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { data: 'test' },
      priority: 5,
      onSuccess: expect.any(Function),
      onError: expect.any(Function)
    });
  });

  it('should update queue size', () => {
    (networkMonitor.getQueuedRequests as any).mockReturnValue([
      { id: '1', request: {} },
      { id: '2', request: {} }
    ]);

    const { result, rerender } = renderHook(() => useOfflineQueue());

    expect(result.current.queueSize).toBe(2);

    // Simulate queue update
    act(() => {
      const listeners = (networkMonitor.addQueueListener as any).mock.calls[0];
      if (listeners && listeners[0]) {
        listeners[0](1, 1); // 1 processed, 1 remaining
      }
    });

    rerender();
    expect(mockToast.info).toHaveBeenCalledWith('offline.synced_items {"count":1}');
  });

  it('should sync offline data', async () => {
    const { result } = renderHook(() => useOfflineQueue({
      conflictResolution: ConflictResolution.LOCAL_WINS
    }));

    await act(async () => {
      await result.current.syncNow();
    });

    expect(offlineManager.sync).toHaveBeenCalledWith(ConflictResolution.LOCAL_WINS);
    expect(mockToast.success).toHaveBeenCalledWith('offline.sync_complete');
  });

  it('should handle sync failures', async () => {
    (offlineManager.sync as any).mockRejectedValue(new Error('Sync failed'));

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockToast.error).toHaveBeenCalledWith('offline.sync_failed');
  });

  it('should clear queue', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.clearQueue();
    });

    expect(networkMonitor.clearQueue).toHaveBeenCalled();
    expect(offlineManager.clearSyncQueue).toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenCalledWith('offline.queue_cleared');
  });

  it('should resolve conflicts', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.resolveConflict('conflict-123', 'local');
    });

    expect(offlineManager.resolveConflict).toHaveBeenCalledWith(
      'conflict-123',
      'local',
      undefined
    );
    expect(mockToast.success).toHaveBeenCalledWith('offline.conflict_resolved');
  });

  it('should handle conflict resolution with merge', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    const mergedData = { merged: true };

    await act(async () => {
      await result.current.resolveConflict('conflict-123', 'merge', mergedData);
    });

    expect(offlineManager.resolveConflict).toHaveBeenCalledWith(
      'conflict-123',
      'merge',
      mergedData
    );
  });

  it('should show conflict warnings', () => {
    const conflictStatus: SyncStatus = {
      ...mockSyncStatus,
      conflicts: [
        { id: '1', localData: {}, serverData: {}, timestamp: new Date() },
        { id: '2', localData: {}, serverData: {}, timestamp: new Date() }
      ]
    };

    (offlineManager.getSyncStatus as any).mockReturnValue(conflictStatus);

    renderHook(() => useOfflineQueue());

    // Trigger sync status update
    act(() => {
      const listeners = (offlineManager.addSyncListener as any).mock.calls[0];
      if (listeners && listeners[0]) {
        listeners[0](conflictStatus);
      }
    });

    expect(mockToast.warning).toHaveBeenCalledWith('offline.conflicts_detected {"count":2}');
  });
});

describe('useNetworkStatus Hook', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue(mockToast);
    (networkMonitor.getStatus as any).mockReturnValue(NetworkStatus.ONLINE);
    (networkMonitor.getConnectionQuality as any).mockReturnValue(ConnectionQuality.GOOD);
    (networkMonitor.isOnline as any).mockReturnValue(true);
    (networkMonitor.getNetworkInfo as any).mockReturnValue({
      status: NetworkStatus.ONLINE,
      quality: ConnectionQuality.GOOD,
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      timestamp: new Date()
    });
  });

  it('should return current network status', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.status).toBe(NetworkStatus.ONLINE);
    expect(result.current.quality).toBe(ConnectionQuality.GOOD);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.networkInfo).toMatchObject({
      status: NetworkStatus.ONLINE,
      quality: ConnectionQuality.GOOD
    });
  });

  it('should handle online transition', () => {
    const onOnline = vi.fn();
    
    renderHook(() => useNetworkStatus({ onOnline }));

    // Simulate network change event
    act(() => {
      const listeners = (networkMonitor.addListener as any).mock.calls[0];
      if (listeners && listeners[0]) {
        listeners[0]({
          previousStatus: NetworkStatus.OFFLINE,
          currentStatus: NetworkStatus.ONLINE,
          connectionQuality: ConnectionQuality.GOOD
        });
      }
    });

    expect(onOnline).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('network.back_online');
  });

  it('should handle offline transition', () => {
    const onOffline = vi.fn();
    
    renderHook(() => useNetworkStatus({ onOffline }));

    act(() => {
      const listeners = (networkMonitor.addListener as any).mock.calls[0];
      if (listeners && listeners[0]) {
        listeners[0]({
          previousStatus: NetworkStatus.ONLINE,
          currentStatus: NetworkStatus.OFFLINE,
          connectionQuality: ConnectionQuality.OFFLINE
        });
      }
    });

    expect(onOffline).toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith('network.went_offline');
  });

  it('should handle slow connection', () => {
    const onSlowConnection = vi.fn();
    
    renderHook(() => useNetworkStatus({ onSlowConnection }));

    act(() => {
      const listeners = (networkMonitor.addListener as any).mock.calls[0];
      if (listeners && listeners[0]) {
        listeners[0]({
          previousStatus: NetworkStatus.ONLINE,
          currentStatus: NetworkStatus.SLOW,
          connectionQuality: ConnectionQuality.SLOW
        });
      }
    });

    expect(onSlowConnection).toHaveBeenCalled();
    expect(mockToast.warning).toHaveBeenCalledWith('network.slow_connection');
  });

  it('should check connection manually', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    let networkInfo: any;
    await act(async () => {
      networkInfo = await result.current.checkConnection();
    });

    expect(networkMonitor.startMonitoring).toHaveBeenCalled();
    expect(networkInfo).toMatchObject({
      status: NetworkStatus.ONLINE,
      quality: ConnectionQuality.GOOD
    });
  });

  it('should not show toasts when disabled', () => {
    renderHook(() => useNetworkStatus({ showToast: false }));

    act(() => {
      const listeners = (networkMonitor.addListener as any).mock.calls[0];
      if (listeners && listeners[0]) {
        listeners[0]({
          previousStatus: NetworkStatus.ONLINE,
          currentStatus: NetworkStatus.OFFLINE,
          connectionQuality: ConnectionQuality.OFFLINE
        });
      }
    });

    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

describe('useRecoveryStrategy Hook', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue(mockToast);
    (executeWithRetry as any).mockImplementation((op: Function) => op());
    (errorRecovery.getRecoverySuggestions as any).mockReturnValue([
      'Check your connection',
      'Try again later'
    ]);
    (errorRecovery.getRecoveryStats as any).mockReturnValue({
      totalAttempts: 10,
      successfulRecoveries: 8,
      failedRecoveries: 2,
      successRate: 80,
      circuitBreakerStates: new Map()
    });
  });

  it('should recover from errors with suggestions', async () => {
    const { result } = renderHook(() => useRecoveryStrategy({
      showSuggestions: true
    }));

    const operation = vi.fn().mockResolvedValue('recovered data');
    const error = new Error('Network error');

    let outcome: any;
    await act(async () => {
      outcome = await result.current.recover(operation, error);
    });

    expect(outcome).toBe('recovered data');
    expect(result.current.suggestions).toContain('Check your connection');
    expect(mockToast.info).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'div'
      }),
      { duration: 5000 }
    );
  });

  it('should auto recover by default', async () => {
    const { result } = renderHook(() => useRecoveryStrategy());

    const operation = vi.fn().mockResolvedValue('auto recovered');

    await act(async () => {
      await result.current.recover(operation);
    });

    expect(mockToast.success).toHaveBeenCalledWith('errors.recovery_successful');
  });

  it('should handle recovery failures', async () => {
    (executeWithRetry as any).mockRejectedValue(new Error('Recovery failed'));

    const { result } = renderHook(() => useRecoveryStrategy());

    const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

    await act(async () => {
      try {
        await result.current.recover(operation);
      } catch (error) {
        // Expected
      }
    });

    expect(mockToast.error).toHaveBeenCalledWith('errors.recovery_failed');
  });

  it('should track recovery attempts', async () => {
    const { result } = renderHook(() => useRecoveryStrategy());

    expect(result.current.recoveryAttempts).toBe(0);

    const operation = vi.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.recover(operation);
    });

    expect(result.current.recoveryAttempts).toBe(1);

    await act(async () => {
      await result.current.recover(operation);
    });

    expect(result.current.recoveryAttempts).toBe(2);
  });

  it('should reset recovery state', async () => {
    const { result } = renderHook(() => useRecoveryStrategy());

    const operation = vi.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.recover(operation, new Error('Test'));
    });

    expect(result.current.recoveryAttempts).toBe(1);
    expect(result.current.suggestions.length).toBeGreaterThan(0);

    act(() => {
      result.current.resetRecovery();
    });

    expect(result.current.recoveryAttempts).toBe(0);
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isRecovering).toBe(false);
  });

  it('should get recovery statistics', () => {
    const { result } = renderHook(() => useRecoveryStrategy());

    const stats = result.current.getRecoveryStats();

    expect(stats).toEqual({
      totalAttempts: 10,
      successfulRecoveries: 8,
      failedRecoveries: 2,
      successRate: 80,
      circuitBreakerStates: expect.any(Map)
    });
  });

  it('should skip auto recovery when disabled', async () => {
    const { result } = renderHook(() => useRecoveryStrategy({
      autoRecover: false
    }));

    const operation = vi.fn().mockResolvedValue('manual recovery');

    let outcome: any;
    await act(async () => {
      outcome = await result.current.recover(operation);
    });

    expect(outcome).toBeNull();
    expect(operation).not.toHaveBeenCalled();
  });
});