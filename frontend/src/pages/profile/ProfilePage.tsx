import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hooks/useAuth'

const ProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.profile')}
      </h1>
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Profile Information
          </h2>
          {user && (
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.email}</dd>
              </div>
              {user.firstName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.firstName}</dd>
                </div>
              )}
              {user.lastName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.lastName}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Verified</dt>
                <dd className="mt-1">
                  {user.emailVerified ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Unverified
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfilePage