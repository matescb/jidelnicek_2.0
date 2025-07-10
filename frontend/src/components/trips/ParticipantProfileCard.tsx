import React from 'react'
import { 
  User, 
  Mail, 
  Calendar, 
  Utensils, 
  Crown, 
  Info,
  MapPin,
  Phone,
  AlertCircle
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ExtendedParticipant {
  id: string
  name: string
  email?: string
  phone?: string
  avatar?: string
  role?: 'organizer' | 'participant'
  arrivalDate?: string
  departureDate?: string
  mealCoefficients: {
    breakfast: number
    lunch: number
    dinner: number
  }
  dietaryRestrictions?: string[]
  allergies?: string[]
  preferences?: {
    roomType?: string
    transportation?: string
    activities?: string[]
  }
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  notes?: string
  isActive?: boolean
  joinedAt?: string
}

interface ParticipantProfileCardProps {
  participant: ExtendedParticipant
  tripStartDate: string
  tripEndDate: string
  variant?: 'default' | 'compact' | 'detailed'
  showActions?: boolean
  onEdit?: () => void
  onRemove?: () => void
}

export const ParticipantProfileCard: React.FC<ParticipantProfileCardProps> = ({
  participant,
  tripStartDate,
  tripEndDate,
  variant = 'default',
  showActions = true,
  onEdit,
  onRemove
}) => {
  const totalCoefficient = 
    participant.mealCoefficients.breakfast + 
    participant.mealCoefficients.lunch + 
    participant.mealCoefficients.dinner

  const avgCoefficient = totalCoefficient / 3

  const getParticipantStatus = () => {
    if (!participant.isActive) return 'inactive'
    if (participant.arrivalDate && new Date(participant.arrivalDate) > new Date()) return 'pending'
    return 'active'
  }

  const status = getParticipantStatus()

  if (variant === 'compact') {
    return (
      <Card className={cn(
        "hover:shadow-md transition-shadow",
        status === 'inactive' && "opacity-60"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-800"
              )}>
                {participant.avatar ? (
                  <img 
                    src={participant.avatar} 
                    alt={participant.name} 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{participant.name}</h4>
                  {participant.role === 'organizer' && (
                    <Crown className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Utensils className="w-3 h-3" />
                    {avgCoefficient.toFixed(1)}
                  </span>
                  
                  {participant.dietaryRestrictions && participant.dietaryRestrictions.length > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {participant.dietaryRestrictions.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge 
                variant={
                  status === 'active' ? 'default' : 
                  status === 'pending' ? 'secondary' : 
                  'outline'
                }
                className="text-xs"
              >
                {status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "hover:shadow-lg transition-all",
      status === 'inactive' && "opacity-60"
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-primary-100 to-primary-200",
              "dark:from-primary-900 dark:to-primary-800"
            )}>
              {participant.avatar ? (
                <img 
                  src={participant.avatar} 
                  alt={participant.name} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {participant.name}
                {participant.role === 'organizer' && (
                  <Tooltip content="Trip Organizer">
                    <Crown className="w-5 h-5 text-yellow-500" />
                  </Tooltip>
                )}
              </h3>
              
              {participant.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <Mail className="w-4 h-4" />
                  {participant.email}
                </div>
              )}
              
              {participant.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <Phone className="w-4 h-4" />
                  {participant.phone}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge 
              variant={
                status === 'active' ? 'default' : 
                status === 'pending' ? 'secondary' : 
                'outline'
              }
            >
              {status === 'active' ? 'Active' : 
               status === 'pending' ? 'Pending' : 
               'Inactive'}
            </Badge>
            
            {participant.joinedAt && (
              <span className="text-xs text-gray-500">
                Joined {format(parseISO(participant.joinedAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Attendance Dates */}
        {(participant.arrivalDate || participant.departureDate) && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <div className="text-sm">
              <span className="font-medium">Attendance:</span> {' '}
              {participant.arrivalDate ? format(parseISO(participant.arrivalDate), 'MMM d') : format(parseISO(tripStartDate), 'MMM d')}
              {' - '}
              {participant.departureDate ? format(parseISO(participant.departureDate), 'MMM d') : format(parseISO(tripEndDate), 'MMM d')}
            </div>
          </div>
        )}

        {/* Meal Coefficients */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Utensils className="w-4 h-4" />
              Meal Portions
            </span>
            <span className="text-sm font-semibold">
              Total: {totalCoefficient.toFixed(1)}
            </span>
          </div>
          
          <div className="space-y-2">
            {Object.entries(participant.mealCoefficients).map(([meal, value]) => (
              <div key={meal} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600 dark:text-gray-400">{meal}</span>
                  <span className="font-medium">{value.toFixed(1)}</span>
                </div>
                <Progress value={value * 50} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Dietary Information */}
        {((participant.dietaryRestrictions && participant.dietaryRestrictions.length > 0) || 
          (participant.allergies && participant.allergies.length > 0)) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Dietary Information
            </h4>
            
            {participant.dietaryRestrictions && participant.dietaryRestrictions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {participant.dietaryRestrictions.map(restriction => (
                  <Badge key={restriction} variant="outline" className="text-xs">
                    {restriction}
                  </Badge>
                ))}
              </div>
            )}
            
            {participant.allergies && participant.allergies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {participant.allergies.map(allergy => (
                  <Badge key={allergy} variant="destructive" className="text-xs">
                    Allergy: {allergy}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emergency Contact */}
        {participant.emergencyContact && variant === 'detailed' && (
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg space-y-1">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
              Emergency Contact
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              {participant.emergencyContact.name} ({participant.emergencyContact.relationship})
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              {participant.emergencyContact.phone}
            </p>
          </div>
        )}

        {/* Notes */}
        {participant.notes && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              {participant.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        {showActions && (onEdit || onRemove) && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
              >
                Edit Profile
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-red-600 hover:text-red-700"
              >
                Remove
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}