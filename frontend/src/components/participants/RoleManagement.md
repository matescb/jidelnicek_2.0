# Role Management System Documentation

## Overview

The role management system provides fine-grained access control for trip participants. It includes:

- 4 distinct roles with different permission levels
- 20+ granular permissions across 5 categories
- Permission-based UI component rendering
- Bulk role assignment capabilities
- Visual permission matrix

## Roles

### Owner
- Full access to all features
- Cannot be changed or removed
- Only one owner per trip
- Can assign any role to other participants

### Organizer
- Can manage participants and meals
- Can edit trip details
- Cannot delete trip or manage billing
- Can invite new participants

### Participant
- Can view all trip information
- Can update own profile
- Cannot edit trip or manage others
- Standard role for most users

### Guest
- Read-only access
- Cannot make any changes
- Useful for viewers or tentative participants

## Usage Examples

### Basic Role Management Component

```typescript
import { RoleManagement } from './components/participants/RoleManagement';

function TripManagement() {
  const participants = [...]; // Your participants data
  const currentUserId = 'user123';
  
  const handleRoleChange = async (participantId: string, newRole: ParticipantRole) => {
    // API call to update role
    await updateParticipantRole(participantId, newRole);
  };
  
  return (
    <RoleManagement
      participants={participants}
      currentUserId={currentUserId}
      onRoleChange={handleRoleChange}
    />
  );
}
```

### Using Permission Gates

```typescript
import { PermissionGate } from './components/auth/PermissionGate';
import { PERMISSIONS } from './types/participants';

function TripActions() {
  return (
    <div>
      {/* Single permission check */}
      <PermissionGate permissions={PERMISSIONS.TRIP_EDIT}>
        <Button>Edit Trip</Button>
      </PermissionGate>
      
      {/* Multiple permissions (ANY) */}
      <PermissionGate 
        permissions={[PERMISSIONS.MEALS_CREATE, PERMISSIONS.MEALS_EDIT]}
      >
        <Button>Manage Meals</Button>
      </PermissionGate>
      
      {/* Multiple permissions (ALL required) */}
      <PermissionGate 
        permissions={[PERMISSIONS.PARTICIPANTS_EDIT, PERMISSIONS.PARTICIPANTS_REMOVE]}
        requireAll={true}
      >
        <Button>Full Participant Control</Button>
      </PermissionGate>
    </div>
  );
}
```

### Using the usePermissions Hook

```typescript
import { usePermissions } from './hooks/usePermissions';

function MyComponent() {
  const { 
    canEditTrip, 
    canInviteParticipants,
    isOrganizer,
    hasPermission 
  } = usePermissions();
  
  // Use boolean flags
  if (canEditTrip) {
    // Show edit button
  }
  
  // Check specific permission
  if (hasPermission(PERMISSIONS.SETTINGS_BILLING)) {
    // Show billing section
  }
  
  // Role-based logic
  if (isOrganizer) {
    // Show organizer features
  }
}
```

### Convenience Components

```typescript
import { OwnerOnly, OrganizerOnly } from './components/auth/PermissionGate';

function TripSettings() {
  return (
    <div>
      <OrganizerOnly>
        <Button>Manage Participants</Button>
      </OrganizerOnly>
      
      <OwnerOnly>
        <Button color="error">Delete Trip</Button>
      </OwnerOnly>
    </div>
  );
}
```

## Permission Categories

### Trip Permissions
- `trip.view` - View trip details
- `trip.edit` - Edit trip information
- `trip.delete` - Delete the trip
- `trip.archive` - Archive/unarchive trip

### Participant Permissions
- `participants.view` - View participant list
- `participants.invite` - Send invitations
- `participants.edit` - Edit participant info
- `participants.remove` - Remove participants
- `participants.assign_roles` - Change roles

### Meal Permissions
- `meals.view` - View meal plans
- `meals.create` - Add new meals
- `meals.edit` - Modify meals
- `meals.delete` - Remove meals
- `meals.assign_cooks` - Assign cooks

### Shopping Permissions
- `shopping.view` - View shopping lists
- `shopping.create` - Generate lists
- `shopping.edit` - Modify items
- `shopping.complete` - Mark as purchased

### Settings Permissions
- `settings.view` - View settings
- `settings.edit` - Change settings
- `settings.billing` - Manage billing

## Best Practices

1. **Always use PermissionGate** for UI elements that require permissions
2. **Use convenience components** (OwnerOnly, OrganizerOnly) for simple role checks
3. **Implement server-side validation** - frontend permissions are for UX only
4. **Handle loading states** when fetching participant data
5. **Provide clear feedback** when users lack permissions
6. **Test with different roles** to ensure proper access control

## Integration Checklist

- [ ] Add `role` field to participant records
- [ ] Implement role change API endpoints
- [ ] Add permission checks to all protected UI elements
- [ ] Update server-side authorization
- [ ] Test role transitions and edge cases
- [ ] Add role indicators to participant lists
- [ ] Document role capabilities for users