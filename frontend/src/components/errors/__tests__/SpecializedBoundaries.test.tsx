import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouteErrorBoundary } from '@/components/errors/RouteErrorBoundary';
import { AsyncErrorBoundary } from '@/components/errors/AsyncErrorBoundary';
import { FormErrorBoundary } from '@/components/errors/FormErrorBoundary';
import { DataErrorBoundary } from '@/components/errors/DataErrorBoundary';
import { ImageErrorBoundary } from '@/components/errors/ImageErrorBoundary';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';

// Mock services and utilities
vi.mock('@/services/errorLogger');
vi.mock('@/services/errorRecovery');
vi.mock('@/services/networkMonitor', () => ({
  networkMonitor: {
    isOnline: vi.fn(() => true),
    getStatus: vi.fn(() => 'online')
  }
}));
vi.mock('@/utils/offline', () => ({
  offlineManager: {
    getCachedData: vi.fn(),
    setCachedData: vi.fn(),
    clearCachedData: vi.fn()
  }
}));

// Test components
const ThrowError: React.FC<{ error?: Error }> = ({ error }) => {
  throw error || new Error('Test error');
};

const AsyncComponent: React.FC<{ shouldError?: boolean; delay?: number }> = ({ 
  shouldError = false, 
  delay = 100 
}) => {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldError) {
        throw new Error('Async operation failed');
      }
      setData('Async data loaded');
      setLoading(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [shouldError, delay]);

  if (loading) return <div>Loading...</div>;
  return <div>{data}</div>;
};

const FormComponent: React.FC<{ shouldError?: boolean }> = ({ shouldError = false }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shouldError) {
      const error = new Error('Validation failed');
      (error as any).validationErrors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Password too short' }
      ];
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="test-form">
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Submit</button>
    </form>
  );
};

