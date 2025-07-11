import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiBook, FiMapPin, FiShoppingCart } from 'react-icons/fi';
import { Menu, Transition } from '@headlessui/react';
import { PATHS } from '../../routes/paths';
import { cn } from '../../lib/utils';

interface QuickActionsProps {
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ 
  orientation = 'horizontal',
  showLabels = false 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const actions = [
    {
      id: 'create-trip',
      label: t('quickActions.createTrip'),
      icon: FiMapPin,
      path: PATHS.TRIPS.CREATE,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800',
    },
    {
      id: 'add-recipe',
      label: t('quickActions.addRecipe'),
      icon: FiBook,
      path: PATHS.RECIPES.CREATE,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800',
    },
    {
      id: 'shopping-list',
      label: t('quickActions.generateShoppingList'),
      icon: FiShoppingCart,
      path: PATHS.SHOPPING.LISTS,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800',
    },
  ];

  const handleAction = (path: string) => {
    navigate(path);
  };

  if (orientation === 'vertical') {
    return (
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.path)}
            className={cn(
              'w-full flex items-center space-x-3 px-4 py-2 rounded-md',
              'transition-colors duration-200',
              action.bgColor,
              action.color
            )}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  if (showLabels) {
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.path)}
            className={cn(
              'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium',
              'transition-colors duration-200',
              action.bgColor,
              action.color
            )}
          >
            <action.icon className="h-4 w-4" />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default: Dropdown menu
  return (
    <Menu as="div" className="relative">
      <Menu.Button className="p-2 rounded-md bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors">
        <FiPlus className="h-5 w-5" />
        <span className="sr-only">{t('quickActions.title')}</span>
      </Menu.Button>

      <Transition
        as={React.Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {actions.map((action) => (
              <Menu.Item key={action.id}>
                {({ active }) => (
                  <button
                    onClick={() => handleAction(action.path)}
                    className={cn(
                      'flex items-center w-full px-4 py-2 text-sm',
                      'text-gray-700 dark:text-gray-200',
                      active && 'bg-gray-100 dark:bg-gray-700'
                    )}
                  >
                    <action.icon className={`mr-3 h-5 w-5 ${action.color}`} />
                    {action.label}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default QuickActions;