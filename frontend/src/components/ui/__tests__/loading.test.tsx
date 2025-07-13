import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { LoadingSpinner } from '../LoadingSpinner';
import { LoadingDots, InlineLoadingDots } from '../LoadingDots';
import { LoadingOverlay, ContainerLoading, PageLoading } from '../LoadingOverlay';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    svg: ({ children, className, role, ...props }: any) => (
      <svg className={className} role={role} {...props}>{children}</svg>
    ),
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>{children}</span>
    ),
    p: ({ children, className, ...props }: any) => (
      <p className={className} {...props}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
    expect(spinner.tagName).toBe('svg');
  });

  it('applies size variants correctly', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const;
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12'
    };

    sizes.forEach(size => {
      const { unmount } = render(<LoadingSpinner size={size} />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass(...sizeClasses[size].split(' '));
      unmount();
    });
  });

  it('applies color variants correctly', () => {
    const variants = ['default', 'primary', 'secondary', 'destructive', 'success', 'warning'] as const;
    
    variants.forEach(variant => {
      const { unmount } = render(<LoadingSpinner variant={variant} />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      unmount();
    });
  });

  it('applies custom color', () => {
    render(<LoadingSpinner color="#ff0000" />);
    const spinner = screen.getByRole('status');
    // Since we're mocking framer-motion, check for the presence of the style attribute or className
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('style', expect.stringContaining('color'));
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-spinner" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-spinner');
  });

  it('uses custom aria-label', () => {
    render(<LoadingSpinner label="Processing request" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Processing request');
  });

  it('has animate-spin class', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('renders SVG content correctly', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    const circle = spinner.querySelector('circle');
    const path = spinner.querySelector('path');
    
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveClass('opacity-25');
    expect(path).toBeInTheDocument();
    expect(path).toHaveClass('opacity-75');
  });
});

describe('LoadingDots', () => {
  it('renders three dots', () => {
    render(<LoadingDots />);
    const container = screen.getByRole('status');
    const dots = container.querySelectorAll('span');
    expect(dots).toHaveLength(3);
  });

  it('applies size variants correctly', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const;
    const dotSizeClasses = {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
      lg: 'h-2.5 w-2.5',
      xl: 'h-3 w-3'
    };

    sizes.forEach(size => {
      const { unmount } = render(<LoadingDots size={size} />);
      const container = screen.getByRole('status');
      const dots = container.querySelectorAll('span');
      
      dots.forEach(dot => {
        expect(dot).toHaveClass(...dotSizeClasses[size].split(' '));
      });
      unmount();
    });
  });

  it('applies variant colors correctly', () => {
    const variants = ['default', 'primary', 'secondary', 'success', 'warning', 'danger'] as const;
    
    variants.forEach(variant => {
      const { unmount } = render(<LoadingDots variant={variant} />);
      const container = screen.getByRole('status');
      expect(container).toBeInTheDocument();
      unmount();
    });
  });

  it('applies custom className', () => {
    render(<LoadingDots className="custom-dots" />);
    const container = screen.getByRole('status');
    expect(container).toHaveClass('custom-dots');
  });

  it('uses custom aria-label', () => {
    render(<LoadingDots label="Please wait" />);
    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-label', 'Please wait');
  });

  it('InlineLoadingDots renders with loading text', () => {
    render(<InlineLoadingDots />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    const container = screen.getByRole('status');
    expect(container).toBeInTheDocument();
  });

  it('InlineLoadingDots uses small size by default', () => {
    render(<InlineLoadingDots />);
    const container = screen.getByRole('status');
    const dots = container.querySelectorAll('span');
    
    dots.forEach(dot => {
      expect(dot).toHaveClass('h-1.5', 'w-1.5');
    });
  });
});

