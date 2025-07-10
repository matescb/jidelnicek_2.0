import React, { useState } from 'react'
import { useTripStore } from '@/store/slices/tripStore'
import { useParticipants } from '@/hooks/useParticipants'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertCircle, Loader2, UserPlus, Edit, Trash2 } from 'lucide-react'

interface ParticipantOperationsExampleProps {
  tripId: string | number
}

export const ParticipantOperationsExample: React.FC<ParticipantOperationsExampleProps> = ({ tripId }) => {
  const {
    participants,
    loading,
    error,
    addParticipant,
    updateParticipant,
    removeParticipant,
    fetchParticipantsForDay,
    clearError
  } = useParticipants(tripId)

  const [dayParticipants, setDayParticipants] = useState<any[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  const handleAddParticipant = async () => {
    try {
      await addParticipant({
        name: `Test Participant ${Date.now()}`,
        email: 'test@example.com',
        mealCoefficients: {
          breakfast: 1,
          lunch: 1,
          dinner: 1
        }
      })
      console.log('Participant added successfully')
    } catch (error) {
      console.error('Failed to add participant:', error)
    }
  }

  const handleUpdateParticipant = async (participantId: string) => {
    try {
      await updateParticipant(participantId, {
        name: 'Updated Name',
        email: 'updated@example.com'
      })
      console.log('Participant updated successfully')
    } catch (error) {
      console.error('Failed to update participant:', error)
    }
  }

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      await removeParticipant(participantId)
      console.log('Participant removed successfully')
    } catch (error) {
      console.error('Failed to remove participant:', error)
    }
  }

  const handleFetchDayParticipants = async (dayNumber: number) => {
    setDayLoading(true)
    try {
      const data = await fetchParticipantsForDay(dayNumber)
      setDayParticipants(data || [])
      console.log('Day participants fetched:', data)
    } catch (error) {
      console.error('Failed to fetch day participants:', error)
    } finally {
      setDayLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearError}
                className="mt-2 text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Participant Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Participant Operations Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Participant */}
          <div>
            <Button
              onClick={handleAddParticipant}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add Test Participant
            </Button>
          </div>

          {/* Participants List */}
          <div className="space-y-2">
            <h3 className="font-medium">Current Participants ({participants.length})</h3>
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{participant.name}</p>
                  {participant.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{participant.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdateParticipant(participant.id)}
                    disabled={loading}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Fetch Day Participants */}
          <div className="space-y-2">
            <h3 className="font-medium">Day-specific Participants</h3>
            <div className="flex gap-2">
              {[1, 2, 3].map((day) => (
                <Button
                  key={day}
                  size="sm"
                  variant="outline"
                  onClick={() => handleFetchDayParticipants(day)}
                  disabled={dayLoading}
                >
                  Day {day}
                </Button>
              ))}
            </div>
            {dayParticipants.length > 0 && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium">Day Participants:</p>
                {dayParticipants.map((p, index) => (
                  <p key={index} className="text-sm">
                    - {p.name} {p.isPresent ? '(Present)' : '(Not Present)'}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}