/**
 * Async validation utilities
 * 
 * Provides utilities for managing asynchronous validation including
 * debouncing, caching, abort control, and queue management.
 */

import { useRef, useCallback, useEffect } from 'react';

/**
 * Validation result with metadata
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  timestamp: number;
  cached?: boolean;
}

/**
 * Async validator function type
 */
export type AsyncValidator<T> = (
  value: T,
  signal?: AbortSignal
) => Promise<ValidationResult>;

/**
 * Validation cache entry
 */
interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
  expiresAt: number;
}

/**
 * Validation queue item
 */
interface QueueItem<T> {
  value: T;
  resolve: (result: ValidationResult) => void;
  reject: (error: Error) => void;
  abortController: AbortController;
}

/**
 * Options for async validation
 */
export interface AsyncValidationOptions {
  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTTL?: number;
  /**
   * Maximum cache size (default: 100)
   */
  maxCacheSize?: number;
  /**
   * Debounce delay in milliseconds (default: 300)
   */
  debounceMs?: number;
  /**
   * Maximum concurrent validations (default: 3)
   */
  maxConcurrent?: number;
  /**
   * Retry failed validations (default: 1)
   */
  retryCount?: number;
  /**
   * Retry delay in milliseconds (default: 1000)
   */
  retryDelay?: number;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<AsyncValidationOptions> = {
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  debounceMs: 300,
  maxConcurrent: 3,
  retryCount: 1,
  retryDelay: 1000,
};

/**
 * Creates a validation cache with TTL and size limits
 */
export class ValidationCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];

  constructor(
    private options: {
      ttl: number;
      maxSize: number;
    }
  ) {}

  /**
   * Get cached validation result
   */
  get(key: string): ValidationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);
    return { ...entry.result, cached: true };
  }

  /**
   * Set validation result in cache
   */
  set(key: string, result: ValidationResult): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder[0];
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.removeFromAccessOrder(oldestKey);
      }
    }

    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.options.ttl,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

/**
 * Validation queue manager for controlling concurrent validations
 */
export class ValidationQueue<T> {
  private queue: QueueItem<T>[] = [];
  private activeCount = 0;

  constructor(
    private validator: AsyncValidator<T>,
    private maxConcurrent: number
  ) {}

  /**
   * Add validation to queue
   */
  async validate(value: T): Promise<ValidationResult> {
    const abortController = new AbortController();

    return new Promise<ValidationResult>((resolve, reject) => {
      const item: QueueItem<T> = {
        value,
        resolve,
        reject,
        abortController,
      };

      this.queue.push(item);
      this.processQueue();
    });
  }

  /**
   * Cancel all pending validations
   */
  cancelAll(): void {
    this.queue.forEach(item => {
      item.abortController.abort();
      item.reject(new Error('Validation cancelled'));
    });
    this.queue = [];
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) continue;

      this.activeCount++;
      
      try {
        const result = await this.validator(
          item.value,
          item.abortController.signal
        );
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      } finally {
        this.activeCount--;
        this.processQueue();
      }
    }
  }
}

/**
 * Creates a debounced async validator
 */
export function createDebouncedValidator<T>(
  validator: AsyncValidator<T>,
  delay: number
): AsyncValidator<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let currentAbortController: AbortController | null = null;

  return (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Abort current validation
    if (currentAbortController) {
      currentAbortController.abort();
    }

    currentAbortController = new AbortController();
    const localSignal = currentAbortController.signal;

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          // Check if already aborted
          if (localSignal.aborted || signal?.aborted) {
            reject(new Error('Validation aborted'));
            return;
          }

          const result = await validator(value, localSignal);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);

      // Handle external abort
      signal?.addEventListener('abort', () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (currentAbortController) {
          currentAbortController.abort();
        }
        reject(new Error('Validation aborted'));
      });
    });
  };
}

/**
 * Creates a cached async validator
 */
export function createCachedValidator<T>(
  validator: AsyncValidator<T>,
  options?: Partial<AsyncValidationOptions>
): AsyncValidator<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cache = new ValidationCache({
    ttl: opts.cacheTTL,
    maxSize: opts.maxCacheSize,
  });

  // Periodically clear expired entries
  setInterval(() => {
    cache.clearExpired();
  }, opts.cacheTTL);

  return async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    const cacheKey = JSON.stringify(value);
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate
    const result = await validator(value, signal);
    
    // Cache successful validations
    if (!signal?.aborted) {
      cache.set(cacheKey, result);
    }

    return result;
  };
}

/**
 * Creates a retrying async validator
 */
export function createRetryingValidator<T>(
  validator: AsyncValidator<T>,
  options?: Partial<AsyncValidationOptions>
): AsyncValidator<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.retryCount; attempt++) {
      try {
        if (signal?.aborted) {
          throw new Error('Validation aborted');
        }

        return await validator(value, signal);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort
        if (signal?.aborted || lastError.message === 'Validation aborted') {
          throw lastError;
        }

        // Wait before retry
        if (attempt < opts.retryCount) {
          await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
        }
      }
    }

    throw lastError || new Error('Validation failed');
  };
}

/**
 * Hook for async field validation with all features
 */
export function useAsyncValidator<T>(
  validator: AsyncValidator<T>,
  options?: AsyncValidationOptions
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheRef = useRef(new ValidationCache({
    ttl: opts.cacheTTL,
    maxSize: opts.maxCacheSize,
  }));
  const queueRef = useRef<ValidationQueue<T> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create enhanced validator with caching and retries
  const enhancedValidator = useCallback(
    async (value: T, signal?: AbortSignal): Promise<ValidationResult> => {
      const cacheKey = JSON.stringify(value);
      
      // Check cache
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Create retrying validator
      const retryingValidator = createRetryingValidator(validator, opts);
      
      // Validate
      const result = await retryingValidator(value, signal);
      
      // Cache result
      if (!signal?.aborted) {
        cacheRef.current.set(cacheKey, result);
      }

      return result;
    },
    [validator, opts]
  );

  // Create queue if needed
  if (!queueRef.current) {
    queueRef.current = new ValidationQueue(enhancedValidator, opts.maxConcurrent);
  }

  // Create debounced validator
  const debouncedValidator = useCallback(
    createDebouncedValidator(
      (value: T, signal?: AbortSignal) => queueRef.current!.validate(value),
      opts.debounceMs
    ),
    [opts.debounceMs]
  );

  // Validate function
  const validate = useCallback(
    async (value: T, options?: { debounce?: boolean }): Promise<ValidationResult> => {
      // Cancel previous validation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        if (options?.debounce !== false && opts.debounceMs > 0) {
          return await debouncedValidator(value, signal);
        } else {
          return await queueRef.current!.validate(value);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'Validation aborted') {
          return {
            isValid: true,
            timestamp: Date.now(),
          };
        }
        throw error;
      }
    },
    [debouncedValidator, opts.debounceMs]
  );

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Cancel all validations
  const cancelAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    queueRef.current?.cancelAll();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return {
    validate,
    clearCache,
    cancelAll,
  };
}