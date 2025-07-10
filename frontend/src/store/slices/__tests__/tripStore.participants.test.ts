import { renderHook, act, waitFor } from '@testing-library/react'
import { useTripStore } from '../tripStore'
import { participantsApi } from '@/services/participants'
import axios from 'axios'

// Mock the participantsApi
jest.mock('@/services/participants')
jest.mock('axios')

const mockParticipantsApi = participantsApi as jest.Mocked<typeof participantsApi>
const mockAxios = axios as jest.Mocked<typeof axios>

describe('TripStore - Participant Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('addParticipant', () => {
    it('should add a participant and update the current trip', async () => {
      const { result } = renderHook(() => useTripStore())
      
      // Set up initial state
      act(() => {
        result.current.currentTrip = {
          id: '1',
          name: 'Test Trip',
          participants: [],
          participantCount: 0,
          // ... other trip properties
        } as any
      })

      // Mock API response
      mockParticipantsApi.addParticipant.mockResolvedValue({
        data: {
          id: 123,
          name: 'John Doe',
          email: 'john@example.com',
          tripId: 1,
          role: 'participant',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        error: null
      })

      // Add participant
      await act(async () => {
        await result.current.addParticipant('1', {
          name: 'John Doe',
          email: 'john@example.com'
        })
      })

      // Verify state was updated
      expect(result.current.participantLoading).toBe(false)
      expect(result.current.participantError).toBe(null)
      expect(result.current.currentTrip?.participants).toHaveLength(1)
      expect(result.current.currentTrip?.participants[0]).toMatchObject({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com'
      })
    })

    it('should handle errors when adding a participant', async () => {
      const { result } = renderHook(() => useTripStore())

      // Mock API error
      mockParticipantsApi.addParticipant.mockResolvedValue({
        data: null,
        error: 'Failed to add participant'
      })

      // Try to add participant
      await act(async () => {
        try {
          await result.current.addParticipant('1', { name: 'John' })
        } catch (error) {
          // Expected error
        }
      })

      // Verify error state
      expect(result.current.participantError).toBe('Failed to add participant')
      expect(result.current.participantLoading).toBe(false)
    })
  })

  describe('updateParticipant', () => {
    it('should update a participant in the current trip', async () => {
      const { result } = renderHook(() => useTripStore())
      
      // Set up initial state
      act(() => {
        result.current.currentTrip = {
          id: '1',
          name: 'Test Trip',
          participants: [{
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
            mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 }
          }],
          participantCount: 1,
        } as any
      })

      // Mock API response
      mockParticipantsApi.updateParticipant.mockResolvedValue({
        data: {
          id: 123,
          name: 'Jane Doe',
          email: 'jane@example.com',
          tripId: 1,
          role: 'participant',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        error: null
      })

      // Update participant
      await act(async () => {
        await result.current.updateParticipant('1', '123', {
          name: 'Jane Doe',
          email: 'jane@example.com'
        })
      })

      // Verify state was updated
      expect(result.current.currentTrip?.participants[0]).toMatchObject({
        id: '123',
        name: 'Jane Doe',
        email: 'jane@example.com'
      })
    })
  })

  describe('removeParticipant', () => {
    it('should remove a participant from the current trip', async () => {
      const { result } = renderHook(() => useTripStore())
      
      // Set up initial state
      act(() => {
        result.current.currentTrip = {
          id: '1',
          name: 'Test Trip',
          participants: [{
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
            mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 }
          }],
          participantCount: 1,
        } as any
      })

      // Mock API response
      mockParticipantsApi.removeParticipant.mockResolvedValue({
        data: { message: 'Participant removed' },
        error: null
      })

      // Remove participant
      await act(async () => {
        await result.current.removeParticipant('1', '123')
      })

      // Verify state was updated
      expect(result.current.currentTrip?.participants).toHaveLength(0)
      expect(result.current.currentTrip?.participantCount).toBe(0)
    })
  })

  describe('fetchParticipantsForDay', () => {
    it('should fetch participants for a specific day', async () => {
      const { result } = renderHook(() => useTripStore())

      // Mock API response
      const mockDayParticipants = [
        {
          id: 1,
          name: 'John Doe',
          isPresent: true,
          dayNumber: 1,
          tripId: 1,
          role: 'participant' as const,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      
      mockParticipantsApi.getParticipantsForDay.mockResolvedValue({
        data: mockDayParticipants,
        error: null
      })

      // Fetch participants for day
      let dayParticipants: any
      await act(async () => {
        dayParticipants = await result.current.fetchParticipantsForDay('1', 1)
      })

      // Verify the data was returned
      expect(dayParticipants).toEqual(mockDayParticipants)
      expect(result.current.participantLoading).toBe(false)
      expect(result.current.participantError).toBe(null)
    })
  })

  describe('fetchTrip with participants', () => {
    it('should fetch participants when loading a trip without participants', async () => {
      const { result } = renderHook(() => useTripStore())

      // Mock trip API response without participants
      mockAxios.get.mockResolvedValueOnce({
        data: {
          id: '1',
          name: 'Test Trip',
          participants: [],
          participantCount: 0
        }
      })

      // Mock participants API response
      mockParticipantsApi.listParticipants.mockResolvedValue({
        data: [{
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          tripId: 1,
          role: 'participant',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        error: null
      })

      // Fetch trip
      await act(async () => {
        await result.current.fetchTrip('1')
      })

      // Verify participants were loaded
      expect(mockParticipantsApi.listParticipants).toHaveBeenCalledWith(1)
      expect(result.current.currentTrip?.participants).toHaveLength(1)
      expect(result.current.currentTrip?.participants[0]).toMatchObject({
        id: '1',
        name: 'John Doe',
        email: 'john@example.com'
      })
    })
  })
})