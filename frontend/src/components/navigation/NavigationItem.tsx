import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FiChevronDown, FiExternalLink } from 'react-icons/fi';
import { cn } from '../../lib/utils';

interface NavigationItemProps {
  item: {
    id: string;
    label: string;
    path: string;
    icon?: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeVariant?: 'default' | 'primary' | 'warning' | 'danger' | 'success';
    children?: NavigationItemProps['item'][];
    external?: boolean;
  };
  isOpen: boolean;
  currentPath: string;
  level?: number;
}

export const NavigationItem: React.FC<NavigationItemProps> = ({ 
  item, 
  isOpen, 
  currentPath,
  level = 0 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const getBadgeClasses = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'danger':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  const linkContent = (
    <>
      {Icon && (
        <Icon 
          className={cn(
            'h-5 w-5 flex-shrink-0 transition-colors',
            isActive 
              ? 'text-primary-600 dark:text-primary-400' 
              : 'text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'
          )} 
        />
      )}
      <span className={cn(
        'flex-1 transition-opacity duration-300',
        isOpen ? 'opacity-100 ml-3' : 'opacity-0 w-0 overflow-hidden'
      )}>
        {item.label}
      </span>
      {isOpen && (
        <>
          {item.badge && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              getBadgeClasses(item.badgeVariant)
            )}>
              {item.badge}
            </span>
          )}
          {item.external && (
            <FiExternalLink className="h-4 w-4 text-gray-400" />
          )}
          {hasChildren && (
            <FiChevronDown 
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          )}
        </>
      )}
    </>
  );

  const linkClasses = cn(
    'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
    level > 0 && 'ml-4',
    isActive
      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
  );

  return (
    <>
      {item.external ? (
        <a
          href={item.path}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
        >
          {linkContent}
        </a>
      ) : hasChildren ? (
        <button
          onClick={handleClick}
          className={`${linkClasses} w-full`}
        >
          {linkContent}
        </button>
      ) : (
        <NavLink
          to={item.path}
          className={({ isActive }) => cn(
            linkClasses,
            isActive && 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
          )}
        >
          {linkContent}
        </NavLink>
      )}

      {/* Nested Items */}
      {hasChildren && isExpanded && isOpen && (
        <div className="space-y-1 mt-1">
          {item.children.map((child) => (
            <NavigationItem
              key={child.id}
              item={child}
              isOpen={isOpen}
              currentPath={currentPath}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default NavigationItem;