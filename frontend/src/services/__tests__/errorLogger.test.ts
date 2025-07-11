import { errorLogger, ErrorSeverity, ErrorCategory, ErrorContext } from '../errorLogger';
import { vi } from 'vitest';

describe('ErrorLogger Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorLogger.clearHistory();
    
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    
    // Mock fetch for custom endpoint
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Logging', () => {
    it('should log error and return error ID', () => {
      const error = new Error('Test error');
      const errorId = errorLogger.logError(error);

      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(errorLogger.getErrorHistory()).toHaveLength(1);
    });

    it('should log error with severity', () => {
      const error = new Error('Critical error');
      const errorId = errorLogger.logError(error, ErrorSeverity.CRITICAL);

      const history = errorLogger.getErrorHistory();
      expect(history[0].severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should log error with context', () => {
      const error = new Error('Context error');
      const context: Partial<ErrorContext> = {
        userId: 'user123',
        action: 'recipe.create',
        metadata: { recipeId: 'recipe456' }
      };

      const errorId = errorLogger.logError(error, ErrorSeverity.MEDIUM, undefined, context);

      const history = errorLogger.getErrorHistory();
      expect(history[0].context).toMatchObject(context);
    });

    it('should include error info when provided', () => {
      const error = new Error('Component error');
      const errorInfo = {
        componentStack: '\n    at Component\n    at ErrorBoundary'
      };

      errorLogger.logError(error, ErrorSeverity.LOW, errorInfo as any);

      const history = errorLogger.getErrorHistory();
      expect(history[0].errorInfo).toEqual(errorInfo);
    });

    it('should build default context', () => {
      const error = new Error('Default context');
      errorLogger.logError(error);

      const history = errorLogger.getErrorHistory();
      const context = history[0].context;

      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.userAgent).toBe(navigator.userAgent);
      expect(context.viewport).toEqual({
        width: window.innerWidth,
        height: window.innerHeight
      });
      expect(context.route).toBe(window.location.pathname);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize network errors', () => {
      const networkErrors = [
        new Error('Network request failed'),
        new Error('Failed to fetch'),
        new Error('CORS error occurred'),
        new Error('XHR request timeout')
      ];

      networkErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      expect(history).toHaveLength(4);
      history.forEach(entry => {
        expect(entry.category).toBe(ErrorCategory.NETWORK);
      });
    });

    it('should categorize auth errors', () => {
      const authErrors = [
        new Error('Unauthorized access'),
        new Error('401 - Not authenticated'),
        new Error('Invalid auth token'),
        new Error('Authentication failed')
      ];

      authErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      history.forEach(entry => {
        expect(entry.category).toBe(ErrorCategory.AUTH);
      });
    });

    it('should categorize permission errors', () => {
      const permissionErrors = [
        new Error('403 Forbidden'),
        new Error('Insufficient permissions'),
        new Error('Access forbidden')
      ];

      permissionErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      history.forEach(entry => {
        expect(entry.category).toBe(ErrorCategory.PERMISSION);
      });
    });

    it('should categorize validation errors', () => {
      const validationErrors = [
        new Error('Invalid input format'),
        new Error('Field is required'),
        new Error('ValidationError: Email format incorrect')
      ];

      validationErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      history.forEach(entry => {
        expect(entry.category).toBe(ErrorCategory.VALIDATION);
      });
    });

    it('should categorize API errors', () => {
      const apiErrors = [
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('API endpoint not found')
      ];

      apiErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      history.forEach(entry => {
        expect(entry.category).toBe(ErrorCategory.API);
      });
    });

    it('should categorize UI errors', () => {
      const uiErrors = [
        new Error('React component error'),
        new Error('Cannot render component'),
        new Error('ReactError: Invalid props')
      ];

      uiErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      history.forEach(entry => {
        expect(entry.category).toBe(ErrorCategory.UI);
      });
    });

    it('should categorize unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      errorLogger.logError(unknownError);

      const history = errorLogger.getErrorHistory();
      expect(history[0].category).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('Error Recovery', () => {
    it('should mark network errors as recoverable', () => {
      const networkError = new Error('Network timeout');
      errorLogger.logError(networkError);

      const history = errorLogger.getErrorHistory();
      expect(history[0].isRecoverable).toBe(true);
    });

    it('should mark temporary API errors as recoverable', () => {
      const apiErrors = [
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('Request timeout')
      ];

      apiErrors.forEach(error => {
        errorLogger.logError(error);
      });

      const history = errorLogger.getErrorHistory();
      history.forEach(entry => {
        expect(entry.isRecoverable).toBe(true);
      });
    });

    it('should mark expired auth tokens as recoverable', () => {
      const authError = new Error('Token expired');
      errorLogger.logError(authError);

      const history = errorLogger.getErrorHistory();
      expect(history[0].isRecoverable).toBe(true);
    });

    it('should mark validation errors as non-recoverable', () => {
      const validationError = new Error('Invalid email format');
      errorLogger.logError(validationError);

      const history = errorLogger.getErrorHistory();
      expect(history[0].isRecoverable).toBe(false);
    });

    it('should track retry attempts', () => {
      const error = new Error('Network error');
      const errorId = errorLogger.logError(error);

      expect(errorLogger.shouldRetry(errorId)).toBe(true);

      errorLogger.incrementRetryCount(errorId);
      errorLogger.incrementRetryCount(errorId);
      errorLogger.incrementRetryCount(errorId);

      // Network errors allow 3 retries
      expect(errorLogger.shouldRetry(errorId)).toBe(false);
    });

    it('should log recovery success', () => {
      const error = new Error('Recoverable error');
      const errorId = errorLogger.logError(error);

      errorLogger.logRecovery(errorId, 'retry');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`Error ${errorId} recovered using: retry`)
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit duplicate errors', () => {
      const error = new Error('Duplicate error');

      // Log the same error multiple times
      for (let i = 0; i < 15; i++) {
        errorLogger.logError(error);
      }

      // Should only log up to the rate limit (default 10)
      const history = errorLogger.getErrorHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should reset rate limit after window', () => {
      vi.useFakeTimers();

      errorLogger.setRateLimit({ maxErrors: 5, windowMs: 1000 });

      const error = new Error('Rate limited error');

      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        errorLogger.logError(error);
      }

      // Advance time past the window
      vi.advanceTimersByTime(1100);

      // Should be able to log again
      errorLogger.logError(error);

      const history = errorLogger.getErrorHistory();
      expect(history.length).toBe(6);

      vi.useRealTimers();
    });

    it('should track different errors separately', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      // Log different errors
      for (let i = 0; i < 5; i++) {
        errorLogger.logError(error1);
        errorLogger.logError(error2);
      }

      const history = errorLogger.getErrorHistory();
      expect(history.length).toBe(10); // 5 of each
    });
  });

  describe('History Management', () => {
    it('should limit error history size', () => {
      // Log more than the max history size (100)
      for (let i = 0; i < 150; i++) {
        errorLogger.logError(new Error(`Error ${i}`));
      }

      const history = errorLogger.getErrorHistory();
      expect(history).toHaveLength(100);
      
      // Should keep the most recent errors
      expect(history[99].error.message).toBe('Error 149');
    });

    it('should clear error history', () => {
      errorLogger.logError(new Error('Test error 1'));
      errorLogger.logError(new Error('Test error 2'));

      expect(errorLogger.getErrorHistory()).toHaveLength(2);

      errorLogger.clearHistory();

      expect(errorLogger.getErrorHistory()).toHaveLength(0);
    });
  });

  describe('Environment-Specific Logging', () => {
    it('should log detailed info in development', () => {
      const originalEnv = import.meta.env.DEV;
      (import.meta.env as any).DEV = true;

      const error = new Error('Dev error');
      errorLogger.logError(error, ErrorSeverity.HIGH);

      expect(console.group).toHaveBeenCalledWith(
        expect.stringContaining('[HIGH]'),
        expect.any(String)
      );
      expect(console.error).toHaveBeenCalledWith('Error:', error);

      (import.meta.env as any).DEV = originalEnv;
    });

    it('should log minimal info in production', () => {
      const originalEnv = import.meta.env.DEV;
      (import.meta.env as any).DEV = false;

      const error = new Error('Prod error');
      const errorId = errorLogger.logError(error, ErrorSeverity.HIGH);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[HIGH]'),
        expect.objectContaining({
          id: errorId,
          category: expect.any(String)
        })
      );

      (import.meta.env as any).DEV = originalEnv;
    });
  });

  describe('External Service Integration', () => {
    it('should send errors to custom endpoint when configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      errorLogger.configure({
        customEndpoint: {
          url: 'https://api.example.com/errors',
          headers: { 'X-API-Key': 'test-key' }
        }
      });

      const originalEnv = import.meta.env.DEV;
      (import.meta.env as any).DEV = false;

      const error = new Error('External service error');
      errorLogger.logError(error);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/errors',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key'
          }),
          body: expect.stringContaining('External service error')
        })
      );

      (import.meta.env as any).DEV = originalEnv;
    });

    it('should handle custom endpoint failures gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      errorLogger.configure({
        customEndpoint: { url: 'https://api.example.com/errors' }
      });

      const originalEnv = import.meta.env.DEV;
      (import.meta.env as any).DEV = false;

      const error = new Error('Test error');
      errorLogger.logError(error);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(console.warn).toHaveBeenCalledWith('Failed to send error to custom endpoint');

      (import.meta.env as any).DEV = originalEnv;
    });
  });

  describe('Sentry Integration', () => {
    it('should send errors to Sentry when configured', () => {
      const mockSentry = {
        captureException: vi.fn()
      };
      (window as any).Sentry = mockSentry;

      errorLogger.configure({
        sentry: {
          dsn: 'https://test@sentry.io/123',
          environment: 'test'
        }
      });

      const originalEnv = import.meta.env.DEV;
      (import.meta.env as any).DEV = false;

      const error = new Error('Sentry error');
      const errorId = errorLogger.logError(error, ErrorSeverity.CRITICAL);

      expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
        level: 'fatal',
        tags: {
          category: ErrorCategory.UNKNOWN,
          errorId
        },
        contexts: {
          errorContext: expect.objectContaining({
            timestamp: expect.any(Date),
            userAgent: navigator.userAgent
          })
        }
      });

      delete (window as any).Sentry;
      (import.meta.env as any).DEV = originalEnv;
    });
  });
});