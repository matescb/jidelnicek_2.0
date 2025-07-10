import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../../context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { ThemeShowcasePage } from '../ThemeShowcasePage';

// Mock clipboard API
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock toast hook
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const ThemeShowcaseWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('ThemeShowcasePage', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
  });

  it('renders without crashing', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('Theme Showcase')).toBeInTheDocument();
  });

  it('displays all major sections', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('Color Palettes')).toBeInTheDocument();
    expect(screen.getByText('Backgrounds & Surfaces')).toBeInTheDocument();
    expect(screen.getByText('Typography')).toBeInTheDocument();
    expect(screen.getByText('Buttons')).toBeInTheDocument();
    expect(screen.getByText('Form Components')).toBeInTheDocument();
    expect(screen.getByText('Cards & Elevations')).toBeInTheDocument();
    expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();
    expect(screen.getByText('Badges & Tags')).toBeInTheDocument();
    expect(screen.getByText('Table Styles')).toBeInTheDocument();
    expect(screen.getByText('Loading States')).toBeInTheDocument();
    expect(screen.getByText('Borders & Dividers')).toBeInTheDocument();
    expect(screen.getByText('Theme Transitions')).toBeInTheDocument();
  });

  it('copies color value when color swatch is clicked', async () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    // Find a color swatch (primary-500)
    const colorSwatches = screen.getAllByText('500');
    const primarySwatch = colorSwatches[0].parentElement;
    
    // Click the color swatch
    fireEvent.click(primarySwatch!);
    
    // Verify clipboard was called
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  it('shows copied notification after clicking color swatch', async () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    // Find a color swatch
    const colorSwatches = screen.getAllByText('500');
    const primarySwatch = colorSwatches[0].parentElement;
    
    // Click the color swatch
    fireEvent.click(primarySwatch!);
    
    // Check for copied notification
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('displays theme toggle components', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    // Should have both theme toggle components
    const toggleButtons = screen.getAllByRole('button', { name: /toggle theme/i });
    expect(toggleButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows all button variants', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('Primary Button')).toBeInTheDocument();
    expect(screen.getByText('Secondary Button')).toBeInTheDocument();
    expect(screen.getByText('Success Button')).toBeInTheDocument();
    expect(screen.getByText('Warning Button')).toBeInTheDocument();
    expect(screen.getByText('Danger Button')).toBeInTheDocument();
    expect(screen.getByText('Ghost Button')).toBeInTheDocument();
    expect(screen.getByText('Link Button')).toBeInTheDocument();
  });

  it('shows button states', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('Full Width Button')).toBeInTheDocument();
  });

  it('displays form components', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByLabelText('Text Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Required Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Disabled Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Password Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Textarea')).toBeInTheDocument();
  });

  it('shows alert examples', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('Success Alert')).toBeInTheDocument();
    expect(screen.getByText('Warning Alert')).toBeInTheDocument();
    expect(screen.getByText('Error Alert')).toBeInTheDocument();
    expect(screen.getByText('Info Alert')).toBeInTheDocument();
  });

  it('displays badge examples', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    // Status badges
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    
    // Category tags
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('shows table with sample data', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('displays loading states', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    expect(screen.getByText('Spinner')).toBeInTheDocument();
    expect(screen.getByText('Skeleton Pulse')).toBeInTheDocument();
    expect(screen.getByText('Loading Dots')).toBeInTheDocument();
  });
});