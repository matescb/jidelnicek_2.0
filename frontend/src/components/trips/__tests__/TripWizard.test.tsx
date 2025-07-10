import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripWizard } from '../TripWizard'
import { TripWizardProvider } from '../TripWizardContext'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@context/ThemeContext'
import { AuthContext } from '@context/AuthContext'
import { useStore } from '@/store'
import type { AuthContextType } from '@context/AuthContext'

// Mock the store
jest.mock('@/store', () => ({
  useStore: jest.fn(),
}))

// Mock router navigation
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
}))

describe('TripWizard', () => {
  let queryClient: QueryClient
  const mockUser = {
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
  }

  const mockAuthContext: AuthContextType = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  }

  const mockCreateTrip = jest.fn()
  const mockUpdateTrip = jest.fn()
  const mockSetLoading = jest.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Setup store mock
    ;(useStore as jest.Mock).mockReturnValue({
      createTrip: mockCreateTrip,
      updateTrip: mockUpdateTrip,
      setLoading: mockSetLoading,
    })

    // Clear all mocks
    jest.clearAllMocks()
    localStorage.clear()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={mockAuthContext}>
            <ThemeProvider>
              <TripWizardProvider>
                {component}
              </TripWizardProvider>
            </ThemeProvider>
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  describe('Basic Functionality', () => {
    it('renders the wizard with the first step', () => {
      renderWithProviders(<TripWizard />)
      
      expect(screen.getByText('trips.wizard.steps.basicInfo')).toBeInTheDocument()
      expect(screen.getByLabelText('trips.fields.name')).toBeInTheDocument()
      expect(screen.getByLabelText('trips.fields.startDate')).toBeInTheDocument()
    })

    it('shows all wizard steps in the progress indicator', () => {
      renderWithProviders(<TripWizard />)
      
      expect(screen.getByText('trips.wizard.steps.basicInfo')).toBeInTheDocument()
      expect(screen.getByText('trips.wizard.steps.mealSlots')).toBeInTheDocument()
      expect(screen.getByText('trips.wizard.steps.participants')).toBeInTheDocument()
      expect(screen.getByText('trips.wizard.steps.review')).toBeInTheDocument()
    })

    it('validates required fields in the first step', async () => {
      renderWithProviders(<TripWizard />)
      
      const nextButton = screen.getByRole('button', { name: /common.next/i })
      await userEvent.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('trips.validation.nameRequired')).toBeInTheDocument()
        expect(screen.getByText('trips.validation.startDateRequired')).toBeInTheDocument()
      })
    })
  })

  describe('Step Navigation', () => {
    it('moves to the next step when valid data is provided', async () => {
      renderWithProviders(<TripWizard />)
      
      // Fill in basic info
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Test Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-07')
      
      const nextButton = screen.getByRole('button', { name: /common.next/i })
      await userEvent.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('trips.wizard.steps.mealSlots')).toHaveClass('text-primary-600')
      })
    })

    it('allows navigation back to previous steps', async () => {
      renderWithProviders(<TripWizard />)
      
      // Move to step 2
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Test Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-07')
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument()
      })
      
      // Go back
      await userEvent.click(screen.getByRole('button', { name: /common.back/i }))
      
      await waitFor(() => {
        expect(screen.getByLabelText('trips.fields.name')).toHaveValue('Test Trip')
      })
    })

    it('disables future step navigation until current step is completed', () => {
      renderWithProviders(<TripWizard />)
      
      const participantsStep = screen.getByText('trips.wizard.steps.participants')
      expect(participantsStep.parentElement).toHaveClass('opacity-50')
    })
  })

  describe('Data Persistence', () => {
    it('persists data between step navigation', async () => {
      renderWithProviders(<TripWizard />)
      
      // Fill in step 1
      const tripName = 'Persistent Trip'
      await userEvent.type(screen.getByLabelText('trips.fields.name'), tripName)
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-08-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-08-10')
      
      // Go to step 2
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      // Go back to step 1
      await waitFor(() => screen.getByRole('button', { name: /common.back/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.back/i }))
      
      // Check data is still there
      await waitFor(() => {
        expect(screen.getByLabelText('trips.fields.name')).toHaveValue(tripName)
      })
    })

    it('saves draft to localStorage', async () => {
      renderWithProviders(<TripWizard />)
      
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Draft Trip')
      
      await waitFor(() => {
        const draft = localStorage.getItem('tripWizardDraft')
        expect(draft).toBeTruthy()
        const parsedDraft = JSON.parse(draft!)
        expect(parsedDraft.basicInfo.name).toBe('Draft Trip')
      })
    })

    it('restores draft from localStorage on mount', () => {
      const draft = {
        basicInfo: {
          name: 'Restored Trip',
          startDate: '2024-09-01',
          endDate: '2024-09-07',
        },
      }
      localStorage.setItem('tripWizardDraft', JSON.stringify(draft))
      
      renderWithProviders(<TripWizard />)
      
      expect(screen.getByLabelText('trips.fields.name')).toHaveValue('Restored Trip')
    })
  })

  describe('Meal Slots Configuration', () => {
    const navigateToMealSlots = async () => {
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Test Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-03')
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
    }

    it('displays meal slots for each day', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToMealSlots()
      
      await waitFor(() => {
        expect(screen.getByText('trips.wizard.day 1')).toBeInTheDocument()
        expect(screen.getByText('trips.wizard.day 2')).toBeInTheDocument()
        expect(screen.getByText('trips.wizard.day 3')).toBeInTheDocument()
      })
    })

    it('toggles meal slot selection', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToMealSlots()
      
      await waitFor(() => {
        const firstBreakfast = screen.getAllByLabelText(/trips.mealTypes.breakfast/i)[0]
        expect(firstBreakfast).toBeChecked()
      })
      
      const firstBreakfast = screen.getAllByLabelText(/trips.mealTypes.breakfast/i)[0]
      await userEvent.click(firstBreakfast)
      
      expect(firstBreakfast).not.toBeChecked()
    })

    it('applies template to all days', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToMealSlots()
      
      await waitFor(() => screen.getByRole('button', { name: /trips.wizard.applyToAll/i }))
      
      // Uncheck lunch for day 1
      const firstLunch = screen.getAllByLabelText(/trips.mealTypes.lunch/i)[0]
      await userEvent.click(firstLunch)
      
      // Apply to all
      await userEvent.click(screen.getByRole('button', { name: /trips.wizard.applyToAll/i }))
      
      // Check that lunch is unchecked for all days
      const allLunches = screen.getAllByLabelText(/trips.mealTypes.lunch/i)
      allLunches.forEach(lunch => {
        expect(lunch).not.toBeChecked()
      })
    })
  })

  describe('Participants Management', () => {
    const navigateToParticipants = async () => {
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Test Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-03')
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      await waitFor(() => screen.getByRole('button', { name: /common.next/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
    }

    it('adds participants to the trip', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToParticipants()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /trips.participants.add/i })).toBeInTheDocument()
      })
      
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      
      const nameInput = screen.getByLabelText(/trips.participants.name/i)
      await userEvent.type(nameInput, 'John Doe')
      
      await userEvent.click(screen.getByRole('button', { name: /common.save/i }))
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('validates participant information', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToParticipants()
      
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.save/i }))
      
      await waitFor(() => {
        expect(screen.getByText('trips.participants.validation.nameRequired')).toBeInTheDocument()
      })
    })

    it('removes participants from the trip', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToParticipants()
      
      // Add a participant
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      await userEvent.type(screen.getByLabelText(/trips.participants.name/i), 'Jane Doe')
      await userEvent.click(screen.getByRole('button', { name: /common.save/i }))
      
      await waitFor(() => screen.getByText('Jane Doe'))
      
      // Remove the participant
      const removeButton = screen.getByRole('button', { name: /trips.participants.remove/i })
      await userEvent.click(removeButton)
      
      await waitFor(() => {
        expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
      })
    })
  })

  describe('Review and Submit', () => {
    const navigateToReview = async () => {
      // Basic info
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Complete Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-03')
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      // Meal slots (keep defaults)
      await waitFor(() => screen.getByRole('button', { name: /common.next/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      // Participants
      await waitFor(() => screen.getByRole('button', { name: /common.next/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
    }

    it('displays summary of all trip information', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToReview()
      
      await waitFor(() => {
        expect(screen.getByText('Complete Trip')).toBeInTheDocument()
        expect(screen.getByText('2024-07-01')).toBeInTheDocument()
        expect(screen.getByText('2024-07-03')).toBeInTheDocument()
      })
    })

    it('allows editing from review step', async () => {
      renderWithProviders(<TripWizard />)
      await navigateToReview()
      
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /common.edit/i })
        expect(editButtons.length).toBeGreaterThan(0)
      })
      
      const editButtons = screen.getAllByRole('button', { name: /common.edit/i })
      await userEvent.click(editButtons[0])
      
      await waitFor(() => {
        expect(screen.getByLabelText('trips.fields.name')).toBeInTheDocument()
      })
    })

    it('submits the trip successfully', async () => {
      mockCreateTrip.mockResolvedValue({ id: 'new-trip-1' })
      
      renderWithProviders(<TripWizard />)
      await navigateToReview()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /trips.wizard.createTrip/i })).toBeInTheDocument()
      })
      
      await userEvent.click(screen.getByRole('button', { name: /trips.wizard.createTrip/i }))
      
      await waitFor(() => {
        expect(mockCreateTrip).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Complete Trip',
            startDate: '2024-07-01',
            endDate: '2024-07-03',
          })
        )
        expect(mockNavigate).toHaveBeenCalledWith('/trips/new-trip-1')
      })
    })

    it('handles submission errors gracefully', async () => {
      mockCreateTrip.mockRejectedValue(new Error('Network error'))
      
      renderWithProviders(<TripWizard />)
      await navigateToReview()
      
      await userEvent.click(screen.getByRole('button', { name: /trips.wizard.createTrip/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/error.generic/i)).toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode', () => {
    const existingTrip = {
      id: 'existing-trip-1',
      name: 'Existing Trip',
      startDate: '2024-08-01',
      endDate: '2024-08-05',
      description: 'An existing trip',
      participants: [
        { id: 'p1', name: 'Alice', email: 'alice@example.com' },
      ],
      mealSlotConfiguration: [],
    }

    it('loads existing trip data in edit mode', () => {
      renderWithProviders(<TripWizard trip={existingTrip} />)
      
      expect(screen.getByLabelText('trips.fields.name')).toHaveValue('Existing Trip')
      expect(screen.getByLabelText('trips.fields.startDate')).toHaveValue('2024-08-01')
      expect(screen.getByLabelText('trips.fields.endDate')).toHaveValue('2024-08-05')
    })

    it('updates existing trip instead of creating new', async () => {
      mockUpdateTrip.mockResolvedValue(existingTrip)
      
      renderWithProviders(<TripWizard trip={existingTrip} />)
      
      // Navigate to review
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      await waitFor(() => screen.getByRole('button', { name: /common.next/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      await waitFor(() => screen.getByRole('button', { name: /common.next/i }))
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /trips.wizard.updateTrip/i })).toBeInTheDocument()
      })
      
      await userEvent.click(screen.getByRole('button', { name: /trips.wizard.updateTrip/i }))
      
      await waitFor(() => {
        expect(mockUpdateTrip).toHaveBeenCalledWith(
          'existing-trip-1',
          expect.any(Object)
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      renderWithProviders(<TripWizard />)
      
      const nameInput = screen.getByLabelText('trips.fields.name')
      nameInput.focus()
      
      // Tab through form fields
      await userEvent.tab()
      expect(screen.getByLabelText('trips.fields.description')).toHaveFocus()
      
      await userEvent.tab()
      expect(screen.getByLabelText('trips.fields.startDate')).toHaveFocus()
    })

    it('announces step changes to screen readers', async () => {
      renderWithProviders(<TripWizard />)
      
      // Fill required fields and go to next step
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Test Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-03')
      await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
      
      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/trips.wizard.steps.mealSlots/i)
      })
    })

    it('provides proper ARIA labels', () => {
      renderWithProviders(<TripWizard />)
      
      expect(screen.getByRole('navigation', { name: /trips.wizard.progress/i })).toBeInTheDocument()
      expect(screen.getByRole('form', { name: /trips.wizard.form/i })).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading state during submission', async () => {
      mockCreateTrip.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      renderWithProviders(<TripWizard />)
      
      // Navigate to review
      await userEvent.type(screen.getByLabelText('trips.fields.name'), 'Test Trip')
      await userEvent.type(screen.getByLabelText('trips.fields.startDate'), '2024-07-01')
      await userEvent.type(screen.getByLabelText('trips.fields.endDate'), '2024-07-03')
      
      for (let i = 0; i < 3; i++) {
        await userEvent.click(screen.getByRole('button', { name: /common.next/i }))
        await waitFor(() => screen.getByRole('button', { name: /common.next/i }))
      }
      
      await userEvent.click(screen.getByRole('button', { name: /trips.wizard.createTrip/i }))
      
      expect(screen.getByRole('button', { name: /common.loading/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /common.loading/i })).toBeDisabled()
    })
  })
})