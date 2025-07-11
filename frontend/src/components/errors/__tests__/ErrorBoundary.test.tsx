import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from '@/components/common/ErrorBoundary';
import { errorLogger, ErrorSeverity } from '@/services/errorLogger';
import { ErrorContext, ErrorContextProvider } from '@/contexts/ErrorContext';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock services
vi.mock('@/services/errorLogger');
vi.mock('@/services/errorRecovery');
vi.mock('@/utils/errorHelpers', () => ({
  getUserFriendlyMessage: vi.fn((error) => ({
    title: 'Test Error',
    message: error.message,
    action: 'Try Again'
  })),
  formatErrorForDevelopment: vi.fn((error) => error.stack || error.message),
  isRetryableError: vi.fn(() => true)
}));

// Test components
const ThrowError: React.FC<{ error?: Error }> = ({ error }) => {
  throw error || new Error('Test error');
};

const AsyncThrowError: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const [shouldThrow, setShouldThrow] = React.useState(false);
  
  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('Async error');
    }
  }, [shouldThrow]);

  if (delay > 0) {
    setTimeout(() => setShouldThrow(true), delay);
  }

  return <button onClick={() => setShouldThrow(true)}>Throw Async Error</button>;
};

const WorkingComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div data-testid="working-component">{children || 'Working'}</div>
);

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock errorLogger
    (errorLogger.logError as any).mockReturnValue('test-error-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Error Handling', () => {
    it('should catch errors and display error UI', () => {
      render(
        <MemoryRouter>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeInTheDocument();
      expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
    });

    it('should use custom fallback when provided', () => {
      const CustomFallback = <div data-testid="custom-fallback">Custom Error UI</div>;

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
    });

    it('should use custom error component when provided', () => {
      const CustomError: React.FC<{ error: Error; retry: () => void; reset: () => void }> = 
        ({ error, retry, reset }) => (
          <div data-testid="custom-error">
            <p>{error.message}</p>
            <button onClick={retry}>Retry</button>
            <button onClick={reset}>Reset</button>
          </div>
        );

      render(
        <MemoryRouter>
          <ErrorBoundary customErrorComponent={CustomError}>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByTestId('custom-error')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('Error Logging', () => {
    it('should log errors with appropriate severity based on level', () => {
      render(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(errorLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        ErrorSeverity.HIGH,
        expect.any(Object),
        expect.objectContaining({
          component: 'ErrorBoundary',
          metadata: { level: 'page', retryCount: 0 }
        })
      );
    });

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();

      render(
        <MemoryRouter>
          <ErrorBoundary onError={onError}>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('should report to error context when not isolated', () => {
      const captureError = vi.fn();
      const mockContext = {
        captureError,
        attemptRecovery: vi.fn(),
        clearError: vi.fn(),
        getErrorHistory: vi.fn(() => [])
      };

      render(
        <ErrorContext.Provider value={mockContext}>
          <MemoryRouter>
            <ErrorBoundary>
              <ThrowError />
            </ErrorBoundary>
          </MemoryRouter>
        </ErrorContext.Provider>
      );

      expect(captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object),
        ErrorSeverity.LOW,
        { component: 'ErrorBoundary' }
      );
    });

    it('should not report to error context when isolated', () => {
      const captureError = vi.fn();
      const mockContext = {
        captureError,
        attemptRecovery: vi.fn(),
        clearError: vi.fn(),
        getErrorHistory: vi.fn(() => [])
      };

      render(
        <ErrorContext.Provider value={mockContext}>
          <MemoryRouter>
            <ErrorBoundary isolate>
              <ThrowError />
            </ErrorBoundary>
          </MemoryRouter>
        </ErrorContext.Provider>
      );

      expect(captureError).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should show retry button for retryable errors', () => {
      render(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should attempt recovery when retry is clicked', async () => {
      const { rerender } = render(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      // Should show recovering state
      expect(screen.getByText('Attempting to recover...')).toBeInTheDocument();

      // After recovery, should reset
      rerender(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <WorkingComponent />
          </ErrorBoundary>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
      });
    });

    it('should automatically retry when enableRecovery is true', async () => {
      vi.useFakeTimers();
      (errorLogger.shouldRetry as any).mockReturnValue(true);

      render(
        <MemoryRouter>
          <ErrorBoundary enableRecovery>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      // Fast-forward through retry delay
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(errorLogger.shouldRetry).toHaveBeenCalledWith('test-error-id');
      });

      vi.useRealTimers();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset when resetKeys change', () => {
      const { rerender } = render(
        <MemoryRouter>
          <ErrorBoundary resetKeys={['key1']} resetOnPropsChange>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <ErrorBoundary resetKeys={['key2']} resetOnPropsChange>
            <WorkingComponent />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByTestId('working-component')).toBeInTheDocument();
      expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
    });

    it('should not reset when resetKeys are the same', () => {
      const { rerender } = render(
        <MemoryRouter>
          <ErrorBoundary resetKeys={['key1']} resetOnPropsChange>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <ErrorBoundary resetKeys={['key1']} resetOnPropsChange>
            <WorkingComponent />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();
    });
  });

  describe('UI Features', () => {
    it('should show developer details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <MemoryRouter>
          <ErrorBoundary level="page" showDetails>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Developer Details')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Developer Details'));
      
      expect(screen.getByText(/Component Stack:/)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should copy error details to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(
        <MemoryRouter>
          <ErrorBoundary level="page" showDetails>
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText('Developer Details'));
      
      const copyButton = screen.getByRole('button', { name: '' }); // Copy button has no text
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('Test error')
        );
      });
    });

    it('should provide navigation options for page-level errors', () => {
      render(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Refresh Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });

    it('should show retry count when retrying', () => {
      (errorLogger as any).logError.mockImplementation((error: any, severity: any, errorInfo: any, context: any) => {
        return 'test-error-id';
      });

      const { rerender } = render(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      // Simulate retry
      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      rerender(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(errorLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          metadata: expect.objectContaining({ retryCount: 1 })
        })
      );
    });
  });

  describe('Component Level Rendering', () => {
    it('should render minimal UI for component-level errors', () => {
      render(
        <ErrorBoundary level="component">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();
      expect(screen.queryByText('Refresh Page')).not.toBeInTheDocument();
      expect(screen.queryByText('Go Home')).not.toBeInTheDocument();
    });

    it('should render full UI for page-level errors', () => {
      render(
        <MemoryRouter>
          <ErrorBoundary level="page">
            <ThrowError />
          </ErrorBoundary>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();
      expect(screen.getByText('Refresh Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = () => <ThrowError />;
    const WrappedComponent = withErrorBoundary(TestComponent, {
      level: 'component',
      fallback: <div>HOC Error</div>
    });

    render(<WrappedComponent />);

    expect(screen.getByText('HOC Error')).toBeInTheDocument();
  });

  it('should preserve component display name', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';
    
    const WrappedComponent = withErrorBoundary(TestComponent);
    
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('should pass props to wrapped component', () => {
    const TestComponent: React.FC<{ message: string }> = ({ message }) => (
      <div>{message}</div>
    );
    
    const WrappedComponent = withErrorBoundary(TestComponent);
    
    render(<WrappedComponent message="Hello" />);
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

describe('useErrorHandler Hook', () => {
  it('should throw errors to be caught by error boundary', () => {
    const TestComponent = () => {
      const throwError = useErrorHandler();
      
      return (
        <button onClick={() => throwError(new Error('Hook error'))}>
          Throw Error
        </button>
      );
    };

    render(
      <MemoryRouter>
        <ErrorBoundary level="page">
          <TestComponent />
        </ErrorBoundary>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Throw Error'));

    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });
});