import { useEffect, useState, useCallback, useRef } from 'react'
import { websocketService } from '@/services/websocket'
import type {
  WebSocketEventMap,
  WebSocketEventName,
  ConnectionEvent,
  SubscriptionOptions,
} from '@/types/websocket'
import { useAuth } from './useAuth'

type EventCallback<T extends WebSocketEventName> = (data: WebSocketEventMap[T]) => void

interface UseWebSocketReturn {
  isConnected: boolean
  connectionStatus: ConnectionEvent['status']
  connectionError?: string
  connect: () => Promise<void>
  disconnect: () => void
  emit: <T extends WebSocketEventName>(
    event: T,
    data: WebSocketEventMap[T]['payload']
  ) => void
  on: <T extends WebSocketEventName>(
    event: T,
    callback: EventCallback<T>,
    options?: SubscriptionOptions
  ) => void
  off: <T extends WebSocketEventName>(
    event: T,
    callback: EventCallback<T>
  ) => void
  joinTrip: (tripId: string) => void
  leaveTrip: (tripId: string) => void
}

/**
 * Hook for WebSocket connection and event handling
 */
export function useWebSocket(): UseWebSocketReturn {
  const { user, isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(websocketService.isConnected())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionEvent['status']>(
    websocketService.isConnected() ? 'connected' : 'disconnected'
  )
  const [connectionError, setConnectionError] = useState<string>()
  const unsubscribeRef = useRef<(() => void)[]>([])

  // Handle connection status changes
  useEffect(() => {
    const unsubscribe = websocketService.onConnectionChange((event) => {
      setConnectionStatus(event.status)
      setIsConnected(event.status === 'connected')
      setConnectionError(event.error)
    })

    unsubscribeRef.current.push(unsubscribe)

    return () => {
      unsubscribe()
    }
  }, [])

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      websocketService.connect().catch((error) => {
        console.error('Failed to connect to WebSocket:', error)
      })
    } else if (!isAuthenticated && isConnected) {
      websocketService.disconnect()
    }
  }, [isAuthenticated, isConnected])

  // Connect function
  const connect = useCallback(async () => {
    try {
      await websocketService.connect()
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      throw error
    }
  }, [])

  // Disconnect function
  const disconnect = useCallback(() => {
    websocketService.disconnect()
  }, [])

  // Emit event
  const emit = useCallback(
    <T extends WebSocketEventName>(
      event: T,
      data: WebSocketEventMap[T]['payload']
    ) => {
      websocketService.emit(event, data)
    },
    []
  )

  // Subscribe to event
  const on = useCallback(
    <T extends WebSocketEventName>(
      event: T,
      callback: EventCallback<T>,
      options?: SubscriptionOptions
    ) => {
      const unsubscribe = websocketService.on(event, callback, options)
      unsubscribeRef.current.push(unsubscribe)
    },
    []
  )

  // Unsubscribe from event
  const off = useCallback(
    <T extends WebSocketEventName>(
      event: T,
      callback: EventCallback<T>
    ) => {
      // Note: This doesn't remove from unsubscribeRef, but that's okay
      // as the cleanup will happen on unmount
      websocketService.on(event, callback)() // Call the unsubscribe function
    },
    []
  )

  // Join trip room
  const joinTrip = useCallback((tripId: string) => {
    websocketService.joinTrip(tripId)
  }, [])

  // Leave trip room
  const leaveTrip = useCallback((tripId: string) => {
    websocketService.leaveTrip(tripId)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRef.current.forEach((unsubscribe) => unsubscribe())
      unsubscribeRef.current = []
    }
  }, [])

  return {
    isConnected,
    connectionStatus,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinTrip,
    leaveTrip,
  }
}

/**
 * Hook for subscribing to specific WebSocket events
 */
export function useWebSocketEvent<T extends WebSocketEventName>(
  event: T,
  callback: EventCallback<T>,
  options?: SubscriptionOptions & { enabled?: boolean }
): void {
  const { on, off } = useWebSocket()
  const { enabled = true, ...subscriptionOptions } = options || {}

  useEffect(() => {
    if (!enabled) return

    on(event, callback, subscriptionOptions)

    return () => {
      off(event, callback)
    }
  }, [event, callback, enabled, on, off, subscriptionOptions])
}

/**
 * Hook for trip-specific WebSocket events
 */
export function useTripWebSocket(tripId: string | undefined) {
  const { joinTrip, leaveTrip, on, off, ...rest } = useWebSocket()

  // Join/leave trip room
  useEffect(() => {
    if (!tripId) return

    joinTrip(tripId)

    return () => {
      leaveTrip(tripId)
    }
  }, [tripId, joinTrip, leaveTrip])

  // Helper function for trip-specific event subscription
  const onTripEvent = useCallback(
    <T extends WebSocketEventName>(
      event: T,
      callback: EventCallback<T>
    ) => {
      if (!tripId) return

      on(event, callback, { tripId })
    },
    [tripId, on]
  )

  return {
    ...rest,
    on,
    off,
    onTripEvent,
  }
}

/**
 * Hook for user presence tracking
 */
export function usePresenceTracking(tripId: string | undefined, currentView?: string) {
  const { emit, isConnected } = useWebSocket()
  const { user } = useAuth()
  const lastActivityRef = useRef<Date>(new Date())
  const idleTimerRef = useRef<NodeJS.Timeout>()

  // Send presence update
  const sendPresenceUpdate = useCallback(
    (action: 'active' | 'idle') => {
      if (!tripId || !user || !isConnected) return

      emit('user:presence', {
        tripId,
        userId: user.id,
        userName: user.firstName || user.email,
        action,
        currentView,
      })
    },
    [tripId, user, isConnected, currentView, emit]
  )

  // Track user activity
  useEffect(() => {
    if (!tripId || !user || !isConnected) return

    const handleActivity = () => {
      const now = new Date()
      const timeSinceLastActivity = now.getTime() - lastActivityRef.current.getTime()

      // If user was idle, send active status
      if (timeSinceLastActivity > 30000) {
        sendPresenceUpdate('active')
      }

      lastActivityRef.current = now

      // Reset idle timer
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }

      idleTimerRef.current = setTimeout(() => {
        sendPresenceUpdate('idle')
      }, 30000) // Mark as idle after 30 seconds of inactivity
    }

    // Send initial joined status
    emit('user:presence', {
      tripId,
      userId: user.id,
      userName: user.firstName || user.email,
      action: 'joined',
      currentView,
    })

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })

    // Start idle timer
    handleActivity()

    return () => {
      // Send left status
      emit('user:presence', {
        tripId,
        userId: user.id,
        userName: user.firstName || user.email,
        action: 'left',
      })

      // Cleanup
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
    }
  }, [tripId, user, isConnected, currentView, emit, sendPresenceUpdate])
}