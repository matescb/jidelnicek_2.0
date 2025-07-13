import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripCalendarView } from '../TripCalendarView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@context/ThemeContext'
import type { Trip, DayPlan, MealSlot, Meal } from '@/store/slices/tripStore'
import type { Recipe } from '@/types/recipe'

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

// Mock the I18n formats hook
vi.mock('@/hooks/useI18nFormats', () => ({
  useI18nFormats: () => ({
    formatDate: (date: Date) => date.toLocaleDateString(),
    formatTime: (date: Date) => date.toLocaleTimeString(),
    formatDateTime: (date: Date) => date.toLocaleString(),
  }),
}))

// Mock date-fns for consistent testing - keep most real functionality
vi.mock('date-fns', () => {
  const actualDateFns = vi.importActual('date-fns')
  return {
    ...actualDateFns,
    format: (date: Date, formatStr: string) => {
      if (formatStr === 'LLLL yyyy' || formatStr === 'MMMM yyyy') {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        return `${months[date.getMonth()]} ${date.getFullYear()}`
      }
      // For other formats, use the actual date-fns implementation
      return actualDateFns.format(date, formatStr)
    },
  }
})

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
    const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => {
      const meals: Meal[] = []
      
      // Add breakfast on even days
      if (i % 2 === 0) {
        meals.push({
          id: `meal-${i + 1}-breakfast`,
          dayId: `day-${i + 1}`,
          mealSlot: 'breakfast',
          recipe: mockRecipes[0],
        })
      }
      
      // Add dinner on days divisible by 3
      if (i % 3 === 0) {
        meals.push({
          id: `meal-${i + 1}-dinner`,
          dayId: `day-${i + 1}`,
          mealSlot: 'dinner',
          recipe: mockRecipes[1],
        })
      }
      
      return {
        id: `day-${i + 1}`,
        dayNumber: i + 1,
        date: `2024-07-${String(i + 1).padStart(2, '0')}`, // July 1-7, 2024 in yyyy-MM-dd format
        meals,
        participantCount: 4,
      }
    })

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

  const mockOnDayClick = vi.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    vi.clearAllMocks()
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
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      expect(screen.getByText('July 2024')).toBeInTheDocument()
    })

    it('renders day headers', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      // Component renders English day names when locale is 'en'
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Tue')).toBeInTheDocument()
      expect(screen.getByText('Wed')).toBeInTheDocument()
      expect(screen.getByText('Thu')).toBeInTheDocument()
      expect(screen.getByText('Fri')).toBeInTheDocument()
      expect(screen.getByText('Sat')).toBeInTheDocument()
      expect(screen.getByText('Sun')).toBeInTheDocument()
    })

    it('highlights trip days', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      // July 1-7 should be highlighted as trip days
      for (let i = 1; i <= 7; i++) {
        const dateElement = screen.getByText(i.toString())
        const dayElement = dateElement.closest('div[class*="relative min-h-"]')
        // Check for trip day styling (should have white background and cursor-pointer)
        expect(dayElement).toHaveClass('bg-white')
        expect(dayElement).toHaveClass('cursor-pointer')
      }
    })

    it('shows meal indicators for days with meals', () => {
      // Create a trip with one specific day that definitely has meals
      const trip: Trip = {
        id: 'trip-1',
        name: 'Test Trip',
        description: 'Test',
        startDate: '2024-07-01',
        endDate: '2024-07-01',
        participantCount: 4,
        status: 'planning',
        participants: [],
        mealSlotConfiguration: [
          { id: 'breakfast', dayNumber: 1, mealType: 'breakfast', isActive: true, displayOrder: 1 },
          { id: 'lunch', dayNumber: 1, mealType: 'lunch', isActive: true, displayOrder: 2 },
          { id: 'dinner', dayNumber: 1, mealType: 'dinner', isActive: true, displayOrder: 3 },
        ],
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: '2024-07-01',
          meals: [
            { id: 'meal-1', dayId: 'day-1', mealSlot: 'breakfast', recipe: mockRecipes[0] },
            { id: 'meal-2', dayId: 'day-1', mealSlot: 'dinner', recipe: mockRecipes[1] },
          ],
          participantCount: 4,
        }],
        userId: 'user-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      // Day 1 should show meal planning status: 2 planned meals out of 3 slots
      const dateElement = screen.getByText('1')
      const day1 = dateElement.closest('div[class*="relative min-h-"]')
      expect(within(day1!).getByText('2/3')).toBeInTheDocument()
    })
  })

  describe('Month Navigation', () => {
    it('navigates to previous month', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      const prevButton = screen.getByRole('button', { name: /Previous month/i })
      await userEvent.click(prevButton)
      
      // Should change the month display
      expect(screen.getByText('June 2024')).toBeInTheDocument()
    })

    it('navigates to next month', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      const nextButton = screen.getByRole('button', { name: /Next month/i })
      await userEvent.click(nextButton)
      
      // Should change the month display
      expect(screen.getByText('August 2024')).toBeInTheDocument()
    })

  })

  describe('Day Selection', () => {
    it('calls onDayClick when a trip day is clicked', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      const dateElement = screen.getByText('3')
      const day3 = dateElement.closest('div[class*="relative min-h-"]')
      await userEvent.click(day3!)
      
      await waitFor(() => {
        expect(mockOnDayClick).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'day-3',
            dayNumber: 3,
            date: '2024-07-03'
          }),
          expect.any(Date)
        )
      })
    })

    it('does not call onDayClick for non-trip days', async () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      // Day 8 is not part of the trip (July 8)
      const dateElement = screen.getByText('8')
      const day8 = dateElement.closest('div[class*="relative min-h-"]')
      await userEvent.click(day8!)
      
      expect(mockOnDayClick).not.toHaveBeenCalled()
    })
  })


  describe('Meal Management', () => {
    it('shows meal planning status for days', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      // Day 1 has 2 planned meals out of 3 total (breakfast and dinner from our mock)
      const dateElement = screen.getByText('1')
      const day1 = dateElement.closest('div[class*="relative min-h-"]')
      expect(within(day1!).getByText('2/3')).toBeInTheDocument()
    })

    it('shows meal stats for days without meals', () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: '2024-07-01',
          meals: [],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      const dateElement = screen.getByText('1')
      const day1 = dateElement.closest('div[class*="relative min-h-"]')
      // The component shows 0/3 for days with no meals planned
      expect(within(day1!).getByText('0/3')).toBeInTheDocument()
    })

    it('indicates days with all meals planned', () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: '2024-07-01',
          meals: [
            { id: 'meal-1-b', dayId: 'day-1', mealSlot: 'breakfast', recipe: mockRecipes[0] },
            { id: 'meal-1-l', dayId: 'day-1', mealSlot: 'lunch', recipe: mockRecipes[1] },
            { id: 'meal-1-d', dayId: 'day-1', mealSlot: 'dinner', recipe: mockRecipes[1] },
          ],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} />)
      
      const dateElement = screen.getByText('1')
      const day1 = dateElement.closest('div[class*="relative min-h-"]')
      expect(within(day1!).getByText('3/3')).toBeInTheDocument() // All meals planned
    })
  })

  describe('Calendar Information', () => {
    it('shows legend with calendar indicators', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      expect(screen.getByText('Trip day')).toBeInTheDocument()
      expect(screen.getByText('Outside trip')).toBeInTheDocument()
      expect(screen.getByText('Planned meals')).toBeInTheDocument()
      expect(screen.getByText('Incomplete plan')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('renders correctly on mobile screens', () => {
      global.innerWidth = 375
      global.dispatchEvent(new Event('resize'))
      
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      // Should still render day headers
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Tue')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper button labels for navigation', () => {
      const trip = createMockTrip()
      renderWithProviders(<TripCalendarView trip={trip} onDayClick={mockOnDayClick} locale="en" />)
      
      expect(screen.getByRole('button', { name: /Previous month/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Next month/i })).toBeInTheDocument()
    })
  })


  describe('Performance', () => {
    it('renders large calendars efficiently', () => {
      const trip = createMockTrip({
        days: Array.from({ length: 30 }, (_, i) => ({
          id: `day-${i + 1}`,
          dayNumber: i + 1,
          date: `2024-07-${String(i + 1).padStart(2, '0')}`,
          meals: [],
          participantCount: 4,
        })),
        endDate: '2024-07-30',
      })
      
      const { container } = renderWithProviders(
        <TripCalendarView trip={trip} onDayClick={mockOnDayClick} />
      )
      
      // Should render without errors
      expect(container).toBeInTheDocument()
      expect(screen.getByText('July 2024')).toBeInTheDocument()
    })
  })
})