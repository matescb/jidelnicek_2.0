import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { TripListView } from '../TripListView'
import { useTripStore } from '@/store/slices/tripStore'
import type { Trip } from '@/store/slices/tripStore'

// Mock the store
vi.mock('@/store/slices/tripStore')

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`
      }
      return key
    },
  }),
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => `formatted-date`,
}))

describe('TripListView', () => {
  const mockTrips: Trip[] = [
    {
      id: '1',
      name: 'Summer Camp 2024',
      description: 'Annual summer camp',
      startDate: '2024-07-01',
      endDate: '2024-07-15',
      participantCount: 25,
      status: 'planning',
      mealSlotConfiguration: [
        {
          id: '1',
          dayNumber: 1,
          mealType: 'breakfast',
          isActive: true,
          displayOrder: 1,
        },
        {
          id: '2',
          dayNumber: 1,
          mealType: 'lunch',
          isActive: true,
          displayOrder: 2,
        },
      ],
      participants: [],
      days: [
        {
          id: '1',
          dayNumber: 1,
          date: '2024-07-01',
          meals: [
            {
              id: '1',
              dayId: '1',
              mealSlot: 'breakfast',
              recipe: {
                id: '1',
                name: 'Pancakes',
                description: 'Fluffy pancakes',
                prepTimeMinutes: 30,
                cookTimeMinutes: 15,
                servings: 4,
                ingredients: [],
                instructions: [],
                categories: [],
                difficulty: 'easy',
                isPublic: true,
                userId: 'user1',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            },
          ],
          participantCount: 25,
        },
      ],
      userId: 'user1',
      location: 'Mountain Resort',
      isArchived: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: '2',
      name: 'Family Reunion',
      startDate: '2024-08-10',
      endDate: '2024-08-12',
      participantCount: 15,
      status: 'active',
      mealSlotConfiguration: [],
      participants: [],
      days: [],
      userId: 'user1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ]

  const mockStore = {
    trips: mockTrips,
    loading: false,
    totalTrips: 2,
    currentPage: 1,
    pageSize: 20,
    filters: {},
    sortBy: 'startDate',
    sortOrder: 'desc',
    fetchTrips: vi.fn(),
    setFilters: vi.fn(),
    setSorting: vi.fn(),
    duplicateTrip: vi.fn(),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useTripStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockStore)
  })

  it('renders trip list with correct data', () => {
    render(<TripListView />)
    
    expect(screen.getByText('Summer Camp 2024')).toBeInTheDocument()
    expect(screen.getByText('Mountain Resort')).toBeInTheDocument()
    expect(screen.getByText('Family Reunion')).toBeInTheDocument()
  })

  it('displays meal planning progress', () => {
    render(<TripListView />)
    
    // Check for progress bars
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars).toHaveLength(2)
  })

  it('shows status badges', () => {
    render(<TripListView />)
    
    expect(screen.getByText('trips.status.planning')).toBeInTheDocument()
    expect(screen.getByText('trips.status.active')).toBeInTheDocument()
  })

  it('handles search input', async () => {
    const user = userEvent.setup()
    render(<TripListView />)
    
    const searchInput = screen.getByPlaceholderText('trips.filters.searchPlaceholder')
    await user.type(searchInput, 'Summer')
    
    await waitFor(() => {
      expect(mockStore.setFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Summer',
        })
      )
    })
  })

  it('handles status filter selection', async () => {
    const user = userEvent.setup()
    render(<TripListView />)
    
    // Open status filter dropdown
    const statusButton = screen.getByText('trips.filters.status')
    await user.click(statusButton)
    
    // Select planning status
    const planningCheckbox = screen.getByLabelText('trips.status.planning')
    await user.click(planningCheckbox)
    
    expect(mockStore.setFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ['planning'],
      })
    )
  })

  it('handles sorting', async () => {
    const user = userEvent.setup()
    render(<TripListView />)
    
    // Click on name column header to sort
    const nameHeader = screen.getByText('trips.fields.name')
    await user.click(nameHeader)
    
    expect(mockStore.setSorting).toHaveBeenCalledWith('name', 'asc')
  })

  it('handles trip actions', async () => {
    const user = userEvent.setup()
    const mockNavigate = vi.fn()
    vi.mock('react-router-dom', () => ({
      useNavigate: () => mockNavigate,
    }))
    
    render(<TripListView />)
    
    // Open actions menu for first trip
    const actionButtons = screen.getAllByRole('button', { name: '' })
    const firstActionButton = actionButtons.find(btn => 
      btn.querySelector('svg')?.classList.contains('h-4')
    )
    
    if (firstActionButton) {
      await user.click(firstActionButton)
      
      // Click duplicate action
      const duplicateButton = screen.getByText('common.duplicate')
      await user.click(duplicateButton)
      
      expect(mockStore.duplicateTrip).toHaveBeenCalledWith('1')
    }
  })

  it('switches between list and calendar view', async () => {
    const user = userEvent.setup()
    render(<TripListView />)
    
    // Initially in list view
    expect(screen.getByRole('table')).toBeInTheDocument()
    
    // Switch to calendar view
    const calendarTab = screen.getByText('common.calendar')
    await user.click(calendarTab)
    
    // Calendar view should be shown
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows empty state when no trips', () => {
    ;(useTripStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      trips: [],
      totalTrips: 0,
    })
    
    render(<TripListView />)
    
    expect(screen.getByText('trips.empty')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    ;(useTripStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      loading: true,
    })
    
    render(<TripListView />)
    
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('handles custom onTripSelect callback', async () => {
    const user = userEvent.setup()
    const mockOnSelect = vi.fn()
    
    render(<TripListView onTripSelect={mockOnSelect} />)
    
    // Click on a trip row
    const tripRow = screen.getByText('Summer Camp 2024').closest('tr')
    if (tripRow) {
      await user.click(tripRow)
      expect(mockOnSelect).toHaveBeenCalledWith(mockTrips[0])
    }
  })

  it('displays budget indicators', () => {
    render(<TripListView />)
    
    // Check for budget indicators (dollar signs)
    const dollarIcons = screen.getAllByTestId('dollar-sign-icon')
    expect(dollarIcons.length).toBeGreaterThan(0)
  })

  it('handles pagination', async () => {
    const user = userEvent.setup()
    ;(useTripStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      totalTrips: 50,
      pageSize: 20,
    })
    
    render(<TripListView />)
    
    // Next page button should be enabled
    const nextButton = screen.getByText('common.next')
    expect(nextButton).not.toBeDisabled()
    
    await user.click(nextButton)
    expect(mockStore.fetchTrips).toHaveBeenCalledWith(2)
  })

  it('clears all filters', async () => {
    const user = userEvent.setup()
    ;(useTripStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      filters: {
        search: 'test',
        status: ['planning'],
      },
    })
    
    render(<TripListView />)
    
    // Open advanced filters
    const advancedButton = screen.getByText('trips.filters.advanced')
    await user.click(advancedButton)
    
    // Click clear filters
    const clearButton = screen.getByText('trips.filters.clear')
    await user.click(clearButton)
    
    expect(mockStore.setFilters).toHaveBeenCalledWith({})
  })
})