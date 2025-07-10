import { useCallback } from 'react'
import { useTripStore } from '@/store/slices/tripStore'
import type { Participant } from '@/store/slices/tripStore'

export function useParticipants(tripId?: string | number) {
  const {
    currentTrip,
    participantLoading,
    participantError,
    addParticipant,
    updateParticipant,
    removeParticipant,
    fetchParticipantsForDay,
    clearParticipantError
  } = useTripStore()

  const participants = currentTrip?.participants || []

  const handleAddParticipant = useCallback(
    async (participant: Partial<Participant>) => {
      if (!tripId) throw new Error('Trip ID is required')
      await addParticipant(tripId, participant)
    },
    [tripId, addParticipant]
  )

  const handleUpdateParticipant = useCallback(
    async (participantId: string, updates: Partial<Participant>) => {
      if (!tripId) throw new Error('Trip ID is required')
      await updateParticipant(tripId, participantId, updates)
    },
    [tripId, updateParticipant]
  )

  const handleRemoveParticipant = useCallback(
    async (participantId: string) => {
      if (!tripId) throw new Error('Trip ID is required')
      await removeParticipant(tripId, participantId)
    },
    [tripId, removeParticipant]
  )

  const handleFetchParticipantsForDay = useCallback(
    async (dayNumber: number) => {
      if (!tripId) throw new Error('Trip ID is required')
      return await fetchParticipantsForDay(tripId, dayNumber)
    },
    [tripId, fetchParticipantsForDay]
  )

  return {
    participants,
    loading: participantLoading,
    error: participantError,
    addParticipant: handleAddParticipant,
    updateParticipant: handleUpdateParticipant,
    removeParticipant: handleRemoveParticipant,
    fetchParticipantsForDay: handleFetchParticipantsForDay,
    clearError: clearParticipantError
  }
}