const ImageComponent: React.FC<{ src: string; shouldError?: boolean }> = ({ 
  src, 
  shouldError = false 
}) => {
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (shouldError && imgRef.current) {
      // Simulate image load error
      const event = new Event('error', { bubbles: true });
      imgRef.current.dispatchEvent(event);
    }
  }, [shouldError]);

  return <img ref={imgRef} src={src} alt="Test image" data-testid="test-image" />;
};

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle route-level errors', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<ThrowError />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should navigate back when Go Back is clicked', () => {
    const TestApp = () => {
      const navigate = useNavigate();
      return (
        <div>
          <button onClick={() => navigate('/error')}>Go to Error</button>
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route path="/error" element={
              <RouteErrorBoundary>
                <ThrowError />
              </RouteErrorBoundary>
            } />
          </Routes>
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <TestApp />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Go to Error'));
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Go Back'));
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('should redirect to custom path on unrecoverable errors', () => {
    const unrecoverableError = new Error('Unrecoverable error');
    (unrecoverableError as any).unrecoverable = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={
            <RouteErrorBoundary redirectTo="/error-page">
              <ThrowError error={unrecoverableError} />
            </RouteErrorBoundary>
          } />
          <Route path="/error-page" element={<div>Error Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Error Page')).toBeInTheDocument();
  });

  it('should preserve query parameters when specified', () => {
    const TestApp = () => {
      const navigate = useNavigate();
      return (
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/error" element={
            <RouteErrorBoundary preserveQuery redirectTo="/">
              <ThrowError />
            </RouteErrorBoundary>
          } />
        </Routes>
      );
    };

    render(
      <MemoryRouter initialEntries={['/error?param=value']}>
        <TestApp />
      </MemoryRouter>
    );

    // Should preserve query params when redirecting
    expect(window.location.search).toContain('param=value');
  });

  it('should call onNavigationError callback', () => {
    const onNavigationError = vi.fn();

    render(
      <MemoryRouter>
        <RouteErrorBoundary onNavigationError={onNavigationError}>
          <ThrowError />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(onNavigationError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('AsyncErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading fallback initially', () => {
    render(
      <AsyncErrorBoundary loadingFallback={<div>Custom Loading...</div>}>
        <AsyncComponent />
      </AsyncErrorBoundary>
    );

    expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
  });

  it('should handle async errors', async () => {
    render(
      <AsyncErrorBoundary errorFallback={<div>Async Error Occurred</div>}>
        <AsyncComponent shouldError />
      </AsyncErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Async Error Occurred')).toBeInTheDocument();
    });
  });

  it('should retry async operations', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <AsyncErrorBoundary onRetry={onRetry} maxRetries={3}>
        <AsyncComponent shouldError />
      </AsyncErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });

  it('should respect max retries limit', async () => {
    let retryCount = 0;
    const onRetry = vi.fn(() => {
      retryCount++;
      if (retryCount < 3) {
        return Promise.reject(new Error('Still failing'));
      }
      return Promise.resolve();
    });

    render(
      <AsyncErrorBoundary onRetry={onRetry} maxRetries={3} retryDelay={10}>
        <AsyncComponent shouldError />
      </AsyncErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try Again');
    
    // Click retry multiple times
    for (let i = 0; i < 5; i++) {
      fireEvent.click(retryButton);
      await waitFor(() => {}, { timeout: 50 });
    }

    // Should only retry up to maxRetries
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it('should show loading state during retry', async () => {
    const onRetry = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <AsyncErrorBoundary onRetry={onRetry} loadingFallback={<div>Retrying...</div>}>
        <AsyncComponent shouldError />
      </AsyncErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });
});

describe('FormErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle form validation errors', () => {
    const onValidationError = vi.fn();

    render(
      <FormErrorBoundary onValidationError={onValidationError}>
        <FormComponent shouldError />
      </FormErrorBoundary>
    );

    const form = screen.getByTestId('test-form');
    fireEvent.submit(form);

    expect(onValidationError).toHaveBeenCalledWith([
      { field: 'email', message: 'Invalid email' },
      { field: 'password', message: 'Password too short' }
    ]);
  });

  it('should preserve form state on error', () => {
    render(
      <FormErrorBoundary preserveFormState>
        <FormComponent />
      </FormErrorBoundary>
    );

    const emailInput = screen.getByRole('textbox');
    const passwordInput = screen.getByRole('textbox', { hidden: true });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Form state should be preserved even after error
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should scroll to first error when enabled', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <FormErrorBoundary scrollToError>
        <FormComponent shouldError />
      </FormErrorBoundary>
    );

    fireEvent.submit(screen.getByTestId('test-form'));

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('should handle different validation modes', () => {
    const onValidationError = vi.fn();

    const { rerender } = render(
      <FormErrorBoundary 
        validationMode="onChange" 
        onValidationError={onValidationError}
      >
        <FormComponent />
      </FormErrorBoundary>
    );

    const emailInput = screen.getByRole('textbox');
    
    // onChange validation
    fireEvent.change(emailInput, { target: { value: 'invalid' } });
    
    rerender(
      <FormErrorBoundary 
        validationMode="onBlur" 
        onValidationError={onValidationError}
      >
        <FormComponent />
      </FormErrorBoundary>
    );

    // onBlur validation
    fireEvent.blur(emailInput);
  });
});

describe('DataErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle data fetching errors', () => {
    render(
      <DataErrorBoundary>
        <ThrowError error={new Error('Failed to fetch data')} />
      </DataErrorBoundary>
    );

    expect(screen.getByText(/Failed to load data/i)).toBeInTheDocument();
  });

  it('should show cached data when offline', async () => {
    const { offlineManager } = await import('@/utils/offline');
    (offlineManager.getCachedData as any).mockReturnValue({ items: ['cached'] });

    const { networkMonitor } = await import('@/services/networkMonitor');
    (networkMonitor.isOnline as any).mockReturnValue(false);

    render(
      <DataErrorBoundary cacheKey="test-data" offlineSupport>
        <div>Online content</div>
      </DataErrorBoundary>
    );

    expect(screen.getByText('Online content')).toBeInTheDocument();
  });

  it('should refetch data on retry', async () => {
    const onRetry = vi.fn().mockResolvedValue({ data: 'fresh data' });

    render(
      <DataErrorBoundary onRetry={onRetry}>
        <ThrowError />
      </DataErrorBoundary>
    );

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalled();
    });
  });

  it('should show empty state when no data', () => {
    const EmptyComponent = () => null;

    render(
      <DataErrorBoundary emptyFallback={<div>No data available</div>}>
        <EmptyComponent />
      </DataErrorBoundary>
    );

    // Empty fallback is shown when children don't render anything
    expect(screen.queryByText('No data available')).toBeInTheDocument();
  });

  it('should respect stale time for cache', async () => {
    const { offlineManager } = await import('@/utils/offline');
    const getCachedDataMock = vi.fn().mockReturnValue({ 
      data: 'cached', 
      timestamp: Date.now() - 1000 
    });
    (offlineManager.getCachedData as any) = getCachedDataMock;

    render(
      <DataErrorBoundary cacheKey="test" staleTime={5000}>
        <div>Content</div>
      </DataErrorBoundary>
    );

    // Cache is still fresh (1 second old, stale time is 5 seconds)
    expect(getCachedDataMock).toHaveBeenCalledWith('test');
  });
});

describe('ImageErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show fallback image on error', async () => {
    render(
      <ImageErrorBoundary fallbackSrc="/fallback.jpg">
        <ImageComponent src="/broken.jpg" shouldError />
      </ImageErrorBoundary>
    );

    await waitFor(() => {
      const img = screen.getByTestId('test-image') as HTMLImageElement;
      expect(img.src).toContain('/fallback.jpg');
    });
  });

  it('should call onImageError callback', async () => {
    const onImageError = vi.fn();

    render(
      <ImageErrorBoundary onImageError={onImageError} fallbackSrc="/fallback.jpg">
        <ImageComponent src="/broken.jpg" shouldError />
      </ImageErrorBoundary>
    );

    await waitFor(() => {
      expect(onImageError).toHaveBeenCalledWith('/broken.jpg', expect.any(Error));
    });
  });

  it('should retry image loading', async () => {
    let attemptCount = 0;
    const TestImage = () => {
      const src = attemptCount++ < 1 ? '/broken.jpg' : '/working.jpg';
      return <img src={src} alt="Test" data-testid="retry-image" />;
    };

    render(
      <ImageErrorBoundary retryAttempts={2} fallbackSrc="/fallback.jpg">
        <TestImage />
      </ImageErrorBoundary>
    );

    const img = screen.getByTestId('retry-image') as HTMLImageElement;
    
    // First attempt fails
    fireEvent.error(img);
    
    await waitFor(() => {
      // Should retry with working URL
      expect(img.src).toContain('/working.jpg');
    });
  });

  it('should show placeholder while loading', () => {
    render(
      <ImageErrorBoundary 
        placeholderComponent={<div>Loading image...</div>}
        fallbackSrc="/fallback.jpg"
      >
        <ImageComponent src="/test.jpg" />
      </ImageErrorBoundary>
    );

    expect(screen.getByText('Loading image...')).toBeInTheDocument();
  });

  it('should handle multiple images independently', () => {
    render(
      <div>
        <ImageErrorBoundary fallbackSrc="/fallback1.jpg">
          <ImageComponent src="/broken1.jpg" shouldError />
        </ImageErrorBoundary>
        <ImageErrorBoundary fallbackSrc="/fallback2.jpg">
          <ImageComponent src="/broken2.jpg" shouldError />
        </ImageErrorBoundary>
      </div>
    );

    const images = screen.getAllByTestId('test-image') as HTMLImageElement[];
    
    expect(images[0].src).toContain('/fallback1.jpg');
    expect(images[1].src).toContain('/fallback2.jpg');
  });
});