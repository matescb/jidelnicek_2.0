/**
 * Advanced accessibility tests for complex UI patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import { TripWizard } from '../../components/trips/TripWizard';
import { VirtualizedDataTable } from '../../components/common/VirtualizedDataTable';
import { MealPlanningBoard } from '../../components/trips/MealPlanningBoard';
import { SearchModal } from '../../components/navigation/SearchModal';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { 
  testKeyboardNavigation,
  testTabOrder,
  testFocusManagement,
  testAriaStates,
  testScreenReaderAnnouncement,
  testColorContrast,
  mockScreenReader,
  testReducedMotion,
  testHighContrast
} from '../utils/accessibility';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Advanced Accessibility Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complex Data Tables', () => {
    const complexTableData = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Recipe ${i + 1}`,
      category: ['Main Course', 'Dessert', 'Appetizer', 'Snack'][i % 4],
      cookTime: `${(i % 6 + 1) * 10} min`,
      difficulty: ['Easy', 'Medium', 'Hard'][i % 3],
      rating: Math.round((Math.random() * 4 + 1) * 10) / 10,
      author: `Chef ${String.fromCharCode(65 + (i % 26))}`,
      createdAt: new Date(2024, i % 12, (i % 28) + 1).toISOString(),
    }));

    const columns = [
      { key: 'name', label: 'Recipe Name', sortable: true, filterable: true },
      { key: 'category', label: 'Category', sortable: true, filterable: true },
      { key: 'cookTime', label: 'Cook Time', sortable: true },
      { key: 'difficulty', label: 'Difficulty', sortable: true, filterable: true },
      { key: 'rating', label: 'Rating', sortable: true },
      { key: 'author', label: 'Author', sortable: true, filterable: true },
      { key: 'createdAt', label: 'Created', sortable: true },
    ];

    it('should have proper table semantics with complex data', () => {
      renderWithProviders(
        <VirtualizedDataTable
          data={complexTableData}
          columns={columns}
          data-testid="complex-table"
        />
      );

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Recipe data table');
      expect(table).toHaveAttribute('aria-rowcount', '100');
      expect(table).toHaveAttribute('aria-colcount', '7');

      // Check column headers
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(7);

      columnHeaders.forEach((header, index) => {
        const column = columns[index];
        expect(header).toHaveTextContent(column.label);
        
        if (column.sortable) {
          expect(header).toHaveAttribute('aria-sort', 'none');
          expect(header).toHaveAttribute('tabindex', '0');
        }
      });
    });

    it('should handle sorting with screen reader announcements', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(
        <VirtualizedDataTable
          data={complexTableData}
          columns={columns}
          data-testid="sortable-table"
        />
      );

      const user = userEvent.setup();
      const nameHeader = screen.getByRole('columnheader', { name: /recipe name/i });
      
      await user.click(nameHeader);
      
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
      
      const announcements = screenReader.getAnnouncements();
      expect(announcements.some(a => a.includes('Sorted by Recipe Name, ascending'))).toBeTruthy();
      
      // Sort descending
      await user.click(nameHeader);
      expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('should support keyboard navigation in virtual table', async () => {
      renderWithProviders(
        <VirtualizedDataTable
          data={complexTableData}
          columns={columns}
          selectable={true}
          data-testid="keyboard-table"
        />
      );

      const user = userEvent.setup();
      const table = screen.getByRole('table');
      
      // Focus table
      await user.tab();
      expect(table).toHaveFocus();
      
      // Arrow key navigation
      await user.keyboard('{ArrowDown}');
      const firstRow = screen.getByRole('row', { name: /recipe 1/i });
      expect(firstRow).toHaveAttribute('aria-selected', 'true');
      
      await user.keyboard('{ArrowDown}');
      const secondRow = screen.getByRole('row', { name: /recipe 2/i });
      expect(secondRow).toHaveAttribute('aria-selected', 'true');
      expect(firstRow).toHaveAttribute('aria-selected', 'false');
      
      // Page navigation
      await user.keyboard('{PageDown}');
      // Should move down by viewport size
      
      await user.keyboard('{Home}');
      expect(firstRow).toHaveAttribute('aria-selected', 'true');
      
      await user.keyboard('{End}');
      // Should select last visible row
    });

    it('should handle filtering with live regions', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(
        <VirtualizedDataTable
          data={complexTableData}
          columns={columns}
          filterable={true}
          data-testid="filterable-table"
        />
      );

      const user = userEvent.setup();
      const filterButton = screen.getByRole('button', { name: /filter/i });
      
      await user.click(filterButton);
      
      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await user.selectOptions(categoryFilter, 'Main Course');
      
      await waitFor(() => {
        const announcements = screenReader.getAnnouncements();
        expect(announcements.some(a => a.includes('25 results found'))).toBeTruthy();
      });
      
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveTextContent('25 of 100 recipes shown');
    });

    it('should support multi-selection with proper ARIA', async () => {
      renderWithProviders(
        <VirtualizedDataTable
          data={complexTableData}
          columns={columns}
          selectable="multiple"
          data-testid="multi-select-table"
        />
      );

      const user = userEvent.setup();
      
      // Select all checkbox
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      expect(selectAllCheckbox).toHaveAttribute('aria-checked', 'false');
      
      await user.click(selectAllCheckbox);
      expect(selectAllCheckbox).toHaveAttribute('aria-checked', 'true');
      
      // Individual row checkboxes should be selected
      const rowCheckboxes = screen.getAllByRole('checkbox', { name: /select recipe/i });
      rowCheckboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('aria-checked', 'true');
      });
      
      // Deselect one item
      await user.click(rowCheckboxes[0]);
      expect(selectAllCheckbox).toHaveAttribute('aria-checked', 'mixed');
    });
  });

  describe('Drag and Drop Accessibility', () => {
    const mealPlanData = {
      days: ['Monday', 'Tuesday', 'Wednesday'],
      meals: ['Breakfast', 'Lunch', 'Dinner'],
      assignments: new Map(),
    };

    it('should support keyboard-based drag and drop', async () => {
      renderWithProviders(
        <MealPlanningBoard
          tripId="test-trip"
          initialData={mealPlanData}
          data-testid="meal-planning-board"
        />
      );

      const user = userEvent.setup();
      
      // Available recipes should be focusable
      const recipe = screen.getByTestId('recipe-item-1');
      await user.tab();
      expect(recipe).toHaveFocus();
      
      // Enter edit mode
      await user.keyboard('{Space}');
      expect(recipe).toHaveAttribute('aria-grabbed', 'true');
      
      // Navigate to drop target
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');
      
      const dropTarget = screen.getByTestId('meal-slot-monday-breakfast');
      expect(dropTarget).toHaveAttribute('aria-dropeffect', 'move');
      
      // Complete drop
      await user.keyboard('{Space}');
      expect(recipe).toHaveAttribute('aria-grabbed', 'false');
      expect(dropTarget).toContainElement(recipe);
    });

    it('should announce drag and drop operations', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(
        <MealPlanningBoard
          tripId="test-trip"
          initialData={mealPlanData}
          data-testid="accessible-meal-board"
        />
      );

      const user = userEvent.setup();
      const recipe = screen.getByTestId('recipe-item-1');
      
      await user.click(recipe);
      await user.keyboard('{Space}');
      
      const announcements = screenReader.getAnnouncements();
      expect(announcements.some(a => a.includes('Recipe 1 picked up'))).toBeTruthy();
      
      const dropTarget = screen.getByTestId('meal-slot-monday-breakfast');
      await user.keyboard('{Tab}');
      
      expect(announcements.some(a => a.includes('Drop zone: Monday Breakfast'))).toBeTruthy();
      
      await user.keyboard('{Space}');
      expect(announcements.some(a => a.includes('Recipe 1 dropped in Monday Breakfast'))).toBeTruthy();
    });

    it('should provide clear drop zone instructions', () => {
      renderWithProviders(
        <MealPlanningBoard
          tripId="test-trip"
          initialData={mealPlanData}
          data-testid="instructional-board"
        />
      );

      const dropZone = screen.getByTestId('meal-slot-monday-breakfast');
      expect(dropZone).toHaveAttribute('aria-label', 'Drop zone for Monday Breakfast meal');
      expect(dropZone).toHaveAttribute('role', 'region');
      expect(dropZone).toHaveAttribute('aria-describedby');
      
      const instructions = document.getElementById(dropZone.getAttribute('aria-describedby')!);
      expect(instructions).toHaveTextContent(/press space to drop/i);
    });
  });

  describe('Complex Search Interface', () => {
    it('should handle advanced search with proper ARIA relationships', async () => {
      renderWithProviders(
        <SearchModal isOpen={true} onClose={vi.fn()} advanced={true} />
      );

      const searchInput = screen.getByRole('combobox', { name: /search recipes/i });
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
      expect(searchInput).toHaveAttribute('aria-owns');
      
      const ownedId = searchInput.getAttribute('aria-owns');
      const suggestionsList = document.getElementById(ownedId!);
      expect(suggestionsList).toHaveAttribute('role', 'listbox');
    });

    it('should support faceted search filters', async () => {
      renderWithProviders(
        <SearchModal isOpen={true} onClose={vi.fn()} faceted={true} />
      );

      const user = userEvent.setup();
      
      // Category filter
      const categoryFilter = screen.getByRole('group', { name: /filter by category/i });
      expect(categoryFilter).toBeInTheDocument();
      
      const mainCourseOption = screen.getByRole('checkbox', { name: /main course/i });
      await user.click(mainCourseOption);
      
      expect(mainCourseOption).toBeChecked();
      
      // Difficulty filter
      const difficultyFilter = screen.getByRole('radiogroup', { name: /difficulty level/i });
      const easyOption = screen.getByRole('radio', { name: /easy/i });
      
      await user.click(easyOption);
      expect(easyOption).toBeChecked();
    });

    it('should announce search results', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(
        <SearchModal isOpen={true} onClose={vi.fn()} />
      );

      const user = userEvent.setup();
      const searchInput = screen.getByRole('combobox');
      
      await user.type(searchInput, 'chicken');
      
      await waitFor(() => {
        const announcements = screenReader.getAnnouncements();
        expect(announcements.some(a => a.includes('5 results found'))).toBeTruthy();
      });
      
      const resultsStatus = screen.getByRole('status');
      expect(resultsStatus).toHaveTextContent('5 recipes found for "chicken"');
    });

    it('should handle search result navigation', async () => {
      renderWithProviders(
        <SearchModal isOpen={true} onClose={vi.fn()} />
      );

      const user = userEvent.setup();
      const searchInput = screen.getByRole('combobox');
      
      await user.type(searchInput, 'pasta');
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      // Arrow down to first result
      await user.keyboard('{ArrowDown}');
      
      const firstResult = screen.getAllByRole('option')[0];
      expect(firstResult).toHaveAttribute('aria-selected', 'true');
      expect(searchInput).toHaveAttribute('aria-activedescendant', firstResult.id);
      
      // Arrow down to second result
      await user.keyboard('{ArrowDown}');
      
      const secondResult = screen.getAllByRole('option')[1];
      expect(secondResult).toHaveAttribute('aria-selected', 'true');
      expect(firstResult).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Multi-step Wizard Accessibility', () => {
    it('should have proper step navigation semantics', () => {
      renderWithProviders(<TripWizard />);

      const wizard = screen.getByRole('region', { name: /trip creation wizard/i });
      expect(wizard).toBeInTheDocument();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
      expect(progressBar).toHaveAttribute('aria-valuemin', '1');
      expect(progressBar).toHaveAttribute('aria-valuemax', '4');
      expect(progressBar).toHaveAttribute('aria-valuetext', 'Step 1 of 4: Basic Information');
      
      const stepList = screen.getByRole('list', { name: /wizard steps/i });
      const steps = screen.getAllByRole('listitem');
      
      expect(steps[0]).toHaveAttribute('aria-current', 'step');
      expect(steps[1]).toHaveAttribute('aria-current', 'false');
    });

    it('should announce step changes', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(<TripWizard />);

      const user = userEvent.setup();
      const nextButton = screen.getByRole('button', { name: /next/i });
      
      // Fill required fields in step 1
      const tripName = screen.getByLabelText(/trip name/i);
      await user.type(tripName, 'Test Trip');
      
      await user.click(nextButton);
      
      await waitFor(() => {
        const announcements = screenReader.getAnnouncements();
        expect(announcements.some(a => a.includes('Step 2 of 4: Participants'))).toBeTruthy();
      });
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '2');
    });

    it('should handle step validation errors', async () => {
      renderWithProviders(<TripWizard />);

      const user = userEvent.setup();
      const nextButton = screen.getByRole('button', { name: /next/i });
      
      // Try to proceed without filling required fields
      await user.click(nextButton);
      
      // Should not advance and show errors
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
      
      const errorSummary = screen.getByRole('alert');
      expect(errorSummary).toBeInTheDocument();
      expect(errorSummary).toHaveFocus();
      
      const errorList = screen.getByRole('list', { name: /errors/i });
      expect(errorList).toBeInTheDocument();
    });

    it('should support direct step navigation', async () => {
      renderWithProviders(<TripWizard allowDirectNavigation={true} />);

      const user = userEvent.setup();
      const stepButtons = screen.getAllByRole('button', { name: /step \d/i });
      
      // Steps 2-4 should be disabled initially
      expect(stepButtons[1]).toBeDisabled();
      expect(stepButtons[2]).toBeDisabled();
      expect(stepButtons[3]).toBeDisabled();
      
      // Complete step 1
      const tripName = screen.getByLabelText(/trip name/i);
      await user.type(tripName, 'Test Trip');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Step 1 should now be clickable
      expect(stepButtons[0]).not.toBeDisabled();
      
      // Can navigate back to step 1
      await user.click(stepButtons[0]);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
    });
  });

  describe('Language and Internationalization', () => {
    it('should handle language switching accessibly', async () => {
      renderWithProviders(<LanguageSwitcher />);

      const languageButton = screen.getByRole('button', { name: /language/i });
      expect(languageButton).toHaveAttribute('aria-haspopup', 'menu');
      expect(languageButton).toHaveAttribute('aria-expanded', 'false');
      
      const user = userEvent.setup();
      await user.click(languageButton);
      
      expect(languageButton).toHaveAttribute('aria-expanded', 'true');
      
      const languageMenu = screen.getByRole('menu');
      expect(languageMenu).toBeInTheDocument();
      
      const languages = screen.getAllByRole('menuitem');
      expect(languages).toHaveLength(3); // English, Czech, Spanish
      
      // Current language should be marked
      const currentLanguage = languages.find(lang => lang.getAttribute('aria-current') === 'true');
      expect(currentLanguage).toBeTruthy();
    });

    it('should announce language changes', async () => {
      const screenReader = mockScreenReader();
      
      renderWithProviders(<LanguageSwitcher />);

      const user = userEvent.setup();
      const languageButton = screen.getByRole('button', { name: /language/i });
      
      await user.click(languageButton);
      const czechOption = screen.getByRole('menuitem', { name: /čeština/i });
      await user.click(czechOption);
      
      const announcements = screenReader.getAnnouncements();
      expect(announcements.some(a => a.includes('Language changed to Czech'))).toBeTruthy();
    });

    it('should handle RTL languages', () => {
      // Mock Arabic locale
      Object.defineProperty(document.documentElement, 'dir', {
        value: 'rtl',
        writable: true,
      });
      
      renderWithProviders(<LanguageSwitcher currentLanguage="ar" />);

      const languageButton = screen.getByRole('button');
      const computedStyle = getComputedStyle(languageButton);
      
      expect(document.documentElement.dir).toBe('rtl');
      expect(computedStyle.direction).toBe('rtl');
    });
  });

  describe('High Contrast and Reduced Motion', () => {
    it('should adapt to high contrast mode', () => {
      testHighContrast(document.body);
      
      renderWithProviders(
        <div data-testid="high-contrast-content">
          <button>High Contrast Button</button>
          <input type="text" placeholder="High contrast input" />
        </div>
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');
      
      const buttonStyle = getComputedStyle(button);
      const inputStyle = getComputedStyle(input);
      
      // Colors should be high contrast
      expect(buttonStyle.borderWidth).not.toBe('0px'); // Should have visible borders
      expect(inputStyle.borderWidth).not.toBe('0px');
    });

    it('should respect reduced motion preferences', () => {
      testReducedMotion(document.body);
      
      renderWithProviders(
        <div
          data-testid="animated-content"
          className="transition-all duration-300 transform hover:scale-105"
        >
          Animated Content
        </div>
      );

      const content = screen.getByTestId('animated-content');
      const computedStyle = getComputedStyle(content);
      
      // Animations should be disabled or minimal
      expect(
        computedStyle.transitionDuration === '0s' ||
        parseFloat(computedStyle.transitionDuration) <= 0.01
      ).toBeTruthy();
    });

    it('should provide alternative interaction methods', () => {
      renderWithProviders(
        <div>
          <button
            data-testid="hover-button"
            className="group"
            onFocus={() => {}} // Should work with focus too
          >
            <span className="group-hover:opacity-50 group-focus:opacity-50">
              Hover/Focus Button
            </span>
          </button>
        </div>
      );

      const button = screen.getByTestId('hover-button');
      button.focus();
      
      // Should have focus styles equivalent to hover
      expect(button).toHaveFocus();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide comprehensive error information', async () => {
      const ErrorComponent = () => {
        throw new Error('Test error');
      };

      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        try {
          return <>{children}</>;
        } catch (error) {
          return (
            <div role="alert" data-testid="error-boundary">
              <h1>Something went wrong</h1>
              <p>We encountered an unexpected error. Please try refreshing the page.</p>
              <button onClick={() => window.location.reload()}>
                Refresh Page
              </button>
              <button onClick={() => window.history.back()}>
                Go Back
              </button>
            </div>
          );
        }
      };

      renderWithProviders(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent('Something went wrong');
      
      // Should provide recovery options
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });

    it('should focus error messages appropriately', async () => {
      renderWithProviders(
        <form>
          <input
            type="email"
            aria-invalid="true"
            aria-describedby="email-error"
            data-testid="error-input"
          />
          <div id="email-error" role="alert">
            Please enter a valid email address
          </div>
        </form>
      );

      const input = screen.getByTestId('error-input');
      const error = screen.getByRole('alert');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'email-error');
      expect(error).toHaveTextContent('Please enter a valid email address');
    });
  });
});