import type { Participant as ApiParticipant } from '@/services/participants'
import type { Participant as StoreParticipant } from './tripStore'

/**
 * Convert API participant format to store participant format
 */
export function convertApiParticipantToStore(apiParticipant: ApiParticipant): StoreParticipant {
  return {
    id: String(apiParticipant.id),
    name: apiParticipant.name,
    email: apiParticipant.email,
    arrivalDate: undefined,
    departureDate: undefined,
    mealCoefficients: {
      breakfast: 1,
      lunch: 1,
      dinner: 1
    }
  }
}

/**
 * Convert store participant format to API create/update format
 */
export function convertStoreParticipantToApiFormat(
  storeParticipant: Partial<StoreParticipant>
): { name?: string; email?: string } {
  return {
    name: storeParticipant.name,
    email: storeParticipant.email
  }
}