import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar, ProgressCircle } from '../progress';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, initial, animate, transition, ...props }: any) => (
      <div 
        className={className} 
        style={{ width: animate?.width || initial?.width || style?.width }}
        {...props}
      >
        {children}
      </div>
    ),
    circle: ({ 
      cx, cy, r, strokeWidth, strokeLinecap, className, 
      initial, animate, transition, style, ...props 
    }: any) => (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
        className={className}
        style={{
          ...style,
          strokeDashoffset: animate?.strokeDashoffset || initial?.strokeDashoffset
        }}
        {...props}
      />
    ),
  },
}));

describe('ProgressBar', () => {
  describe('Basic functionality', () => {
    it('renders with default props', () => {
      render(<ProgressBar />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(progressBar).toHaveAttribute('aria-label', '0% complete');
    });

    it('displays correct percentage', () => {
      render(<ProgressBar value={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-label', '50% complete');
    });

    it('handles custom max value', () => {
      render(<ProgressBar value={25} max={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemax', '50');
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      expect(progressBar).toHaveAttribute('aria-label', '50% complete');
    });

    it('clamps value between 0 and max', () => {
      const { rerender } = render(<ProgressBar value={-10} />);
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', '0% complete');

      rerender(<ProgressBar value={150} max={100} />);
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', '100% complete');
    });
  });

  describe('Variants and styling', () => {
    it('applies size variants correctly', () => {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const;
      const sizeClasses = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
        xl: 'h-4'
      };

      sizes.forEach(size => {
        const { unmount } = render(<ProgressBar size={size} />);
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveClass(sizeClasses[size]);
        unmount();
      });
    });

    it('applies variant styles', () => {
      const variants = ['default', 'light', 'dark'] as const;
      
      variants.forEach(variant => {
        const { unmount } = render(<ProgressBar variant={variant} />);
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        unmount();
      });
    });

    it('applies indicator variants', () => {
      const indicatorVariants = ['default', 'success', 'warning', 'danger', 'info'] as const;
      
      indicatorVariants.forEach(variant => {
        const { unmount } = render(<ProgressBar indicatorVariant={variant} />);
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        unmount();
      });
    });

    it('applies custom className', () => {
      render(<ProgressBar className="custom-progress" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('custom-progress');
    });

    it('applies custom indicator className', () => {
      render(<ProgressBar indicatorClassName="custom-indicator" />);
      const indicator = screen.getByRole('progressbar').firstChild;
      expect(indicator).toHaveClass('custom-indicator');
    });
  });

  describe('Label display', () => {
    it('shows label when showLabel is true', () => {
      render(<ProgressBar value={30} max={60} showLabel />);
      expect(screen.getByText('30/60')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('does not show label by default', () => {
      render(<ProgressBar value={50} />);
      expect(screen.queryByText('50/100')).not.toBeInTheDocument();
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('rounds percentage in label', () => {
      render(<ProgressBar value={33.333} max={100} showLabel />);
      expect(screen.getByText('33%')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('animates by default', () => {
      const { container } = render(<ProgressBar value={75} />);
      const indicator = container.querySelector('.h-full');
      expect(indicator).toHaveStyle({ width: '75%' });
    });

    it('skips animation when animate is false', () => {
      const { container } = render(<ProgressBar value={60} animate={false} />);
      const indicator = container.querySelector('.h-full');
      expect(indicator).toHaveStyle({ width: '60%' });
    });
  });

  describe('Accessibility', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ProgressBar ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('role', 'progressbar');
    });

    it('passes through additional props', () => {
      render(<ProgressBar data-testid="test-progress" id="progress-1" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('data-testid', 'test-progress');
      expect(progressBar).toHaveAttribute('id', 'progress-1');
    });
  });
});

describe('ProgressCircle', () => {
  describe('Basic functionality', () => {
    it('renders with default props', () => {
      render(<ProgressCircle />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(progressBar).toHaveAttribute('aria-label', '0% complete');
    });

    it('displays correct percentage', () => {
      render(<ProgressCircle value={75} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('aria-label', '75% complete');
    });

    it('shows percentage label by default', () => {
      render(<ProgressCircle value={65} />);
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<ProgressCircle value={50} showLabel={false} />);
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders different sizes correctly', () => {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const;
      const expectedSizes = {
        sm: 40,
        md: 60,
        lg: 80,
        xl: 100
      };

      sizes.forEach(size => {
        const { unmount } = render(<ProgressCircle size={size} />);
        const svg = screen.getByRole('progressbar');
        expect(svg).toHaveAttribute('width', String(expectedSizes[size]));
        expect(svg).toHaveAttribute('height', String(expectedSizes[size]));
        unmount();
      });
    });
  });

  describe('Variants', () => {
    it('applies color variants correctly', () => {
      const variants = ['default', 'success', 'warning', 'danger', 'info'] as const;
      
      variants.forEach(variant => {
        const { unmount } = render(<ProgressCircle variant={variant} />);
        const progressBar = screen.getByRole('progressbar');
        const progressCircle = progressBar.querySelectorAll('circle')[1];
        expect(progressCircle).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Circle calculations', () => {
    it('calculates circle dimensions correctly', () => {
      render(<ProgressCircle size="md" strokeWidth={4} />);
      const circles = screen.getByRole('progressbar').querySelectorAll('circle');
      
      // Both circles should have same center and radius
      circles.forEach(circle => {
        expect(circle).toHaveAttribute('cx', '30'); // 60/2
        expect(circle).toHaveAttribute('cy', '30');
        expect(circle).toHaveAttribute('r', '28'); // (60-4)/2
        expect(circle).toHaveAttribute('stroke-width', '4');
      });
    });

    it('renders background circle', () => {
      render(<ProgressCircle />);
      const circles = screen.getByRole('progressbar').querySelectorAll('circle');
      expect(circles).toHaveLength(2);
      
      const bgCircle = circles[0];
      expect(bgCircle).toHaveClass('fill-none', 'stroke-gray-200', 'dark:stroke-gray-800');
    });

    it('renders progress circle with rounded caps', () => {
      render(<ProgressCircle />);
      const circles = screen.getByRole('progressbar').querySelectorAll('circle');
      const progressCircle = circles[1];
      
      expect(progressCircle).toHaveAttribute('stroke-linecap', 'round');
      expect(progressCircle).toHaveClass('fill-none');
    });
  });

  describe('Animation', () => {
    it('animates by default', () => {
      render(<ProgressCircle value={50} />);
      const progressCircle = screen.getByRole('progressbar').querySelectorAll('circle')[1];
      expect(progressCircle).toBeInTheDocument();
    });

    it('skips animation when animate is false', () => {
      render(<ProgressCircle value={75} animate={false} />);
      const progressCircle = screen.getByRole('progressbar').querySelectorAll('circle')[1];
      expect(progressCircle).toBeInTheDocument();
    });
  });

  describe('Custom styling', () => {
    it('applies custom className', () => {
      render(<ProgressCircle className="custom-circle" />);
      const container = screen.getByRole('progressbar').parentElement;
      expect(container).toHaveClass('custom-circle');
    });

    it('applies custom stroke width', () => {
      render(<ProgressCircle strokeWidth={8} />);
      const circles = screen.getByRole('progressbar').querySelectorAll('circle');
      
      circles.forEach(circle => {
        expect(circle).toHaveAttribute('stroke-width', '8');
      });
    });
  });

  describe('Edge cases', () => {
    it('handles value clamping', () => {
      const { rerender } = render(<ProgressCircle value={-20} />);
      expect(screen.getByText('0%')).toBeInTheDocument();

      rerender(<ProgressCircle value={120} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('handles custom max value', () => {
      render(<ProgressCircle value={50} max={200} showLabel />);
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('rotates SVG for correct start position', () => {
      render(<ProgressCircle />);
      const svg = screen.getByRole('progressbar');
      expect(svg).toHaveClass('transform', '-rotate-90');
    });
  });
});

describe('Progress component backward compatibility', () => {
  it('exports Progress as alias for ProgressBar', () => {
    const { Progress } = require('../progress');
    render(<Progress value={50} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });
});