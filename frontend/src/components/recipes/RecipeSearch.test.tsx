import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { RecipeSearch } from './RecipeSearch'
import { mockRecipeStore } from '@/test-utils'
import * as recipeStoreModule from '@/stores/recipeStore'
import * as debounceModule from '@/hooks/useDebounce'

// Mock the store and hooks
jest.mock('@/stores/recipeStore')
jest.mock('@/hooks/useDebounce')

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('RecipeSearch', () => {
  const mockSearchRecipes = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    
    // Setup default mocks
    ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
      ...mockRecipeStore,
      searchRecipes: mockSearchRecipes,
      recipes: [],
      loading: false,
    })
    
    // Mock debounce to execute immediately in tests
    ;(debounceModule.useDebounce as jest.Mock).mockImplementation((value) => value)
  })
  
  describe('Rendering', () => {
    it('renders search bar and controls', () => {
      render(<RecipeSearch />)
      
      expect(screen.getByPlaceholderText('Search recipes...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument() // Sort dropdown
      expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument()
    })
    
    it('loads saved preferences from localStorage', () => {
      const mockPresets = [{ id: '1', name: 'Vegetarian', filters: {}, createdAt: new Date() }]
      const mockHistory = ['pasta', 'salad', 'soup']
      
      localStorageMock.getItem.mockImplementation((key) => {
        switch (key) {
          case 'recipeFilterPresets':
            return JSON.stringify(mockPresets)
          case 'recipeSearchHistory':
            return JSON.stringify(mockHistory)
          case 'recipeViewMode':
            return 'list'
          default:
            return null
        }
      })
      
      render(<RecipeSearch />)
      
      // View mode should be list
      const listButton = screen.getByRole('button', { name: /list/i })
      expect(listButton).toHaveClass('bg-indigo-600')
    })
  })
  
  describe('Search Functionality', () => {
    const user = userEvent.setup()
    
    it('performs search on input', async () => {
      render(<RecipeSearch />)
      
      const searchInput = screen.getByPlaceholderText('Search recipes...')
      await user.type(searchInput, 'pasta')
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          'pasta',
          expect.any(Object),
          expect.any(String)
        )
      })
    })
    
    it('shows search suggestions', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'recipeSearchHistory') {
          return JSON.stringify(['pasta primavera', 'pasta carbonara', 'salad'])
        }
        return null
      })
      
      render(<RecipeSearch />)
      
      const searchInput = screen.getByPlaceholderText('Search recipes...')
      await user.click(searchInput)
      await user.type(searchInput, 'past')
      
      await waitFor(() => {
        expect(screen.getByText('Recent searches')).toBeInTheDocument()
        expect(screen.getByText('pasta primavera')).toBeInTheDocument()
        expect(screen.getByText('pasta carbonara')).toBeInTheDocument()
        expect(screen.queryByText('salad')).not.toBeInTheDocument() // Filtered out
      })
    })
    
    it('clears search input', async () => {
      render(<RecipeSearch />)
      
      const searchInput = screen.getByPlaceholderText('Search recipes...')
      await user.type(searchInput, 'pasta')
      
      expect(searchInput).toHaveValue('pasta')
      
      const clearButton = screen.getByRole('button', { name: '' })
      await user.click(clearButton)
      
      expect(searchInput).toHaveValue('')
      expect(mockSearchRecipes).toHaveBeenLastCalledWith('', expect.any(Object), expect.any(String))
    })
    
    it('saves search to history', async () => {
      render(<RecipeSearch />)
      
      const searchInput = screen.getByPlaceholderText('Search recipes...')
      await user.type(searchInput, 'new recipe')
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'recipeSearchHistory',
          expect.stringContaining('new recipe')
        )
      })
    })
  })
  
  describe('Filter Management', () => {
    const user = userEvent.setup()
    
    it('toggles filter panel', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      
      // Initially hidden
      expect(screen.queryByText('Categories')).not.toBeInTheDocument()
      
      // Click to show
      await user.click(filterButton)
      expect(screen.getByText('Categories')).toBeInTheDocument()
      
      // Click to hide
      await user.click(filterButton)
      await waitFor(() => {
        expect(screen.queryByText('Categories')).not.toBeInTheDocument()
      })
    })
    
    it('shows active filter count', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      // Select a category
      const breakfastCheckbox = screen.getByRole('checkbox', { name: /breakfast/i })
      await user.click(breakfastCheckbox)
      
      // Should show count badge
      expect(within(filterButton).getByText('1')).toBeInTheDocument()
    })
    
    it('applies category filters', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const breakfastCheckbox = screen.getByRole('checkbox', { name: /breakfast/i })
      const lunchCheckbox = screen.getByRole('checkbox', { name: /lunch/i })
      
      await user.click(breakfastCheckbox)
      await user.click(lunchCheckbox)
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            categories: ['breakfast', 'lunch']
          }),
          expect.any(String)
        )
      })
    })
    
    it('applies difficulty filters', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const easyCheckbox = screen.getByRole('checkbox', { name: /easy/i })
      await user.click(easyCheckbox)
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            difficulty: ['easy']
          }),
          expect.any(String)
        )
      })
    })
    
    it('applies dietary filters', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const veganCheckbox = screen.getByRole('checkbox', { name: /vegan/i })
      await user.click(veganCheckbox)
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            dietary: ['vegan']
          }),
          expect.any(String)
        )
      })
    })
    
    it('applies time range filters', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      // Find prep time sliders
      const sliders = screen.getAllByRole('slider')
      const prepTimeMinSlider = sliders[0]
      const prepTimeMaxSlider = sliders[1]
      
      fireEvent.change(prepTimeMinSlider, { target: { value: '10' } })
      fireEvent.change(prepTimeMaxSlider, { target: { value: '30' } })
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            prepTimeRange: [10, 30]
          }),
          expect.any(String)
        )
      })
    })
    
    it('manages included ingredients', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const includeInput = screen.getAllByPlaceholderText('Add ingredient...')[0]
      await user.type(includeInput, 'tomato')
      await user.keyboard('{Enter}')
      
      // Should show ingredient chip
      expect(screen.getByText('tomato')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            includedIngredients: ['tomato']
          }),
          expect.any(String)
        )
      })
      
      // Remove ingredient
      const removeButton = within(screen.getByText('tomato').parentElement!).getByRole('button')
      await user.click(removeButton)
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            includedIngredients: []
          }),
          expect.any(String)
        )
      })
    })
    
    it('manages excluded ingredients', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const excludeInput = screen.getAllByPlaceholderText('Add ingredient...')[1]
      await user.type(excludeInput, 'nuts')
      
      const addButton = screen.getAllByText('Add')[1]
      await user.click(addButton)
      
      // Should show ingredient chip
      expect(screen.getByText('nuts')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            excludedIngredients: ['nuts']
          }),
          expect.any(String)
        )
      })
    })
    
    it('clears all filters', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      // Apply some filters
      const breakfastCheckbox = screen.getByRole('checkbox', { name: /breakfast/i })
      await user.click(breakfastCheckbox)
      
      // Clear all
      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await user.click(clearButton)
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenLastCalledWith(
          '',
          {},
          expect.any(String)
        )
      })
    })
  })
  
  describe('Filter Presets', () => {
    const user = userEvent.setup()
    
    it('saves filter preset', async () => {
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      // Apply some filters
      const breakfastCheckbox = screen.getByRole('checkbox', { name: /breakfast/i })
      await user.click(breakfastCheckbox)
      
      // Save preset
      const saveButton = screen.getByRole('button', { name: /save current/i })
      await user.click(saveButton)
      
      // Modal should appear
      expect(screen.getByText('Save Filter Preset')).toBeInTheDocument()
      
      const presetNameInput = screen.getByPlaceholderText('Preset name...')
      await user.type(presetNameInput, 'Breakfast Only')
      
      const savePresetButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(savePresetButton)
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'recipeFilterPresets',
          expect.stringContaining('Breakfast Only')
        )
      })
    })
    
    it('loads filter preset', async () => {
      const mockPresets = [{
        id: '1',
        name: 'Vegetarian',
        filters: {
          dietary: ['vegetarian'],
          categories: ['lunch', 'dinner']
        },
        createdAt: new Date()
      }]
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'recipeFilterPresets') {
          return JSON.stringify(mockPresets)
        }
        return null
      })
      
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      // Click preset
      const presetButton = screen.getByRole('button', { name: /vegetarian/i })
      await user.click(presetButton)
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            dietary: ['vegetarian'],
            categories: ['lunch', 'dinner']
          }),
          expect.any(String)
        )
      })
    })
    
    it('deletes filter preset', async () => {
      const mockPresets = [{
        id: '1',
        name: 'Vegetarian',
        filters: {},
        createdAt: new Date()
      }]
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'recipeFilterPresets') {
          return JSON.stringify(mockPresets)
        }
        return null
      })
      
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      // Delete preset
      const deleteButton = within(screen.getByText('Vegetarian').parentElement!).getAllByRole('button')[1]
      await user.click(deleteButton)
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'recipeFilterPresets',
          '[]'
        )
      })
    })
  })
  
  describe('Sorting and View Mode', () => {
    const user = userEvent.setup()
    
    it('changes sort order', async () => {
      render(<RecipeSearch />)
      
      const sortSelect = screen.getByRole('combobox')
      await user.selectOptions(sortSelect, 'rating')
      
      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledWith(
          '',
          expect.any(Object),
          'rating'
        )
      })
    })
    
    it('toggles view mode', async () => {
      render(<RecipeSearch />)
      
      const gridButton = screen.getByRole('button', { name: /grid/i })
      const listButton = screen.getByRole('button', { name: /list/i })
      
      // Initially grid is active
      expect(gridButton).toHaveClass('bg-indigo-600')
      expect(listButton).not.toHaveClass('bg-indigo-600')
      
      // Switch to list
      await user.click(listButton)
      
      expect(gridButton).not.toHaveClass('bg-indigo-600')
      expect(listButton).toHaveClass('bg-indigo-600')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('recipeViewMode', 'list')
    })
  })
  
  describe('Loading and Error States', () => {
    it('shows loading spinner', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        loading: true,
        recipes: [],
      })
      
      render(<RecipeSearch />)
      
      expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
    })
    
    it('shows no results message', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        loading: false,
        recipes: [],
      })
      
      render(<RecipeSearch />)
      
      expect(screen.getByText('No recipes found matching your criteria')).toBeInTheDocument()
    })
  })
  
  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<RecipeSearch />)
      
      expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search recipes...')
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
    
    it('announces filter changes to screen readers', async () => {
      const user = userEvent.setup()
      render(<RecipeSearch />)
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const breakfastCheckbox = screen.getByRole('checkbox', { name: /breakfast/i })
      await user.click(breakfastCheckbox)
      
      // Filter chip should be visible
      expect(screen.getByText('breakfast')).toBeInTheDocument()
    })
  })
})