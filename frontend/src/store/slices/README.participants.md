# Trip Store - Participant API Integration

## Overview

The trip store has been updated to integrate participant methods with the participants API service. This includes proper loading states, error handling, and optimistic updates.

## Key Changes

### 1. New State Properties

```typescript
participantLoading: boolean  // Loading state for participant operations
participantError: string | null  // Error state for participant operations
```

### 2. Updated Methods

All participant methods now use the `participantsApi` service:

- `addParticipant()` - Creates a new participant
- `updateParticipant()` - Updates participant information
- `removeParticipant()` - Removes a participant from the trip
- `fetchParticipantsForDay()` - Gets participants for a specific day

### 3. Type Handling

The store handles the conversion between API participant types and store participant types:

- API participants have numeric IDs, store participants use string IDs
- API uses `dietary_notes`, store uses `dietaryRestrictions`
- API uses `participant_type`, store uses `role`
- Store adds `mealCoefficients` which aren't in the API

### 4. Optimistic Updates

When the current trip is loaded, participant operations update the local state immediately for better UX:

```typescript
// Example: Adding a participant
if (currentTrip?.id === tripId) {
  // Update local state immediately
  currentTrip.participants.push(newParticipant)
  currentTrip.participantCount = currentTrip.participants.length
}
```

### 5. Error Handling

All methods now properly handle API errors:

```typescript
try {
  const result = await participantsApi.addParticipant(...)
  if (result.error) {
    throw new Error(result.error)
  }
  // Handle success
} catch (error) {
  // Set error state and re-throw
}
```

## Usage Example

### Using the Store Directly

```typescript
import { useTripStore } from '@/store/slices/tripStore'

function MyComponent() {
  const {
    currentTrip,
    participantLoading,
    participantError,
    addParticipant,
    updateParticipant,
    removeParticipant,
    clearParticipantError
  } = useTripStore()

  const handleAddParticipant = async () => {
    try {
      await addParticipant(tripId, {
        name: 'John Doe',
        email: 'john@example.com',
        mealCoefficients: {
          breakfast: 1,
          lunch: 1,
          dinner: 1
        }
      })
    } catch (error) {
      console.error('Failed to add participant:', error)
    }
  }

  if (participantError) {
    return (
      <div>
        Error: {participantError}
        <button onClick={clearParticipantError}>Dismiss</button>
      </div>
    )
  }

  // ... rest of component
}
```

### Using the Custom Hook

```typescript
import { useParticipants } from '@/hooks/useParticipants'

function MyComponent({ tripId }) {
  const {
    participants,
    loading,
    error,
    addParticipant,
    updateParticipant,
    removeParticipant,
    fetchParticipantsForDay,
    clearError
  } = useParticipants(tripId)

  // All methods are pre-bound with the tripId
  const handleAdd = async () => {
    await addParticipant({ name: 'John Doe' })
  }
}
```

## Migration Guide

If you have existing code using the old participant methods:

1. **Check for Loading States**: Add loading indicators using `participantLoading`
2. **Handle Errors**: Display `participantError` and provide a way to clear it
3. **Update Types**: Ensure participant objects match the expected format
4. **Test Optimistic Updates**: Verify UI updates immediately on actions

## Testing

The integration includes comprehensive tests in `__tests__/tripStore.participants.test.ts` covering:

- Adding participants with optimistic updates
- Updating participant information
- Removing participants
- Fetching day-specific participants
- Error handling scenarios
- Automatic participant loading when fetching trips