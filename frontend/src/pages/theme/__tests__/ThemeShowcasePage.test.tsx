import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../../context/ThemeContext';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeShowcasePage } from '../ThemeShowcasePage';

// Mock clipboard API
const mockWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock toast hook
jest.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

const ThemeShowcaseWrapper = ({ children }: { children: React.ReactNode }) => {
  const router = createBrowserRouter([
    {
      path: '/',
      element: <ThemeProvider>{children}</ThemeProvider>
    }
  ], {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }
  });
  
  return <RouterProvider router={router} />;
};

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
    
    // Check for copied notification - use getAllByText since multiple swatches might show it
    await waitFor(() => {
      const copiedNotifications = screen.getAllByText('Copied!');
      expect(copiedNotifications.length).toBeGreaterThan(0);
    });
  });

  it('displays theme transition information', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    // Check for theme transition section
    expect(screen.getByText('Theme Transitions')).toBeInTheDocument();
    expect(screen.getByText('Smooth Transitions')).toBeInTheDocument();
    expect(screen.getByText('Consistent Theming')).toBeInTheDocument();
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
    
    // Check for the button states section header
    expect(screen.getByText('Button States')).toBeInTheDocument();
    
    // Check for buttons with specific text
    expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full Width Button' })).toBeInTheDocument();
  });

  it('displays form components', () => {
    render(
      <ThemeShowcaseWrapper>
        <ThemeShowcasePage />
      </ThemeShowcaseWrapper>
    );
    
    // Check for form labels
    expect(screen.getByText('Text Input')).toBeInTheDocument();
    expect(screen.getByText('Required Input')).toBeInTheDocument();
    expect(screen.getByText('Disabled Input')).toBeInTheDocument();
    expect(screen.getByText('Password Input')).toBeInTheDocument();
    expect(screen.getByText('Select Input')).toBeInTheDocument();
    expect(screen.getByText('Textarea')).toBeInTheDocument();
    
    // Check for actual form elements
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
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
    
    // Check for the badges section header
    expect(screen.getByText('Badges & Tags')).toBeInTheDocument();
    expect(screen.getByText('Status Badges')).toBeInTheDocument();
    
    // Status badges - use more specific queries if needed
    const badges = screen.getByText('Status Badges').parentElement?.parentElement;
    if (badges) {
      expect(badges).toHaveTextContent('Active');
      expect(badges).toHaveTextContent('Pending');
      expect(badges).toHaveTextContent('Expired');
    }
    
    // Category tags
    expect(screen.getByText('Category Tags')).toBeInTheDocument();
    const categorySection = screen.getByText('Category Tags').parentElement?.parentElement;
    if (categorySection) {
      expect(categorySection).toHaveTextContent('Breakfast');
      expect(categorySection).toHaveTextContent('Lunch');
      expect(categorySection).toHaveTextContent('Dinner');
    }
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