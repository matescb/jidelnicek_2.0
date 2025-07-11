/**
 * Enhanced async validation with caching, debouncing, and request deduplication
 */

import { AsyncValidatorFunction, ValidationResult } from './registry';

export interface AsyncValidationOptions {
  cacheTTL?: number; // Cache time-to-live in milliseconds
  debounceMs?: number; // Debounce delay in milliseconds
  retryCount?: number; // Number of retries on failure
  retryDelay?: number; // Delay between retries in milliseconds
  timeout?: number; // Request timeout in milliseconds
}

export interface CachedValidationResult extends ValidationResult {
  cachedAt: number;
  expiresAt: number;
}

export class AsyncValidationManager {
  private cache = new Map<string, CachedValidationResult>();
  private pendingValidations = new Map<string, Promise<ValidationResult>>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Create a cached async validator
   */
  createCachedValidator(
    validator: AsyncValidatorFunction,
    options: AsyncValidationOptions = {}
  ): AsyncValidatorFunction {
    const {
      cacheTTL = 60000, // 1 minute default
      debounceMs = 300,
      retryCount = 2,
      retryDelay = 1000,
      timeout = 10000,
    } = options;

    return async (value, context) => {
      const cacheKey = this.getCacheKey(value, context);

      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Check if validation is already in progress
      const pending = this.pendingValidations.get(cacheKey);
      if (pending) {
        return pending;
      }

      // Create validation promise
      const validationPromise = this.performValidation(
        validator,
        value,
        context,
        {
          retryCount,
          retryDelay,
          timeout,
        }
      );

      // Store as pending
      this.pendingValidations.set(cacheKey, validationPromise);

      try {
        const result = await validationPromise;
        
        // Cache the result
        this.cacheResult(cacheKey, result, cacheTTL);
        
        return result;
      } finally {
        // Remove from pending
        this.pendingValidations.delete(cacheKey);
      }
    };
  }

  /**
   * Create a debounced async validator
   */
  createDebouncedValidator(
    validator: AsyncValidatorFunction,
    debounceMs: number = 300
  ): AsyncValidatorFunction {
    return (value, context) => {
      return new Promise((resolve) => {
        const key = this.getCacheKey(value, context);
        
        // Clear existing timer
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(async () => {
          this.debounceTimers.delete(key);
          const result = await validator(value, context);
          resolve(result);
        }, debounceMs);

        this.debounceTimers.set(key, timer);
      });
    };
  }

  /**
   * Create a validator with all enhancements
   */
  createEnhancedValidator(
    validator: AsyncValidatorFunction,
    options: AsyncValidationOptions = {}
  ): AsyncValidatorFunction {
    const cachedValidator = this.createCachedValidator(validator, options);
    
    if (options.debounceMs && options.debounceMs > 0) {
      return this.createDebouncedValidator(cachedValidator, options.debounceMs);
    }
    
    return cachedValidator;
  }

  /**
   * Perform validation with retry logic
   */
  private async performValidation(
    validator: AsyncValidatorFunction,
    value: any,
    context: any,
    options: {
      retryCount: number;
      retryDelay: number;
      timeout: number;
    }
  ): Promise<ValidationResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= options.retryCount; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);

        // Perform validation
        const result = await Promise.race([
          validator(value, context),
          new Promise<ValidationResult>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('Validation timeout'));
            });
          }),
        ]);

        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on abort
        if (lastError.name === 'AbortError') {
          break;
        }
        
        // Wait before retry
        if (attempt < options.retryCount) {
          await new Promise(resolve => setTimeout(resolve, options.retryDelay));
        }
      }
    }

    // Return error result
    return {
      isValid: false,
      error: lastError?.message || 'Validation failed',
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(value: any, context?: any): string {
    const valueKey = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const contextKey = context ? JSON.stringify(context) : '';
    return `${valueKey}:${contextKey}`;
  }

  /**
   * Get result from cache
   */
  private getFromCache(key: string): ValidationResult | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      isValid: cached.isValid,
      error: cached.error,
      warnings: cached.warnings,
      metadata: {
        ...cached.metadata,
        fromCache: true,
        cachedAt: cached.cachedAt,
      },
    };
  }

  /**
   * Cache validation result
   */
  private cacheResult(key: string, result: ValidationResult, ttl: number): void {
    const cached: CachedValidationResult = {
      ...result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    
    this.cache.set(key, cached);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(value: any, context?: any): void {
    const key = this.getCacheKey(value, context);
    this.cache.delete(key);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      key: string;
      cachedAt: number;
      expiresAt: number;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      cachedAt: value.cachedAt,
      expiresAt: value.expiresAt,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Cancel all pending validations
   */
  cancelAll(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Note: We can't actually cancel the pending promises,
    // but they will be cleaned up when they complete
    this.pendingValidations.clear();
  }
}

// Create singleton instance
export const asyncValidationManager = new AsyncValidationManager();

/**
 * Common async validators
 */

/**
 * Email availability validator
 */
export function createEmailAvailabilityValidator(
  checkEmail: (email: string) => Promise<boolean>
): AsyncValidatorFunction {
  return asyncValidationManager.createEnhancedValidator(
    async (email: string) => {
      try {
        const isAvailable = await checkEmail(email);
        return {
          isValid: isAvailable,
          error: isAvailable ? undefined : 'Email is already taken',
          metadata: { available: isAvailable },
        };
      } catch (error) {
        return {
          isValid: false,
          error: 'Unable to verify email availability',
        };
      }
    },
    {
      cacheTTL: 300000, // 5 minutes
      debounceMs: 500,
      retryCount: 2,
    }
  );
}

/**
 * Username availability validator
 */
export function createUsernameAvailabilityValidator(
  checkUsername: (username: string) => Promise<boolean>
): AsyncValidatorFunction {
  return asyncValidationManager.createEnhancedValidator(
    async (username: string) => {
      try {
        const isAvailable = await checkUsername(username);
        return {
          isValid: isAvailable,
          error: isAvailable ? undefined : 'Username is already taken',
          metadata: { available: isAvailable },
        };
      } catch (error) {
        return {
          isValid: false,
          error: 'Unable to verify username availability',
        };
      }
    },
    {
      cacheTTL: 300000, // 5 minutes
      debounceMs: 500,
      retryCount: 2,
    }
  );
}

/**
 * Remote validation validator
 */
export function createRemoteValidator(
  validate: (value: any) => Promise<{ valid: boolean; message?: string }>
): AsyncValidatorFunction {
  return asyncValidationManager.createEnhancedValidator(
    async (value) => {
      try {
        const result = await validate(value);
        return {
          isValid: result.valid,
          error: result.valid ? undefined : result.message,
        };
      } catch (error) {
        return {
          isValid: false,
          error: 'Validation service unavailable',
        };
      }
    },
    {
      cacheTTL: 60000, // 1 minute
      debounceMs: 300,
      retryCount: 1,
    }
  );
}