import React, { createContext, useContext, useEffect, useState } from 'react'
import { websocketService } from '@/services/websocket'
import type { ConnectionEvent } from '@/types/websocket'
import { useAuth } from '@/hooks/useAuth'
import { useTripStore } from '@/store/slices/tripStore'
import { enhanceTripStoreWithWebSocket } from '@/store/slices/tripStore.websocket'

interface WebSocketContextValue {
  isConnected: boolean
  connectionStatus: ConnectionEvent['status']
  connectionError?: string
  reconnectAttempts?: number
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  connectionStatus: 'disconnected',
})

export const useWebSocketContext = () => useContext(WebSocketContext)

interface WebSocketProviderProps {
  children: React.ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { isAuthenticated } = useAuth()
  const tripStore = useTripStore()
  const [connectionState, setConnectionState] = useState<WebSocketContextValue>({
    isConnected: false,
    connectionStatus: 'disconnected',
  })

  // Set up WebSocket connection and store integration
  useEffect(() => {
    let isSetup = false

    const setupWebSocket = async () => {
      if (!isAuthenticated) {
        websocketService.disconnect()
        return
      }

      // Set up connection status listener
      const unsubscribeConnection = websocketService.onConnectionChange((event) => {
        setConnectionState({
          isConnected: event.status === 'connected',
          connectionStatus: event.status,
          connectionError: event.error,
          reconnectAttempts: event.reconnectAttempt,
        })
      })

      // Enhance trip store with WebSocket updates (only once)
      if (!isSetup) {
        enhanceTripStoreWithWebSocket(tripStore)
        isSetup = true
      }

      // Connect to WebSocket
      try {
        await websocketService.connect()
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error)
      }

      return () => {
        unsubscribeConnection()
        websocketService.disconnect()
      }
    }

    const cleanup = setupWebSocket()

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.())
    }
  }, [isAuthenticated, tripStore])

  // Update auth token when it changes
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token && websocketService.isConnected()) {
      websocketService.updateAuth(token)
    }
  }, [])

  return (
    <WebSocketContext.Provider value={connectionState}>
      {children}
      
      {/* Connection status indicator (optional) */}
      {connectionState.connectionStatus === 'error' && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Connection error: {connectionState.connectionError}</span>
          </div>
        </div>
      )}
      
      {connectionState.connectionStatus === 'connecting' && connectionState.reconnectAttempts && (
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Reconnecting... (attempt {connectionState.reconnectAttempts})</span>
          </div>
        </div>
      )}
    </WebSocketContext.Provider>
  )
}