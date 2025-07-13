import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripListPage } from '@/pages/trips/TripListPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@context/ThemeContext'
import { AuthContext } from '@context/AuthContext'
import { useStore } from '@/store'
import type { AuthContextType } from '@context/AuthContext'
import type { Trip } from '@/store/slices/tripStore'

// Mock the store
vi.mock('@/store', () => ({
  useStore: vi.fn(),
}))

// Mock router navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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

describe('TripListPage', () => {
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
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  }

  const mockTrips: Trip[] = [
    {
      id: '1',
      name: 'Summer Vacation 2024',
      description: 'Family trip to the mountains',
      startDate: '2024-07-01',
      endDate: '2024-07-14',
      participantCount: 4,
      status: 'planning',
      participants: [],
      days: [],
      mealSlotConfiguration: [],
      userId: 'test-user-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: '2',
      name: 'Weekend Getaway',
      description: 'Quick trip to the beach',
      startDate: '2024-08-15',
      endDate: '2024-08-17',
      participantCount: 2,
      status: 'active',
      participants: [],
      days: [],
      mealSlotConfiguration: [],
      userId: 'test-user-1',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    },
    {
      id: '3',
      name: 'Christmas Holiday',
      description: 'Holiday celebration with family',
      startDate: '2024-12-23',
      endDate: '2024-12-27',
      participantCount: 8,
      status: 'completed',
      participants: [],
      days: [],
      mealSlotConfiguration: [],
      userId: 'test-user-1',
      createdAt: '2024-01-20',
      updatedAt: '2024-01-20',
    },
  ]

  const mockFetchTrips = vi.fn()
  const mockDeleteTrip = vi.fn()
  const mockSetFilter = vi.fn()
  const mockSetSort = vi.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Setup store mock
    ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
      trips: mockTrips,
      fetchTrips: mockFetchTrips,
      deleteTrip: mockDeleteTrip,
      setFilter: mockSetFilter,
      setSort: mockSetSort,
      isLoading: false,
      error: null,
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <MemoryRouter initialEntries={['/trips']}>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={mockAuthContext}>
            <ThemeProvider>
              <Routes>
                <Route path="/trips" element={component} />
                <Route path="/trips/new" element={<div>Create Trip Page</div>} />
                <Route path="/trips/:id" element={<div>Trip Detail Page</div>} />
              </Routes>
            </ThemeProvider>
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  describe('Basic Functionality', () => {
    it('renders the trip list page with header', () => {
      renderWithProviders(<TripListPage />)
      
      expect(screen.getByText('trips.title')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /trips.createNew/i })).toBeInTheDocument()
    })

    it('displays all trips in the list', () => {
      renderWithProviders(<TripListPage />)
      
      expect(screen.getByText('Summer Vacation 2024')).toBeInTheDocument()
      expect(screen.getByText('Weekend Getaway')).toBeInTheDocument()
      expect(screen.getByText('Christmas Holiday')).toBeInTheDocument()
    })

    it('shows trip details in cards', () => {
      renderWithProviders(<TripListPage />)
      
      const summerTrip = screen.getByText('Summer Vacation 2024').closest('article')
      expect(within(summerTrip!).getByText('Family trip to the mountains')).toBeInTheDocument()
      expect(within(summerTrip!).getByText(/07\/01\/2024/)).toBeInTheDocument()
      expect(within(summerTrip!).getByText(/4/)).toBeInTheDocument() // participant count
    })

    it('fetches trips on mount', () => {
      renderWithProviders(<TripListPage />)
      
      expect(mockFetchTrips).toHaveBeenCalledTimes(1)
    })
  })

  describe('Navigation', () => {
    it('navigates to create trip page', async () => {
      renderWithProviders(<TripListPage />)
      
      const createButton = screen.getByRole('button', { name: /trips.createNew/i })
      await userEvent.click(createButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/trips/new')
    })

    it('navigates to trip detail page on click', async () => {
      renderWithProviders(<TripListPage />)
      
      const tripCard = screen.getByText('Summer Vacation 2024').closest('article')
      await userEvent.click(tripCard!)
      
      expect(mockNavigate).toHaveBeenCalledWith('/trips/1')
    })
  })

  describe('Empty States', () => {
    it('shows empty state when no trips exist', () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: [],
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(<TripListPage />)
      
      expect(screen.getByText('trips.empty.title')).toBeInTheDocument()
      expect(screen.getByText('trips.empty.description')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /trips.empty.cta/i })).toBeInTheDocument()
    })

    it('navigates to create trip from empty state', async () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: [],
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(<TripListPage />)
      
      const createButton = screen.getByRole('button', { name: /trips.empty.cta/i })
      await userEvent.click(createButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/trips/new')
    })
  })

  describe('Loading and Error States', () => {
    it('shows loading state', () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: [],
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        isLoading: true,
        error: null,
      })
      
      renderWithProviders(<TripListPage />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('common.loading')).toBeInTheDocument()
    })

    it('shows error state', () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: [],
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        isLoading: false,
        error: 'Failed to fetch trips',
      })
      
      renderWithProviders(<TripListPage />)
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('error.fetchTrips')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /common.retry/i })).toBeInTheDocument()
    })

    it('retries fetching on error', async () => {
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: [],
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        isLoading: false,
        error: 'Failed to fetch trips',
      })
      
      renderWithProviders(<TripListPage />)
      
      const retryButton = screen.getByRole('button', { name: /common.retry/i })
      await userEvent.click(retryButton)
      
      expect(mockFetchTrips).toHaveBeenCalledTimes(2) // Once on mount, once on retry
    })
  })

  describe('Filtering and Sorting', () => {
    it('filters trips by status', async () => {
      renderWithProviders(<TripListPage />)
      
      const filterSelect = screen.getByLabelText(/trips.filter.status/i)
      await userEvent.selectOptions(filterSelect, 'planning')
      
      expect(mockSetFilter).toHaveBeenCalledWith({ status: 'planning' })
    })

    it('filters trips by date range', async () => {
      renderWithProviders(<TripListPage />)
      
      const startDateInput = screen.getByLabelText(/trips.filter.startDate/i)
      const endDateInput = screen.getByLabelText(/trips.filter.endDate/i)
      
      await userEvent.type(startDateInput, '2024-07-01')
      await userEvent.type(endDateInput, '2024-08-31')
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2024-07-01',
            endDate: '2024-08-31',
          })
        )
      })
    })

    it('sorts trips by different criteria', async () => {
      renderWithProviders(<TripListPage />)
      
      const sortSelect = screen.getByLabelText(/trips.sort.by/i)
      await userEvent.selectOptions(sortSelect, 'name')
      
      expect(mockSetSort).toHaveBeenCalledWith({ field: 'name', direction: 'asc' })
    })

    it('toggles sort direction', async () => {
      renderWithProviders(<TripListPage />)
      
      const sortDirectionButton = screen.getByRole('button', { name: /trips.sort.direction/i })
      await userEvent.click(sortDirectionButton)
      
      expect(mockSetSort).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'desc' })
      )
    })
  })

  describe('Trip Actions', () => {
    it('opens action menu for trip', async () => {
      renderWithProviders(<TripListPage />)
      
      const moreButtons = screen.getAllByRole('button', { name: /common.moreOptions/i })
      await userEvent.click(moreButtons[0])
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /common.edit/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /common.duplicate/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /common.delete/i })).toBeInTheDocument()
      })
    })

    it('navigates to edit trip', async () => {
      renderWithProviders(<TripListPage />)
      
      const moreButtons = screen.getAllByRole('button', { name: /common.moreOptions/i })
      await userEvent.click(moreButtons[0])
      
      const editButton = await screen.findByRole('menuitem', { name: /common.edit/i })
      await userEvent.click(editButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/trips/1/edit')
    })

    it('duplicates a trip', async () => {
      const mockDuplicateTrip = vi.fn().mockResolvedValue({ id: 'new-trip-id' })
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: mockTrips,
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        duplicateTrip: mockDuplicateTrip,
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(<TripListPage />)
      
      const moreButtons = screen.getAllByRole('button', { name: /common.moreOptions/i })
      await userEvent.click(moreButtons[0])
      
      const duplicateButton = await screen.findByRole('menuitem', { name: /common.duplicate/i })
      await userEvent.click(duplicateButton)
      
      await waitFor(() => {
        expect(mockDuplicateTrip).toHaveBeenCalledWith('1')
        expect(mockNavigate).toHaveBeenCalledWith('/trips/new-trip-id/edit')
      })
    })

    it('deletes a trip with confirmation', async () => {
      renderWithProviders(<TripListPage />)
      
      const moreButtons = screen.getAllByRole('button', { name: /common.moreOptions/i })
      await userEvent.click(moreButtons[0])
      
      const deleteButton = await screen.findByRole('menuitem', { name: /common.delete/i })
      await userEvent.click(deleteButton)
      
      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('trips.delete.confirm.title')).toBeInTheDocument()
        expect(screen.getByText('trips.delete.confirm.message')).toBeInTheDocument()
      })
      
      const confirmButton = screen.getByRole('button', { name: /common.delete/i })
      await userEvent.click(confirmButton)
      
      await waitFor(() => {
        expect(mockDeleteTrip).toHaveBeenCalledWith('1')
      })
    })

    it('cancels trip deletion', async () => {
      renderWithProviders(<TripListPage />)
      
      const moreButtons = screen.getAllByRole('button', { name: /common.moreOptions/i })
      await userEvent.click(moreButtons[0])
      
      const deleteButton = await screen.findByRole('menuitem', { name: /common.delete/i })
      await userEvent.click(deleteButton)
      
      const cancelButton = await screen.findByRole('button', { name: /common.cancel/i })
      await userEvent.click(cancelButton)
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(mockDeleteTrip).not.toHaveBeenCalled()
      })
    })
  })

  describe('List View Options', () => {
    it('switches between grid and list view', async () => {
      renderWithProviders(<TripListPage />)
      
      // Default is grid view
      expect(screen.getByRole('button', { name: /view.grid/i })).toHaveAttribute('aria-pressed', 'true')
      
      // Switch to list view
      const listViewButton = screen.getByRole('button', { name: /view.list/i })
      await userEvent.click(listViewButton)
      
      expect(listViewButton).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /view.grid/i })).toHaveAttribute('aria-pressed', 'false')
    })

    it('persists view preference', async () => {
      renderWithProviders(<TripListPage />)
      
      const listViewButton = screen.getByRole('button', { name: /view.list/i })
      await userEvent.click(listViewButton)
      
      expect(localStorage.getItem('tripListView')).toBe('list')
    })
  })

  describe('Search', () => {
    it('searches trips by name', async () => {
      renderWithProviders(<TripListPage />)
      
      const searchInput = screen.getByPlaceholderText(/trips.search.placeholder/i)
      await userEvent.type(searchInput, 'Summer')
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Summer' })
        )
      })
    })

    it('clears search', async () => {
      renderWithProviders(<TripListPage />)
      
      const searchInput = screen.getByPlaceholderText(/trips.search.placeholder/i)
      await userEvent.type(searchInput, 'Summer')
      
      const clearButton = screen.getByRole('button', { name: /common.clear/i })
      await userEvent.click(clearButton)
      
      expect(searchInput).toHaveValue('')
      expect(mockSetFilter).toHaveBeenCalledWith(
        expect.objectContaining({ search: '' })
      )
    })
  })

  describe('Pagination', () => {
    it('shows pagination when trips exceed page size', () => {
      const manyTrips = Array.from({ length: 25 }, (_, i) => ({
        ...mockTrips[0],
        id: `trip-${i}`,
        name: `Trip ${i + 1}`,
      }))
      
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: manyTrips,
        totalTrips: 25,
        currentPage: 1,
        pageSize: 10,
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        setPage: vi.fn(),
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(<TripListPage />)
      
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
      expect(screen.getByText('1')).toHaveAttribute('aria-current', 'page')
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('navigates between pages', async () => {
      const setPage = vi.fn()
      ;(useStore as ReturnType<typeof vi.fn>).mockReturnValue({
        trips: mockTrips,
        totalTrips: 25,
        currentPage: 1,
        pageSize: 10,
        fetchTrips: mockFetchTrips,
        deleteTrip: mockDeleteTrip,
        setPage,
        isLoading: false,
        error: null,
      })
      
      renderWithProviders(<TripListPage />)
      
      const page2Button = screen.getByText('2')
      await userEvent.click(page2Button)
      
      expect(setPage).toHaveBeenCalledWith(2)
    })
  })

  describe('Responsive Design', () => {
    it('shows mobile-friendly layout on small screens', () => {
      // Mock small screen size
      global.innerWidth = 375
      global.dispatchEvent(new Event('resize'))
      
      renderWithProviders(<TripListPage />)
      
      // Check for mobile-specific elements
      expect(screen.queryByRole('button', { name: /view.grid/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /trips.filter.toggle/i })).toBeInTheDocument()
    })

    it('shows filter drawer on mobile', async () => {
      global.innerWidth = 375
      global.dispatchEvent(new Event('resize'))
      
      renderWithProviders(<TripListPage />)
      
      const filterToggle = screen.getByRole('button', { name: /trips.filter.toggle/i })
      await userEvent.click(filterToggle)
      
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /trips.filter.title/i })).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithProviders(<TripListPage />)
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('trips.title')
    })

    it('announces list updates to screen readers', async () => {
      renderWithProviders(<TripListPage />)
      
      // Trigger a filter change
      const filterSelect = screen.getByLabelText(/trips.filter.status/i)
      await userEvent.selectOptions(filterSelect, 'active')
      
      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/trips.results.count/i)
      })
    })

    it('provides keyboard navigation for trip cards', async () => {
      renderWithProviders(<TripListPage />)
      
      const firstTrip = screen.getByText('Summer Vacation 2024').closest('article')
      firstTrip!.focus()
      
      // Should be able to activate with Enter key
      fireEvent.keyDown(firstTrip!, { key: 'Enter' })
      
      expect(mockNavigate).toHaveBeenCalledWith('/trips/1')
    })
  })
})