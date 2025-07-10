import React, { useEffect, useState } from 'react'
import { useTripWebSocket, useWebSocketEvent, usePresenceTracking } from '@/hooks/useWebSocket'
import type { UserPresenceEvent, ShoppingListUpdateEvent } from '@/types/websocket'
import { format } from 'date-fns'

interface RealTimeUpdatesExampleProps {
  tripId: string
}

interface ActiveUser {
  userId: string
  userName: string
  status: 'active' | 'idle'
  currentView?: string
  lastSeen: Date
}

export function RealTimeUpdatesExample({ tripId }: RealTimeUpdatesExampleProps) {
  const { isConnected, connectionStatus } = useTripWebSocket(tripId)
  const [activeUsers, setActiveUsers] = useState<Map<string, ActiveUser>>(new Map())
  const [lastShoppingListUpdate, setLastShoppingListUpdate] = useState<Date | null>(null)
  const [notifications, setNotifications] = useState<string[]>([])

  // Track user presence for this component
  usePresenceTracking(tripId, 'trip-details')

  // Handle user presence events
  useWebSocketEvent('user:presence', (event) => {
    const { payload } = event
    if (payload.tripId !== tripId) return

    setActiveUsers((prev) => {
      const newMap = new Map(prev)
      
      if (payload.action === 'left') {
        newMap.delete(payload.userId)
      } else {
        newMap.set(payload.userId, {
          userId: payload.userId,
          userName: payload.userName,
          status: payload.action === 'idle' ? 'idle' : 'active',
          currentView: payload.currentView,
          lastSeen: new Date(),
        })
      }
      
      return newMap
    })

    // Add notification
    if (payload.action === 'joined') {
      addNotification(`${payload.userName} joined the trip`)
    } else if (payload.action === 'left') {
      addNotification(`${payload.userName} left the trip`)
    }
  })

  // Handle shopping list updates
  useWebSocketEvent('shopping-list:update', (event) => {
    const { payload } = event
    if (payload.tripId !== tripId) return

    setLastShoppingListUpdate(new Date(payload.generatedAt))
    addNotification('Shopping list has been updated')
  })

  // Handle participant changes
  useWebSocketEvent('participant:added', (event) => {
    const { payload } = event
    if (payload.tripId !== tripId) return

    addNotification(`${payload.participant.name} has been added to the trip`)
  })

  useWebSocketEvent('participant:removed', (event) => {
    const { payload } = event
    if (payload.tripId !== tripId) return

    addNotification('A participant has been removed from the trip')
  })

  // Handle meal assignments
  useWebSocketEvent('meal:assignment-change', (event) => {
    const { payload } = event
    if (payload.tripId !== tripId) return

    const mealType = payload.mealSlot.charAt(0).toUpperCase() + payload.mealSlot.slice(1)
    if (payload.recipeId) {
      addNotification(`${mealType} has been assigned`)
    } else {
      addNotification(`${mealType} has been removed`)
    }
  })

  // Clean up old users who haven't been seen in 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUsers((prev) => {
        const newMap = new Map(prev)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
        
        for (const [userId, user] of newMap) {
          if (user.lastSeen < twoMinutesAgo) {
            newMap.delete(userId)
          }
        }
        
        return newMap
      })
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const addNotification = (message: string) => {
    setNotifications((prev) => [...prev.slice(-4), message]) // Keep last 5 notifications
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.slice(1))
    }, 5000)
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">Real-Time Connection</h3>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Active Users */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Active Users</h3>
        {activeUsers.size > 0 ? (
          <div className="space-y-2">
            {Array.from(activeUsers.values()).map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      user.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  <span className="font-medium">{user.userName}</span>
                </div>
                {user.currentView && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {user.currentView}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No active users</p>
        )}
      </div>

      {/* Recent Updates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Recent Updates</h3>
        {lastShoppingListUpdate && (
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            Shopping list updated: {format(lastShoppingListUpdate, 'HH:mm:ss')}
          </div>
        )}
        {notifications.length > 0 ? (
          <div className="space-y-1">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="text-sm p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded animate-fade-in"
              >
                {notification}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No recent updates</p>
        )}
      </div>
    </div>
  )
}

// Add this to your CSS or Tailwind config
const styles = `
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
`