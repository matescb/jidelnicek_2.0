import React from 'react'
import { render, screen, waitFor, within } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { useParams, useNavigate } from 'react-router-dom'
import RecipeDetailPage from './RecipeDetailPage'
import { createMockRecipe, createMockUser, mockRecipeStore, mockAuthStore } from '@/test-utils'
import * as recipeStoreModule from '@/store/slices/recipeStore'
import * as authStoreModule from '@/store/slices/authStore'
import * as apiClientModule from '@/api/client'

// Mock the dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

jest.mock('@/store/slices/recipeStore')
jest.mock('@/store/slices/authStore')
jest.mock('@/api/client')

// Mock window methods
const mockWindowOpen = jest.fn()
const mockWindowPrint = jest.fn()
window.open = mockWindowOpen
window.print = mockWindowPrint

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

// Mock components that might have issues in tests
jest.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children }: any) => <div data-testid="carousel">{children}</div>,
  CarouselContent: ({ children }: any) => <div>{children}</div>,
  CarouselItem: ({ children }: any) => <div>{children}</div>,
  CarouselPrevious: () => <button>Previous</button>,
  CarouselNext: () => <button>Next</button>,
}))

describe('RecipeDetailPage', () => {
  const mockNavigate = jest.fn()
  const mockFetchRecipe = jest.fn()
  const mockDeleteRecipe = jest.fn()
  const mockDuplicateRecipe = jest.fn()
  const mockToggleFavorite = jest.fn()
  const mockRateRecipe = jest.fn()
  const mockClearError = jest.fn()
  
  const mockRecipe = createMockRecipe({
    id: '123',
    name: 'Delicious Pasta',
    description: 'A wonderful pasta recipe',
    author: {
      id: '1',
      name: 'Chef John',
      avatar: '/avatar.jpg',
    },
    authorId: '1',
    images: [
      { id: '1', url: '/image1.jpg', alt: 'Pasta image 1', isPrimary: true },
      { id: '2', url: '/image2.jpg', alt: 'Pasta image 2', isPrimary: false },
    ],
    nutrition: {
      calories: 450,
      protein: 15,
      carbs: 60,
      fat: 18,
      fiber: 4,
      sodium: 680,
    },
  })
  
  const mockUser = createMockUser({ id: '1' })
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ id: '123' })
    ;(useNavigate as jest.Mock).mockReturnValue(mockNavigate)
    
    ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      user: mockUser,
    })
    
    ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
      ...mockRecipeStore,
      currentRecipe: mockRecipe,
      fetchRecipe: mockFetchRecipe,
      deleteRecipe: mockDeleteRecipe,
      duplicateRecipe: mockDuplicateRecipe,
      toggleFavorite: mockToggleFavorite,
      rateRecipe: mockRateRecipe,
      clearError: mockClearError,
      favorites: [],
      loading: false,
      error: null,
    })
    
    ;(apiClientModule.apiClient.get as jest.Mock).mockResolvedValue({
      data: { items: [], total: 0 },
    })
  })
  
  describe('Rendering', () => {
    it('renders recipe details correctly', async () => {
      render(<RecipeDetailPage />)
      
      await waitFor(() => {
        // Header
        expect(screen.getByText('Delicious Pasta')).toBeInTheDocument()
        expect(screen.getByText('A wonderful pasta recipe')).toBeInTheDocument()
        
        // Author info
        expect(screen.getByText('Chef John')).toBeInTheDocument()
        
        // Metadata
        expect(screen.getByText('45')).toBeInTheDocument() // Total time
        expect(screen.getByText('4')).toBeInTheDocument() // Servings
        expect(screen.getByText('recipes.difficultyLevels.medium')).toBeInTheDocument()
        
        // Rating
        expect(screen.getByText('4.5')).toBeInTheDocument()
        expect(screen.getByText('(10 recipes.ratings)')).toBeInTheDocument()
        
        // Images
        expect(screen.getByAltText('Pasta image 1')).toBeInTheDocument()
        expect(screen.getByAltText('Pasta image 2')).toBeInTheDocument()
      })
    })
    
    it('renders breadcrumb navigation', () => {
      render(<RecipeDetailPage />)
      
      const breadcrumb = screen.getByRole('navigation')
      expect(within(breadcrumb).getByText('recipes.title')).toBeInTheDocument()
      expect(within(breadcrumb).getByText('Delicious Pasta')).toBeInTheDocument()
    })
    
    it('renders ingredients and instructions tabs', () => {
      render(<RecipeDetailPage />)
      
      expect(screen.getByRole('tab', { name: /recipes.ingredients/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /recipes.instructions/i })).toBeInTheDocument()
      
      // Check ingredients are displayed
      mockRecipe.ingredients.forEach(ingredient => {
        expect(screen.getByText(ingredient.name)).toBeInTheDocument()
      })
    })
    
    it('renders nutrition information', () => {
      render(<RecipeDetailPage />)
      
      expect(screen.getByText('recipes.nutritionInfo')).toBeInTheDocument()
      expect(screen.getByText('250')).toBeInTheDocument() // Calories (formatted)
      expect(screen.getByText('5g')).toBeInTheDocument() // Protein
      expect(screen.getByText('45g')).toBeInTheDocument() // Carbs
      expect(screen.getByText('8g')).toBeInTheDocument() // Fat
    })
    
    it('renders tags', () => {
      render(<RecipeDetailPage />)
      
      mockRecipe.tags.forEach(tag => {
        expect(screen.getByText(tag)).toBeInTheDocument()
      })
    })
  })
  
  describe('Loading States', () => {
    it('shows loading skeleton', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
        loading: true,
      })
      
      render(<RecipeDetailPage />)
      
      expect(screen.getAllByTestId('skeleton')).toHaveLength(1) // At least one skeleton
    })
    
    it('fetches recipe on mount', () => {
      render(<RecipeDetailPage />)
      
      expect(mockFetchRecipe).toHaveBeenCalledWith('123')
    })
    
    it('clears error on unmount', () => {
      const { unmount } = render(<RecipeDetailPage />)
      
      unmount()
      
      expect(mockClearError).toHaveBeenCalled()
    })
  })
  
  describe('Error States', () => {
    it('shows error message', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
        loading: false,
        error: 'Failed to load recipe',
      })
      
      render(<RecipeDetailPage />)
      
      expect(screen.getByText('common.error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load recipe')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument()
    })
    
    it('shows not found message', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: null,
        loading: false,
        error: null,
      })
      
      render(<RecipeDetailPage />)
      
      expect(screen.getByText('recipes.notFound')).toBeInTheDocument()
      expect(screen.getByText('recipes.notFoundDescription')).toBeInTheDocument()
    })
  })
  
  describe('User Actions - Owner', () => {
    const user = userEvent.setup()
    
    it('shows owner actions in dropdown', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      expect(screen.getByText('common.edit')).toBeInTheDocument()
      expect(screen.getByText('recipes.duplicate')).toBeInTheDocument()
      expect(screen.getByText('common.delete')).toBeInTheDocument()
    })
    
    it('navigates to edit page', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const editButton = screen.getByText('common.edit')
      await user.click(editButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/recipes/123/edit')
    })
    
    it('handles delete with confirmation', async () => {
      mockDeleteRecipe.mockResolvedValueOnce(undefined)
      
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const deleteButton = screen.getByText('common.delete')
      await user.click(deleteButton)
      
      // Confirmation dialog
      expect(screen.getByText('recipes.deleteRecipe')).toBeInTheDocument()
      expect(screen.getByText('recipes.deleteRecipeConfirm')).toBeInTheDocument()
      
      const confirmButton = screen.getAllByRole('button', { name: /common.delete/i })[1]
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(mockDeleteRecipe).toHaveBeenCalledWith('123')
        expect(mockNavigate).toHaveBeenCalledWith('/recipes')
      })
    })
    
    it('handles duplicate', async () => {
      const duplicatedRecipe = { ...mockRecipe, id: '456' }
      mockDuplicateRecipe.mockResolvedValueOnce(duplicatedRecipe)
      
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const duplicateButton = screen.getByText('recipes.duplicate')
      await user.click(duplicateButton)
      
      await waitFor(() => {
        expect(mockDuplicateRecipe).toHaveBeenCalledWith('123')
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/456/edit')
      })
    })
  })
  
  describe('User Actions - Non-Owner', () => {
    const user = userEvent.setup()
    
    beforeEach(() => {
      // Set different user
      ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { ...mockUser, id: 'different-user' },
      })
    })
    
    it('shows non-owner actions', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      expect(screen.getByText('recipes.fork')).toBeInTheDocument()
      expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
      expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
    })
    
    it('handles fork', async () => {
      const forkedRecipe = { ...mockRecipe, id: '789' }
      mockDuplicateRecipe.mockResolvedValueOnce(forkedRecipe)
      
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const forkButton = screen.getByText('recipes.fork')
      await user.click(forkButton)
      
      await waitFor(() => {
        expect(mockDuplicateRecipe).toHaveBeenCalledWith('123')
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/789/edit')
      })
    })
  })
  
  describe('Favorite Functionality', () => {
    const user = userEvent.setup()
    
    it('toggles favorite status', async () => {
      render(<RecipeDetailPage />)
      
      const favoriteButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('[role="button"]')
      if (favoriteButton) {
        await user.click(favoriteButton)
        
        await waitFor(() => {
          expect(mockToggleFavorite).toHaveBeenCalledWith('123')
        })
      }
    })
    
    it('shows filled heart when favorited', () => {
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: mockRecipe,
        favorites: ['123'],
      })
      
      render(<RecipeDetailPage />)
      
      const heartIcon = screen.getByRole('button', { name: '' }).querySelector('.lucide-heart')
      expect(heartIcon).toHaveClass('fill-current')
    })
  })
  
  describe('Rating Functionality', () => {
    const user = userEvent.setup()
    
    it('allows user to rate recipe', async () => {
      render(<RecipeDetailPage />)
      
      const stars = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-star')
      )
      
      // Click the 4th star
      if (stars[3]) {
        await user.click(stars[3])
        
        await waitFor(() => {
          expect(mockRateRecipe).toHaveBeenCalledWith('123', 4)
        })
      }
    })
    
    it('shows hover state on stars', async () => {
      render(<RecipeDetailPage />)
      
      const stars = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-star')
      )
      
      if (stars[2]) {
        await user.hover(stars[2])
        
        // First 3 stars should show hover state
        expect(stars[0].querySelector('.lucide-star')).toHaveClass('hover:text-yellow-400')
        expect(stars[1].querySelector('.lucide-star')).toHaveClass('hover:text-yellow-400')
        expect(stars[2].querySelector('.lucide-star')).toHaveClass('hover:text-yellow-400')
      }
    })
  })
  
  describe('Share Functionality', () => {
    const user = userEvent.setup()
    
    it('opens share dialog', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const shareButton = screen.getByText('common.share')
      await user.click(shareButton)
      
      expect(screen.getByText('recipes.shareRecipe')).toBeInTheDocument()
      expect(screen.getByText('recipes.shareRecipeDescription')).toBeInTheDocument()
    })
    
    it('copies link to clipboard', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const shareButton = screen.getByText('common.share')
      await user.click(shareButton)
      
      const copyButton = screen.getByRole('button', { name: /common.copy/i })
      await user.click(copyButton)
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('/recipes/123')
        )
        expect(screen.getByText('common.copied')).toBeInTheDocument()
      })
    })
    
    it('shares to social media', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const shareButton = screen.getByText('common.share')
      await user.click(shareButton)
      
      const facebookButton = screen.getByText('Facebook')
      await user.click(facebookButton)
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('facebook.com'),
        '_blank',
        'width=600,height=400'
      )
    })
  })
  
  describe('Print Functionality', () => {
    const user = userEvent.setup()
    
    it('prints recipe', async () => {
      render(<RecipeDetailPage />)
      
      const moreButton = screen.getByRole('button', { name: '' })
      await user.click(moreButton)
      
      const printButton = screen.getByText('common.print')
      await user.click(printButton)
      
      expect(mockWindowPrint).toHaveBeenCalled()
    })
  })
  
  describe('Related Recipes', () => {
    it('fetches and displays related recipes', async () => {
      const relatedRecipes = [
        createMockRecipe({ id: '2', name: 'Related Recipe 1' }),
        createMockRecipe({ id: '3', name: 'Related Recipe 2' }),
      ]
      
      ;(apiClientModule.apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { items: relatedRecipes, total: 2 },
      })
      
      render(<RecipeDetailPage />)
      
      await waitFor(() => {
        expect(apiClientModule.apiClient.get).toHaveBeenCalledWith('/recipes/123/related')
        expect(screen.getByText('recipes.relatedRecipes')).toBeInTheDocument()
      })
    })
  })
  
  describe('Tab Navigation', () => {
    const user = userEvent.setup()
    
    it('switches between ingredients and instructions', async () => {
      render(<RecipeDetailPage />)
      
      // Initially ingredients tab is active
      expect(screen.getByRole('tabpanel', { name: /ingredients/i })).toBeInTheDocument()
      
      // Click instructions tab
      const instructionsTab = screen.getByRole('tab', { name: /recipes.instructions/i })
      await user.click(instructionsTab)
      
      // Instructions should be visible
      expect(screen.getByRole('tabpanel', { name: /instructions/i })).toBeInTheDocument()
      mockRecipe.instructions.forEach(instruction => {
        expect(screen.getByText(instruction.text)).toBeInTheDocument()
      })
    })
  })
  
  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<RecipeDetailPage />)
      
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Delicious Pasta')
    })
    
    it('has accessible navigation', () => {
      render(<RecipeDetailPage />)
      
      const breadcrumb = screen.getByRole('navigation')
      expect(breadcrumb).toBeInTheDocument()
    })
    
    it('has accessible tabs', () => {
      render(<RecipeDetailPage />)
      
      const tabList = screen.getByRole('tablist')
      expect(tabList).toBeInTheDocument()
      
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(2)
    })
  })
  
  describe('Image Carousel', () => {
    it('renders image carousel for multiple images', () => {
      render(<RecipeDetailPage />)
      
      expect(screen.getByTestId('carousel')).toBeInTheDocument()
      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
    
    it('does not show navigation for single image', () => {
      const singleImageRecipe = {
        ...mockRecipe,
        images: [mockRecipe.images[0]],
      }
      
      ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
        ...mockRecipeStore,
        currentRecipe: singleImageRecipe,
      })
      
      render(<RecipeDetailPage />)
      
      expect(screen.queryByText('Previous')).not.toBeInTheDocument()
      expect(screen.queryByText('Next')).not.toBeInTheDocument()
    })
  })
})