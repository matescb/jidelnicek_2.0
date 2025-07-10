import React, { useState, useEffect, useRef } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Utensils,
  AlertCircle,
  Info,
  Camera,
  Edit2,
  Save,
  X,
  Check,
  History,
  Settings,
  Bell,
  Heart,
  Home,
  Users,
  Clock,
  Shield
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Tooltip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@hooks/useAuth'
import { useToast } from '@hooks/useToast'
import type { User as UserType, TripParticipant, Trip } from '@/types'

interface UserProfileData extends UserType {
  phone?: string
  avatar?: string
  dietary?: {
    restrictions: string[]
    allergies: string[]
    preferences: string[]
    notes?: string
  }
  mealCoefficients?: {
    breakfast: number
    lunch: number
    dinner: number
    snack: number
  }
  contact?: {
    address?: string
    city?: string
    country?: string
    postalCode?: string
  }
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  tripPreferences?: {
    defaultArrivalTime?: string
    defaultDepartureTime?: string
    roomPreference?: 'single' | 'double' | 'shared'
    transportationMode?: 'car' | 'train' | 'plane' | 'bus' | 'other'
  }
  notifications?: {
    email: boolean
    push: boolean
    sms: boolean
    mealReminders: boolean
    shoppingReminders: boolean
    tripUpdates: boolean
  }
  participationHistory?: Array<{
    tripId: string
    tripName: string
    role: string
    startDate: string
    endDate: string
    status: 'completed' | 'cancelled' | 'upcoming'
  }>
}

