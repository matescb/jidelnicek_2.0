import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, ActivityType } from '../components/participants/ActivityTimeline';

export interface PresenceState {
  [participantId: string]: {
    isOnline: boolean;
    lastSeen: Date;
    currentActivity?: string;
  };
}

export interface UsePresenceOptions {
  tripId: string;
  participantId: string;
  pollInterval?: number;
  enableWebSocket?: boolean;
}

export interface UsePresenceReturn {
  presenceState: PresenceState;
  activities: Activity[];
  updatePresence: (participantId: string, activity?: string) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => void;
  isConnected: boolean;
  reconnect: () => void;
}

// Mock WebSocket connection
class MockWebSocket {
  private listeners: { [event: string]: ((data: any) => void)[] } = {};
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(private url: string) {
    // Simulate connection delay
    setTimeout(() => {
      this.connected = true;
      this.emit('open', {});
    }, 100);
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  send(data: any) {
    if (!this.connected) return;
    
    // Simulate server response
    const message = JSON.parse(data);
    if (message.type === 'presence_update') {
      // Echo back to simulate server broadcast
      setTimeout(() => {
        this.emit('presence_update', message.data);
      }, 50);
    }
  }

  close() {
    this.connected = false;
    this.emit('close', {});
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }

  reconnect() {
    if (this.connected) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.connected = true;
      this.emit('open', {});
    }, 1000);
  }

  get isConnected() {
    return this.connected;
  }
}

export const usePresence = ({
  tripId,
  participantId,
  pollInterval = 30000, // 30 seconds
  enableWebSocket = true,
}: UsePresenceOptions): UsePresenceReturn => {
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<MockWebSocket | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize mock data
  useEffect(() => {
    // Set some initial presence data
    setPresenceState({
      '1': { isOnline: true, lastSeen: new Date(), currentActivity: 'Viewing recipes' },
      '2': { isOnline: false, lastSeen: new Date(Date.now() - 1000 * 60 * 15) }, // 15 minutes ago
      '3': { isOnline: true, lastSeen: new Date(), currentActivity: 'Editing shopping list' },
    });

    // Add some initial activities
    const now = new Date();
    setActivities([
      {
        id: '1',
        type: 'joined',
        participantId: '1',
        participantName: 'John Doe',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 hours ago
        isNew: false,
      },
      {
        id: '2',
        type: 'meal_assigned',
        participantId: '2',
        participantName: 'Jane Smith',
        timestamp: new Date(now.getTime() - 1000 * 60 * 30), // 30 minutes ago
        metadata: { mealName: 'Breakfast - Day 2' },
        isNew: false,
      },
      {
        id: '3',
        type: 'shopping_contributed',
        participantId: '3',
        participantName: 'Bob Johnson',
        timestamp: new Date(now.getTime() - 1000 * 60 * 5), // 5 minutes ago
        metadata: { itemCount: 3 },
        isNew: true,
      },
    ]);
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!enableWebSocket) return;

    const ws = new MockWebSocket(`ws://localhost:3000/presence/${tripId}`);
    wsRef.current = ws;

    ws.on('open', () => {
      setIsConnected(true);
      // Send initial presence
      ws.send(JSON.stringify({
        type: 'presence_update',
        data: {
          participantId,
          isOnline: true,
          currentActivity: 'Active',
        },
      }));
    });

    ws.on('close', () => {
      setIsConnected(false);
    });

    ws.on('presence_update', (data: any) => {
      setPresenceState(prev => ({
        ...prev,
        [data.participantId]: {
          isOnline: data.isOnline,
          lastSeen: new Date(data.lastSeen || Date.now()),
          currentActivity: data.currentActivity,
        },
      }));
    });

    ws.on('activity', (data: Activity) => {
      setActivities(prev => [data, ...prev]);
    });

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.isConnected) {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          data: { participantId },
        }));
      }
    }, 10000); // Every 10 seconds

    return () => {
      clearInterval(heartbeatInterval);
      ws.close();
    };
  }, [tripId, participantId, enableWebSocket]);

  // Polling fallback
  useEffect(() => {
    if (enableWebSocket && isConnected) return;

    const pollPresence = async () => {
      try {
        // In a real app, this would be an API call
        // For now, we'll simulate some random updates
        const randomParticipantId = String(Math.floor(Math.random() * 3) + 1);
        setPresenceState(prev => ({
          ...prev,
          [randomParticipantId]: {
            ...prev[randomParticipantId],
            lastSeen: new Date(),
          },
        }));
      } catch (error) {
        console.error('Failed to poll presence:', error);
      }
    };

    pollPresence(); // Initial poll
    pollTimerRef.current = setInterval(pollPresence, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [pollInterval, enableWebSocket, isConnected]);

  const updatePresence = useCallback((targetParticipantId: string, activity?: string) => {
    if (wsRef.current?.isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'presence_update',
        data: {
          participantId: targetParticipantId,
          isOnline: true,
          currentActivity: activity,
          lastSeen: new Date().toISOString(),
        },
      }));
    }

    // Update local state immediately
    setPresenceState(prev => ({
      ...prev,
      [targetParticipantId]: {
        isOnline: true,
        lastSeen: new Date(),
        currentActivity: activity,
      },
    }));
  }, []);

  const addActivity = useCallback((activity: Omit<Activity, 'id' | 'timestamp'>) => {
    const newActivity: Activity = {
      ...activity,
      id: Date.now().toString(),
      timestamp: new Date(),
      isNew: true,
    };

    if (wsRef.current?.isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'activity',
        data: newActivity,
      }));
    }

    setActivities(prev => [newActivity, ...prev]);

    // Mark as not new after 5 seconds
    setTimeout(() => {
      setActivities(prev =>
        prev.map(a => (a.id === newActivity.id ? { ...a, isNew: false } : a))
      );
    }, 5000);
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.reconnect();
    }
  }, []);

  return {
    presenceState,
    activities,
    updatePresence,
    addActivity,
    isConnected,
    reconnect,
  };
};

export default usePresence;