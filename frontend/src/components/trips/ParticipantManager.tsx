import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Download,
  Filter,
  X,
  Save,
  RefreshCw,
  ChevronDown,
  Mail,
  Calendar,
  Utensils,
  AlertCircle,
  Check,
  Baby,
  User,
  Dumbbell
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'
import type { Trip, Participant } from '@/store/slices/tripStore'
import { useTripStore } from '@/store/slices/tripStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'

interface ParticipantManagerProps {
  trip: Trip
}

interface ParticipantFormData extends Omit<Participant, 'id'> {
  id?: string
  dietaryRestrictions?: string[]
  role?: 'organizer' | 'participant'
  isActive?: boolean
}

interface CoefficientPreset {
  name: string
  icon: React.ReactNode
  coefficients: {
    breakfast: number
    lunch: number
    dinner: number
  }
}

const coefficientPresets: CoefficientPreset[] = [
  {
    name: 'Child',
    icon: <Baby className="w-4 h-4" />,
    coefficients: { breakfast: 0.5, lunch: 0.5, dinner: 0.5 }
  },
  {
    name: 'Adult',
    icon: <User className="w-4 h-4" />,
    coefficients: { breakfast: 1.0, lunch: 1.0, dinner: 1.0 }
  },
  {
    name: 'Athlete',
    icon: <Dumbbell className="w-4 h-4" />,
    coefficients: { breakfast: 1.5, lunch: 1.5, dinner: 1.5 }
  }
]

const dietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
  'Seafood allergy',
  'Halal',
  'Kosher',
  'Low carb',
  'Diabetic'
]

