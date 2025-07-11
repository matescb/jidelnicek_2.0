/**
 * WebSocket-based state synchronization with room support
 */

import type {
  WebSocketSyncOptions,
  WebSocketSyncMessage,
  SyncMessage,
  StateDelta,
  SyncMeta
} from './types'
import { websocketService } from '@/services/websocket'
import { debounce } from 'lodash-es'
import pako from 'pako'

export class WebSocketSync {
  private options: Required<WebSocketSyncOptions>
  private storeId: string
  private room?: string
  private isConnected: boolean = false
  private messageHandlers: Set<(message: WebSocketSyncMessage) => void> = new Set()
  private reconnectAttempts: number = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private pendingUpdates: StateDelta[] = []
  private unsubscribe: (() => void) | null = null
  private connectionUnsubscribe: (() => void) | null = null
  
  constructor(storeId: string, options: WebSocketSyncOptions = {}) {
    this.storeId = storeId
    this.options = {
      url: options.url || websocketService.config?.url || '',
      room: options.room,
      auth: options.auth || {},
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      heartbeatInterval: options.heartbeatInterval ?? 30000
    }
    
    this.room = options.room
    this.init()
  }
  
  private async init(): Promise<void> {
    // Subscribe to WebSocket connection changes
    this.connectionUnsubscribe = websocketService.onConnectionChange((event) => {
      if (event.status === 'connected') {
        this.handleConnect()
      } else if (event.status === 'disconnected' || event.status === 'error') {
        this.handleDisconnect()
      }
    })
    
    // Connect if not already connected
    if (websocketService.isConnected()) {
      this.handleConnect()
    } else {
      try {
        await websocketService.connect()
      } catch (error) {
        console.error('Failed to connect WebSocket for sync:', error)
        this.scheduleReconnect()
      }
    }
  }
  
  private handleConnect(): void {
    this.isConnected = true
    this.reconnectAttempts = 0
    
    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    // Join room if specified
    if (this.room) {
      this.joinRoom(this.room)
    }
    
    // Subscribe to sync events
    this.setupEventListeners()
    
    // Start heartbeat
    this.startHeartbeat()
    
    // Flush pending updates
    this.flushPendingUpdates()
  }
  
  private handleDisconnect(): void {
    this.isConnected = false
    
    // Stop heartbeat
    this.stopHeartbeat()
    
    // Schedule reconnect
    this.scheduleReconnect()
  }
  
  private setupEventListeners(): void {
    // Unsubscribe previous listeners
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    
    // Subscribe to store-specific sync events
    this.unsubscribe = websocketService.on(`sync:${this.storeId}`, (data) => {
      this.handleSyncMessage(data as WebSocketSyncMessage)
    })
    
    // Subscribe to room sync events if in a room
    if (this.room) {
      websocketService.on(`room:${this.room}:sync`, (data) => {
        const message = data as WebSocketSyncMessage
        if (message.storeId === this.storeId) {
          this.handleSyncMessage(message)
        }
      })
    }
  }
  
