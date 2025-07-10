import React, { useState } from 'react'
import { 
  ParticipantManager,
  ParticipantInvitation,
  ParticipantProfileCard,
  DietaryRestrictionsManager,
  ParticipantRoleManager
} from '@/components/trips'
import { Container } from '@/components/layout/Container'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/useToast'
import type { Trip, Participant } from '@/store/slices/tripStore'

// Mock data for demonstration
const mockTrip: Trip = {
  id: '1',
  name: 'Summer Camping Trip 2024',
  description: 'Annual camping trip to the mountains',
  startDate: '2024-07-15',
  endDate: '2024-07-22',
  participantCount: 8,
  status: 'planning',
  mealSlotConfiguration: [
    { id: '1', dayNumber: 1, mealType: 'breakfast', isActive: true, displayOrder: 1 },
    { id: '2', dayNumber: 1, mealType: 'lunch', isActive: true, displayOrder: 2 },
    { id: '3', dayNumber: 1, mealType: 'dinner', isActive: true, displayOrder: 3 }
  ],
  participants: [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      mealCoefficients: { breakfast: 1.5, lunch: 1.5, dinner: 1.5 }
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 }
    },
    {
      id: '3',
      name: 'Mike Johnson',
      email: 'mike@example.com',
      mealCoefficients: { breakfast: 1.2, lunch: 1.2, dinner: 1.2 }
    },
    {
      id: '4',
      name: 'Sarah Wilson',
      email: 'sarah@example.com',
      mealCoefficients: { breakfast: 0.8, lunch: 0.8, dinner: 0.8 }
    },
    {
      id: '5',
      name: 'Tom Brown',
      mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 }
    },
    {
      id: '6',
      name: 'Emily Davis',
      email: 'emily@example.com',
      mealCoefficients: { breakfast: 0.5, lunch: 0.5, dinner: 0.5 }
    },
    {
      id: '7',
      name: 'Chris Martinez',
      email: 'chris@example.com',
      mealCoefficients: { breakfast: 1.3, lunch: 1.3, dinner: 1.3 }
    },
    {
      id: '8',
      name: 'Lisa Anderson',
      email: 'lisa@example.com',
      mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 }
    }
  ],
  days: [],
  userId: 'user123',
  location: 'Rocky Mountain National Park',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z'
}

// Extended participants with additional data
const extendedParticipants = mockTrip.participants.map((p, index) => ({
  ...p,
  dietaryRestrictions: 
    index === 1 ? ['Vegetarian', 'Gluten-free'] :
    index === 2 ? ['Nut allergy'] :
    index === 3 ? ['Vegan'] :
    index === 6 ? ['Halal', 'Dairy-free'] :
    [],
  allergies:
    index === 2 ? ['Peanuts', 'Tree nuts'] :
    index === 7 ? ['Shellfish'] :
    [],
  role: index === 0 ? 'organizer' : 'participant',
  roles: 
    index === 0 ? ['organizer', 'chef'] :
    index === 1 ? ['shopper'] :
    index === 2 ? ['driver'] :
    index === 3 ? ['chef'] :
    [],
  isActive: index !== 5,
  arrivalDate: index === 4 ? '2024-07-16' : undefined,
  departureDate: index === 4 ? '2024-07-20' : undefined,
  phone: index < 4 ? '+1 555-0' + (100 + index) : undefined,
  joinedAt: '2024-01-' + (15 + index) + 'T10:00:00Z',
  notes: 
    index === 2 ? 'Severe nut allergy - please ensure no cross-contamination' :
    index === 6 ? 'Prefers spicy food' :
    undefined
}))

export const ParticipantManagementDemo: React.FC = () => {
  const { showToast } = useToast()
  const [participants, setParticipants] = useState(extendedParticipants)
  const [activeTab, setActiveTab] = useState('overview')

  const handleUpdateRoles = (participantId: string, roles: string[]) => {
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, roles } : p
    ))
    showToast({
      title: 'Roles updated',
      type: 'success'
    })
  }

  const handleFilterByRestriction = (restriction: string) => {
    if (restriction) {
      showToast({
        title: `Filtering by: ${restriction}`,
        description: 'Showing only participants with this restriction',
        type: 'info'
      })
    }
  }

  return (
    <Container className="py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Participant Management Components</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive tools for managing trip participants
          </p>
        </div>

        {/* Trip Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{mockTrip.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500">Dates:</span>{' '}
                <span className="font-medium">July 15-22, 2024</span>
              </div>
              <div>
                <span className="text-gray-500">Location:</span>{' '}
                <span className="font-medium">{mockTrip.location}</span>
              </div>
              <div>
                <span className="text-gray-500">Participants:</span>{' '}
                <span className="font-medium">{participants.length}</span>
              </div>
              <Badge variant="secondary">{mockTrip.status}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="dietary">Dietary</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <ParticipantManager trip={mockTrip} />
          </TabsContent>

          <TabsContent value="profiles" className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Participant Profiles</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {participants.slice(0, 4).map(participant => (
                <ParticipantProfileCard
                  key={participant.id}
                  participant={participant as any}
                  tripStartDate={mockTrip.startDate}
                  tripEndDate={mockTrip.endDate}
                  variant="detailed"
                  onEdit={() => showToast({
                    title: `Edit ${participant.name}`,
                    description: 'Edit functionality would open here',
                    type: 'info'
                  })}
                  onRemove={() => showToast({
                    title: `Remove ${participant.name}?`,
                    description: 'Confirmation dialog would appear here',
                    type: 'warning'
                  })}
                />
              ))}
            </div>
            
            <h3 className="text-lg font-semibold mt-6 mb-4">Compact View</h3>
            <div className="space-y-2">
              {participants.map(participant => (
                <ParticipantProfileCard
                  key={participant.id}
                  participant={participant as any}
                  tripStartDate={mockTrip.startDate}
                  tripEndDate={mockTrip.endDate}
                  variant="compact"
                  showActions={false}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="dietary" className="space-y-4">
            <DietaryRestrictionsManager
              participants={participants}
              onFilterByRestriction={handleFilterByRestriction}
            />
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <ParticipantRoleManager
              participants={participants.map(p => ({
                id: p.id,
                name: p.name,
                email: p.email,
                roles: p.roles || [],
                permissions: []
              }))}
              onUpdateRoles={handleUpdateRoles}
              allowCustomRoles={true}
            />
          </TabsContent>

          <TabsContent value="invitations" className="space-y-4">
            <ParticipantInvitation
              tripId={mockTrip.id}
              tripName={mockTrip.name}
              onInviteSent={(email) => showToast({
                title: 'Invitation sent',
                description: `Sent invitation to ${email}`,
                type: 'success'
              })}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  )
}