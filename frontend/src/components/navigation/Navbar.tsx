import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FiMenu, 
  FiX, 
  FiSearch,
  FiPlus,
  FiBook,
  FiMapPin
} from 'react-icons/fi';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { QuickActions } from './QuickActions';
import { PATHS } from '../../routes/paths';
import { cn } from '../../lib/utils';

interface NavbarProps {
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuToggle, isMobileMenuOpen }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navigationLinks = [
    { name: t('navigation.dashboard'), href: PATHS.DASHBOARD, icon: null },
    { name: t('navigation.recipes'), href: PATHS.RECIPES.LIST, icon: FiBook },
    { name: t('navigation.trips'), href: PATHS.TRIPS.LIST, icon: FiMapPin },
  ];

  const isActiveLink = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <button
              onClick={onMenuToggle}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">
                {isMobileMenuOpen ? t('navigation.closeMenu') : t('navigation.openMenu')}
              </span>
              {isMobileMenuOpen ? (
                <FiX className="h-6 w-6" />
              ) : (
                <FiMenu className="h-6 w-6" />
              )}
            </button>

            <Link to={PATHS.DASHBOARD} className="flex items-center ml-2 lg:ml-0">
              <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
                Jídelníček
              </h1>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex lg:items-center lg:ml-10 lg:space-x-4">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActiveLink(link.href)
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {link.icon && <link.icon className="mr-2 h-4 w-4" />}
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Search Bar */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <input
                    type="text"
                    placeholder={t('navigation.search')}
                    className="w-48 sm:w-64 px-4 py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                    onBlur={() => setIsSearchOpen(false)}
                  />
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={t('navigation.search')}
                >
                  <FiSearch className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Quick Actions - Desktop only */}
            {user && (
              <div className="hidden sm:block">
                <QuickActions />
              </div>
            )}

            {/* Notifications */}
            {user && <NotificationBell />}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;