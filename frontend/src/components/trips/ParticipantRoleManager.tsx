import React, { useState } from 'react'
import { 
  Crown, 
  ChefHat, 
  ShoppingCart, 
  Car, 
  Calendar,
  Settings,
  Users,
  Shield,
  Plus,
  X,
  Edit2,
  Save,
  Info
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'

interface ParticipantRole {
  id: string
  name: string
  email?: string
  roles: string[]
  permissions?: string[]
}

interface RoleDefinition {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  description: string
  permissions: string[]
  isCustom?: boolean
}

interface ParticipantRoleManagerProps {
  participants: ParticipantRole[]
  onUpdateRoles: (participantId: string, roles: string[]) => void
  onUpdatePermissions?: (participantId: string, permissions: string[]) => void
  allowCustomRoles?: boolean
}

const defaultRoles: RoleDefinition[] = [
  {
    id: 'organizer',
    name: 'Organizer',
    icon: <Crown className="w-4 h-4" />,
    color: 'text-yellow-600',
    description: 'Full access to manage the trip',
    permissions: ['manage_trip', 'manage_participants', 'manage_meals', 'manage_budget', 'view_all']
  },
  {
    id: 'chef',
    name: 'Chef',
    icon: <ChefHat className="w-4 h-4" />,
    color: 'text-green-600',
    description: 'Manages meal planning and recipes',
    permissions: ['manage_meals', 'view_participants', 'view_budget']
  },
  {
    id: 'shopper',
    name: 'Shopper',
    icon: <ShoppingCart className="w-4 h-4" />,
    color: 'text-blue-600',
    description: 'Handles shopping and supplies',
    permissions: ['manage_shopping', 'view_meals', 'manage_budget']
  },
  {
    id: 'driver',
    name: 'Driver',
    icon: <Car className="w-4 h-4" />,
    color: 'text-purple-600',
    description: 'Coordinates transportation',
    permissions: ['manage_transport', 'view_participants']
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-orange-600',
    description: 'Manages trip schedule and activities',
    permissions: ['manage_schedule', 'view_participants']
  }
]

const permissionDescriptions: Record<string, string> = {
  'manage_trip': 'Edit trip details and settings',
  'manage_participants': 'Add, remove, and edit participants',
  'manage_meals': 'Plan meals and manage recipes',
  'manage_budget': 'Handle trip finances and expenses',
  'manage_shopping': 'Create and manage shopping lists',
  'manage_transport': 'Coordinate transportation logistics',
  'manage_schedule': 'Plan and update trip activities',
  'view_all': 'View all trip information',
  'view_participants': 'View participant information',
  'view_meals': 'View meal plans',
  'view_budget': 'View budget information'
}

export const ParticipantRoleManager: React.FC<ParticipantRoleManagerProps> = ({
  participants,
  onUpdateRoles,
  onUpdatePermissions,
  allowCustomRoles = false
}) => {
  const { showToast } = useToast()
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRole | null>(null)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showCustomRoleDialog, setShowCustomRoleDialog] = useState(false)
  const [customRoles, setCustomRoles] = useState<RoleDefinition[]>([])
  const [editingRoles, setEditingRoles] = useState<Record<string, boolean>>({})
  
  const allRoles = [...defaultRoles, ...customRoles]

  const handleRoleToggle = (participantId: string, roleId: string) => {
    const participant = participants.find(p => p.id === participantId)
    if (!participant) return

    const currentRoles = participant.roles || []
    const newRoles = currentRoles.includes(roleId)
      ? currentRoles.filter(r => r !== roleId)
      : [...currentRoles, roleId]

    onUpdateRoles(participantId, newRoles)
    
    // Update permissions based on roles
    if (onUpdatePermissions) {
      const permissions = new Set<string>()
      newRoles.forEach(roleId => {
        const role = allRoles.find(r => r.id === roleId)
        if (role) {
          role.permissions.forEach(p => permissions.add(p))
        }
      })
      onUpdatePermissions(participantId, Array.from(permissions))
    }

    showToast({
      title: 'Roles updated',
      description: `Updated roles for ${participant.name}`,
      type: 'success'
    })
  }

  const handleQuickAssign = (roleId: string) => {
    setSelectedParticipant(null)
    setShowRoleDialog(true)
  }

  const getRoleStats = () => {
    const stats: Record<string, number> = {}
    allRoles.forEach(role => {
      stats[role.id] = participants.filter(p => 
        p.roles && p.roles.includes(role.id)
      ).length
    })
    return stats
  }

  const roleStats = getRoleStats()

  const hasOrganizer = participants.some(p => p.roles && p.roles.includes('organizer'))

  return (
    <div className="space-y-6">
      {/* Warning if no organizer */}
      {!hasOrganizer && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No organizer assigned. At least one participant should have the organizer role.
          </AlertDescription>
        </Alert>
      )}

      {/* Role Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role Distribution
          </CardTitle>
          <CardDescription>
            Assign responsibilities to trip participants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {allRoles.map(role => (
              <div
                key={role.id}
                className="text-center p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleQuickAssign(role.id)}
              >
                <div className={cn("flex justify-center mb-2", role.color)}>
                  {role.icon}
                </div>
                <h4 className="font-medium text-sm">{role.name}</h4>
                <p className="text-2xl font-bold mt-1">{roleStats[role.id] || 0}</p>
                <p className="text-xs text-gray-500">assigned</p>
              </div>
            ))}
          </div>

          {allowCustomRoles && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowCustomRoleDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Role
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Participant Roles */}
      <Card>
        <CardHeader>
          <CardTitle>Participant Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {participants.map(participant => {
              const isEditing = editingRoles[participant.id]
              const participantRoles = participant.roles || []

              return (
                <div
                  key={participant.id}
                  className="flex items-start justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{participant.name}</h4>
                      {participant.email && (
                        <span className="text-sm text-gray-500">({participant.email})</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {allRoles.map(role => (
                            <label
                              key={role.id}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={participantRoles.includes(role.id)}
                                onCheckedChange={() => handleRoleToggle(participant.id, role.id)}
                              />
                              <span className={cn("flex items-center gap-1 text-sm", role.color)}>
                                {role.icon}
                                {role.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {participantRoles.length === 0 ? (
                          <Badge variant="outline" className="text-gray-500">
                            No roles assigned
                          </Badge>
                        ) : (
                          participantRoles.map(roleId => {
                            const role = allRoles.find(r => r.id === roleId)
                            if (!role) return null
                            return (
                              <Badge
                                key={roleId}
                                variant="secondary"
                                className={cn("flex items-center gap-1", role.color)}
                              >
                                {role.icon}
                                {role.name}
                              </Badge>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* Permissions preview */}
                    {!isEditing && participant.permissions && participant.permissions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Permissions:</p>
                        <div className="flex flex-wrap gap-1">
                          {participant.permissions.slice(0, 3).map(permission => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permissionDescriptions[permission] || permission}
                            </Badge>
                          ))}
                          {participant.permissions.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{participant.permissions.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingRoles({
                      ...editingRoles,
                      [participant.id]: !isEditing
                    })}
                  >
                    {isEditing ? (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Done
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Role Details */}
      <Card>
        <CardHeader>
          <CardTitle>Role Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allRoles.map(role => (
              <div key={role.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={role.color}>{role.icon}</div>
                  <h4 className="font-medium">{role.name}</h4>
                  {role.isCustom && (
                    <Badge variant="outline" className="text-xs">Custom</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                  {role.description}
                </p>
                <div className="ml-6">
                  <p className="text-xs font-medium text-gray-500 mb-1">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map(permission => (
                      <Badge key={permission} variant="outline" className="text-xs">
                        {permissionDescriptions[permission] || permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Assignment Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Role Assignment</DialogTitle>
            <DialogDescription>
              Select participants to assign roles quickly
            </DialogDescription>
          </DialogHeader>
          {/* Dialog content would go here */}
        </DialogContent>
      </Dialog>
    </div>
  )
}