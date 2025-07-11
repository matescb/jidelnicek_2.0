import React, { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FiX,
  FiHome,
  FiBook,
  FiMapPin,
  FiShoppingCart,
  FiPackage,
  FiCalendar,
  FiUser,
  FiSettings,
  FiLogOut,
  FiChevronRight
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationItems, routeGroups } from '../../routes/config';
import { UserRole } from '../../routes/types';
import { QuickActions } from './QuickActions';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../../lib/utils';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();

  // Close menu on route change
  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  const userRole = user?.role as UserRole | undefined;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
              <Transition.Child
                as={Fragment}
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
                    className="-m-2.5 p-2.5"
                    onClick={onClose}
                  >
                    <span className="sr-only">{t('navigation.closeMenu')}</span>
                    <FiX className="h-6 w-6 text-white" aria-hidden="true" />
                  </button>
                </div>
              </Transition.Child>

              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4">
                {/* Header */}
                <div className="flex h-16 shrink-0 items-center">
                  <h2 className="text-xl font-bold text-primary-600 dark:text-primary-400">
                    Jídelníček
                  </h2>
                </div>

                {/* User Profile */}
                {user && (
                  <div className="flex items-center space-x-3 px-2 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white font-medium">
                      {user.firstName && user.lastName 
                        ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                        : user.email.substring(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.email
                        }
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(`roles.${user.role?.toLowerCase() || 'member'}`)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="px-2">
                  <QuickActions orientation="horizontal" showLabels={true} />
                </div>

                {/* Navigation */}
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    {routeGroups.map((group) => {
                      // Filter groups by user role
                      if (group.roles && userRole && !group.roles.includes(userRole)) {
                        return null;
                      }

                      const navItems = getNavigationItems(group.routes, userRole);
                      if (navItems.length === 0) return null;

                      return (
                        <li key={group.id}>
                          <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                            {t(`navigation.groups.${group.id}`, group.label)}
                          </div>
                          <ul role="list" className="-mx-2 mt-2 space-y-1">
                            {navItems.map((item) => {
                              const isActive = location.pathname === item.path || 
                                             location.pathname.startsWith(item.path + '/');
                              const Icon = item.icon || FiChevronRight;

                              return (
                                <li key={item.id}>
                                  <Link
                                    to={item.path}
                                    className={cn(
                                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium',
                                      isActive
                                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    )}
                                  >
                                    <Icon
                                      className={cn(
                                        'h-6 w-6 shrink-0',
                                        isActive 
                                          ? 'text-primary-600 dark:text-primary-400' 
                                          : 'text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                                      )}
                                      aria-hidden="true"
                                    />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge && (
                                      <span className={cn(
                                        'ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                        item.badgeVariant === 'warning' 
                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                      )}>
                                        {item.badge}
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}

                    {/* User Menu Items */}
                    <li className="mt-auto">
                      <ul role="list" className="-mx-2 space-y-1">
                        <li>
                          <Link
                            to="/profile"
                            className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <FiUser className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                            {t('navigation.profile')}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/settings"
                            className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <FiSettings className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                            {t('navigation.settings')}
                          </Link>
                        </li>
                        <li>
                          <div className="flex items-center justify-between px-2 py-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              {t('navigation.theme')}
                            </span>
                            <ThemeToggle />
                          </div>
                        </li>
                        {user && (
                          <li>
                            <button
                              onClick={handleLogout}
                              className="w-full group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <FiLogOut className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                              {t('auth.logout')}
                            </button>
                          </li>
                        )}
                      </ul>
                    </li>
                  </ul>
                </nav>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default MobileMenu;