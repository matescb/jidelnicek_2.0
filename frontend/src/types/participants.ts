export interface Participant {
  id: string;
  userId: string;
  tripId: string;
  name: string;
  email: string;
  avatar?: string;
  dietary?: DietaryInfo;
  status: ParticipantStatus;
  role: ParticipantRole;
  joinedAt: string;
  lastActive?: string;
  metadata?: ParticipantMetadata;
}

export interface DietaryInfo {
  restrictions: string[];
  allergies: string[];
  preferences: string[];
  notes?: string;
}

export interface ParticipantMetadata {
  invitedBy?: string;
  invitedAt?: string;
  respondedAt?: string;
  customFields?: Record<string, any>;
}

export type ParticipantStatus = 'pending' | 'active' | 'declined' | 'removed';

export type ParticipantRole = 'owner' | 'organizer' | 'participant' | 'guest';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'trip' | 'participants' | 'meals' | 'shopping' | 'settings';
}

export interface RolePermissions {
  role: ParticipantRole;
  permissions: string[];
}

export const PERMISSIONS = {
  // Trip permissions
  TRIP_VIEW: 'trip.view',
  TRIP_EDIT: 'trip.edit',
  TRIP_DELETE: 'trip.delete',
  TRIP_ARCHIVE: 'trip.archive',
  
  // Participant permissions
  PARTICIPANTS_VIEW: 'participants.view',
  PARTICIPANTS_INVITE: 'participants.invite',
  PARTICIPANTS_EDIT: 'participants.edit',
  PARTICIPANTS_REMOVE: 'participants.remove',
  PARTICIPANTS_ASSIGN_ROLES: 'participants.assign_roles',
  
  // Meal permissions
  MEALS_VIEW: 'meals.view',
  MEALS_CREATE: 'meals.create',
  MEALS_EDIT: 'meals.edit',
  MEALS_DELETE: 'meals.delete',
  MEALS_ASSIGN_COOKS: 'meals.assign_cooks',
  
  // Shopping permissions
  SHOPPING_VIEW: 'shopping.view',
  SHOPPING_CREATE: 'shopping.create',
  SHOPPING_EDIT: 'shopping.edit',
  SHOPPING_COMPLETE: 'shopping.complete',
  
  // Settings permissions
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_BILLING: 'settings.billing',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<ParticipantRole, string[]> = {
  owner: Object.values(PERMISSIONS),
  organizer: [
    PERMISSIONS.TRIP_VIEW,
    PERMISSIONS.TRIP_EDIT,
    PERMISSIONS.PARTICIPANTS_VIEW,
    PERMISSIONS.PARTICIPANTS_INVITE,
    PERMISSIONS.PARTICIPANTS_EDIT,
    PERMISSIONS.PARTICIPANTS_REMOVE,
    PERMISSIONS.MEALS_VIEW,
    PERMISSIONS.MEALS_CREATE,
    PERMISSIONS.MEALS_EDIT,
    PERMISSIONS.MEALS_DELETE,
    PERMISSIONS.MEALS_ASSIGN_COOKS,
    PERMISSIONS.SHOPPING_VIEW,
    PERMISSIONS.SHOPPING_CREATE,
    PERMISSIONS.SHOPPING_EDIT,
    PERMISSIONS.SHOPPING_COMPLETE,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  participant: [
    PERMISSIONS.TRIP_VIEW,
    PERMISSIONS.PARTICIPANTS_VIEW,
    PERMISSIONS.MEALS_VIEW,
    PERMISSIONS.SHOPPING_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  guest: [
    PERMISSIONS.TRIP_VIEW,
    PERMISSIONS.PARTICIPANTS_VIEW,
    PERMISSIONS.MEALS_VIEW,
    PERMISSIONS.SHOPPING_VIEW,
  ],
};

export const ROLE_DISPLAY_NAMES: Record<ParticipantRole, string> = {
  owner: 'Owner',
  organizer: 'Organizer',
  participant: 'Participant',
  guest: 'Guest',
};

export const ROLE_DESCRIPTIONS: Record<ParticipantRole, string> = {
  owner: 'Full access to all trip features and settings',
  organizer: 'Can manage participants, meals, and edit trip details',
  participant: 'Can view trip information and update own profile',
  guest: 'Read-only access to trip information',
};

export const PERMISSION_DETAILS: Record<string, Permission> = {
  [PERMISSIONS.TRIP_VIEW]: {
    id: PERMISSIONS.TRIP_VIEW,
    name: 'View Trip',
    description: 'View trip details and itinerary',
    category: 'trip',
  },
  [PERMISSIONS.TRIP_EDIT]: {
    id: PERMISSIONS.TRIP_EDIT,
    name: 'Edit Trip',
    description: 'Edit trip name, dates, and description',
    category: 'trip',
  },
  [PERMISSIONS.TRIP_DELETE]: {
    id: PERMISSIONS.TRIP_DELETE,
    name: 'Delete Trip',
    description: 'Permanently delete the trip',
    category: 'trip',
  },
  [PERMISSIONS.TRIP_ARCHIVE]: {
    id: PERMISSIONS.TRIP_ARCHIVE,
    name: 'Archive Trip',
    description: 'Archive or unarchive the trip',
    category: 'trip',
  },
  [PERMISSIONS.PARTICIPANTS_VIEW]: {
    id: PERMISSIONS.PARTICIPANTS_VIEW,
    name: 'View Participants',
    description: 'View participant list and profiles',
    category: 'participants',
  },
  [PERMISSIONS.PARTICIPANTS_INVITE]: {
    id: PERMISSIONS.PARTICIPANTS_INVITE,
    name: 'Invite Participants',
    description: 'Send invitations to new participants',
    category: 'participants',
  },
  [PERMISSIONS.PARTICIPANTS_EDIT]: {
    id: PERMISSIONS.PARTICIPANTS_EDIT,
    name: 'Edit Participants',
    description: 'Edit participant information',
    category: 'participants',
  },
  [PERMISSIONS.PARTICIPANTS_REMOVE]: {
    id: PERMISSIONS.PARTICIPANTS_REMOVE,
    name: 'Remove Participants',
    description: 'Remove participants from the trip',
    category: 'participants',
  },
  [PERMISSIONS.PARTICIPANTS_ASSIGN_ROLES]: {
    id: PERMISSIONS.PARTICIPANTS_ASSIGN_ROLES,
    name: 'Assign Roles',
    description: 'Change participant roles and permissions',
    category: 'participants',
  },
  [PERMISSIONS.MEALS_VIEW]: {
    id: PERMISSIONS.MEALS_VIEW,
    name: 'View Meals',
    description: 'View meal plans and recipes',
    category: 'meals',
  },
  [PERMISSIONS.MEALS_CREATE]: {
    id: PERMISSIONS.MEALS_CREATE,
    name: 'Create Meals',
    description: 'Add new meals to the trip',
    category: 'meals',
  },
  [PERMISSIONS.MEALS_EDIT]: {
    id: PERMISSIONS.MEALS_EDIT,
    name: 'Edit Meals',
    description: 'Modify existing meals',
    category: 'meals',
  },
  [PERMISSIONS.MEALS_DELETE]: {
    id: PERMISSIONS.MEALS_DELETE,
    name: 'Delete Meals',
    description: 'Remove meals from the trip',
    category: 'meals',
  },
  [PERMISSIONS.MEALS_ASSIGN_COOKS]: {
    id: PERMISSIONS.MEALS_ASSIGN_COOKS,
    name: 'Assign Cooks',
    description: 'Assign cooks to meals',
    category: 'meals',
  },
  [PERMISSIONS.SHOPPING_VIEW]: {
    id: PERMISSIONS.SHOPPING_VIEW,
    name: 'View Shopping List',
    description: 'View shopping lists and items',
    category: 'shopping',
  },
  [PERMISSIONS.SHOPPING_CREATE]: {
    id: PERMISSIONS.SHOPPING_CREATE,
    name: 'Create Shopping List',
    description: 'Generate new shopping lists',
    category: 'shopping',
  },
  [PERMISSIONS.SHOPPING_EDIT]: {
    id: PERMISSIONS.SHOPPING_EDIT,
    name: 'Edit Shopping List',
    description: 'Modify shopping list items',
    category: 'shopping',
  },
  [PERMISSIONS.SHOPPING_COMPLETE]: {
    id: PERMISSIONS.SHOPPING_COMPLETE,
    name: 'Complete Shopping',
    description: 'Mark shopping items as purchased',
    category: 'shopping',
  },
  [PERMISSIONS.SETTINGS_VIEW]: {
    id: PERMISSIONS.SETTINGS_VIEW,
    name: 'View Settings',
    description: 'View trip settings',
    category: 'settings',
  },
  [PERMISSIONS.SETTINGS_EDIT]: {
    id: PERMISSIONS.SETTINGS_EDIT,
    name: 'Edit Settings',
    description: 'Modify trip settings',
    category: 'settings',
  },
  [PERMISSIONS.SETTINGS_BILLING]: {
    id: PERMISSIONS.SETTINGS_BILLING,
    name: 'Manage Billing',
    description: 'Access billing and payment settings',
    category: 'settings',
  },
};