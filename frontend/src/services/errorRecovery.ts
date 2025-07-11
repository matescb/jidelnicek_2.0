import { ErrorType, isRetryableError, classifyError } from '@/utils/errorHelpers';
import { errorLogger, ErrorSeverity } from './errorLogger';

// Retry strategies
export enum RetryStrategy {
  IMMEDIATE = 'immediate',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIBONACCI = 'fibonacci'
}

// Recovery callback types
export type RecoveryCallback = (error: Error, attempt: number) => Promise<any>;
export type RecoverySuccessCallback = (result: any, attempts: number) => void;
export type RecoveryFailureCallback = (error: Error, attempts: number) => void;

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold: number;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  strategy: RetryStrategy;
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
  backoffMultiplier: number;
}

// Recovery registry entry
interface RecoveryRegistryEntry {
  errorType: ErrorType;
  callback: RecoveryCallback;
  config?: Partial<RetryConfig>;
  successCallback?: RecoverySuccessCallback;
  failureCallback?: RecoveryFailureCallback;
}

// Circuit breaker instance
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private requestCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - (this.lastFailureTime || 0) < this.config.timeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    this.requestCount++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.failureCount >= this.config.failureThreshold &&
      this.requestCount >= this.config.volumeThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = undefined;
  }
}

// Error recovery service
class ErrorRecoveryService {
  private recoveryRegistry: Map<ErrorType, RecoveryRegistryEntry> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private successCounts: Map<string, number> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private fibonacciSequence: number[] = [1, 1];

  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    strategy: RetryStrategy.EXPONENTIAL,
    initialDelay: 1000,
    maxDelay: 30000,
    jitter: true,
    backoffMultiplier: 2
  };

  private defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    volumeThreshold: 10
  };

  constructor() {
    this.registerDefaultRecoveries();
  }

  /**
   * Register a recovery callback for a specific error type
   */
  registerRecovery(
    errorType: ErrorType,
    callback: RecoveryCallback,
    config?: Partial<RetryConfig>,
    successCallback?: RecoverySuccessCallback,
    failureCallback?: RecoveryFailureCallback
  ) {
    this.recoveryRegistry.set(errorType, {
      errorType,
      callback,
      config,
      successCallback,
      failureCallback
    });
  }

  /**
   * Attempt to recover from an error
   */
  async recover(
    error: Error,
    operation: () => Promise<any>,
    customConfig?: Partial<RetryConfig>
  ): Promise<any> {
    const { type } = classifyError(error);
    const registryEntry = this.recoveryRegistry.get(type);
    const config = { 
      ...this.defaultRetryConfig, 
      ...registryEntry?.config,
      ...customConfig 
    };

    // Check if error is retryable
    if (!isRetryableError(error)) {
      throw error;
    }

    // Try recovery callback if registered
    if (registryEntry?.callback) {
      try {
        const result = await this.executeWithRetry(
          () => registryEntry.callback(error, 0),
          config
        );
        
        if (registryEntry.successCallback) {
          registryEntry.successCallback(result, 1);
        }
        
        return result;
      } catch (recoveryError) {
        if (registryEntry.failureCallback) {
          registryEntry.failureCallback(recoveryError as Error, config.maxAttempts);
        }
        // Fall through to retry original operation
      }
    }

    // Retry original operation
    return this.executeWithRetry(operation, config);
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        this.recordSuccess(operation.toString());
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(operation.toString());
        
        // Log retry attempt
        errorLogger.logError(
          lastError,
          ErrorSeverity.LOW,
          undefined,
          { action: 'retry', attempt, maxAttempts: config.maxAttempts }
        );

        if (attempt === config.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Execute operation with circuit breaker
   */
  async executeWithCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(key, config);
    return breaker.execute(operation);
  }

  /**
   * Get recovery suggestions based on error type
   */
  getRecoverySuggestions(error: Error): string[] {
    const { type } = classifyError(error);
    const suggestions: string[] = [];

    switch (type) {
      case ErrorType.NETWORK_ERROR:
        suggestions.push(
          'Check your internet connection',
          'Try disabling VPN or proxy',
          'Check if the service is accessible',
          'Try again in a few moments'
        );
        break;

      case ErrorType.TIMEOUT_ERROR:
        suggestions.push(
          'The server might be busy, try again later',
          'Check your internet speed',
          'Try with a smaller request',
          'Contact support if the issue persists'
        );
        break;

      case ErrorType.OFFLINE_ERROR:
        suggestions.push(
          'You appear to be offline',
          'Check your network settings',
          'Try connecting to a different network',
          'Your changes will sync when you\'re back online'
        );
        break;

      case ErrorType.RATE_LIMIT:
        suggestions.push(
          'You\'ve made too many requests',
          'Please wait a moment before trying again',
          'Consider spacing out your requests',
          'Upgrade your plan for higher limits'
        );
        break;

      case ErrorType.TOKEN_EXPIRED:
        suggestions.push(
          'Your session has expired',
          'Please log in again to continue',
          'This is for your security',
          'Your work has been saved'
        );
        break;

      case ErrorType.SERVER_ERROR:
        suggestions.push(
          'We\'re experiencing technical difficulties',
          'Our team has been notified',
          'Please try again in a few minutes',
          'Check our status page for updates'
        );
        break;

      case ErrorType.VALIDATION_ERROR:
        suggestions.push(
          'Please check your input',
          'Make sure all required fields are filled',
          'Check for invalid characters',
          'Follow the specified format'
        );
        break;

      case ErrorType.INSUFFICIENT_PERMISSIONS:
        suggestions.push(
          'You don\'t have permission for this action',
          'Contact your administrator',
          'Request access if needed',
          'Check if you\'re in the right account'
        );
        break;

      default:
        suggestions.push(
          'An unexpected error occurred',
          'Try refreshing the page',
          'Clear your browser cache',
          'Contact support if the issue persists'
        );
    }

    return suggestions;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    successRate: number;
    circuitBreakerStates: Map<string, CircuitState>;
  } {
    let totalSuccess = 0;
    let totalFailure = 0;

    this.successCounts.forEach(count => totalSuccess += count);
    this.failureCounts.forEach(count => totalFailure += count);

    const totalAttempts = totalSuccess + totalFailure;
    const successRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0;

    const circuitBreakerStates = new Map<string, CircuitState>();
    this.circuitBreakers.forEach((breaker, key) => {
      circuitBreakerStates.set(key, breaker.getState());
    });

    return {
      totalAttempts,
      successfulRecoveries: totalSuccess,
      failedRecoveries: totalFailure,
      successRate,
      circuitBreakerStates
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers() {
    this.circuitBreakers.forEach(breaker => breaker.reset());
  }

  /**
   * Clear recovery statistics
   */
  clearStats() {
    this.successCounts.clear();
    this.failureCounts.clear();
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.strategy) {
      case RetryStrategy.IMMEDIATE:
        delay = 0;
        break;

      case RetryStrategy.LINEAR:
        delay = config.initialDelay * attempt;
        break;

      case RetryStrategy.EXPONENTIAL:
        delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        break;

      case RetryStrategy.FIBONACCI:
        delay = config.initialDelay * this.getFibonacci(attempt);
        break;

      default:
        delay = config.initialDelay;
    }

    // Apply max delay cap
    delay = Math.min(delay, config.maxDelay);

    // Apply jitter if enabled
    if (config.jitter && delay > 0) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(0, delay);
  }

  private getFibonacci(n: number): number {
    while (this.fibonacciSequence.length < n) {
      const len = this.fibonacciSequence.length;
      this.fibonacciSequence.push(
        this.fibonacciSequence[len - 1] + this.fibonacciSequence[len - 2]
      );
    }
    return this.fibonacciSequence[n - 1];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getOrCreateCircuitBreaker(
    key: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(
        key,
        new CircuitBreaker({ ...this.defaultCircuitBreakerConfig, ...config })
      );
    }
    return this.circuitBreakers.get(key)!;
  }

  private recordSuccess(key: string) {
    this.successCounts.set(key, (this.successCounts.get(key) || 0) + 1);
  }

  private recordFailure(key: string) {
    this.failureCounts.set(key, (this.failureCounts.get(key) || 0) + 1);
  }

  private registerDefaultRecoveries() {
    // Network error recovery - try different endpoints
    this.registerRecovery(
      ErrorType.NETWORK_ERROR,
      async (error, attempt) => {
        // Could implement fallback endpoints here
        throw error;
      }
    );

    // Token expired recovery - try refreshing
    this.registerRecovery(
      ErrorType.TOKEN_EXPIRED,
      async (error, attempt) => {
        // Token refresh is handled by API client interceptor
        throw error;
      }
    );

    // Rate limit recovery - wait and retry
    this.registerRecovery(
      ErrorType.RATE_LIMIT,
      async (error, attempt) => {
        // Extract retry-after header if available
        const retryAfter = (error as any).response?.headers?.['retry-after'];
        if (retryAfter) {
          const delay = parseInt(retryAfter) * 1000;
          await this.sleep(delay);
        }
        throw error;
      }
    );
  }
}

// Export singleton instance
export const errorRecovery = new ErrorRecoveryService();

// Export convenience functions
export const recoverFromError = (
  error: Error,
  operation: () => Promise<any>,
  config?: Partial<RetryConfig>
) => errorRecovery.recover(error, operation, config);

export const executeWithRetry = <T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
) => errorRecovery.executeWithRetry(operation, { ...errorRecovery['defaultRetryConfig'], ...config });

export const executeWithCircuitBreaker = <T>(
  key: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
) => errorRecovery.executeWithCircuitBreaker(key, operation, config);

export const getRecoverySuggestions = (error: Error) => 
  errorRecovery.getRecoverySuggestions(error);