  private handleSyncMessage(message: WebSocketSyncMessage): void {
    // Don't process our own messages (if they come back)
    if (message.meta?.sessionId === this.getSessionId()) {
      return
    }
    
    // Notify all handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error('WebSocket sync message handler error:', error)
      }
    })
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached for WebSocket sync')
      return
    }
    
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    )
    
    this.reconnectAttempts++
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await websocketService.connect()
      } catch (error) {
        console.error('Reconnection attempt failed:', error)
        this.scheduleReconnect()
      }
    }, delay)
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'state-update',
          storeId: `${this.storeId}:heartbeat`,
          timestamp: Date.now(),
          meta: {
            source: 'local',
            sessionId: this.getSessionId()
          }
        })
      }
    }, this.options.heartbeatInterval)
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
  
  /**
   * Join a sync room
   */
  joinRoom(room: string): void {
    this.room = room
    
    if (this.isConnected) {
      websocketService.emit('sync:join', {
        room,
        storeId: this.storeId
      })
    }
  }
  
  /**
   * Leave current sync room
   */
  leaveRoom(): void {
    if (this.room && this.isConnected) {
      websocketService.emit('sync:leave', {
        room: this.room,
        storeId: this.storeId
      })
    }
    
    this.room = undefined
  }
  
  /**
   * Send a sync message
   */
  private send(message: WebSocketSyncMessage): void {
    if (!this.isConnected) {
      // Queue for later if not connected
      if (message.payload && Array.isArray(message.payload)) {
        this.pendingUpdates.push(...message.payload)
      }
      return
    }
    
    // Add room info if in a room
    if (this.room) {
      message.room = this.room
    }
    
    // Compress payload if configured
    if (message.payload && this.shouldCompress(message.payload)) {
      message.payload = this.compressPayload(message.payload)
      message.meta = {
        ...message.meta,
        compressed: true
      }
    }
    
    websocketService.emit('sync:message', message)
  }
  
  /**
   * Send state updates with batching and debouncing
   */
  private updateBuffer: StateDelta[] = []
  private debouncedSend = debounce(() => {
    if (this.updateBuffer.length === 0) return
    
    const updates = [...this.updateBuffer]
    this.updateBuffer = []
    
    this.send({
      type: 'state-update',
      storeId: this.storeId,
      timestamp: Date.now(),
      payload: updates,
      meta: {
        source: 'local',
        sessionId: this.getSessionId()
      }
    })
  }, 50)
  
  sendUpdate(updates: StateDelta[]): void {
    this.updateBuffer.push(...updates)
    this.debouncedSend()
  }
  
  /**
   * Request full state sync
   */
  requestState(): void {
    this.send({
      type: 'state-request',
      storeId: this.storeId,
      timestamp: Date.now(),
      meta: {
        sessionId: this.getSessionId()
      }
    })
  }
  
  /**
   * Send full state
   */
  sendState(state: any, targetPeers?: string[]): void {
    this.send({
      type: 'state-response',
      storeId: this.storeId,
      timestamp: Date.now(),
      payload: state,
      targetPeers,
      meta: {
        source: 'local',
        sessionId: this.getSessionId()
      }
    })
  }
  
  /**
   * Subscribe to sync messages
   */
  subscribe(handler: (message: WebSocketSyncMessage) => void): () => void {
    this.messageHandlers.add(handler)
    
    return () => {
      this.messageHandlers.delete(handler)
    }
  }
  
  /**
   * Flush pending updates
   */
  private flushPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) return
    
    this.sendUpdate(this.pendingUpdates)
    this.pendingUpdates = []
  }
  
  /**
   * Check if payload should be compressed
   */
  private shouldCompress(payload: any): boolean {
    const size = JSON.stringify(payload).length
    return size > 1024 // Compress if larger than 1KB
  }
  
  /**
   * Compress payload using pako
   */
  private compressPayload(payload: any): string {
    try {
      const json = JSON.stringify(payload)
      const compressed = pako.deflate(json)
      return btoa(String.fromCharCode.apply(null, Array.from(compressed)))
    } catch (error) {
      console.error('Failed to compress payload:', error)
      return payload
    }
  }
  
  /**
   * Decompress payload
   */
  static decompressPayload(compressed: string): any {
    try {
      const binary = atob(compressed)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const decompressed = pako.inflate(bytes, { to: 'string' })
      return JSON.parse(decompressed)
    } catch (error) {
      console.error('Failed to decompress payload:', error)
      return compressed
    }
  }
  
  /**
   * Get current connection status
   */
  getIsConnected(): boolean {
    return this.isConnected
  }
  
  /**
   * Get session ID for this tab/instance
   */
  private getSessionId(): string {
    // Use a combination of timestamp and random value
    if (!this._sessionId) {
      this._sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    return this._sessionId
  }
  private _sessionId?: string
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Stop heartbeat
    this.stopHeartbeat()
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    // Leave room
    if (this.room) {
      this.leaveRoom()
    }
    
    // Unsubscribe from events
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    
    if (this.connectionUnsubscribe) {
      this.connectionUnsubscribe()
    }
    
    // Clear handlers
    this.messageHandlers.clear()
  }
}

/**
 * Create a WebSocket sync instance for a store
 */
const wsInstances = new Map<string, WebSocketSync>()

export function getWebSocketSync(storeId: string, options?: WebSocketSyncOptions): WebSocketSync {
  const key = `${storeId}:${options?.room || 'default'}`
  const existing = wsInstances.get(key)
  if (existing) return existing
  
  const instance = new WebSocketSync(storeId, options)
  wsInstances.set(key, instance)
  
  return instance
}