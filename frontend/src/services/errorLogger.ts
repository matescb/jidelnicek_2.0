import { ErrorInfo } from 'react';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for classification
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTH = 'auth',
  PERMISSION = 'permission',
  BUSINESS_LOGIC = 'business_logic',
  UNKNOWN = 'unknown',
  UI = 'ui',
  API = 'api'
}

// Error context interface
export interface ErrorContext {
  userId?: string;
  route?: string;
  timestamp: Date;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

// Error log entry
export interface ErrorLogEntry {
  id: string;
  error: Error;
  errorInfo?: ErrorInfo;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  stackTrace?: string;
  isRecoverable: boolean;
  retryCount?: number;
}

// Configuration for external error services
export interface ErrorServiceConfig {
  sentry?: {
    dsn: string;
    environment: string;
  };
  logRocket?: {
    appId: string;
  };
  customEndpoint?: {
    url: string;
    headers?: Record<string, string>;
  };
}

// Rate limiting configuration
interface RateLimitConfig {
  maxErrors: number;
  windowMs: number;
}

class ErrorLogger {
  private errorHistory: ErrorLogEntry[] = [];
  private errorCounts: Map<string, { count: number; firstSeen: number }> = new Map();
  private config: ErrorServiceConfig = {};
  private rateLimitConfig: RateLimitConfig = {
    maxErrors: 10,
    windowMs: 60000 // 1 minute
  };

  constructor() {
    // Initialize with environment-specific configuration
    if (import.meta.env.VITE_SENTRY_DSN) {
      this.config.sentry = {
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE
      };
    }
  }

  /**
   * Configure external error services
   */
  configure(config: ErrorServiceConfig) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set rate limiting configuration
   */
  setRateLimit(config: RateLimitConfig) {
    this.rateLimitConfig = config;
  }

  /**
   * Log an error
   */
  logError(
    error: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    errorInfo?: ErrorInfo,
    additionalContext?: Partial<ErrorContext>
  ): string {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error);
    const context = this.buildContext(additionalContext);
    
    // Check rate limiting
    if (!this.shouldLogError(error)) {
      console.warn('Error rate limit exceeded, skipping log:', error.message);
      return errorId;
    }

    const logEntry: ErrorLogEntry = {
      id: errorId,
      error,
      errorInfo,
      severity,
      category,
      context,
      stackTrace: error.stack,
      isRecoverable: this.isErrorRecoverable(error, category),
      retryCount: 0
    };

    // Store in history
    this.errorHistory.push(logEntry);
    this.limitErrorHistory();

    // Log based on environment
    if (import.meta.env.DEV) {
      this.logToDevelopmentConsole(logEntry);
    } else {
      this.logToProductionServices(logEntry);
    }

    // Update error counts
    this.updateErrorCounts(error);

    return errorId;
  }

