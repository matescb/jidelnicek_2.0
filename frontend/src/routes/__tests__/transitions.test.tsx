import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RouteTransition } from '../components/RouteTransition';
import { LoadingBoundary } from '../components/LoadingBoundary';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ProgressBar } from '../components/ProgressBar';
import { AnimatedRoute } from '../components/AnimatedRoute';
import { PageTransition } from '../components/PageTransition';
import { act } from 'react-dom/test-utils';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('RouteTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children immediately when no delay', () => {
    render(
      <MemoryRouter>
        <RouteTransition>
          <div>Content</div>
        </RouteTransition>
      </MemoryRouter>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should show loading state during transition', async () => {
    render(
      <MemoryRouter>
        <RouteTransition delay={100} loading={<div>Loading...</div>}>
          <div>Content</div>
        </RouteTransition>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  it('should handle route changes with animation', async () => {
    const user = userEvent.setup();
    
    const { rerender } = render(
      <MemoryRouter initialEntries={['/page1']}>
        <Routes>
          <Route 
            path="/page1" 
            element={
              <RouteTransition>
                <div>Page 1</div>
              </RouteTransition>
            } 
          />
          <Route 
            path="/page2" 
            element={
              <RouteTransition>
                <div>Page 2</div>
              </RouteTransition>
            } 
          />
        </Routes>
        <button onClick={() => window.location.href = '/page2'}>
          Go to Page 2
        </button>
      </MemoryRouter>
    );

    expect(screen.getByText('Page 1')).toBeInTheDocument();

    // Navigate to page 2
    rerender(
      <MemoryRouter initialEntries={['/page2']}>
        <Routes>
          <Route 
            path="/page1" 
            element={
              <RouteTransition>
                <div>Page 1</div>
              </RouteTransition>
            } 
          />
          <Route 
            path="/page2" 
            element={
              <RouteTransition>
                <div>Page 2</div>
              </RouteTransition>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeInTheDocument();
    });
  });
});

describe('LoadingBoundary', () => {
  it('should show loading state while suspended', () => {
    const LazyComponent = React.lazy(() => 
      new Promise<any>(() => {}) // Never resolves
    );

    render(
      <LoadingBoundary fallback={<div>Loading...</div>}>
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      </LoadingBoundary>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render children when loaded', async () => {
    const LazyComponent = React.lazy(() => 
      Promise.resolve({
        default: () => <div>Lazy Content</div>
      })
    );

    render(
      <LoadingBoundary fallback={<div>Loading...</div>}>
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      </LoadingBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Lazy Content')).toBeInTheDocument();
    });
  });

  it('should handle timeout for loading state', async () => {
    vi.useFakeTimers();
    
    const LazyComponent = React.lazy(() => 
      new Promise<any>(() => {}) // Never resolves
    );

    render(
      <LoadingBoundary 
        fallback={<div>Loading...</div>}
        timeout={5000}
        timeoutFallback={<div>Taking too long...</div>}
      >
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      </LoadingBoundary>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Taking too long...')).toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('should catch errors and display fallback', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('should pass error info to fallback component', () => {
    const ThrowError = () => {
      throw new Error('Specific error message');
    };

    const ErrorFallback = ({ error }: { error: Error }) => (
      <div>Error: {error.message}</div>
    );

    render(
      <ErrorBoundary fallback={ErrorFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error: Specific error message')).toBeInTheDocument();
  });

  it('should reset error boundary', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    const ThrowError = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Success</div>;
    };

    const ErrorFallback = ({ reset }: { reset: () => void }) => (
      <div>
        <div>Error occurred</div>
        <button onClick={() => {
          shouldThrow = false;
          reset();
        }}>
          Retry
        </button>
      </div>
    );

    render(
      <ErrorBoundary fallback={ErrorFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();

    await user.click(screen.getByText('Retry'));

    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('should log errors', () => {
    const onError = vi.fn();
    
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary 
        fallback={<div>Error</div>}
        onError={onError}
      >
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });
});

describe('ProgressBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show progress during navigation', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProgressBar />
      </MemoryRouter>
    );

    // Simulate navigation start
    act(() => {
      window.dispatchEvent(new Event('routeChangeStart'));
    });

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');

    // Simulate navigation complete
    act(() => {
      window.dispatchEvent(new Event('routeChangeComplete'));
    });

    await waitFor(() => {
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  it('should handle navigation errors', () => {
    render(
      <MemoryRouter>
        <ProgressBar />
      </MemoryRouter>
    );

    act(() => {
      window.dispatchEvent(new Event('routeChangeStart'));
    });

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('routeChangeError'));
    });

    expect(progressBar).toHaveClass('error');
  });

  it('should auto-increment progress', async () => {
    vi.useFakeTimers();
    
    render(
      <MemoryRouter>
        <ProgressBar autoIncrement={true} incrementInterval={100} />
      </MemoryRouter>
    );

    act(() => {
      window.dispatchEvent(new Event('routeChangeStart'));
    });

    const progressBar = screen.getByRole('progressbar');
    const initialValue = parseInt(progressBar.getAttribute('aria-valuenow') || '0');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const newValue = parseInt(progressBar.getAttribute('aria-valuenow') || '0');
    expect(newValue).toBeGreaterThan(initialValue);

    vi.useRealTimers();
  });
});

describe('AnimatedRoute', () => {
  it('should animate route transitions', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/page1']}>
        <Routes>
          <Route 
            path="/page1" 
            element={
              <AnimatedRoute>
                <div>Page 1</div>
              </AnimatedRoute>
            } 
          />
          <Route 
            path="/page2" 
            element={
              <AnimatedRoute>
                <div>Page 2</div>
              </AnimatedRoute>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Page 1')).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/page2']}>
        <Routes>
          <Route 
            path="/page1" 
            element={
              <AnimatedRoute>
                <div>Page 1</div>
              </AnimatedRoute>
            } 
          />
          <Route 
            path="/page2" 
            element={
              <AnimatedRoute>
                <div>Page 2</div>
              </AnimatedRoute>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('should support custom animation variants', () => {
    const customVariants = {
      initial: { opacity: 0, x: -100 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 100 },
    };

    render(
      <MemoryRouter>
        <AnimatedRoute variants={customVariants}>
          <div>Animated Content</div>
        </AnimatedRoute>
      </MemoryRouter>
    );

    const container = screen.getByText('Animated Content').parentElement;
    expect(container).toHaveStyle({ opacity: '1' });
  });
});

describe('PageTransition', () => {
  it('should handle page transitions with loading states', async () => {
    const LoadingComponent = () => {
      const [loading, setLoading] = React.useState(true);
      
      React.useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 100);
        return () => clearTimeout(timer);
      }, []);

      if (loading) return <div>Loading...</div>;
      return <div>Content Loaded</div>;
    };

    render(
      <MemoryRouter>
        <PageTransition>
          <LoadingComponent />
        </PageTransition>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Content Loaded')).toBeInTheDocument();
    });
  });

  it('should preserve scroll position', async () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;

    const { rerender } = render(
      <MemoryRouter initialEntries={['/page1']}>
        <Routes>
          <Route 
            path="/page1" 
            element={
              <PageTransition preserveScroll={false}>
                <div style={{ height: '2000px' }}>Page 1</div>
              </PageTransition>
            } 
          />
          <Route 
            path="/page2" 
            element={
              <PageTransition preserveScroll={false}>
                <div>Page 2</div>
              </PageTransition>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    // Navigate to page 2
    rerender(
      <MemoryRouter initialEntries={['/page2']}>
        <Routes>
          <Route 
            path="/page1" 
            element={
              <PageTransition preserveScroll={false}>
                <div style={{ height: '2000px' }}>Page 1</div>
              </PageTransition>
            } 
          />
          <Route 
            path="/page2" 
            element={
              <PageTransition preserveScroll={false}>
                <div>Page 2</div>
              </PageTransition>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});