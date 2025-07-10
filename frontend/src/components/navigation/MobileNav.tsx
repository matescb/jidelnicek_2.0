import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useUIStore } from '@store/slices/uiStore'
import { useAuth } from '@hooks/useAuth'
import { navigationConfig } from '@config/navigation'
import { touchTargets } from '@styles/design-tokens'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Mobile navigation drawer component
 */
export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const location = useLocation()
  const { user } = useAuth()
  const { theme } = useUIStore()

  // Close on route change
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <Transition.Root show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          <Transition.Child
            as={React.Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
              <Transition.Child
                as={React.Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button
                    type="button"
                    className="-m-2.5 p-2.5 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                    onClick={onClose}
                    style={{ minHeight: touchTargets.minimum, minWidth: touchTargets.minimum }}
                  >
                    <span className="sr-only">Close sidebar</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </Transition.Child>
              
              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4">
                <div className="flex h-16 shrink-0 items-center">
                  <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white">
                    Jídelníček
                  </Link>
                </div>
                
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    {navigationConfig.mainNav.map((section) => (
                      <li key={section.title}>
                        <div className="text-xs font-semibold leading-6 text-gray-400">
                          {section.title}
                        </div>
                        <ul role="list" className="-mx-2 mt-2 space-y-1">
                          {section.items.map((item) => {
                            const isActive = location.pathname === item.href
                            return (
                              <li key={item.name}>
                                <Link
                                  to={item.href}
                                  className={clsx(
                                    isActive
                                      ? 'bg-gray-100 text-primary-600 dark:bg-gray-800 dark:text-primary-400'
                                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-primary-400 dark:hover:bg-gray-800',
                                    'group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-semibold transition-colors'
                                  )}
                                  style={{ minHeight: touchTargets.comfortable }}
                                >
                                  <item.icon
                                    className={clsx(
                                      isActive
                                        ? 'text-primary-600 dark:text-primary-400'
                                        : 'text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400',
                                      'h-6 w-6 shrink-0'
                                    )}
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    ))}
                    
                    {/* User section */}
                    {user && (
                      <li className="mt-auto">
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="flex items-center gap-x-4 px-2 py-3">
                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                {user.firstName?.[0] || user.email[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {user.firstName || 'User'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </nav>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}