import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MealPlanningBoard } from '../MealPlanningBoard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@context/ThemeContext'
import type { Trip, TripDay } from '@/store/slices/tripStore'
import type { Recipe } from '@/types/recipe'

// Mock drag and drop
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({
    draggableProps: {},
    dragHandleProps: {},
    innerRef: vi.fn(),
  }),
  Draggable: ({ children }: any) => children({
    draggableProps: {},
    dragHandleProps: {},
    innerRef: vi.fn(),
  }, {}),
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

describe('MealPlanningBoard', () => {
  let queryClient: QueryClient

  const mockRecipes: Recipe[] = [
    {
      id: 'recipe-1',
      name: 'Scrambled Eggs',
      description: 'Classic breakfast',
      instructions: [{ step: 1, text: 'Beat eggs and cook' }],
      ingredients: [
        { name: 'Eggs', quantity: 4, unit: 'pieces' },
        { name: 'Butter', quantity: 1, unit: 'tbsp' },
      ],
      prepTime: 5,
      cookTime: 5,
      totalTime: 10,
      servings: 2,
      difficulty: 'easy',
      categories: ['Breakfast'],
      tags: ['vegetarian', 'gluten-free'],
      isPublic: true,
      userId: 'user-1',
      nutrition: {
        calories: 200,
        protein: 16,
        carbs: 2,
        fat: 14,
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: 'recipe-2',
      name: 'Grilled Chicken Salad',
      description: 'Healthy lunch',
      instructions: [{ step: 1, text: 'Grill chicken and mix salad' }],
      ingredients: [
        { name: 'Chicken breast', quantity: 200, unit: 'g' },
        { name: 'Mixed greens', quantity: 100, unit: 'g' },
      ],
      prepTime: 15,
      cookTime: 20,
      totalTime: 35,
      servings: 1,
      difficulty: 'medium',
      categories: ['Lunch', 'Healthy'],
      tags: ['high-protein', 'low-carb'],
      isPublic: true,
      userId: 'user-1',
      nutrition: {
        calories: 350,
        protein: 40,
        carbs: 12,
        fat: 15,
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: 'recipe-3',
      name: 'Spaghetti Carbonara',
      description: 'Italian classic',
      instructions: [{ step: 1, text: 'Cook pasta and prepare sauce' }],
      ingredients: [
        { name: 'Spaghetti', quantity: 400, unit: 'g' },
        { name: 'Bacon', quantity: 200, unit: 'g' },
        { name: 'Eggs', quantity: 4, unit: 'pieces' },
        { name: 'Parmesan', quantity: 100, unit: 'g' },
      ],
      prepTime: 10,
      cookTime: 20,
      totalTime: 30,
      servings: 4,
      difficulty: 'medium',
      categories: ['Dinner', 'Italian'],
      tags: ['comfort-food'],
      isPublic: true,
      userId: 'user-1',
      imageUrl: 'https://example.com/carbonara.jpg',
      nutrition: {
        calories: 580,
        protein: 25,
        carbs: 65,
        fat: 24,
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ]

  const createMockTrip = (overrides?: Partial<Trip>): Trip => {
    const days: TripDay[] = Array.from({ length: 3 }, (_, i) => ({
      id: `day-${i + 1}`,
      dayNumber: i + 1,
      date: new Date(2024, 6, i + 1).toISOString(),
      meals: [
        {
          id: `meal-${i + 1}-breakfast`,
          mealType: 'breakfast',
          recipeId: undefined,
        },
        {
          id: `meal-${i + 1}-lunch`,
          mealType: 'lunch',
          recipeId: undefined,
        },
        {
          id: `meal-${i + 1}-dinner`,
          mealType: 'dinner',
          recipeId: undefined,
        },
      ],
      participantCount: 4,
    }))

    return {
      id: 'trip-1',
      name: 'Test Trip',
      description: 'Test trip description',
      startDate: '2024-07-01',
      endDate: '2024-07-03',
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

  const mockOnMealAssign = vi.fn()
  const mockOnMealRemove = vi.fn()
  const mockOnGenerateShoppingList = vi.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
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
    it('renders the meal planning board', () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      expect(screen.getByText('trips.mealPlanning.title')).toBeInTheDocument()
      expect(screen.getByText('trips.mealPlanning.recipes')).toBeInTheDocument()
      expect(screen.getByText('trips.mealPlanning.schedule')).toBeInTheDocument()
    })

    it('displays all recipes in the sidebar', () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument()
      expect(screen.getByText('Grilled Chicken Salad')).toBeInTheDocument()
      expect(screen.getByText('Spaghetti Carbonara')).toBeInTheDocument()
    })

    it('displays trip days with meal slots', () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      expect(screen.getByText('trips.day 1')).toBeInTheDocument()
      expect(screen.getByText('trips.day 2')).toBeInTheDocument()
      expect(screen.getByText('trips.day 3')).toBeInTheDocument()
      
      // Check meal slots
      expect(screen.getAllByText('trips.mealTypes.breakfast').length).toBe(3)
      expect(screen.getAllByText('trips.mealTypes.lunch').length).toBe(3)
      expect(screen.getAllByText('trips.mealTypes.dinner').length).toBe(3)
    })
  })

  describe('Recipe Search and Filtering', () => {
    it('searches recipes by name', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const searchInput = screen.getByPlaceholderText('trips.mealPlanning.searchRecipes')
      await userEvent.type(searchInput, 'chicken')
      
      await waitFor(() => {
        expect(screen.getByText('Grilled Chicken Salad')).toBeInTheDocument()
        expect(screen.queryByText('Scrambled Eggs')).not.toBeInTheDocument()
        expect(screen.queryByText('Spaghetti Carbonara')).not.toBeInTheDocument()
      })
    })

    it('filters recipes by category', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const categoryFilter = screen.getByLabelText('trips.mealPlanning.filterByCategory')
      await userEvent.selectOptions(categoryFilter, 'Breakfast')
      
      await waitFor(() => {
        expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument()
        expect(screen.queryByText('Grilled Chicken Salad')).not.toBeInTheDocument()
        expect(screen.queryByText('Spaghetti Carbonara')).not.toBeInTheDocument()
      })
    })

    it('filters recipes by dietary tags', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const tagFilter = screen.getByLabelText('trips.mealPlanning.filterByTags')
      await userEvent.click(tagFilter)
      
      const vegetarianOption = await screen.findByRole('option', { name: 'vegetarian' })
      await userEvent.click(vegetarianOption)
      
      await waitFor(() => {
        expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument()
        expect(screen.queryByText('Grilled Chicken Salad')).not.toBeInTheDocument()
      })
    })

    it('clears all filters', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      // Apply filters
      const searchInput = screen.getByPlaceholderText('trips.mealPlanning.searchRecipes')
      await userEvent.type(searchInput, 'chicken')
      
      // Clear filters
      const clearButton = screen.getByRole('button', { name: 'trips.mealPlanning.clearFilters' })
      await userEvent.click(clearButton)
      
      await waitFor(() => {
        expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument()
        expect(screen.getByText('Grilled Chicken Salad')).toBeInTheDocument()
        expect(screen.getByText('Spaghetti Carbonara')).toBeInTheDocument()
      })
    })
  })

  describe('Meal Assignment', () => {
    it('assigns recipe to meal slot via drag and drop', async () => {
      const trip = createMockTrip()
      const { container } = renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      // Simulate drag and drop
      const recipeCard = screen.getByText('Scrambled Eggs').closest('[draggable="true"]')
      const mealSlot = container.querySelector('[data-meal-slot="meal-1-breakfast"]')
      
      fireEvent.dragStart(recipeCard!)
      fireEvent.dragEnter(mealSlot!)
      fireEvent.dragOver(mealSlot!)
      fireEvent.drop(mealSlot!)
      fireEvent.dragEnd(recipeCard!)
      
      expect(mockOnMealAssign).toHaveBeenCalledWith('day-1', 'breakfast', 'recipe-1')
    })

    it('assigns recipe via click action', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      // Click on recipe to select it
      const recipeCard = screen.getByText('Scrambled Eggs').closest('article')
      await userEvent.click(recipeCard!)
      
      // Click on meal slot
      const mealSlot = screen.getAllByText('trips.mealPlanning.clickToAssign')[0]
      await userEvent.click(mealSlot)
      
      expect(mockOnMealAssign).toHaveBeenCalledWith('day-1', 'breakfast', 'recipe-1')
    })

    it('shows assigned recipes in meal slots', () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: new Date(2024, 6, 1).toISOString(),
          meals: [
            {
              id: 'meal-1-breakfast',
              mealType: 'breakfast',
              recipeId: 'recipe-1',
              recipe: mockRecipes[0],
            },
            {
              id: 'meal-1-lunch',
              mealType: 'lunch',
              recipeId: undefined,
            },
            {
              id: 'meal-1-dinner',
              mealType: 'dinner',
              recipeId: undefined,
            },
          ],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const mealSlot = screen.getByTestId('meal-slot-day-1-breakfast')
      expect(within(mealSlot).getByText('Scrambled Eggs')).toBeInTheDocument()
    })

    it('removes assigned recipe from meal slot', async () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: new Date(2024, 6, 1).toISOString(),
          meals: [
            {
              id: 'meal-1-breakfast',
              mealType: 'breakfast',
              recipeId: 'recipe-1',
              recipe: mockRecipes[0],
            },
          ],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const removeButton = screen.getByRole('button', { name: 'trips.mealPlanning.removeMeal' })
      await userEvent.click(removeButton)
      
      expect(mockOnMealRemove).toHaveBeenCalledWith('day-1', 'breakfast')
    })
  })

  describe('Bulk Operations', () => {
    it('copies day meals to other days', async () => {
      const trip = createMockTrip({
        days: [
          {
            id: 'day-1',
            dayNumber: 1,
            date: new Date(2024, 6, 1).toISOString(),
            meals: [
              {
                id: 'meal-1-breakfast',
                mealType: 'breakfast',
                recipeId: 'recipe-1',
                recipe: mockRecipes[0],
              },
            ],
            participantCount: 4,
          },
          {
            id: 'day-2',
            dayNumber: 2,
            date: new Date(2024, 6, 2).toISOString(),
            meals: [
              {
                id: 'meal-2-breakfast',
                mealType: 'breakfast',
                recipeId: undefined,
              },
            ],
            participantCount: 4,
          },
        ],
      })
      
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const copyButton = screen.getByRole('button', { name: 'trips.mealPlanning.copyDay' })
      await userEvent.click(copyButton)
      
      const day2Option = await screen.findByRole('option', { name: 'trips.day 2' })
      await userEvent.click(day2Option)
      
      const confirmButton = screen.getByRole('button', { name: 'common.copy' })
      await userEvent.click(confirmButton)
      
      expect(mockOnMealAssign).toHaveBeenCalledWith('day-2', 'breakfast', 'recipe-1')
    })

    it('clears all meals for a day', async () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: new Date(2024, 6, 1).toISOString(),
          meals: [
            {
              id: 'meal-1-breakfast',
              mealType: 'breakfast',
              recipeId: 'recipe-1',
              recipe: mockRecipes[0],
            },
            {
              id: 'meal-1-lunch',
              mealType: 'lunch',
              recipeId: 'recipe-2',
              recipe: mockRecipes[1],
            },
          ],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const clearButton = screen.getByRole('button', { name: 'trips.mealPlanning.clearDay' })
      await userEvent.click(clearButton)
      
      // Confirm dialog
      const confirmButton = await screen.findByRole('button', { name: 'common.clear' })
      await userEvent.click(confirmButton)
      
      expect(mockOnMealRemove).toHaveBeenCalledWith('day-1', 'breakfast')
      expect(mockOnMealRemove).toHaveBeenCalledWith('day-1', 'lunch')
    })
  })

  describe('Recipe Details', () => {
    it('shows recipe details on hover', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const recipeCard = screen.getByText('Scrambled Eggs').closest('article')
      await userEvent.hover(recipeCard!)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        expect(screen.getByRole('tooltip')).toHaveTextContent('200 calories')
        expect(screen.getByRole('tooltip')).toHaveTextContent('16g protein')
      })
    })

    it('opens recipe detail modal', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const detailButton = screen.getAllByRole('button', { name: 'recipes.viewDetails' })[0]
      await userEvent.click(detailButton)
      
      await waitFor(() => {
        const modal = screen.getByRole('dialog')
        expect(modal).toBeInTheDocument()
        expect(within(modal).getByText('Scrambled Eggs')).toBeInTheDocument()
        expect(within(modal).getByText('Classic breakfast')).toBeInTheDocument()
      })
    })
  })

  describe('Shopping List', () => {
    it('generates shopping list for all meals', async () => {
      const trip = createMockTrip({
        days: [{
          id: 'day-1',
          dayNumber: 1,
          date: new Date(2024, 6, 1).toISOString(),
          meals: [
            {
              id: 'meal-1-breakfast',
              mealType: 'breakfast',
              recipeId: 'recipe-1',
              recipe: mockRecipes[0],
            },
            {
              id: 'meal-1-dinner',
              mealType: 'dinner',
              recipeId: 'recipe-3',
              recipe: mockRecipes[2],
            },
          ],
          participantCount: 4,
        }],
      })
      
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
          onGenerateShoppingList={mockOnGenerateShoppingList}
        />
      )
      
      const generateButton = screen.getByRole('button', { name: 'trips.shoppingList.generate' })
      await userEvent.click(generateButton)
      
      expect(mockOnGenerateShoppingList).toHaveBeenCalled()
    })

    it('shows meal completion statistics', () => {
      const trip = createMockTrip({
        days: [
          {
            id: 'day-1',
            dayNumber: 1,
            date: new Date(2024, 6, 1).toISOString(),
            meals: [
              {
                id: 'meal-1-breakfast',
                mealType: 'breakfast',
                recipeId: 'recipe-1',
                recipe: mockRecipes[0],
              },
              {
                id: 'meal-1-lunch',
                mealType: 'lunch',
                recipeId: undefined,
              },
              {
                id: 'meal-1-dinner',
                mealType: 'dinner',
                recipeId: undefined,
              },
            ],
            participantCount: 4,
          },
        ],
      })
      
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      expect(screen.getByText(/1\/3/)).toBeInTheDocument() // 1 of 3 meals planned
      expect(screen.getByText(/33%/)).toBeInTheDocument() // 33% complete
    })
  })

  describe('View Options', () => {
    it('toggles between grid and list view', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const viewToggle = screen.getByRole('button', { name: 'trips.mealPlanning.toggleView' })
      await userEvent.click(viewToggle)
      
      // Should switch to list view
      expect(screen.getByTestId('meal-planning-list-view')).toBeInTheDocument()
    })

    it('collapses/expands days', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const collapseButton = screen.getAllByRole('button', { name: 'common.collapse' })[0]
      await userEvent.click(collapseButton)
      
      // Meal slots should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('meal-slot-day-1-breakfast')).not.toBeInTheDocument()
      })
      
      // Expand again
      const expandButton = screen.getAllByRole('button', { name: 'common.expand' })[0]
      await userEvent.click(expandButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('meal-slot-day-1-breakfast')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('provides keyboard navigation for drag and drop', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const recipeCard = screen.getByText('Scrambled Eggs').closest('[tabindex="0"]')
      recipeCard!.focus()
      
      // Space to lift
      fireEvent.keyDown(recipeCard!, { key: ' ' })
      
      // Arrow keys to move
      fireEvent.keyDown(recipeCard!, { key: 'ArrowRight' })
      fireEvent.keyDown(recipeCard!, { key: 'ArrowDown' })
      
      // Space to drop
      fireEvent.keyDown(recipeCard!, { key: ' ' })
      
      expect(mockOnMealAssign).toHaveBeenCalled()
    })

    it('announces drag and drop actions', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const recipeCard = screen.getByText('Scrambled Eggs').closest('[draggable="true"]')
      fireEvent.dragStart(recipeCard!)
      
      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/dragging Scrambled Eggs/i)
      })
    })

    it('provides ARIA labels for all interactive elements', () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      expect(screen.getByRole('search', { name: /search recipes/i })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /assign recipe/i }).length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('handles meal assignment errors', async () => {
      mockOnMealAssign.mockRejectedValueOnce(new Error('Assignment failed'))
      
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const recipeCard = screen.getByText('Scrambled Eggs').closest('article')
      await userEvent.click(recipeCard!)
      
      const mealSlot = screen.getAllByText('trips.mealPlanning.clickToAssign')[0]
      await userEvent.click(mealSlot)
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/error.assignMeal/i)).toBeInTheDocument()
      })
    })

    it('shows message when no recipes available', () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={[]}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      expect(screen.getByText('trips.mealPlanning.noRecipes')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /recipes.createNew/i })).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('handles large number of recipes efficiently', () => {
      const manyRecipes = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecipes[0],
        id: `recipe-${i}`,
        name: `Recipe ${i + 1}`,
      }))
      
      const trip = createMockTrip()
      const { container } = renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={manyRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      // Should use virtualization for recipe list
      const recipeCards = container.querySelectorAll('[data-recipe-card]')
      expect(recipeCards.length).toBeLessThan(100) // Not all recipes rendered at once
    })

    it('debounces search input', async () => {
      const trip = createMockTrip()
      renderWithProviders(
        <MealPlanningBoard
          trip={trip}
          recipes={mockRecipes}
          onMealAssign={mockOnMealAssign}
          onMealRemove={mockOnMealRemove}
        />
      )
      
      const searchInput = screen.getByPlaceholderText('trips.mealPlanning.searchRecipes')
      
      // Type rapidly
      await userEvent.type(searchInput, 'chic')
      
      // Should not filter until debounce completes
      expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument()
      
      // Wait for debounce
      await waitFor(() => {
        expect(screen.queryByText('Scrambled Eggs')).not.toBeInTheDocument()
        expect(screen.getByText('Grilled Chicken Salad')).toBeInTheDocument()
      }, { timeout: 500 })
    })
  })
})