export const ParticipantManager: React.FC<ParticipantManagerProps> = ({ trip }) => {
  const { updateTrip, addParticipant, updateParticipant, removeParticipant } = useTripStore()
  const { showToast } = useToast()
  
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  const [filterDietaryRestrictions, setFilterDietaryRestrictions] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<ParticipantFormData | null>(null)
  const [showParticipantForm, setShowParticipantForm] = useState(false)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Extended participants with metadata
  const participantsWithMetadata = useMemo(() => {
    return trip.participants.map(p => ({
      ...p,
      dietaryRestrictions: (p as any).dietaryRestrictions || [],
      role: (p as any).role || 'participant',
      isActive: (p as any).isActive !== false
    }))
  }, [trip.participants])

  // Filtered participants
  const filteredParticipants = useMemo(() => {
    return participantsWithMetadata.filter(p => {
      if (!showInactive && !p.isActive) return false
      if (filterDietaryRestrictions.length > 0) {
        return filterDietaryRestrictions.some(restriction => 
          p.dietaryRestrictions.includes(restriction)
        )
      }
      return true
    })
  }, [participantsWithMetadata, filterDietaryRestrictions, showInactive])

  // Calculate total portions impact
  const totalPortions = useMemo(() => {
    const activeParticipants = participantsWithMetadata.filter(p => p.isActive)
    return {
      breakfast: activeParticipants.reduce((sum, p) => sum + p.mealCoefficients.breakfast, 0),
      lunch: activeParticipants.reduce((sum, p) => sum + p.mealCoefficients.lunch, 0),
      dinner: activeParticipants.reduce((sum, p) => sum + p.mealCoefficients.dinner, 0)
    }
  }, [participantsWithMetadata])

  const handleAddParticipant = useCallback(async (data: ParticipantFormData) => {
    try {
      await addParticipant(trip.id, data)
      showToast({
        title: 'Participant added',
        description: `${data.name} has been added to the trip`,
        type: 'success'
      })
      setShowParticipantForm(false)
      setEditingParticipant(null)
    } catch (error) {
      showToast({
        title: 'Error adding participant',
        description: error instanceof Error ? error.message : 'Failed to add participant',
        type: 'error'
      })
    }
  }, [trip.id, addParticipant, showToast])

  const handleUpdateParticipant = useCallback(async (id: string, data: Partial<ParticipantFormData>) => {
    try {
      await updateParticipant(trip.id, id, data)
      showToast({
        title: 'Participant updated',
        description: 'Changes have been saved',
        type: 'success'
      })
      setEditingParticipant(null)
      setShowParticipantForm(false)
    } catch (error) {
      showToast({
        title: 'Error updating participant',
        description: error instanceof Error ? error.message : 'Failed to update participant',
        type: 'error'
      })
    }
  }, [trip.id, updateParticipant, showToast])

  const handleDeleteParticipant = useCallback(async (id: string) => {
    try {
      await removeParticipant(trip.id, id)
      showToast({
        title: 'Participant removed',
        description: 'Participant has been removed from the trip',
        type: 'success'
      })
      setConfirmDelete(null)
    } catch (error) {
      showToast({
        title: 'Error removing participant',
        description: error instanceof Error ? error.message : 'Failed to remove participant',
        type: 'error'
      })
    }
  }, [trip.id, removeParticipant, showToast])

  const handleBulkCoefficientUpdate = useCallback(async (coefficients: { breakfast: number; lunch: number; dinner: number }) => {
    try {
      const updates = Array.from(selectedParticipants).map(id => ({
        id,
        mealCoefficients: coefficients
      }))
      
      await Promise.all(
        updates.map(({ id, mealCoefficients }) => 
          updateParticipant(trip.id, id, { mealCoefficients })
        )
      )
      
      showToast({
        title: 'Bulk update complete',
        description: `Updated coefficients for ${selectedParticipants.size} participants`,
        type: 'success'
      })
      
      setSelectedParticipants(new Set())
      setBulkEditMode(false)
    } catch (error) {
      showToast({
        title: 'Error updating participants',
        description: error instanceof Error ? error.message : 'Failed to update participants',
        type: 'error'
      })
    }
  }, [trip.id, selectedParticipants, updateParticipant, showToast])

  const exportParticipantList = useCallback(() => {
    const csv = [
      ['Name', 'Email', 'Role', 'Dietary Restrictions', 'Breakfast', 'Lunch', 'Dinner', 'Arrival', 'Departure', 'Status'],
      ...filteredParticipants.map(p => [
        p.name,
        p.email || '',
        p.role,
        p.dietaryRestrictions.join('; '),
        p.mealCoefficients.breakfast,
        p.mealCoefficients.lunch,
        p.mealCoefficients.dinner,
        p.arrivalDate || trip.startDate,
        p.departureDate || trip.endDate,
        p.isActive ? 'Active' : 'Inactive'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.name.replace(/\s+/g, '_')}_participants_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)

    showToast({
      title: 'Export complete',
      description: 'Participant list has been exported',
      type: 'success'
    })
  }, [filteredParticipants, trip, showToast])

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditingParticipant({
                name: '',
                email: '',
                mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 },
                dietaryRestrictions: [],
                role: 'participant',
                isActive: true
              })
              setShowParticipantForm(true)
            }}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Participant
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setBulkEditMode(!bulkEditMode)}
            className="flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            {bulkEditMode ? 'Cancel Bulk Edit' : 'Bulk Edit'}
          </Button>
          
          <Button
            variant="outline"
            onClick={exportParticipantList}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className="w-4 h-4" />
            </Button>
            
            {/* Filter dropdown would go here */}
          </div>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Bulk Edit Actions */}
      {bulkEditMode && selectedParticipants.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Edit ({selectedParticipants.size} selected)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleBulkCoefficientUpdate({ breakfast: 1, lunch: 1, dinner: 1 })}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Default
              </Button>
              
              {coefficientPresets.map(preset => (
                <Button
                  key={preset.name}
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkCoefficientUpdate(preset.coefficients)}
                  className="flex items-center gap-2"
                >
                  {preset.icon}
                  {preset.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Portions Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Breakfast Portions</p>
              <p className="text-2xl font-semibold">{totalPortions.breakfast.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lunch Portions</p>
              <p className="text-2xl font-semibold">{totalPortions.lunch.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dinner Portions</p>
              <p className="text-2xl font-semibold">{totalPortions.dinner.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredParticipants.map(participant => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            trip={trip}
            isSelected={selectedParticipants.has(participant.id)}
            bulkEditMode={bulkEditMode}
            onSelect={() => {
              const newSelected = new Set(selectedParticipants)
              if (newSelected.has(participant.id)) {
                newSelected.delete(participant.id)
              } else {
                newSelected.add(participant.id)
              }
              setSelectedParticipants(newSelected)
            }}
            onEdit={() => {
              setEditingParticipant(participant)
              setShowParticipantForm(true)
            }}
            onDelete={() => setConfirmDelete(participant.id)}
            confirmDelete={confirmDelete === participant.id}
            onConfirmDelete={() => handleDeleteParticipant(participant.id)}
            onCancelDelete={() => setConfirmDelete(null)}
            onUpdateCoefficient={(mealType, value) => {
              handleUpdateParticipant(participant.id, {
                mealCoefficients: {
                  ...participant.mealCoefficients,
                  [mealType]: value
                }
              })
            }}
          />
        ))}
      </div>

      {/* No participants message */}
      {filteredParticipants.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {trip.participants.length === 0
                ? 'No participants added yet'
                : 'No participants match the current filters'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Participant Form Modal/Drawer */}
      {showParticipantForm && editingParticipant && (
        <ParticipantForm
          participant={editingParticipant}
          trip={trip}
          onSave={(data) => {
            if (editingParticipant.id) {
              handleUpdateParticipant(editingParticipant.id, data)
            } else {
              handleAddParticipant(data)
            }
          }}
          onCancel={() => {
            setShowParticipantForm(false)
            setEditingParticipant(null)
          }}
        />
      )}
    </div>
  )
}

// Participant Card Component
interface ParticipantCardProps {
  participant: ParticipantFormData & { id: string }
  trip: Trip
  isSelected: boolean
  bulkEditMode: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  confirmDelete: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onUpdateCoefficient: (mealType: 'breakfast' | 'lunch' | 'dinner', value: number) => void
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  trip,
  isSelected,
  bulkEditMode,
  onSelect,
  onEdit,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  onUpdateCoefficient
}) => {
  const [localCoefficients, setLocalCoefficients] = useState(participant.mealCoefficients)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalCoefficients(participant.mealCoefficients)
    setHasChanges(false)
  }, [participant.mealCoefficients])

  const handleCoefficientChange = (mealType: 'breakfast' | 'lunch' | 'dinner', value: number) => {
    setLocalCoefficients(prev => ({
      ...prev,
      [mealType]: value
    }))
    setHasChanges(true)
  }

  const handleSaveChanges = () => {
    Object.entries(localCoefficients).forEach(([mealType, value]) => {
      if (value !== participant.mealCoefficients[mealType as keyof typeof participant.mealCoefficients]) {
        onUpdateCoefficient(mealType as 'breakfast' | 'lunch' | 'dinner', value)
      }
    })
    setHasChanges(false)
  }

  const handleResetChanges = () => {
    setLocalCoefficients(participant.mealCoefficients)
    setHasChanges(false)
  }

  return (
    <Card className={clsx(
      'relative transition-all',
      isSelected && 'ring-2 ring-primary-500',
      !participant.isActive && 'opacity-60'
    )}>
      {bulkEditMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
          />
        </div>
      )}

      <CardHeader className={bulkEditMode ? 'pl-12' : ''}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{participant.name}</h3>
            {participant.email && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Mail className="w-4 h-4" />
                {participant.email}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={participant.role === 'organizer' ? 'default' : 'secondary'}>
              {participant.role}
            </Badge>
            {!participant.isActive && (
              <Badge variant="outline" className="text-gray-500">
                Inactive
              </Badge>
            )}
          </div>
        </div>

        {/* Dietary restrictions */}
        {participant.dietaryRestrictions && participant.dietaryRestrictions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {participant.dietaryRestrictions.map(restriction => (
              <Badge key={restriction} variant="outline" className="text-xs">
                {restriction}
              </Badge>
            ))}
          </div>
        )}

        {/* Date range if different from trip */}
        {(participant.arrivalDate || participant.departureDate) && (
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>
              {participant.arrivalDate && format(parseISO(participant.arrivalDate), 'MMM d')}
              {' - '}
              {participant.departureDate && format(parseISO(participant.departureDate), 'MMM d')}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Meal coefficients */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Utensils className="w-4 h-4" />
            Meal Coefficients
          </div>
          
          {['breakfast', 'lunch', 'dinner'].map(mealType => (
            <div key={mealType} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{mealType}</span>
                <span className="font-medium">{localCoefficients[mealType as keyof typeof localCoefficients].toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={localCoefficients[mealType as keyof typeof localCoefficients]}
                onChange={(e) => handleCoefficientChange(mealType as 'breakfast' | 'lunch' | 'dinner', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                disabled={bulkEditMode}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {hasChanges ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveChanges}
                className="flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetChanges}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                disabled={bulkEditMode}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              {confirmDelete ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onConfirmDelete}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCancelDelete}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={bulkEditMode}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
          
          {!hasChanges && (
            <div className="text-sm text-gray-500">
              Total: {(localCoefficients.breakfast + localCoefficients.lunch + localCoefficients.dinner).toFixed(1)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Participant Form Component
interface ParticipantFormProps {
  participant: ParticipantFormData
  trip: Trip
  onSave: (data: ParticipantFormData) => void
  onCancel: () => void
}

const ParticipantForm: React.FC<ParticipantFormProps> = ({
  participant,
  trip,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<ParticipantFormData>(participant)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    
    if (formData.arrivalDate && formData.departureDate) {
      const arrival = new Date(formData.arrivalDate)
      const departure = new Date(formData.departureDate)
      if (arrival > departure) {
        newErrors.dates = 'Arrival date must be before departure date'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {participant.id ? 'Edit Participant' : 'Add Participant'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={clsx(
                  "w-full px-3 py-2 border rounded-md",
                  "dark:bg-gray-700 dark:border-gray-600",
                  errors.name && "border-red-500"
                )}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={clsx(
                  "w-full px-3 py-2 border rounded-md",
                  "dark:bg-gray-700 dark:border-gray-600",
                  errors.email && "border-red-500"
                )}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Role
              </label>
              <select
                value={formData.role || 'participant'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'organizer' | 'participant' })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="participant">Participant</option>
                <option value="organizer">Organizer</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm font-medium">Active participant</span>
              </label>
            </div>
          </div>

          {/* Dietary Restrictions */}
          <div className="space-y-4">
            <h3 className="font-medium">Dietary Restrictions</h3>
            <div className="grid grid-cols-2 gap-2">
              {dietaryOptions.map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(formData.dietaryRestrictions || []).includes(option)}
                    onChange={(e) => {
                      const restrictions = formData.dietaryRestrictions || []
                      if (e.target.checked) {
                        setFormData({ ...formData, dietaryRestrictions: [...restrictions, option] })
                      } else {
                        setFormData({ 
                          ...formData, 
                          dietaryRestrictions: restrictions.filter(r => r !== option)
                        })
                      }
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Meal Coefficients */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Meal Coefficients</h3>
              <div className="flex gap-2">
                {coefficientPresets.map(preset => (
                  <Button
                    key={preset.name}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFormData({ 
                      ...formData, 
                      mealCoefficients: preset.coefficients 
                    })}
                    className="flex items-center gap-1"
                  >
                    {preset.icon}
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            {['breakfast', 'lunch', 'dinner'].map(mealType => (
              <div key={mealType}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium capitalize">{mealType}</label>
                  <span className="text-sm font-medium">
                    {formData.mealCoefficients[mealType as keyof typeof formData.mealCoefficients].toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.mealCoefficients[mealType as keyof typeof formData.mealCoefficients]}
                  onChange={(e) => setFormData({
                    ...formData,
                    mealCoefficients: {
                      ...formData.mealCoefficients,
                      [mealType]: parseFloat(e.target.value)
                    }
                  })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Date Range */}
          <div className="space-y-4">
            <h3 className="font-medium">Attendance Dates</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Leave empty if attending the entire trip ({format(parseISO(trip.startDate), 'MMM d')} - {format(parseISO(trip.endDate), 'MMM d')})
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Arrival Date
                </label>
                <input
                  type="date"
                  value={formData.arrivalDate || ''}
                  min={trip.startDate}
                  max={trip.endDate}
                  onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={formData.departureDate || ''}
                  min={formData.arrivalDate || trip.startDate}
                  max={trip.endDate}
                  onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            
            {errors.dates && (
              <p className="text-sm text-red-500">{errors.dates}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit">
              {participant.id ? 'Save Changes' : 'Add Participant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}