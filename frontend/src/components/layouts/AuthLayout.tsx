import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const AuthLayout: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400">
              Jídelníček
            </h1>
          </Link>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('auth.tagline')}
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}