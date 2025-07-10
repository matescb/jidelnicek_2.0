export interface TripInvitation {
  id: string
  tripId: string
  email: string
  status: 'pending' | 'sent' | 'accepted' | 'declined' | 'expired'
  invitedBy: string
  invitedAt: string
  acceptedAt?: string
  expiresAt: string
  message?: string
  token: string
}

export interface InvitationTemplate {
  id: string
  name: string
  subject: string
  body: string
  isDefault: boolean
}

export interface CreateInvitationRequest {
  tripId: string
  emails: string[]
  message?: string
  templateId?: string
  expiresInDays?: number
}

export interface BulkInvitationRequest {
  tripId: string
  emails: string[]
  message?: string
  templateId?: string
}

export interface InvitationLinkRequest {
  tripId: string
  expiresInDays?: number
  maxUses?: number
}

export interface InvitationLink {
  id: string
  tripId: string
  token: string
  url: string
  expiresAt: string
  maxUses?: number
  currentUses: number
  createdBy: string
  createdAt: string
  qrCode?: string
}

export interface SendInvitationResponse {
  successful: string[]
  failed: Array<{
    email: string
    reason: string
  }>
  totalSent: number
}

export interface InvitationFormData {
  emails: string[]
  message: string
  templateId?: string
  sendMethod: 'email' | 'link' | 'both'
}

export interface InvitationStatus {
  email: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  error?: string
}