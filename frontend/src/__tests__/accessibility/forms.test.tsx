/**
 * Accessibility tests for form components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import { RecipeForm } from '../../components/recipes/RecipeForm';
import { TripWizard } from '../../components/trips/TripWizard';
import { TextField } from '../../components/forms/TextField';
import { SelectField } from '../../components/forms/SelectField';
import { CheckboxField } from '../../components/forms/CheckboxField';
import { FileField } from '../../components/forms/FileField';
import { 
  testFormAccessibility, 
  testKeyboardNavigation,
  testAriaStates,
  testScreenReaderAnnouncement,
  mockScreenReader
} from '../utils/accessibility';
import { mockWindowResize, VIEWPORT_PRESETS } from '../utils/responsive';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Form Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text Field Component', () => {
    it('should have proper label association', () => {
      renderWithProviders(
        <TextField
          name="test-field"
          label="Test Field"
          data-testid="text-field"
        />
      );
      
      const input = screen.getByTestId('text-field');
      const label = screen.getByText('Test Field');
      
      expect(input).toHaveAttribute('id');
      expect(label).toHaveAttribute('for', input.getAttribute('id'));
    });

    it('should support required field indication', () => {
      renderWithProviders(
        <TextField
          name="required-field"
          label="Required Field"
          required
          data-testid="required-field"
        />
      );
      
      const input = screen.getByTestId('required-field');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-required', 'true');
      
      const label = screen.getByText(/Required Field/);
      expect(label).toHaveTextContent('*'); // Visual required indicator
    });

    it('should handle validation errors accessibly', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(
        <TextField
          name="email-field"
          label="Email"
          type="email"
          error="Please enter a valid email address"
          data-testid="email-field"
        />
      );
      
      const input = screen.getByTestId('email-field');
      const errorMessage = screen.getByText('Please enter a valid email address');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', errorMessage.id);
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
      
      testScreenReaderAnnouncement(input, 'Please enter a valid email address');
    });

    it('should provide helpful descriptions', () => {
      renderWithProviders(
        <TextField
          name="password-field"
          label="Password"
          type="password"
          description="Must be at least 8 characters long"
          data-testid="password-field"
        />
      );
      
      const input = screen.getByTestId('password-field');
      const description = screen.getByText('Must be at least 8 characters long');
      
      expect(input).toHaveAttribute('aria-describedby', description.id);
    });

    it('should support autocomplete for better UX', () => {
      renderWithProviders(
        <TextField
          name="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          data-testid="email-field"
        />
      );
      
      const input = screen.getByTestId('email-field');
      expect(input).toHaveAttribute('autocomplete', 'email');
    });
  });

  describe('Select Field Component', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ];

    it('should have proper ARIA attributes for combobox', () => {
      renderWithProviders(
        <SelectField
          name="test-select"
          label="Test Select"
          options={options}
          data-testid="select-field"
        />
      );
      
      const select = screen.getByTestId('select-field');
      expect(select).toHaveAttribute('role', 'combobox');
      expect(select).toHaveAttribute('aria-expanded', 'false');
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(
        <SelectField
          name="keyboard-select"
          label="Keyboard Select"
          options={options}
          data-testid="keyboard-select"
        />
      );
      
      const user = userEvent.setup();
      const select = screen.getByTestId('keyboard-select');
      
      await testKeyboardNavigation(select, {
        keys: ['Enter', 'ArrowDown', 'ArrowUp', 'Escape'],
      });
      
      // Test specific select behavior
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');
      
      await user.keyboard('{ArrowDown}');
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
      
      await user.keyboard('{Enter}');
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('should support type-ahead search', async () => {
      renderWithProviders(
        <SelectField
          name="search-select"
          label="Search Select"
          options={[
            { value: 'apple', label: 'Apple' },
            { value: 'banana', label: 'Banana' },
            { value: 'cherry', label: 'Cherry' },
          ]}
          searchable
          data-testid="search-select"
        />
      );
      
      const user = userEvent.setup();
      const select = screen.getByTestId('search-select');
      
      await user.click(select);
      await user.keyboard('a');
      
      const appleOption = screen.getByRole('option', { name: 'Apple' });
      expect(appleOption).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Checkbox Field Component', () => {
    it('should have proper ARIA states', () => {
      renderWithProviders(
        <CheckboxField
          name="test-checkbox"
          label="Test Checkbox"
          data-testid="checkbox-field"
        />
      );
      
      const checkbox = screen.getByTestId('checkbox-field');
      expect(checkbox).toHaveAttribute('type', 'checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should support indeterminate state', () => {
      renderWithProviders(
        <CheckboxField
          name="indeterminate-checkbox"
          label="Indeterminate Checkbox"
          indeterminate={true}
          data-testid="indeterminate-checkbox"
        />
      );
      
      const checkbox = screen.getByTestId('indeterminate-checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should handle group validation', () => {
      renderWithProviders(
        <fieldset>
          <legend>Choose your preferences</legend>
          <CheckboxField
            name="pref1"
            label="Preference 1"
            data-testid="pref1"
          />
          <CheckboxField
            name="pref2"
            label="Preference 2"
            data-testid="pref2"
          />
          <div role="alert" id="group-error">
            Please select at least one preference
          </div>
        </fieldset>
      );
      
      const fieldset = screen.getByRole('group');
      const legend = screen.getByText('Choose your preferences');
      const error = screen.getByText('Please select at least one preference');
      
      expect(fieldset).toContainElement(legend);
      expect(error).toHaveAttribute('role', 'alert');
    });
  });

  describe('File Field Component', () => {
    it('should have proper ARIA attributes', () => {
      renderWithProviders(
        <FileField
          name="file-upload"
          label="Upload File"
          accept="image/*"
          data-testid="file-field"
        />
      );
      
      const fileInput = screen.getByTestId('file-field');
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });

    it('should provide upload progress for screen readers', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(
        <FileField
          name="progress-upload"
          label="Upload with Progress"
          showProgress={true}
          data-testid="progress-upload"
        />
      );
      
      const user = userEvent.setup();
      const fileInput = screen.getByTestId('progress-upload');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);
      
      // Check for progress announcement
      await waitFor(() => {
        const announcements = screenReader.getAnnouncements();
        expect(announcements.some(a => a.includes('Upload progress'))).toBeTruthy();
      });
    });

    it('should handle drag and drop accessibility', async () => {
      renderWithProviders(
        <FileField
          name="drag-drop"
          label="Drag and Drop File"
          dragDrop={true}
          data-testid="drag-drop-field"
        />
      );
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      expect(dropZone).toHaveAttribute('role', 'button');
      expect(dropZone).toHaveAttribute('aria-label', 'Drop files here or click to browse');
      expect(dropZone).toHaveAttribute('tabindex', '0');
      
      // Test keyboard activation
      const user = userEvent.setup();
      await user.tab();
      expect(dropZone).toHaveFocus();
      
      await user.keyboard('{Enter}');
      // Should trigger file browser
    });
  });

  describe('Recipe Form Integration', () => {
    it('should have comprehensive form accessibility', () => {
      const { container } = renderWithProviders(
        <RecipeForm onSubmit={vi.fn()} />
      );
      
      const formStats = testFormAccessibility(container);
      
      expect(formStats.inputCount).toBeGreaterThan(0);
      expect(formStats.labelCount).toBeGreaterThan(0);
      
      // Check for form structure
      const form = container.querySelector('form');
      expect(form).toHaveAttribute('novalidate'); // Custom validation
    });

    it('should handle complex validation with multiple fields', async () => {
      const onSubmit = vi.fn();
      renderWithProviders(<RecipeForm onSubmit={onSubmit} />);
      
      const user = userEvent.setup();
      const submitButton = screen.getByRole('button', { name: /save recipe/i });
      
      // Try to submit empty form
      await user.click(submitButton);
      
      // Check for validation errors
      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        expect(errors.length).toBeGreaterThan(0);
        
        // First error should receive focus
        const firstErrorField = screen.getByDisplayValue('').closest('[aria-invalid="true"]');
        expect(firstErrorField).toHaveFocus();
      });
    });

    it('should support form auto-save announcements', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(<RecipeForm onSubmit={vi.fn()} autoSave={true} />);
      
      const user = userEvent.setup();
      const titleInput = screen.getByLabelText(/recipe title/i);
      
      await user.type(titleInput, 'Test Recipe');
      
      // Wait for auto-save
      await waitFor(() => {
        const announcements = screenReader.getAnnouncements();
        expect(announcements.some(a => a.includes('Draft saved'))).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Trip Wizard Accessibility', () => {
    it('should have proper step navigation', () => {
      renderWithProviders(<TripWizard />);
      
      const wizard = screen.getByTestId('trip-wizard');
      expect(wizard).toHaveAttribute('role', 'region');
      expect(wizard).toHaveAttribute('aria-label', 'Trip creation wizard');
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
      expect(progressBar).toHaveAttribute('aria-valuemin', '1');
      expect(progressBar).toHaveAttribute('aria-valuemax', '4');
    });

    it('should announce step changes', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(<TripWizard />);
      
      const user = userEvent.setup();
      const nextButton = screen.getByRole('button', { name: /next/i });
      
      await user.click(nextButton);
      
      const announcements = screenReader.getAnnouncements();
      expect(announcements.some(a => a.includes('Step 2 of 4'))).toBeTruthy();
    });

    it('should handle keyboard navigation between steps', async () => {
      renderWithProviders(<TripWizard />);
      
      const user = userEvent.setup();
      
      // Test step navigation with keyboard
      const step1 = screen.getByTestId('wizard-step-1');
      const step2 = screen.getByTestId('wizard-step-2');
      
      await testKeyboardNavigation(step1);
      
      // Navigate to next step
      await user.keyboard('{Control>}{ArrowRight}{/Control}');
      expect(step2).toHaveFocus();
      
      // Navigate back
      await user.keyboard('{Control>}{ArrowLeft}{/Control}');
      expect(step1).toHaveFocus();
    });
  });

  describe('Responsive Form Behavior', () => {
    it('should adapt form layout for mobile', () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      const { container } = renderWithProviders(
        <RecipeForm onSubmit={vi.fn()} />
      );
      
      const form = container.querySelector('form');
      expect(form).toHaveClass('mobile-layout');
      
      // Check that form fields stack vertically
      const formGroups = container.querySelectorAll('.form-group');
      formGroups.forEach(group => {
        const computedStyle = getComputedStyle(group);
        expect(computedStyle.flexDirection).toBe('column');
      });
    });

    it('should maintain focus during responsive changes', async () => {
      mockWindowResize(VIEWPORT_PRESETS.desktop.medium.width, VIEWPORT_PRESETS.desktop.medium.height);
      
      const { rerender } = renderWithProviders(
        <RecipeForm onSubmit={vi.fn()} />
      );
      
      const user = userEvent.setup();
      const titleInput = screen.getByLabelText(/recipe title/i);
      await user.click(titleInput);
      
      expect(titleInput).toHaveFocus();
      
      // Change to mobile layout
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <RecipeForm onSubmit={vi.fn()} />
          </ThemeProvider>
        </BrowserRouter>
      );
      
      // Focus should be maintained
      expect(titleInput).toHaveFocus();
    });

    it('should provide touch-friendly targets on mobile', () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
      
      const { container } = renderWithProviders(
        <RecipeForm onSubmit={vi.fn()} />
      );
      
      const buttons = container.querySelectorAll('button');
      const inputs = container.querySelectorAll('input, select, textarea');
      
      [...buttons, ...inputs].forEach(element => {
        const rect = element.getBoundingClientRect();
        expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44); // WCAG touch target size
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide clear error recovery instructions', async () => {
      renderWithProviders(
        <TextField
          name="recovery-field"
          label="Recovery Field"
          error="This field is required"
          helpText="Enter your full name as it appears on your ID"
          data-testid="recovery-field"
        />
      );
      
      const input = screen.getByTestId('recovery-field');
      const error = screen.getByText('This field is required');
      const help = screen.getByText('Enter your full name as it appears on your ID');
      
      expect(input).toHaveAttribute('aria-describedby');
      const describedBy = input.getAttribute('aria-describedby')!;
      expect(describedBy).toContain(error.id);
      expect(describedBy).toContain(help.id);
    });

    it('should focus first error on form submission', async () => {
      renderWithProviders(
        <form>
          <TextField
            name="field1"
            label="Field 1"
            required
            data-testid="field1"
          />
          <TextField
            name="field2"
            label="Field 2"
            required
            data-testid="field2"
          />
          <button type="submit">Submit</button>
        </form>
      );
      
      const user = userEvent.setup();
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      await user.click(submitButton);
      
      // First invalid field should receive focus
      const field1 = screen.getByTestId('field1');
      expect(field1).toHaveFocus();
      expect(field1).toHaveAttribute('aria-invalid', 'true');
    });
  });
});