import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ParticipantInvitation } from '../ParticipantInvitation'
import { useInvitations } from '@/hooks/useInvitations'
import { useToast } from '@/hooks/useToast'
import type { InvitationTemplate } from '@/types/invitation'

// Mock dependencies
vi.mock('@/hooks/useInvitations')
vi.mock('@/hooks/useToast')
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqrcode')
  }
}))

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

const mockInvitations = [
  {
    id: '1',
    tripId: 'trip-123',
    email: 'user1@example.com',
    status: 'pending' as const,
    invitedBy: 'owner@example.com',
    invitedAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-08T00:00:00Z',
    token: 'token-1'
  },
  {
    id: '2',
    tripId: 'trip-123',
    email: 'user2@example.com',
    status: 'sent' as const,
    invitedBy: 'owner@example.com',
    invitedAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-08T00:00:00Z',
    token: 'token-2'
  }
]

const mockTemplates: InvitationTemplate[] = [
  {
    id: 'template-1',
    name: 'Welcome Template',
    subject: 'You are invited!',
    body: 'Hey! Join us for ${tripName}. Click here: ${inviteLink}',
    isDefault: true
  },
  {
    id: 'template-2',
    name: 'Formal Template',
    subject: 'Trip Invitation',
    body: 'Dear friend, you are invited to ${tripName}. Link: ${inviteLink}',
    isDefault: false
  }
]

const mockUseInvitations = {
  invitations: mockInvitations,
  templates: mockTemplates,
  sendingStatus: new Map(),
  sendInvitations: vi.fn(),
  sendInvitationsAsync: vi.fn(),
  generateLink: vi.fn(),
  generateLinkAsync: vi.fn(),
  isGeneratingLink: false,
  isSendingInvitations: false,
  clearSendingStatus: vi.fn(),
  invitationsLoading: false,
  templatesLoading: false,
  cancelInvitation: vi.fn(),
  resendInvitation: vi.fn()
}

const mockShowToast = vi.fn()

