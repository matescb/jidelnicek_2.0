import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  NavigationMiddleware,
  createMiddleware,
  composeMiddleware,
  useNavigationMiddleware,
  withMiddleware,
  MiddlewareContext,
  AsyncMiddleware,
  ConditionalMiddleware
} from '../middleware';
import { useNavigationBlocker } from '../middleware/navigationBlocker';
import { useUnsavedChangesGuard } from '../middleware/unsavedChangesGuard';
import { useRouteLogger } from '../middleware/routeLogger';
import { useAnalyticsMiddleware } from '../middleware/analytics';

// Mock hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

describe('NavigationMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute middleware in order', async () => {
    const order: number[] = [];
    
    const middleware1 = createMiddleware(async (context, next) => {
      order.push(1);
      await next();
      order.push(4);
    });

    const middleware2 = createMiddleware(async (context, next) => {
      order.push(2);
      await next();
      order.push(3);
    });

    render(
      <MemoryRouter>
        <NavigationMiddleware middleware={[middleware1, middleware2]}>
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(order).toEqual([1, 2, 3, 4]);
    });
  });

  it('should pass context through middleware chain', async () => {
    let capturedContext: MiddlewareContext | null = null;

    const middleware = createMiddleware(async (context, next) => {
      capturedContext = context;
      await next();
    });

    render(
      <MemoryRouter initialEntries={['/test?foo=bar']}>
        <NavigationMiddleware middleware={[middleware]}>
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(capturedContext).toMatchObject({
        pathname: '/test',
        search: '?foo=bar',
        hash: '',
      });
    });
  });

  it('should handle middleware errors', async () => {
    const onError = vi.fn();
    
    const errorMiddleware = createMiddleware(async () => {
      throw new Error('Middleware error');
    });

    render(
      <MemoryRouter>
        <NavigationMiddleware 
          middleware={[errorMiddleware]}
          onError={onError}
        >
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('should abort middleware chain on error', async () => {
    const middleware1 = vi.fn().mockRejectedValue(new Error('Error'));
    const middleware2 = vi.fn();

    render(
      <MemoryRouter>
        <NavigationMiddleware 
          middleware={[middleware1, middleware2]}
          onError={() => {}}
        >
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).not.toHaveBeenCalled();
    });
  });
});

describe('useNavigationBlocker', () => {
  it('should block navigation when condition is true', async () => {
    const user = userEvent.setup();
    const onBlock = vi.fn();

    const TestComponent = () => {
      const [hasChanges, setHasChanges] = React.useState(true);
      
      useNavigationBlocker({
        when: hasChanges,
        message: 'You have unsaved changes',
        onBlock,
      });

      return (
        <div>
          <button onClick={() => setHasChanges(false)}>Save</button>
          <a href="/other">Navigate Away</a>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TestComponent />} />
          <Route path="/other" element={<div>Other Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Try to navigate
    await user.click(screen.getByText('Navigate Away'));

    expect(onBlock).toHaveBeenCalled();
    expect(screen.queryByText('Other Page')).not.toBeInTheDocument();
  });

  it('should allow navigation when condition is false', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      useNavigationBlocker({
        when: false,
        message: 'You have unsaved changes',
      });

      return <a href="/other">Navigate Away</a>;
    };

    const { container } = render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TestComponent />} />
          <Route path="/other" element={<div>Other Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Navigate
    await user.click(screen.getByText('Navigate Away'));

    // Should navigate successfully
    expect(window.location.pathname).toBe('/other');
  });

  it('should show confirmation dialog', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn().mockReturnValue(false);

    const TestComponent = () => {
      useNavigationBlocker({
        when: true,
        message: 'Are you sure?',
      });

      return <a href="/other">Navigate Away</a>;
    };

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TestComponent />} />
          <Route path="/other" element={<div>Other Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByText('Navigate Away'));

    expect(window.confirm).toHaveBeenCalledWith('Are you sure?');
  });
});

describe('useUnsavedChangesGuard', () => {
  it('should detect form changes', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn().mockReturnValue(false);

    const TestComponent = () => {
      const formRef = React.useRef<HTMLFormElement>(null);
      const { hasUnsavedChanges } = useUnsavedChangesGuard(formRef);

      return (
        <form ref={formRef}>
          <input name="name" defaultValue="" />
          <div>Has changes: {hasUnsavedChanges ? 'Yes' : 'No'}</div>
        </form>
      );
    };

    render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>
    );

    expect(screen.getByText('Has changes: No')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    await user.type(input, 'New value');

    expect(screen.getByText('Has changes: Yes')).toBeInTheDocument();
  });

  it('should reset changes on form submit', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const formRef = React.useRef<HTMLFormElement>(null);
      const { hasUnsavedChanges, resetChanges } = useUnsavedChangesGuard(formRef);

      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        resetChanges();
      };

      return (
        <form ref={formRef} onSubmit={handleSubmit}>
          <input name="name" defaultValue="" />
          <button type="submit">Save</button>
          <div>Has changes: {hasUnsavedChanges ? 'Yes' : 'No'}</div>
        </form>
      );
    };

    render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'New value');

    expect(screen.getByText('Has changes: Yes')).toBeInTheDocument();

    await user.click(screen.getByText('Save'));

    expect(screen.getByText('Has changes: No')).toBeInTheDocument();
  });

  it('should ignore specified fields', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const formRef = React.useRef<HTMLFormElement>(null);
      const { hasUnsavedChanges } = useUnsavedChangesGuard(formRef, {
        ignoreFields: ['search'],
      });

      return (
        <form ref={formRef}>
          <input name="search" placeholder="Search" />
          <input name="name" placeholder="Name" />
          <div>Has changes: {hasUnsavedChanges ? 'Yes' : 'No'}</div>
        </form>
      );
    };

    render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>
    );

    // Type in ignored field
    const searchInput = screen.getByPlaceholderText('Search');
    await user.type(searchInput, 'test');

    expect(screen.getByText('Has changes: No')).toBeInTheDocument();

    // Type in tracked field
    const nameInput = screen.getByPlaceholderText('Name');
    await user.type(nameInput, 'test');

    expect(screen.getByText('Has changes: Yes')).toBeInTheDocument();
  });
});

