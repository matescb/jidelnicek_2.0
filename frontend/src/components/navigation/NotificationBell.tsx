import React from 'react'
import { BellIcon } from '@heroicons/react/24/outline'

export const NotificationBell: React.FC = () => {
  const hasNotifications = false // TODO: Implement notification system

  return (
    <button
      className="relative p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      aria-label="View notifications"
    >
      <BellIcon className="h-5 w-5" />
      {hasNotifications && (
        <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800" />
      )}
    </button>
  )
}