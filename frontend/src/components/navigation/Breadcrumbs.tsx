import React from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { routeConfig } from '@/router'

export const Breadcrumbs: React.FC = () => {
  const location = useLocation()
  const params = useParams()
  const { t } = useTranslation()

  const getBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter((x) => x)
    
    const breadcrumbs = pathnames.map((_, index) => {
      const url = `/${pathnames.slice(0, index + 1).join('/')}`
      let path = url
      
      // Replace params with their actual values for display
      Object.entries(params).forEach(([key, value]) => {
        path = path.replace(`:${key}`, value as string)
      })
      
      // Get the config for the route pattern (with params)
      const configKey = Object.keys(routeConfig).find(key => {
        const pattern = key.replace(/:[^/]+/g, '[^/]+')
        const regex = new RegExp(`^${pattern}$`)
        return regex.test(url)
      })
      
      const config = configKey ? routeConfig[configKey as keyof typeof routeConfig] : null
      const label = config?.label || pathnames[index]
      
      return {
        url,
        label: t(`breadcrumbs.${label.toLowerCase()}`, label),
        isLast: index === pathnames.length - 1,
      }
    })
    
    return [
      {
        url: '/',
        label: t('breadcrumbs.home'),
        isLast: pathnames.length === 0,
      },
      ...breadcrumbs,
    ]
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.url} className="flex items-center">
            {index > 0 && (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-gray-400 mx-2" />
            )}
            {breadcrumb.isLast ? (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {breadcrumb.label}
              </span>
            ) : (
              <Link
                to={breadcrumb.url}
                className="text-sm font-medium text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
              >
                {index === 0 ? (
                  <HomeIcon className="h-4 w-4" />
                ) : (
                  breadcrumb.label
                )}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}