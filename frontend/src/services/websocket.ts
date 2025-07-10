import { io, Socket } from 'socket.io-client'
import type {
  WebSocketConfig,
  WebSocketEventMap,
  WebSocketEventName,
  ConnectionEvent,
  SubscriptionOptions,
} from '@/types/websocket'
import { tokenStorage } from '@/utils/tokenStorage'

type EventCallback<T extends WebSocketEventName> = (data: WebSocketEventMap[T]) => void
type ConnectionCallback = (event: ConnectionEvent) => void

export class WebSocketService {
  private socket: Socket | null = null
  private config: WebSocketConfig
  private eventHandlers: Map<string, Set<Function>> = new Map()
  private connectionHandlers: Set<ConnectionCallback> = new Set()
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private subscriptions: Map<string, SubscriptionOptions> = new Map()
  private isAuthenticated = false

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000',
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      ...config,
    }
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return
    }

    const token = tokenStorage.getAccessToken()
    if (!token) {
      throw new Error('No authentication token available')
    }

    this.notifyConnection({ status: 'connecting' })

    this.socket = io(this.config.url, {
      path: this.config.path,
      transports: this.config.transports,
      autoConnect: this.config.autoConnect,
      reconnection: false, // We handle reconnection manually
      timeout: this.config.timeout,
      auth: {
        token,
      },
    })

    this.setupEventHandlers()
    this.socket.connect()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, this.config.timeout!)

      this.socket!.once('connect', () => {
        clearTimeout(timeout)
        this.isAuthenticated = true
        this.reconnectAttempts = 0
        this.notifyConnection({ status: 'connected' })
        this.resubscribeAll()
        resolve()
      })

      this.socket!.once('connect_error', (error) => {
        clearTimeout(timeout)
        this.handleConnectionError(error)
        reject(error)
      })
    })
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    this.isAuthenticated = false
    this.notifyConnection({ status: 'disconnected' })
  }

  /**
   * Subscribe to a specific event
   */
  on<T extends WebSocketEventName>(
    event: T,
    callback: EventCallback<T>,
    options?: SubscriptionOptions
  ): () => void {
    const handlers = this.eventHandlers.get(event) || new Set()
    handlers.add(callback)
    this.eventHandlers.set(event, handlers)

    if (options) {
      this.subscriptions.set(`${event}:${JSON.stringify(options)}`, options)
    }

    // If connected, set up the socket listener
    if (this.socket?.connected) {
      this.socket.on(event, callback as any)

      // Send subscription request if needed
      if (options?.tripId) {
        this.socket.emit('subscribe', { event, tripId: options.tripId })
      }
    }

    // Return unsubscribe function
    return () => {
      handlers.delete(callback)
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
        this.socket?.off(event, callback as any)

        // Send unsubscribe request if needed
        if (options?.tripId && this.socket?.connected) {
          this.socket.emit('unsubscribe', { event, tripId: options.tripId })
        }
      }
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionHandlers.add(callback)
    return () => {
      this.connectionHandlers.delete(callback)
    }
  }

  /**
   * Emit an event to the server
   */
  emit<T extends WebSocketEventName>(
    event: T,
    data: WebSocketEventMap[T]['payload']
  ): void {
    if (!this.socket?.connected) {
      console.warn(`Cannot emit ${event}: socket not connected`)
      return
    }

    this.socket.emit(event, {
      type: event,
      payload: data,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Join a trip room for real-time updates
   */
  joinTrip(tripId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot join trip: socket not connected')
      return
    }

    this.socket.emit('trip:join', { tripId })
  }

  /**
   * Leave a trip room
   */
  leaveTrip(tripId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot leave trip: socket not connected')
      return
    }

    this.socket.emit('trip:leave', { tripId })
  }

  /**
   * Emit a custom event to the server
   */
  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.warn(`Cannot emit ${event}: socket not connected`)
      return
    }

    this.socket.emit(event, data)
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  /**
   * Update authentication token
   */
  updateAuth(token: string): void {
    if (this.socket) {
      this.socket.auth = { token }
      if (this.socket.connected) {
        this.socket.disconnect()
        this.socket.connect()
      }
    }
  }

  /**
   * Set up internal event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.isAuthenticated = true
      this.reconnectAttempts = 0
      this.notifyConnection({ status: 'connected' })
      this.resubscribeAll()
    })

    this.socket.on('disconnect', (reason) => {
      this.isAuthenticated = false
      this.notifyConnection({ status: 'disconnected' })
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt to reconnect
        this.attemptReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error)
    })

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.notifyConnection({ 
        status: 'error', 
        error: error.message || 'Unknown error' 
      })
    })

    // Re-register all event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket!.on(event, handler as any)
      })
    })
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error)
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      // Authentication error, don't retry
      this.notifyConnection({ 
        status: 'error', 
        error: 'Authentication failed' 
      })
      return
    }

    this.notifyConnection({ 
      status: 'error', 
      error: error.message,
      reconnectAttempt: this.reconnectAttempts 
    })

    this.attemptReconnect()
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectionAttempts!) {
      this.notifyConnection({ 
        status: 'error', 
        error: 'Max reconnection attempts reached' 
      })
      return
    }

    const delay = Math.min(
      this.config.reconnectionDelay! * Math.pow(2, this.reconnectAttempts),
      this.config.reconnectionDelayMax!
    )

    this.reconnectAttempts++
    this.notifyConnection({ 
      status: 'disconnected',
      reconnectAttempt: this.reconnectAttempts,
      nextRetryIn: delay 
    })

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * Notify connection status handlers
   */
  private notifyConnection(event: ConnectionEvent): void {
    this.connectionHandlers.forEach((handler) => handler(event))
  }

  /**
   * Resubscribe to all events after reconnection
   */
  private resubscribeAll(): void {
    if (!this.socket?.connected) return

    // Resubscribe to trip rooms
    this.subscriptions.forEach((options, key) => {
      if (options.tripId) {
        this.socket!.emit('subscribe', { 
          event: key.split(':')[0], 
          tripId: options.tripId 
        })
      }
    })
  }
}

// Singleton instance
export const websocketService = new WebSocketService()