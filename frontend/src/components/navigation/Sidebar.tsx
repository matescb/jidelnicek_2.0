import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FiHome,
  FiBook,
  FiMapPin,
  FiShoppingCart,
  FiPackage,
  FiCalendar,
  FiUser,
  FiSettings,
  FiShield,
  FiUsers,
  FiAlertCircle,
  FiBarChart2,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiActivity
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationItems, routeGroups } from '../../routes/config';
import { UserRole } from '../../routes/types';
import { QuickActions } from './QuickActions';
import { NavigationItem } from './NavigationItem';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['main']);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const userRole = user?.role as UserRole | undefined;

  return (
    <div
      className={cn(
        'fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-900 shadow-lg',
        'transition-all duration-300 transform lg:translate-x-0',
        'hidden lg:flex lg:flex-col',
        isOpen ? 'w-64' : 'w-20'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className={cn(
          'font-bold text-xl text-primary-600 dark:text-primary-400',
          'transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
        )}>
          Jídelníček
        </h2>
        <button
          onClick={onToggle}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isOpen ? t('navigation.collapseSidebar') : t('navigation.expandSidebar')}
        >
          {isOpen ? (
            <FiChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <FiChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>

      {/* User Profile Section */}
      {user && isOpen && (
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
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
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {t(`roles.${user.role?.toLowerCase() || 'member'}`)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        {routeGroups.map((group) => {
          // Filter groups by user role
          if (group.roles && userRole && !group.roles.includes(userRole)) {
            return null;
          }

          const navItems = getNavigationItems(group.routes, userRole);
          if (navItems.length === 0) return null;

          const isGroupExpanded = expandedGroups.includes(group.id);

          return (
            <div key={group.id} className="space-y-1">
              {isOpen && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                >
                  <span className="flex items-center">
                    {group.icon && <group.icon className="mr-2 h-4 w-4" />}
                    {t(`navigation.groups.${group.id}`, group.label)}
                  </span>
                  <FiChevronDown 
                    className={cn('h-4 w-4 transition-transform', isGroupExpanded && 'rotate-180')} 
                  />
                </button>
              )}

              {(isGroupExpanded || !isOpen) && (
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <NavigationItem
                      key={item.id}
                      item={item}
                      isOpen={isOpen}
                      currentPath={location.pathname}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Development Routes */}
        {process.env.NODE_ENV === 'development' && (
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <NavigationItem
              item={{
                id: 'examples',
                label: t('navigation.examples'),
                path: '/examples',
                icon: FiActivity,
                badge: 'Dev',
                badgeVariant: 'default'
              }}
              isOpen={isOpen}
              currentPath={location.pathname}
            />
          </div>
        )}
      </nav>

      {/* Quick Actions */}
      {isOpen && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <QuickActions orientation="vertical" />
        </div>
      )}
    </div>
  );
};

export default Sidebar;