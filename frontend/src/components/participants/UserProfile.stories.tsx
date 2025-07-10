import type { Meta, StoryObj } from '@storybook/react'
import { UserProfile, UserProfileModal } from './UserProfile'
import { useState } from 'react'

const meta = {
  title: 'Components/Participants/UserProfile',
  component: UserProfile,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof UserProfile>

export default meta
type Story = StoryObj<typeof meta>

export const OwnProfile: Story = {
  args: {
    canEdit: true,
    onSave: (data) => {
      console.log('Profile saved:', data)
    },
  },
}

export const OtherUserProfile: Story = {
  args: {
    userId: '2',
    canEdit: false,
  },
}

export const AdminView: Story = {
  args: {
    userId: '3',
    canEdit: true,
    onSave: (data) => {
      console.log('Admin saved profile:', data)
    },
  },
}

export const ModalVersion: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)
    
    return (
      <div>
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Open Profile Modal
        </button>
        
        {isOpen && (
          <UserProfileModal
            onClose={() => setIsOpen(false)}
            canEdit={true}
            onSave={(data) => {
              console.log('Profile saved from modal:', data)
              setIsOpen(false)
            }}
          />
        )}
      </div>
    )
  },
}

export const WithMinimalData: Story = {
  args: {
    userId: '4',
    canEdit: true,
  },
  parameters: {
    mockData: {
      user: {
        id: '4',
        email: 'minimal@example.com',
        firstName: 'Minimal',
        lastName: 'User',
        emailVerified: false,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  },
}

export const WithFullData: Story = {
  args: {
    userId: '5',
    canEdit: true,
  },
  parameters: {
    mockData: {
      user: {
        id: '5',
        email: 'full@example.com',
        firstName: 'Full',
        lastName: 'User',
        phone: '+1 (555) 123-4567',
        avatar: '/api/placeholder/150/150',
        emailVerified: true,
        role: 'user',
        createdAt: '2023-01-15T10:00:00Z',
        updatedAt: '2024-03-20T15:30:00Z',
        dietary: {
          restrictions: ['Vegetarian', 'Gluten-Free', 'Dairy-Free'],
          allergies: ['Nuts', 'Shellfish', 'Eggs'],
          preferences: ['Organic', 'Low-Sodium', 'High-Protein'],
          notes: 'Prefers Mediterranean cuisine. No spicy food.',
        },
        mealCoefficients: {
          breakfast: 1.0,
          lunch: 1.2,
          dinner: 1.5,
          snack: 0.8,
        },
        contact: {
          address: '456 Oak Avenue, Apt 12B',
          city: 'New York',
          country: 'USA',
          postalCode: '10001',
        },
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '+1 (555) 987-6543',
          relationship: 'Parent',
        },
        tripPreferences: {
          defaultArrivalTime: '15:00',
          defaultDepartureTime: '10:00',
          roomPreference: 'single',
          transportationMode: 'train',
        },
        notifications: {
          email: true,
          push: true,
          sms: true,
          mealReminders: true,
          shoppingReminders: false,
          tripUpdates: true,
        },
        participationHistory: [
          {
            tripId: '1',
            tripName: 'Summer Camp 2024',
            role: 'participant',
            startDate: '2024-07-01',
            endDate: '2024-07-14',
            status: 'upcoming',
          },
          {
            tripId: '2',
            tripName: 'Spring Retreat 2024',
            role: 'organizer',
            startDate: '2024-04-15',
            endDate: '2024-04-20',
            status: 'completed',
          },
          {
            tripId: '3',
            tripName: 'Winter Workshop 2024',
            role: 'participant',
            startDate: '2024-02-10',
            endDate: '2024-02-12',
            status: 'completed',
          },
          {
            tripId: '4',
            tripName: 'Fall Festival 2023',
            role: 'participant',
            startDate: '2023-10-20',
            endDate: '2023-10-22',
            status: 'cancelled',
          },
        ],
      },
    },
  },
}

export const Mobile: Story = {
  args: {
    canEdit: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export const Tablet: Story = {
  args: {
    canEdit: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
}