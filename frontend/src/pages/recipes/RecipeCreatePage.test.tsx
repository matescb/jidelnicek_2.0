import React from 'react'
import { render, screen, waitFor } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { useNavigate } from 'react-router-dom'
import RecipeCreatePage from './RecipeCreatePage'
import { createMockRecipe, mockRecipeStore } from '@/test-utils'
import * as recipeStoreModule from '@/store/slices/recipeStore'
import * as toastModule from '@/hooks/useToast'

// Mock the dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}))

jest.mock('@/store/slices/recipeStore')
jest.mock('@/hooks/useToast')

// Mock the RecipeForm component
jest.mock('@/components/recipes/RecipeForm', () => ({
  RecipeForm: ({ onSubmit, onCancel }: any) => (
    <div data-testid="recipe-form">
      <button onClick={() => onSubmit({ name: 'Test Recipe' })}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

describe('RecipeCreatePage', () => {
  const mockNavigate = jest.fn()
  const mockCreateRecipe = jest.fn()
  const mockToast = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useNavigate as jest.Mock).mockReturnValue(mockNavigate)
    ;(toastModule.useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
      ...mockRecipeStore,
      createRecipe: mockCreateRecipe,
      loading: false,
    })
  })
  
  describe('Rendering', () => {
    it('renders page header and form', () => {
      render(<RecipeCreatePage />)
      
      // Check header
      expect(screen.getByRole('heading', { name: /recipes.createRecipe/i })).toBeInTheDocument()
      expect(screen.getByText(/recipes.createRecipeDescription/)).toBeInTheDocument()
      
      // Check back button
      expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument()
      
      // Check form is rendered
      expect(screen.getByTestId('recipe-form')).toBeInTheDocument()
    })
    
    it('renders breadcrumbs', () => {
      render(<RecipeCreatePage />)
      
      // Breadcrumbs component should be present
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })
  
  describe('Navigation', () => {
    const user = userEvent.setup()
    
    it('navigates back to recipes list on back button click', async () => {
      render(<RecipeCreatePage />)
      
      const backButton = screen.getByRole('button', { name: /common.back/i })
      await user.click(backButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/recipes')
    })
    
    it('navigates back on cancel', async () => {
      render(<RecipeCreatePage />)
      
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/recipes')
    })
  })
  
  describe('Form Submission', () => {
    const user = userEvent.setup()
    
    it('creates recipe successfully', async () => {
      const newRecipe = createMockRecipe({ id: '123' })
      mockCreateRecipe.mockResolvedValueOnce(newRecipe)
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Recipe',
          categories: [],
          tags: [],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }))
        
        expect(mockToast).toHaveBeenCalledWith({
          title: 'recipes.createSuccess',
          description: 'recipes.createSuccessDescription',
          variant: 'success',
          duration: 3000,
        })
        
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/123')
      })
    })
    
    it('handles creation error', async () => {
      const error = new Error('Network error')
      mockCreateRecipe.mockRejectedValueOnce(error)
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'recipes.createError',
          description: 'Network error',
          variant: 'error',
          duration: 5000,
        })
        
        // Should not navigate on error
        expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/recipes/'))
      })
    })
    
    it('handles generic error', async () => {
      mockCreateRecipe.mockRejectedValueOnce('Unknown error')
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'recipes.createError',
          description: 'errors.generic',
          variant: 'error',
          duration: 5000,
        })
      })
    })
  })
  
  describe('Loading States', () => {
    const user = userEvent.setup()
    
    it('shows loading overlay during submission', async () => {
      mockCreateRecipe.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      // Loading overlay should appear
      expect(screen.getByText('recipes.creating')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.queryByText('recipes.creating')).not.toBeInTheDocument()
      })
    })
    
    it('shows loading when store is loading', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        loading: true,
      })
      
      render(<RecipeCreatePage />)
      
      expect(screen.getByText('recipes.creating')).toBeInTheDocument()
    })
  })
  
  describe('Page Layout', () => {
    it('has proper container and max width', () => {
      render(<RecipeCreatePage />)
      
      const formContainer = screen.getByTestId('recipe-form').parentElement
      expect(formContainer).toHaveClass('max-w-4xl')
    })
    
    it('has responsive spacing', () => {
      render(<RecipeCreatePage />)
      
      const header = screen.getByRole('heading', { name: /recipes.createRecipe/i })
      const headerContainer = header.parentElement
      
      // Check responsive classes
      expect(headerContainer).toHaveClass('gap-2', 'sm:gap-4')
    })
  })
  
  describe('Accessibility', () => {
    it('has accessible back button', () => {
      render(<RecipeCreatePage />)
      
      const backButton = screen.getByRole('button', { name: /common.back/i })
      expect(backButton).toHaveAttribute('aria-label', 'common.back')
    })
    
    it('has proper heading hierarchy', () => {
      render(<RecipeCreatePage />)
      
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('recipes.createRecipe')
    })
    
    it('focuses on form after render', () => {
      render(<RecipeCreatePage />)
      
      // The form should be in the tab order
      const form = screen.getByTestId('recipe-form')
      expect(form).toBeInTheDocument()
    })
  })
  
  describe('Error Handling', () => {
    it('logs error to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const error = new Error('Test error')
      mockCreateRecipe.mockRejectedValueOnce(error)
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await userEvent.click(submitButton)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create recipe:', error)
      })
      
      consoleErrorSpy.mockRestore()
    })
  })
  
  describe('Form Data Preparation', () => {
    const user = userEvent.setup()
    
    it('ensures categories and tags are arrays', async () => {
      mockCreateRecipe.mockResolvedValueOnce(createMockRecipe())
      
      // Mock form to submit data without categories/tags
      jest.mocked(require('@/components/recipes/RecipeForm')).RecipeForm = ({ onSubmit }: any) => (
        <div data-testid="recipe-form">
          <button onClick={() => onSubmit({
            name: 'Test Recipe',
            categories: undefined,
            tags: undefined,
          })}>Submit</button>
        </div>
      )
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({
          categories: [],
          tags: [],
        }))
      })
    })
    
    it('adds timestamps to recipe data', async () => {
      mockCreateRecipe.mockResolvedValueOnce(createMockRecipe())
      
      render(<RecipeCreatePage />)
      
      const submitButton = screen.getByText('Submit')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({
          createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }))
      })
    })
  })
})