import React, { useState } from 'react'
import { Mail, Send, Copy, Check, UserPlus, Link2, QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import QRCode from 'qrcode'

interface ParticipantInvitationProps {
  tripId: string
  tripName: string
  shareLink?: string
  onInviteSent?: (email: string) => void
}

export const ParticipantInvitation: React.FC<ParticipantInvitationProps> = ({ 
  tripId, 
  tripName,
  shareLink,
  onInviteSent 
}) => {
  const { showToast } = useToast()
  const [inviteEmails, setInviteEmails] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  
  const inviteLink = shareLink || `${window.location.origin}/trips/join/${tripId}`

  const handleEmailInvite = async () => {
    const emails = inviteEmails
      .split(/[,;\s]+/)
      .map(email => email.trim())
      .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))

    if (emails.length === 0) {
      showToast({
        title: 'Invalid emails',
        description: 'Please enter valid email addresses',
        type: 'error'
      })
      return
    }

    setIsLoading(true)
    try {
      // Simulate API call to send invitations
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      emails.forEach(email => {
        onInviteSent?.(email)
      })

      showToast({
        title: 'Invitations sent',
        description: `Sent ${emails.length} invitation${emails.length > 1 ? 's' : ''}`,
        type: 'success'
      })
      
      setInviteEmails('')
    } catch (error) {
      showToast({
        title: 'Failed to send invitations',
        description: 'Please try again later',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      showToast({
        title: 'Link copied',
        description: 'Invitation link copied to clipboard',
        type: 'success'
      })
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      showToast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        type: 'error'
      })
    }
  }

  const generateQRCode = async () => {
    try {
      const qr = await QRCode.toDataURL(inviteLink)
      setQrCode(qr)
      setShowQR(true)
    } catch (error) {
      showToast({
        title: 'Failed to generate QR code',
        description: 'Please try again',
        type: 'error'
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Invitations
          </CardTitle>
          <CardDescription>
            Send email invitations to participants
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emails">Email addresses</Label>
            <textarea
              id="emails"
              className={cn(
                "w-full min-h-[100px] px-3 py-2 text-sm rounded-md",
                "border border-input bg-background",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              placeholder="Enter email addresses separated by commas, semicolons, or new lines"
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Separate multiple emails with commas, semicolons, or new lines
            </p>
          </div>
          
          <Button 
            onClick={handleEmailInvite} 
            disabled={isLoading || !inviteEmails.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Invitations
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Share Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Share Link
          </CardTitle>
          <CardDescription>
            Share this link with participants to let them join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {linkCopied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateQRCode}
              className="flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              Generate QR Code
            </Button>
          </div>

          {showQR && qrCode && (
            <div className="mt-4 p-4 bg-white dark:bg-gray-950 rounded-lg border">
              <img 
                src={qrCode} 
                alt="Invitation QR Code" 
                className="mx-auto max-w-[200px]"
              />
              <p className="text-center text-sm text-muted-foreground mt-2">
                Scan to join "{tripName}"
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitation Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invitation Message Templates
          </CardTitle>
          <CardDescription>
            Use these templates for your invitations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <InvitationTemplate
            title="Casual"
            message={`Hey! I'm organizing a trip called "${tripName}" and would love for you to join. Click here to see the details and RSVP: ${inviteLink}`}
            onCopy={() => showToast({ title: 'Template copied', type: 'success' })}
          />
          
          <InvitationTemplate
            title="Formal"
            message={`Dear Friend,\n\nYou are cordially invited to join our upcoming trip: "${tripName}".\n\nPlease follow this link to view the details and confirm your attendance: ${inviteLink}\n\nWe look forward to having you with us!\n\nBest regards`}
            onCopy={() => showToast({ title: 'Template copied', type: 'success' })}
          />
          
          <InvitationTemplate
            title="Detailed"
            message={`Join us for "${tripName}"!\n\nWe're planning an amazing trip and would love to have you join us. Here's what you need to know:\n\n• Trip dates: [Add dates]\n• Location: [Add location]\n• Activities planned: [Add activities]\n\nClick the link below to see all the details and let us know if you can make it:\n${inviteLink}\n\nQuestions? Just reply to this message!`}
            onCopy={() => showToast({ title: 'Template copied', type: 'success' })}
          />
        </CardContent>
      </Card>
    </div>
  )
}

interface InvitationTemplateProps {
  title: string
  message: string
  onCopy: () => void
}

const InvitationTemplate: React.FC<InvitationTemplateProps> = ({ title, message, onCopy }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      onCopy()
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{title}</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="text-xs"
        >
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
      </div>
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
        {message}
      </p>
    </div>
  )
}