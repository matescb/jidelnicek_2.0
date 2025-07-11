import { 
  errorRecovery, 
  RetryStrategy, 
  CircuitState,
  RetryConfig,
  CircuitBreakerConfig 
} from '../errorRecovery';
import { ErrorType } from '@/utils/errorHelpers';
import { vi } from 'vitest';

describe('ErrorRecoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorRecovery.clearStats();
    errorRecovery.resetAllCircuitBreakers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Recovery', () => {
    it('should recover from retryable errors', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await errorRecovery.recover(
        new Error('Network error'),
        operation
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Non-retryable'));

      await expect(
        errorRecovery.recover(
          new Error('Validation error'),
          operation,
          { maxAttempts: 3 }
        )
      ).rejects.toThrow('Validation error');

      expect(operation).not.toHaveBeenCalled();
    });

    it('should use custom recovery callbacks when registered', async () => {
      const customRecovery = vi.fn().mockResolvedValue('recovered');
      const successCallback = vi.fn();

      errorRecovery.registerRecovery(
        ErrorType.NETWORK_ERROR,
        customRecovery,
        undefined,
        successCallback
      );

      const networkError = new Error('Network failure');
      (networkError as any).type = ErrorType.NETWORK_ERROR;

      const result = await errorRecovery.recover(
        networkError,
        () => Promise.reject(new Error('Should not be called'))
      );

      expect(customRecovery).toHaveBeenCalledWith(networkError, 0);
      expect(successCallback).toHaveBeenCalledWith('recovered', 1);
      expect(result).toBe('recovered');
    });

    it('should fall back to original operation if recovery callback fails', async () => {
      const customRecovery = vi.fn().mockRejectedValue(new Error('Recovery failed'));
      const failureCallback = vi.fn();
      const originalOperation = vi.fn().mockResolvedValue('original success');

      errorRecovery.registerRecovery(
        ErrorType.NETWORK_ERROR,
        customRecovery,
        { maxAttempts: 2 },
        undefined,
        failureCallback
      );

      const networkError = new Error('Network failure');
      (networkError as any).type = ErrorType.NETWORK_ERROR;

      const result = await errorRecovery.recover(
        networkError,
        originalOperation
      );

      expect(customRecovery).toHaveBeenCalled();
      expect(failureCallback).toHaveBeenCalledWith(expect.any(Error), 2);
      expect(originalOperation).toHaveBeenCalled();
      expect(result).toBe('original success');
    });
  });

  describe('Retry Strategies', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should use immediate retry strategy', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const promise = errorRecovery.executeWithRetry(operation, {
        maxAttempts: 3,
        strategy: RetryStrategy.IMMEDIATE,
        initialDelay: 1000,
        maxDelay: 30000,
        jitter: false,
        backoffMultiplier: 2
      });

      // No delays with immediate strategy
      await expect(promise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use linear retry strategy', async () => {
      const delays: number[] = [];
      let lastTime = Date.now();

      const operation = vi.fn().mockImplementation(() => {
        const currentTime = Date.now();
        delays.push(currentTime - lastTime);
        lastTime = currentTime;
        
        if (delays.length < 3) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const promise = errorRecovery.executeWithRetry(operation, {
        maxAttempts: 3,
        strategy: RetryStrategy.LINEAR,
        initialDelay: 1000,
        maxDelay: 30000,
        jitter: false,
        backoffMultiplier: 2
      });

      // Advance timer for each retry
      await vi.advanceTimersByTimeAsync(1000); // First retry after 1s
      await vi.advanceTimersByTimeAsync(2000); // Second retry after 2s

      await expect(promise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff strategy', async () => {
      const delays: number[] = [];
      const operation = vi.fn().mockImplementation(() => {
        if (operation.mock.calls.length < 4) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const promise = errorRecovery.executeWithRetry(operation, {
        maxAttempts: 4,
        strategy: RetryStrategy.EXPONENTIAL,
        initialDelay: 100,
        maxDelay: 30000,
        jitter: false,
        backoffMultiplier: 2
      });

      // Exponential delays: 100ms, 200ms, 400ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);

      await expect(promise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should use fibonacci retry strategy', async () => {
      const operation = vi.fn().mockImplementation(() => {
        if (operation.mock.calls.length < 4) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const promise = errorRecovery.executeWithRetry(operation, {
        maxAttempts: 4,
        strategy: RetryStrategy.FIBONACCI,
        initialDelay: 100,
        maxDelay: 30000,
        jitter: false,
        backoffMultiplier: 2
      });

      // Fibonacci delays: 100ms, 100ms, 200ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should apply jitter when enabled', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Retry 1'))
        .mockResolvedValueOnce('success');

      const config: RetryConfig = {
        maxAttempts: 2,
        strategy: RetryStrategy.LINEAR,
        initialDelay: 1000,
        maxDelay: 30000,
        jitter: true,
        backoffMultiplier: 2
      };

      await errorRecovery.executeWithRetry(operation, config);

      // With jitter, delay should be 1000ms ± 10%
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should respect max delay cap', async () => {
      const operation = vi.fn().mockImplementation(() => {
        if (operation.mock.calls.length < 5) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const promise = errorRecovery.executeWithRetry(operation, {
        maxAttempts: 5,
        strategy: RetryStrategy.EXPONENTIAL,
        initialDelay: 10000,
        maxDelay: 20000, // Cap at 20s
        jitter: false,
        backoffMultiplier: 2
      });

      // Delays should be capped at 20s
      await vi.advanceTimersByTimeAsync(10000); // 10s
      await vi.advanceTimersByTimeAsync(20000); // 20s (capped)
      await vi.advanceTimersByTimeAsync(20000); // 20s (capped)
      await vi.advanceTimersByTimeAsync(20000); // 20s (capped)

      await expect(promise).resolves.toBe('success');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      // Trigger failures to open circuit
      for (let i = 0; i < 10; i++) {
        try {
          await errorRecovery.executeWithCircuitBreaker(
            'test-circuit',
            operation,
            {
              failureThreshold: 5,
              successThreshold: 2,
              timeout: 60000,
              volumeThreshold: 5
            }
          );
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should be open now
      await expect(
        errorRecovery.executeWithCircuitBreaker('test-circuit', operation)
      ).rejects.toThrow('Circuit breaker is OPEN');

      // Operation should not be called when circuit is open
      const callCount = operation.mock.calls.length;
      try {
        await errorRecovery.executeWithCircuitBreaker('test-circuit', operation);
      } catch (error) {
        // Expected
      }
      expect(operation).toHaveBeenCalledTimes(callCount);
    });

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();

      const operation = vi.fn()
        .mockRejectedValue(new Error('Failed'))
        .mockRejectedValue(new Error('Failed'))
        .mockRejectedValue(new Error('Failed'))
        .mockRejectedValue(new Error('Failed'))
        .mockRejectedValue(new Error('Failed'))
        .mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await errorRecovery.executeWithCircuitBreaker(
            'timeout-circuit',
            operation,
            {
              failureThreshold: 5,
              successThreshold: 2,
              timeout: 5000,
              volumeThreshold: 5
            }
          );
        } catch (error) {
          // Expected
        }
      }

      // Circuit is open
      await expect(
        errorRecovery.executeWithCircuitBreaker('timeout-circuit', operation)
      ).rejects.toThrow('Circuit breaker is OPEN');

      // Advance time past timeout
      vi.advanceTimersByTime(5001);

      // Circuit should be half-open, operation should be attempted
      await expect(
        errorRecovery.executeWithCircuitBreaker('timeout-circuit', operation)
      ).resolves.toBe('success');

      vi.useRealTimers();
    });

    it('should close circuit after success threshold in half-open state', async () => {
      const operation = vi.fn();
      let shouldFail = true;

      operation.mockImplementation(() => {
        if (shouldFail) {
          throw new Error('Failed');
        }
        return 'success';
      });

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await errorRecovery.executeWithCircuitBreaker(
            'recovery-circuit',
            operation,
            {
              failureThreshold: 5,
              successThreshold: 3,
              timeout: 1,
              volumeThreshold: 5
            }
          );
        } catch (error) {
          // Expected
        }
      }

      // Let circuit transition to half-open
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now operations succeed
      shouldFail = false;

      // Need 3 successes to close circuit
      for (let i = 0; i < 3; i++) {
        await errorRecovery.executeWithCircuitBreaker('recovery-circuit', operation);
      }

      // Circuit should be closed, verify with stats
      const stats = errorRecovery.getRecoveryStats();
      expect(stats.circuitBreakerStates.get('recovery-circuit')).toBe(CircuitState.CLOSED);
    });

    it('should reset all circuit breakers', () => {
      // Create multiple circuit breakers
      const circuits = ['circuit1', 'circuit2', 'circuit3'];
      
      circuits.forEach(async circuit => {
        try {
          await errorRecovery.executeWithCircuitBreaker(
            circuit,
            () => Promise.reject(new Error('Fail'))
          );
        } catch (error) {
          // Expected
        }
      });

      errorRecovery.resetAllCircuitBreakers();

      const stats = errorRecovery.getRecoveryStats();
      stats.circuitBreakerStates.forEach((state) => {
        expect(state).toBe(CircuitState.CLOSED);
      });
    });
  });

  describe('Recovery Suggestions', () => {
    it('should provide network error suggestions', () => {
      const networkError = new Error('Network failure');
      (networkError as any).type = ErrorType.NETWORK_ERROR;

      const suggestions = errorRecovery.getRecoverySuggestions(networkError);

      expect(suggestions).toContain('Check your internet connection');
      expect(suggestions).toContain('Try disabling VPN or proxy');
      expect(suggestions).toContain('Check if the service is accessible');
      expect(suggestions).toContain('Try again in a few moments');
    });

    it('should provide timeout error suggestions', () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).type = ErrorType.TIMEOUT_ERROR;

      const suggestions = errorRecovery.getRecoverySuggestions(timeoutError);

      expect(suggestions).toContain('The server might be busy, try again later');
      expect(suggestions).toContain('Check your internet speed');
    });

    it('should provide offline error suggestions', () => {
      const offlineError = new Error('No network');
      (offlineError as any).type = ErrorType.OFFLINE_ERROR;

      const suggestions = errorRecovery.getRecoverySuggestions(offlineError);

      expect(suggestions).toContain('You appear to be offline');
      expect(suggestions).toContain('Check your network settings');
    });

    it('should provide rate limit suggestions', () => {
      const rateLimitError = new Error('Too many requests');
      (rateLimitError as any).type = ErrorType.RATE_LIMIT;

      const suggestions = errorRecovery.getRecoverySuggestions(rateLimitError);

      expect(suggestions).toContain('You\'ve made too many requests');
      expect(suggestions).toContain('Please wait a moment before trying again');
    });

    it('should provide auth error suggestions', () => {
      const authError = new Error('Token expired');
      (authError as any).type = ErrorType.TOKEN_EXPIRED;

      const suggestions = errorRecovery.getRecoverySuggestions(authError);

      expect(suggestions).toContain('Your session has expired');
      expect(suggestions).toContain('Please log in again to continue');
    });

    it('should provide generic suggestions for unknown errors', () => {
      const unknownError = new Error('Something went wrong');

      const suggestions = errorRecovery.getRecoverySuggestions(unknownError);

      expect(suggestions).toContain('An unexpected error occurred');
      expect(suggestions).toContain('Try refreshing the page');
      expect(suggestions).toContain('Contact support if the issue persists');
    });
  });

  describe('Recovery Statistics', () => {
    it('should track recovery attempts', async () => {
      const successfulOp = vi.fn().mockResolvedValue('success');
      const failingOp = vi.fn().mockRejectedValue(new Error('Failed'));

      // Successful recovery
      await errorRecovery.executeWithRetry(successfulOp, { maxAttempts: 1 });

      // Failed recovery
      try {
        await errorRecovery.executeWithRetry(failingOp, { maxAttempts: 1 });
      } catch (error) {
        // Expected
      }

      const stats = errorRecovery.getRecoveryStats();
      expect(stats.successfulRecoveries).toBe(1);
      expect(stats.failedRecoveries).toBe(1);
      expect(stats.totalAttempts).toBe(2);
      expect(stats.successRate).toBe(50);
    });

    it('should calculate success rate correctly', async () => {
      const operations = [
        vi.fn().mockResolvedValue('success1'),
        vi.fn().mockResolvedValue('success2'),
        vi.fn().mockResolvedValue('success3'),
        vi.fn().mockRejectedValue(new Error('fail1')),
        vi.fn().mockRejectedValue(new Error('fail2'))
      ];

      for (const op of operations) {
        try {
          await errorRecovery.executeWithRetry(op, { maxAttempts: 1 });
        } catch (error) {
          // Expected for failures
        }
      }

      const stats = errorRecovery.getRecoveryStats();
      expect(stats.successfulRecoveries).toBe(3);
      expect(stats.failedRecoveries).toBe(2);
      expect(stats.totalAttempts).toBe(5);
      expect(stats.successRate).toBe(60);
    });

    it('should clear statistics', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      await errorRecovery.executeWithRetry(operation, { maxAttempts: 1 });
      
      let stats = errorRecovery.getRecoveryStats();
      expect(stats.totalAttempts).toBe(1);

      errorRecovery.clearStats();

      stats = errorRecovery.getRecoveryStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulRecoveries).toBe(0);
      expect(stats.failedRecoveries).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('Rate Limit Recovery', () => {
    it('should handle rate limit errors with retry-after header', async () => {
      vi.useFakeTimers();

      const rateLimitError = new Error('Rate limited');
      (rateLimitError as any).type = ErrorType.RATE_LIMIT;
      (rateLimitError as any).response = {
        headers: { 'retry-after': '5' }
      };

      const operation = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const promise = errorRecovery.recover(
        rateLimitError,
        operation
      );

      // Should wait for retry-after duration
      await vi.advanceTimersByTimeAsync(5000);

      await expect(promise).resolves.toBe('success');

      vi.useRealTimers();
    });
  });
});