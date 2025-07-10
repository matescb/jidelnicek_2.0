import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../../test-utils/testUtils';
import userEvent from '@testing-library/user-event';
import { RecipeListView } from '../RecipeListView';
import { useRecipeStore } from '@/store/slices/recipeStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useToast } from '@/hooks/useToast';
import { createMockRecipe } from '../../../test-utils/testUtils';

// Mock dependencies
jest.mock('@/store/slices/recipeStore');
jest.mock('@/hooks/useBreakpoint');
jest.mock('@/hooks/useToast');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Mock components that might not be available in tests
jest.mock('../RecipeCard', () => ({
  RecipeCard: ({ recipe, onClick, onToggleFavorite, selected, onSelect, showCheckbox, actions }: any) => (
    <div data-testid={`recipe-card-${recipe.id}`}>
      <h3>{recipe.name}</h3>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          data-testid={`recipe-checkbox-${recipe.id}`}
        />
      )}
      <button onClick={() => onToggleFavorite(recipe.id)}>Toggle Favorite</button>
      <button onClick={onClick}>View Recipe</button>
      {actions}
    </div>
  )
}));

jest.mock('../RecipeFiltersAdvanced', () => ({
  RecipeFiltersAdvanced: ({ filters, onFiltersChange }: any) => (
    <div data-testid="recipe-filters">
      <input
        placeholder="Search recipes"
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
      />
      <button onClick={() => onFiltersChange({})}>Clear Filters</button>
    </div>
  )
}));

