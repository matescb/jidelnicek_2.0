import { useAuth } from '@hooks/useAuth'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSelector } from './LanguageSelector'
import { NotificationBell } from './NotificationBell'
import { Bars3Icon } from '@heroicons/react/24/outline'

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
          <LanguageSelector />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}