describe('LoadingOverlay', () => {
  it('renders when isLoading is true', () => {
    const { container } = render(<LoadingOverlay isLoading={true} />);
    const overlay = container.firstChild;
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('absolute', 'inset-0', 'z-50');
  });

  it('does not render when isLoading is false', () => {
    const { container } = render(<LoadingOverlay isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows spinner indicator by default', () => {
    render(<LoadingOverlay isLoading={true} />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('shows dots indicator', () => {
    render(<LoadingOverlay isLoading={true} indicator="dots" />);
    const dots = screen.getByRole('status');
    expect(dots).toBeInTheDocument();
  });

  it('shows progress indicator', () => {
    render(<LoadingOverlay isLoading={true} indicator="progress" progress={50} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows custom content', () => {
    render(
      <LoadingOverlay isLoading={true} indicator="custom">
        <div>Custom loading content</div>
      </LoadingOverlay>
    );
    expect(screen.getByText('Custom loading content')).toBeInTheDocument();
  });

  it('displays loading text', () => {
    render(<LoadingOverlay isLoading={true} text="Processing your request..." />);
    expect(screen.getByText('Processing your request...')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const variants = ['default', 'dark', 'light', 'blur'] as const;
    
    variants.forEach(variant => {
      const { unmount, container } = render(<LoadingOverlay isLoading={true} variant={variant} />);
      const overlay = container.firstChild;
      expect(overlay).toBeInTheDocument();
      unmount();
    });
  });

  it('applies position classes', () => {
    const positions = ['fixed', 'absolute', 'relative'] as const;
    
    positions.forEach(position => {
      const { unmount, container } = render(<LoadingOverlay isLoading={true} position={position} />);
      const overlay = container.firstChild;
      expect(overlay).toHaveClass(position);
      unmount();
    });
  });

  it('handles click when closeOnClick is true', () => {
    const handleClick = vi.fn();
    const { container } = render(<LoadingOverlay isLoading={true} closeOnClick onClick={handleClick} />);
    
    const overlay = container.firstChild;
    fireEvent.click(overlay!);
    
    expect(handleClick).toHaveBeenCalled();
  });

  it('does not handle click when closeOnClick is false', () => {
    const handleClick = vi.fn();
    const { container } = render(<LoadingOverlay isLoading={true} closeOnClick={false} onClick={handleClick} />);
    
    const overlay = container.firstChild;
    fireEvent.click(overlay!);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies fullScreen styles', () => {
    const { container } = render(<LoadingOverlay isLoading={true} fullScreen />);
    const overlay = container.firstChild;
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50');
  });

  it('applies size to indicators', () => {
    const { rerender } = render(<LoadingOverlay isLoading={true} indicator="spinner" size="xl" />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-12', 'w-12');

    rerender(<LoadingOverlay isLoading={true} indicator="dots" size="sm" />);
    const dots = screen.getByRole('status');
    expect(dots).toBeInTheDocument();
  });
});

describe('ContainerLoading', () => {
  it('renders with minimum height', () => {
    const { container } = render(<ContainerLoading isLoading={true} />);
    const wrapper = container.firstChild;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('style', expect.stringContaining('min-height: 200px'));
  });

  it('uses custom minimum height', () => {
    const { container } = render(<ContainerLoading isLoading={true} minHeight="400px" />);
    const wrapper = container.firstChild;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('style', expect.stringContaining('min-height: 400px'));
  });

  it('has relative positioning', () => {
    const { container } = render(<ContainerLoading isLoading={true} />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('relative');
  });

  it('overlay is absolutely positioned', () => {
    const { container } = render(<ContainerLoading isLoading={true} />);
    const wrapper = container.firstChild;
    const overlay = wrapper?.querySelector('div');
    expect(overlay).toHaveClass('absolute');
  });

  it('passes through LoadingOverlay props', () => {
    render(<ContainerLoading isLoading={true} text="Loading content..." indicator="dots" />);
    expect(screen.getByText('Loading content...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('PageLoading', () => {
  it('renders as fullscreen overlay', () => {
    const { container } = render(<PageLoading isLoading={true} />);
    const overlay = container.firstChild;
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50');
  });

  it('uses fixed positioning', () => {
    const { container } = render(<PageLoading isLoading={true} />);
    const overlay = container.firstChild;
    expect(overlay).toHaveClass('fixed');
  });

  it('passes through all props except fullScreen', () => {
    const { container } = render(<PageLoading isLoading={true} text="Loading page..." variant="blur" />);
    expect(screen.getByText('Loading page...')).toBeInTheDocument();
    const overlay = container.firstChild;
    expect(overlay).toBeInTheDocument();
  });
});