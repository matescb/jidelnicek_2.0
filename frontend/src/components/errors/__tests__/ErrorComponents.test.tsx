import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorState } from '@/components/errors/states/ErrorState';
import { NetworkError } from '@/components/errors/states/NetworkError';
import { ValidationError } from '@/components/errors/states/ValidationError';
import { LoadingError } from '@/components/errors/states/LoadingError';
import { EmptyState } from '@/components/errors/states/EmptyState';
import { ErrorToast } from '@/components/errors/notifications/ErrorToast';
import { ErrorBanner } from '@/components/errors/notifications/ErrorBanner';
import { ErrorAlert } from '@/components/errors/notifications/ErrorAlert';
import { ErrorModal } from '@/components/errors/notifications/ErrorModal';
import { ErrorIllustration } from '@/components/errors/illustrations/ErrorIllustration';
import { vi } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
    path: ({ ...props }: any) => <path {...props} />
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock hooks
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}));

vi.mock('@/services/networkMonitor', () => ({
  networkMonitor: {
    isOnline: vi.fn(() => true),
    getStatus: vi.fn(() => 'online'),
    getConnectionQuality: vi.fn(() => 'good')
  }
}));

describe('Error State Components', () => {
  describe('ErrorState', () => {
    it('should display error message and title', () => {
      const error = new Error('Something went wrong');
      
      render(
        <ErrorState 
          error={error}
          title="Error Title"
          message="Custom error message"
        />
      );

      expect(screen.getByText('Error Title')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should show retry button when onRetry is provided', () => {
      const onRetry = vi.fn();
      const error = new Error('Test error');

      render(
        <ErrorState 
          error={error}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should show dismiss button when onDismiss is provided', () => {
      const onDismiss = vi.fn();
      const error = new Error('Test error');

      render(
        <ErrorState 
          error={error}
          onDismiss={onDismiss}
        />
      );

      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should display error details when showDetails is true', () => {
      const error = new Error('Detailed error');
      error.stack = 'Error stack trace here';

      render(
        <ErrorState 
          error={error}
          showDetails
        />
      );

      expect(screen.getByText(/Error stack trace here/)).toBeInTheDocument();
    });

    it('should display recovery suggestions', () => {
      const error = new Error('Network error');
      const suggestions = [
        'Check your internet connection',
        'Try again later'
      ];

      render(
        <ErrorState 
          error={error}
          suggestions={suggestions}
        />
      );

      suggestions.forEach(suggestion => {
        expect(screen.getByText(suggestion)).toBeInTheDocument();
      });
    });
  });

  describe('NetworkError', () => {
    it('should display offline message when offline', () => {
      render(
        <NetworkError 
          error={new Error('Network error')}
          isOffline={true}
        />
      );

      expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();
    });

    it('should display online error message when online', () => {
      render(
        <NetworkError 
          error={new Error('API error')}
          isOffline={false}
        />
      );

      expect(screen.getByText(/Connection error/i)).toBeInTheDocument();
    });

    it('should show go offline button when onGoOffline is provided', () => {
      const onGoOffline = vi.fn();

      render(
        <NetworkError 
          error={new Error('Network error')}
          onGoOffline={onGoOffline}
        />
      );

      const offlineButton = screen.getByText('Work Offline');
      fireEvent.click(offlineButton);

      expect(onGoOffline).toHaveBeenCalled();
    });

    it('should auto-detect offline status', async () => {
      const { networkMonitor } = await import('@/services/networkMonitor');
      (networkMonitor.isOnline as any).mockReturnValue(false);

      render(
        <NetworkError error={new Error('Network error')} />
      );

      expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();
    });
  });

  describe('ValidationError', () => {
    it('should display validation errors', () => {
      const errors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password is required' }
      ];

      render(
        <ValidationError errors={errors} fields={['email', 'password']} />
      );

      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    it('should highlight error fields', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' }
      ];

      render(
        <ValidationError 
          errors={errors} 
          fields={['email']}
        />
      );

      expect(screen.getByText('email:')).toBeInTheDocument();
    });

    it('should call onFix when fix button is clicked', () => {
      const onFix = vi.fn();
      const errors = [
        { field: 'email', message: 'Invalid email' }
      ];

      render(
        <ValidationError 
          errors={errors} 
          fields={['email']}
          onFix={onFix}
        />
      );

      const fixButton = screen.getByText('Fix');
      fireEvent.click(fixButton);

      expect(onFix).toHaveBeenCalledWith('email');
    });

    it('should render inline when specified', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' }
      ];

      render(
        <ValidationError 
          errors={errors} 
          fields={['email']}
          inline
        />
      );

      const container = screen.getByText('Invalid email').parentElement;
      expect(container).toHaveClass('inline-flex');
    });
  });

  describe('LoadingError', () => {
    it('should display resource name', () => {
      render(
        <LoadingError resource="user data" />
      );

      expect(screen.getByText(/Failed to load user data/i)).toBeInTheDocument();
    });

    it('should show retry button', () => {
      const onRetry = vi.fn();

      render(
        <LoadingError 
          resource="recipes"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should show loading state when retrying', () => {
      render(
        <LoadingError 
          resource="data"
          retrying={true}
        />
      );

      expect(screen.getByText(/Retrying.../i)).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('EmptyState', () => {
    it('should display title and message', () => {
      render(
        <EmptyState 
          title="No Results"
          message="Try adjusting your search criteria"
        />
      );

      expect(screen.getByText('No Results')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search criteria')).toBeInTheDocument();
    });

    it('should display custom icon', () => {
      const CustomIcon = () => <div data-testid="custom-icon">📭</div>;

      render(
        <EmptyState 
          title="Empty"
          icon={<CustomIcon />}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should render action button', () => {
      const handleAction = vi.fn();
      const action = <button onClick={handleAction}>Add Item</button>;

      render(
        <EmptyState 
          title="No items"
          action={action}
        />
      );

      const actionButton = screen.getByText('Add Item');
      fireEvent.click(actionButton);

      expect(handleAction).toHaveBeenCalled();
    });
  });
});

describe('Error Notifications', () => {
  describe('ErrorToast', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should display error toast', () => {
      const error = new Error('Toast error');

      render(
        <ErrorToast error={error} />
      );

      expect(screen.getByText(/Toast error/i)).toBeInTheDocument();
    });

    it('should auto-dismiss after duration', async () => {
      const error = new Error('Auto dismiss');
      const onDismiss = vi.fn();

      render(
        <ErrorToast 
          error={error} 
          duration={3000}
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByText(/Auto dismiss/i)).toBeInTheDocument();

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalled();
      });
    });

    it('should be dismissible when enabled', () => {
      const error = new Error('Dismissible toast');
      const onDismiss = vi.fn();

      render(
        <ErrorToast 
          error={error} 
          dismissible
          onDismiss={onDismiss}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should support different positions', () => {
      const error = new Error('Positioned toast');

      const { container } = render(
        <ErrorToast 
          error={error} 
          position="top-center"
        />
      );

      expect(container.firstChild).toHaveClass('top-0');
    });
  });

  describe('ErrorBanner', () => {
    it('should display error banner', () => {
      const error = new Error('Banner error');

      render(
        <ErrorBanner error={error} />
      );

      expect(screen.getByText(/Banner error/i)).toBeInTheDocument();
    });

    it('should be fixed when specified', () => {
      const error = new Error('Fixed banner');

      const { container } = render(
        <ErrorBanner error={error} fixed />
      );

      expect(container.firstChild).toHaveClass('fixed');
    });

    it('should be dismissible', () => {
      const error = new Error('Dismissible banner');
      const onDismiss = vi.fn();

      render(
        <ErrorBanner 
          error={error} 
          dismissible
          onDismiss={onDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should render custom actions', () => {
      const error = new Error('Banner with actions');
      const handleAction = vi.fn();
      const actions = (
        <button onClick={handleAction}>Take Action</button>
      );

      render(
        <ErrorBanner 
          error={error} 
          actions={actions}
        />
      );

      const actionButton = screen.getByText('Take Action');
      fireEvent.click(actionButton);

      expect(handleAction).toHaveBeenCalled();
    });
  });

  describe('ErrorAlert', () => {
    it('should display alert with severity', () => {
      const error = new Error('Alert error');

      render(
        <ErrorAlert 
          error={error} 
          severity="warning"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('warning');
      expect(screen.getByText(/Alert error/i)).toBeInTheDocument();
    });

    it('should be closable', () => {
      const error = new Error('Closable alert');
      const onClose = vi.fn();

      render(
        <ErrorAlert 
          error={error} 
          closable
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should support different severities', () => {
      const error = new Error('Severity test');

      const { rerender } = render(
        <ErrorAlert error={error} severity="info" />
      );

      let alert = screen.getByRole('alert');
      expect(alert).toHaveClass('info');

      rerender(<ErrorAlert error={error} severity="error" />);
      
      alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error');
    });
  });

  describe('ErrorModal', () => {
    it('should display modal when open', () => {
      const error = new Error('Modal error');

      render(
        <ErrorModal 
          isOpen={true}
          error={error}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Modal error/i)).toBeInTheDocument();
    });

    it('should not display modal when closed', () => {
      const error = new Error('Hidden modal');

      render(
        <ErrorModal 
          isOpen={false}
          error={error}
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      const error = new Error('Closable modal');
      const onClose = vi.fn();

      render(
        <ErrorModal 
          isOpen={true}
          error={error}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should show retry button when onRetry is provided', () => {
      const error = new Error('Retryable modal');
      const onRetry = vi.fn();

      render(
        <ErrorModal 
          isOpen={true}
          error={error}
          onClose={vi.fn()}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should show error details when enabled', () => {
      const error = new Error('Detailed modal error');
      error.stack = 'Stack trace details';

      render(
        <ErrorModal 
          isOpen={true}
          error={error}
          onClose={vi.fn()}
          showDetails
        />
      );

      expect(screen.getByText(/Stack trace details/)).toBeInTheDocument();
    });
  });
});

describe('ErrorIllustration', () => {
  it('should render appropriate illustration for error type', () => {
    render(
      <ErrorIllustration type="404" />
    );

    expect(screen.getByTestId('error-illustration-404')).toBeInTheDocument();
  });

  it('should support different error types', () => {
    const types = ['404', '403', '500', 'network', 'generic'];

    types.forEach(type => {
      const { container } = render(
        <ErrorIllustration type={type as any} />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ErrorIllustration type="404" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should have animated elements', () => {
    render(
      <ErrorIllustration type="500" animated />
    );

    const illustration = screen.getByTestId('error-illustration-500');
    expect(illustration).toHaveAttribute('data-animated', 'true');
  });
});