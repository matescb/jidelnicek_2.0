import React from 'react'
import { NutritionCalculator } from './NutritionCalculator'
import { Trip } from '../../types'

/**
 * Example of how to integrate NutritionCalculator into a trip detail page
 */
export const NutritionCalculatorIntegration: React.FC<{ trip: Trip }> = ({ trip }) => {
  return (
    <div className="space-y-6">
      {/* Other trip details components */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">{trip.name}</h2>
        <p className="text-gray-600 mb-4">{trip.description}</p>
        {/* Trip info, participants, etc. */}
      </div>

      {/* Nutrition Calculator Section */}
      <NutritionCalculator 
        trip={trip} 
        className="bg-white rounded-lg shadow"
      />

      {/* Other components like shopping list, meal planning board, etc. */}
    </div>
  )
}

/**
 * Example of using NutritionCalculator with real-time updates
 */
export const NutritionCalculatorWithRealtimeUpdates: React.FC = () => {
  const [trip, setTrip] = React.useState<Trip | null>(null)
  
  // In a real app, you would:
  // 1. Fetch trip data from API
  // 2. Subscribe to WebSocket updates
  // 3. Update trip data when meals change
  
  React.useEffect(() => {
    // Example: Fetch trip data
    // fetchTrip(tripId).then(setTrip)
    
    // Example: Subscribe to WebSocket updates
    // const unsubscribe = subscribeToTripUpdates(tripId, (update) => {
    //   if (update.type === 'meal-assignment-change') {
    //     // Refetch trip or update specific meal
    //     fetchTrip(tripId).then(setTrip)
    //   }
    // })
    
    // return () => unsubscribe()
  }, [])
  
  if (!trip) {
    return <div>Loading...</div>
  }
  
  return <NutritionCalculator trip={trip} />
}

/**
 * Example of customizing NutritionCalculator with specific goals
 */
export const NutritionCalculatorWithCustomGoals: React.FC<{ trip: Trip }> = ({ trip }) => {
  // You could fetch participant-specific goals from the backend
  // or allow users to set their own goals
  
  return (
    <NutritionCalculator 
      trip={trip}
      className="bg-white rounded-lg shadow"
      // In the future, you could add props like:
      // customGoals={participantGoals}
      // onGoalChange={handleGoalChange}
      // hideVitamins={false}
      // defaultTab="goals"
    />
  )
}