  /**
   * Log a recovered error (for tracking recovery success)
   */
  logRecovery(errorId: string, recoveryMethod: string) {
    const entry = this.errorHistory.find(e => e.id === errorId);
    if (entry) {
      console.log(`[Error Recovery] Error ${errorId} recovered using: ${recoveryMethod}`);
      
      if (!import.meta.env.DEV && this.config.customEndpoint) {
        // Send recovery metrics to custom endpoint
        this.sendToCustomEndpoint({
          type: 'recovery',
          errorId,
          recoveryMethod,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(): ErrorLogEntry[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
  }

  /**
   * Check if an error should be retried
   */
  shouldRetry(errorId: string): boolean {
    const entry = this.errorHistory.find(e => e.id === errorId);
    if (!entry) return false;

    // Don't retry non-recoverable errors
    if (!entry.isRecoverable) return false;

    // Limit retry attempts
    const maxRetries = entry.category === ErrorCategory.NETWORK ? 3 : 1;
    return (entry.retryCount || 0) < maxRetries;
  }

  /**
   * Increment retry count
   */
  incrementRetryCount(errorId: string) {
    const entry = this.errorHistory.find(e => e.id === errorId);
    if (entry) {
      entry.retryCount = (entry.retryCount || 0) + 1;
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      name.includes('network') ||
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('xhr') ||
      message.includes('cors')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Auth errors
    if (
      message.includes('unauthorized') ||
      message.includes('auth') ||
      message.includes('token') ||
      message.includes('401')
    ) {
      return ErrorCategory.AUTH;
    }

    // Permission errors
    if (
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('403')
    ) {
      return ErrorCategory.PERMISSION;
    }

    // Validation errors
    if (
      name.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    ) {
      return ErrorCategory.VALIDATION;
    }

    // API errors
    if (
      message.includes('api') ||
      message.includes('endpoint') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return ErrorCategory.API;
    }

    // UI errors
    if (
      name.includes('react') ||
      message.includes('component') ||
      message.includes('render')
    ) {
      return ErrorCategory.UI;
    }

    return ErrorCategory.UNKNOWN;
  }

  private buildContext(additionalContext?: Partial<ErrorContext>): ErrorContext {
    return {
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      route: window.location.pathname,
      ...additionalContext
    };
  }

  private isErrorRecoverable(error: Error, category: ErrorCategory): boolean {
    // Network errors are often recoverable
    if (category === ErrorCategory.NETWORK) return true;

    // Temporary API errors
    if (category === ErrorCategory.API) {
      const message = error.message.toLowerCase();
      return message.includes('502') || message.includes('503') || message.includes('timeout');
    }

    // Auth token expiry can be recovered
    if (category === ErrorCategory.AUTH) {
      return error.message.toLowerCase().includes('expired');
    }

    return false;
  }

  private shouldLogError(error: Error): boolean {
    const errorKey = `${error.name}_${error.message}`;
    const now = Date.now();
    const errorCount = this.errorCounts.get(errorKey);

    if (!errorCount) {
      this.errorCounts.set(errorKey, { count: 1, firstSeen: now });
      return true;
    }

    // Check if we're within the rate limit window
    if (now - errorCount.firstSeen > this.rateLimitConfig.windowMs) {
      // Reset the window
      this.errorCounts.set(errorKey, { count: 1, firstSeen: now });
      return true;
    }

    // Check if we've exceeded the max errors
    if (errorCount.count >= this.rateLimitConfig.maxErrors) {
      return false;
    }

    errorCount.count++;
    return true;
  }

  private updateErrorCounts(error: Error) {
    // Clean up old entries
    const now = Date.now();
    for (const [key, value] of this.errorCounts.entries()) {
      if (now - value.firstSeen > this.rateLimitConfig.windowMs * 2) {
        this.errorCounts.delete(key);
      }
    }
  }

  private limitErrorHistory() {
    const maxHistorySize = 100;
    if (this.errorHistory.length > maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-maxHistorySize);
    }
  }

  private logToDevelopmentConsole(entry: ErrorLogEntry) {
    const styles = {
      [ErrorSeverity.LOW]: 'color: #666',
      [ErrorSeverity.MEDIUM]: 'color: #f59e0b',
      [ErrorSeverity.HIGH]: 'color: #ef4444',
      [ErrorSeverity.CRITICAL]: 'color: #dc2626; font-weight: bold'
    };

    console.group(
      `%c[${entry.severity.toUpperCase()}] ${entry.category}: ${entry.error.message}`,
      styles[entry.severity]
    );
    
    console.error('Error:', entry.error);
    
    if (entry.errorInfo) {
      console.error('Component Stack:', entry.errorInfo.componentStack);
    }
    
    console.log('Context:', entry.context);
    console.log('Recoverable:', entry.isRecoverable);
    console.log('Error ID:', entry.id);
    
    console.groupEnd();
  }

  private logToProductionServices(entry: ErrorLogEntry) {
    // Log to console with minimal info
    console.error(`[${entry.severity}] ${entry.error.message}`, {
      id: entry.id,
      category: entry.category
    });

    // Send to Sentry if configured
    if (this.config.sentry && typeof window !== 'undefined' && (window as any).Sentry) {
      const Sentry = (window as any).Sentry;
      Sentry.captureException(entry.error, {
        level: this.mapSeverityToSentryLevel(entry.severity),
        tags: {
          category: entry.category,
          errorId: entry.id
        },
        contexts: {
          errorContext: entry.context
        }
      });
    }

    // Send to custom endpoint if configured
    if (this.config.customEndpoint) {
      this.sendToCustomEndpoint(entry);
    }
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): string {
    const mapping = {
      [ErrorSeverity.LOW]: 'info',
      [ErrorSeverity.MEDIUM]: 'warning',
      [ErrorSeverity.HIGH]: 'error',
      [ErrorSeverity.CRITICAL]: 'fatal'
    };
    return mapping[severity] || 'error';
  }

  private async sendToCustomEndpoint(data: any) {
    if (!this.config.customEndpoint) return;

    try {
      await fetch(this.config.customEndpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.customEndpoint.headers
        },
        body: JSON.stringify({
          ...data,
          environment: import.meta.env.MODE,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      // Silently fail to avoid infinite error loops
      console.warn('Failed to send error to custom endpoint');
    }
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Export convenience functions
export const logError = (
  error: Error,
  severity?: ErrorSeverity,
  errorInfo?: ErrorInfo,
  context?: Partial<ErrorContext>
) => errorLogger.logError(error, severity, errorInfo, context);

export const logRecovery = (errorId: string, method: string) => 
  errorLogger.logRecovery(errorId, method);

export const getErrorHistory = () => errorLogger.getErrorHistory();

export const shouldRetry = (errorId: string) => errorLogger.shouldRetry(errorId);