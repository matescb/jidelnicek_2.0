import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, X, User, Mail, Utensils, Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useTripStore } from '@/store/slices/tripStore'
import { useToast } from '@/hooks/useToast'
import type { TripParticipant } from '@/types'

const participantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.enum(['planner', 'participant']),
  status: z.enum(['pending', 'accepted', 'declined']),
  mealCoefficient: z.number().min(0).max(2),
  snackCoefficient: z.number().min(0).max(2),
})

type ParticipantFormData = z.infer<typeof participantSchema>

interface ParticipantManagerProps {
  tripId: string
  participant?: TripParticipant | null
  onClose: () => void
}

export const ParticipantManager: React.FC<ParticipantManagerProps> = ({
  tripId,
  participant,
  onClose,
}) => {
  const { addParticipant, updateParticipant, participantLoading } = useTripStore()
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'participant',
      status: 'accepted',
      mealCoefficient: 1,
      snackCoefficient: 1,
    },
  })

  const mealCoefficient = watch('mealCoefficient')
  const snackCoefficient = watch('snackCoefficient')

  useEffect(() => {
    if (participant) {
      reset({
        name: participant.name,
        email: participant.email || '',
        role: participant.role,
        status: participant.status,
        mealCoefficient: participant.mealCoefficient,
        snackCoefficient: participant.snackCoefficient,
      })
    }
  }, [participant, reset])

  const onSubmit = async (data: ParticipantFormData) => {
    setIsSubmitting(true)
    try {
      if (participant) {
        // Update existing participant
        await updateParticipant(tripId, participant.id, data)
        showToast({
          title: 'Success',
          description: 'Participant updated successfully',
          type: 'success',
        })
      } else {
        // Add new participant
        await addParticipant(tripId, data)
        showToast({
          title: 'Success',
          description: 'Participant added successfully',
          type: 'success',
        })
      }
      onClose()
    } catch (error) {
      showToast({
        title: 'Error',
        description: participant ? 'Failed to update participant' : 'Failed to add participant',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Name
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enter participant name"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email (optional)
            </Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="participant@example.com"
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={watch('role')}
              onValueChange={(value) => setValue('role', value as 'planner' | 'participant')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participant</SelectItem>
                <SelectItem value="planner">Planner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(value) => setValue('status', value as 'pending' | 'accepted' | 'declined')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Coefficients */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Meal Coefficients</h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mealCoefficient" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Utensils className="w-4 h-4" />
                Meal Coefficient
              </span>
              <span className="text-sm font-normal text-gray-500">{mealCoefficient}</span>
            </Label>
            <Slider
              id="mealCoefficient"
              min={0}
              max={2}
              step={0.1}
              value={[mealCoefficient]}
              onValueChange={([value]) => setValue('mealCoefficient', value)}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 (No meals)</span>
              <span>1 (Standard)</span>
              <span>2 (Double)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="snackCoefficient" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Cookie className="w-4 h-4" />
                Snack Coefficient
              </span>
              <span className="text-sm font-normal text-gray-500">{snackCoefficient}</span>
            </Label>
            <Slider
              id="snackCoefficient"
              min={0}
              max={2}
              step={0.1}
              value={[snackCoefficient]}
              onValueChange={([value]) => setValue('snackCoefficient', value)}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 (No snacks)</span>
              <span>1 (Standard)</span>
              <span>2 (Double)</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Tip:</strong> Use coefficients to adjust portion sizes. For example, children might have 0.5-0.7, 
            while active adults might need 1.2-1.5.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || participantLoading}>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Saving...' : participant ? 'Update' : 'Add'} Participant
        </Button>
      </div>
    </form>
  )
}