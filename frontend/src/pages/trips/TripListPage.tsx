import React from 'react'
import { useTranslation } from 'react-i18next'

const TripListPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.trips')}
      </h1>
      <p className="text-gray-600 dark:text-gray-400">Trip list page - Coming soon</p>
    </div>
  )
}

export default TripListPage