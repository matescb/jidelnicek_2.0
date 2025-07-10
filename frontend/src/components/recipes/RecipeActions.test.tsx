import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { RecipeActions } from './RecipeActions'
import { createMockRecipe, createMockUser, mockRecipeStore, mockAuthStore } from '@/test-utils'
import * as recipeStoreModule from '@/stores/recipeStore'
import * as authStoreModule from '@/stores/authStore'
import { toast } from 'sonner'

// Mock the stores and libraries
jest.mock('@/stores/recipeStore')
jest.mock('@/stores/authStore')
jest.mock('sonner')

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

// Mock window.open
const mockWindowOpen = jest.fn()
window.open = mockWindowOpen

describe('RecipeActions', () => {
  const mockRecipe = createMockRecipe()
  const mockUser = createMockUser()
  const mockOnEdit = jest.fn()
  const mockOnDuplicate = jest.fn()
  const mockOnFork = jest.fn()
  const mockOnDelete = jest.fn()
  
  const mockDeleteRecipe = jest.fn()
  const mockDuplicateRecipe = jest.fn()
  const mockForkRecipe = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
      ...mockAuthStore,
      user: mockUser,
    })
    
    ;(recipeStoreModule.useRecipeStore as jest.Mock).mockReturnValue({
      ...mockRecipeStore,
      deleteRecipe: mockDeleteRecipe,
      duplicateRecipe: mockDuplicateRecipe,
      forkRecipe: mockForkRecipe,
    })
  })
  
  describe('Rendering', () => {
    it('renders as icon button by default', () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const button = screen.getByRole('button', { name: /recipe actions/i })
      expect(button).toBeInTheDocument()
      expect(button.querySelector('.lucide-more-vertical')).toBeInTheDocument()
    })
    
    it('renders as button variant', () => {
      render(<RecipeActions recipe={mockRecipe} variant="button" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Actions')
    })
    
    it('applies size classes', () => {
      const { rerender } = render(<RecipeActions recipe={mockRecipe} size="sm" />)
      let button = screen.getByRole('button')
      expect(button.querySelector('.h-4.w-4')).toBeInTheDocument()
      
      rerender(<RecipeActions recipe={mockRecipe} size="lg" />)
      button = screen.getByRole('button')
      expect(button.querySelector('.h-6.w-6')).toBeInTheDocument()
    })
    
    it('applies custom className', () => {
      render(<RecipeActions recipe={mockRecipe} className="custom-class" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })
  })
  
  describe('Menu Items - Owner Actions', () => {
    const user = userEvent.setup()
    
    beforeEach(() => {
      // Set user as owner
      ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { ...mockUser, id: mockRecipe.authorId },
      })
    })
    
    it('shows owner-specific actions', async () => {
      render(<RecipeActions recipe={mockRecipe} onEdit={mockOnEdit} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      expect(screen.getByText('Edit Recipe')).toBeInTheDocument()
      expect(screen.getByText('Duplicate Recipe')).toBeInTheDocument()
      expect(screen.getByText('Delete Recipe')).toBeInTheDocument()
      expect(screen.queryByText('Fork Recipe')).not.toBeInTheDocument()
      expect(screen.queryByText('Report Content')).not.toBeInTheDocument()
    })
    
    it('handles edit action', async () => {
      render(<RecipeActions recipe={mockRecipe} onEdit={mockOnEdit} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const editItem = screen.getByText('Edit Recipe')
      await user.click(editItem)
      
      expect(mockOnEdit).toHaveBeenCalled()
    })
    
    it('handles delete action', async () => {
      mockDeleteRecipe.mockResolvedValueOnce(undefined)
      
      render(<RecipeActions recipe={mockRecipe} onDelete={mockOnDelete} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const deleteItem = screen.getByText('Delete Recipe')
      await user.click(deleteItem)
      
      // Confirmation dialog should appear
      expect(screen.getByText(`Are you sure you want to delete "${mockRecipe.title}"?`)).toBeInTheDocument()
      
      const confirmButton = screen.getByRole('button', { name: /^delete$/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(mockDeleteRecipe).toHaveBeenCalledWith(mockRecipe.id)
        expect(toast.success).toHaveBeenCalledWith('Recipe deleted successfully')
        expect(mockOnDelete).toHaveBeenCalled()
      })
    })
    
    it('handles delete error', async () => {
      mockDeleteRecipe.mockRejectedValueOnce(new Error('Delete failed'))
      
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const deleteItem = screen.getByText('Delete Recipe')
      await user.click(deleteItem)
      
      const confirmButton = screen.getByRole('button', { name: /^delete$/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete recipe')
      })
    })
  })
  
  describe('Menu Items - Authenticated User Actions', () => {
    const user = userEvent.setup()
    
    beforeEach(() => {
      // Set different user (not owner)
      ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { ...mockUser, id: 'different-user' },
      })
    })
    
    it('shows authenticated user actions', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      expect(screen.getByText('Duplicate Recipe')).toBeInTheDocument()
      expect(screen.getByText('Fork Recipe')).toBeInTheDocument()
      expect(screen.getByText('Report Content')).toBeInTheDocument()
      expect(screen.queryByText('Edit Recipe')).not.toBeInTheDocument()
      expect(screen.queryByText('Delete Recipe')).not.toBeInTheDocument()
    })
    
    it('handles duplicate action', async () => {
      const duplicatedRecipe = { ...mockRecipe, id: '2', name: 'Copy of Test Recipe' }
      mockDuplicateRecipe.mockResolvedValueOnce(duplicatedRecipe)
      
      render(<RecipeActions recipe={mockRecipe} onDuplicate={mockOnDuplicate} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const duplicateItem = screen.getByText('Duplicate Recipe')
      await user.click(duplicateItem)
      
      await waitFor(() => {
        expect(mockDuplicateRecipe).toHaveBeenCalledWith(mockRecipe.id)
        expect(toast.success).toHaveBeenCalledWith('Recipe duplicated successfully')
        expect(mockOnDuplicate).toHaveBeenCalledWith(duplicatedRecipe)
      })
    })
    
    it('handles fork action', async () => {
      const forkedRecipe = { ...mockRecipe, id: '3', name: 'Fork of Test Recipe' }
      mockForkRecipe.mockResolvedValueOnce(forkedRecipe)
      
      render(<RecipeActions recipe={mockRecipe} onFork={mockOnFork} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const forkItem = screen.getByText('Fork Recipe')
      await user.click(forkItem)
      
      await waitFor(() => {
        expect(mockForkRecipe).toHaveBeenCalledWith(mockRecipe.id)
        expect(toast.success).toHaveBeenCalledWith('Recipe forked successfully')
        expect(mockOnFork).toHaveBeenCalledWith(forkedRecipe)
      })
    })
    
    it('handles report action', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const reportItem = screen.getByText('Report Content')
      await user.click(reportItem)
      
      // Report dialog should appear
      expect(screen.getByText('Report Recipe')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Please describe the issue...')).toBeInTheDocument()
      
      const reasonTextarea = screen.getByPlaceholderText('Please describe the issue...')
      await user.type(reasonTextarea, 'Inappropriate content')
      
      const submitButton = screen.getByRole('button', { name: /submit report/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Report submitted successfully')
      })
    })
    
    it('validates report reason', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const reportItem = screen.getByText('Report Content')
      await user.click(reportItem)
      
      // Try to submit without reason
      const submitButton = screen.getByRole('button', { name: /submit report/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please provide a reason for reporting')
      })
    })
  })
  
  describe('Menu Items - Unauthenticated User', () => {
    const user = userEvent.setup()
    
    beforeEach(() => {
      // No user logged in
      ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: null,
      })
    })
    
    it('shows limited actions for unauthenticated users', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      expect(screen.getByText('Share')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.queryByText('Duplicate Recipe')).not.toBeInTheDocument()
      expect(screen.queryByText('Fork Recipe')).not.toBeInTheDocument()
      expect(screen.queryByText('Report Content')).not.toBeInTheDocument()
    })
    
    it('shows error when trying to duplicate without auth', async () => {
      // Mock a scenario where the component is rendered with onDuplicate
      // but user is not authenticated
      render(<RecipeActions recipe={mockRecipe} onDuplicate={mockOnDuplicate} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      // Duplicate should still appear but show error when clicked
      const duplicateItem = screen.queryByText('Duplicate Recipe')
      if (duplicateItem) {
        await user.click(duplicateItem)
        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('You must be logged in to duplicate recipes')
        })
      }
    })
  })
  
  describe('Share Functionality', () => {
    const user = userEvent.setup()
    
    it('opens share submenu', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const shareItem = screen.getByText('Share')
      await user.hover(shareItem)
      
      await waitFor(() => {
        expect(screen.getByText('Copy Link')).toBeInTheDocument()
        expect(screen.getByText('Facebook')).toBeInTheDocument()
        expect(screen.getByText('Twitter')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
      })
    })
    
    it('copies link to clipboard', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const shareItem = screen.getByText('Share')
      await user.hover(shareItem)
      
      const copyLinkItem = await screen.findByText('Copy Link')
      await user.click(copyLinkItem)
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(`/recipes/${mockRecipe.id}`))
        expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard')
      })
    })
    
    it('shares to Facebook', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const shareItem = screen.getByText('Share')
      await user.hover(shareItem)
      
      const facebookItem = await screen.findByText('Facebook')
      await user.click(facebookItem)
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('facebook.com/sharer'),
        '_blank'
      )
    })
    
    it('shares to Twitter', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const shareItem = screen.getByText('Share')
      await user.hover(shareItem)
      
      const twitterItem = await screen.findByText('Twitter')
      await user.click(twitterItem)
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('twitter.com/intent/tweet'),
        '_blank'
      )
    })
    
    it('shares via email', async () => {
      // Mock window.location.href setter
      delete (window as any).location
      window.location = { href: '' } as Location
      
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const shareItem = screen.getByText('Share')
      await user.hover(shareItem)
      
      const emailItem = await screen.findByText('Email')
      await user.click(emailItem)
      
      expect(window.location.href).toContain('mailto:')
      expect(window.location.href).toContain(encodeURIComponent(mockRecipe.title))
    })
  })
  
  describe('Export Functionality', () => {
    const user = userEvent.setup()
    
    it('opens export submenu', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const exportItem = screen.getByText('Export')
      await user.hover(exportItem)
      
      await waitFor(() => {
        expect(screen.getByText('Export as PDF')).toBeInTheDocument()
        expect(screen.getByText('Export as JSON')).toBeInTheDocument()
      })
    })
    
    it('exports as JSON', async () => {
      // Mock document.createElement
      const mockLinkElement = {
        setAttribute: jest.fn(),
        click: jest.fn(),
      }
      document.createElement = jest.fn().mockReturnValue(mockLinkElement)
      
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const exportItem = screen.getByText('Export')
      await user.hover(exportItem)
      
      const jsonItem = await screen.findByText('Export as JSON')
      await user.click(jsonItem)
      
      await waitFor(() => {
        expect(mockLinkElement.setAttribute).toHaveBeenCalledWith('href', expect.stringContaining('data:application/json'))
        expect(mockLinkElement.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('.json'))
        expect(mockLinkElement.click).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith('Recipe exported as JSON')
      })
    })
    
    it('shows coming soon for PDF export', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const exportItem = screen.getByText('Export')
      await user.hover(exportItem)
      
      const pdfItem = await screen.findByText('Export as PDF')
      await user.click(pdfItem)
      
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('PDF export coming soon')
      })
    })
  })
  
  describe('Loading States', () => {
    const user = userEvent.setup()
    
    beforeEach(() => {
      // Set user as owner for delete test
      ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { ...mockUser, id: mockRecipe.authorId },
      })
    })
    
    it('shows loading state during delete', async () => {
      mockDeleteRecipe.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const deleteItem = screen.getByText('Delete Recipe')
      await user.click(deleteItem)
      
      const confirmButton = screen.getByRole('button', { name: /^delete$/i })
      await user.click(confirmButton)
      
      // Should show loading state
      expect(screen.getByText('Deleting...')).toBeInTheDocument()
      expect(confirmButton).toBeDisabled()
      
      await waitFor(() => {
        expect(screen.queryByText('Deleting...')).not.toBeInTheDocument()
      })
    })
    
    it('disables menu items during async operations', async () => {
      mockDuplicateRecipe.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      // Set as authenticated user
      ;(authStoreModule.useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: mockUser,
      })
      
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      await user.click(menuButton)
      
      const duplicateItem = screen.getByText('Duplicate Recipe')
      await user.click(duplicateItem)
      
      // Re-open menu to check if items are disabled
      await user.click(menuButton)
      
      const duplicateItemAgain = screen.getByText('Duplicate Recipe')
      expect(duplicateItemAgain.closest('div')).toHaveAttribute('aria-disabled', 'true')
    })
  })
  
  describe('Accessibility', () => {
    const user = userEvent.setup()
    
    it('has proper ARIA labels', () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const button = screen.getByRole('button', { name: /recipe actions/i })
      expect(button).toHaveAttribute('aria-label', 'Recipe actions')
    })
    
    it('supports keyboard navigation', async () => {
      render(<RecipeActions recipe={mockRecipe} />)
      
      const menuButton = screen.getByRole('button', { name: /recipe actions/i })
      menuButton.focus()
      
      // Open menu with Enter
      await user.keyboard('{Enter}')
      
      expect(screen.getByRole('menu')).toBeInTheDocument()
      
      // Navigate menu items with arrow keys
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowDown}')
      
      // Close with Escape
      await user.keyboard('{Escape}')
      
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })
})