import { errorLogger, ErrorSeverity } from './errorLogger';

// Network status types
export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SLOW = 'slow',
  UNKNOWN = 'unknown'
}

// Connection quality types
export enum ConnectionQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  OFFLINE = 'offline'
}

// Network change event
export interface NetworkChangeEvent {
  previousStatus: NetworkStatus;
  currentStatus: NetworkStatus;
  connectionQuality: ConnectionQuality;
  timestamp: Date;
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
}

// Queued request
export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: Date;
  retryCount: number;
  priority: number;
  onSuccess?: (response: any) => void;
  onError?: (error: Error) => void;
}

// Network monitor configuration
export interface NetworkMonitorConfig {
  pingUrl: string;
  pingInterval: number;
  slowThresholdMs: number;
  sampleSize: number;
  enableOfflineQueue: boolean;
  maxQueueSize: number;
  queuePersistKey: string;
}

// Speed test result
interface SpeedTestResult {
  latency: number;
  downloadSpeed?: number;
  timestamp: Date;
}

type NetworkChangeListener = (event: NetworkChangeEvent) => void;
type QueueProcessListener = (processed: number, remaining: number) => void;

class NetworkMonitorService {
  private status: NetworkStatus = NetworkStatus.UNKNOWN;
  private connectionQuality: ConnectionQuality = ConnectionQuality.GOOD;
  private listeners: Set<NetworkChangeListener> = new Set();
  private queueListeners: Set<QueueProcessListener> = new Set();
  private requestQueue: Map<string, QueuedRequest> = new Map();
  private speedHistory: SpeedTestResult[] = [];
  private pingInterval?: NodeJS.Timeout;
  private isProcessingQueue = false;
  private lastOnlineTime?: Date;
  private lastOfflineTime?: Date;
  private connectionInfo?: NetworkInformation;

  private config: NetworkMonitorConfig = {
    pingUrl: '/api/v1/health/ping',
    pingInterval: 30000, // 30 seconds
    slowThresholdMs: 3000, // 3 seconds
    sampleSize: 5,
    enableOfflineQueue: true,
    maxQueueSize: 100,
    queuePersistKey: 'jidelnicek_offline_queue'
  };

  constructor() {
    this.initialize();
  }

