# UserProfile Component

A comprehensive user profile component with editable fields, dietary preferences, meal coefficients, and more.

## Features

### Basic Information
- Personal details (name, email, phone)
- Avatar with upload functionality
- Email verification status
- Member since date

### Contact Information
- Physical address
- Emergency contact details

### Dietary Preferences
- Dietary restrictions (Vegetarian, Vegan, Gluten-Free, etc.)
- Allergies tracking
- Meal coefficients (breakfast, lunch, dinner, snack)
- Additional dietary notes

### Trip Preferences
- Default arrival/departure times
- Room preferences (single, double, shared)
- Transportation mode preferences

### Notification Settings
- Email notifications
- Push notifications
- SMS notifications
- Meal reminders
- Shopping reminders
- Trip updates

### Participation History
- List of past and upcoming trips
- Role in each trip
- Trip status tracking

## Usage

### Basic Usage

```tsx
import { UserProfile } from '@/components/participants/UserProfile'

function ProfilePage() {
  return (
    <UserProfile
      userId="123"
      canEdit={true}
      onSave={(data) => {
        console.log('Profile saved:', data)
      }}
    />
  )
}
```

### Modal Version

```tsx
import { UserProfileModal } from '@/components/participants/UserProfile'

function SomeComponent() {
  const [showProfile, setShowProfile] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowProfile(true)}>
        View Profile
      </button>
      
      {showProfile && (
        <UserProfileModal
          userId="123"
          onClose={() => setShowProfile(false)}
          canEdit={true}
          onSave={(data) => {
            console.log('Profile saved:', data)
            setShowProfile(false)
          }}
        />
      )}
    </>
  )
}
```

## Props

### UserProfile Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userId` | `string` | Current user ID | ID of the user to display |
| `isModal` | `boolean` | `false` | Whether to render as a modal |
| `onClose` | `() => void` | - | Callback when modal is closed |
| `onSave` | `(data: UserProfileData) => void` | - | Callback when profile is saved |
| `canEdit` | `boolean` | Auto-determined | Whether the profile can be edited |

## Permissions

The component automatically determines edit permissions based on:
- If viewing own profile (current user ID matches profile ID)
- If user has admin role
- Or explicitly set via `canEdit` prop

## Edit Mode

In edit mode, users can:
- Upload a new avatar image
- Edit all personal information fields
- Toggle dietary restrictions and allergies
- Adjust meal coefficients with sliders
- Update contact and emergency information
- Configure trip preferences
- Manage notification settings

## Validation

The component includes validation for:
- Email format
- Phone number format
- Required fields (name, email)
- Meal coefficients (0-2 range)

## Responsive Design

The component is fully responsive:
- Stacks fields vertically on mobile
- Uses grid layout on larger screens
- Tabs adapt to screen size
- Modal adjusts to viewport

## Data Structure

```typescript
interface UserProfileData {
  id: string
  email: string
  firstName?: string
  lastName?: string
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
```

## Styling

The component uses:
- Tailwind CSS for styling
- Dark mode support
- Consistent color scheme
- Smooth transitions and animations

## Accessibility

- Proper ARIA labels
- Keyboard navigation support
- Focus management
- Screen reader friendly

## Future Enhancements

- Integration with real API endpoints
- Image cropping for avatar upload
- Social media profile links
- Multi-language support for dietary restrictions
- Export profile data
- Profile privacy settings