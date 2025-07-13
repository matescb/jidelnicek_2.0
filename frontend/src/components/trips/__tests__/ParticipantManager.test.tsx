import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParticipantManager } from '../ParticipantManager'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@context/ThemeContext'
import { useStore } from '@/store'
import type { Participant } from '@/store/slices/participantStore'

// Mock the store
vi.mock('@/store', () => ({
  useStore: vi.fn(),
}))

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}))

describe('ParticipantManager', () => {
  let queryClient: QueryClient

  const mockParticipants: Participant[] = [
    {
      id: 'p1',
      name: 'John Doe',
      email: 'john@example.com',
      dietaryRestrictions: ['vegetarian'],
      allergies: ['nuts'],
      notes: 'Prefers organic food',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: 'p2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      dietaryRestrictions: [],
      allergies: ['dairy', 'gluten'],
      notes: '',
      isActive: true,
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02',
    },
    {
      id: 'p3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      dietaryRestrictions: ['vegan'],
      allergies: [],
      notes: 'Likes spicy food',
      isActive: false,
      createdAt: '2024-01-03',
      updatedAt: '2024-01-03',
    },
  ]

  const mockSelectedParticipants = ['p1', 'p2']
  const mockOnParticipantToggle = vi.fn()
  const mockOnParticipantAdd = vi.fn()
  const mockOnParticipantEdit = vi.fn()
  const mockOnParticipantRemove = vi.fn()

  const mockFetchParticipants = vi.fn()
  const mockCreateParticipant = vi.fn()
  const mockUpdateParticipant = vi.fn()
  const mockDeleteParticipant = vi.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Setup store mock
    ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
      participants: mockParticipants,
      fetchParticipants: mockFetchParticipants,
      createParticipant: mockCreateParticipant,
      updateParticipant: mockUpdateParticipant,
      deleteParticipant: mockDeleteParticipant,
      isLoading: false,
      error: null,
    })

    vi.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {component}
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  describe('Basic Rendering', () => {
    it('renders the participant manager', () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByText('trips.participants.title')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /trips.participants.add/i })).toBeInTheDocument()
    })

    it('displays all participants', () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
    })

    it('shows participant details', () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const johnCard = screen.getByText('John Doe').closest('article')
      expect(within(johnCard!).getByText('john@example.com')).toBeInTheDocument()
      expect(within(johnCard!).getByText('vegetarian')).toBeInTheDocument()
      expect(within(johnCard!).getByText('nuts')).toBeInTheDocument()
    })

    it('indicates selected participants', () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const johnCheckbox = screen.getByRole('checkbox', { name: /select John Doe/i })
      const janeCheckbox = screen.getByRole('checkbox', { name: /select Jane Smith/i })
      const bobCheckbox = screen.getByRole('checkbox', { name: /select Bob Johnson/i })
      
      expect(johnCheckbox).toBeChecked()
      expect(janeCheckbox).toBeChecked()
      expect(bobCheckbox).not.toBeChecked()
    })
  })

  describe('Participant Selection', () => {
    it('toggles participant selection', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const bobCheckbox = screen.getByRole('checkbox', { name: /select Bob Johnson/i })
      await userEvent.click(bobCheckbox)
      
      expect(mockOnParticipantToggle).toHaveBeenCalledWith('p3')
    })

    it('selects all participants', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={[]}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const selectAllButton = screen.getByRole('button', { name: /trips.participants.selectAll/i })
      await userEvent.click(selectAllButton)
      
      expect(mockOnParticipantToggle).toHaveBeenCalledWith(['p1', 'p2', 'p3'])
    })

    it('deselects all participants', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const deselectAllButton = screen.getByRole('button', { name: /trips.participants.deselectAll/i })
      await userEvent.click(deselectAllButton)
      
      expect(mockOnParticipantToggle).toHaveBeenCalledWith([])
    })
  })

  describe('Adding Participants', () => {
    it('opens add participant dialog', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantAdd={mockOnParticipantAdd}
        />
      )
      
      const addButton = screen.getByRole('button', { name: /trips.participants.add/i })
      await userEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/trips.participants.name/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/trips.participants.email/i)).toBeInTheDocument()
      })
    })

    it('validates required fields', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantAdd={mockOnParticipantAdd}
        />
      )
      
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      
      const saveButton = await screen.findByRole('button', { name: /common.save/i })
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('trips.participants.validation.nameRequired')).toBeInTheDocument()
      })
    })

    it('creates new participant', async () => {
      mockCreateParticipant.mockResolvedValue({ id: 'p4', name: 'New Person' })
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantAdd={mockOnParticipantAdd}
        />
      )
      
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      
      await userEvent.type(screen.getByLabelText(/trips.participants.name/i), 'New Person')
      await userEvent.type(screen.getByLabelText(/trips.participants.email/i), 'new@example.com')
      
      const saveButton = screen.getByRole('button', { name: /common.save/i })
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(mockCreateParticipant).toHaveBeenCalledWith({
          name: 'New Person',
          email: 'new@example.com',
          dietaryRestrictions: [],
          allergies: [],
          notes: '',
        })
        expect(mockOnParticipantAdd).toHaveBeenCalledWith('p4')
      })
    })

    it('adds dietary restrictions', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantAdd={mockOnParticipantAdd}
        />
      )
      
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      
      const dietaryInput = screen.getByLabelText(/trips.participants.dietaryRestrictions/i)
      await userEvent.type(dietaryInput, 'vegetarian{enter}')
      await userEvent.type(dietaryInput, 'gluten-free{enter}')
      
      // Check tags are displayed
      expect(screen.getByText('vegetarian')).toBeInTheDocument()
      expect(screen.getByText('gluten-free')).toBeInTheDocument()
    })

    it('adds allergies', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantAdd={mockOnParticipantAdd}
        />
      )
      
      await userEvent.click(screen.getByRole('button', { name: /trips.participants.add/i }))
      
      const allergyInput = screen.getByLabelText(/trips.participants.allergies/i)
      await userEvent.type(allergyInput, 'peanuts{enter}')
      await userEvent.type(allergyInput, 'shellfish{enter}')
      
      // Check tags are displayed
      expect(screen.getByText('peanuts')).toBeInTheDocument()
      expect(screen.getByText('shellfish')).toBeInTheDocument()
    })
  })

  describe('Editing Participants', () => {
    it('opens edit dialog for participant', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantEdit={mockOnParticipantEdit}
        />
      )
      
      const editButtons = screen.getAllByRole('button', { name: /common.edit/i })
      await userEvent.click(editButtons[0])
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByDisplayValue('John Doe')).toBeInTheDocument()
        expect(within(dialog).getByDisplayValue('john@example.com')).toBeInTheDocument()
      })
    })

    it('updates participant information', async () => {
      mockUpdateParticipant.mockResolvedValue(true)
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantEdit={mockOnParticipantEdit}
        />
      )
      
      const editButtons = screen.getAllByRole('button', { name: /common.edit/i })
      await userEvent.click(editButtons[0])
      
      const nameInput = await screen.findByDisplayValue('John Doe')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'John Smith')
      
      const saveButton = screen.getByRole('button', { name: /common.save/i })
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(mockUpdateParticipant).toHaveBeenCalledWith('p1', {
          name: 'John Smith',
          email: 'john@example.com',
          dietaryRestrictions: ['vegetarian'],
          allergies: ['nuts'],
          notes: 'Prefers organic food',
        })
        expect(mockOnParticipantEdit).toHaveBeenCalledWith('p1')
      })
    })

    it('removes dietary restriction', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantEdit={mockOnParticipantEdit}
        />
      )
      
      const editButtons = screen.getAllByRole('button', { name: /common.edit/i })
      await userEvent.click(editButtons[0])
      
      await waitFor(() => {
        const vegetarianTag = screen.getByText('vegetarian').closest('span')
        const removeButton = within(vegetarianTag!).getByRole('button', { name: /remove/i })
        userEvent.click(removeButton)
      })
      
      const saveButton = screen.getByRole('button', { name: /common.save/i })
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(mockUpdateParticipant).toHaveBeenCalledWith('p1', 
          expect.objectContaining({
            dietaryRestrictions: [],
          })
        )
      })
    })
  })

  describe('Removing Participants', () => {
    it('shows confirmation dialog before removal', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantRemove={mockOnParticipantRemove}
        />
      )
      
      const removeButtons = screen.getAllByRole('button', { name: /trips.participants.remove/i })
      await userEvent.click(removeButtons[0])
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('trips.participants.confirmRemove.title')).toBeInTheDocument()
        expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      })
    })

    it('removes participant on confirmation', async () => {
      mockDeleteParticipant.mockResolvedValue(true)
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantRemove={mockOnParticipantRemove}
        />
      )
      
      const removeButtons = screen.getAllByRole('button', { name: /trips.participants.remove/i })
      await userEvent.click(removeButtons[0])
      
      const confirmButton = await screen.findByRole('button', { name: /common.remove/i })
      await userEvent.click(confirmButton)
      
      await waitFor(() => {
        expect(mockDeleteParticipant).toHaveBeenCalledWith('p1')
        expect(mockOnParticipantRemove).toHaveBeenCalledWith('p1')
      })
    })

    it('cancels participant removal', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantRemove={mockOnParticipantRemove}
        />
      )
      
      const removeButtons = screen.getAllByRole('button', { name: /trips.participants.remove/i })
      await userEvent.click(removeButtons[0])
      
      const cancelButton = await screen.findByRole('button', { name: /common.cancel/i })
      await userEvent.click(cancelButton)
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(mockDeleteParticipant).not.toHaveBeenCalled()
      })
    })
  })

  describe('Search and Filter', () => {
    it('searches participants by name', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const searchInput = screen.getByPlaceholderText('trips.participants.search')
      await userEvent.type(searchInput, 'jane')
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument()
      })
    })

    it('filters by dietary restrictions', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /trips.participants.filter/i })
      await userEvent.click(filterButton)
      
      const vegetarianOption = await screen.findByRole('checkbox', { name: /vegetarian/i })
      await userEvent.click(vegetarianOption)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      })
    })

    it('filters by allergies', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /trips.participants.filter/i })
      await userEvent.click(filterButton)
      
      const dairyOption = await screen.findByRole('checkbox', { name: /dairy/i })
      await userEvent.click(dairyOption)
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      })
    })

    it('shows only active participants by default', () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument()
    })

    it('toggles inactive participants visibility', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const showInactiveToggle = screen.getByRole('checkbox', { name: /trips.participants.showInactive/i })
      await userEvent.click(showInactiveToggle)
      
      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })
    })
  })

  describe('Import/Export', () => {
    it('imports participants from CSV', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const importButton = screen.getByRole('button', { name: /trips.participants.import/i })
      await userEvent.click(importButton)
      
      const file = new File(['name,email\nTest User,test@example.com'], 'participants.csv', {
        type: 'text/csv',
      })
      
      const fileInput = screen.getByLabelText(/trips.participants.selectFile/i)
      await userEvent.upload(fileInput, file)
      
      await waitFor(() => {
        expect(mockCreateParticipant).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test User',
            email: 'test@example.com',
          })
        )
      })
    })

    it('exports participants to CSV', async () => {
      const createObjectURL = vi.fn()
      global.URL.createObjectURL = createObjectURL
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const exportButton = screen.getByRole('button', { name: /trips.participants.export/i })
      await userEvent.click(exportButton)
      
      expect(createObjectURL).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('provides keyboard navigation', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const firstParticipant = screen.getByText('John Doe').closest('article')
      firstParticipant!.focus()
      
      // Tab to checkbox
      await userEvent.tab()
      expect(screen.getByRole('checkbox', { name: /select John Doe/i })).toHaveFocus()
      
      // Tab to edit button
      await userEvent.tab()
      expect(screen.getAllByRole('button', { name: /common.edit/i })[0]).toHaveFocus()
    })

    it('announces selection changes', async () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const bobCheckbox = screen.getByRole('checkbox', { name: /select Bob Johnson/i })
      await userEvent.click(bobCheckbox)
      
      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/Bob Johnson selected/i)
      })
    })

    it('has proper ARIA labels', () => {
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByRole('search', { name: /search participants/i })).toBeInTheDocument()
      expect(screen.getByRole('list', { name: /participants list/i })).toBeInTheDocument()
    })
  })

  describe('Loading and Error States', () => {
    it('shows loading state', () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        participants: [],
        isLoading: true,
        error: null,
      })
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('common.loading')).toBeInTheDocument()
    })

    it('shows error state', () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        participants: [],
        isLoading: false,
        error: 'Failed to load participants',
      })
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('error.loadParticipants')).toBeInTheDocument()
    })

    it('retries on error', async () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        participants: [],
        fetchParticipants: mockFetchParticipants,
        isLoading: false,
        error: 'Failed to load participants',
      })
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={mockSelectedParticipants}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      const retryButton = screen.getByRole('button', { name: /common.retry/i })
      await userEvent.click(retryButton)
      
      expect(mockFetchParticipants).toHaveBeenCalled()
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no participants', () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        participants: [],
        fetchParticipants: mockFetchParticipants,
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={[]}
          onParticipantToggle={mockOnParticipantToggle}
        />
      )
      
      expect(screen.getByText('trips.participants.empty.title')).toBeInTheDocument()
      expect(screen.getByText('trips.participants.empty.description')).toBeInTheDocument()
    })

    it('allows adding participant from empty state', async () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        participants: [],
        fetchParticipants: mockFetchParticipants,
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(
        <ParticipantManager
          selectedParticipants={[]}
          onParticipantToggle={mockOnParticipantToggle}
          onParticipantAdd={mockOnParticipantAdd}
        />
      )
      
      const addButton = screen.getByRole('button', { name: /trips.participants.empty.cta/i })
      await userEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })
  })
})