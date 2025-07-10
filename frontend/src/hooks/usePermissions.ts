import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ROLE_PERMISSIONS, 
  PERMISSIONS,
  ParticipantRole,
  Participant 
} from '../types/participants';

interface UsePermissionsOptions {
  tripId?: string;
  participant?: Participant;
}

export function usePermissions(options?: UsePermissionsOptions) {
  const { user } = useAuth();
  
  const permissions = useMemo(() => {
    // If specific participant is provided, use their role
    if (options?.participant) {
      return ROLE_PERMISSIONS[options.participant.role] || [];
    }
    
    // Otherwise, this would need to fetch the current user's participant record
    // For now, we'll assume a default role
    // In a real implementation, this would query the participant record for the current user
    return ROLE_PERMISSIONS.participant;
  }, [options?.participant]);
  
  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };
  
  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some(permission => hasPermission(permission));
  };
  
  const hasAllPermissions = (permissionList: string[]): boolean => {
    return permissionList.every(permission => hasPermission(permission));
  };
  
  const canEditTrip = hasPermission(PERMISSIONS.TRIP_EDIT);
  const canDeleteTrip = hasPermission(PERMISSIONS.TRIP_DELETE);
  const canInviteParticipants = hasPermission(PERMISSIONS.PARTICIPANTS_INVITE);
  const canEditParticipants = hasPermission(PERMISSIONS.PARTICIPANTS_EDIT);
  const canRemoveParticipants = hasPermission(PERMISSIONS.PARTICIPANTS_REMOVE);
  const canAssignRoles = hasPermission(PERMISSIONS.PARTICIPANTS_ASSIGN_ROLES);
  const canCreateMeals = hasPermission(PERMISSIONS.MEALS_CREATE);
  const canEditMeals = hasPermission(PERMISSIONS.MEALS_EDIT);
  const canDeleteMeals = hasPermission(PERMISSIONS.MEALS_DELETE);
  const canAssignCooks = hasPermission(PERMISSIONS.MEALS_ASSIGN_COOKS);
  const canEditShopping = hasPermission(PERMISSIONS.SHOPPING_EDIT);
  const canCompleteShopping = hasPermission(PERMISSIONS.SHOPPING_COMPLETE);
  const canEditSettings = hasPermission(PERMISSIONS.SETTINGS_EDIT);
  const canManageBilling = hasPermission(PERMISSIONS.SETTINGS_BILLING);
  
  const isOwner = options?.participant?.role === 'owner';
  const isOrganizer = options?.participant?.role === 'organizer' || isOwner;
  const isParticipant = options?.participant?.role === 'participant' || isOrganizer;
  const isGuest = options?.participant?.role === 'guest';
  
  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Convenience properties
    canEditTrip,
    canDeleteTrip,
    canInviteParticipants,
    canEditParticipants,
    canRemoveParticipants,
    canAssignRoles,
    canCreateMeals,
    canEditMeals,
    canDeleteMeals,
    canAssignCooks,
    canEditShopping,
    canCompleteShopping,
    canEditSettings,
    canManageBilling,
    
    // Role checks
    isOwner,
    isOrganizer,
    isParticipant,
    isGuest,
  };
}

// Hook for checking permissions for a specific participant
export function useParticipantPermissions(participant: Participant | null) {
  return usePermissions({ participant: participant || undefined });
}

// Hook for checking current user's permissions in a trip
export function useTripPermissions(tripId: string) {
  // In a real implementation, this would fetch the current user's participant record
  // for the specific trip and use their role
  return usePermissions({ tripId });
}