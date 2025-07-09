import React, { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hooks/useAuth'
import { User } from '@/types'
import clsx from 'clsx'

interface UserMenuProps {
  user: User | null
}

export const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const { t } = useTranslation()
  const { logout } = useAuth()

  if (!user) return null

  const userInitials = (user.firstName && user.lastName) 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user.email.substring(0, 2).toUpperCase()

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center rounded-full bg-primary-600 text-white p-2 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
        <span className="sr-only">Open user menu</span>
        <span className="h-8 w-8 flex items-center justify-center text-sm font-medium">
          {userInitials}
        </span>
      </Menu.Button>
      
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
          
          <Menu.Item>
            {({ active }) => (
              <Link
                to="/dashboard/profile"
                className={clsx(
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                )}
              >
                {t('navigation.profile')}
              </Link>
            )}
          </Menu.Item>
          
          <Menu.Item>
            {({ active }) => (
              <Link
                to="/dashboard/settings"
                className={clsx(
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                )}
              >
                {t('navigation.settings')}
              </Link>
            )}
          </Menu.Item>
          
          <div className="border-t border-gray-200 dark:border-gray-700">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={logout}
                  className={clsx(
                    active ? 'bg-gray-100 dark:bg-gray-700' : '',
                    'block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                  )}
                >
                  {t('auth.logout')}
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}