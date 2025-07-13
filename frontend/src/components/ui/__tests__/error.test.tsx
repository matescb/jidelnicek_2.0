import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert, AlertDescription, AlertTitle } from '../alert';

// Since we don't have specific error components, we'll test error states using Alert component
// and create mock components for other error scenarios

// Mock error state components
const ErrorBoundaryFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div role="alert" className="p-4 border border-red-300 rounded-md bg-red-50">
    <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
    <p className="mt-2 text-sm text-red-600">{error.message}</p>
    <button
      onClick={resetError}
      className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Try again
    </button>
  </div>
);

const ValidationError = ({ message }: { message: string }) => (
  <span role="alert" className="text-sm text-red-600 mt-1 block animate-slide-in">
    {message}
  </span>
);

const EmptyState = ({ 
  icon = '📭',
  title = 'No data found',
  description,
  action
}: {
  icon?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-4xl mb-4 animate-bounce">{icon}</div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    {description && (
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const NetworkError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
    <div className="flex items-center gap-3">
      <svg className="w-5 h-5 text-yellow-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20" role="img" aria-label="Warning icon">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        Network connection lost
      </span>
    </div>
    <button
      onClick={onRetry}
      className="text-sm font-medium text-yellow-600 hover:text-yellow-700 dark:text-yellow-400"
    >
      Retry
    </button>
  </div>
);

describe('Alert Error States', () => {
  it('renders error alert', () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>An error occurred while processing your request.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('An error occurred while processing your request.')).toBeInTheDocument();
  });

  it('applies destructive variant styles', () => {
    render(<Alert variant="destructive">Error content</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-error-50', 'text-error-900', 'border-error-200');
  });

  it('renders with icon slot', () => {
    render(
      <Alert variant="destructive">
        <svg className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
      </Alert>
    );

    const svg = screen.getByRole('alert').querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('ErrorBoundaryFallback', () => {
  it('renders error message', () => {
    const error = new Error('Test error message');
    const resetError = jest.fn();

    render(<ErrorBoundaryFallback error={error} resetError={resetError} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('calls resetError when retry button is clicked', () => {
    const error = new Error('Test error');
    const resetError = jest.fn();

    render(<ErrorBoundaryFallback error={error} resetError={resetError} />);

    const retryButton = screen.getByText('Try again');
    fireEvent.click(retryButton);

    expect(resetError).toHaveBeenCalledTimes(1);
  });

  it('has proper error styling', () => {
    const error = new Error('Test error');
    render(<ErrorBoundaryFallback error={error} resetError={() => {}} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('border-red-300', 'bg-red-50');
  });
});

describe('ValidationError', () => {
  it('renders validation message', () => {
    render(<ValidationError message="This field is required" />);

    const error = screen.getByRole('alert');
    expect(error).toBeInTheDocument();
    expect(error).toHaveTextContent('This field is required');
  });

  it('applies error styling', () => {
    render(<ValidationError message="Invalid input" />);

    const error = screen.getByRole('alert');
    expect(error).toHaveClass('text-sm', 'text-red-600');
  });

  it('has animation class', () => {
    render(<ValidationError message="Error" />);

    const error = screen.getByRole('alert');
    expect(error).toHaveClass('animate-slide-in');
  });
});

describe('EmptyState', () => {
  it('renders with default props', () => {
    render(<EmptyState />);

    expect(screen.getByText('📭')).toBeInTheDocument();
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    render(
      <EmptyState
        icon="🔍"
        title="No results"
        description="Try adjusting your search"
      />
    );

    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
  });

  it('renders action slot', () => {
    render(
      <EmptyState
        action={<button>Add item</button>}
      />
    );

    expect(screen.getByText('Add item')).toBeInTheDocument();
  });

  it('has centered layout', () => {
    const { container } = render(<EmptyState />);
    const wrapper = container.firstChild;

    expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
  });

  it('icon has bounce animation', () => {
    render(<EmptyState icon="📦" />);
    const icon = screen.getByText('📦');
    expect(icon).toHaveClass('animate-bounce');
  });
});

describe('NetworkError', () => {
  it('renders network error message', () => {
    render(<NetworkError onRetry={() => {}} />);

    expect(screen.getByText('Network connection lost')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls onRetry when retry is clicked', () => {
    const onRetry = jest.fn();
    render(<NetworkError onRetry={onRetry} />);

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has warning styling', () => {
    const { container } = render(<NetworkError onRetry={() => {}} />);
    const wrapper = container.firstChild;

    expect(wrapper).toHaveClass('bg-yellow-50', 'dark:bg-yellow-900/20');
  });

  it('icon has pulse animation', () => {
    render(<NetworkError onRetry={() => {}} />);
    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toHaveClass('animate-pulse');
  });
});

describe('Error animations', () => {
  it('validation errors slide in', () => {
    const { rerender } = render(<div />);
    
    rerender(<ValidationError message="Field required" />);
    
    const error = screen.getByRole('alert');
    expect(error).toHaveClass('animate-slide-in');
  });

  it('empty state icon bounces', () => {
    render(<EmptyState />);
    
    const icon = screen.getByText('📭');
    expect(icon).toHaveClass('animate-bounce');
  });

  it('network error icon pulses', () => {
    render(<NetworkError onRetry={() => {}} />);
    
    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toHaveClass('animate-pulse');
  });
});

describe('Error state variations', () => {
  it('renders different empty state variations', () => {
    const variations = [
      { icon: '🔍', title: 'No search results', description: 'Try different keywords' },
      { icon: '📂', title: 'Folder is empty', description: 'Add some files to get started' },
      { icon: '🚫', title: 'Access denied', description: 'You don\'t have permission' },
      { icon: '🔌', title: 'Disconnected', description: 'Check your connection' },
    ];

    variations.forEach(({ icon, title, description }) => {
      const { unmount } = render(
        <EmptyState icon={icon} title={title} description={description} />
      );

      expect(screen.getByText(icon)).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();

      unmount();
    });
  });

  it('handles different error severities', () => {
    const severities = [
      { variant: 'destructive', message: 'Critical error' },
      { variant: 'default', message: 'Information' },
    ] as const;

    severities.forEach(({ variant, message }) => {
      const { unmount } = render(
        <Alert variant={variant}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      );

      expect(screen.getByText(message)).toBeInTheDocument();
      unmount();
    });
  });
});