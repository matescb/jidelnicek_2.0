# WebSocket Real-Time Updates

This document describes the WebSocket implementation for real-time updates in the Jidelnicek frontend application.

## Overview

The WebSocket service provides real-time synchronization of trip data across multiple users, including:
- Shopping list updates
- Participant changes (additions, removals, coefficient updates)
- Meal assignments and plan updates
- Cost calculations
- Nutrition summaries
- User presence tracking
- Collaborative editing indicators

## Architecture

### Core Components

1. **WebSocket Service** (`/services/websocket.ts`)
   - Manages Socket.IO connection lifecycle
   - Handles authentication and reconnection
   - Provides typed event subscription/emission
   - Implements exponential backoff for reconnection

2. **WebSocket Types** (`/types/websocket.ts`)
   - Defines all event types and payloads
   - Provides TypeScript type safety for events
   - Documents event structure

3. **WebSocket Hooks** (`/hooks/useWebSocket.ts`)
   - React integration for WebSocket functionality
   - Connection state management
   - Event subscription helpers
   - Trip-specific event handling

4. **Real-time Store Integration** (`/store/slices/tripStore.websocket.ts`)
   - Enhances trip store with WebSocket updates
   - Automatically syncs store state with server events
   - Handles optimistic updates

## Setup

### 1. Install Dependencies

```bash
npm install socket.io-client
npm install --save-dev @types/socket.io-client
```

### 2. Environment Configuration

Add to your `.env` file:

```env
VITE_WEBSOCKET_URL=http://localhost:3000
```

### 3. Add WebSocket Provider

Wrap your app with the WebSocket provider in `main.tsx`:

```tsx
import { WebSocketProvider } from '@/context/WebSocketContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </AuthProvider>
  </React.StrictMode>
)
```

## Usage Examples

### Basic WebSocket Connection

```tsx
import { useWebSocket } from '@/hooks/useWebSocket'

function MyComponent() {
  const { isConnected, connectionStatus } = useWebSocket()
  
  return (
    <div>
      Connection: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  )
}
```

### Subscribe to Events

```tsx
import { useWebSocketEvent } from '@/hooks/useWebSocket'

function ShoppingListComponent({ tripId }) {
  useWebSocketEvent('shopping-list:update', (event) => {
    console.log('Shopping list updated:', event.payload)
  }, { tripId })
  
  return <div>Shopping List</div>
}
```

### Trip-Specific Events

```tsx
import { useTripWebSocket } from '@/hooks/useWebSocket'

function TripDetailsPage({ tripId }) {
  const { onTripEvent } = useTripWebSocket(tripId)
  
  useEffect(() => {
    onTripEvent('participant:added', (event) => {
      console.log('New participant:', event.payload.participant)
    })
  }, [onTripEvent])
}
```

### Real-time Shopping List

```tsx
import { useRealtimeShoppingList } from '@/hooks/useRealtimeShoppingList'
import { useTripStore } from '@/store/slices/tripStore'

function ShoppingList({ tripId }) {
  // Automatically syncs shopping list via WebSocket
  useRealtimeShoppingList(tripId)
  
  const shoppingList = useTripStore(state => state.shoppingList)
  
  return (
    <ul>
      {shoppingList.map(item => (
        <li key={item.ingredientId}>
          {item.name}: {item.quantity} {item.unit}
        </li>
      ))}
    </ul>
  )
}
```

### User Presence Tracking

```tsx
import { usePresenceTracking } from '@/hooks/useWebSocket'

function TripPlannerPage({ tripId }) {
  // Automatically tracks user presence
  usePresenceTracking(tripId, 'trip-planner')
  
  return <div>Trip Planner</div>
}
```

### Complete Trip Real-time Updates

```tsx
import { useRealtimeTripUpdates } from '@/hooks/useRealtimeShoppingList'

function TripPage({ tripId }) {
  // Subscribes to all trip-related real-time events
  useRealtimeTripUpdates(tripId)
  
  const trip = useTripStore(state => state.currentTrip)
  
  return <div>{/* Trip UI */}</div>
}
```

## Event Types

### Shopping List Events

- `shopping-list:update` - Complete shopping list regenerated

### Participant Events

- `participant:coefficient-change` - Meal coefficients updated
- `participant:status-change` - Invitation status changed
- `participant:added` - New participant added
- `participant:removed` - Participant removed

### Meal Events

- `meal:assignment-change` - Single meal assigned/removed
- `meal:plan-update` - Multiple meals updated

### Calculation Events

- `cost:calculation-update` - Trip costs recalculated
- `nutrition:summary-update` - Nutrition data updated

### Trip Events

- `trip:status-change` - Trip status updated (planning/active/completed)

### Collaboration Events

- `user:presence` - User joined/left/active/idle
- `user:editing` - User editing specific resource

## Connection Management

### Automatic Reconnection

The WebSocket service implements exponential backoff for reconnection:
- Initial delay: 1 second
- Max delay: 5 seconds
- Max attempts: 5

### Authentication

The service automatically includes the authentication token from localStorage. When the token changes, the connection is re-established.

### Connection States

- `connecting` - Establishing connection
- `connected` - Successfully connected
- `disconnected` - Connection lost
- `error` - Connection error occurred

## Best Practices

1. **Use Trip-Specific Hooks**: For trip pages, use `useTripWebSocket` to automatically join/leave trip rooms.

2. **Combine Real-time Hooks**: Use `useRealtimeTripUpdates` to subscribe to all trip events at once.

3. **Handle Connection States**: Show connection status to users, especially during reconnection.

4. **Cleanup Subscriptions**: The hooks automatically handle cleanup, but ensure components unmount properly.

5. **Optimistic Updates**: The store integration handles optimistic updates automatically.

## Troubleshooting

### Connection Issues

Check:
1. WebSocket URL in environment variables
2. Authentication token is valid
3. Server is running and accessible
4. Network allows WebSocket connections

### Events Not Received

Verify:
1. Correct event name and payload structure
2. Trip ID matches in subscription
3. User has permission to receive events
4. WebSocket connection is established

### Performance

For large trips:
1. Consider pagination for participant lists
2. Debounce rapid updates
3. Use event filtering on the server side

## Server Requirements

The server should implement Socket.IO with:
- Authentication middleware
- Room-based event distribution
- Event validation
- Error handling
- Presence tracking

Example server setup:

```javascript
io.use(authMiddleware)

io.on('connection', (socket) => {
  // Join trip room
  socket.on('trip:join', ({ tripId }) => {
    socket.join(`trip:${tripId}`)
  })
  
  // Emit to trip room
  io.to(`trip:${tripId}`).emit('shopping-list:update', {
    type: 'shopping-list:update',
    payload: shoppingListData,
    timestamp: new Date().toISOString()
  })
})
```