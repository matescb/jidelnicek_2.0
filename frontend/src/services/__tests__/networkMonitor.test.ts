import { 
  networkMonitor, 
  NetworkStatus, 
  ConnectionQuality,
  NetworkChangeEvent,
  OfflineRequest
} from '../networkMonitor';
import { vi } from 'vitest';

describe('NetworkMonitor Service', () => {
  let originalNavigator: any;
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();
    networkMonitor.stopMonitoring();
    networkMonitor.clearQueue();
    
    // Mock navigator
    originalNavigator = global.navigator;
    mockConnection = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    Object.defineProperty(global, 'navigator', {
      value: {
        onLine: true,
        connection: mockConnection
      },
      writable: true,
      configurable: true
    });

    // Mock window events
    global.dispatchEvent = vi.fn();
    global.addEventListener = vi.fn();
    global.removeEventListener = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
    vi.restoreAllMocks();
  });

  describe('Network Status Detection', () => {
    it('should detect online status', () => {
      expect(networkMonitor.isOnline()).toBe(true);
      expect(networkMonitor.getStatus()).toBe(NetworkStatus.ONLINE);
    });

    it('should detect offline status', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      networkMonitor.startMonitoring();
      
      expect(networkMonitor.isOnline()).toBe(false);
      expect(networkMonitor.getStatus()).toBe(NetworkStatus.OFFLINE);
    });

    it('should handle online/offline events', () => {
      const listener = vi.fn();
      networkMonitor.addListener(listener);
      
      networkMonitor.startMonitoring();

      // Get the event listeners that were registered
      const calls = (global.addEventListener as any).mock.calls;
      const onlineHandler = calls.find((call: any[]) => call[0] === 'online')[1];
      const offlineHandler = calls.find((call: any[]) => call[0] === 'offline')[1];

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      offlineHandler();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: NetworkStatus.ONLINE,
          currentStatus: NetworkStatus.OFFLINE
        })
      );

      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true
      });
      onlineHandler();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: NetworkStatus.OFFLINE,
          currentStatus: NetworkStatus.ONLINE
        })
      );
    });
  });

  describe('Connection Quality Detection', () => {
    it('should detect fast connection', () => {
      mockConnection.effectiveType = '4g';
      mockConnection.downlink = 20;
      mockConnection.rtt = 30;

      expect(networkMonitor.getConnectionQuality()).toBe(ConnectionQuality.FAST);
    });

    it('should detect good connection', () => {
      mockConnection.effectiveType = '3g';
      mockConnection.downlink = 5;
      mockConnection.rtt = 100;

      expect(networkMonitor.getConnectionQuality()).toBe(ConnectionQuality.GOOD);
    });

    it('should detect slow connection', () => {
      mockConnection.effectiveType = '2g';
      mockConnection.downlink = 0.5;
      mockConnection.rtt = 300;

      expect(networkMonitor.getConnectionQuality()).toBe(ConnectionQuality.SLOW);
    });

    it('should detect slow connection based on RTT', () => {
      mockConnection.effectiveType = '4g';
      mockConnection.downlink = 10;
      mockConnection.rtt = 500; // High latency

      expect(networkMonitor.getConnectionQuality()).toBe(ConnectionQuality.SLOW);
    });

    it('should handle missing connection API', () => {
      Object.defineProperty(navigator, 'connection', {
        value: undefined,
        writable: true,
        configurable: true
      });

      // Should default to GOOD when API is not available
      expect(networkMonitor.getConnectionQuality()).toBe(ConnectionQuality.GOOD);
    });

    it('should listen to connection changes', () => {
      const listener = vi.fn();
      networkMonitor.addListener(listener);
      networkMonitor.startMonitoring();

      // Get the connection change handler
      const connectionHandler = mockConnection.addEventListener.mock.calls
        .find((call: any[]) => call[0] === 'change')[1];

      // Simulate connection change
      mockConnection.effectiveType = 'slow-2g';
      mockConnection.downlink = 0.1;
      connectionHandler();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionQuality: ConnectionQuality.SLOW
        })
      );
    });
  });

  describe('Network Speed Estimation', () => {
    it('should estimate network speed', async () => {
      vi.useFakeTimers();
      
      const mockFetch = vi.fn().mockImplementation(() => {
        // Simulate download time
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              headers: {
                get: (name: string) => name === 'content-length' ? '1000000' : null
              },
              blob: () => Promise.resolve(new Blob(['x'.repeat(1000000)]))
            });
          }, 1000); // 1 second for 1MB = 1MB/s
        });
      });
      
      global.fetch = mockFetch;

      const speedPromise = networkMonitor.estimateSpeed();
      
      vi.advanceTimersByTime(1000);
      
      const speed = await speedPromise;
      
      expect(speed).toBeGreaterThan(0);
      expect(speed).toBeLessThan(10); // Reasonable speed in Mbps

      vi.useRealTimers();
    });

    it('should handle speed test failures', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const speed = await networkMonitor.estimateSpeed();
      
      expect(speed).toBe(0);
    });
  });

  describe('Offline Queue Management', () => {
    it('should queue requests when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      const request: OfflineRequest = {
        url: '/api/test',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { data: 'test' },
        priority: 5
      };

      const requestId = networkMonitor.queueOfflineRequest(request);

      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(networkMonitor.getQueuedRequests()).toHaveLength(1);
    });

    it('should sort queue by priority', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      const requests = [
        { url: '/api/low', method: 'GET', headers: {}, priority: 1 },
        { url: '/api/high', method: 'GET', headers: {}, priority: 10 },
        { url: '/api/medium', method: 'GET', headers: {}, priority: 5 }
      ];

      requests.forEach(req => networkMonitor.queueOfflineRequest(req));

      const queued = networkMonitor.getQueuedRequests();
      expect(queued[0].request.url).toBe('/api/high');
      expect(queued[1].request.url).toBe('/api/medium');
      expect(queued[2].request.url).toBe('/api/low');
    });

    it('should process queue when coming online', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      // Queue requests while offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      const request1 = {
        url: '/api/test1',
        method: 'POST',
        headers: {},
        body: { data: 'test1' }
      };

      const request2 = {
        url: '/api/test2',
        method: 'GET',
        headers: {}
      };

      networkMonitor.queueOfflineRequest(request1);
      networkMonitor.queueOfflineRequest(request2);

      // Come back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true
      });

      const result = await networkMonitor.processQueue();

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(networkMonitor.getQueuedRequests()).toHaveLength(0);
    });

    it('should handle queue processing failures', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('Network error'));

      global.fetch = mockFetch;

      // Queue requests
      networkMonitor.queueOfflineRequest({
        url: '/api/success',
        method: 'GET',
        headers: {}
      });

      networkMonitor.queueOfflineRequest({
        url: '/api/fail',
        method: 'GET',
        headers: {}
      });

      const result = await networkMonitor.processQueue();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(networkMonitor.getQueuedRequests()).toHaveLength(1); // Failed request remains
    });

    it('should execute callbacks on queue processing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ 
        ok: true, 
        json: () => Promise.resolve({ success: true }) 
      });
      global.fetch = mockFetch;

      const onSuccess = vi.fn();
      const onError = vi.fn();

      networkMonitor.queueOfflineRequest({
        url: '/api/test',
        method: 'POST',
        headers: {},
        body: { data: 'test' },
        onSuccess,
        onError
      });

      await networkMonitor.processQueue();

      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(onError).not.toHaveBeenCalled();
    });

    it('should notify queue listeners', () => {
      const listener = vi.fn();
      networkMonitor.addQueueListener(listener);

      networkMonitor.queueOfflineRequest({
        url: '/api/test',
        method: 'GET',
        headers: {}
      });

      expect(listener).toHaveBeenCalledWith(0, 1);
    });

    it('should remove specific request from queue', () => {
      const id1 = networkMonitor.queueOfflineRequest({
        url: '/api/test1',
        method: 'GET',
        headers: {}
      });

      const id2 = networkMonitor.queueOfflineRequest({
        url: '/api/test2',
        method: 'GET',
        headers: {}
      });

      expect(networkMonitor.getQueuedRequests()).toHaveLength(2);

      networkMonitor.removeFromQueue(id1);

      const remaining = networkMonitor.getQueuedRequests();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(id2);
    });

    it('should clear entire queue', () => {
      for (let i = 0; i < 5; i++) {
        networkMonitor.queueOfflineRequest({
          url: `/api/test${i}`,
          method: 'GET',
          headers: {}
        });
      }

      expect(networkMonitor.getQueuedRequests()).toHaveLength(5);

      networkMonitor.clearQueue();

      expect(networkMonitor.getQueuedRequests()).toHaveLength(0);
    });
  });

  describe('Network Information', () => {
    it('should provide comprehensive network info', () => {
      mockConnection.effectiveType = '4g';
      mockConnection.downlink = 15;
      mockConnection.rtt = 40;
      mockConnection.saveData = true;

      const info = networkMonitor.getNetworkInfo();

      expect(info).toEqual({
        status: NetworkStatus.ONLINE,
        quality: ConnectionQuality.FAST,
        effectiveType: '4g',
        downlink: 15,
        rtt: 40,
        saveData: true,
        timestamp: expect.any(Date)
      });
    });

    it('should update network info on changes', () => {
      const listener = vi.fn();
      networkMonitor.addListener(listener);
      networkMonitor.startMonitoring();

      const connectionHandler = mockConnection.addEventListener.mock.calls
        .find((call: any[]) => call[0] === 'change')[1];

      // Change connection properties
      mockConnection.effectiveType = '2g';
      mockConnection.downlink = 0.5;
      connectionHandler();

      const info = networkMonitor.getNetworkInfo();
      expect(info.effectiveType).toBe('2g');
      expect(info.downlink).toBe(0.5);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring and add event listeners', () => {
      networkMonitor.startMonitoring();

      expect(global.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(global.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockConnection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should stop monitoring and remove event listeners', () => {
      networkMonitor.startMonitoring();
      networkMonitor.stopMonitoring();

      expect(global.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(global.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockConnection.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not add duplicate listeners', () => {
      networkMonitor.startMonitoring();
      networkMonitor.startMonitoring();

      const onlineCalls = (global.addEventListener as any).mock.calls
        .filter((call: any[]) => call[0] === 'online');
      
      expect(onlineCalls).toHaveLength(1);
    });
  });

  describe('Event Management', () => {
    it('should manage multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      networkMonitor.addListener(listener1);
      networkMonitor.addListener(listener2);
      networkMonitor.startMonitoring();

      // Trigger an event
      const offlineHandler = (global.addEventListener as any).mock.calls
        .find((call: any[]) => call[0] === 'offline')[1];

      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      offlineHandler();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      networkMonitor.addListener(listener1);
      networkMonitor.addListener(listener2);
      networkMonitor.removeListener(listener1);
      networkMonitor.startMonitoring();

      // Trigger an event
      const offlineHandler = (global.addEventListener as any).mock.calls
        .find((call: any[]) => call[0] === 'offline')[1];

      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      offlineHandler();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});