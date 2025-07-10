import React, { useState } from 'react'
import { UserProfile, UserProfileModal } from '@/components/participants/UserProfile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Eye, Shield } from 'lucide-react'

const UserProfileDemo: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [selectedView, setSelectedView] = useState<'own' | 'other' | 'admin'>('own')
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">User Profile Component Demo</h1>
        <p className="text-gray-600 dark:text-gray-400">
          A comprehensive user profile component with editable fields, dietary preferences, and more.
        </p>
      </div>
      
      {/* Component Features */}
      <Card>
        <CardHeader>
          <CardTitle>Component Features</CardTitle>
          <CardDescription>All the features included in the UserProfile component</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Basic Information</h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Name, email, phone</li>
                <li>• Avatar with upload</li>
                <li>• Contact address</li>
                <li>• Emergency contact</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Dietary Preferences</h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Dietary restrictions</li>
                <li>• Allergies</li>
                <li>• Meal coefficients</li>
                <li>• Additional notes</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Trip Preferences</h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Arrival/departure times</li>
                <li>• Room preferences</li>
                <li>• Transportation mode</li>
                <li>• Notification settings</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* View Options */}
      <Card>
        <CardHeader>
          <CardTitle>View Options</CardTitle>
          <CardDescription>Different permission levels for viewing profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              variant={selectedView === 'own' ? 'default' : 'outline'}
              onClick={() => setSelectedView('own')}
              className="flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Own Profile (Editable)
            </Button>
            
            <Button
              variant={selectedView === 'other' ? 'default' : 'outline'}
              onClick={() => setSelectedView('other')}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Other User's Profile (Read-only)
            </Button>
            
            <Button
              variant={selectedView === 'admin' ? 'default' : 'outline'}
              onClick={() => setSelectedView('admin')}
              className="flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Admin View (Editable)
            </Button>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedView === 'own' && "Viewing your own profile - you can edit all fields"}
              {selectedView === 'other' && "Viewing another user's profile - read-only access"}
              {selectedView === 'admin' && "Admin view - can edit any user's profile"}
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Modal Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Modal Version</CardTitle>
          <CardDescription>Quick access profile modal for use in other components</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowModal(true)}>
            Open Profile Modal
          </Button>
        </CardContent>
      </Card>
      
      {/* Profile Component */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Full Profile Component</h2>
        <UserProfile
          canEdit={selectedView === 'own' || selectedView === 'admin'}
          onSave={(data) => {
            console.log('Profile saved:', data)
          }}
        />
      </div>
      
      {/* Modal */}
      {showModal && (
        <UserProfileModal
          onClose={() => setShowModal(false)}
          canEdit={true}
          onSave={(data) => {
            console.log('Profile saved from modal:', data)
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

export default UserProfileDemo