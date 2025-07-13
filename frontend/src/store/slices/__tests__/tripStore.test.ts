import { act, renderHook } from '@testing-library/react'
import axios from 'axios'
import { useTripStore } from '../tripStore'
import { participantsApi } from '@/services/participants'
import type { Trip, Participant, TripFilters, ShoppingListItem, MealSlot, DayPlan } from '../tripStore'
import type { PaginatedResponse } from '../../types'

// Mock axios
vi.mock('axios')
const mockedAxios = axios as vi.Mocked<typeof axios>

// Mock participants API
vi.mock('@/services/participants')
const mockedParticipantsApi = participantsApi as vi.Mocked<typeof participantsApi>

describe('tripStore', () => {
  const mockMealSlot: MealSlot = {
    id: '1',
    dayNumber: 1,
    mealType: 'breakfast',
    isActive: true,
    displayOrder: 1
  }

  const mockDayPlan: DayPlan = {
    id: '1',
    dayNumber: 1,
    date: '2023-06-01',
    meals: [],
    participantCount: 4
  }

  const mockParticipant: Participant = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    arrivalDate: '2023-06-01',
    departureDate: '2023-06-07',
    mealCoefficients: {
      breakfast: 1,
      lunch: 1,
      dinner: 1
    }
  }

  const mockTrip: Trip = {
    id: '1',
    name: 'Summer Trip',
    description: 'A fun summer trip',
    startDate: '2023-06-01',
    endDate: '2023-06-07',
    participantCount: 4,
    status: 'planning',
    mealSlotConfiguration: [mockMealSlot],
    participants: [mockParticipant],
    days: [mockDayPlan],
    userId: 'user1',
    location: 'Mountains',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }

  const mockPaginatedResponse: PaginatedResponse<Trip> = {
    items: [mockTrip],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1
  }

  beforeEach(() => {
    // Reset store state
    useTripStore.setState({
      trips: [],
      currentTrip: null,
      totalTrips: 0,
      currentPage: 1,
      pageSize: 20,
      filters: {},
      sortBy: 'startDate',
      sortOrder: 'desc',
      shoppingList: [],
      shoppingListLoading: false,
      loading: false,
      error: null,
      participantLoading: false,
      participantError: null,
    })
    
    // Reset mocks
    vi.clearAllMocks()
    mockedAxios.get.mockResolvedValue({ data: {} })
    mockedAxios.post.mockResolvedValue({ data: {} })
    mockedAxios.put.mockResolvedValue({ data: {} })
    mockedAxios.delete.mockResolvedValue({ data: {} })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useTripStore())
      
      expect(result.current.trips).toEqual([])
      expect(result.current.currentTrip).toBeNull()
      expect(result.current.totalTrips).toBe(0)
      expect(result.current.currentPage).toBe(1)
      expect(result.current.pageSize).toBe(20)
      expect(result.current.filters).toEqual({})
      expect(result.current.sortBy).toBe('startDate')
      expect(result.current.sortOrder).toBe('desc')
      expect(result.current.shoppingList).toEqual([])
      expect(result.current.shoppingListLoading).toBe(false)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.participantLoading).toBe(false)
      expect(result.current.participantError).toBeNull()
    })
  })

  describe('fetchTrips', () => {
    it('should fetch trips successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockPaginatedResponse })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.fetchTrips()
      })

      expect(result.current.trips).toEqual([mockTrip])
      expect(result.current.totalTrips).toBe(1)
      expect(result.current.currentPage).toBe(1)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should ensure participants array is initialized', async () => {
      const tripWithoutParticipants = { ...mockTrip, participants: undefined }
      const responseWithoutParticipants = {
        ...mockPaginatedResponse,
        items: [tripWithoutParticipants]
      }
      
      mockedAxios.get.mockResolvedValueOnce({ data: responseWithoutParticipants })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.fetchTrips()
      })

      expect(result.current.trips[0].participants).toEqual([])
    })

    it('should handle fetch trips error', async () => {
      const errorMessage = 'Failed to fetch trips'
      mockedAxios.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.fetchTrips()
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.trips).toEqual([])
    })

    it('should include filters and sorting in request', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockPaginatedResponse })

      const { result } = renderHook(() => useTripStore())

      // Set filters and sorting
      act(() => {
        result.current.setFilters({ status: ['planning'], participantCountMin: 2 })
        result.current.setSorting('name', 'asc')
      })

      await act(async () => {
        await result.current.fetchTrips()
      })

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/trips', {
        params: {
          page: 1,
          pageSize: 20,
          sortBy: 'name',
          sortOrder: 'asc',
          status: ['planning'],
          participantCountMin: 2
        }
      })
    })
  })

  describe('fetchTrip', () => {
    it('should fetch single trip successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockTrip })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.fetchTrip('1')
      })

      expect(result.current.currentTrip).toEqual(mockTrip)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should fetch participants if not loaded', async () => {
      const tripWithoutParticipants = { ...mockTrip, participants: [] }
      const mockApiParticipants = [
        { id: 1, name: 'John Doe', email: 'john@example.com' }
      ]

      mockedAxios.get.mockResolvedValueOnce({ data: tripWithoutParticipants })
      mockedParticipantsApi.listParticipants.mockResolvedValueOnce({
        data: mockApiParticipants,
        error: null
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.fetchTrip('1')
      })

      expect(mockedParticipantsApi.listParticipants).toHaveBeenCalledWith(1)
      expect(result.current.currentTrip?.participants).toEqual([
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          mealCoefficients: {
            breakfast: 1,
            lunch: 1,
            dinner: 1
          }
        }
      ])
    })

    it('should handle fetch trip error', async () => {
      const errorMessage = 'Trip not found'
      mockedAxios.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.fetchTrip('999')
      })

      expect(result.current.currentTrip).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('createTrip', () => {
    it('should create trip successfully', async () => {
      const newTripData = {
        name: 'New Trip',
        startDate: '2023-07-01',
        endDate: '2023-07-07',
        participantCount: 6
      }
      
      mockedAxios.post.mockResolvedValueOnce({ data: mockTrip })

      const { result } = renderHook(() => useTripStore())

      let createdTrip: Trip
      await act(async () => {
        createdTrip = await result.current.createTrip(newTripData)
      })

      expect(createdTrip!).toEqual(mockTrip)
      expect(result.current.trips).toEqual([mockTrip])
      expect(result.current.totalTrips).toBe(1)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle create trip error', async () => {
      const errorMessage = 'Failed to create trip'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.createTrip({ name: 'Test' })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('updateTrip', () => {
    beforeEach(() => {
      // Set initial state with existing trip
      act(() => {
        useTripStore.setState({
          trips: [mockTrip],
          currentTrip: mockTrip
        })
      })
    })

    it('should update trip successfully', async () => {
      const updatedTrip = { ...mockTrip, name: 'Updated Trip' }
      const updates = { name: 'Updated Trip' }
      
      mockedAxios.put.mockResolvedValueOnce({ data: updatedTrip })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.updateTrip('1', updates)
      })

      expect(result.current.trips[0]).toEqual(updatedTrip)
      expect(result.current.currentTrip).toEqual(updatedTrip)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle update trip error', async () => {
      const errorMessage = 'Failed to update trip'
      mockedAxios.put.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.updateTrip('1', { name: 'Updated' })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('deleteTrip', () => {
    beforeEach(() => {
      // Set initial state with existing trip
      act(() => {
        useTripStore.setState({
          trips: [mockTrip],
          currentTrip: mockTrip,
          totalTrips: 1
        })
      })
    })

    it('should delete trip successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({})

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.deleteTrip('1')
      })

      expect(result.current.trips).toEqual([])
      expect(result.current.currentTrip).toBeNull()
      expect(result.current.totalTrips).toBe(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle delete trip error', async () => {
      const errorMessage = 'Failed to delete trip'
      mockedAxios.delete.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.deleteTrip('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
      expect(result.current.trips).toEqual([mockTrip]) // Should remain unchanged
    })
  })

  describe('duplicateTrip', () => {
    it('should duplicate trip successfully', async () => {
      const duplicatedTrip = { ...mockTrip, id: '2', name: 'Summer Trip (Copy)' }
      mockedAxios.post.mockResolvedValueOnce({ data: duplicatedTrip })

      const { result } = renderHook(() => useTripStore())

      let result_trip: Trip
      await act(async () => {
        result_trip = await result.current.duplicateTrip('1')
      })

      expect(result_trip!).toEqual(duplicatedTrip)
      expect(result.current.trips).toEqual([duplicatedTrip])
      expect(result.current.totalTrips).toBe(1)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle duplicate trip error', async () => {
      const errorMessage = 'Failed to duplicate trip'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.duplicateTrip('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('participant management', () => {
    beforeEach(() => {
      act(() => {
        useTripStore.setState({ currentTrip: mockTrip })
      })
    })

    describe('addParticipant', () => {
      it('should add participant successfully', async () => {
        const newParticipant = {
          name: 'Jane Smith',
          email: 'jane@example.com',
          arrivalDate: '2023-06-01',
          departureDate: '2023-06-07',
          mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 }
        }

        const apiResponse = { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        mockedParticipantsApi.addParticipant.mockResolvedValueOnce({
          data: apiResponse,
          error: null
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          await result.current.addParticipant('1', newParticipant)
        })

        expect(result.current.currentTrip?.participants).toHaveLength(2)
        expect(result.current.currentTrip?.participantCount).toBe(2)
        expect(result.current.participantLoading).toBe(false)
        expect(result.current.participantError).toBeNull()
      })

      it('should handle add participant error', async () => {
        const errorMessage = 'Failed to add participant'
        mockedParticipantsApi.addParticipant.mockResolvedValueOnce({
          data: null,
          error: errorMessage
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          try {
            await result.current.addParticipant('1', { name: 'Test' })
          } catch (error) {
            // Expected to throw
          }
        })

        expect(result.current.participantError).toBe(errorMessage)
        expect(result.current.participantLoading).toBe(false)
      })
    })

    describe('updateParticipant', () => {
      it('should update participant successfully', async () => {
        const updates = { name: 'John Updated', email: 'john.updated@example.com' }
        
        mockedParticipantsApi.updateParticipant.mockResolvedValueOnce({
          data: { id: 1, ...updates },
          error: null
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          await result.current.updateParticipant('1', '1', updates)
        })

        expect(result.current.currentTrip?.participants[0]).toMatchObject(updates)
        expect(result.current.participantLoading).toBe(false)
        expect(result.current.participantError).toBeNull()
      })

      it('should handle update participant error', async () => {
        const errorMessage = 'Failed to update participant'
        mockedParticipantsApi.updateParticipant.mockResolvedValueOnce({
          data: null,
          error: errorMessage
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          try {
            await result.current.updateParticipant('1', '1', { name: 'Updated' })
          } catch (error) {
            // Expected to throw
          }
        })

        expect(result.current.participantError).toBe(errorMessage)
      })
    })

    describe('removeParticipant', () => {
      it('should remove participant successfully', async () => {
        mockedParticipantsApi.removeParticipant.mockResolvedValueOnce({
          data: true,
          error: null
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          await result.current.removeParticipant('1', '1')
        })

        expect(result.current.currentTrip?.participants).toHaveLength(0)
        expect(result.current.currentTrip?.participantCount).toBe(0)
        expect(result.current.participantLoading).toBe(false)
        expect(result.current.participantError).toBeNull()
      })

      it('should handle remove participant error', async () => {
        const errorMessage = 'Failed to remove participant'
        mockedParticipantsApi.removeParticipant.mockResolvedValueOnce({
          data: null,
          error: errorMessage
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          try {
            await result.current.removeParticipant('1', '1')
          } catch (error) {
            // Expected to throw
          }
        })

        expect(result.current.participantError).toBe(errorMessage)
      })
    })

    describe('fetchParticipantsForDay', () => {
      it('should fetch participants for day successfully', async () => {
        const dayParticipants = [mockParticipant]
        mockedParticipantsApi.getParticipantsForDay.mockResolvedValueOnce({
          data: dayParticipants,
          error: null
        })

        const { result } = renderHook(() => useTripStore())

        let participants: any
        await act(async () => {
          participants = await result.current.fetchParticipantsForDay('1', 1)
        })

        expect(participants).toEqual(dayParticipants)
        expect(result.current.participantLoading).toBe(false)
        expect(result.current.participantError).toBeNull()
      })

      it('should handle fetch participants for day error', async () => {
        const errorMessage = 'Failed to fetch participants for day'
        mockedParticipantsApi.getParticipantsForDay.mockResolvedValueOnce({
          data: null,
          error: errorMessage
        })

        const { result } = renderHook(() => useTripStore())

        await act(async () => {
          try {
            await result.current.fetchParticipantsForDay('1', 1)
          } catch (error) {
            // Expected to throw
          }
        })

        expect(result.current.participantError).toBe(errorMessage)
      })
    })

    it('should clear participant error', () => {
      const { result } = renderHook(() => useTripStore())

      act(() => {
        useTripStore.setState({ participantError: 'Test error' })
      })

      expect(result.current.participantError).toBe('Test error')

      act(() => {
        result.current.clearParticipantError()
      })

      expect(result.current.participantError).toBeNull()
    })
  })

  describe('meal management', () => {
    it('should assign meal successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({})
      mockedAxios.get.mockResolvedValueOnce({ data: mockTrip }) // for refetch

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.assignMeal('1', 'day1', 'breakfast', '1')
      })

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/trips/1/days/day1/meals', {
        mealSlot: 'breakfast',
        recipeId: '1'
      })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/trips/1')
    })

    it('should update meal successfully', async () => {
      mockedAxios.put.mockResolvedValueOnce({})
      mockedAxios.get.mockResolvedValueOnce({ data: mockTrip }) // for refetch

      const { result } = renderHook(() => useTripStore())

      const updates = { servingsOverride: 6, notes: 'Extra spicy' }

      await act(async () => {
        await result.current.updateMeal('1', 'day1', 'meal1', updates)
      })

      expect(mockedAxios.put).toHaveBeenCalledWith('/api/v1/trips/1/days/day1/meals/meal1', updates)
    })

    it('should remove meal successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({})
      mockedAxios.get.mockResolvedValueOnce({ data: mockTrip }) // for refetch

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.removeMeal('1', 'day1', 'meal1')
      })

      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/v1/trips/1/days/day1/meals/meal1')
    })

    it('should swap meals successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({})
      mockedAxios.get.mockResolvedValueOnce({ data: mockTrip }) // for refetch

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.swapMeals('1', 'meal1', 'meal2')
      })

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/trips/1/meals/swap', {
        meal1Id: 'meal1',
        meal2Id: 'meal2'
      })
    })

    it('should handle meal operation errors', async () => {
      const errorMessage = 'Failed to assign meal'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.assignMeal('1', 'day1', 'breakfast', '1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('shopping list management', () => {
    const mockShoppingList: ShoppingListItem[] = [
      {
        ingredientId: '1',
        name: 'Chicken Breast',
        quantity: 2,
        unit: 'kg',
        category: 'protein',
        recipes: ['Grilled Chicken']
      }
    ]

    it('should generate shopping list successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockShoppingList })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.generateShoppingList('1')
      })

      expect(result.current.shoppingList).toEqual(mockShoppingList)
      expect(result.current.shoppingListLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle generate shopping list error', async () => {
      const errorMessage = 'Failed to generate shopping list'
      mockedAxios.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        await result.current.generateShoppingList('1')
      })

      expect(result.current.shoppingListLoading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })

    it('should update shopping item', () => {
      const { result } = renderHook(() => useTripStore())

      // Set initial shopping list
      act(() => {
        useTripStore.setState({ shoppingList: mockShoppingList })
      })

      act(() => {
        result.current.updateShoppingItem('1', { quantity: 3, unit: 'pieces' })
      })

      expect(result.current.shoppingList[0]).toMatchObject({
        ...mockShoppingList[0],
        quantity: 3,
        unit: 'pieces'
      })
    })

    it('should add custom item', () => {
      const { result } = renderHook(() => useTripStore())

      const customItem = {
        name: 'Custom Spice',
        quantity: 1,
        unit: 'bottle',
        category: 'spices'
      }

      act(() => {
        result.current.addCustomItem(customItem)
      })

      expect(result.current.shoppingList).toHaveLength(1)
      expect(result.current.shoppingList[0]).toMatchObject({
        ...customItem,
        recipes: []
      })
      expect(result.current.shoppingList[0].ingredientId).toMatch(/^custom-\d+$/)
    })

    it('should remove shopping item', () => {
      const { result } = renderHook(() => useTripStore())

      // Set initial shopping list
      act(() => {
        useTripStore.setState({ shoppingList: mockShoppingList })
      })

      act(() => {
        result.current.removeShoppingItem('1')
      })

      expect(result.current.shoppingList).toHaveLength(0)
    })
  })

  describe('filtering and sorting', () => {
    it('should set filters correctly', () => {
      const { result } = renderHook(() => useTripStore())

      const filters: TripFilters = {
        search: 'summer',
        status: ['planning'],
        participantCountMin: 2
      }

      act(() => {
        result.current.setFilters(filters)
      })

      expect(result.current.filters).toEqual(filters)
      expect(result.current.currentPage).toBe(1) // Should reset to page 1
    })

    it('should clear filters', () => {
      const { result } = renderHook(() => useTripStore())

      // Set initial filters
      act(() => {
        result.current.setFilters({ search: 'test' })
        useTripStore.setState({ currentPage: 3 })
      })

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters).toEqual({})
      expect(result.current.currentPage).toBe(1)
    })

    it('should set sorting correctly', () => {
      const { result } = renderHook(() => useTripStore())

      act(() => {
        result.current.setSorting('name', 'asc')
      })

      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('asc')
      expect(result.current.currentPage).toBe(1)
    })

    it('should toggle sort order when setting same field', () => {
      const { result } = renderHook(() => useTripStore())

      // Set initial sorting
      act(() => {
        result.current.setSorting('name', 'asc')
      })

      // Set same field without specifying order
      act(() => {
        result.current.setSorting('name')
      })

      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('desc') // Should toggle to desc
    })

    it('should set page size correctly', () => {
      const { result } = renderHook(() => useTripStore())

      act(() => {
        useTripStore.setState({ currentPage: 3 })
        result.current.setPageSize(10)
      })

      expect(result.current.pageSize).toBe(10)
      expect(result.current.currentPage).toBe(1) // Should reset to page 1
    })
  })

  describe('utility functions', () => {
    it('should share trip successfully', async () => {
      const shareLink = 'https://example.com/share/trip/1'
      mockedAxios.post.mockResolvedValueOnce({ data: { shareLink } })

      const { result } = renderHook(() => useTripStore())

      // Set initial trip state
      act(() => {
        useTripStore.setState({
          trips: [mockTrip],
          currentTrip: mockTrip
        })
      })

      let resultLink: string
      await act(async () => {
        resultLink = await result.current.shareTrip('1')
      })

      expect(resultLink!).toBe(shareLink)
      expect(result.current.trips[0].shareLink).toBe(shareLink)
      expect(result.current.currentTrip?.shareLink).toBe(shareLink)
    })

    it('should handle share trip error', async () => {
      const errorMessage = 'Failed to generate share link'
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.shareTrip('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })

    it('should calculate nutrition for trip', async () => {
      const nutritionData = {
        totalCalories: 2000,
        totalProtein: 150,
        totalCarbs: 200,
        totalFat: 80
      }
      mockedAxios.get.mockResolvedValueOnce({ data: nutritionData })

      const { result } = renderHook(() => useTripStore())

      let nutrition: any
      await act(async () => {
        nutrition = await result.current.calculateNutrition('1')
      })

      expect(nutrition).toEqual(nutritionData)
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/trips/1/nutrition')
    })

    it('should calculate nutrition for specific day', async () => {
      const nutritionData = {
        totalCalories: 400,
        totalProtein: 30,
        totalCarbs: 40,
        totalFat: 15
      }
      mockedAxios.get.mockResolvedValueOnce({ data: nutritionData })

      const { result } = renderHook(() => useTripStore())

      let nutrition: any
      await act(async () => {
        nutrition = await result.current.calculateNutrition('1', 'day1')
      })

      expect(nutrition).toEqual(nutritionData)
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/trips/1/days/day1/nutrition')
    })

    it('should handle calculate nutrition error', async () => {
      const errorMessage = 'Failed to calculate nutrition'
      mockedAxios.get.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const { result } = renderHook(() => useTripStore())

      await act(async () => {
        try {
          await result.current.calculateNutrition('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('error handling', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useTripStore())

      act(() => {
        useTripStore.setState({ error: 'Test error' })
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle updating non-existent shopping item', () => {
      const { result } = renderHook(() => useTripStore())

      act(() => {
        result.current.updateShoppingItem('non-existent', { quantity: 5 })
      })

      // Should not crash and shopping list should remain empty
      expect(result.current.shoppingList).toHaveLength(0)
    })

    it('should handle removing non-existent shopping item', () => {
      const { result } = renderHook(() => useTripStore())

      // Set initial shopping list
      act(() => {
        useTripStore.setState({ shoppingList: mockShoppingList })
      })

      act(() => {
        result.current.removeShoppingItem('non-existent')
      })

      // Should not crash and original item should remain
      expect(result.current.shoppingList).toHaveLength(1)
    })

    it('should handle custom item with minimal data', () => {
      const { result } = renderHook(() => useTripStore())

      act(() => {
        result.current.addCustomItem({})
      })

      expect(result.current.shoppingList[0]).toMatchObject({
        name: 'Custom Item',
        quantity: 1,
        unit: 'piece',
        recipes: []
      })
    })
  })
})