import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hooks/useAuth'

const DashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

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
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">0</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Trips</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">0</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Shopping Lists</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">0</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage