import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface BreadcrumbItemProps {
  label: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  isLast?: boolean;
  separator?: ReactNode;
  className?: string;
  linkClassName?: string;
  activeClassName?: string;
  separatorClassName?: string;
  onClick?: () => void;
}

export const BreadcrumbItem: React.FC<BreadcrumbItemProps> = ({
  label,
  path,
  icon,
  isActive = false,
  isLast = false,
  separator = <ChevronRightIcon className="h-4 w-4" />,
  className,
  linkClassName,
  activeClassName,
  separatorClassName,
  onClick,
}) => {
  const content = (
    <>
      {icon && <span className="mr-1.5">{icon}</span>}
      <span className="truncate">{label}</span>
    </>
  );

  const baseClasses = 'inline-flex items-center text-sm font-medium';
  
  const linkClasses = cn(
    baseClasses,
    'transition-colors hover:text-primary-600 dark:hover:text-primary-400',
    'text-gray-700 dark:text-gray-300',
    linkClassName
  );

  const activeClasses = cn(
    baseClasses,
    'text-gray-500 dark:text-gray-400',
    'cursor-default',
    activeClassName
  );

  return (
    <li className={cn('flex items-center', className)}>
      {isActive || !path ? (
        <span className={activeClasses} aria-current={isActive ? 'page' : undefined}>
          {content}
        </span>
      ) : (
        <Link to={path} className={linkClasses} onClick={onClick}>
          {content}
        </Link>
      )}
      
      {!isLast && separator && (
        <span
          className={cn(
            'mx-2 text-gray-400 dark:text-gray-600',
            separatorClassName
          )}
          aria-hidden="true"
        >
          {separator}
        </span>
      )}
    </li>
  );
};

// Breadcrumb ellipsis component for truncated breadcrumbs
export const BreadcrumbEllipsis: React.FC<{
  separator?: ReactNode;
  className?: string;
  separatorClassName?: string;
}> = ({ separator, className, separatorClassName }) => {
  return (
    <li className={cn('flex items-center', className)}>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        ...
      </span>
      {separator && (
        <span
          className={cn(
            'mx-2 text-gray-400 dark:text-gray-600',
            separatorClassName
          )}
          aria-hidden="true"
        >
          {separator}
        </span>
      )}
    </li>
  );
};