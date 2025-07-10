import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { RecipeForm } from './RecipeForm'
import { createMockRecipe, createMockFile, createMockFileList } from '@/test-utils'
import * as recipeStoreModule from '@/store/slices/recipeStore'
import * as toastModule from '@/hooks/useToast'

// Mock the stores and hooks
jest.mock('@/store/slices/recipeStore')
jest.mock('@/hooks/useToast')

// Mock the drag and drop library
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({
    droppableProps: {},
    innerRef: jest.fn(),
    placeholder: null,
  }),
  Draggable: ({ children, index }: any) => children({
    draggableProps: {},
    dragHandleProps: {},
    innerRef: jest.fn(),
  }, { isDragging: false }),
}))

describe('RecipeForm', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()
  const mockToast = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(toastModule.useToast as jest.Mock).mockReturnValue({ toast: mockToast })
  })
  
  describe('Rendering', () => {
    it('renders all form sections', () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Check main sections
      expect(screen.getByText('recipes.basicInfo')).toBeInTheDocument()
      expect(screen.getByText('recipes.ingredients')).toBeInTheDocument()
      expect(screen.getByText('recipes.instructions')).toBeInTheDocument()
      expect(screen.getByText('recipes.images')).toBeInTheDocument()
      
      // Check form fields
      expect(screen.getByLabelText(/recipes.name/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.description/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.prepTime/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.cookTime/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.servings/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.difficulty/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.isPublic/)).toBeInTheDocument()
    })
    
    it('renders with existing recipe data', () => {
      const mockRecipe = createMockRecipe()
      render(<RecipeForm recipe={mockRecipe} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByDisplayValue(mockRecipe.name)).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.description)).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.prepTime.toString())).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.cookTime.toString())).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockRecipe.servings.toString())).toBeInTheDocument()
      
      // Check ingredients
      mockRecipe.ingredients.forEach(ingredient => {
        expect(screen.getByDisplayValue(ingredient.name)).toBeInTheDocument()
        expect(screen.getByDisplayValue(ingredient.quantity.toString())).toBeInTheDocument()
      })
      
      // Check instructions
      mockRecipe.instructions.forEach(instruction => {
        expect(screen.getByDisplayValue(instruction.text)).toBeInTheDocument()
      })
    })
    
    it('renders action buttons correctly', () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByText('common.cancel')).toBeInTheDocument()
      expect(screen.getByText('common.create')).toBeInTheDocument()
    })
    
    it('shows update button when editing', () => {
      const mockRecipe = createMockRecipe()
      render(<RecipeForm recipe={mockRecipe} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByText('common.update')).toBeInTheDocument()
    })
  })
  
  describe('Form Validation', () => {
    const user = userEvent.setup()
    
    it('validates required fields', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Try to submit empty form
      const submitButton = screen.getByText('common.create')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Recipe name is required')).toBeInTheDocument()
        expect(screen.getByText('At least one ingredient is required')).toBeInTheDocument()
        expect(screen.getByText('At least one instruction is required')).toBeInTheDocument()
      })
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
    
    it('validates field constraints', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill with invalid data
      const nameInput = screen.getByLabelText(/recipes.name/)
      await user.type(nameInput, 'a'.repeat(101)) // Too long
      
      const servingsInput = screen.getByLabelText(/recipes.servings/)
      await user.clear(servingsInput)
      await user.type(servingsInput, '0') // Too low
      
      const submitButton = screen.getByText('common.create')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/must be at least 1/)).toBeInTheDocument()
      })
    })
    
    it('validates ingredient quantity', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Add ingredient with invalid quantity
      const ingredientName = screen.getByPlaceholderText('recipes.ingredientName')
      await user.type(ingredientName, 'Flour')
      
      const quantityInput = screen.getByPlaceholderText('recipes.quantity')
      await user.clear(quantityInput)
      await user.type(quantityInput, '-1')
      
      const submitButton = screen.getByText('common.create')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Quantity must be positive')).toBeInTheDocument()
      })
    })
  })
  
  describe('User Interactions', () => {
    const user = userEvent.setup()
    
    it('adds and removes ingredients', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Initially has one empty ingredient row
      expect(screen.getAllByPlaceholderText('recipes.ingredientName')).toHaveLength(1)
      
      // Add ingredient
      const addButton = screen.getByText('recipes.addIngredient')
      await user.click(addButton)
      
      expect(screen.getAllByPlaceholderText('recipes.ingredientName')).toHaveLength(2)
      
      // Remove ingredient
      const removeButtons = screen.getAllByRole('button', { name: '' }).filter(
        btn => btn.querySelector('.lucide-trash-2')
      )
      await user.click(removeButtons[0])
      
      expect(screen.getAllByPlaceholderText('recipes.ingredientName')).toHaveLength(1)
    })
    
    it('adds and removes instructions', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Initially has one empty instruction
      expect(screen.getAllByPlaceholderText(/common.step/)).toHaveLength(1)
      
      // Add instruction
      const addButton = screen.getByText('recipes.addInstruction')
      await user.click(addButton)
      
      expect(screen.getAllByPlaceholderText(/common.step/)).toHaveLength(2)
      
      // Remove instruction
      const removeButtons = screen.getAllByRole('button', { name: '' }).filter(
        btn => btn.querySelector('.lucide-trash-2')
      )
      await user.click(removeButtons[1]) // Second set of remove buttons for instructions
      
      expect(screen.getAllByPlaceholderText(/common.step/)).toHaveLength(1)
    })
    
    it('toggles public visibility', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const publicCheckbox = screen.getByLabelText(/recipes.isPublic/)
      expect(publicCheckbox).not.toBeChecked()
      
      await user.click(publicCheckbox)
      expect(publicCheckbox).toBeChecked()
      
      await user.click(publicCheckbox)
      expect(publicCheckbox).not.toBeChecked()
    })
    
    it('selects difficulty level', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const difficultySelect = screen.getByLabelText(/recipes.difficulty/)
      await user.selectOptions(difficultySelect, 'hard')
      
      expect(difficultySelect).toHaveValue('hard')
    })
  })
  
  describe('Form Submission', () => {
    const user = userEvent.setup()
    
    it('submits valid form data', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill required fields
      await user.type(screen.getByLabelText(/recipes.name/), 'Test Recipe')
      await user.type(screen.getByLabelText(/recipes.description/), 'Test description')
      await user.type(screen.getByLabelText(/recipes.prepTime/), '15')
      await user.type(screen.getByLabelText(/recipes.cookTime/), '30')
      
      // Add ingredient
      await user.type(screen.getByPlaceholderText('recipes.ingredientName'), 'Flour')
      await user.clear(screen.getByPlaceholderText('recipes.quantity'))
      await user.type(screen.getByPlaceholderText('recipes.quantity'), '200')
      
      // Add instruction
      await user.type(screen.getByPlaceholderText(/common.step/), 'Mix ingredients')
      
      // Submit
      await user.click(screen.getByText('common.create'))
      
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
      mockOnSubmit.mockRejectedValueOnce(new Error('Network error'))
      
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill minimum required fields
      await user.type(screen.getByLabelText(/recipes.name/), 'Test Recipe')
      await user.type(screen.getByPlaceholderText('recipes.ingredientName'), 'Flour')
      await user.type(screen.getByPlaceholderText(/common.step/), 'Mix')
      
      await user.click(screen.getByText('common.create'))
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'errors.generic',
          description: 'Network error',
          variant: 'error',
        })
      })
    })
    
    it('shows loading state during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill minimum required fields
      await user.type(screen.getByLabelText(/recipes.name/), 'Test Recipe')
      await user.type(screen.getByPlaceholderText('recipes.ingredientName'), 'Flour')
      await user.type(screen.getByPlaceholderText(/common.step/), 'Mix')
      
      const submitButton = screen.getByText('common.create')
      await user.click(submitButton)
      
      expect(screen.getByText('common.saving')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
      
      await waitFor(() => {
        expect(screen.getByText('common.create')).toBeInTheDocument()
      })
    })
  })
  
  describe('Image Management', () => {
    const user = userEvent.setup()
    
    it('handles image upload', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const file1 = createMockFile('image1.jpg', 1024, 'image/jpeg')
      const file2 = createMockFile('image2.png', 2048, 'image/png')
      
      const fileInput = screen.getByLabelText(/recipes.uploadImages/)
      
      // Upload files
      Object.defineProperty(fileInput, 'files', {
        value: createMockFileList([file1, file2]),
        writable: false,
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        // Should show preview or file count
        expect(screen.getByText(/2/)).toBeInTheDocument()
      })
    })
    
    it('validates image file size', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const largeFile = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg') // 6MB
      
      const fileInput = screen.getByLabelText(/recipes.uploadImages/)
      
      Object.defineProperty(fileInput, 'files', {
        value: createMockFileList([largeFile]),
        writable: false,
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(screen.getByText(/must be less than 5MB/)).toBeInTheDocument()
      })
    })
    
    it('validates image file type', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const invalidFile = createMockFile('document.pdf', 1024, 'application/pdf')
      
      const fileInput = screen.getByLabelText(/recipes.uploadImages/)
      
      Object.defineProperty(fileInput, 'files', {
        value: createMockFileList([invalidFile]),
        writable: false,
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(screen.getByText(/Please upload only JPEG, PNG, or WebP images/)).toBeInTheDocument()
      })
    })
    
    it('removes existing images when editing', async () => {
      const mockRecipe = createMockRecipe({
        images: [
          { id: '1', url: '/image1.jpg', alt: 'Image 1', isPrimary: true },
          { id: '2', url: '/image2.jpg', alt: 'Image 2', isPrimary: false },
        ]
      })
      
      render(<RecipeForm recipe={mockRecipe} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Should show existing images
      expect(screen.getByText('recipes.existingImages')).toBeInTheDocument()
      expect(screen.getByAltText('Image 1')).toBeInTheDocument()
      expect(screen.getByAltText('Image 2')).toBeInTheDocument()
      
      // Remove first image
      const removeButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('.lucide-x')
      )
      await user.click(removeButtons[0])
      
      // Should not show removed image
      expect(screen.queryByAltText('Image 1')).not.toBeInTheDocument()
      expect(screen.getByAltText('Image 2')).toBeInTheDocument()
    })
  })
  
  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByLabelText(/recipes.name/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.description/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.prepTime/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.cookTime/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.servings/)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipes.difficulty/)).toBeInTheDocument()
    })
    
    it('shows required field indicators', () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const requiredFields = screen.getAllByText('*')
      expect(requiredFields.length).toBeGreaterThan(0)
    })
    
    it('supports keyboard navigation', async () => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const nameInput = screen.getByLabelText(/recipes.name/)
      nameInput.focus()
      expect(document.activeElement).toBe(nameInput)
      
      // Tab to next field
      await userEvent.tab()
      const descriptionInput = screen.getByLabelText(/recipes.description/)
      expect(document.activeElement).toBe(descriptionInput)
    })
  })
})