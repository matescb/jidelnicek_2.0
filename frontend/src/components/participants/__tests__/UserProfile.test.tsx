import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfile, UserProfileModal } from '../UserProfile'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { User } from '@/types'

// Mock modules
jest.mock('@/hooks/useAuth')
jest.mock('@/hooks/useToast')
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date | string, formatStr: string) => {
    if (formatStr === 'MMM yyyy') return 'Jan 2024'
    if (formatStr === 'MMM d') return 'Jul 1'
    if (formatStr === 'MMM d, yyyy') return 'Jul 14, 2024'
    return 'January 15, 2024'
  }),
  parseISO: jest.fn((date: string) => new Date(date)),
}))

const mockUseAuth = useAuth as vi.MockedFunction<typeof useAuth>
const mockUseToast = useToast as vi.MockedFunction<typeof useToast>

describe('UserProfile', () => {
  const mockCurrentUser: User = {
    id: 'user-123',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    emailVerified: true,
    role: 'user',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-03-20T15:30:00Z'
  }

  const mockAddToast = jest.fn()
  const mockOnClose = jest.fn()
  const mockOnSave = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseAuth.mockReturnValue({
      user: mockCurrentUser,
      login: jest.fn(),
      logout: jest.fn(),
      isAuthenticated: true,
      isLoading: false,
      error: null
    } as any)

    mockUseToast.mockReturnValue({
      addToast: mockAddToast,
      toasts: [],
      removeToast: jest.fn(),
      clearToasts: jest.fn()
    } as any)

    // Mock file input
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = jest.fn()
    
    // Mock FileReader
    global.FileReader = jest.fn().mockImplementation(() => ({
      readAsDataURL: jest.fn(),
      onloadend: jest.fn(),
      result: 'data:image/jpeg;base64,mockbase64data'
    })) as any
  })

  const renderComponent = (props = {}) => {
    return render(
      <UserProfile
        canEdit={true}
        {...props}
      />
    )
  }

  describe('Rendering', () => {
    it('renders user profile with all tabs', () => {
      renderComponent()
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      
      // Check tabs
      expect(screen.getByRole('tab', { name: 'Basic Info' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Dietary' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Preferences' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Notifications' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    })
    
    it('renders all profile sections correctly', () => {
      renderComponent()
      
      // Basic Info tab is active by default
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      expect(screen.getByText('Contact Information')).toBeInTheDocument()
      expect(screen.getByText('Emergency Contact')).toBeInTheDocument()
    })

    it('displays profile picture or fallback icon', () => {
      renderComponent()
      
      const avatar = screen.getByAltText('John Doe')
      expect(avatar).toHaveAttribute('src', '/api/placeholder/150/150')
    })

    it('shows verified badge for verified email', () => {
      renderComponent()
      
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('displays member since date', () => {
      renderComponent()
      
      expect(screen.getByText(/Member since Jan 2024/)).toBeInTheDocument()
    })

    it('renders in modal mode', () => {
      renderComponent({ isModal: true, onClose: mockOnClose })
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('User Profile')).toBeInTheDocument()
    })
    
    it('renders UserProfileModal component', () => {
      render(<UserProfileModal userId="123" onClose={mockOnClose} />)
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('User Profile')).toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    it('toggles edit mode', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      const editButton = screen.getByRole('button', { name: /Edit Profile/i })
      await user.click(editButton)
      
      // Check for input fields in edit mode
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })
    
    it('shows edit button only when user has permission', () => {
      // Test own profile
      renderComponent({ userId: 'user-123' })
      expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument()
      
      // Test other user's profile
      renderComponent({ userId: 'other-user', canEdit: false })
      expect(screen.queryByRole('button', { name: /Edit Profile/i })).not.toBeInTheDocument()
    })
    
    it('allows admin to edit any profile', () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockCurrentUser, role: 'admin' },
        login: jest.fn(),
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        error: null
      } as any)
      
      renderComponent({ userId: 'other-user' })
      expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument()
    })

    it('cancels edit mode and reverts changes', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      const firstNameInput = screen.getByDisplayValue('John')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      await user.click(screen.getByRole('button', { name: /Cancel/i }))
      
      // Should revert changes
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Jane')).not.toBeInTheDocument()
    })

    it('saves profile changes', async () => {
      const user = userEvent.setup()
      renderComponent({ onSave: mockOnSave })
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      const firstNameInput = screen.getByDisplayValue('John')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      const phoneInput = screen.getByDisplayValue('+1 (555) 123-4567')
      await user.clear(phoneInput)
      await user.type(phoneInput, '+1 (555) 999-8888')
      
      await user.click(screen.getByRole('button', { name: /Save/i }))
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'Jane',
            phone: '+1 (555) 999-8888',
          })
        )
        expect(mockAddToast).toHaveBeenCalledWith({
          title: 'Profile Updated',
          message: 'Your profile has been successfully updated.',
          type: 'success',
        })
      })
    })
    
    it('shows saving state while saving', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      await user.click(screen.getByRole('button', { name: /Save/i }))
      
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    it('disables edit when canEdit is false', () => {
      renderComponent({ canEdit: false })
      
      expect(screen.queryByRole('button', { name: /Edit Profile/ })).not.toBeInTheDocument()
    })
  })

  describe('Avatar Upload', () => {
    it('shows camera button in edit mode', async () => {
      const user = userEvent.setup()
      const { container } = renderComponent()
      
      // Camera button should not be visible initially
      expect(container.querySelector('.lucide-camera')).not.toBeInTheDocument()
      
      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      // Camera button should now be visible
      expect(container.querySelector('.lucide-camera')).toBeInTheDocument()
    })

    it('handles avatar file selection', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      const fileInput = screen.getByRole('button', { name: '' }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('accept', 'image/*')
      
      // Mock FileReader behavior
      const mockFileReader = {
        readAsDataURL: jest.fn(),
        result: 'data:image/jpeg;base64,mockbase64data',
        onloadend: null as any
      }
      
      global.FileReader = jest.fn().mockImplementation(() => mockFileReader) as any
      
      // Simulate file selection
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      
      fireEvent.change(fileInput)
      
      // Trigger onloadend callback
      mockFileReader.onloadend?.()
      
      await waitFor(() => {
        expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file)
      })
    })
  })

  describe('Form Validation', () => {
    it('validates email format', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      const emailInput = screen.getByDisplayValue('john.doe@example.com')
      await user.clear(emailInput)
      await user.type(emailInput, 'invalid-email')
      
      // Email input should accept the value (HTML5 validation happens on submit)
      expect(emailInput).toHaveValue('invalid-email')
      expect(emailInput).toHaveAttribute('type', 'email')
    })
    
    it('validates phone format', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      const phoneInput = screen.getByDisplayValue('+1 (555) 123-4567')
      expect(phoneInput).toHaveAttribute('type', 'tel')
    })

    it('validates required fields', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      // Clear required fields
      const firstNameInput = screen.getByDisplayValue('John')
      const lastNameInput = screen.getByDisplayValue('Doe')
      const emailInput = screen.getByDisplayValue('john.doe@example.com')
      
      await user.clear(firstNameInput)
      await user.clear(lastNameInput)
      await user.clear(emailInput)
      
      // Try to save
      await user.click(screen.getByRole('button', { name: /Save/i }))
      
      // Should not call onSave with empty required fields
      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled()
      })
    })
  })
  
  describe('Error Handling', () => {
    it('handles save errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock save to throw error
      const mockOnSaveError = jest.fn().mockRejectedValue(new Error('Network error'))
      renderComponent({ onSave: mockOnSaveError })
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      await user.click(screen.getByRole('button', { name: /Save/i }))
      
      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          title: 'Update Failed',
          message: 'Failed to update profile. Please try again.',
          type: 'error'
        })
      })
    })

    it('disables save and cancel buttons while saving', async () => {
      const user = userEvent.setup()
      
      // Mock save to be slow
      const mockOnSaveSlow = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      renderComponent({ onSave: mockOnSaveSlow })
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      const saveButton = screen.getByRole('button', { name: /Save/i })
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      
      await user.click(saveButton)
      
      // Both buttons should be disabled while saving
      expect(saveButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('Permission Checks', () => {
    it('allows users to edit their own profile', () => {
      renderComponent({ userId: 'user-123' })
      expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument()
    })
    
    it('prevents users from editing other profiles', () => {
      renderComponent({ userId: 'other-user-456', canEdit: false })
      expect(screen.queryByRole('button', { name: /Edit Profile/i })).not.toBeInTheDocument()
    })
    
    it('allows admins to edit any profile', () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockCurrentUser, role: 'admin' },
        login: jest.fn(),
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        error: null
      } as any)
      
      renderComponent({ userId: 'other-user-456' })
      expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument()
    })
    
    it('respects explicit canEdit prop', () => {
      // Even if user is admin, respect explicit canEdit=false
      mockUseAuth.mockReturnValue({
        user: { ...mockCurrentUser, role: 'admin' },
        login: jest.fn(),
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        error: null
      } as any)
      
      renderComponent({ userId: 'other-user-456', canEdit: false })
      expect(screen.queryByRole('button', { name: /Edit Profile/i })).not.toBeInTheDocument()
    })
  })

  describe('Responsive Tab Navigation', () => {
    it('renders tabs in responsive grid', () => {
      renderComponent()
      
      const tabsList = screen.getByRole('tablist')
      expect(tabsList).toBeInTheDocument()
    })
    
    it('switches between tabs correctly', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Start on Basic Info
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      
      // Switch to Dietary
      await user.click(screen.getByRole('tab', { name: 'Dietary' }))
      await waitFor(() => {
        expect(screen.getByText('Dietary Restrictions & Allergies')).toBeInTheDocument()
      })
      
      // Switch to Preferences
      await user.click(screen.getByRole('tab', { name: 'Preferences' }))
      await waitFor(() => {
        expect(screen.getByText('Trip Preferences')).toBeInTheDocument()
      })
      
      // Switch to Notifications
      await user.click(screen.getByRole('tab', { name: 'Notifications' }))
      await waitFor(() => {
        expect(screen.getByText('Notification Settings')).toBeInTheDocument()
      })
      
      // Switch to History
      await user.click(screen.getByRole('tab', { name: 'History' }))
      await waitFor(() => {
        expect(screen.getByText('Participation History')).toBeInTheDocument()
      })
    })
  })

  describe('Cancel Functionality', () => {
    it('reverts all changes on cancel', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }))
      
      // Make multiple changes
      const firstNameInput = screen.getByDisplayValue('John')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jane')
      
      const phoneInput = screen.getByDisplayValue('+1 (555) 123-4567')
      await user.clear(phoneInput)
      await user.type(phoneInput, '+1 (555) 999-8888')
      
      // Cancel all changes
      await user.click(screen.getByRole('button', { name: /Cancel/i }))
      
      // Verify all changes are reverted
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Jane')).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue('+1 (555) 999-8888')).not.toBeInTheDocument()
    })
  })
})