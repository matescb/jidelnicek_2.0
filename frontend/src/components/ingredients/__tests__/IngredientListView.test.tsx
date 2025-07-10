import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../../test-utils/testUtils';
import userEvent from '@testing-library/user-event';
import { IngredientListView } from '../IngredientListView';
import { useIngredientStore } from '@/store/slices/ingredientStore';
import { useToastStore } from '@/store/slices/toastStore';
import { createMockIngredient } from '../../../test-utils/testUtils';

// Mock dependencies
jest.mock('@/store/slices/ingredientStore');
jest.mock('@/store/slices/toastStore');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Mock UI components
jest.mock('@/components/ui/MultiSelect', () => ({
  MultiSelect: ({ options, value, onChange, placeholder }: any) => (
    <select
      multiple
      value={value}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
        onChange(selected);
      }}
      data-testid={`multiselect-${placeholder?.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}));

const mockIngredients = [
  createMockIngredient({ 
    id: '1', 
    name: 'Tomato',
    category: 'Vegetables',
    usageCount: 15,
    allergens: [],
    dietaryTags: ['Vegan', 'Gluten-Free']
  }),
  createMockIngredient({ 
    id: '2', 
    name: 'Chicken Breast',
    category: 'Meat',
    usageCount: 20,
    price: 8.99,
    allergens: [],
    dietaryTags: []
  }),
  createMockIngredient({ 
    id: '3', 
    name: 'Wheat Flour',
    category: 'Grains',
    usageCount: 5,
    allergens: ['Gluten'],
    dietaryTags: ['Vegetarian']
  })
];

describe('IngredientListView', () => {
  const user = userEvent.setup();
  const mockAddToast = jest.fn();
  
  const defaultStoreState = {
    ingredients: mockIngredients,
    loading: false,
    error: null,
    filters: {},
    sortBy: 'name',
    sortOrder: 'asc',
    categories: ['Vegetables', 'Meat', 'Grains', 'Dairy'],
    allergens: ['Gluten', 'Dairy', 'Nuts', 'Eggs'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free'],
    potentialDuplicates: new Map([['1', ['4', '5']]]),
    fetchIngredients: jest.fn(),
    fetchCategories: jest.fn(),
    fetchAllergens: jest.fn(),
    fetchDietaryTags: jest.fn(),
    setFilters: jest.fn(),
    setSorting: jest.fn(),
    clearFilters: jest.fn(),
    deleteIngredient: jest.fn(),
    mergeIngredients: jest.fn(),
    exportIngredients: jest.fn(),
    importIngredients: jest.fn(),
    findDuplicates: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useIngredientStore as any).mockReturnValue(defaultStoreState);
    (useToastStore as any).mockReturnValue({ addToast: mockAddToast });
    
    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });
    window.confirm = jest.fn(() => true);
    window.prompt = jest.fn(() => '4');
  });

  describe('Initial Load and Rendering', () => {
    it('fetches all required data on mount', () => {
      const fetchIngredients = jest.fn();
      const fetchCategories = jest.fn();
      const fetchAllergens = jest.fn();
      const fetchDietaryTags = jest.fn();

      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchIngredients,
        fetchCategories,
        fetchAllergens,
        fetchDietaryTags
      });

      render(<IngredientListView />);

      expect(fetchIngredients).toHaveBeenCalled();
      expect(fetchCategories).toHaveBeenCalled();
      expect(fetchAllergens).toHaveBeenCalled();
      expect(fetchDietaryTags).toHaveBeenCalled();
    });

    it('renders ingredients in grouped view by default', () => {
      render(<IngredientListView />);

      expect(screen.getByText('Ingredients')).toBeInTheDocument();
      expect(screen.getByText('Vegetables')).toBeInTheDocument();
      expect(screen.getByText('Meat')).toBeInTheDocument();
      expect(screen.getByText('Grains')).toBeInTheDocument();
      
      // Check ingredient names
      expect(screen.getByText('Tomato')).toBeInTheDocument();
      expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
      expect(screen.getByText('Wheat Flour')).toBeInTheDocument();
    });

    it('shows category counts in badges', () => {
      render(<IngredientListView />);

      // Each category should show count
      const vegetableSection = screen.getByText('Vegetables').closest('div');
      expect(within(vegetableSection!).getByText('1')).toBeInTheDocument();
    });

    it('displays nutrition information', () => {
      render(<IngredientListView />);

      // Check nutrition data format
      expect(screen.getByText(/Cal: 100/)).toBeInTheDocument();
      expect(screen.getByText(/P: 5g/)).toBeInTheDocument();
      expect(screen.getByText(/C: 20g/)).toBeInTheDocument();
      expect(screen.getByText(/F: 2g/)).toBeInTheDocument();
    });

    it('shows usage count with icon', () => {
      render(<IngredientListView />);

      expect(screen.getByText('15')).toBeInTheDocument(); // Tomato usage
      expect(screen.getByText('20')).toBeInTheDocument(); // Chicken usage
    });

    it('displays price when available', () => {
      render(<IngredientListView />);

      expect(screen.getByText('8.99 per kg')).toBeInTheDocument();
    });

    it('shows allergen badges', () => {
      render(<IngredientListView />);

      const glutenBadge = screen.getByText('Gluten');
      expect(glutenBadge).toBeInTheDocument();
      expect(glutenBadge.closest('.badge')).toHaveClass('variant-danger');
    });

    it('shows dietary tag badges', () => {
      render(<IngredientListView />);

      expect(screen.getByText('Vegan')).toBeInTheDocument();
      expect(screen.getByText('Gluten-Free')).toBeInTheDocument();
      expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    });
  });

  describe('View Switching', () => {
    it('switches between grouped and ungrouped views', async () => {
      render(<IngredientListView />);

      // Initially in grouped view
      expect(screen.getByText('Ungrouped View')).toBeInTheDocument();

      // Switch to ungrouped
      await user.click(screen.getByText('Ungrouped View'));

      // Should now show grouped view button
      expect(screen.getByText('Group by Category')).toBeInTheDocument();
      
      // Should have single table
      const tables = screen.getAllByRole('table');
      expect(tables).toHaveLength(1);
    });

    it('maintains data when switching views', async () => {
      render(<IngredientListView />);

      // Switch to ungrouped
      await user.click(screen.getByText('Ungrouped View'));

      // All ingredients should still be visible
      expect(screen.getByText('Tomato')).toBeInTheDocument();
      expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
      expect(screen.getByText('Wheat Flour')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('toggles filter panel', async () => {
      render(<IngredientListView />);

      // Filters hidden initially
      expect(screen.queryByPlaceholderText('Search ingredients...')).not.toBeInTheDocument();

      // Show filters
      await user.click(screen.getByText('Filters'));

      // Filters should be visible
      expect(screen.getByPlaceholderText('Search ingredients...')).toBeInTheDocument();
    });

    it('filters by search term', async () => {
      const setFilters = jest.fn();
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<IngredientListView />);

      await user.click(screen.getByText('Filters'));
      const searchInput = screen.getByPlaceholderText('Search ingredients...');
      
      await user.type(searchInput, 'tomato');

      expect(setFilters).toHaveBeenCalledWith({ search: 'tomato' });
    });

    it('filters by categories', async () => {
      const setFilters = jest.fn();
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<IngredientListView />);

      await user.click(screen.getByText('Filters'));
      
      const categorySelect = screen.getByTestId('multiselect-categories');
      await user.selectOptions(categorySelect, ['Vegetables', 'Meat']);

      expect(setFilters).toHaveBeenCalledWith({ 
        category: ['Vegetables', 'Meat'] 
      });
    });

    it('filters by allergens', async () => {
      const setFilters = jest.fn();
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<IngredientListView />);

      await user.click(screen.getByText('Filters'));
      
      const allergenSelect = screen.getByTestId('multiselect-allergens');
      await user.selectOptions(allergenSelect, ['Gluten']);

      expect(setFilters).toHaveBeenCalledWith({ 
        allergens: ['Gluten'] 
      });
    });

    it('filters by dietary tags', async () => {
      const setFilters = jest.fn();
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<IngredientListView />);

      await user.click(screen.getByText('Filters'));
      
      const dietarySelect = screen.getByTestId('multiselect-dietary-tags');
      await user.selectOptions(dietarySelect, ['Vegan', 'Gluten-Free']);

      expect(setFilters).toHaveBeenCalledWith({ 
        dietaryTags: ['Vegan', 'Gluten-Free'] 
      });
    });

    it('clears all filters', async () => {
      const clearFilters = jest.fn();
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        filters: { search: 'test', category: ['Vegetables'] },
        clearFilters
      });

      render(<IngredientListView />);

      await user.click(screen.getByText('Filters'));
      await user.click(screen.getByText('Clear Filters'));

      expect(clearFilters).toHaveBeenCalled();
    });
  });

  describe('Ingredient Actions', () => {
    it('navigates to ingredient detail view', async () => {
      render(<IngredientListView />);

      const viewButton = screen.getAllByTitle('View details')[0];
      await user.click(viewButton);

      expect(window.location.href).toBe('/ingredients/1');
    });

    it('navigates to edit page', async () => {
      render(<IngredientListView />);

      const editButton = screen.getAllByTitle('Edit')[0];
      await user.click(editButton);

      expect(window.location.href).toBe('/ingredients/1/edit');
    });

    it('deletes ingredient with confirmation', async () => {
      const deleteIngredient = jest.fn().mockResolvedValue(undefined);
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteIngredient
      });

      render(<IngredientListView />);

      const deleteButton = screen.getAllByTitle('Delete')[0];
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "Tomato"?'
      );

      await waitFor(() => {
        expect(deleteIngredient).toHaveBeenCalledWith('1');
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Ingredient "Tomato" deleted successfully'
        });
      });
    });

    it('cancels deletion when user declines', async () => {
      window.confirm = jest.fn(() => false);
      const deleteIngredient = jest.fn();
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteIngredient
      });

      render(<IngredientListView />);

      const deleteButton = screen.getAllByTitle('Delete')[0];
      await user.click(deleteButton);

      expect(deleteIngredient).not.toHaveBeenCalled();
    });

    it('navigates to add new ingredient', async () => {
      render(<IngredientListView />);

      const addButton = screen.getByText('Add Ingredient');
      await user.click(addButton);

      expect(window.location.href).toBe('/ingredients/new');
    });
  });

  describe('Duplicate Detection and Merging', () => {
    it('shows duplicate indicator badge', () => {
      render(<IngredientListView />);

      const tomatoRow = screen.getByText('Tomato').closest('tr');
      expect(within(tomatoRow!).getByText('Duplicate')).toBeInTheDocument();
    });

    it('shows merge button for duplicates', () => {
      render(<IngredientListView />);

      const mergeButtons = screen.getAllByTitle('Merge duplicate');
      expect(mergeButtons).toHaveLength(1); // Only tomato has duplicates
    });

    it('handles duplicate merging', async () => {
      const mergeIngredients = jest.fn().mockResolvedValue(undefined);
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        mergeIngredients
      });

      render(<IngredientListView />);

      const mergeButton = screen.getByTitle('Merge duplicate');
      await user.click(mergeButton);

      expect(window.prompt).toHaveBeenCalledWith(
        'Select target ingredient ID to merge into (4, 5)'
      );

      await waitFor(() => {
        expect(mergeIngredients).toHaveBeenCalledWith('1', '4');
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Ingredients merged successfully'
        });
      });
    });

    it('finds duplicates manually', async () => {
      const findDuplicates = jest.fn().mockResolvedValue(undefined);
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        findDuplicates
      });

      render(<IngredientListView />);

      const findDuplicatesButton = screen.getByText('Find Duplicates');
      await user.click(findDuplicatesButton);

      await waitFor(() => {
        expect(findDuplicates).toHaveBeenCalled();
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'info',
          title: 'Found 1 potential duplicates'
        });
      });
    });

    it('shows no duplicates message when none found', async () => {
      const findDuplicates = jest.fn().mockResolvedValue(undefined);
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        potentialDuplicates: new Map(),
        findDuplicates
      });

      render(<IngredientListView />);

      const findDuplicatesButton = screen.getByText('Find Duplicates');
      await user.click(findDuplicatesButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'No duplicates found'
        });
      });
    });
  });

  describe('Import/Export', () => {
    it('handles CSV export', async () => {
      const exportIngredients = jest.fn().mockResolvedValue(undefined);
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        exportIngredients
      });

      render(<IngredientListView />);

      const exportCSVButton = screen.getByText('Export CSV');
      await user.click(exportCSVButton);

      await waitFor(() => {
        expect(exportIngredients).toHaveBeenCalledWith('csv', true);
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Exported ingredients as CSV'
        });
      });
    });

    it('handles JSON export', async () => {
      const exportIngredients = jest.fn().mockResolvedValue(undefined);
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        exportIngredients
      });

      render(<IngredientListView />);

      const exportJSONButton = screen.getByText('Export JSON');
      await user.click(exportJSONButton);

      await waitFor(() => {
        expect(exportIngredients).toHaveBeenCalledWith('json', true);
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Exported ingredients as JSON'
        });
      });
    });

    it('handles file import selection', async () => {
      render(<IngredientListView />);

      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      const file = new File(['test'], 'ingredients.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      });

      fireEvent.change(fileInput);

      // Should show file name and upload button
      expect(screen.getByText('ingredients.csv')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });

    it('handles import with success and errors', async () => {
      const importIngredients = jest.fn().mockResolvedValue({
        imported: 10,
        errors: ['Error on line 5', 'Invalid data on line 8']
      });
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        importIngredients
      });

      render(<IngredientListView />);

      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      const file = new File(['test'], 'ingredients.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      });

      fireEvent.change(fileInput);

      const uploadButton = screen.getByText('Upload');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(importIngredients).toHaveBeenCalledWith(file);
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Imported 10 ingredients successfully'
        });
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'warning',
          title: '2 ingredients failed to import'
        });
      });
    });
  });

  describe('Selection and Batch Operations', () => {
    it('handles individual selection in grouped view', async () => {
      render(<IngredientListView />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Select first ingredient

      // Selected ingredient should be tracked
      // In real implementation, this would be reflected in UI
      expect(checkboxes[0]).toBeChecked();
    });

    it('maintains selection across view switches', async () => {
      render(<IngredientListView />);

      // Select an ingredient
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      // Switch view
      await user.click(screen.getByText('Ungrouped View'));

      // Selection should persist
      const newCheckboxes = screen.getAllByRole('checkbox');
      expect(newCheckboxes[1]).toBeChecked(); // Account for select-all checkbox
    });
  });

  describe('Error Handling', () => {
    it('handles delete errors gracefully', async () => {
      const deleteIngredient = jest.fn().mockRejectedValue(new Error('Delete failed'));
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteIngredient
      });

      render(<IngredientListView />);

      const deleteButton = screen.getAllByTitle('Delete')[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'error',
          title: 'Failed to delete ingredient'
        });
      });
    });

    it('handles merge errors gracefully', async () => {
      const mergeIngredients = jest.fn().mockRejectedValue(new Error('Merge failed'));
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        mergeIngredients
      });

      render(<IngredientListView />);

      const mergeButton = screen.getByTitle('Merge duplicate');
      await user.click(mergeButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'error',
          title: 'Failed to merge ingredients'
        });
      });
    });

    it('handles export errors gracefully', async () => {
      const exportIngredients = jest.fn().mockRejectedValue(new Error('Export failed'));
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        exportIngredients
      });

      render(<IngredientListView />);

      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'error',
          title: 'Failed to export ingredients'
        });
      });
    });

    it('handles import errors gracefully', async () => {
      const importIngredients = jest.fn().mockRejectedValue(new Error('Import failed'));
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        importIngredients
      });

      render(<IngredientListView />);

      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      const file = new File(['test'], 'ingredients.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      });

      fireEvent.change(fileInput);

      const uploadButton = screen.getByText('Upload');
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'error',
          title: 'Failed to import ingredients'
        });
      });
    });

    it('handles find duplicates errors gracefully', async () => {
      const findDuplicates = jest.fn().mockRejectedValue(new Error('Search failed'));
      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        findDuplicates
      });

      render(<IngredientListView />);

      const findButton = screen.getByText('Find Duplicates');
      await user.click(findButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          variant: 'error',
          title: 'Failed to find duplicates'
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles ingredients without categories', () => {
      const ingredientsWithoutCategory = [
        createMockIngredient({ id: '1', name: 'Test', category: null })
      ];

      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        ingredients: ingredientsWithoutCategory
      });

      render(<IngredientListView />);

      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    it('handles null nutrition values', () => {
      const ingredientWithNullNutrition = [
        createMockIngredient({ 
          id: '1', 
          name: 'Test',
          nutrition: { calories: null, protein: null, carbs: null, fat: null }
        })
      ];

      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        ingredients: ingredientWithNullNutrition
      });

      render(<IngredientListView />);

      expect(screen.getByText('Cal: 0')).toBeInTheDocument();
      expect(screen.getByText('P: 0g')).toBeInTheDocument();
    });

    it('handles missing price gracefully', () => {
      const ingredientWithoutPrice = [
        createMockIngredient({ id: '1', name: 'Test', price: null })
      ];

      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        ingredients: ingredientWithoutPrice
      });

      render(<IngredientListView />);

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('handles empty allergens and dietary tags', () => {
      const ingredientWithoutTags = [
        createMockIngredient({ 
          id: '1', 
          name: 'Test',
          allergens: [],
          dietaryTags: []
        })
      ];

      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        ingredients: ingredientWithoutTags
      });

      render(<IngredientListView />);

      // Should render without crashing, badges won't be shown
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => 
        createMockIngredient({ 
          id: String(i), 
          name: `Ingredient ${i}`,
          category: ['Vegetables', 'Meat', 'Grains'][i % 3]
        })
      );

      (useIngredientStore as any).mockReturnValue({
        ...defaultStoreState,
        ingredients: largeDataset
      });

      const { container } = render(<IngredientListView />);

      // Should render all categories
      expect(screen.getByText('Vegetables')).toBeInTheDocument();
      expect(screen.getByText('Meat')).toBeInTheDocument();
      expect(screen.getByText('Grains')).toBeInTheDocument();

      // Should have appropriate page size options
      const tables = container.querySelectorAll('table');
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<IngredientListView />);

      const mainHeading = screen.getByRole('heading', { name: 'Ingredients' });
      expect(mainHeading).toBeInTheDocument();

      // Category headings
      const categoryHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(categoryHeadings.length).toBeGreaterThan(0);
    });

    it('provides accessible form controls', () => {
      render(<IngredientListView />);

      // Buttons should have descriptive text
      expect(screen.getByText('Add Ingredient')).toBeInTheDocument();
      expect(screen.getByText('Find Duplicates')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('has accessible table structure', () => {
      render(<IngredientListView />);

      const tables = screen.getAllByRole('table');
      expect(tables.length).toBeGreaterThan(0);

      // Check for column headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Unit')).toBeInTheDocument();
    });
  });
});