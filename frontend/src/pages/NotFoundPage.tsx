import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-9xl font-bold text-primary-600 dark:text-primary-400">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-4">
          {t('notFound.title', 'Page Not Found')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {t('notFound.message', 'The page you are looking for doesn\'t exist or has been moved.')}
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          {t('notFound.backHome', 'Go Back Home')}
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage