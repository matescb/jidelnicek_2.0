import apiClient from '../utils/apiClient';
import type { ApiResponse } from '../types/api';

// Frontend types (camelCase)
export interface Participant {
  id: number;
  tripId: number;
  name: string;
  email?: string;
  dietaryRestrictions?: string;
  allergens?: string;
  notes?: string;
  role: 'participant' | 'organizer';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParticipantRequest {
  name: string;
  email?: string;
  dietaryRestrictions?: string;
  allergens?: string;
  notes?: string;
  role?: 'participant' | 'organizer';
  isActive?: boolean;
}

export interface UpdateParticipantRequest {
  name?: string;
  email?: string;
  dietaryRestrictions?: string;
  allergens?: string;
  notes?: string;
  role?: 'participant' | 'organizer';
  isActive?: boolean;
}

export interface ParticipantDayInfo extends Participant {
  isPresent: boolean;
  dayNumber: number;
}

// Backend types (snake_case)
interface BackendParticipant {
  id: number;
  trip_id: number;
  name: string;
  email?: string;
  dietary_notes?: string;
  allergens?: string;
  notes?: string;
  participant_type: 'participant' | 'organizer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendCreateParticipantRequest {
  name: string;
  email?: string;
  dietary_notes?: string;
  allergens?: string;
  notes?: string;
  participant_type?: 'participant' | 'organizer';
  is_active?: boolean;
}

interface BackendUpdateParticipantRequest {
  name?: string;
  email?: string;
  dietary_notes?: string;
  allergens?: string;
  notes?: string;
  participant_type?: 'participant' | 'organizer';
  is_active?: boolean;
}

interface BackendParticipantDayInfo extends BackendParticipant {
  is_present: boolean;
  day_number: number;
}

// Transform functions
const transformParticipantFromBackend = (data: BackendParticipant): Participant => ({
  id: data.id,
  tripId: data.trip_id,
  name: data.name,
  email: data.email,
  dietaryRestrictions: data.dietary_notes,
  allergens: data.allergens,
  notes: data.notes,
  role: data.participant_type,
  isActive: data.is_active,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const transformParticipantToBackend = (
  data: CreateParticipantRequest | UpdateParticipantRequest
): BackendCreateParticipantRequest | BackendUpdateParticipantRequest => {
  const transformed: any = {};
  
  if ('name' in data) transformed.name = data.name;
  if ('email' in data) transformed.email = data.email;
  if ('dietaryRestrictions' in data) transformed.dietary_notes = data.dietaryRestrictions;
  if ('allergens' in data) transformed.allergens = data.allergens;
  if ('notes' in data) transformed.notes = data.notes;
  if ('role' in data) transformed.participant_type = data.role;
  if ('isActive' in data) transformed.is_active = data.isActive;
  
  return transformed;
};

const transformParticipantDayInfoFromBackend = (
  data: BackendParticipantDayInfo
): ParticipantDayInfo => ({
  ...transformParticipantFromBackend(data),
  isPresent: data.is_present,
  dayNumber: data.day_number,
});

// API methods
export const participantsApi = {
  /**
   * Add a new participant to a trip
   */
  async addParticipant(
    tripId: number,
    data: CreateParticipantRequest
  ): Promise<ApiResponse<Participant>> {
    try {
      const response = await apiClient.post<BackendParticipant>(
        `/trips/${tripId}/participants`,
        transformParticipantToBackend(data)
      );
      
      return {
        data: transformParticipantFromBackend(response.data),
        error: null,
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.response?.data?.detail || 'Failed to add participant',
      };
    }
  },

  /**
   * Get all participants for a trip
   */
  async listParticipants(tripId: number): Promise<ApiResponse<Participant[]>> {
    try {
      const response = await apiClient.get<BackendParticipant[]>(
        `/trips/${tripId}/participants`
      );
      
      return {
        data: response.data.map(transformParticipantFromBackend),
        error: null,
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.response?.data?.detail || 'Failed to fetch participants',
      };
    }
  },

  /**
   * Get participants for a specific day of the trip
   */
  async getParticipantsForDay(
    tripId: number,
    dayNumber: number
  ): Promise<ApiResponse<ParticipantDayInfo[]>> {
    try {
      const response = await apiClient.get<BackendParticipantDayInfo[]>(
        `/trips/${tripId}/participants/day/${dayNumber}`
      );
      
      return {
        data: response.data.map(transformParticipantDayInfoFromBackend),
        error: null,
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.response?.data?.detail || 'Failed to fetch participants for day',
      };
    }
  },

  /**
   * Update a participant's information
   */
  async updateParticipant(
    tripId: number,
    participantId: number,
    data: UpdateParticipantRequest
  ): Promise<ApiResponse<Participant>> {
    try {
      const response = await apiClient.put<BackendParticipant>(
        `/trips/${tripId}/participants/${participantId}`,
        transformParticipantToBackend(data)
      );
      
      return {
        data: transformParticipantFromBackend(response.data),
        error: null,
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.response?.data?.detail || 'Failed to update participant',
      };
    }
  },

  /**
   * Remove a participant from a trip
   */
  async removeParticipant(
    tripId: number,
    participantId: number
  ): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.delete<{ message: string }>(
        `/trips/${tripId}/participants/${participantId}`
      );
      
      return {
        data: response.data,
        error: null,
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.response?.data?.detail || 'Failed to remove participant',
      };
    }
  },
};

// Export individual methods for convenience
export const {
  addParticipant,
  listParticipants,
  getParticipantsForDay,
  updateParticipant,
  removeParticipant,
} = participantsApi;