describe('composeMiddleware', () => {
  it('should compose multiple middleware functions', async () => {
    const results: string[] = [];

    const middleware1 = createMiddleware(async (ctx, next) => {
      results.push('before1');
      await next();
      results.push('after1');
    });

    const middleware2 = createMiddleware(async (ctx, next) => {
      results.push('before2');
      await next();
      results.push('after2');
    });

    const middleware3 = createMiddleware(async (ctx, next) => {
      results.push('before3');
      await next();
      results.push('after3');
    });

    const composed = composeMiddleware([middleware1, middleware2, middleware3]);
    
    const context: MiddlewareContext = {
      pathname: '/test',
      search: '',
      hash: '',
      state: null,
    };

    await composed(context, async () => {
      results.push('handler');
    });

    expect(results).toEqual([
      'before1',
      'before2',
      'before3',
      'handler',
      'after3',
      'after2',
      'after1',
    ]);
  });
});

describe('AsyncMiddleware', () => {
  it('should handle async operations', async () => {
    const asyncMiddleware = createMiddleware(async (context, next) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      context.state = { loaded: true };
      await next();
    });

    let finalContext: MiddlewareContext | null = null;

    const TestComponent = () => {
      finalContext = useNavigationMiddleware();
      return <div>Content</div>;
    };

    render(
      <MemoryRouter>
        <NavigationMiddleware middleware={[asyncMiddleware]}>
          <TestComponent />
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(finalContext?.state).toEqual({ loaded: true });
    });
  });

  it('should handle middleware timeouts', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    const slowMiddleware = createMiddleware(async (context, next) => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await next();
    });

    render(
      <MemoryRouter>
        <NavigationMiddleware 
          middleware={[slowMiddleware]}
          timeout={1000}
          onTimeout={onTimeout}
        >
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    vi.advanceTimersByTime(1001);

    await waitFor(() => {
      expect(onTimeout).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });
});

describe('ConditionalMiddleware', () => {
  it('should execute middleware conditionally', async () => {
    const middleware = vi.fn();
    const condition = vi.fn().mockReturnValue(true);

    const conditionalMiddleware = createMiddleware(async (context, next) => {
      if (condition(context)) {
        middleware();
      }
      await next();
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <NavigationMiddleware middleware={[conditionalMiddleware]}>
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(condition).toHaveBeenCalled();
      expect(middleware).toHaveBeenCalled();
    });
  });

  it('should skip middleware when condition is false', async () => {
    const middleware = vi.fn();
    const condition = vi.fn().mockReturnValue(false);

    const conditionalMiddleware = createMiddleware(async (context, next) => {
      if (condition(context)) {
        middleware();
      }
      await next();
    });

    render(
      <MemoryRouter>
        <NavigationMiddleware middleware={[conditionalMiddleware]}>
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(condition).toHaveBeenCalled();
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});

describe('withMiddleware HOC', () => {
  it('should wrap component with middleware', async () => {
    const middleware = createMiddleware(async (context, next) => {
      context.state = { fromMiddleware: true };
      await next();
    });

    const Component = () => {
      const context = useNavigationMiddleware();
      return <div>{context.state?.fromMiddleware ? 'Has middleware' : 'No middleware'}</div>;
    };

    const WrappedComponent = withMiddleware(Component, [middleware]);

    render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Has middleware')).toBeInTheDocument();
    });
  });
});

describe('Route Logger Middleware', () => {
  it('should log route changes', async () => {
    const logger = vi.fn();

    const TestComponent = () => {
      useRouteLogger({ logger });
      return <div>Page</div>;
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={['/page1']}>
        <TestComponent />
      </MemoryRouter>
    );

    expect(logger).toHaveBeenCalledWith({
      type: 'route-change',
      from: null,
      to: '/page1',
      timestamp: expect.any(Number),
    });

    rerender(
      <MemoryRouter initialEntries={['/page2']}>
        <TestComponent />
      </MemoryRouter>
    );

    expect(logger).toHaveBeenCalledWith({
      type: 'route-change',
      from: '/page1',
      to: '/page2',
      timestamp: expect.any(Number),
    });
  });
});

describe('Analytics Middleware', () => {
  it('should track page views', async () => {
    const trackPageView = vi.fn();

    const TestComponent = () => {
      useAnalyticsMiddleware({ trackPageView });
      return <div>Page</div>;
    };

    render(
      <MemoryRouter initialEntries={['/products/123']}>
        <TestComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(trackPageView).toHaveBeenCalledWith({
        path: '/products/123',
        title: expect.any(String),
        referrer: '',
      });
    });
  });

  it('should track custom events', async () => {
    const trackEvent = vi.fn();

    const analyticsMiddleware = createMiddleware(async (context, next) => {
      trackEvent('navigation', {
        from: context.state?.from,
        to: context.pathname,
      });
      await next();
    });

    render(
      <MemoryRouter>
        <NavigationMiddleware middleware={[analyticsMiddleware]}>
          <div>Content</div>
        </NavigationMiddleware>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith('navigation', {
        from: undefined,
        to: '/',
      });
    });
  });
});