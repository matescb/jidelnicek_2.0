import React from 'react'
import { useTranslation } from 'react-i18next'

const SettingsPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.settings')}
      </h1>
      <div className="card">
        <div className="card-body">
          <p className="text-gray-600 dark:text-gray-400">Settings page - Coming soon</p>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage