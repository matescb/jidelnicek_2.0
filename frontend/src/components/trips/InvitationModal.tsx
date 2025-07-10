import React from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ParticipantInvitation } from './ParticipantInvitation'

interface InvitationModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  tripName: string
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripName
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Participants</DialogTitle>
          <DialogDescription>
            Invite people to join "{tripName}"
          </DialogDescription>
        </DialogHeader>
        
        <ParticipantInvitation
          tripId={tripId}
          tripName={tripName}
          onInviteSent={() => {
            // Optional: Close modal after successful invitation
            // onClose()
          }}
          asModal
        />
      </DialogContent>
    </Dialog>
  )
}