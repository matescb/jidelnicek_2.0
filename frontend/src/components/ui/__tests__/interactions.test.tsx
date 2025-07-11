import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../switch';
import { Button } from '../button';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: React.forwardRef(({ children, className, whileHover, whileTap, whileFocus, ...props }: any, ref: any) => (
      <button ref={ref} className={className} {...props}>{children}</button>
    )),
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock animation utilities
jest.mock('@/utils/animations', () => ({
  hover: {},
  tap: {},
  focus: {},
}));

describe('Switch', () => {
  it('renders unchecked by default', () => {
    render(<Switch />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    expect(checkbox).not.toBeChecked();
  });

  it('toggles when clicked', async () => {
    const user = userEvent.setup();
    render(<Switch />);
    
    const label = screen.getByRole('generic').closest('label');
    expect(label).toBeInTheDocument();
    
    await user.click(label!);
    
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    expect(checkbox).toBeChecked();
    
    await user.click(label!);
    expect(checkbox).not.toBeChecked();
  });

  it('calls onCheckedChange when toggled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();
    render(<Switch onCheckedChange={onCheckedChange} />);
    
    const label = screen.getByRole('generic').closest('label');
    
    await user.click(label!);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    
    await user.click(label!);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('calls onChange when toggled', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Switch onChange={onChange} />);
    
    const label = screen.getByRole('generic').closest('label');
    
    await user.click(label!);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target.checked).toBe(true);
  });

  it('respects controlled state', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    expect(checkbox).not.toBeChecked();
    
    rerender(<Switch checked={true} onChange={() => {}} />);
    expect(checkbox).toBeChecked();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Switch disabled />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    expect(checkbox).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(<Switch className="custom-switch" />);
    const switchElement = container.querySelector('.custom-switch');
    expect(switchElement).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Switch ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('checkbox');
  });

  it('has proper accessibility attributes', () => {
    render(<Switch aria-label="Toggle feature" />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    expect(checkbox).toHaveAttribute('aria-label', 'Toggle feature');
  });

  it('has transition classes for smooth animation', () => {
    const { container } = render(<Switch />);
    const switchTrack = container.querySelector('div');
    expect(switchTrack).toHaveClass('after:transition-all');
  });

  it('shows focus ring on focus', async () => {
    const user = userEvent.setup();
    const { container } = render(<Switch />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    
    await user.tab();
    
    const switchTrack = container.querySelector('div');
    expect(switchTrack).toHaveClass('peer-focus:ring-4');
  });
});

describe('Button interactions', () => {
  it('shows loading state with spinner', () => {
    render(<Button loading>Click me</Button>);
    
    // Check for loading spinner
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    
    // Button should be disabled when loading
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('prevents click when disabled', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    // Try to click disabled button
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('prevents click when loading', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button loading onClick={onClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies hover styles', async () => {
    const user = userEvent.setup();
    render(<Button>Hover me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-primary-700');
    
    await user.hover(button);
    // Note: CSS pseudo-classes like :hover cannot be tested directly
    // but we verify the class is present
  });

  it('applies active styles', () => {
    render(<Button>Press me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('active:bg-primary-800');
  });

  it('shows focus ring on focus', async () => {
    const user = userEvent.setup();
    render(<Button>Focus me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus-visible:ring-2');
    
    await user.tab();
    // Focus visible pseudo-class would be active here
  });

  it('renders as slot when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveTextContent('Link Button');
  });

  it('handles all button variants', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    
    variants.forEach(variant => {
      const { unmount } = render(<Button variant={variant}>Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      unmount();
    });
  });

  it('handles all button sizes', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;
    
    sizes.forEach(size => {
      const { unmount } = render(<Button size={size}>Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      unmount();
    });
  });

  it('combines loading spinner with text', () => {
    render(<Button loading>Loading...</Button>);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('maintains disabled cursor style', () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('disabled:cursor-not-allowed');
  });
});

describe('Micro-interactions', () => {
  it('button has transition duration', () => {
    render(<Button>Animated</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('transition-all', 'duration-200');
  });

  it('switch has smooth transition', () => {
    const { container } = render(<Switch />);
    
    const switchTrack = container.querySelector('div');
    expect(switchTrack?.className).toContain('after:transition-all');
  });

  it('loading spinner has animation', () => {
    render(<Button loading>Loading</Button>);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('button shadow changes on hover', () => {
    render(<Button>Shadow Effect</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('shadow-sm', 'hover:shadow-md');
  });

  it('focus states are accessible', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Button>First</Button>
        <Button>Second</Button>
      </div>
    );
    
    const buttons = screen.getAllByRole('button');
    
    await user.tab();
    // First button would have focus
    
    await user.tab();
    // Second button would have focus
    
    // Both buttons have focus-visible styles
    buttons.forEach(button => {
      expect(button).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2');
    });
  });
});