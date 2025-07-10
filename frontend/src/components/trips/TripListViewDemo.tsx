import React from 'react'
import { TripListView } from './TripListView'
import { useTripStore } from '@/store/slices/tripStore'

/**
 * Demo component showcasing the TripListView functionality
 * 
 * Features demonstrated:
 * - List and calendar view modes
 * - Advanced filtering (status, date range, participant count, search)
 * - Sorting by various fields
 * - Meal planning progress indicators
 * - Budget status visualization
 * - Quick actions (view, edit, duplicate, archive)
 * - Responsive design with mobile-optimized view
 */
export function TripListViewDemo() {
  // The TripListView component automatically connects to the trip store
  // and handles all data fetching and state management
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <TripListView
          onTripSelect={(trip) => {
            console.log('Trip selected:', trip)
            // In a real app, this would navigate to the trip detail page
            // or open a modal/drawer with trip details
          }}
        />
      </div>
    </div>
  )
}

// Example of how to use TripListView in a page component
export function TripListPage() {
  const { trips, loading, error } = useTripStore()
  
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Error loading trips: {error}</p>
      </div>
    )
  }
  
  return <TripListView />
}

// Example of programmatically interacting with the trip store
export function TripListWithCustomActions() {
  const { 
    fetchTrips, 
    setFilters, 
    setSorting,
    duplicateTrip,
    updateTrip 
  } = useTripStore()
  
  // Example: Set initial filters
  React.useEffect(() => {
    setFilters({
      status: ['active', 'planning'],
      participantCountMin: 5
    })
    setSorting('startDate', 'asc')
  }, [setFilters, setSorting])
  
  // Example: Custom trip duplication with modifications
  const handleCustomDuplicate = async (tripId: string) => {
    try {
      const newTrip = await duplicateTrip(tripId)
      // Immediately update the duplicated trip
      await updateTrip(newTrip.id, {
        name: `${newTrip.name} (Copy)`,
        status: 'planning'
      })
      // Refresh the list
      await fetchTrips()
    } catch (error) {
      console.error('Failed to duplicate trip:', error)
    }
  }
  
  return (
    <TripListView
      onTripSelect={(trip) => {
        // Custom selection handler
        if (trip.status === 'planning') {
          // Navigate to wizard for planning trips
          window.location.href = `/trips/${trip.id}/wizard`
        } else {
          // Navigate to detail view for active/completed trips
          window.location.href = `/trips/${trip.id}`
        }
      }}
    />
  )
}