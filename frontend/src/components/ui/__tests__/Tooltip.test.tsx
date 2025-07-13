import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('renders children without tooltip by default', () => {
      render(
        <Tooltip content="Test tooltip">
          <button>Hover me</button>
        </Tooltip>
      );
      
      expect(screen.getByText('Hover me')).toBeInTheDocument();
      expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
    });

    it('shows tooltip on hover', async () => {
      render(
        <Tooltip content="Test tooltip" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
    });

    it('hides tooltip on mouse leave', async () => {
      render(
        <Tooltip content="Test tooltip" showDelay={0} hideDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(button);
      
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      });
    });

    it('respects showDelay', async () => {
      jest.useFakeTimers();
      
      render(
        <Tooltip content="Test tooltip" showDelay={500}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      // Should not show immediately
      expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      
      // Fast forward time
      jest.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });

    it('respects hideDelay', async () => {
      jest.useFakeTimers();
      
      render(
        <Tooltip content="Test tooltip" showDelay={0} hideDelay={300}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(button);
      
      // Should still be visible immediately after mouse leave
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      
      // Fast forward time
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });

    it('does not show tooltip when disabled', async () => {
      render(
        <Tooltip content="Test tooltip" disabled showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      // Wait a bit to ensure it doesn't appear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
    });

    it('does not show tooltip when content is empty', async () => {
      render(
        <Tooltip content="" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      // Wait a bit to ensure it doesn't appear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Trigger modes', () => {
    it('shows tooltip on click when trigger is click', async () => {
      render(
        <Tooltip content="Test tooltip" trigger="click">
          <button>Click me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Click me');
      
      // Hover should not show tooltip
      fireEvent.mouseEnter(button);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      
      // Click should show tooltip
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
      
      // Click again should hide tooltip
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      });
    });

    it('shows tooltip on focus when trigger is focus', async () => {
      render(
        <Tooltip content="Test tooltip" trigger="focus">
          <input placeholder="Focus me" />
        </Tooltip>
      );
      
      const input = screen.getByPlaceholderText('Focus me');
      
      // Focus should show tooltip
      fireEvent.focus(input);
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
      
      // Blur should hide tooltip
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      });
    });

    it('supports multiple triggers', async () => {
      render(
        <Tooltip content="Test tooltip" trigger={['hover', 'focus']} showDelay={0}>
          <input placeholder="Hover or focus" />
        </Tooltip>
      );
      
      const input = screen.getByPlaceholderText('Hover or focus');
      
      // Hover should show tooltip
      fireEvent.mouseEnter(input);
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(input);
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      });
      
      // Focus should also show tooltip
      fireEvent.focus(input);
      await waitFor(() => {
        expect(screen.getByText('Test tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('Controlled mode', () => {
    it('respects controlled open state', () => {
      const { rerender } = render(
        <Tooltip content="Test tooltip" open={false} onOpenChange={() => {}}>
          <button>Controlled</button>
        </Tooltip>
      );
      
      expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
      
      rerender(
        <Tooltip content="Test tooltip" open={true} onOpenChange={() => {}}>
          <button>Controlled</button>
        </Tooltip>
      );
      
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });

    it('calls onOpenChange when attempting to change state', async () => {
      const onOpenChange = jest.fn();
      
      render(
        <Tooltip content="Test tooltip" trigger="click" onOpenChange={onOpenChange}>
          <button>Click me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Click me');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Placement', () => {
    it('applies correct placement classes', async () => {
      const placements: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
      
      for (const placement of placements) {
        const { unmount } = render(
          <Tooltip content="Test tooltip" placement={placement} showDelay={0}>
            <button>Hover me</button>
          </Tooltip>
        );
        
        const button = screen.getByText('Hover me');
        fireEvent.mouseEnter(button);
        
        await waitFor(() => {
          const tooltip = screen.getByRole('tooltip');
          expect(tooltip).toBeInTheDocument();
        });
        
        unmount();
      }
    });
  });

  describe('Variants and sizes', () => {
    it('applies size classes correctly', async () => {
      const { rerender } = render(
        <Tooltip content="Test tooltip" size="sm" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('px-2', 'py-1', 'text-xs');
      });
      
      fireEvent.mouseLeave(button);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
      
      rerender(
        <Tooltip content="Test tooltip" size="lg" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('px-4', 'py-3', 'text-base');
      });
    });

    it('applies variant classes correctly', async () => {
      const { rerender } = render(
        <Tooltip content="Test tooltip" variant="dark" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('bg-secondary-900');
      });
      
      fireEvent.mouseLeave(button);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
      
      rerender(
        <Tooltip content="Test tooltip" variant="light" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('bg-surface');
      });
    });
  });

  describe('Interactive mode', () => {
    it('keeps tooltip open when hovering over it in interactive mode', async () => {
      jest.useFakeTimers();
      
      render(
        <Tooltip content="Interactive tooltip" interactive showDelay={0} hideDelay={100}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(screen.getByText('Interactive tooltip')).toBeInTheDocument();
      });
      
      const tooltip = screen.getByRole('tooltip');
      
      // Move from button to tooltip
      fireEvent.mouseLeave(button);
      fireEvent.mouseEnter(tooltip);
      
      // Fast forward time
      jest.advanceTimersByTime(100);
      
      // Tooltip should still be visible
      expect(screen.getByText('Interactive tooltip')).toBeInTheDocument();
      
      // Leave tooltip
      fireEvent.mouseLeave(tooltip);
      jest.advanceTimersByTime(100);
      
      await waitFor(() => {
        expect(screen.queryByText('Interactive tooltip')).not.toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });
  });

  describe('Custom content', () => {
    it('renders custom JSX content', async () => {
      render(
        <Tooltip 
          content={
            <div>
              <h3>Title</h3>
              <p>Description</p>
            </div>
          }
          showDelay={0}
        >
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', async () => {
      render(
        <Tooltip content="Test tooltip" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      
      // Initially no aria-describedby
      expect(button.parentElement).not.toHaveAttribute('aria-describedby');
      
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(button.parentElement).toHaveAttribute('aria-describedby', 'tooltip');
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('id', 'tooltip');
      });
    });
  });

  describe('Arrow', () => {
    it('shows arrow by default', async () => {
      render(
        <Tooltip content="Test tooltip" showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        const arrow = tooltip.querySelector('.transform.rotate-45');
        expect(arrow).toBeInTheDocument();
      });
    });

    it('hides arrow when arrow prop is false', async () => {
      render(
        <Tooltip content="Test tooltip" arrow={false} showDelay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        const arrow = tooltip.querySelector('.transform.rotate-45');
        expect(arrow).not.toBeInTheDocument();
      });
    });
  });
});