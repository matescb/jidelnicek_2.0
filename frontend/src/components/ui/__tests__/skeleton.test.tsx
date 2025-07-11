import React from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard } from '../skeleton';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

// Mock animation utilities
jest.mock('@/utils/animations', () => ({
  skeletonPulse: {},
  getAnimation: (animation: any) => ({ animate: {} }),
}));

describe('Skeleton', () => {
  describe('Basic Skeleton', () => {
    it('renders with default props', () => {
      render(<Skeleton />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('rounded-md', 'relative', 'overflow-hidden');
    });

    it('applies default variant classes', () => {
      render(<Skeleton />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('bg-gray-200', 'dark:bg-gray-800');
    });

    it('applies light variant classes', () => {
      render(<Skeleton variant="light" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('bg-gray-100', 'dark:bg-gray-900');
    });

    it('applies dark variant classes', () => {
      render(<Skeleton variant="dark" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('bg-gray-300', 'dark:bg-gray-700');
    });

    it('applies custom className', () => {
      render(<Skeleton className="custom-class h-20 w-40" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('custom-class', 'h-20', 'w-40');
    });

    it('disables animation when animate is false', () => {
      const { container } = render(<Skeleton animate={false} />);
      const skeleton = container.firstChild;
      expect(skeleton).toBeInTheDocument();
    });

    it('passes through additional props', () => {
      render(<Skeleton data-testid="test-skeleton" aria-label="Loading skeleton" />);
      const skeleton = screen.getByTestId('test-skeleton');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading skeleton');
    });
  });

  describe('SkeletonText', () => {
    it('renders with default height and full width', () => {
      render(<SkeletonText />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-4', 'w-full');
    });

    it('applies custom className', () => {
      render(<SkeletonText className="h-6 w-3/4" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-6', 'w-3/4');
    });

    it('inherits variant from props', () => {
      render(<SkeletonText variant="light" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('bg-gray-100', 'dark:bg-gray-900');
    });

    it('can disable animation', () => {
      const { container } = render(<SkeletonText animate={false} />);
      const skeleton = container.firstChild;
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('SkeletonAvatar', () => {
    it('renders with default medium size', () => {
      render(<SkeletonAvatar />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('rounded-full', 'h-10', 'w-10');
    });

    it('renders with small size', () => {
      render(<SkeletonAvatar size="sm" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-8', 'w-8');
    });

    it('renders with large size', () => {
      render(<SkeletonAvatar size="lg" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-12', 'w-12');
    });

    it('applies custom className', () => {
      render(<SkeletonAvatar className="border-2" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('rounded-full', 'border-2');
    });

    it('maintains circular shape', () => {
      render(<SkeletonAvatar />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('rounded-full');
    });
  });

  describe('SkeletonCard', () => {
    it('renders card layout with multiple skeletons', () => {
      render(<SkeletonCard />);
      const container = screen.getByRole('generic');
      expect(container).toHaveClass('space-y-3');

      // Should have image skeleton
      const skeletons = container.querySelectorAll('[class*="bg-gray"]');
      expect(skeletons.length).toBeGreaterThan(0);
      
      // Check for image skeleton
      const imageSkeletons = Array.from(skeletons).filter(el => 
        el.classList.contains('h-32') && el.classList.contains('w-full')
      );
      expect(imageSkeletons.length).toBe(1);
    });

    it('renders text skeletons in card', () => {
      render(<SkeletonCard />);
      const container = screen.getByRole('generic');
      
      // Check for text content area
      const textArea = container.querySelector('.space-y-2');
      expect(textArea).toBeInTheDocument();
      
      // Check for text skeletons
      const textSkeletons = textArea?.querySelectorAll('[class*="h-4"]');
      expect(textSkeletons?.length).toBe(2);
      
      // Check widths
      expect(textSkeletons?.[0]).toHaveClass('w-3/4');
      expect(textSkeletons?.[1]).toHaveClass('w-1/2');
    });

    it('applies custom className to container', () => {
      render(<SkeletonCard className="p-4 border" />);
      const container = screen.getByRole('generic');
      expect(container).toHaveClass('space-y-3', 'p-4', 'border');
    });

    it('passes variant to all child skeletons', () => {
      render(<SkeletonCard variant="light" />);
      const skeletons = screen.getAllByRole('generic').filter(el => 
        el.classList.contains('bg-gray-100') || el.classList.contains('dark:bg-gray-900')
      );
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('can disable animation for all child skeletons', () => {
      const { container } = render(<SkeletonCard animate={false} />);
      const skeletons = container.querySelectorAll('[class*="bg-gray"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Dark mode support', () => {
    it('applies dark mode classes for default variant', () => {
      render(<Skeleton />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('dark:bg-gray-800');
    });

    it('applies dark mode classes for light variant', () => {
      render(<Skeleton variant="light" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('dark:bg-gray-900');
    });

    it('applies dark mode classes for dark variant', () => {
      render(<Skeleton variant="dark" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('dark:bg-gray-700');
    });
  });

  describe('Custom dimensions', () => {
    it('accepts custom width and height via className', () => {
      render(<Skeleton className="h-24 w-48" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-24', 'w-48');
    });

    it('works with responsive classes', () => {
      render(<Skeleton className="h-10 w-full md:h-20 md:w-1/2" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-10', 'w-full', 'md:h-20', 'md:w-1/2');
    });

    it('works with arbitrary values', () => {
      render(<Skeleton className="h-[100px] w-[200px]" />);
      const skeleton = screen.getByRole('generic');
      expect(skeleton).toHaveClass('h-[100px]', 'w-[200px]');
    });
  });

  describe('Props validation', () => {
    it('handles all valid variants', () => {
      const variants = ['default', 'light', 'dark'] as const;
      
      variants.forEach(variant => {
        const { unmount } = render(<Skeleton variant={variant} />);
        const skeleton = screen.getByRole('generic');
        expect(skeleton).toBeInTheDocument();
        unmount();
      });
    });

    it('handles all animation states', () => {
      const animationStates = [true, false];
      
      animationStates.forEach(animate => {
        const { unmount } = render(<Skeleton animate={animate} />);
        const skeleton = screen.getByRole('generic');
        expect(skeleton).toBeInTheDocument();
        unmount();
      });
    });
  });
});