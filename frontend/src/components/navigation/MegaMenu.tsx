import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiTrendingUp, FiStar, FiClock } from 'react-icons/fi';
import { useNavigation } from './NavigationContext';
import { cn } from '../../lib/utils';

interface MegaMenuItem {
  title: string;
  description?: string;
  items: {
    label: string;
    path: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
  featured?: {
    title: string;
    description: string;
    image?: string;
    link: string;
    badge?: string;
  };
}

interface MegaMenuProps {
  items: Record<string, MegaMenuItem>;
  activeSection: string | null;
}

export const MegaMenu: React.FC<MegaMenuProps> = ({ items, activeSection }) => {
  const { t } = useTranslation();
  const { closeMegaMenu } = useNavigation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMegaMenu();
      }
    };

    if (activeSection) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeSection, closeMegaMenu]);

  const menuItem = activeSection ? items[activeSection] : null;

  return (
    <AnimatePresence>
      {activeSection && menuItem && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute left-0 right-0 top-full mt-2 z-50 hidden lg:block"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-12 gap-8 p-8">
                {/* Main Navigation Items */}
                <div className="col-span-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {menuItem.title}
                  </h3>
                  {menuItem.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      {menuItem.description}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-6">
                    {menuItem.items.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={index}
                          to={item.path}
                          onClick={closeMegaMenu}
                          className="group flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          {Icon && (
                            <Icon className="h-6 w-6 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                {item.label}
                              </p>
                              {item.badge && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Featured Section */}
                {menuItem.featured && (
                  <div className="col-span-4">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('navigation.featured')}
                      </h4>
                      
                      <Link
                        to={menuItem.featured.link}
                        onClick={closeMegaMenu}
                        className="block group"
                      >
                        {menuItem.featured.image && (
                          <div className="aspect-w-16 aspect-h-9 mb-4 rounded-md overflow-hidden">
                            <img
                              src={menuItem.featured.image}
                              alt={menuItem.featured.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        
                        <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2">
                          {menuItem.featured.title}
                        </h5>
                        
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                          {menuItem.featured.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                            {t('common.learnMore')}
                          </span>
                          <FiArrowRight className="h-4 w-4 text-primary-600 dark:text-primary-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </Link>

                      {/* Quick Stats */}
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <FiTrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('navigation.trending')}
                            </p>
                          </div>
                          <div>
                            <FiStar className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('navigation.popular')}
                            </p>
                          </div>
                          <div>
                            <FiClock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('navigation.recent')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Bar */}
              <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-8 py-4">
                <div className="flex items-center justify-between">
                  <Link
                    to={`/${activeSection}`}
                    onClick={closeMegaMenu}
                    className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    {t('navigation.viewAll', { section: menuItem.title })}
                  </Link>
                  <button
                    onClick={closeMegaMenu}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    {t('common.close')} (ESC)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Example mega menu configuration
export const megaMenuConfig: Record<string, MegaMenuItem> = {
  recipes: {
    title: 'Recipes',
    description: 'Discover delicious recipes for every occasion',
    items: [
      {
        label: 'Browse All',
        path: '/recipes',
        description: 'Explore our complete recipe collection',
      },
      {
        label: 'Categories',
        path: '/recipes/categories',
        description: 'Find recipes by cuisine or meal type',
      },
      {
        label: 'Quick & Easy',
        path: '/recipes/quick',
        description: '30-minute meals and simple recipes',
        badge: 'Popular',
      },
      {
        label: 'Healthy Options',
        path: '/recipes/healthy',
        description: 'Nutritious and balanced meals',
      },
    ],
    featured: {
      title: 'Recipe of the Day',
      description: 'Try our chef-selected daily special',
      image: '/images/featured-recipe.jpg',
      link: '/recipes/featured',
    },
  },
  shopping: {
    title: 'Shopping Lists',
    description: 'Organize your grocery shopping efficiently',
    items: [
      {
        label: 'My Lists',
        path: '/shopping/lists',
        description: 'View and manage your shopping lists',
      },
      {
        label: 'Shared Lists',
        path: '/shopping/shared',
        description: 'Collaborate with family and friends',
      },
      {
        label: 'Templates',
        path: '/shopping/templates',
        description: 'Pre-made lists for common needs',
      },
      {
        label: 'Store Locator',
        path: '/shopping/stores',
        description: 'Find nearby grocery stores',
      },
    ],
  },
};