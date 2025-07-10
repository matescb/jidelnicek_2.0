import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  Mail, 
  Download, 
  Upload, 
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Settings,
  Filter
} from 'lucide-react'
import { useTripStore } from '@/store/slices/tripStore'
import { ParticipantList } from '@/components/participants/ParticipantList'
import { ParticipantInvitation } from '@/components/trips/ParticipantInvitation'
import { ParticipantManager } from '@/components/trips/ParticipantManagerModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Container } from '@/components/layout/Container'
import { Stack } from '@/components/layout/Stack'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

// Summary Statistics Component
const ParticipantSummary: React.FC<{ trip: any }> = ({ trip }) => {
  const participants = trip.participants || []
  
  const stats = {
    total: participants.length,
    accepted: participants.filter(p => p.status === 'accepted').length,
    pending: participants.filter(p => p.status === 'pending').length,
    declined: participants.filter(p => p.status === 'declined').length,
    totalMealPortions: participants.reduce((sum, p) => sum + (p.mealCoefficient || 1), 0),
    totalSnackPortions: participants.reduce((sum, p) => sum + (p.snackCoefficient || 1), 0),
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">{stats.total}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Accepted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold">{stats.accepted}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="w-8 h-8 text-yellow-600" />
            <span className="text-2xl font-bold">{stats.pending}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Declined
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <XCircle className="w-8 h-8 text-red-600" />
            <span className="text-2xl font-bold">{stats.declined}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Meal Portions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold">{stats.totalMealPortions}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Snack Portions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-orange-600" />
            <span className="text-2xl font-bold">{stats.totalSnackPortions}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Invitation History Component
const InvitationHistory: React.FC<{ tripId: string }> = ({ tripId }) => {
  // Mock invitation history - in real app this would come from API
  const invitations = [
    { id: '1', email: 'john@example.com', status: 'sent', sentAt: '2024-01-15T10:00:00Z', respondedAt: '2024-01-15T14:30:00Z' },
    { id: '2', email: 'jane@example.com', status: 'accepted', sentAt: '2024-01-15T10:00:00Z', respondedAt: '2024-01-15T12:00:00Z' },
    { id: '3', email: 'bob@example.com', status: 'pending', sentAt: '2024-01-16T09:00:00Z', respondedAt: null },
    { id: '4', email: 'alice@example.com', status: 'declined', sentAt: '2024-01-16T09:00:00Z', respondedAt: '2024-01-16T15:00:00Z' },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>
      case 'declined':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Sent</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitation History</CardTitle>
        <CardDescription>Track all sent invitations and their status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No invitations sent yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Email</th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Sent</th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Responded</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => (
                    <tr key={invitation.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{invitation.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(invitation.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(invitation.sentAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {invitation.respondedAt ? new Date(invitation.respondedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Bulk Operations Component
const BulkOperations: React.FC<{ tripId: string }> = ({ tripId }) => {
  const { showToast } = useToast()
  const [isImporting, setIsImporting] = useState(false)
  const [importData, setImportData] = useState('')

  const handleExportParticipants = async () => {
    try {
      // In real app, this would call the export API
      showToast({
        title: 'Export started',
        description: 'Your participant list will be downloaded shortly',
        type: 'success'
      })
    } catch (error) {
      showToast({
        title: 'Export failed',
        description: 'Please try again later',
        type: 'error'
      })
    }
  }

  const handleImportParticipants = async () => {
    if (!importData.trim()) {
      showToast({
        title: 'No data to import',
        description: 'Please paste participant data first',
        type: 'error'
      })
      return
    }

    setIsImporting(true)
    try {
      // In real app, this would parse and import the data
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      showToast({
        title: 'Import successful',
        description: 'Participants have been added to the trip',
        type: 'success'
      })
      setImportData('')
    } catch (error) {
      showToast({
        title: 'Import failed',
        description: 'Please check your data format and try again',
        type: 'error'
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Participants
          </CardTitle>
          <CardDescription>Download participant list in various formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Export your participant list to share with others or for backup purposes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportParticipants}>
              Export as CSV
            </Button>
            <Button variant="outline" onClick={handleExportParticipants}>
              Export as Excel
            </Button>
            <Button variant="outline" onClick={handleExportParticipants}>
              Export as PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Participants
          </CardTitle>
          <CardDescription>Bulk add participants from a list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste participant data
            </label>
            <textarea
              className="w-full min-h-[120px] p-3 border rounded-lg text-sm font-mono"
              placeholder="Name, Email, Meal Coefficient, Snack Coefficient
John Doe, john@example.com, 1, 1
Jane Smith, jane@example.com, 0.8, 0.5"
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleImportParticipants} 
            disabled={isImporting || !importData.trim()}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Participants
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TripParticipantsPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { trips, loading, error, fetchTrip } = useTripStore()
  const { showToast } = useToast()
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const trip = trips.find(t => t.id === tripId)

  useEffect(() => {
    if (tripId && !trip) {
      fetchTrip(tripId)
    }
  }, [tripId, trip, fetchTrip])

  const handleAddParticipant = () => {
    setEditingParticipant(null)
    setIsAddModalOpen(true)
  }

  const handleEditParticipant = (participant: any) => {
    setEditingParticipant(participant)
    setIsAddModalOpen(true)
  }

  const handleInviteSent = (email: string) => {
    showToast({
      title: 'Invitation sent',
      description: `Invitation sent to ${email}`,
      type: 'success'
    })
  }

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container>
        <Alert className="max-w-2xl mx-auto mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </Container>
    )
  }

  if (!trip) {
    return (
      <Container>
        <Alert className="max-w-2xl mx-auto mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Trip not found
          </AlertDescription>
        </Alert>
      </Container>
    )
  }

  return (
    <Container>
      <Stack spacing="lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/dashboard/trips/${tripId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{trip.name} - Participants</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Manage participants and send invitations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button onClick={handleAddParticipant}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Participant
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <ParticipantSummary trip={trip} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <ParticipantList
              onAddParticipant={handleAddParticipant}
              onEditParticipant={handleEditParticipant}
            />
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6 mt-6">
            <ParticipantInvitation
              tripId={tripId!}
              tripName={trip.name}
              shareLink={trip.shareLink}
              onInviteSent={handleInviteSent}
            />
          </TabsContent>

          <TabsContent value="management" className="space-y-6 mt-6">
            <BulkOperations tripId={tripId!} />
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use bulk operations to quickly manage multiple participants at once. 
                You can export the current list, make changes offline, and import the updated data.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-6">
            <InvitationHistory tripId={tripId!} />
          </TabsContent>
        </Tabs>
      </Stack>

      {/* Add/Edit Participant Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingParticipant ? 'Edit Participant' : 'Add Participant'}
            </DialogTitle>
          </DialogHeader>
          <ParticipantManager
            tripId={tripId!}
            participant={editingParticipant}
            onClose={() => setIsAddModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Container>
  )
}