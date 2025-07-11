import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FiHome,
  FiBook,
  FiShoppingCart,
  FiCalendar,
  FiUser,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useNavigation } from './NavigationContext';

interface BottomNavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const bottomNavItems: BottomNavItem[] = [
  {
    id: 'home',
    label: 'navigation.home',
    path: '/',
    icon: FiHome,
  },
  {
    id: 'recipes',
    label: 'navigation.recipes',
    path: '/recipes',
    icon: FiBook,
  },
  {
    id: 'shopping',
    label: 'navigation.shopping',
    path: '/shopping',
    icon: FiShoppingCart,
  },
  {
    id: 'meal-plans',
    label: 'navigation.mealPlans',
    path: '/meal-plans',
    icon: FiCalendar,
  },
  {
    id: 'profile',
    label: 'navigation.profile',
    path: '/profile',
    icon: FiUser,
  },
];

export const MobileBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isScrolled } = useNavigation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800',
        'safe-area-bottom', // For iPhone notch
        isScrolled && 'shadow-lg'
      )}
    >
      <div className="grid grid-cols-5 h-16">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 px-1',
                'transition-all duration-200',
                'touch-manipulation', // Better touch response
                active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              )}
            >
              {/* Active Indicator */}
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-primary-600 dark:bg-primary-400 rounded-b-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {/* Icon with touch feedback */}
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-all duration-200',
                    active && 'scale-110'
                  )}
                />
                
                {/* Notification dot example */}
                {item.id === 'shopping' && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium transition-all duration-200',
                  active ? 'opacity-100' : 'opacity-70'
                )}
              >
                {t(item.label)}
              </span>

              {/* Touch ripple effect */}
              <span className="absolute inset-0 rounded-lg bg-gray-200 dark:bg-gray-700 opacity-0 transition-opacity active:opacity-20" />
            </Link>
          );
        })}
      </div>

      {/* iOS safe area padding */}
      <div className="h-safe-area-inset-bottom bg-white dark:bg-gray-900" />
    </motion.nav>
  );
};

// Gesture-enhanced version with swipe support
export const MobileBottomNavWithGestures: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [startX, setStartX] = React.useState(0);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const activeIndex = bottomNavItems.findIndex(item => {
      if (item.path === '/') {
        return location.pathname === '/';
      }
      return location.pathname.startsWith(item.path);
    });
    if (activeIndex !== -1) {
      setCurrentIndex(activeIndex);
    }
  }, [location.pathname]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < bottomNavItems.length - 1) {
        // Swipe left - go to next
        window.location.href = bottomNavItems[currentIndex + 1].path;
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - go to previous
        window.location.href = bottomNavItems[currentIndex - 1].path;
      }
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <MobileBottomNav />
    </nav>
  );
};