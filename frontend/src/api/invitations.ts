import { apiClient } from './client'
import type {
  TripInvitation,
  CreateInvitationRequest,
  BulkInvitationRequest,
  InvitationLinkRequest,
  InvitationLink,
  SendInvitationResponse,
  InvitationTemplate
} from '@/types/invitation'

export const invitationsApi = {
  // Send individual or bulk email invitations
  sendInvitations: async (data: CreateInvitationRequest): Promise<SendInvitationResponse> => {
    const response = await apiClient.post<SendInvitationResponse>('/trips/invitations/send', data)
    return response.data
  },

  // Send bulk invitations
  sendBulkInvitations: async (data: BulkInvitationRequest): Promise<SendInvitationResponse> => {
    const response = await apiClient.post<SendInvitationResponse>('/trips/invitations/bulk', data)
    return response.data
  },

  // Generate a shareable invitation link
  generateInvitationLink: async (data: InvitationLinkRequest): Promise<InvitationLink> => {
    const response = await apiClient.post<InvitationLink>('/trips/invitations/link', data)
    return response.data
  },

  // Get all invitations for a trip
  getTripInvitations: async (tripId: string): Promise<TripInvitation[]> => {
    const response = await apiClient.get<TripInvitation[]>(`/trips/${tripId}/invitations`)
    return response.data
  },

  // Get invitation templates
  getInvitationTemplates: async (): Promise<InvitationTemplate[]> => {
    const response = await apiClient.get<InvitationTemplate[]>('/trips/invitations/templates')
    return response.data
  },

  // Cancel an invitation
  cancelInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.delete(`/trips/invitations/${invitationId}`)
  },

  // Resend an invitation
  resendInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.post(`/trips/invitations/${invitationId}/resend`)
  },

  // Validate invitation token
  validateInvitation: async (token: string): Promise<TripInvitation> => {
    const response = await apiClient.get<TripInvitation>(`/trips/invitations/validate/${token}`)
    return response.data
  },

  // Accept invitation
  acceptInvitation: async (token: string): Promise<void> => {
    await apiClient.post(`/trips/invitations/accept/${token}`)
  },

  // Generate QR code for invitation link
  generateQRCode: async (invitationLinkId: string): Promise<string> => {
    const response = await apiClient.get<{ qrCode: string }>(`/trips/invitations/link/${invitationLinkId}/qr`)
    return response.data.qrCode
  }
}