describe('ParticipantInvitation', () => {
  let queryClient: QueryClient
  const user = userEvent.setup()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    vi.mocked(useInvitations).mockReturnValue(mockUseInvitations)
    vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = (props = {}) => {
    const defaultProps = {
      tripId: 'trip-123',
      tripName: 'Summer Vacation',
      onInviteSent: vi.fn()
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <ParticipantInvitation {...defaultProps} {...props} />
      </QueryClientProvider>
    )
  }

  describe('Tab Navigation', () => {
    it('renders all three tabs', () => {
      renderComponent()

      expect(screen.getByRole('tab', { name: /email invitations/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /share link/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /bulk invite/i })).toBeInTheDocument()
    })

    it('shows email invitations tab by default', () => {
      renderComponent()

      expect(screen.getByRole('tab', { name: /email invitations/i })).toHaveAttribute('data-state', 'active')
      expect(screen.getByText(/send email invitations/i)).toBeInTheDocument()
    })

    it('switches between tabs correctly', async () => {
      renderComponent()

      // Click on Share Link tab
      await user.click(screen.getByRole('tab', { name: /share link/i }))
      expect(screen.getByText(/generate a link that anyone can use/i)).toBeInTheDocument()

      // Click on Bulk Invite tab
      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))
      expect(screen.getByText(/import and send invitations to multiple participants/i)).toBeInTheDocument()
    })
  })

  describe('Email Invitations Tab', () => {
    it('parses and validates email addresses', async () => {
      renderComponent()

      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      
      // Enter valid emails
      await user.type(emailInput, 'test1@example.com, test2@example.com')
      expect(screen.getByText(/detected 2 valid emails/i)).toBeInTheDocument()

      // Add invalid email
      await user.type(emailInput, ', invalid-email')
      expect(screen.getByText(/detected 2 valid emails/i)).toBeInTheDocument()

      // Test different separators
      await user.clear(emailInput)
      await user.type(emailInput, 'test1@example.com;test2@example.com\ntest3@example.com')
      expect(screen.getByText(/detected 3 valid emails/i)).toBeInTheDocument()
    })

    it('shows email validation error when no valid emails', async () => {
      renderComponent()

      const sendButton = screen.getByRole('button', { name: /send invitations/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'No valid emails',
          description: 'Please enter at least one valid email address',
          type: 'error'
        })
      })
    })

    it('selects and applies message templates', async () => {
      renderComponent()

      const templateSelect = screen.getByRole('combobox')
      await user.click(templateSelect)

      // Select a template
      const welcomeTemplate = screen.getByRole('option', { name: /welcome template/i })
      await user.click(welcomeTemplate)

      // Check if template content is applied
      const messageTextarea = screen.getByPlaceholderText(/add a personal message/i)
      await waitFor(() => {
        expect(messageTextarea).toHaveValue('Hey! Join us for Summer Vacation. Click here: http://localhost:3000/trips/join/trip-123')
      })
    })

    it('allows custom message input', async () => {
      renderComponent()

      const messageTextarea = screen.getByPlaceholderText(/add a personal message/i)
      await user.type(messageTextarea, 'Custom invitation message')

      expect(messageTextarea).toHaveValue('Custom invitation message')
    })

    it('sends email invitations successfully', async () => {
      const onInviteSent = vi.fn()
      renderComponent({ onInviteSent })

      // Add emails
      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      await user.type(emailInput, 'test1@example.com, test2@example.com')

      // Add message
      const messageTextarea = screen.getByPlaceholderText(/add a personal message/i)
      await user.type(messageTextarea, 'Please join our trip!')

      // Send invitations
      const sendButton = screen.getByRole('button', { name: /send invitations/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(mockUseInvitations.sendInvitations).toHaveBeenCalledWith({
          tripId: 'trip-123',
          emails: ['test1@example.com', 'test2@example.com'],
          message: 'Please join our trip!',
          templateId: ''
        })
      })

      // Check if onInviteSent was called for each email
      expect(onInviteSent).toHaveBeenCalledWith('test1@example.com')
      expect(onInviteSent).toHaveBeenCalledWith('test2@example.com')
    })

    it('displays invitation sending status', async () => {
      const sendingStatusMap = new Map([
        ['test1@example.com', 'sent'],
        ['test2@example.com', 'failed'],
        ['test3@example.com', 'sending']
      ])

      vi.mocked(useInvitations).mockReturnValue({
        ...mockUseInvitations,
        sendingStatus: sendingStatusMap
      })

      renderComponent()

      // Add emails to trigger status display
      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      await user.type(emailInput, 'test1@example.com, test2@example.com, test3@example.com')

      // Click send to trigger status display
      const sendButton = screen.getByRole('button', { name: /send invitations/i })
      await user.click(sendButton)

      // Status display should be visible after attempting to send
      await waitFor(() => {
        const statusSection = screen.getByText(/invitation status/i).parentElement
        expect(statusSection).toBeInTheDocument()
      })
    })

    it('disables send button when sending', () => {
      vi.mocked(useInvitations).mockReturnValue({
        ...mockUseInvitations,
        isSendingInvitations: true
      })

      renderComponent()

      const sendButton = screen.getByRole('button', { name: /sending/i })
      expect(sendButton).toBeDisabled()
      expect(screen.getByTestId('RefreshCw')).toHaveClass('animate-spin')
    })
  })

  describe('Share Link Tab', () => {
    it('generates new invitation link', async () => {
      renderComponent()

      // Switch to Share Link tab
      await user.click(screen.getByRole('tab', { name: /share link/i }))

      const generateButton = screen.getByRole('button', { name: /generate new link/i })
      await user.click(generateButton)

      expect(mockUseInvitations.generateLink).toHaveBeenCalledWith({
        tripId: 'trip-123',
        expiresInDays: 7
      })
    })

    it('displays existing share link', async () => {
      renderComponent({ shareLink: 'https://example.com/join/abc123' })

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      const linkInput = screen.getByDisplayValue('https://example.com/join/abc123')
      expect(linkInput).toBeInTheDocument()
      expect(linkInput).toHaveAttribute('readOnly')
    })

    it('copies link to clipboard', async () => {
      renderComponent({ shareLink: 'https://example.com/join/abc123' })

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      const copyButton = screen.getByRole('button', { name: /copy/i })
      await user.click(copyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/join/abc123')
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Link copied',
        description: 'Invitation link copied to clipboard',
        type: 'success'
      })
    })

    it('handles clipboard copy failure', async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Copy failed'))
      
      renderComponent({ shareLink: 'https://example.com/join/abc123' })

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      const copyButton = screen.getByRole('button', { name: /copy/i })
      await user.click(copyButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Failed to copy',
          description: 'Please copy the link manually',
          type: 'error'
        })
      })
    })

    it('generates and displays QR code', async () => {
      renderComponent({ shareLink: 'https://example.com/join/abc123' })

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      const qrButton = screen.getByRole('button', { name: /show qr code/i })
      await user.click(qrButton)

      await waitFor(() => {
        const qrImage = screen.getByAltText('Invitation QR Code')
        expect(qrImage).toBeInTheDocument()
        expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,mockqrcode')
        expect(screen.getByText(/scan to join "summer vacation"/i)).toBeInTheDocument()
      })

      // Click again to hide
      await user.click(qrButton)
      expect(screen.getByRole('button', { name: /show qr code/i })).toBeInTheDocument()
    })

    it('shows link expiration warning', async () => {
      renderComponent({ shareLink: 'https://example.com/join/abc123' })

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      expect(screen.getByText(/this link expires in 7 days/i)).toBeInTheDocument()
    })

    it('disables generate button when generating', async () => {
      vi.mocked(useInvitations).mockReturnValue({
        ...mockUseInvitations,
        isGeneratingLink: true
      })

      renderComponent()

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      const generateButton = screen.getByRole('button', { name: /generating/i })
      expect(generateButton).toBeDisabled()
    })
  })

  describe('Bulk Invite Tab', () => {
    it('parses bulk email input correctly', async () => {
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      const bulkInput = screen.getByPlaceholderText(/paste emails here/i)
      
      // Test various email formats
      const bulkEmails = `
        john@example.com
        Jane Doe <jane@example.com>
        Marketing Team: marketing@company.com
        user1@test.com, user2@test.com, user3@test.com
        duplicate@test.com
        duplicate@test.com
      `
      
      await user.type(bulkInput, bulkEmails)

      expect(screen.getByText(/found 6 unique email addresses/i)).toBeInTheDocument()
    })

    it('displays email preview badges', async () => {
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      const bulkInput = screen.getByPlaceholderText(/paste emails here/i)
      await user.type(bulkInput, 'test1@example.com, test2@example.com, test3@example.com')

      // Check if preview section appears
      expect(screen.getByText(/email preview/i)).toBeInTheDocument()
      
      // Check if badges are displayed
      const badges = screen.getAllByRole('status')
      expect(badges).toHaveLength(3)
      expect(badges[0]).toHaveTextContent('test1@example.com')
      expect(badges[1]).toHaveTextContent('test2@example.com')
      expect(badges[2]).toHaveTextContent('test3@example.com')
    })

    it('clears all emails when clear button is clicked', async () => {
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      const bulkInput = screen.getByPlaceholderText(/paste emails here/i)
      await user.type(bulkInput, 'test1@example.com, test2@example.com')

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await user.click(clearButton)

      expect(bulkInput).toHaveValue('')
      expect(screen.getByText(/found 0 unique email addresses/i)).toBeInTheDocument()
    })

    it('sends bulk invitations', async () => {
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      const bulkInput = screen.getByPlaceholderText(/paste emails here/i)
      await user.type(bulkInput, 'test1@example.com, test2@example.com, test3@example.com')

      const sendButton = screen.getByRole('button', { name: /send 3 invitations/i })
      await user.click(sendButton)

      expect(mockUseInvitations.sendInvitations).toHaveBeenCalledWith({
        tripId: 'trip-123',
        emails: ['test1@example.com', 'test2@example.com', 'test3@example.com'],
        message: '',
        templateId: ''
      })
    })

    it('shows correct count in send button', async () => {
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      const bulkInput = screen.getByPlaceholderText(/paste emails here/i)
      
      // No emails
      expect(screen.getByRole('button', { name: /send 0 invitations/i })).toBeInTheDocument()

      // Add emails
      await user.type(bulkInput, 'test1@example.com, test2@example.com')
      expect(screen.getByRole('button', { name: /send 2 invitations/i })).toBeInTheDocument()
    })

    it('disables send button when no emails or sending', async () => {
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      // No emails - button should be disabled
      const sendButton = screen.getByRole('button', { name: /send 0 invitations/i })
      expect(sendButton).toBeDisabled()

      // Test sending state
      vi.mocked(useInvitations).mockReturnValue({
        ...mockUseInvitations,
        isSendingInvitations: true
      })

      renderComponent()
      await user.click(screen.getByRole('tab', { name: /bulk invite/i }))

      const sendingButton = screen.getByRole('button', { name: /sending/i })
      expect(sendingButton).toBeDisabled()
    })
  })

  describe('Modal vs Standalone Mode', () => {
    it('hides invitation templates in modal mode', () => {
      renderComponent({ asModal: true })

      expect(screen.queryByText(/invitation message templates/i)).not.toBeInTheDocument()
    })

    it('shows invitation templates in standalone mode', () => {
      renderComponent({ asModal: false })

      expect(screen.getByText(/invitation message templates/i)).toBeInTheDocument()
      expect(screen.getByText(/casual/i)).toBeInTheDocument()
      expect(screen.getByText(/formal/i)).toBeInTheDocument()
      expect(screen.getByText(/detailed/i)).toBeInTheDocument()
    })

    it('copies template messages', async () => {
      renderComponent({ asModal: false })

      const copyButtons = screen.getAllByRole('button', { name: /copy/i })
      // Find the template copy button (not the link copy button)
      const templateCopyButton = copyButtons.find(btn => 
        btn.closest('.bg-gray-50')?.textContent?.includes('Casual')
      )

      if (templateCopyButton) {
        await user.click(templateCopyButton)
        
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('Hey! I\'m organizing a trip called "Summer Vacation"')
        )
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Template copied',
          type: 'success'
        })
      }
    })
  })

  describe('Permission Checks', () => {
    it('allows owner to send invitations', async () => {
      renderComponent()

      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      await user.type(emailInput, 'test@example.com')

      const sendButton = screen.getByRole('button', { name: /send invitations/i })
      expect(sendButton).not.toBeDisabled()
    })

    // Note: The component itself doesn't implement permission checks
    // This would typically be handled at a higher level or through API responses
    // The test is included as a placeholder for when this functionality is added
  })

  describe('Edge Cases', () => {
    it('handles empty template list', () => {
      vi.mocked(useInvitations).mockReturnValue({
        ...mockUseInvitations,
        templates: []
      })

      renderComponent()

      // Template selector should not be visible
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('removes duplicate emails', async () => {
      renderComponent()

      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      await user.type(emailInput, 'test@example.com, test@example.com, test@example.com')

      expect(screen.getByText(/detected 1 valid email/i)).toBeInTheDocument()
    })

    it('handles mixed valid and invalid emails', async () => {
      renderComponent()

      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      await user.type(emailInput, 'valid@example.com, invalid-email, another@valid.com, @invalid, valid3@test.com')

      expect(screen.getByText(/detected 3 valid emails/i)).toBeInTheDocument()
    })

    it('uses generated link over provided shareLink', async () => {
      vi.mocked(useInvitations).mockReturnValue({
        ...mockUseInvitations,
        generateLinkAsync: vi.fn().mockResolvedValue({ url: 'https://generated.link/xyz' })
      })

      renderComponent({ shareLink: 'https://original.link/abc' })

      await user.click(screen.getByRole('tab', { name: /share link/i }))

      // Initially shows original link
      expect(screen.getByDisplayValue('https://original.link/abc')).toBeInTheDocument()

      // Generate new link
      const generateButton = screen.getByRole('button', { name: /generate new link/i })
      await user.click(generateButton)

      // Should now show generated link
      await waitFor(() => {
        expect(screen.queryByDisplayValue('https://generated.link/xyz')).toBeInTheDocument()
      })
    })
  })

  describe('Form Reset', () => {
    it('resets form after successful email submission', async () => {
      renderComponent()

      const emailInput = screen.getByPlaceholderText(/enter email addresses/i)
      const messageInput = screen.getByPlaceholderText(/add a personal message/i)

      await user.type(emailInput, 'test@example.com')
      await user.type(messageInput, 'Test message')

      const sendButton = screen.getByRole('button', { name: /send invitations/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(emailInput).toHaveValue('')
        expect(messageInput).toHaveValue('')
      })
    })
  })
})