interface UserProfileProps {
  userId?: string
  isModal?: boolean
  onClose?: () => void
  onSave?: (data: UserProfileData) => void
  canEdit?: boolean
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userId,
  isModal = false,
  onClose,
  onSave,
  canEdit: propCanEdit
}) => {
  const { user: currentUser } = useAuth()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  
  // Mock data - in real app this would come from API
  const [profileData, setProfileData] = useState<UserProfileData>({
    id: userId || currentUser?.id || '1',
    email: currentUser?.email || 'john.doe@example.com',
    firstName: currentUser?.firstName || 'John',
    lastName: currentUser?.lastName || 'Doe',
    phone: '+1 (555) 123-4567',
    avatar: '/api/placeholder/150/150',
    emailVerified: true,
    role: 'user',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-03-20T15:30:00Z',
    dietary: {
      restrictions: ['Vegetarian', 'Gluten-Free'],
      allergies: ['Nuts', 'Shellfish'],
      preferences: ['Organic', 'Low-Sodium'],
      notes: 'Prefers meals with lots of vegetables'
    },
    mealCoefficients: {
      breakfast: 0.8,
      lunch: 1.0,
      dinner: 1.2,
      snack: 0.5
    },
    contact: {
      address: '123 Main Street',
      city: 'San Francisco',
      country: 'USA',
      postalCode: '94105'
    },
    emergencyContact: {
      name: 'Jane Doe',
      phone: '+1 (555) 987-6543',
      relationship: 'Spouse'
    },
    tripPreferences: {
      defaultArrivalTime: '14:00',
      defaultDepartureTime: '11:00',
      roomPreference: 'double',
      transportationMode: 'car'
    },
    notifications: {
      email: true,
      push: true,
      sms: false,
      mealReminders: true,
      shoppingReminders: true,
      tripUpdates: true
    },
    participationHistory: [
      {
        tripId: '1',
        tripName: 'Summer Camp 2024',
        role: 'participant',
        startDate: '2024-07-01',
        endDate: '2024-07-14',
        status: 'upcoming'
      },
      {
        tripId: '2',
        tripName: 'Spring Retreat 2024',
        role: 'organizer',
        startDate: '2024-04-15',
        endDate: '2024-04-20',
        status: 'completed'
      },
      {
        tripId: '3',
        tripName: 'Winter Workshop 2024',
        role: 'participant',
        startDate: '2024-02-10',
        endDate: '2024-02-12',
        status: 'completed'
      }
    ]
  })
  
  const [editedData, setEditedData] = useState<UserProfileData>(profileData)
  
  // Determine if user can edit this profile
  const canEdit = propCanEdit !== undefined 
    ? propCanEdit 
    : currentUser?.id === profileData.id || currentUser?.role === 'admin'
  
  useEffect(() => {
    if (isEditing) {
      setEditedData(profileData)
    }
  }, [isEditing, profileData])
  
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // In real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProfileData(editedData)
      setIsEditing(false)
      setAvatarPreview(null)
      
      if (onSave) {
        onSave(editedData)
      }
      
      addToast({
        title: 'Profile Updated',
        message: 'Your profile has been successfully updated.',
        type: 'success'
      })
    } catch (error) {
      addToast({
        title: 'Update Failed',
        message: 'Failed to update profile. Please try again.',
        type: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleCancel = () => {
    setEditedData(profileData)
    setIsEditing(false)
    setAvatarPreview(null)
  }
  
  const updateField = (path: string, value: any) => {
    setEditedData(prev => {
      const newData = { ...prev }
      const keys = path.split('.')
      let current: any = newData
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newData
    })
  }
  
  const ProfileContent = () => (
    <div className="space-y-6">
      {/* Header with Avatar and Actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              {(avatarPreview || profileData.avatar) ? (
                <img
                  src={avatarPreview || profileData.avatar}
                  alt={`${profileData.firstName} ${profileData.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            {isEditing && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full p-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4" />
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold">
              {profileData.firstName} {profileData.lastName}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">{profileData.email}</p>
            <div className="flex items-center gap-2 mt-2">
              {profileData.emailVerified && (
                <Badge variant="success" className="text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Member since {format(parseISO(profileData.createdAt), 'MMM yyyy')}
              </Badge>
            </div>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="dietary">Dietary</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  {isEditing ? (
                    <Input
                      id="firstName"
                      value={editedData.firstName || ''}
                      onChange={(e) => updateField('firstName', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.firstName}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  {isEditing ? (
                    <Input
                      id="lastName"
                      value={editedData.lastName || ''}
                      onChange={(e) => updateField('lastName', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.lastName}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={editedData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {profileData.email}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      type="tel"
                      value={editedData.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {profileData.phone || 'Not provided'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Contact Information
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  {isEditing ? (
                    <Input
                      id="address"
                      value={editedData.contact?.address || ''}
                      onChange={(e) => updateField('contact.address', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.contact?.address || 'Not provided'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="city">City</Label>
                  {isEditing ? (
                    <Input
                      id="city"
                      value={editedData.contact?.city || ''}
                      onChange={(e) => updateField('contact.city', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.contact?.city || 'Not provided'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  {isEditing ? (
                    <Input
                      id="postalCode"
                      value={editedData.contact?.postalCode || ''}
                      onChange={(e) => updateField('contact.postalCode', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.contact?.postalCode || 'Not provided'}</p>
                  )}
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="country">Country</Label>
                  {isEditing ? (
                    <Input
                      id="country"
                      value={editedData.contact?.country || ''}
                      onChange={(e) => updateField('contact.country', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.contact?.country || 'Not provided'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Emergency Contact
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyName">Contact Name</Label>
                  {isEditing ? (
                    <Input
                      id="emergencyName"
                      value={editedData.emergencyContact?.name || ''}
                      onChange={(e) => updateField('emergencyContact.name', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.emergencyContact?.name || 'Not provided'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="emergencyPhone">Contact Phone</Label>
                  {isEditing ? (
                    <Input
                      id="emergencyPhone"
                      type="tel"
                      value={editedData.emergencyContact?.phone || ''}
                      onChange={(e) => updateField('emergencyContact.phone', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.emergencyContact?.phone || 'Not provided'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="emergencyRelationship">Relationship</Label>
                  {isEditing ? (
                    <Input
                      id="emergencyRelationship"
                      value={editedData.emergencyContact?.relationship || ''}
                      onChange={(e) => updateField('emergencyContact.relationship', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.emergencyContact?.relationship || 'Not provided'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Dietary Tab */}
        <TabsContent value="dietary" className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Dietary Restrictions & Allergies
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Dietary Restrictions</Label>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Kosher'].map(restriction => (
                        <label key={restriction} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editedData.dietary?.restrictions.includes(restriction)}
                            onChange={(e) => {
                              const restrictions = editedData.dietary?.restrictions || []
                              if (e.target.checked) {
                                updateField('dietary.restrictions', [...restrictions, restriction])
                              } else {
                                updateField('dietary.restrictions', restrictions.filter(r => r !== restriction))
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{restriction}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profileData.dietary?.restrictions.map(restriction => (
                      <Badge key={restriction} variant="secondary">
                        {restriction}
                      </Badge>
                    )) || <span className="text-sm text-gray-500">None specified</span>}
                  </div>
                )}
              </div>
              
              <div>
                <Label>Allergies</Label>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {['Nuts', 'Shellfish', 'Eggs', 'Dairy', 'Soy', 'Wheat'].map(allergy => (
                        <label key={allergy} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editedData.dietary?.allergies.includes(allergy)}
                            onChange={(e) => {
                              const allergies = editedData.dietary?.allergies || []
                              if (e.target.checked) {
                                updateField('dietary.allergies', [...allergies, allergy])
                              } else {
                                updateField('dietary.allergies', allergies.filter(a => a !== allergy))
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{allergy}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profileData.dietary?.allergies.map(allergy => (
                      <Badge key={allergy} variant="destructive">
                        {allergy}
                      </Badge>
                    )) || <span className="text-sm text-gray-500">None specified</span>}
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="dietaryNotes">Additional Notes</Label>
                {isEditing ? (
                  <Textarea
                    id="dietaryNotes"
                    value={editedData.dietary?.notes || ''}
                    onChange={(e) => updateField('dietary.notes', e.target.value)}
                    placeholder="Any additional dietary information..."
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-2 text-sm">{profileData.dietary?.notes || 'No additional notes'}</p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                Meal Coefficients
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(profileData.mealCoefficients || {}).map(([meal, value]) => (
                <div key={meal}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="capitalize">{meal}</Label>
                    <span className="text-sm font-medium">{isEditing ? editedData.mealCoefficients?.[meal as keyof typeof editedData.mealCoefficients] || 0 : value}</span>
                  </div>
                  {isEditing ? (
                    <Slider
                      value={[editedData.mealCoefficients?.[meal as keyof typeof editedData.mealCoefficients] || 0]}
                      onValueChange={([val]) => updateField(`mealCoefficients.${meal}`, val)}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  ) : (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(value / 2) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Daily Coefficient</span>
                  <span className="text-lg font-semibold">
                    {(Object.values(isEditing ? editedData.mealCoefficients || {} : profileData.mealCoefficients || {})
                      .reduce((sum, val) => sum + val, 0)).toFixed(1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Trip Preferences
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="arrivalTime">Default Arrival Time</Label>
                  {isEditing ? (
                    <Input
                      id="arrivalTime"
                      type="time"
                      value={editedData.tripPreferences?.defaultArrivalTime || ''}
                      onChange={(e) => updateField('tripPreferences.defaultArrivalTime', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.tripPreferences?.defaultArrivalTime || 'Not set'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="departureTime">Default Departure Time</Label>
                  {isEditing ? (
                    <Input
                      id="departureTime"
                      type="time"
                      value={editedData.tripPreferences?.defaultDepartureTime || ''}
                      onChange={(e) => updateField('tripPreferences.defaultDepartureTime', e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{profileData.tripPreferences?.defaultDepartureTime || 'Not set'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="roomPreference">Room Preference</Label>
                  {isEditing ? (
                    <Select
                      value={editedData.tripPreferences?.roomPreference || ''}
                      onValueChange={(value) => updateField('tripPreferences.roomPreference', value)}
                    >
                      <SelectTrigger id="roomPreference">
                        <SelectValue placeholder="Select preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single Room</SelectItem>
                        <SelectItem value="double">Double Room</SelectItem>
                        <SelectItem value="shared">Shared Room</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-sm capitalize">{profileData.tripPreferences?.roomPreference || 'Not set'}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="transportation">Transportation Mode</Label>
                  {isEditing ? (
                    <Select
                      value={editedData.tripPreferences?.transportationMode || ''}
                      onValueChange={(value) => updateField('tripPreferences.transportationMode', value)}
                    >
                      <SelectTrigger id="transportation">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="train">Train</SelectItem>
                        <SelectItem value="plane">Plane</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-sm capitalize">{profileData.tripPreferences?.transportationMode || 'Not set'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email Notifications', icon: Mail },
                  { key: 'push', label: 'Push Notifications', icon: Bell },
                  { key: 'sms', label: 'SMS Notifications', icon: Phone },
                  { key: 'mealReminders', label: 'Meal Reminders', icon: Utensils },
                  { key: 'shoppingReminders', label: 'Shopping Reminders', icon: Info },
                  { key: 'tripUpdates', label: 'Trip Updates', icon: Calendar }
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-500" />
                      <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                    </div>
                    {isEditing ? (
                      <Switch
                        id={key}
                        checked={editedData.notifications?.[key as keyof typeof editedData.notifications] || false}
                        onCheckedChange={(checked) => updateField(`notifications.${key}`, checked)}
                      />
                    ) : (
                      <Badge variant={profileData.notifications?.[key as keyof typeof profileData.notifications] ? 'default' : 'outline'}>
                        {profileData.notifications?.[key as keyof typeof profileData.notifications] ? 'On' : 'Off'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5" />
                Participation History
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profileData.participationHistory?.map((trip, index) => (
                  <div
                    key={trip.tripId}
                    className={cn(
                      "p-4 rounded-lg border",
                      trip.status === 'upcoming' && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
                      trip.status === 'completed' && "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900",
                      trip.status === 'cancelled' && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{trip.tripName}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {format(parseISO(trip.startDate), 'MMM d')} - {format(parseISO(trip.endDate), 'MMM d, yyyy')}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            {trip.role}
                          </Badge>
                          <Badge
                            variant={
                              trip.status === 'upcoming' ? 'default' :
                              trip.status === 'completed' ? 'secondary' :
                              'destructive'
                            }
                            className="text-xs"
                          >
                            {trip.status}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
                
                {(!profileData.participationHistory || profileData.participationHistory.length === 0) && (
                  <p className="text-center text-gray-500 py-8">
                    No trip history available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
  
  if (isModal) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <ProfileContent />
        </DialogContent>
      </Dialog>
    )
  }
  
  return <ProfileContent />
}

// Export a modal version for quick access
export const UserProfileModal: React.FC<Omit<UserProfileProps, 'isModal'>> = (props) => {
  return <UserProfile {...props} isModal />
}