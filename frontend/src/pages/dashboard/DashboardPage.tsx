import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import { useTripStore } from '@/store/slices/tripStore'
import { CalculationSummary } from '@/components/dashboard'

const DashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { trips, fetchTrips, loading } = useTripStore()
  const [activeTrip, setActiveTrip] = useState<string>()

  // Fetch trips on mount
  useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  // Set the first active trip as default
  useEffect(() => {
    const activeTripFound = trips.find(trip => trip.status === 'active')
    if (activeTripFound && !activeTrip) {
      setActiveTrip(activeTripFound.id)
    }
  }, [trips, activeTrip])

  const handleMetricClick = (metric: 'cost' | 'nutrition' | 'shopping') => {
    if (!activeTrip) return
    
    switch(metric) {
      case 'cost':
        navigate(`/trips/${activeTrip}#cost`)
        break
      case 'nutrition':
        navigate(`/trips/${activeTrip}#nutrition`)
        break
      case 'shopping':
        navigate(`/trips/${activeTrip}#shopping`)
        break
    }
  }

  const recipeCount = 0 // TODO: Get from recipe store
  const activeTripCount = trips.filter(trip => trip.status === 'active').length
  const shoppingListCount = trips.filter(trip => trip.status === 'active').length

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.dashboard')}
      </h1>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Welcome Card */}
        <div className="card col-span-full lg:col-span-2">
          <div className="card-body">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Welcome back, {user?.firstName || user?.email}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Ready to plan your next meal adventure? Start by browsing recipes or creating a new trip.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Recipes</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{recipeCount}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Trips</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{activeTripCount}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Shopping Lists</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{shoppingListCount}</p>
          </div>
        </div>

        {/* Calculation Summary Widget */}
        <div className="col-span-full">
          <CalculationSummary 
            tripId={activeTrip}
            onMetricClick={handleMetricClick}
          />
        </div>
      </div>
    </div>
  )
}

export default DashboardPage