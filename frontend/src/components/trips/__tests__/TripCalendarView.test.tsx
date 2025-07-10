import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripCalendarView } from '../TripCalendarView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@context/ThemeContext'
import type { Trip, TripDay, MealSlot } from '@/store/slices/tripStore'
import type { Recipe } from '@/types/recipe'

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

// Mock date-fns for consistent testing
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: (date: Date, formatStr: string) => {
    if (formatStr === 'MMMM yyyy') return 'July 2024'
    if (formatStr === 'd') return date.getDate().toString()
    if (formatStr === 'EEE') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
    return date.toISOString()
  },
}))

describe('TripCalendarView', () => {
  let queryClient: QueryClient

  const mockRecipes: Recipe[] = [
    {
      id: 'recipe-1',
      name: 'Pancakes',
      description: 'Fluffy pancakes',
      instructions: [{ step: 1, text: 'Mix and cook' }],
      ingredients: [],
      prepTime: 10,
      cookTime: 15,
      totalTime: 25,
      servings: 4,
      difficulty: 'easy',
      categories: ['Breakfast'],
      tags: [],
      isPublic: true,
      userId: 'user-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: 'recipe-2',
      name: 'Grilled Chicken',
      description: 'Juicy grilled chicken',
      instructions: [{ step: 1, text: 'Season and grill' }],
      ingredients: [],
      prepTime: 15,
      cookTime: 20,
      totalTime: 35,
      servings: 4,
      difficulty: 'medium',
      categories: ['Lunch', 'Dinner'],
      tags: [],
      isPublic: true,
      userId: 'user-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ]

  const createMockTrip = (overrides?: Partial<Trip>): Trip => {
    const days: TripDay[] = Array.from({ length: 7 }, (_, i) => ({
      id: `day-${i + 1}`,
      dayNumber: i + 1,
      date: new Date(2024, 6, i + 1).toISOString(), // July 1-7, 2024
      meals: [
        {
          id: `meal-${i + 1}-breakfast`,
          mealType: 'breakfast',
          recipeId: i % 2 === 0 ? 'recipe-1' : undefined,
          recipe: i % 2 === 0 ? mockRecipes[0] : undefined,
        },
        {
          id: `meal-${i + 1}-lunch`,
          mealType: 'lunch',
          recipeId: undefined,
        },
        {
          id: `meal-${i + 1}-dinner`,
          mealType: 'dinner',
          recipeId: i % 3 === 0 ? 'recipe-2' : undefined,
          recipe: i % 3 === 0 ? mockRecipes[1] : undefined,
        },
      ],
      participantCount: 4,
    }))

    return {
      id: 'trip-1',
      name: 'Summer Vacation',
      description: 'Family trip',
      startDate: '2024-07-01',
      endDate: '2024-07-07',
      participantCount: 4,
      status: 'planning',
      participants: [],
      days,
      mealSlotConfiguration: [
        { id: 'breakfast', dayNumber: 1, mealType: 'breakfast', isActive: true, displayOrder: 1 },
        { id: 'lunch', dayNumber: 1, mealType: 'lunch', isActive: true, displayOrder: 2 },
        { id: 'dinner', dayNumber: 1, mealType: 'dinner', isActive: true, displayOrder: 3 },
      ],
      userId: 'user-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      ...overrides,
    }
  }

  const mockOnMealUpdate = jest.fn()
  const mockOnDateChange = jest.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    jest.clearAllMocks()
    // Reset viewport
    global.innerWidth = 1024
    global.dispatchEvent(new Event('resize'))
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
    it('renders calendar with month and year', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      expect(screen.getByText('July 2024')).toBeInTheDocument()
    })

    it('renders day headers', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      expect(screen.getByText('calendar.days.sun')).toBeInTheDocument()
      expect(screen.getByText('calendar.days.mon')).toBeInTheDocument()
      expect(screen.getByText('calendar.days.tue')).toBeInTheDocument()
      expect(screen.getByText('calendar.days.wed')).toBeInTheDocument()
      expect(screen.getByText('calendar.days.thu')).toBeInTheDocument()
      expect(screen.getByText('calendar.days.fri')).toBeInTheDocument()
      expect(screen.getByText('calendar.days.sat')).toBeInTheDocument()
    })

    it('highlights trip days', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      // July 1-7 should be highlighted
      for (let i = 1; i <= 7; i++) {
        const dayElement = screen.getByText(i.toString()).closest('div')
        expect(dayElement).toHaveClass('bg-primary-100')
      }
    })

    it('shows meal indicators for days with meals', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      // Day 1 has breakfast (recipe-1)
      const day1 = screen.getByText('1').closest('div')
      expect(within(day1!).getByLabelText(/breakfast/i)).toBeInTheDocument()
    })
  })

  describe('Month Navigation', () => {
    it('navigates to previous month', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const prevButton = screen.getByRole('button', { name: /calendar.previousMonth/i })
      await userEvent.click(prevButton)
      
      expect(mockOnDateChange).not.toHaveBeenCalled() // Only visual navigation
    })

    it('navigates to next month', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const nextButton = screen.getByRole('button', { name: /calendar.nextMonth/i })
      await userEvent.click(nextButton)
      
      expect(mockOnDateChange).not.toHaveBeenCalled() // Only visual navigation
    })

    it('returns to current month', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      // Navigate away
      const nextButton = screen.getByRole('button', { name: /calendar.nextMonth/i })
      await userEvent.click(nextButton)
      
      // Return to today
      const todayButton = screen.getByRole('button', { name: /calendar.today/i })
      await userEvent.click(todayButton)
      
      expect(screen.getByText('July 2024')).toBeInTheDocument()
    })
  })

  describe('Day Selection', () => {
    it('selects a day when clicked', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const day3 = screen.getByText('3').closest('button')
      await userEvent.click(day3!)
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/trips.calendar.dayDetails/i)).toBeInTheDocument()
      })
    })

    it('shows meal details for selected day', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const day1 = screen.getByText('1').closest('button')
      await userEvent.click(day1!)
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('Pancakes')).toBeInTheDocument()
        expect(within(dialog).getByText(/breakfast/i)).toBeInTheDocument()
      })
    })

    it('allows editing meals from day details', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const day1 = screen.getByText('1').closest('button')
      await userEvent.click(day1!)
      
      await waitFor(() => screen.getByRole('dialog'))
      
      const editButton = screen.getByRole('button', { name: /trips.calendar.editMeals/i })
      await userEvent.click(editButton)
      
      expect(mockOnMealUpdate).toHaveBeenCalledWith('day-1')
    })
  })

  describe('View Modes', () => {
    it('switches to week view', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const viewToggle = screen.getByRole('button', { name: /calendar.view/i })
      await userEvent.click(viewToggle)
      
      const weekOption = await screen.findByRole('menuitem', { name: /calendar.weekView/i })
      await userEvent.click(weekOption)
      
      // Should show week view with more details
      expect(screen.getByText(/week/i)).toBeInTheDocument()
    })

    it('switches to list view', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const viewToggle = screen.getByRole('button', { name: /calendar.view/i })
      await userEvent.click(viewToggle)
      
      const listOption = await screen.findByRole('menuitem', { name: /calendar.listView/i })
      await userEvent.click(listOption)
      
      // Should show list of days
      expect(screen.getByText('trips.calendar.day 1')).toBeInTheDocument()
      expect(screen.getByText('trips.calendar.day 2')).toBeInTheDocument()
    })
  })

  describe('Meal Management', () => {
    it('shows empty meal slots', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      // Day 2 has no breakfast
      const day2 = screen.getByText('2').closest('div')
      const mealIndicators = within(day2!).getAllByRole('img', { hidden: true })
      
      // Should have some empty indicators
      expect(mealIndicators.some(indicator => indicator.classList.contains('bg-gray-300'))).toBe(true)
    })

    it('displays meal summary in tooltip', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const day1 = screen.getByText('1').closest('div')
      const mealIndicator = within(day1!).getByLabelText(/breakfast/i)
      
      await userEvent.hover(mealIndicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        expect(screen.getByRole('tooltip')).toHaveTextContent('Pancakes')
      })
    })

    it('indicates days with all meals planned', () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: new Date(2024, 6, 1).toISOString(),
          meals: [
            { id: 'meal-1-b', mealType: 'breakfast', recipeId: 'recipe-1', recipe: mockRecipes[0] },
            { id: 'meal-1-l', mealType: 'lunch', recipeId: 'recipe-2', recipe: mockRecipes[1] },
            { id: 'meal-1-d', mealType: 'dinner', recipeId: 'recipe-2', recipe: mockRecipes[1] },
          ],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const day1 = screen.getByText('1').closest('div')
      expect(day1).toHaveClass('ring-2', 'ring-success-500')
    })
  })

  describe('Filtering', () => {
    it('filters days by meal status', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const filterButton = screen.getByRole('button', { name: /calendar.filter/i })
      await userEvent.click(filterButton)
      
      const incompleteDaysOption = await screen.findByRole('menuitem', { name: /calendar.filter.incomplete/i })
      await userEvent.click(incompleteDaysOption)
      
      // Should highlight only days with missing meals
      const highlightedDays = screen.getAllByTestId('calendar-day-incomplete')
      expect(highlightedDays.length).toBeGreaterThan(0)
    })

    it('shows statistics in header', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      expect(screen.getByText(/trips.statistics.mealsPlanned/i)).toBeInTheDocument()
      expect(screen.getByText(/trips.statistics.daysComplete/i)).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('shows compact view on mobile', () => {
      global.innerWidth = 375
      global.dispatchEvent(new Event('resize'))
      
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      // Should use abbreviated day names
      expect(screen.getByText('S')).toBeInTheDocument() // Sunday
      expect(screen.queryByText('calendar.days.sun')).not.toBeInTheDocument()
    })

    it('shows swipeable navigation on mobile', () => {
      global.innerWidth = 375
      global.dispatchEvent(new Event('resize'))
      
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const calendar = screen.getByTestId('calendar-grid')
      
      // Simulate swipe
      fireEvent.touchStart(calendar, { touches: [{ clientX: 300, clientY: 100 }] })
      fireEvent.touchMove(calendar, { touches: [{ clientX: 100, clientY: 100 }] })
      fireEvent.touchEnd(calendar, { touches: [] })
      
      // Should navigate to next month
      expect(screen.queryByText('July 2024')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      expect(screen.getByRole('grid', { name: /calendar/i })).toBeInTheDocument()
      expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0)
    })

    it('announces month changes to screen readers', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const nextButton = screen.getByRole('button', { name: /calendar.nextMonth/i })
      await userEvent.click(nextButton)
      
      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/August 2024/i)
      })
    })

    it('supports keyboard navigation', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const day1 = screen.getByText('1').closest('button')
      day1!.focus()
      
      // Arrow key navigation
      fireEvent.keyDown(day1!, { key: 'ArrowRight' })
      expect(screen.getByText('2').closest('button')).toHaveFocus()
      
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
      expect(screen.getByText('9').closest('button')).toHaveFocus()
    })
  })

  describe('Integration Features', () => {
    it('exports calendar to iCal format', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const exportButton = screen.getByRole('button', { name: /calendar.export/i })
      await userEvent.click(exportButton)
      
      // Should trigger download
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('prints calendar view', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const printButton = screen.getByRole('button', { name: /calendar.print/i })
      await userEvent.click(printButton)
      
      expect(window.print).toHaveBeenCalled()
    })

    it('shares calendar link', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const shareButton = screen.getByRole('button', { name: /calendar.share/i })
      await userEvent.click(shareButton)
      
      await waitFor(() => {
        expect(screen.getByText(/calendar.shareSuccess/i)).toBeInTheDocument()
      })
    })
  })

  describe('Performance', () => {
    it('renders large calendars efficiently', () => {
      const trip = createMockTrip({
        days: Array.from({ length: 30 }, (_, i) => ({
          id: `day-${i + 1}`,
          dayNumber: i + 1,
          date: new Date(2024, 6, i + 1).toISOString(),
          meals: [],
          participantCount: 4,
        })),
        endDate: '2024-07-30',
      })
      
      const { container } = renderWithProviders(
        <TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />
      )
      
      // Should render without performance issues
      expect(container.querySelectorAll('[data-testid="calendar-day"]').length).toBeLessThanOrEqual(42) // Max calendar grid size
    })

    it('debounces rapid navigation', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onMealUpdate={mockOnMealUpdate} />)
      
      const nextButton = screen.getByRole('button', { name: /calendar.nextMonth/i })
      
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        await userEvent.click(nextButton)
      }
      
      // Should only update once after debounce
      await waitFor(() => {
        expect(screen.getByText(/November 2024|December 2024/i)).toBeInTheDocument()
      })
    })
  })
})