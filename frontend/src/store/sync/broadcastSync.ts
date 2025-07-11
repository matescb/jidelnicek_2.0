/**
 * Cross-tab synchronization using BroadcastChannel API with localStorage fallback
 */

import type { 
  BroadcastSyncOptions, 
  BroadcastMessage, 
  SyncMessage,
  LeaderElectionState,
  StateDelta 
} from './types'
import { debounce } from 'lodash-es'

export class BroadcastSync {
  private channel: BroadcastChannel | null = null
  private options: Required<BroadcastSyncOptions>
  private tabId: string
  private isLeader: boolean = false
  private leaderState: LeaderElectionState
  private messageHandlers: Map<string, Set<(message: BroadcastMessage) => void>> = new Map()
  private storageListener: ((event: StorageEvent) => void) | null = null
  private leaderCheckInterval: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  
  constructor(options: BroadcastSyncOptions) {
    this.options = {
      channel: options.channel,
      leaderElection: options.leaderElection ?? true,
      leaderTimeout: options.leaderTimeout ?? 5000,
      fallbackToLocalStorage: options.fallbackToLocalStorage ?? true,
      storagePrefix: options.storagePrefix ?? 'sync:'
    }
    
    // Generate unique tab ID
    this.tabId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Initialize leader state
    this.leaderState = {
      candidates: new Map()
    }
    
    this.init()
  }
  