jest.mock('@/components/ui/DataTable', () => ({
  DataTable: ({ data, columns, onRowClick, mobileRenderItem }: any) => (
    <div data-testid="data-table">
      <table>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.key}>{typeof col.header === 'string' ? col.header : 'Select'}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any) => (
            <tr key={item.id} onClick={() => onRowClick?.(item)}>
              {columns.map((col: any) => (
                <td key={col.key}>
                  {col.accessor ? col.accessor(item) : item[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}));

const mockRecipes = [
  createMockRecipe({ id: '1', name: 'Pasta Carbonara', prepTime: 20, servings: 4 }),
  createMockRecipe({ id: '2', name: 'Caesar Salad', prepTime: 15, servings: 2 }),
  createMockRecipe({ id: '3', name: 'Chocolate Cake', prepTime: 45, servings: 8 })
];

describe('RecipeListView', () => {
  const user = userEvent.setup();
  const mockNavigate = jest.fn();
  const mockToast = jest.fn();
  
  const defaultStoreState = {
    recipes: mockRecipes,
    loading: false,
    error: null,
    pagination: {
      currentPage: 1,
      totalItems: 3,
      pageSize: 10,
      totalPages: 1
    },
    filters: {},
    sortBy: 'name',
    sortOrder: 'asc',
    favorites: ['1'],
    fetchRecipes: jest.fn(),
    setFilters: jest.fn(),
    setSorting: jest.fn(),
    toggleFavorite: jest.fn(),
    deleteRecipe: jest.fn(),
    duplicateRecipe: jest.fn(),
    clearError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRecipeStore as any).mockReturnValue(defaultStoreState);
    (useBreakpoint as any).mockReturnValue('lg');
    (useToast as any).mockReturnValue({ toast: mockToast });
    
    // Mock useNavigate
    const { useNavigate } = require('react-router-dom');
    useNavigate.mockReturnValue(mockNavigate);
  });

  describe('Rendering', () => {
    it('renders recipe list with all components', () => {
      render(<RecipeListView />);

      expect(screen.getByText('Recipes')).toBeInTheDocument();
      expect(screen.getByText(/Showing 3 of 3 recipes/)).toBeInTheDocument();
      expect(screen.getByTestId('recipe-filters')).toBeInTheDocument();
    });

    it('renders in grid view by default', () => {
      render(<RecipeListView />);

      mockRecipes.forEach(recipe => {
        expect(screen.getByTestId(`recipe-card-${recipe.id}`)).toBeInTheDocument();
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
    });

    it('switches between view modes', async () => {
      render(<RecipeListView />);

      // Switch to list view
      const listButton = screen.getByRole('button', { name: /list/i });
      await user.click(listButton);

      // Verify list view is active
      mockRecipes.forEach(recipe => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });

      // Switch to table view
      const tableButton = screen.getByRole('button', { name: /table/i });
      await user.click(tableButton);

      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        loading: true,
        recipes: []
      });

      render(<RecipeListView />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows empty state when no recipes', () => {
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        recipes: []
      });

      render(<RecipeListView />);
      expect(screen.getByText('No recipes found')).toBeInTheDocument();
    });

    it('shows filtered empty state with clear button', () => {
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        recipes: [],
        filters: { search: 'test' }
      });

      render(<RecipeListView />);
      expect(screen.getByText('No recipes match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });
  });

  describe('Recipe Actions', () => {
    it('handles recipe click navigation', async () => {
      render(<RecipeListView />);

      const viewButton = screen.getAllByText('View Recipe')[0];
      await user.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/recipes/1');
    });

    it('calls custom onRecipeSelect when provided', async () => {
      const onRecipeSelect = jest.fn();
      render(<RecipeListView onRecipeSelect={onRecipeSelect} />);

      const viewButton = screen.getAllByText('View Recipe')[0];
      await user.click(viewButton);

      expect(onRecipeSelect).toHaveBeenCalledWith(mockRecipes[0]);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('toggles favorite status', async () => {
      const toggleFavorite = jest.fn().mockResolvedValue(undefined);
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        toggleFavorite
      });

      render(<RecipeListView />);

      const favoriteButtons = screen.getAllByText('Toggle Favorite');
      await user.click(favoriteButtons[0]);

      expect(toggleFavorite).toHaveBeenCalledWith('1');
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Removed from favorites'
        });
      });
    });

    it('handles recipe edit navigation', async () => {
      render(<RecipeListView />);

      // Open dropdown menu for first recipe
      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith('/recipes/1/edit');
    });

    it('handles recipe duplication', async () => {
      const duplicateRecipe = jest.fn().mockResolvedValue({ 
        ...mockRecipes[0], 
        id: '4', 
        name: 'Pasta Carbonara (Copy)' 
      });
      
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        duplicateRecipe
      });

      render(<RecipeListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const duplicateButton = screen.getByText('Duplicate');
      await user.click(duplicateButton);

      await waitFor(() => {
        expect(duplicateRecipe).toHaveBeenCalledWith('1');
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Recipe duplicated',
          description: 'Recipe "Pasta Carbonara (Copy)" has been duplicated'
        });
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/4/edit');
      });
    });

    it('handles recipe deletion with confirmation', async () => {
      const deleteRecipe = jest.fn().mockResolvedValue(undefined);
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteRecipe
      });

      window.confirm = jest.fn(() => true);

      render(<RecipeListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "Pasta Carbonara"?'
      );
      
      await waitFor(() => {
        expect(deleteRecipe).toHaveBeenCalledWith('1');
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Recipe deleted',
          description: 'Recipe "Pasta Carbonara" has been deleted'
        });
      });
    });

    it('cancels deletion when user declines', async () => {
      const deleteRecipe = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteRecipe
      });

      window.confirm = jest.fn(() => false);

      render(<RecipeListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(deleteRecipe).not.toHaveBeenCalled();
    });

    it('navigates to trip planning with recipe', async () => {
      render(<RecipeListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const addToTripButton = screen.getByText('Add to Trip');
      await user.click(addToTripButton);

      expect(mockNavigate).toHaveBeenCalledWith('/trips/new', { 
        state: { selectedRecipeId: '1' } 
      });
    });
  });

  describe('Batch Operations', () => {
    it('shows batch operations when recipes are selected', async () => {
      render(<RecipeListView />);

      // Select first two recipes
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('handles batch export', async () => {
      // Mock URL and document methods
      const mockCreateElement = document.createElement.bind(document);
      const mockAnchor = { click: jest.fn(), href: '', download: '' };
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'a') return mockAnchor as any;
        return mockCreateElement(tagName);
      });
      global.URL.createObjectURL = jest.fn(() => 'blob:mock');
      global.URL.revokeObjectURL = jest.fn();

      render(<RecipeListView />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('recipes-export');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Recipes exported',
        description: '2 recipes exported successfully'
      });

      // Restore
      document.createElement = mockCreateElement;
    });

    it('handles batch delete with confirmation', async () => {
      const deleteRecipe = jest.fn().mockResolvedValue(undefined);
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteRecipe
      });

      window.confirm = jest.fn(() => true);

      render(<RecipeListView />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete 2 recipes?'
      );

      await waitFor(() => {
        expect(deleteRecipe).toHaveBeenCalledTimes(2);
        expect(deleteRecipe).toHaveBeenCalledWith('1');
        expect(deleteRecipe).toHaveBeenCalledWith('2');
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Recipes deleted',
          description: '2 recipes deleted successfully'
        });
      });
    });

    it('hides batch operations when disabled', () => {
      render(<RecipeListView allowBatchOperations={false} />);

      // Checkboxes should not be visible
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    it('fetches recipes on mount', () => {
      const fetchRecipes = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchRecipes
      });

      render(<RecipeListView />);
      expect(fetchRecipes).toHaveBeenCalledWith(1);
    });

    it('applies initial filters', () => {
      const setFilters = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      const initialFilters = { category: 'Dessert', search: 'cake' };
      render(<RecipeListView initialFilters={initialFilters} />);

      expect(setFilters).toHaveBeenCalledWith(initialFilters);
    });

    it('updates filters through search', async () => {
      const setFilters = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<RecipeListView />);

      const searchInput = screen.getByPlaceholderText('Search recipes');
      await user.type(searchInput, 'pasta');

      expect(setFilters).toHaveBeenCalledWith({ search: 'pasta' });
    });

    it('clears filters', async () => {
      const setFilters = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        filters: { search: 'test', category: 'Main' },
        setFilters
      });

      render(<RecipeListView />);

      const clearButton = screen.getByText('Clear Filters');
      await user.click(clearButton);

      expect(setFilters).toHaveBeenCalledWith({});
    });

    it('handles sorting changes', async () => {
      const setSorting = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        setSorting
      });

      render(<RecipeListView />);

      // Find and interact with sort selector
      const sortSelector = screen.getByRole('combobox');
      await user.selectOptions(sortSelector, 'rating');

      expect(setSorting).toHaveBeenCalledWith('rating', expect.any(String));
    });

    it('hides filters when showFilters is false', () => {
      render(<RecipeListView showFilters={false} />);
      
      expect(screen.queryByTestId('recipe-filters')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays and clears errors', async () => {
      const clearError = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        error: 'Failed to load recipes',
        clearError
      });

      render(<RecipeListView />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Something went wrong',
          description: 'Failed to load recipes',
          variant: 'destructive'
        });
        expect(clearError).toHaveBeenCalled();
      });
    });

    it('handles favorite toggle errors gracefully', async () => {
      const toggleFavorite = jest.fn().mockRejectedValue(new Error('Network error'));
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        toggleFavorite
      });

      render(<RecipeListView />);

      const favoriteButtons = screen.getAllByText('Toggle Favorite');
      await user.click(favoriteButtons[0]);

      await waitFor(() => {
        expect(toggleFavorite).toHaveBeenCalledWith('1');
        // Error should be handled by the store
      });
    });

    it('handles duplication errors gracefully', async () => {
      const duplicateRecipe = jest.fn().mockRejectedValue(new Error('Duplication failed'));
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        duplicateRecipe
      });

      render(<RecipeListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const duplicateButton = screen.getByText('Duplicate');
      await user.click(duplicateButton);

      await waitFor(() => {
        expect(duplicateRecipe).toHaveBeenCalledWith('1');
        // Error should be handled by the store
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts grid columns based on breakpoint', () => {
      const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
      const expectedColumns = [1, 2, 3, 4, 4, 4];

      breakpoints.forEach((breakpoint, index) => {
        (useBreakpoint as any).mockReturnValue(breakpoint);
        
        const { container } = render(<RecipeListView />);
        
        // Check for grid column class
        const gridContainer = container.querySelector(`.grid-cols-${expectedColumns[index]}`);
        expect(gridContainer).toBeInTheDocument();
        
        // Clean up for next iteration
        container.remove();
      });
    });

    it('shows mobile-optimized list in list view', () => {
      (useBreakpoint as any).mockReturnValue('xs');
      
      render(<RecipeListView />);

      // Switch to list view
      const listButton = screen.getByRole('button', { name: /list/i });
      fireEvent.click(listButton);

      // Mobile list items should show compact info
      mockRecipes.forEach(recipe => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
        expect(screen.getByText(`${recipe.prepTime}m`)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('fetches new page when pagination changes', () => {
      const fetchRecipes = jest.fn();
      (useRecipeStore as any).mockReturnValue({
        ...defaultStoreState,
        pagination: {
          currentPage: 1,
          totalItems: 30,
          pageSize: 10,
          totalPages: 3
        },
        fetchRecipes
      });

      render(<RecipeListView />);

      // Find and click next page
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(fetchRecipes).toHaveBeenCalledWith(2);
    });
  });

  describe('Custom Actions', () => {
    it('renders custom actions when provided', () => {
      const customActions = (recipe: any) => (
        <button data-testid={`custom-action-${recipe.id}`}>
          Custom Action
        </button>
      );

      render(<RecipeListView customActions={customActions} />);

      mockRecipes.forEach(recipe => {
        expect(screen.getByTestId(`custom-action-${recipe.id}`)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible navigation elements', () => {
      render(<RecipeListView />);

      expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Recipe' })).toBeInTheDocument();
    });

    it('provides keyboard navigation for view mode selection', async () => {
      render(<RecipeListView />);

      const gridButton = screen.getByRole('button', { name: /grid/i });
      const listButton = screen.getByRole('button', { name: /list/i });

      // Tab to grid button and activate
      gridButton.focus();
      expect(document.activeElement).toBe(gridButton);

      // Tab to list button
      await user.tab();
      expect(document.activeElement).toBe(listButton);
    });
  });
});