import React from 'react'
import { render, screen, waitFor } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { useNavigate, useParams } from 'react-router-dom'
import RecipeEditPage from './RecipeEditPage'
import { createMockRecipe, mockRecipeStore } from '@/test-utils'
import * as recipeStoreModule from '@/store/slices/recipeStore'
import * as toastModule from '@/hooks/useToast'

// Mock the dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}))

jest.mock('@/store/slices/recipeStore')
jest.mock('@/hooks/useToast')

// Mock the RecipeForm component
jest.mock('@/components/recipes/RecipeForm', () => ({
  RecipeForm: ({ recipe, onSubmit, onCancel }: any) => (
    <div data-testid="recipe-form">
      <div>Editing: {recipe?.name}</div>
      <button onClick={() => onSubmit({ name: 'Updated Recipe' })}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

describe('RecipeEditPage', () => {
  const mockNavigate = jest.fn()
  const mockFetchRecipe = jest.fn()
  const mockUpdateRecipe = jest.fn()
  const mockClearError = jest.fn()
  const mockToast = jest.fn()
  const mockRecipe = createMockRecipe({ id: '123', name: 'Original Recipe' })
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useNavigate as jest.Mock).mockReturnValue(mockNavigate)
    ;(useParams as jest.Mock).mockReturnValue({ id: '123' })
    ;(toastModule.useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
      ...mockRecipeStore,
      fetchRecipe: mockFetchRecipe,
      updateRecipe: mockUpdateRecipe,
      clearError: mockClearError,
      currentRecipe: mockRecipe,
      loading: false,
    })
  })
  
  describe('Rendering', () => {
    it('renders page header and form with recipe data', async () => {
      render(<RecipeEditPage />)
      
      await waitFor(() => {
        // Check header
        expect(screen.getByRole('heading', { name: /recipes.editRecipe/i })).toBeInTheDocument()
        expect(screen.getByText(/recipes.editRecipeDescription/)).toBeInTheDocument()
        
        // Check form is rendered with recipe data
        expect(screen.getByTestId('recipe-form')).toBeInTheDocument()
        expect(screen.getByText('Editing: Original Recipe')).toBeInTheDocument()
      })
    })
    
    it('fetches recipe on mount', () => {
      render(<RecipeEditPage />)
      
      expect(mockFetchRecipe).toHaveBeenCalledWith('123')
    })
    
    it('clears error on unmount', () => {
      const { unmount } = render(<RecipeEditPage />)
      
      unmount()
      
      expect(mockClearError).toHaveBeenCalled()
    })
  })
  
  describe('Loading States', () => {
    it('shows loading spinner while fetching recipe', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
        loading: true,
      })
      
      render(<RecipeEditPage />)
      
      expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
      expect(screen.queryByTestId('recipe-form')).not.toBeInTheDocument()
    })
    
    it('shows loading overlay during update', async () => {
      mockUpdateRecipe.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await userEvent.click(submitButton)
      
      expect(screen.getByText('recipes.updating')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.queryByText('recipes.updating')).not.toBeInTheDocument()
      })
    })
  })
  
  describe('Error States', () => {
    it('shows not found message when recipe does not exist', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
        loading: false,
      })
      
      render(<RecipeEditPage />)
      
      expect(screen.getByText('recipes.notFound')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /recipes.backToRecipes/i })).toBeInTheDocument()
    })
    
    it('navigates back to recipes on not found button click', async () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
        loading: false,
      })
      
      render(<RecipeEditPage />)
      
      const backButton = screen.getByRole('button', { name: /recipes.backToRecipes/i })
      await userEvent.click(backButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/recipes')
    })
  })
  
  describe('Navigation', () => {
    const user = userEvent.setup()
    
    it('navigates back to recipe detail on back button click', async () => {
      render(<RecipeEditPage />)
      
      const backButton = screen.getByRole('button', { name: /common.back/i })
      await user.click(backButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/recipes/123')
    })
    
    it('navigates back to recipe detail on cancel', async () => {
      render(<RecipeEditPage />)
      
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/recipes/123')
    })
  })
  
  describe('Form Submission', () => {
    const user = userEvent.setup()
    
    it('updates recipe successfully', async () => {
      mockUpdateRecipe.mockResolvedValueOnce(undefined)
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledWith('123', expect.objectContaining({
          name: 'Updated Recipe',
          categories: [],
          tags: [],
          updatedAt: expect.any(String),
        }))
        
        expect(mockToast).toHaveBeenCalledWith({
          title: 'recipes.updateSuccess',
          description: 'recipes.updateSuccessDescription',
          variant: 'success',
          duration: 3000,
        })
        
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/123')
      })
    })
    
    it('handles update error', async () => {
      const error = new Error('Network error')
      mockUpdateRecipe.mockRejectedValueOnce(error)
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'recipes.updateError',
          description: 'Network error',
          variant: 'error',
          duration: 5000,
        })
        
        // Should not navigate on error
        expect(mockNavigate).not.toHaveBeenCalledWith('/recipes/123')
      })
    })
    
    it('handles generic error', async () => {
      mockUpdateRecipe.mockRejectedValueOnce('Unknown error')
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'recipes.updateError',
          description: 'errors.generic',
          variant: 'error',
          duration: 5000,
        })
      })
    })
    
    it('does not submit if no recipe or id', async () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
      })
      ;(useParams as jest.Mock).mockReturnValue({ id: undefined })
      
      render(<RecipeEditPage />)
      
      // Form should not be rendered
      expect(screen.queryByTestId('recipe-form')).not.toBeInTheDocument()
    })
  })
  
  describe('Form Data Preparation', () => {
    const user = userEvent.setup()
    
    it('ensures categories and tags are arrays', async () => {
      mockUpdateRecipe.mockResolvedValueOnce(undefined)
      
      // Mock form to submit data without categories/tags
      jest.mocked(require('@/components/recipes/RecipeForm')).RecipeForm = ({ onSubmit }: any) => (
        <div data-testid="recipe-form">
          <button onClick={() => onSubmit({
            name: 'Updated Recipe',
            categories: undefined,
            tags: undefined,
          })}>Submit</button>
        </div>
      )
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledWith('123', expect.objectContaining({
          categories: [],
          tags: [],
        }))
      })
    })
    
    it('adds updated timestamp', async () => {
      mockUpdateRecipe.mockResolvedValueOnce(undefined)
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledWith('123', expect.objectContaining({
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }))
      })
    })
  })
  
  describe('Page Layout', () => {
    it('has proper container and max width', () => {
      render(<RecipeEditPage />)
      
      const formContainer = screen.getByTestId('recipe-form').parentElement
      expect(formContainer).toHaveClass('max-w-4xl')
    })
    
    it('renders breadcrumbs', () => {
      render(<RecipeEditPage />)
      
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
    
    it('has responsive spacing', () => {
      render(<RecipeEditPage />)
      
      const header = screen.getByRole('heading', { name: /recipes.editRecipe/i })
      const headerContainer = header.parentElement
      
      expect(headerContainer).toHaveClass('gap-2', 'sm:gap-4')
    })
  })
  
  describe('Accessibility', () => {
    it('has accessible back button', () => {
      render(<RecipeEditPage />)
      
      const backButton = screen.getByRole('button', { name: /common.back/i })
      expect(backButton).toHaveAttribute('aria-label', 'common.back')
    })
    
    it('has proper heading hierarchy', () => {
      render(<RecipeEditPage />)
      
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('recipes.editRecipe')
    })
  })
  
  describe('Error Handling', () => {
    it('logs error to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const error = new Error('Test error')
      mockUpdateRecipe.mockRejectedValueOnce(error)
      
      render(<RecipeEditPage />)
      
      const submitButton = screen.getByText('Submit')
      await userEvent.click(submitButton)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update recipe:', error)
      })
      
      consoleErrorSpy.mockRestore()
    })
  })
  
  describe('Recipe Loading', () => {
    it('only fetches recipe if id is provided', () => {
      ;(useParams as jest.Mock).mockReturnValue({ id: undefined })
      
      render(<RecipeEditPage />)
      
      expect(mockFetchRecipe).not.toHaveBeenCalled()
    })
    
    it('refetches recipe when id changes', () => {
      const { rerender } = render(<RecipeEditPage />)
      
      expect(mockFetchRecipe).toHaveBeenCalledWith('123')
      
      ;(useParams as jest.Mock).mockReturnValue({ id: '456' })
      rerender(<RecipeEditPage />)
      
      expect(mockFetchRecipe).toHaveBeenCalledWith('456')
    })
  })
})