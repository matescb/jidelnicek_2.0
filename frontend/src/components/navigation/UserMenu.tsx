import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { 
  FiUser, 
  FiSettings, 
  FiLogOut, 
  FiShield,
  FiMoon,
  FiSun
} from 'react-icons/fi';
import { useTheme } from '../../hooks/useTheme';
import { UserRole } from '../../routes/types';
import { cn } from '../../lib/utils';

interface UserMenuProps {
  user: any; // TODO: Use proper User type
}

export const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const userInitials = (user.firstName && user.lastName) 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  const isAdmin = user.role === UserRole.ADMIN;

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center rounded-full bg-primary-600 dark:bg-primary-500 text-white p-2 hover:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors">
        <span className="sr-only">{t('navigation.openUserMenu')}</span>
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
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
              {t(`roles.${user.role?.toLowerCase() || 'member'}`)}
            </span>
          </div>
          
          {/* Profile & Settings */}
          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  to="/profile"
                  className={cn(
                    'flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200',
                    active && 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  <FiUser className="mr-3 h-4 w-4 text-gray-400" />
                  {t('navigation.profile')}
                </Link>
              )}
            </Menu.Item>
            
            <Menu.Item>
              {({ active }) => (
                <Link
                  to="/settings"
                  className={cn(
                    'flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200',
                    active && 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  <FiSettings className="mr-3 h-4 w-4 text-gray-400" />
                  {t('navigation.settings')}
                </Link>
              )}
            </Menu.Item>

            {/* Admin Panel */}
            {isAdmin && (
              <Menu.Item>
                {({ active }) => (
                  <Link
                    to="/admin"
                    className={cn(
                      'flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200',
                      active && 'bg-gray-100 dark:bg-gray-700'
                    )}
                  >
                    <FiShield className="mr-3 h-4 w-4 text-gray-400" />
                    {t('navigation.adminPanel')}
                  </Link>
                )}
              </Menu.Item>
            )}
          </div>

          {/* Theme Toggle */}
          <div className="py-1 border-t border-gray-200 dark:border-gray-700">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={toggleTheme}
                  className={cn(
                    'flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200',
                    active && 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  {theme === 'dark' ? (
                    <>
                      <FiSun className="mr-3 h-4 w-4 text-gray-400" />
                      {t('navigation.lightMode')}
                    </>
                  ) : (
                    <>
                      <FiMoon className="mr-3 h-4 w-4 text-gray-400" />
                      {t('navigation.darkMode')}
                    </>
                  )}
                </button>
              )}
            </Menu.Item>
          </div>
          
          {/* Logout */}
          <div className="py-1 border-t border-gray-200 dark:border-gray-700">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={logout}
                  className={cn(
                    'flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200',
                    active && 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  <FiLogOut className="mr-3 h-4 w-4 text-gray-400" />
                  {t('auth.logout')}
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default UserMenu;