import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { create } from 'zustand';
import { syncMiddleware } from '../sync/syncMiddleware';
import { BroadcastSync } from '../sync/broadcastSync';
import { WebSocketSync } from '../sync/websocketSync';
import { createConflictResolver, lastWriteWins, customMerge } from '../sync/conflictResolvers';
import type { SyncConfig, SyncMessage, ConflictResolver } from '../sync/types';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    // Simulate echo for testing
    setTimeout(() => {
      this.onmessage?.(new MessageEvent('message', { data }));
    }, 5);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent('close'));
  }
}

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: any) {
    const channels = MockBroadcastChannel.channels.get(this.name);
    channels?.forEach(channel => {
      if (channel !== this) {
        setTimeout(() => {
          channel.onmessage?.(new MessageEvent('message', { data }));
        }, 0);
      }
    });
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static clear() {
    MockBroadcastChannel.channels.clear();
  }
}

describe('State Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockBroadcastChannel.clear();
    (global as any).WebSocket = MockWebSocket;
    (global as any).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BroadcastSync', () => {
    it('should broadcast state changes', async () => {
      const sync1 = new BroadcastSync('test-channel');
      const sync2 = new BroadcastSync('test-channel');

      const received: SyncMessage[] = [];
      sync2.subscribe((message) => {
        received.push(message);
      });

      const message: SyncMessage = {
        type: 'state-update',
        payload: { count: 42 },
        timestamp: Date.now(),
        source: 'test',
      };

      sync1.send(message);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(message);

      sync1.disconnect();
      sync2.disconnect();
    });

    it('should not receive own messages', async () => {
      const sync = new BroadcastSync('test-channel');
      const received: SyncMessage[] = [];

      sync.subscribe((message) => {
        received.push(message);
      });

      sync.send({
        type: 'state-update',
        payload: { test: true },
        timestamp: Date.now(),
        source: 'self',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received).toHaveLength(0);

      sync.disconnect();
    });

    it('should handle connect and disconnect', () => {
      const sync = new BroadcastSync('test-channel');
      
      expect(() => sync.connect()).not.toThrow();
      expect(() => sync.disconnect()).not.toThrow();
      
      // Should handle multiple disconnects
      expect(() => sync.disconnect()).not.toThrow();
    });

    it('should handle multiple subscribers', async () => {
      const sync1 = new BroadcastSync('multi-channel');
      const sync2 = new BroadcastSync('multi-channel');

      const received1: SyncMessage[] = [];
      const received2: SyncMessage[] = [];

      const unsubscribe1 = sync2.subscribe((msg) => received1.push(msg));
      sync2.subscribe((msg) => received2.push(msg));

      sync1.send({
        type: 'state-update',
        payload: { value: 'test' },
        timestamp: Date.now(),
        source: 'sync1',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);

      // Unsubscribe first subscriber
      unsubscribe1();

      sync1.send({
        type: 'state-update',
        payload: { value: 'test2' },
        timestamp: Date.now(),
        source: 'sync1',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received1).toHaveLength(1); // Should not receive second message
      expect(received2).toHaveLength(2); // Should receive both messages

      sync1.disconnect();
      sync2.disconnect();
    });
  });

  describe('WebSocketSync', () => {
    it('should connect to WebSocket server', async () => {
      const sync = new WebSocketSync('ws://localhost:3000');
      
      await new Promise(resolve => setTimeout(resolve, 20));

      const message: SyncMessage = {
        type: 'state-update',
        payload: { connected: true },
        timestamp: Date.now(),
        source: 'client',
      };

      expect(() => sync.send(message)).not.toThrow();

      sync.disconnect();
    });

    it('should handle reconnection', async () => {
      const sync = new WebSocketSync('ws://localhost:3000', {
        reconnect: true,
        reconnectDelay: 50,
        maxReconnectAttempts: 3,
      });

      const connectSpy = vi.spyOn(sync as any, 'connect');

      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate connection loss
      (sync as any).ws?.close();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should attempt to reconnect
      expect(connectSpy).toHaveBeenCalledTimes(2); // Initial + 1 reconnect

      sync.disconnect();
    });

    it('should handle message queue during disconnection', async () => {
      const sync = new WebSocketSync('ws://localhost:3000');

      // Send message before connection is established
      const message1: SyncMessage = {
        type: 'state-update',
        payload: { queued: true },
        timestamp: Date.now(),
        source: 'client',
      };

      sync.send(message1);

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Message should be sent after connection
      const ws = (sync as any).ws as MockWebSocket;
      const sendSpy = vi.spyOn(ws, 'send');

      // Send another message while connected
      const message2: SyncMessage = {
        type: 'state-update',
        payload: { immediate: true },
        timestamp: Date.now(),
        source: 'client',
      };

      sync.send(message2);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(sendSpy).toHaveBeenCalled();

      sync.disconnect();
    });

    it('should handle WebSocket errors', async () => {
      const sync = new WebSocketSync('ws://localhost:3000');
      const errorHandler = vi.fn();

      sync.subscribe((message) => {
        if (message.type === 'error') {
          errorHandler(message);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate error
      const ws = (sync as any).ws as MockWebSocket;
      ws.onerror?.(new Event('error'));

      expect(errorHandler).toHaveBeenCalled();

      sync.disconnect();
    });

    it('should authenticate on connection', async () => {
      const authToken = 'test-auth-token';
      const sync = new WebSocketSync('ws://localhost:3000', {
        auth: { token: authToken },
      });

      const sendSpy = vi.fn();

      await new Promise(resolve => setTimeout(resolve, 20));

      const ws = (sync as any).ws as MockWebSocket;
      ws.send = sendSpy;

      // Trigger connection open
      ws.onopen?.(new Event('open'));

      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining(authToken)
      );

      sync.disconnect();
    });
  });

  describe('Conflict Resolvers', () => {
    it('should resolve conflicts with lastWriteWins strategy', () => {
      const local = {
        count: 10,
        updatedAt: new Date('2024-01-01').getTime(),
      };

      const remote = {
        count: 20,
        updatedAt: new Date('2024-01-02').getTime(),
      };

      const resolved = lastWriteWins(local, remote);
      expect(resolved).toEqual(remote);

      const resolved2 = lastWriteWins(remote, local);
      expect(resolved2).toEqual(remote);
    });

    it('should handle custom merge strategy', () => {
      const merger = (local: any, remote: any) => ({
        ...local,
        ...remote,
        merged: true,
        counts: {
          local: local.count,
          remote: remote.count,
          sum: local.count + remote.count,
        },
      });

      const local = { count: 10, name: 'local' };
      const remote = { count: 20, name: 'remote' };

      const resolved = customMerge(merger)(local, remote);

      expect(resolved).toEqual({
        count: 20,
        name: 'remote',
        merged: true,
        counts: {
          local: 10,
          remote: 20,
          sum: 30,
        },
      });
    });

    it('should create field-level conflict resolver', () => {
      const resolver = createConflictResolver({
        count: (local, remote) => Math.max(local, remote),
        name: (local, remote) => local.length > remote.length ? local : remote,
        tags: (local, remote) => [...new Set([...local, ...remote])],
      });

      const local = {
        count: 10,
        name: 'short',
        tags: ['a', 'b'],
      };

      const remote = {
        count: 5,
        name: 'much longer name',
        tags: ['b', 'c'],
      };

      const resolved = resolver(local, remote);

      expect(resolved).toEqual({
        count: 10, // Max value
        name: 'much longer name', // Longer string
        tags: ['a', 'b', 'c'], // Merged unique values
      });
    });
  });

  describe('Sync Middleware', () => {
    interface TestState {
      count: number;
      text: string;
      lastSync: number;
      increment: () => void;
      decrement: () => void;
      setText: (text: string) => void;
      _syncState?: (state: Partial<TestState>) => void;
    }

    it('should sync state changes across stores', async () => {
      const channel = new BroadcastSync('test-sync');

      const config: SyncConfig<TestState> = {
        channel,
        include: ['count', 'text'],
        exclude: ['lastSync'],
      };

      const createSyncedStore = () => create<TestState>()(
        syncMiddleware(
          config,
          (set) => ({
            count: 0,
            text: '',
            lastSync: Date.now(),
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
            setText: (text) => set({ text }),
            _syncState: (state) => set(state),
          })
        )
      );

      const store1 = createSyncedStore();
      const store2 = createSyncedStore();

      // Change state in store1
      store1.getState().increment();
      store1.getState().setText('Hello from store1');

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 20));

      // Store2 should have synced state
      expect(store2.getState().count).toBe(1);
      expect(store2.getState().text).toBe('Hello from store1');

      // Change state in store2
      store2.getState().increment();

      await new Promise(resolve => setTimeout(resolve, 20));

      // Both stores should have count = 2
      expect(store1.getState().count).toBe(2);
      expect(store2.getState().count).toBe(2);

      channel.disconnect();
    });

    it('should handle conflicts with resolver', async () => {
      const channel = new BroadcastSync('conflict-sync');

      const config: SyncConfig<TestState> = {
        channel,
        conflictResolver: (local, remote) => ({
          count: Math.max(local.count || 0, remote.count || 0),
          text: (local.text || '').length > (remote.text || '').length 
            ? local.text 
            : remote.text,
        }),
      };

      const createSyncedStore = () => create<TestState>()(
        syncMiddleware(
          config,
          (set) => ({
            count: 0,
            text: '',
            lastSync: Date.now(),
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
            setText: (text) => set({ text }),
            _syncState: (state) => set(state),
          })
        )
      );

      const store1 = createSyncedStore();
      const store2 = createSyncedStore();

      // Simulate conflicting updates
      store1.getState().increment(); // count = 1
      store1.getState().increment(); // count = 2
      store1.getState().setText('short');

      store2.getState().increment(); // count = 1
      store2.getState().setText('much longer text');

      await new Promise(resolve => setTimeout(resolve, 30));

      // Both stores should have resolved to max count and longer text
      expect(store1.getState().count).toBe(2);
      expect(store1.getState().text).toBe('much longer text');
      expect(store2.getState().count).toBe(2);
      expect(store2.getState().text).toBe('much longer text');

      channel.disconnect();
    });

    it('should handle sync errors gracefully', async () => {
      const brokenChannel = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        send: vi.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
        subscribe: vi.fn(),
      };

      const config: SyncConfig<TestState> = {
        channel: brokenChannel as any,
        onError: vi.fn(),
      };

      const useStore = create<TestState>()(
        syncMiddleware(
          config,
          (set) => ({
            count: 0,
            text: '',
            lastSync: Date.now(),
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
            setText: (text) => set({ text }),
          })
        )
      );

      // Should not throw when sync fails
      expect(() => useStore.getState().increment()).not.toThrow();
      expect(config.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should support throttled sync', async () => {
      const channel = new BroadcastSync('throttle-sync');
      const sendSpy = vi.spyOn(channel, 'send');

      const config: SyncConfig<TestState> = {
        channel,
        throttle: 50,
      };

      const useStore = create<TestState>()(
        syncMiddleware(
          config,
          (set) => ({
            count: 0,
            text: '',
            lastSync: Date.now(),
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
            setText: (text) => set({ text }),
          })
        )
      );

      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        useStore.getState().increment();
      }

      // Should not send 10 messages immediately
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should send throttled update
      expect(sendSpy).toHaveBeenCalledTimes(2);
      
      const lastCall = sendSpy.mock.calls[sendSpy.mock.calls.length - 1][0];
      expect(lastCall.payload.count).toBe(10);

      channel.disconnect();
    });

    it('should support debounced sync', async () => {
      const channel = new BroadcastSync('debounce-sync');
      const sendSpy = vi.spyOn(channel, 'send');

      const config: SyncConfig<TestState> = {
        channel,
        debounce: 50,
      };

      const useStore = create<TestState>()(
        syncMiddleware(
          config,
          (set) => ({
            count: 0,
            text: '',
            lastSync: Date.now(),
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
            setText: (text) => set({ text }),
          })
        )
      );

      // Make rapid changes
      for (let i = 0; i < 5; i++) {
        useStore.getState().increment();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should not send any messages yet
      expect(sendSpy).not.toHaveBeenCalled();

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should send single debounced update
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][0].payload.count).toBe(5);

      channel.disconnect();
    });

    it('should handle offline queue', async () => {
      let isOnline = true;
      const channel = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        send: vi.fn().mockImplementation((message) => {
          if (!isOnline) {
            throw new Error('Offline');
          }
        }),
        subscribe: vi.fn(),
      };

      const config: SyncConfig<TestState> = {
        channel: channel as any,
        queueOfflineUpdates: true,
      };

      const useStore = create<TestState>()(
        syncMiddleware(
          config,
          (set) => ({
            count: 0,
            text: '',
            lastSync: Date.now(),
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
            setText: (text) => set({ text }),
          })
        )
      );

      // Make changes while online
      useStore.getState().increment();
      expect(channel.send).toHaveBeenCalledTimes(1);

      // Go offline
      isOnline = false;

      // Make changes while offline
      useStore.getState().increment();
      useStore.getState().increment();
      useStore.getState().setText('offline text');

      // Should not send while offline
      expect(channel.send).toHaveBeenCalledTimes(1);

      // Go back online
      isOnline = true;

      // Trigger online event
      window.dispatchEvent(new Event('online'));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should send queued updates
      expect(channel.send).toHaveBeenCalled();
      const calls = channel.send.mock.calls;
      const lastUpdate = calls[calls.length - 1][0];
      expect(lastUpdate.payload.count).toBe(3);
      expect(lastUpdate.payload.text).toBe('offline text');
    });
  });
});