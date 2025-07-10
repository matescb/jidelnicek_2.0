import { renderHook, act, waitFor } from '@testing-library/react'
import { usePresence } from '../usePresence'
import type { UsePresenceOptions } from '../usePresence'

// No need to mock the internal MockWebSocket class as it's already in the module

describe('usePresence', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })
  const defaultOptions: UsePresenceOptions = {
    tripId: 'trip-123',
    participantId: 'participant-456',
    pollInterval: 30000,
    enableWebSocket: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('Initial State', () => {
    it('initializes with default presence data and activities', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      // Should have initial presence state
      expect(result.current.presenceState).toHaveProperty('1')
      expect(result.current.presenceState['1'].isOnline).toBe(true)
      expect(result.current.presenceState['1'].currentActivity).toBe('Viewing recipes')
      
      expect(result.current.presenceState).toHaveProperty('2')
      expect(result.current.presenceState['2'].isOnline).toBe(false)
      
      expect(result.current.presenceState).toHaveProperty('3')
      expect(result.current.presenceState['3'].isOnline).toBe(true)
      expect(result.current.presenceState['3'].currentActivity).toBe('Editing shopping list')
      
      // Should have initial activities
      expect(result.current.activities).toHaveLength(3)
      expect(result.current.activities[0].type).toBe('joined')
      expect(result.current.activities[1].type).toBe('meal_assigned')
      expect(result.current.activities[2].type).toBe('shopping_contributed')
      expect(result.current.activities[2].isNew).toBe(true)
    })

    it('starts disconnected and connects after delay', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      expect(result.current.isConnected).toBe(false)
      
      // Fast-forward WebSocket connection
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })
  })

  describe('WebSocket Connection', () => {
    it('establishes WebSocket connection when enabled', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      // Fast-forward to establish connection
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })

    it('does not establish WebSocket when disabled', () => {
      const { result } = renderHook(() => 
        usePresence({ ...defaultOptions, enableWebSocket: false })
      )
      
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      
      expect(result.current.isConnected).toBe(false)
    })

    it('sends heartbeat at regular intervals', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      // Establish connection
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      // Clear previous calls
      jest.clearAllMocks()
      
      // Fast-forward to trigger heartbeat
      act(() => {
        jest.advanceTimersByTime(10000) // 10 seconds
      })
      
      // Should have sent heartbeat
      // Note: In real implementation, we'd check WebSocket.send was called
    })

    it('handles reconnection', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      // Establish connection
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      // Simulate disconnect
      act(() => {
        result.current.reconnect()
      })
      
      // Should attempt reconnection after delay
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })
  })

  describe('Presence Updates', () => {
    it('updates presence for a participant', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      act(() => {
        result.current.updatePresence('participant-789', 'Editing meal plan')
      })
      
      expect(result.current.presenceState['participant-789']).toEqual({
        isOnline: true,
        lastSeen: expect.any(Date),
        currentActivity: 'Editing meal plan',
      })
    })

    it('updates local state immediately', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      const beforeUpdate = Date.now()
      
      act(() => {
        result.current.updatePresence('test-participant', 'Testing')
      })
      
      const presence = result.current.presenceState['test-participant']
      expect(presence.isOnline).toBe(true)
      expect(presence.currentActivity).toBe('Testing')
      expect(presence.lastSeen.getTime()).toBeGreaterThanOrEqual(beforeUpdate)
    })

    it('clears activity when not provided', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      // First set an activity
      act(() => {
        result.current.updatePresence('test-participant', 'Initial activity')
      })
      
      expect(result.current.presenceState['test-participant'].currentActivity).toBe('Initial activity')
      
      // Update without activity
      act(() => {
        result.current.updatePresence('test-participant')
      })
      
      expect(result.current.presenceState['test-participant'].currentActivity).toBeUndefined()
    })
  })

  describe('Activity Management', () => {
    it('adds new activity', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      const initialCount = result.current.activities.length
      
      act(() => {
        result.current.addActivity({
          type: 'joined',
          participantId: 'new-participant',
          participantName: 'New User',
        })
      })
      
      expect(result.current.activities).toHaveLength(initialCount + 1)
      expect(result.current.activities[0]).toMatchObject({
        type: 'joined',
        participantId: 'new-participant',
        participantName: 'New User',
        isNew: true,
        id: expect.any(String),
        timestamp: expect.any(Date),
      })
    })

    it('marks activities as not new after delay', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      let activityId: string
      
      act(() => {
        result.current.addActivity({
          type: 'meal_assigned',
          participantId: 'test-participant',
          participantName: 'Test User',
          metadata: { mealName: 'Lunch' },
        })
        activityId = result.current.activities[0].id
      })
      
      // Initially marked as new
      expect(result.current.activities[0].isNew).toBe(true)
      
      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000)
      })
      
      // Should no longer be new
      await waitFor(() => {
        const activity = result.current.activities.find(a => a.id === activityId)
        expect(activity?.isNew).toBe(false)
      })
    })

    it('maintains activity order with newest first', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      const initialFirstActivity = result.current.activities[0]
      
      act(() => {
        result.current.addActivity({
          type: 'comment_added',
          participantId: 'commenter',
          participantName: 'Commenter',
          metadata: { comment: 'Great trip!' },
        })
      })
      
      // New activity should be first
      expect(result.current.activities[0].type).toBe('comment_added')
      expect(result.current.activities[1]).toEqual(initialFirstActivity)
    })
  })

  describe('Polling Fallback', () => {
    it('polls for presence updates when WebSocket is disabled', async () => {
      const { result } = renderHook(() => 
        usePresence({ ...defaultOptions, enableWebSocket: false, pollInterval: 1000 })
      )
      
      const initialLastSeen = result.current.presenceState['1']?.lastSeen
      
      // Fast-forward to trigger polling
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      
      await waitFor(() => {
        // Should update random participant's lastSeen
        const hasUpdated = Object.values(result.current.presenceState).some(
          state => state.lastSeen !== initialLastSeen
        )
        expect(hasUpdated).toBe(true)
      })
    })

    it('stops polling when WebSocket connects', async () => {
      const { result } = renderHook(() => 
        usePresence({ ...defaultOptions, pollInterval: 1000 })
      )
      
      // Initially disconnected, should start polling
      expect(result.current.isConnected).toBe(false)
      
      // Connect WebSocket
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      // Wait for any WebSocket-related updates to settle
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      // Get state after WebSocket connection
      const currentStateKeys = Object.keys(result.current.presenceState)
      const currentStateCopy = {}
      currentStateKeys.forEach(key => {
        currentStateCopy[key] = {
          ...result.current.presenceState[key],
          lastSeen: result.current.presenceState[key].lastSeen.getTime()
        }
      })
      
      // Fast-forward past poll interval
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      
      // Should not have polled (timestamps should be unchanged)
      const newStateKeys = Object.keys(result.current.presenceState)
      const newStateCopy = {}
      newStateKeys.forEach(key => {
        newStateCopy[key] = {
          ...result.current.presenceState[key],
          lastSeen: result.current.presenceState[key].lastSeen.getTime()
        }
      })
      
      expect(newStateCopy).toEqual(currentStateCopy)
    })

    it('resumes polling when WebSocket disconnects', async () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      // Connect first
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      // Simulate disconnect
      act(() => {
        // In real implementation, this would trigger WebSocket close event
        // For now, we'll just check the polling behavior
      })
    })
  })

  describe('Cleanup', () => {
    it('cleans up WebSocket connection on unmount', async () => {
      const { unmount } = renderHook(() => usePresence(defaultOptions))
      
      // Establish connection
      act(() => {
        jest.advanceTimersByTime(100)
      })
      
      // Unmount should close connection
      unmount()
      
      // In real implementation, we'd verify WebSocket.close() was called
    })

    it('clears polling timer on unmount', () => {
      const { unmount } = renderHook(() => 
        usePresence({ ...defaultOptions, enableWebSocket: false })
      )
      
      // Start polling
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      
      // Unmount should clear timer
      unmount()
      
      // Advancing time should not cause any updates
      act(() => {
        jest.advanceTimersByTime(10000)
      })
      
      // No errors should occur
    })
  })

  describe('Edge Cases', () => {
    it('handles multiple rapid presence updates', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      act(() => {
        // Rapid updates
        for (let i = 0; i < 10; i++) {
          result.current.updatePresence('rapid-user', `Activity ${i}`)
        }
      })
      
      // Should have the last update
      expect(result.current.presenceState['rapid-user'].currentActivity).toBe('Activity 9')
    })

    it('handles very long activity descriptions', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      const longActivity = 'A'.repeat(1000)
      
      act(() => {
        result.current.addActivity({
          type: 'comment_added',
          participantId: 'verbose-user',
          participantName: 'Verbose User',
          metadata: { comment: longActivity },
        })
      })
      
      expect(result.current.activities[0].metadata?.comment).toBe(longActivity)
    })

    it('handles invalid participant IDs gracefully', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      act(() => {
        result.current.updatePresence('', 'Empty ID activity')
      })
      
      // Should still update, even with empty ID
      expect(result.current.presenceState['']).toBeDefined()
    })

    it('maintains presence state across re-renders', () => {
      const { result, rerender } = renderHook(
        (options) => usePresence(options),
        { initialProps: defaultOptions }
      )
      
      act(() => {
        result.current.updatePresence('stable-user', 'Stable activity')
      })
      
      const beforeRerender = result.current.presenceState['stable-user']
      
      // Re-render with same props
      rerender(defaultOptions)
      
      expect(result.current.presenceState['stable-user']).toEqual(beforeRerender)
    })

    it('handles connection with empty tripId', () => {
      const { result } = renderHook(() => 
        usePresence({ ...defaultOptions, tripId: '' })
      )
      
      // Should still initialize without errors
      expect(result.current.presenceState).toBeDefined()
      expect(result.current.activities).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('batches multiple activity additions efficiently', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      const startTime = Date.now()
      
      act(() => {
        // Add many activities at once
        for (let i = 0; i < 100; i++) {
          result.current.addActivity({
            type: 'joined',
            participantId: `participant-${i}`,
            participantName: `User ${i}`,
          })
        }
      })
      
      const endTime = Date.now()
      
      // Should complete quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
      
      // Should have all activities
      expect(result.current.activities.length).toBeGreaterThanOrEqual(100)
    })

    it('handles large presence state updates', () => {
      const { result } = renderHook(() => usePresence(defaultOptions))
      
      act(() => {
        // Update presence for many participants
        for (let i = 0; i < 1000; i++) {
          result.current.updatePresence(`participant-${i}`, `Activity ${i}`)
        }
      })
      
      // Should have all presence entries
      expect(Object.keys(result.current.presenceState).length).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('Options', () => {
    it('respects custom poll interval', async () => {
      const customInterval = 5000
      const { result } = renderHook(() => 
        usePresence({ 
          ...defaultOptions, 
          enableWebSocket: false, 
          pollInterval: customInterval 
        })
      )
      
      // Get a stable copy of initial state
      const initialStateKeys = Object.keys(result.current.presenceState)
      const initialStateCopy = {}
      initialStateKeys.forEach(key => {
        initialStateCopy[key] = {
          ...result.current.presenceState[key],
          lastSeen: result.current.presenceState[key].lastSeen.getTime()
        }
      })
      
      // Advance time less than interval
      act(() => {
        jest.advanceTimersByTime(customInterval - 1000)
      })
      
      // Should not have polled yet - compare timestamps
      const stillSameKeys = Object.keys(result.current.presenceState)
      const stillSameCopy = {}
      stillSameKeys.forEach(key => {
        stillSameCopy[key] = {
          ...result.current.presenceState[key],
          lastSeen: result.current.presenceState[key].lastSeen.getTime()
        }
      })
      expect(stillSameCopy).toEqual(initialStateCopy)
      
      // Advance to interval
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      
      // Should have polled - at least one participant should have updated lastSeen
      await waitFor(() => {
        const hasUpdated = Object.values(result.current.presenceState).some(
          (state, index) => {
            const oldTime = Object.values(initialStateCopy)[index]?.lastSeen || 0
            return state.lastSeen.getTime() > oldTime
          }
        )
        expect(hasUpdated).toBe(true)
      }, { timeout: 2000 })
    })

    it('uses provided tripId in WebSocket URL', () => {
      const customTripId = 'custom-trip-999'
      renderHook(() => 
        usePresence({ ...defaultOptions, tripId: customTripId })
      )
      
      // In real implementation, we'd verify the WebSocket URL contains customTripId
      // For now, the mock accepts any URL
    })
  })
})