  private init(): void {
    // Try to use BroadcastChannel if available
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(this.options.channel)
        this.setupBroadcastChannel()
      } catch (error) {
        console.warn('BroadcastChannel not available, falling back to localStorage', error)
        this.setupLocalStorageFallback()
      }
    } else if (this.options.fallbackToLocalStorage) {
      this.setupLocalStorageFallback()
    }
    
    // Start leader election if enabled
    if (this.options.leaderElection) {
      this.startLeaderElection()
    }
    
    // Setup beforeunload handler
    window.addEventListener('beforeunload', this.cleanup)
  }
  
  private setupBroadcastChannel(): void {
    if (!this.channel) return
    
    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      this.handleMessage(event.data)
    }
    
    this.channel.onmessageerror = (event) => {
      console.error('BroadcastChannel message error:', event)
    }
  }
  
  private setupLocalStorageFallback(): void {
    if (!this.options.fallbackToLocalStorage) return
    
    // Listen for storage events
    this.storageListener = (event: StorageEvent) => {
      if (!event.key?.startsWith(this.options.storagePrefix)) return
      if (!event.newValue) return
      
      try {
        const message: BroadcastMessage = JSON.parse(event.newValue)
        
        // Don't process our own messages
        if (message.senderId === this.tabId) return
        
        this.handleMessage(message)
        
        // Clean up the storage entry
        setTimeout(() => {
          localStorage.removeItem(event.key!)
        }, 100)
      } catch (error) {
        console.error('Failed to parse storage message:', error)
      }
    }
    
    window.addEventListener('storage', this.storageListener)
  }
  
  private handleMessage = (message: BroadcastMessage): void => {
    // Don't process our own messages
    if (message.senderId === this.tabId) return
    
    // Handle leader election messages
    if (this.options.leaderElection) {
      this.handleLeaderElectionMessage(message)
    }
    
    // Notify all registered handlers for this store
    const handlers = this.messageHandlers.get(message.storeId)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('Broadcast message handler error:', error)
        }
      })
    }
  }
  
  private handleLeaderElectionMessage(message: BroadcastMessage): void {
    if (message.type === 'state-request' && this.isLeader) {
      // Leader should respond with state
      return
    }
    
    // Update candidate list for leader election
    if (message.meta?.source === 'local') {
      this.leaderState.candidates.set(message.senderId, Date.now())
    }
    
    // Check if current leader is still alive
    if (message.isLeader && message.senderId !== this.tabId) {
      this.leaderState.leaderId = message.senderId
      this.leaderState.electionTime = Date.now()
      this.isLeader = false
    }
  }
  
  private startLeaderElection(): void {
    // Initial election
    this.runLeaderElection()
    
    // Periodic leader check
    this.leaderCheckInterval = setInterval(() => {
      this.cleanupCandidates()
      this.runLeaderElection()
    }, this.options.leaderTimeout / 2)
    
    // Leader heartbeat
    this.heartbeatInterval = setInterval(() => {
      if (this.isLeader) {
        this.broadcast({
          type: 'state-update',
          storeId: 'leader-heartbeat',
          timestamp: Date.now(),
          meta: { source: 'local' }
        })
      }
    }, this.options.leaderTimeout / 3)
  }
  
  private runLeaderElection(): void {
    const now = Date.now()
    
    // Clean up old candidates
    this.cleanupCandidates()
    
    // Add ourselves as a candidate
    this.leaderState.candidates.set(this.tabId, now)
    
    // Check if current leader is still valid
    if (this.leaderState.leaderId && this.leaderState.electionTime) {
      const leaderAge = now - this.leaderState.electionTime
      if (leaderAge < this.options.leaderTimeout) {
        // Current leader is still valid
        return
      }
    }
    
    // No valid leader, elect the oldest candidate
    let oldestCandidate: string | null = null
    let oldestTime = Infinity
    
    this.leaderState.candidates.forEach((time, id) => {
      if (time < oldestTime) {
        oldestTime = time
        oldestCandidate = id
      }
    })
    
    if (oldestCandidate === this.tabId) {
      this.becomeLeader()
    }
  }
  
  private cleanupCandidates(): void {
    const now = Date.now()
    const timeout = this.options.leaderTimeout
    
    // Remove stale candidates
    this.leaderState.candidates.forEach((time, id) => {
      if (now - time > timeout) {
        this.leaderState.candidates.delete(id)
      }
    })
  }
  
  private becomeLeader(): void {
    this.isLeader = true
    this.leaderState.leaderId = this.tabId
    this.leaderState.electionTime = Date.now()
    
    // Announce leadership
    this.broadcast({
      type: 'state-update',
      storeId: 'leader-election',
      timestamp: Date.now(),
      meta: { source: 'local' }
    })
  }
  
  /**
   * Send a message to other tabs
   */
  broadcast(message: Omit<BroadcastMessage, 'senderId' | 'isLeader'>): void {
    const fullMessage: BroadcastMessage = {
      ...message,
      senderId: this.tabId,
      isLeader: this.isLeader
    }
    
    if (this.channel) {
      try {
        this.channel.postMessage(fullMessage)
      } catch (error) {
        console.error('Failed to post to BroadcastChannel:', error)
        this.fallbackBroadcast(fullMessage)
      }
    } else {
      this.fallbackBroadcast(fullMessage)
    }
  }
  
  private fallbackBroadcast(message: BroadcastMessage): void {
    if (!this.options.fallbackToLocalStorage) return
    
    const key = `${this.options.storagePrefix}${Date.now()}-${Math.random()}`
    
    try {
      localStorage.setItem(key, JSON.stringify(message))
      
      // Clean up after a short delay
      setTimeout(() => {
        localStorage.removeItem(key)
      }, 500)
    } catch (error) {
      console.error('Failed to broadcast via localStorage:', error)
    }
  }
  
  /**
   * Subscribe to messages for a specific store
   */
  subscribe(storeId: string, handler: (message: BroadcastMessage) => void): () => void {
    const handlers = this.messageHandlers.get(storeId) || new Set()
    handlers.add(handler)
    this.messageHandlers.set(storeId, handlers)
    
    // Return unsubscribe function
    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.messageHandlers.delete(storeId)
      }
    }
  }
  
  /**
   * Request state from leader tab
   */
  requestState(storeId: string): void {
    this.broadcast({
      type: 'state-request',
      storeId,
      timestamp: Date.now()
    })
  }
  
  /**
   * Send state updates with debouncing
   */
  private pendingUpdates: Map<string, StateDelta[]> = new Map()
  private debouncedBroadcast = debounce((storeId: string) => {
    const updates = this.pendingUpdates.get(storeId)
    if (!updates || updates.length === 0) return
    
    this.broadcast({
      type: 'state-update',
      storeId,
      timestamp: Date.now(),
      payload: updates,
      meta: { source: 'local' }
    })
    
    this.pendingUpdates.delete(storeId)
  }, 50)
  
  sendUpdate(storeId: string, updates: StateDelta[]): void {
    const pending = this.pendingUpdates.get(storeId) || []
    pending.push(...updates)
    this.pendingUpdates.set(storeId, pending)
    
    this.debouncedBroadcast(storeId)
  }
  
  /**
   * Check if this tab is the leader
   */
  getIsLeader(): boolean {
    return this.isLeader
  }
  
  /**
   * Get current leader state
   */
  getLeaderState(): LeaderElectionState {
    return { ...this.leaderState }
  }
  
  /**
   * Clean up resources
   */
  private cleanup = (): void => {
    // Clear intervals
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval)
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    // Close broadcast channel
    if (this.channel) {
      this.channel.close()
    }
    
    // Remove storage listener
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener)
    }
    
    // Announce departure
    if (this.isLeader) {
      // Try to transfer leadership
      this.broadcast({
        type: 'state-update',
        storeId: 'leader-departure',
        timestamp: Date.now(),
        meta: { source: 'local' }
      })
    }
  }
  
  /**
   * Destroy the broadcast sync instance
   */
  destroy(): void {
    window.removeEventListener('beforeunload', this.cleanup)
    this.cleanup()
  }
}

/**
 * Create a singleton broadcast sync instance for a store
 */
const broadcastInstances = new Map<string, BroadcastSync>()

export function getBroadcastSync(options: BroadcastSyncOptions): BroadcastSync {
  const existing = broadcastInstances.get(options.channel)
  if (existing) return existing
  
  const instance = new BroadcastSync(options)
  broadcastInstances.set(options.channel, instance)
  
  return instance
}