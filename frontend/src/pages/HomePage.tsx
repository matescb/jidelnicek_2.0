import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hooks/useAuth'

const HomePage: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            {t('home.title', 'Welcome to Jídelníček')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            {t('home.subtitle', 'Plan your meals, manage recipes, and organize trips with our comprehensive meal planning solution.')}
          </p>
          <div className="space-x-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                {t('home.goToDashboard', 'Go to Dashboard')}
              </Link>
            ) : (
              <>
                <Link
                  to="/auth/register"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  {t('home.getStarted', 'Get Started')}
                </Link>
                <Link
                  to="/auth/login"
                  className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('home.login', 'Login')}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('home.features.recipes.title', 'Recipe Management')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('home.features.recipes.description', 'Create, organize, and share your favorite recipes with nutritional calculations.')}
            </p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('home.features.trips.title', 'Trip Planning')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('home.features.trips.description', 'Plan meals for trips with participant management and automatic scaling.')}
            </p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('home.features.shopping.title', 'Shopping Lists')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('home.features.shopping.description', 'Generate intelligent shopping lists with automatic ingredient aggregation.')}
            </p>
          </div>
        </div>

        {/* Development Links */}
        {import.meta.env.DEV && (
          <div className="mt-16 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Development Tools
            </h3>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link
                to="/theme-showcase"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Theme Showcase
              </Link>
              <Link
                to="/animation-showcase"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Animation Showcase
              </Link>
              <Link
                to="/user-profile-demo"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                User Profile Demo
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage