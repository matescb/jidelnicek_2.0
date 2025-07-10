import React, { useState, useEffect } from 'react'
import { Mail, Send, Copy, Check, UserPlus, Link2, QrCode, RefreshCw, Users, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/useToast'
import { useInvitations } from '@/hooks/useInvitations'
import { cn } from '@/lib/utils'
import QRCode from 'qrcode'
import type { InvitationFormData, InvitationStatus } from '@/types/invitation'

// Form validation schema
const invitationSchema = z.object({
  emails: z.array(z.string().email('Invalid email address')).min(1, 'At least one email is required'),
  message: z.string().optional(),
  templateId: z.string().optional(),
  sendMethod: z.enum(['email', 'link', 'both']).default('email')
})

interface ParticipantInvitationProps {
  tripId: string
  tripName: string
  shareLink?: string
  onInviteSent?: (email: string) => void
  asModal?: boolean
}

export const ParticipantInvitation: React.FC<ParticipantInvitationProps> = ({ 
  tripId, 
  tripName,
  shareLink,
  onInviteSent,
  asModal = false
}) => {
  const { showToast } = useToast()
  const {
    invitations,
    templates,
    sendingStatus,
    sendInvitations,
    generateLink,
    generateLinkAsync,
    isGeneratingLink,
    isSendingInvitations,
    clearSendingStatus
  } = useInvitations(tripId)

  const [inviteEmails, setInviteEmails] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  const [generatedLink, setGeneratedLink] = useState<string>('')
  const [invitationStatuses, setInvitationStatuses] = useState<InvitationStatus[]>([])
  
  const inviteLink = generatedLink || shareLink || `${window.location.origin}/trips/join/${tripId}`

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      emails: [],
      message: '',
      sendMethod: 'email'
    }
  })

  // Update form when template is selected
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find(t => t.id === selectedTemplateId)
      if (template) {
        setCustomMessage(template.body.replace('${tripName}', tripName).replace('${inviteLink}', inviteLink))
      }
    }
  }, [selectedTemplateId, templates, tripName, inviteLink])

  // Parse emails from textarea
  const parseEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const matches = text.match(emailRegex) || []
    return [...new Set(matches)] // Remove duplicates
  }

  // Handle form submission
  const onSubmit = async (data: InvitationFormData) => {
    const emails = parseEmails(inviteEmails)
    if (emails.length === 0) {
      showToast({
        title: 'No valid emails',
        description: 'Please enter at least one valid email address',
        type: 'error'
      })
      return
    }

    // Update invitation statuses
    setInvitationStatuses(emails.map(email => ({ email, status: 'pending' })))

    try {
      if (data.sendMethod === 'email' || data.sendMethod === 'both') {
        await sendInvitations({
          tripId,
          emails,
          message: customMessage || data.message,
          templateId: selectedTemplateId
        })
        
        emails.forEach(email => {
          onInviteSent?.(email)
        })
      }

      if (data.sendMethod === 'link' || data.sendMethod === 'both') {
        const link = await generateLinkAsync({
          tripId,
          expiresInDays: 7,
          maxUses: emails.length > 0 ? emails.length * 2 : undefined
        })
        setGeneratedLink(link.url)
      }

      // Reset form after successful submission
      setInviteEmails('')
      setCustomMessage('')
      reset()
    } catch (error) {
      console.error('Failed to send invitations:', error)
    }
  }

  const handleEmailInvite = async () => {
    const emails = parseEmails(inviteEmails)
    if (emails.length === 0) {
      showToast({
        title: 'Invalid emails',
        description: 'Please enter valid email addresses',
        type: 'error'
      })
      return
    }

    await sendInvitations({
      tripId,
      emails,
      message: customMessage,
      templateId: selectedTemplateId
    })
    
    emails.forEach(email => {
      onInviteSent?.(email)
    })
    
    setInviteEmails('')
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
    <div className={cn("space-y-6", asModal && "px-1")}>
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email">Email Invitations</TabsTrigger>
          <TabsTrigger value="link">Share Link</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Invite</TabsTrigger>
        </TabsList>

        {/* Email Invitations Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Send Email Invitations
              </CardTitle>
              <CardDescription>
                Invite participants by sending them personalized email invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email addresses input */}
                <div className="space-y-2">
                  <Label htmlFor="emails">Email addresses</Label>
                  <Textarea
                    id="emails"
                    className="min-h-[100px]"
                    placeholder="Enter email addresses separated by commas, semicolons, or new lines"
                    value={inviteEmails}
                    onChange={(e) => {
                      setInviteEmails(e.target.value)
                      const emails = parseEmails(e.target.value)
                      setValue('emails', emails)
                    }}
                  />
                  {errors.emails && (
                    <p className="text-sm text-red-600">{errors.emails.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Detected {parseEmails(inviteEmails).length} valid email{parseEmails(inviteEmails).length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Template selection */}
                {templates && templates.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Message template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Custom message</SelectItem>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    className="min-h-[120px]"
                    placeholder="Add a personal message to your invitation..."
                    value={customMessage}
                    onChange={(e) => {
                      setCustomMessage(e.target.value)
                      setValue('message', e.target.value)
                    }}
                  />
                </div>

                {/* Invitation status display */}
                {invitationStatuses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Invitation Status</Label>
                    <div className="max-h-[150px] overflow-y-auto space-y-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                      {invitationStatuses.map((status, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="truncate">{status.email}</span>
                          <Badge 
                            variant={
                              sendingStatus.get(status.email) === 'sent' ? 'success' :
                              sendingStatus.get(status.email) === 'failed' ? 'destructive' :
                              sendingStatus.get(status.email) === 'sending' ? 'secondary' :
                              'outline'
                            }
                          >
                            {sendingStatus.get(status.email) || status.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  type="submit"
                  disabled={isSendingInvitations || parseEmails(inviteEmails).length === 0}
                  className="w-full sm:w-auto"
                >
                  {isSendingInvitations ? (
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
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Share Link Tab */}
        <TabsContent value="link" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Share Invitation Link
              </CardTitle>
              <CardDescription>
                Generate a link that anyone can use to join the trip
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!generatedLink && (
                <Button
                  onClick={() => generateLink({ tripId, expiresInDays: 7 })}
                  disabled={isGeneratingLink}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingLink ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Generate New Link
                    </>
                  )}
                </Button>
              )}

              {(generatedLink || shareLink) && (
                <>
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
                      {showQR ? 'Hide' : 'Show'} QR Code
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

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This link expires in 7 days. Anyone with this link can join the trip.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Invite Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Bulk Invitations
              </CardTitle>
              <CardDescription>
                Import and send invitations to multiple participants at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Paste a list of emails or copy from a spreadsheet. We'll automatically detect and parse email addresses.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="bulk-emails">Bulk email input</Label>
                <Textarea
                  id="bulk-emails"
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Paste emails here... Examples:
john@example.com
Jane Doe <jane@example.com>
Marketing Team: marketing@company.com
user1@test.com, user2@test.com, user3@test.com"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Found {parseEmails(inviteEmails).length} unique email addresses
                  </p>
                  {parseEmails(inviteEmails).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInviteEmails('')}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {parseEmails(inviteEmails).length > 0 && (
                <div className="space-y-2">
                  <Label>Email preview</Label>
                  <div className="max-h-[150px] overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <div className="flex flex-wrap gap-2">
                      {parseEmails(inviteEmails).map((email, index) => (
                        <Badge key={index} variant="secondary">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleEmailInvite}
                disabled={isSendingInvitations || parseEmails(inviteEmails).length === 0}
                className="w-full sm:w-auto"
              >
                {isSendingInvitations ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending {parseEmails(inviteEmails).length} invitations...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {parseEmails(inviteEmails).length} Invitations
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invitation Templates */}
      {!asModal && (
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
      )}
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