  /**
   * Configure the network monitor
   */
  configure(config: Partial<NetworkMonitorConfig>) {
    this.config = { ...this.config, ...config };
    
    // Restart monitoring with new config
    if (this.pingInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * Get connection quality
   */
  getConnectionQuality(): ConnectionQuality {
    return this.connectionQuality;
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this.status === NetworkStatus.ONLINE;
  }

  /**
   * Get network information
   */
  getNetworkInfo(): {
    status: NetworkStatus;
    quality: ConnectionQuality;
    lastOnline?: Date;
    lastOffline?: Date;
    averageLatency?: number;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    queueSize: number;
  } {
    const avgLatency = this.calculateAverageLatency();

    return {
      status: this.status,
      quality: this.connectionQuality,
      lastOnline: this.lastOnlineTime,
      lastOffline: this.lastOfflineTime,
      averageLatency: avgLatency,
      effectiveType: this.connectionInfo?.effectiveType,
      downlink: this.connectionInfo?.downlink,
      rtt: this.connectionInfo?.rtt,
      queueSize: this.requestQueue.size
    };
  }

  /**
   * Add listener for network changes
   */
  addListener(listener: NetworkChangeListener) {
    this.listeners.add(listener);
  }

  /**
   * Remove network change listener
   */
  removeListener(listener: NetworkChangeListener) {
    this.listeners.delete(listener);
  }

  /**
   * Add queue processing listener
   */
  addQueueListener(listener: QueueProcessListener) {
    this.queueListeners.add(listener);
  }

  /**
   * Remove queue processing listener
   */
  removeQueueListener(listener: QueueProcessListener) {
    this.queueListeners.delete(listener);
  }

  /**
   * Queue a request for offline execution
   */
  queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): string {
    if (!this.config.enableOfflineQueue) {
      throw new Error('Offline queue is disabled');
    }

    if (this.requestQueue.size >= this.config.maxQueueSize) {
      // Remove oldest low-priority request
      const oldestLowPriority = Array.from(this.requestQueue.values())
        .filter(r => r.priority < 5)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      
      if (oldestLowPriority) {
        this.requestQueue.delete(oldestLowPriority.id);
      } else {
        throw new Error('Request queue is full');
      }
    }

    const id = this.generateRequestId();
    const queuedRequest: QueuedRequest = {
      ...request,
      id,
      timestamp: new Date(),
      retryCount: 0
    };

    this.requestQueue.set(id, queuedRequest);
    this.persistQueue();

    // Try to process immediately if online
    if (this.isOnline()) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Remove request from queue
   */
  removeFromQueue(id: string): boolean {
    const removed = this.requestQueue.delete(id);
    if (removed) {
      this.persistQueue();
    }
    return removed;
  }

  /**
   * Get queued requests
   */
  getQueuedRequests(): QueuedRequest[] {
    return Array.from(this.requestQueue.values())
      .sort((a, b) => b.priority - a.priority || a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear the request queue
   */
  clearQueue() {
    this.requestQueue.clear();
    this.persistQueue();
  }

  /**
   * Manually trigger queue processing
   */
  async processQueue() {
    if (!this.isOnline() || this.isProcessingQueue || this.requestQueue.size === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const requests = this.getQueuedRequests();
    let processed = 0;

    for (const request of requests) {
      try {
        const response = await this.executeRequest(request);
        
        if (request.onSuccess) {
          request.onSuccess(response);
        }

        this.requestQueue.delete(request.id);
        processed++;

        // Notify listeners
        this.notifyQueueListeners(processed, this.requestQueue.size);
      } catch (error) {
        request.retryCount++;
        
        if (request.retryCount >= 3) {
          if (request.onError) {
            request.onError(error as Error);
          }
          this.requestQueue.delete(request.id);
          
          errorLogger.logError(
            error as Error,
            ErrorSeverity.MEDIUM,
            undefined,
            { 
              action: 'offline_queue_failed',
              url: request.url,
              method: request.method
            }
          );
        }
        
        // Stop processing if we're offline again
        if (!this.isOnline()) {
          break;
        }
      }
    }

    this.persistQueue();
    this.isProcessingQueue = false;
  }

  /**
   * Start monitoring network
   */
  startMonitoring() {
    if (this.pingInterval) {
      return; // Already monitoring
    }

    // Initial check
    this.checkNetworkStatus();

    // Set up periodic monitoring
    this.pingInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, this.config.pingInterval);
  }

  /**
   * Stop monitoring network
   */
  stopMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private initialize() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Listen to connection changes if available
    if ('connection' in navigator) {
      this.connectionInfo = (navigator as any).connection;
      this.connectionInfo?.addEventListener('change', this.handleConnectionChange);
    }

    // Load persisted queue
    this.loadPersistedQueue();

    // Start monitoring
    this.startMonitoring();
  }

  private handleOnline = () => {
    this.updateStatus(NetworkStatus.ONLINE);
    this.lastOnlineTime = new Date();
    this.processQueue();
  };

  private handleOffline = () => {
    this.updateStatus(NetworkStatus.OFFLINE);
    this.lastOfflineTime = new Date();
  };

  private handleConnectionChange = () => {
    this.checkNetworkStatus();
  };

  private async checkNetworkStatus() {
    // Quick online check
    if (!navigator.onLine) {
      this.updateStatus(NetworkStatus.OFFLINE);
      return;
    }

    // Detailed speed test
    try {
      const startTime = performance.now();
      const response = await fetch(this.config.pingUrl, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = performance.now();

      if (response.ok) {
        const latency = endTime - startTime;
        this.recordSpeedTest({ latency, timestamp: new Date() });

        // Determine status based on latency
        if (latency > this.config.slowThresholdMs) {
          this.updateStatus(NetworkStatus.SLOW);
        } else {
          this.updateStatus(NetworkStatus.ONLINE);
        }

        // Update connection quality
        this.updateConnectionQuality();
      } else {
        this.updateStatus(NetworkStatus.OFFLINE);
      }
    } catch (error) {
      this.updateStatus(NetworkStatus.OFFLINE);
    }
  }

  private updateStatus(newStatus: NetworkStatus) {
    if (this.status === newStatus) {
      return;
    }

    const previousStatus = this.status;
    this.status = newStatus;

    // Emit change event
    const event: NetworkChangeEvent = {
      previousStatus,
      currentStatus: newStatus,
      connectionQuality: this.connectionQuality,
      timestamp: new Date(),
      downlink: this.connectionInfo?.downlink,
      effectiveType: this.connectionInfo?.effectiveType,
      rtt: this.connectionInfo?.rtt
    };

    this.notifyListeners(event);
  }

  private updateConnectionQuality() {
    const avgLatency = this.calculateAverageLatency();
    const connectionInfo = this.connectionInfo;

    if (this.status === NetworkStatus.OFFLINE) {
      this.connectionQuality = ConnectionQuality.OFFLINE;
    } else if (avgLatency !== undefined) {
      if (avgLatency < 100) {
        this.connectionQuality = ConnectionQuality.EXCELLENT;
      } else if (avgLatency < 300) {
        this.connectionQuality = ConnectionQuality.GOOD;
      } else if (avgLatency < 1000) {
        this.connectionQuality = ConnectionQuality.FAIR;
      } else {
        this.connectionQuality = ConnectionQuality.POOR;
      }
    } else if (connectionInfo?.effectiveType) {
      // Fallback to connection API info
      switch (connectionInfo.effectiveType) {
        case '4g':
          this.connectionQuality = ConnectionQuality.EXCELLENT;
          break;
        case '3g':
          this.connectionQuality = ConnectionQuality.GOOD;
          break;
        case '2g':
          this.connectionQuality = ConnectionQuality.FAIR;
          break;
        case 'slow-2g':
          this.connectionQuality = ConnectionQuality.POOR;
          break;
        default:
          this.connectionQuality = ConnectionQuality.GOOD;
      }
    }
  }

  private recordSpeedTest(result: SpeedTestResult) {
    this.speedHistory.push(result);
    
    // Keep only recent samples
    if (this.speedHistory.length > this.config.sampleSize) {
      this.speedHistory = this.speedHistory.slice(-this.config.sampleSize);
    }
  }

  private calculateAverageLatency(): number | undefined {
    if (this.speedHistory.length === 0) {
      return undefined;
    }

    const sum = this.speedHistory.reduce((acc, test) => acc + test.latency, 0);
    return sum / this.speedHistory.length;
  }

  private async executeRequest(request: QueuedRequest): Promise<any> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private persistQueue() {
    if (!this.config.enableOfflineQueue) {
      return;
    }

    try {
      const queueData = Array.from(this.requestQueue.values()).map(req => ({
        ...req,
        timestamp: req.timestamp.toISOString()
      }));
      
      localStorage.setItem(this.config.queuePersistKey, JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to persist offline queue:', error);
    }
  }

  private loadPersistedQueue() {
    if (!this.config.enableOfflineQueue) {
      return;
    }

    try {
      const stored = localStorage.getItem(this.config.queuePersistKey);
      if (stored) {
        const queueData = JSON.parse(stored);
        
        queueData.forEach((req: any) => {
          this.requestQueue.set(req.id, {
            ...req,
            timestamp: new Date(req.timestamp)
          });
        });
      }
    } catch (error) {
      console.error('Failed to load persisted queue:', error);
    }
  }

  private notifyListeners(event: NetworkChangeEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in network change listener:', error);
      }
    });
  }

  private notifyQueueListeners(processed: number, remaining: number) {
    this.queueListeners.forEach(listener => {
      try {
        listener(processed, remaining);
      } catch (error) {
        console.error('Error in queue listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.connectionInfo) {
      this.connectionInfo.removeEventListener('change', this.handleConnectionChange);
    }
    
    this.listeners.clear();
    this.queueListeners.clear();
  }
}

// Type for Network Information API
interface NetworkInformation extends EventTarget {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
}

// Export singleton instance
export const networkMonitor = new NetworkMonitorService();

// Export convenience functions
export const isOnline = () => networkMonitor.isOnline();
export const getNetworkStatus = () => networkMonitor.getStatus();
export const getConnectionQuality = () => networkMonitor.getConnectionQuality();
export const queueOfflineRequest = (request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>) => 
  networkMonitor.queueRequest(request);