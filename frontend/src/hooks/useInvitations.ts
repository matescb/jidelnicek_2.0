import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invitationsApi } from '@/api/invitations'
import { useToast } from './useToast'
import type {
  CreateInvitationRequest,
  InvitationLinkRequest,
  SendInvitationResponse,
  TripInvitation,
  InvitationLink,
  InvitationTemplate
} from '@/types/invitation'

export function useInvitations(tripId?: string) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'sending' | 'sent' | 'failed'>>(new Map())

  // Query for trip invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations', tripId],
    queryFn: () => invitationsApi.getTripInvitations(tripId!),
    enabled: !!tripId
  })

  // Query for invitation templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['invitationTemplates'],
    queryFn: invitationsApi.getInvitationTemplates
  })

  // Send invitations mutation
  const sendInvitationsMutation = useMutation({
    mutationFn: invitationsApi.sendInvitations,
    onMutate: async (data) => {
      // Set all emails to sending status
      const newStatus = new Map(sendingStatus)
      data.emails.forEach(email => newStatus.set(email, 'sending'))
      setSendingStatus(newStatus)
    },
    onSuccess: (response: SendInvitationResponse) => {
      // Update sending status based on response
      const newStatus = new Map(sendingStatus)
      response.successful.forEach(email => newStatus.set(email, 'sent'))
      response.failed.forEach(({ email }) => newStatus.set(email, 'failed'))
      setSendingStatus(newStatus)

      // Invalidate invitations query
      queryClient.invalidateQueries({ queryKey: ['invitations', tripId] })

      // Show success message
      if (response.successful.length > 0) {
        showToast({
          title: 'Invitations sent',
          description: `Successfully sent ${response.successful.length} invitation${response.successful.length > 1 ? 's' : ''}`,
          type: 'success'
        })
      }

      // Show error messages for failed invitations
      if (response.failed.length > 0) {
        response.failed.forEach(({ email, reason }) => {
          showToast({
            title: 'Failed to send invitation',
            description: `${email}: ${reason}`,
            type: 'error'
          })
        })
      }
    },
    onError: (error) => {
      // Reset all to failed status
      const newStatus = new Map()
      sendingStatus.forEach((_, email) => newStatus.set(email, 'failed'))
      setSendingStatus(newStatus)

      showToast({
        title: 'Failed to send invitations',
        description: error instanceof Error ? error.message : 'Please try again later',
        type: 'error'
      })
    }
  })

  // Generate invitation link mutation
  const generateLinkMutation = useMutation({
    mutationFn: invitationsApi.generateInvitationLink,
    onSuccess: () => {
      showToast({
        title: 'Invitation link generated',
        description: 'The invitation link has been created successfully',
        type: 'success'
      })
    },
    onError: (error) => {
      showToast({
        title: 'Failed to generate link',
        description: error instanceof Error ? error.message : 'Please try again later',
        type: 'error'
      })
    }
  })

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: invitationsApi.cancelInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', tripId] })
      showToast({
        title: 'Invitation cancelled',
        type: 'success'
      })
    },
    onError: (error) => {
      showToast({
        title: 'Failed to cancel invitation',
        description: error instanceof Error ? error.message : 'Please try again later',
        type: 'error'
      })
    }
  })

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: invitationsApi.resendInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', tripId] })
      showToast({
        title: 'Invitation resent',
        type: 'success'
      })
    },
    onError: (error) => {
      showToast({
        title: 'Failed to resend invitation',
        description: error instanceof Error ? error.message : 'Please try again later',
        type: 'error'
      })
    }
  })

  return {
    invitations,
    invitationsLoading,
    templates,
    templatesLoading,
    sendingStatus,
    sendInvitations: sendInvitationsMutation.mutate,
    sendInvitationsAsync: sendInvitationsMutation.mutateAsync,
    isSendingInvitations: sendInvitationsMutation.isPending,
    generateLink: generateLinkMutation.mutate,
    generateLinkAsync: generateLinkMutation.mutateAsync,
    isGeneratingLink: generateLinkMutation.isPending,
    cancelInvitation: cancelInvitationMutation.mutate,
    resendInvitation: resendInvitationMutation.mutate,
    clearSendingStatus: () => setSendingStatus(new Map())
  }
}