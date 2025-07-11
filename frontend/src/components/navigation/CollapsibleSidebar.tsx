import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiMenu,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationItems, routeGroups } from '../../routes/config';
import { UserRole } from '../../routes/types';
import { NavigationItem } from './NavigationItem';
import { QuickActions } from './QuickActions';
import { cn } from '../../lib/utils';
import { useScreenSize } from './NavigationContext';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  miniMode?: boolean;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isOpen,
  onToggle,
  miniMode = false,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['main']);
  const [touchStart, setTouchStart] = useState(0);
  const controls = useAnimation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet } = useScreenSize();

  const userRole = user?.role as UserRole | undefined;

  // Handle swipe gestures on mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      setTouchStart(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEnd = e.changedTouches[0].clientX;
      const swipeDistance = touchEnd - touchStart;

      if (swipeDistance > 100 && !isOpen) {
        onToggle();
      } else if (swipeDistance < -100 && isOpen) {
        onToggle();
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, isOpen, onToggle, isMobile]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Responsive width based on mode
  const getWidth = () => {
    if (miniMode || isTablet) {
      return isOpen ? 'w-64' : 'w-20';
    }
    return isOpen ? 'w-64' : 'w-20';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <motion.div
        ref={sidebarRef}
        animate={controls}
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 shadow-lg',
          'transition-all duration-300 transform',
          'flex flex-col',
          getWidth(),
          isMobile && !isOpen && '-translate-x-full',
          !isMobile && 'translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          <motion.h2
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'font-bold text-xl text-primary-600 dark:text-primary-400',
              !isOpen && 'sr-only'
            )}
          >
            Jídelníček
          </motion.h2>
          
          <button
            onClick={onToggle}
            className={cn(
              'p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label={isOpen ? t('navigation.collapseSidebar') : t('navigation.expandSidebar')}
          >
            {isOpen ? (
              <FiChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <FiMenu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* User Profile Section */}
        <AnimatePresence>
          {user && isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-4 border-b border-gray-200 dark:border-gray-800"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white font-medium">
                  {user.firstName && user.lastName
                    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                    : user.email.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {t(`roles.${user.role?.toLowerCase() || 'member'}`)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          {routeGroups.map((group) => {
            if (group.roles && userRole && !group.roles.includes(userRole)) {
              return null;
            }

            const navItems = getNavigationItems(group.routes, userRole);
            if (navItems.length === 0) return null;

            const isGroupExpanded = expandedGroups.includes(group.id);

            return (
              <div key={group.id} className="space-y-1">
                {isOpen ? (
                  <>
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    >
                      <span className="flex items-center">
                        {group.icon && <group.icon className="mr-2 h-4 w-4" />}
                        {t(`navigation.groups.${group.id}`, group.label)}
                      </span>
                      <FiChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isGroupExpanded && 'rotate-180'
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {isGroupExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1"
                        >
                          {navItems.map((item) => (
                            <NavigationItem
                              key={item.id}
                              item={item}
                              isOpen={isOpen}
                              currentPath={location.pathname}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  // Mini mode - show icons only
                  <div className="space-y-1">
                    {navItems.slice(0, 3).map((item) => (
                      <NavigationItem
                        key={item.id}
                        item={item}
                        isOpen={isOpen}
                        currentPath={location.pathname}
                        miniMode
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 border-t border-gray-200 dark:border-gray-800"
            >
              <QuickActions orientation="vertical" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resize Handle for Desktop */}
        {!isMobile && !isTablet && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-primary-500/20 transition-colors"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = sidebarRef.current?.offsetWidth || 0;

              const handleMouseMove = (e: MouseEvent) => {
                const newWidth = startWidth + (e.clientX - startX);
                if (newWidth > 200 && newWidth < 400 && sidebarRef.current) {
                  sidebarRef.current.style.width = `${newWidth}px`;
                }
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        )}
      </motion.div>
    </>
  );
};