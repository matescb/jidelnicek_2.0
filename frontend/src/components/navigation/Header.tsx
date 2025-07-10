import { Fragment } from 'react'
import { useAuth } from '@hooks/useAuth'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSelector } from './LanguageSelector'
import { NotificationBell } from './NotificationBell'
import { Bars3Icon, BeakerIcon } from '@heroicons/react/24/outline'
import { Menu, Transition } from '@headlessui/react'
import { Link } from 'react-router-dom'

interface HeaderProps {
  onMenuClick: () => void
  onSidebarToggle: () => void
}

export const Header = ({ onMenuClick, onSidebarToggle }: HeaderProps) => {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-gray-800 shadow">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <button
          type="button"
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onMenuClick}
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        {/* Desktop sidebar toggle */}
        <button
          type="button"
          className="hidden lg:block p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onSidebarToggle}
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        {/* Right side items */}
        <div className="flex items-center space-x-4">
          {/* Development Tools (only in dev mode) */}
          {import.meta.env.DEV && (
            <Menu as="div" className="relative">
              <Menu.Button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <BeakerIcon className="h-6 w-6" />
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
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/theme-showcase"
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } block px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                        >
                          Theme Showcase
                        </Link>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          )}
          <LanguageSelector />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}