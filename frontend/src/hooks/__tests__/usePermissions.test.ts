import { renderHook } from '@testing-library/react'
import { usePermissions, useParticipantPermissions, useTripPermissions } from '../usePermissions'
import { useAuth } from '../../context/AuthContext'
import { ROLE_PERMISSIONS, PERMISSIONS } from '../../types/participants'
import type { Participant } from '../../types/participants'

// Mock the auth context
jest.mock('../../context/AuthContext')

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('usePermissions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      login: jest.fn(),
      logout: jest.fn(),
      isAuthenticated: true,
    } as any)
  })

  describe('Basic functionality', () => {
    it('returns default participant permissions when no options provided', () => {
      const { result } = renderHook(() => usePermissions())
      
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.participant)
      // When no participant is provided, role checks are false
      expect(result.current.isParticipant).toBe(false)
      expect(result.current.isOrganizer).toBe(false)
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isGuest).toBe(false)
    })

    it('uses specific participant role when provided', () => {
      const ownerParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: ownerParticipant })
      )
      
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.owner)
      expect(result.current.isOwner).toBe(true)
      expect(result.current.isOrganizer).toBe(true)
      expect(result.current.isParticipant).toBe(true)
    })

    it('handles guest role correctly', () => {
      const guestParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Guest User',
        email: 'guest@example.com',
        role: 'guest',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: guestParticipant })
      )
      
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.guest)
      expect(result.current.isGuest).toBe(true)
      expect(result.current.isParticipant).toBe(false)
      expect(result.current.isOrganizer).toBe(false)
      expect(result.current.isOwner).toBe(false)
    })
  })

  describe('Permission checking methods', () => {
    it('hasPermission returns correct results', () => {
      const organizerParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Organizer User',
        email: 'organizer@example.com',
        role: 'organizer',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: organizerParticipant })
      )
      
      // Organizers should have these permissions
      expect(result.current.hasPermission(PERMISSIONS.PARTICIPANTS_INVITE)).toBe(true)
      expect(result.current.hasPermission(PERMISSIONS.MEALS_CREATE)).toBe(true)
      
      // But not these
      expect(result.current.hasPermission(PERMISSIONS.TRIP_DELETE)).toBe(false)
      expect(result.current.hasPermission(PERMISSIONS.PARTICIPANTS_ASSIGN_ROLES)).toBe(false)
    })

    it('hasAnyPermission returns true if any permission matches', () => {
      const { result } = renderHook(() => usePermissions())
      
      const hasAny = result.current.hasAnyPermission([
        PERMISSIONS.TRIP_DELETE, // No
        PERMISSIONS.MEALS_VIEW, // Yes
        PERMISSIONS.SETTINGS_BILLING, // No
      ])
      
      expect(hasAny).toBe(true)
    })

    it('hasAnyPermission returns false if no permissions match', () => {
      const { result } = renderHook(() => usePermissions())
      
      const hasAny = result.current.hasAnyPermission([
        PERMISSIONS.TRIP_DELETE,
        PERMISSIONS.SETTINGS_BILLING,
        PERMISSIONS.PARTICIPANTS_ASSIGN_ROLES,
      ])
      
      expect(hasAny).toBe(false)
    })

    it('hasAllPermissions returns true only if all permissions match', () => {
      const { result } = renderHook(() => usePermissions())
      
      const hasAll = result.current.hasAllPermissions([
        PERMISSIONS.MEALS_VIEW,
        PERMISSIONS.SHOPPING_VIEW,
        PERMISSIONS.TRIP_VIEW,
      ])
      
      expect(hasAll).toBe(true)
    })

    it('hasAllPermissions returns false if any permission is missing', () => {
      const { result } = renderHook(() => usePermissions())
      
      const hasAll = result.current.hasAllPermissions([
        PERMISSIONS.MEALS_VIEW, // Yes
        PERMISSIONS.MEALS_DELETE, // No
      ])
      
      expect(hasAll).toBe(false)
    })
  })

  describe('Convenience properties', () => {
    it('provides correct permission flags for owner', () => {
      const ownerParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Owner',
        email: 'owner@example.com',
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: ownerParticipant })
      )
      
      // Owner should have all permissions
      expect(result.current.canEditTrip).toBe(true)
      expect(result.current.canDeleteTrip).toBe(true)
      expect(result.current.canInviteParticipants).toBe(true)
      expect(result.current.canEditParticipants).toBe(true)
      expect(result.current.canRemoveParticipants).toBe(true)
      expect(result.current.canAssignRoles).toBe(true)
      expect(result.current.canCreateMeals).toBe(true)
      expect(result.current.canEditMeals).toBe(true)
      expect(result.current.canDeleteMeals).toBe(true)
      expect(result.current.canAssignCooks).toBe(true)
      expect(result.current.canEditShopping).toBe(true)
      expect(result.current.canCompleteShopping).toBe(true)
      expect(result.current.canEditSettings).toBe(true)
      expect(result.current.canManageBilling).toBe(true)
    })

    it('provides correct permission flags for organizer', () => {
      const organizerParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Organizer',
        email: 'organizer@example.com',
        role: 'organizer',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: organizerParticipant })
      )
      
      // Organizer permissions
      expect(result.current.canEditTrip).toBe(true)
      expect(result.current.canDeleteTrip).toBe(false)
      expect(result.current.canInviteParticipants).toBe(true)
      expect(result.current.canEditParticipants).toBe(true)
      expect(result.current.canRemoveParticipants).toBe(true)
      expect(result.current.canAssignRoles).toBe(false)
      expect(result.current.canCreateMeals).toBe(true)
      expect(result.current.canEditMeals).toBe(true)
      expect(result.current.canDeleteMeals).toBe(true)
      expect(result.current.canAssignCooks).toBe(true)
      expect(result.current.canEditShopping).toBe(true)
      expect(result.current.canCompleteShopping).toBe(true)
      expect(result.current.canEditSettings).toBe(false)
      expect(result.current.canManageBilling).toBe(false)
    })

    it('provides correct permission flags for participant', () => {
      const { result } = renderHook(() => usePermissions())
      
      // Participant permissions
      expect(result.current.canEditTrip).toBe(false)
      expect(result.current.canDeleteTrip).toBe(false)
      expect(result.current.canInviteParticipants).toBe(false)
      expect(result.current.canEditParticipants).toBe(false)
      expect(result.current.canRemoveParticipants).toBe(false)
      expect(result.current.canAssignRoles).toBe(false)
      expect(result.current.canCreateMeals).toBe(false)
      expect(result.current.canEditMeals).toBe(false)
      expect(result.current.canDeleteMeals).toBe(false)
      expect(result.current.canAssignCooks).toBe(false)
      expect(result.current.canEditShopping).toBe(false)
      expect(result.current.canCompleteShopping).toBe(false)
      expect(result.current.canEditSettings).toBe(false)
      expect(result.current.canManageBilling).toBe(false)
    })

    it('provides correct permission flags for guest', () => {
      const guestParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Guest',
        email: 'guest@example.com',
        role: 'guest',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: guestParticipant })
      )
      
      // Guest should have very limited permissions
      expect(result.current.canEditTrip).toBe(false)
      expect(result.current.canDeleteTrip).toBe(false)
      expect(result.current.canInviteParticipants).toBe(false)
      expect(result.current.canEditParticipants).toBe(false)
      expect(result.current.canRemoveParticipants).toBe(false)
      expect(result.current.canAssignRoles).toBe(false)
      expect(result.current.canCreateMeals).toBe(false)
      expect(result.current.canEditMeals).toBe(false)
      expect(result.current.canDeleteMeals).toBe(false)
      expect(result.current.canAssignCooks).toBe(false)
      expect(result.current.canEditShopping).toBe(false)
      expect(result.current.canCompleteShopping).toBe(false)
      expect(result.current.canEditSettings).toBe(false)
      expect(result.current.canManageBilling).toBe(false)
    })
  })

  describe('Role hierarchy', () => {
    it('correctly identifies role hierarchy for owner', () => {
      const ownerParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Owner',
        email: 'owner@example.com',
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: ownerParticipant })
      )
      
      expect(result.current.isOwner).toBe(true)
      expect(result.current.isOrganizer).toBe(true) // Owner is also organizer
      expect(result.current.isParticipant).toBe(true) // Owner is also participant
      expect(result.current.isGuest).toBe(false)
    })

    it('correctly identifies role hierarchy for organizer', () => {
      const organizerParticipant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Organizer',
        email: 'organizer@example.com',
        role: 'organizer',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: organizerParticipant })
      )
      
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isOrganizer).toBe(true)
      expect(result.current.isParticipant).toBe(true) // Organizer is also participant
      expect(result.current.isGuest).toBe(false)
    })
  })

  describe('useParticipantPermissions', () => {
    it('works with participant object', () => {
      const participant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'organizer',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        useParticipantPermissions(participant)
      )
      
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.organizer)
      expect(result.current.isOrganizer).toBe(true)
    })

    it('handles null participant', () => {
      const { result } = renderHook(() => 
        useParticipantPermissions(null)
      )
      
      // Should fall back to default permissions
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.participant)
    })
  })

  describe('useTripPermissions', () => {
    it('accepts trip ID', () => {
      const { result } = renderHook(() => 
        useTripPermissions('trip-123')
      )
      
      // In current implementation, it returns default permissions
      // In a real app, it would fetch participant record for the trip
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.participant)
    })
  })

  describe('Edge cases', () => {
    it('handles undefined role', () => {
      const participantWithUndefinedRole: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Test User',
        email: 'test@example.com',
        role: undefined as any,
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result } = renderHook(() => 
        usePermissions({ participant: participantWithUndefinedRole })
      )
      
      // Should return empty permissions array
      expect(result.current.permissions).toEqual([])
    })

    it('handles invalid permission check', () => {
      const { result } = renderHook(() => usePermissions())
      
      // Check for non-existent permission
      expect(result.current.hasPermission('INVALID_PERMISSION')).toBe(false)
    })

    it('handles empty permission arrays', () => {
      const { result } = renderHook(() => usePermissions())
      
      expect(result.current.hasAnyPermission([])).toBe(false)
      expect(result.current.hasAllPermissions([])).toBe(true) // Vacuous truth
    })
  })

  describe('Memoization', () => {
    it('memoizes permissions array', () => {
      const participant: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'organizer',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const { result, rerender } = renderHook(
        ({ participant }) => usePermissions({ participant }),
        { initialProps: { participant } }
      )
      
      const firstPermissions = result.current.permissions
      
      // Re-render with same participant
      rerender({ participant })
      
      const secondPermissions = result.current.permissions
      
      // Should be the same reference
      expect(firstPermissions).toBe(secondPermissions)
    })

    it('updates permissions when participant changes', () => {
      const participant1: Participant = {
        id: 'p1',
        userId: 'user-123',
        tripId: 'trip-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'participant',
        status: 'active',
        joinedAt: new Date().toISOString(),
      }
      
      const participant2: Participant = {
        ...participant1,
        role: 'organizer',
      }
      
      const { result, rerender } = renderHook(
        ({ participant }) => usePermissions({ participant }),
        { initialProps: { participant: participant1 } }
      )
      
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.participant)
      
      rerender({ participant: participant2 })
      
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.organizer)
    })
  })
})