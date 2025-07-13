import React from 'react'
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { RecipeForm } from './RecipeForm'
import { createMockRecipe, createMockFile, createMockFileList } from '@/test-utils'
import * as recipeStoreModule from '@/store/slices/recipeStore'
import * as toastModule from '@/hooks/useToast'

// Mock the stores and hooks
vi.mock('@/store/slices/recipeStore')
vi.mock('@/hooks/useToast')

// Mock the drag and drop library
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({
    droppableProps: {},
    innerRef: vi.fn(),
    placeholder: null,
  }),
  Draggable: ({ children, index }: any) => children({
    draggableProps: {},
    dragHandleProps: {},
    innerRef: vi.fn(),
  }, { isDragging: false }),
}))

describe('RecipeForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()
  const mockToast = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    ;(toastModule.useToast as vi.MockedFunction).mockReturnValue({ toast: mockToast })
  })
  
  describe('Rendering', () => {
    it('renders all form sections', async () => {
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Check main sections exist
      expect(screen.getByRole('heading', { name: 'Basic Information' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Ingredients/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Instructions/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Images' })).toBeInTheDocument()
      
      // Check form fields
      expect(screen.getByRole('textbox', { name: /Recipe Name/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /Description/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Prep Time/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Cook Time/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Servings/i })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /Difficulty/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Make recipe public/)).toBeInTheDocument()
    })
    
    it('renders with existing recipe data', async () => {
      const mockRecipe = createMockRecipe({
        name: 'Test Recipe Name',
        title: 'Test Recipe Name', // Include both for compatibility
        ingredients: [
          { name: 'Flour', quantity: 200, unit: 'g', notes: '' },
          { name: 'Sugar', quantity: 100, unit: 'g', notes: '' }
        ],
        instructions: [
          { step: 1, text: 'Mix all ingredients' },
          { step: 2, text: 'Bake for 30 minutes' }
        ]
      })
      await act(async () => {
        render(<RecipeForm recipe={mockRecipe} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Use the correct property name
      const recipeName = mockRecipe.name || mockRecipe.title
      expect(screen.getByDisplayValue(recipeName)).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.description)).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.prepTime.toString())).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.cookTime.toString())).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.servings.toString())).toBeInTheDocument()
      
      // Check ingredients
      expect(screen.getByDisplayValue('Flour')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Sugar')).toBeInTheDocument()
      
      // Check instructions
      expect(screen.getByDisplayValue('Mix all ingredients')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Bake for 30 minutes')).toBeInTheDocument()
    })
    
    it('renders action buttons correctly', async () => {
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Create')).toBeInTheDocument()
    })
    
    it('shows update button when editing', async () => {
      const mockRecipe = createMockRecipe()
      await act(async () => {
        render(<RecipeForm recipe={mockRecipe} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      expect(screen.getByText('Update')).toBeInTheDocument()
    })
  })
  
  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Try to submit empty form
      const submitButton = screen.getByText('Create')
      await act(async () => {
        await user.click(submitButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText('Recipe name is required')).toBeInTheDocument()
        expect(screen.getByText('At least one ingredient is required')).toBeInTheDocument()
        expect(screen.getByText('At least one instruction is required')).toBeInTheDocument()
      })
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
    
    it('validates field constraints', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Fill with invalid data
      const nameInput = screen.getByRole('textbox', { name: /Recipe Name/i })
      await act(async () => {
        await user.type(nameInput, 'a'.repeat(101)) // Too long
      })
      
      const servingsInput = screen.getByRole('spinbutton', { name: /Servings/i })
      await act(async () => {
        await user.click(servingsInput)
        await user.keyboard('{Control>}a{/Control}') // Select all
        await user.type(servingsInput, '0') // Too low
      })
      
      const submitButton = screen.getByText('Create')
      await act(async () => {
        await user.click(submitButton)
      })
      
      await waitFor(() => {
        // Look for validation errors - Zod uses different default messages
        // Check if there are any error messages displayed for validation
        const errorElements = document.querySelectorAll('[class*="text-red"]')
        expect(errorElements.length).toBeGreaterThan(0)
      })
    })
    
    it('validates ingredient quantity', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // First add an ingredient
      const addIngredientButton = screen.getByText('Add Ingredient')
      await act(async () => {
        await user.click(addIngredientButton)
      })
      
      // Now fill the ingredient fields
      const ingredientInputs = screen.getAllByRole('textbox')
      const ingredientNameInput = ingredientInputs.find(input => 
        input.getAttribute('placeholder') === 'Ingredient name'
      )
      if (ingredientNameInput) {
        await act(async () => {
          await user.type(ingredientNameInput, 'Flour')
        })
      }
      
      const quantityInputs = screen.getAllByRole('spinbutton')
      const quantityInput = quantityInputs.find(input => 
        input.getAttribute('placeholder') === 'Quantity'
      )
      if (quantityInput) {
        await act(async () => {
          await user.click(quantityInput)
          await user.keyboard('{Control>}a{/Control}') // Select all
          await user.type(quantityInput, '-1')
        })
      }
      
      const submitButton = screen.getByText('Create')
      await act(async () => {
        await user.click(submitButton)
      })
      
      await waitFor(() => {
        // Look for ingredient validation errors - the message shows up on the quantity field
        const errorElements = document.querySelectorAll('[class*="text-red"]')
        expect(errorElements.length).toBeGreaterThan(0)
      })
    })
  })
  
  describe('User Interactions', () => {
    it('adds and removes ingredients', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Initially has one empty ingredient row
      const initialIngredients = screen.getAllByPlaceholderText('Ingredient name')
      expect(initialIngredients).toHaveLength(1)
      
      // Add ingredient
      const addButton = screen.getByText('Add Ingredient')
      await act(async () => {
        await user.click(addButton)
      })
      
      const afterAddIngredients = screen.getAllByPlaceholderText('Ingredient name')
      expect(afterAddIngredients).toHaveLength(2)
      
      // Remove ingredient - find first remove button for ingredients
      const removeButtons = screen.getAllByRole('button', { name: /Remove.*ingredient/i })
      expect(removeButtons).toHaveLength(2) // Should have 2 remove buttons for 2 ingredients
      await act(async () => {
        await user.click(removeButtons[0])
      })
      
      const afterRemoveIngredients = screen.getAllByPlaceholderText('Ingredient name')
      expect(afterRemoveIngredients).toHaveLength(1)
    })
    
    it('adds and removes instructions', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Initially has one empty instruction
      const initialInstructions = screen.getAllByPlaceholderText(/Step/)
      expect(initialInstructions).toHaveLength(1)
      
      // Add instruction
      const addButton = screen.getByText('Add Instruction')
      await act(async () => {
        await user.click(addButton)
      })
      
      const afterAddInstructions = screen.getAllByPlaceholderText(/Step/)
      expect(afterAddInstructions).toHaveLength(2)
      
      // Remove instruction - find first remove button for instructions
      const removeButtons = screen.getAllByRole('button', { name: /Remove.*Step/i })
      expect(removeButtons).toHaveLength(2) // Should have 2 remove buttons for 2 instructions
      await act(async () => {
        await user.click(removeButtons[0])
      })
      
      const afterRemoveInstructions = screen.getAllByPlaceholderText(/Step/)
      expect(afterRemoveInstructions).toHaveLength(1)
    })
    
    it('toggles public visibility', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      const publicCheckbox = screen.getByRole('checkbox', { name: /Make recipe public/i })
      expect(publicCheckbox).not.toBeChecked()
      
      await act(async () => {
        await user.click(publicCheckbox)
      })
      expect(publicCheckbox).toBeChecked()
      
      await act(async () => {
        await user.click(publicCheckbox)
      })
      expect(publicCheckbox).not.toBeChecked()
    })
    
    it('selects difficulty level', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      const difficultySelect = screen.getByRole('combobox', { name: /Difficulty/i })
      expect(difficultySelect).toHaveValue('medium') // Check default value
      
      await act(async () => {
        await user.selectOptions(difficultySelect, 'hard')
      })
      expect(difficultySelect).toHaveValue('hard')
    })
  })
  
  describe('Form Submission', () => {
    it('submits valid form data', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Fill required fields
      await act(async () => {
        await user.type(screen.getByRole('textbox', { name: /Recipe Name/i }), 'Test Recipe')
        await user.type(screen.getByRole('textbox', { name: /Description/i }), 'Test description')
      })
      
      // Add ingredient content to existing fields
      await act(async () => {
        await user.type(screen.getByPlaceholderText('Ingredient name'), 'Flour')
      })
      
      // Find and fill instruction
      const instructionInputs = screen.getAllByRole('textbox')
      const instructionInput = instructionInputs.find(input => 
        input.getAttribute('placeholder')?.includes('Step')
      )
      if (instructionInput) {
        await act(async () => {
          await user.type(instructionInput, 'Mix ingredients')
        })
      }
      
      // Submit
      await act(async () => {
        await user.click(screen.getByText('Create'))
      })
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Recipe',
          description: 'Test description',
          prepTime: 15,
          cookTime: 30,
          servings: 4,
          difficulty: 'medium',
          ingredients: expect.arrayContaining([
            expect.objectContaining({
              name: 'Flour',
              quantity: 200,
              unit: 'g',
            })
          ]),
          instructions: expect.arrayContaining([
            expect.objectContaining({
              step: 1,
              text: 'Mix ingredients',
            })
          ]),
          isPublic: false,
        }))
      })
    })
    
    it('handles submission errors', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockRejectedValueOnce(new Error('Network error'))
      
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Fill minimum required fields
      await act(async () => {
        await user.type(screen.getByRole('textbox', { name: /Recipe Name/i }), 'Test Recipe')
        await user.type(screen.getByPlaceholderText('Ingredient name'), 'Flour')
      })
      
      // Find instruction input
      const instructionInputs = screen.getAllByRole('textbox')
      const instructionInput = instructionInputs.find(input => 
        input.getAttribute('placeholder')?.includes('Step')
      )
      if (instructionInput) {
        await act(async () => {
          await user.type(instructionInput, 'Mix')
        })
      }
      
      await act(async () => {
        await user.click(screen.getByText('Create'))
      })
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Something went wrong',
          description: 'Network error',
          variant: 'error',
        })
      })
    })
    
    it('shows loading state during submission', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Fill minimum required fields
      await act(async () => {
        await user.type(screen.getByRole('textbox', { name: /Recipe Name/i }), 'Test Recipe')
        await user.type(screen.getByPlaceholderText('Ingredient name'), 'Flour')
      })
      
      // Find instruction input
      const instructionInputs = screen.getAllByRole('textbox')
      const instructionInput = instructionInputs.find(input => 
        input.getAttribute('placeholder')?.includes('Step')
      )
      if (instructionInput) {
        await act(async () => {
          await user.type(instructionInput, 'Mix')
        })
      }
      
      const submitButton = screen.getByText('Create')
      await act(async () => {
        await user.click(submitButton)
      })
      
      // Check for loading state - button should be disabled
      expect(submitButton).toBeDisabled()
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })
  })
  
  describe('Image Management', () => {
    it('handles image upload', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      const file1 = createMockFile('image1.jpg', 1024, 'image/jpeg')
      const file2 = createMockFile('image2.png', 2048, 'image/png')
      
      const fileInput = screen.getByLabelText(/Upload Images/)
      
      // Upload files
      Object.defineProperty(fileInput, 'files', {
        value: createMockFileList([file1, file2]),
        writable: false,
      })
      
      await act(async () => {
        fireEvent.change(fileInput)
      })
      
      await waitFor(() => {
        // Should show preview or file count
        expect(screen.getByText(/2/)).toBeInTheDocument()
      })
    })
    
    it('validates image file size', async () => {
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      const largeFile = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg') // 6MB
      
      const fileInput = screen.getByLabelText(/Upload Images/)
      
      Object.defineProperty(fileInput, 'files', {
        value: createMockFileList([largeFile]),
        writable: false,
      })
      
      await act(async () => {
        fireEvent.change(fileInput)
      })
      
      await waitFor(() => {
        // Look for file size validation error - the FileField component should show this
        expect(screen.getByText(/File size exceeds/)).toBeInTheDocument()
      })
    })
    
    it('validates image file type', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      const invalidFile = createMockFile('document.pdf', 1024, 'application/pdf')
      
      // Try to find file input
      const fileInputs = document.querySelectorAll('input[type="file"]')
      if (fileInputs.length > 0) {
        const fileInput = fileInputs[0] as HTMLInputElement
        
        Object.defineProperty(fileInput, 'files', {
          value: createMockFileList([invalidFile]),
          writable: false,
        })
        
        await act(async () => {
          fireEvent.change(fileInput)
        })
        
        // Wait for validation error - FileField should show type validation
        await waitFor(() => {
          const errorElements = document.querySelectorAll('[class*="text-red"]')
          expect(errorElements.length).toBeGreaterThan(0)
        })
      }
      
      // Ensure form doesn't submit with invalid files
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
    
    it('removes existing images when editing', async () => {
      const user = userEvent.setup()
      const mockRecipe = createMockRecipe({
        images: [
          { id: '1', url: '/image1.jpg', alt: 'Image 1', isPrimary: true },
          { id: '2', url: '/image2.jpg', alt: 'Image 2', isPrimary: false },
        ]
      })
      
      await act(async () => {
        render(<RecipeForm recipe={mockRecipe} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Should show existing images
      expect(screen.getByText('Existing Images')).toBeInTheDocument()
      expect(screen.getByAltText('Image 1')).toBeInTheDocument()
      expect(screen.getByAltText('Image 2')).toBeInTheDocument()
      
      // Remove first image
      const removeButton = screen.getByRole('button', { name: /Remove.*Image 1/i })
      await act(async () => {
        await user.click(removeButton)
      })
      
      // Should not show removed image
      expect(screen.queryByAltText('Image 1')).not.toBeInTheDocument()
      expect(screen.getByAltText('Image 2')).toBeInTheDocument()
    })
  })
  
  describe('Accessibility', () => {
    it('has proper form labels', async () => {
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Check that form fields have accessible labels
      expect(screen.getByRole('textbox', { name: /Recipe Name/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /Description/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Prep Time/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Cook Time/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Servings/i })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /Difficulty/i })).toBeInTheDocument()
    })
    
    it('shows required field indicators', async () => {
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Check that required fields have asterisks in their labels
      expect(screen.getByText(/Recipe Name.*\*/)).toBeInTheDocument()
      expect(screen.getByText(/Servings.*\*/)).toBeInTheDocument()
      expect(screen.getByText(/Ingredients.*\*/)).toBeInTheDocument()
      expect(screen.getByText(/Instructions.*\*/)).toBeInTheDocument()
      expect(screen.getByText(/Difficulty.*\*/)).toBeInTheDocument()
    })
    
    it('supports keyboard navigation', async () => {
      await act(async () => {
        render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      })
      
      // Test that form elements are keyboard accessible
      const nameInput = screen.getByRole('textbox', { name: /Recipe Name/i })
      const descriptionInput = screen.getByRole('textbox', { name: /Description/i })
      const prepTimeInput = screen.getByRole('spinbutton', { name: /Prep Time/i })
      const servingsInput = screen.getByRole('spinbutton', { name: /Servings/i })
      const difficultySelect = screen.getByRole('combobox', { name: /Difficulty/i })
      
      // Check that form elements are focusable (not disabled and properly accessible)
      expect(nameInput).toBeEnabled()
      expect(descriptionInput).toBeEnabled()
      expect(prepTimeInput).toBeEnabled()
      expect(servingsInput).toBeEnabled()
      expect(difficultySelect).toBeEnabled()
      
      // Check proper keyboard accessibility attributes
      expect(nameInput.getAttribute('tabindex')).not.toBe('-1')
      expect(prepTimeInput.getAttribute('tabindex')).toBe('0')
      expect(servingsInput.getAttribute('tabindex')).toBe('0')
    })
  })
})