import React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  HomeIcon, 
  BookOpenIcon, 
  MapIcon, 
  UserIcon, 
  CogIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const navigation = [
  { name: 'dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'recipes', href: '/dashboard/recipes', icon: BookOpenIcon },
  { name: 'trips', href: '/dashboard/trips', icon: MapIcon },
  { name: 'profile', href: '/dashboard/profile', icon: UserIcon },
  { name: 'settings', href: '/dashboard/settings', icon: CogIcon },
]

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { t } = useTranslation()

  return (
    <div
      className={clsx(
        'fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 transform lg:translate-x-0',
        isOpen ? 'w-64' : 'w-20',
        'hidden lg:block'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          <h2 className={clsx(
            'font-bold text-xl text-primary-600 dark:text-primary-400 transition-opacity',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}>
            Jídelníček
          </h2>
          <button
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isOpen ? (
              <ChevronLeftIcon className="h-5 w-5" />
            ) : (
              <ChevronRightIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )
              }
            >
              <item.icon className="h-6 w-6 flex-shrink-0" />
              <span className={clsx(
                'ml-3 transition-opacity',
                isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              )}>
                {t(`navigation.${item.name}`)}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}