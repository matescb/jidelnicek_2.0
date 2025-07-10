# ParticipantList Component Tests

This directory contains comprehensive tests for the ParticipantList component.

## Test Coverage

The test suite covers the following functionality:

### 1. Rendering
- Renders participant list with all participants
- Displays participant roles, status, and coefficients correctly
- Shows add participant button

### 2. Search Functionality
- Filters participants by name
- Filters participants by email
- Clears search and shows all participants

### 3. Filtering
- Filters by role (planner/participant)
- Filters by status (accepted/pending/declined)
- Shows filter count badge
- Combines multiple filters

### 4. Sorting
- Sorts by name, email, role, status, meal coefficient, and snack coefficient
- Reverses sort direction on second click

### 5. Pagination
- Shows pagination controls for >10 participants
- Navigates between pages
- Changes items per page
- Resets to first page when filters change

### 6. Bulk Selection and Actions
- Selects individual participants
- Selects all participants on current page
- Shows bulk actions when participants are selected
- Deletes selected participants
- Exports selected participants to CSV
- Changes role for selected participants

### 7. Add/Edit/Delete Operations
- Calls onEditParticipant callback
- Deletes individual participant with confirmation
- Cancels deletion when user declines

### 8. Loading and Error States
- Shows loading spinner
- Shows error message
- Shows empty state with call-to-action

### 9. Responsive Behavior
- Shows table view on desktop
- Shows card view on mobile
- Displays all participant info in cards

### 10. Presence/Status Indicators
- Shows online/offline status
- Displays last seen time in tooltip

### 11. Keyboard Navigation
- Navigates pages with arrow keys
- Clears selection with Escape key

### 12. Error Handling
- Shows error toasts for failed operations
- Handles network errors gracefully

## Running the Tests

```bash
# Run all tests
npm test

# Run ParticipantList tests specifically
npm test ParticipantList.test.tsx

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Data

The tests use mock data for:
- 4 sample participants with different roles and statuses
- Mock trip data
- Mock presence state for online/offline indicators
- Mock store hooks and functions

## Mocking Strategy

The tests mock:
- `useTripStore` - for trip and participant data
- `useToast` - for toast notifications
- `usePresence` - for real-time presence data
- `react-router-dom` - for navigation and params
- Browser APIs (URL.createObjectURL, window.confirm)