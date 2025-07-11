import React, { useMemo } from 'react';
import { HomeIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { BreadcrumbItem, BreadcrumbEllipsis } from './BreadcrumbItem';
import { useBreadcrumbs } from './hooks';
import { truncateBreadcrumbs } from './utils';
import { BreadcrumbConfig } from './types';

interface BreadcrumbsProps extends Partial<BreadcrumbConfig> {
  className?: string;
  itemClassName?: string;
  linkClassName?: string;
  activeClassName?: string;
  separatorClassName?: string;
  mobileMaxItems?: number;
  desktopMaxItems?: number;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  className,
  itemClassName,
  linkClassName,
  activeClassName,
  separatorClassName,
  separator,
  showHome = true,
  maxItems,
  mobileMaxItems = 2,
  desktopMaxItems = 5,
  truncateMode = 'middle',
}) => {
  const breadcrumbs = useBreadcrumbs();

  // Process breadcrumbs
  const processedBreadcrumbs = useMemo(() => {
    let items = [...breadcrumbs];

    // Add home icon to first breadcrumb if it's home
    if (items.length > 0 && items[0].path === '/') {
      items[0] = {
        ...items[0],
        icon: <HomeIcon className="h-4 w-4" />,
        label: showHome ? 'Home' : '',
      };
    }

    return items;
  }, [breadcrumbs, showHome]);

  // Truncate breadcrumbs for different screen sizes
  const truncatedDesktop = useMemo(() => {
    const max = maxItems || desktopMaxItems;
    return truncateBreadcrumbs(processedBreadcrumbs, max, truncateMode);
  }, [processedBreadcrumbs, maxItems, desktopMaxItems, truncateMode]);

  const truncatedMobile = useMemo(() => {
    return truncateBreadcrumbs(processedBreadcrumbs, mobileMaxItems, 'end');
  }, [processedBreadcrumbs, mobileMaxItems]);

  if (processedBreadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex', className)}>
      {/* Mobile breadcrumbs */}
      <ol className="flex items-center space-x-1 md:hidden">
        {truncatedMobile.map((breadcrumb, index) => {
          const isLast = index === truncatedMobile.length - 1;
          
          if (breadcrumb.id === 'ellipsis') {
            return (
              <BreadcrumbEllipsis
                key={breadcrumb.id}
                separator={separator}
                separatorClassName={separatorClassName}
              />
            );
          }

          return (
            <BreadcrumbItem
              key={breadcrumb.id}
              label={breadcrumb.label}
              path={breadcrumb.path}
              icon={breadcrumb.icon}
              isActive={breadcrumb.isActive}
              isLast={isLast}
              separator={separator}
              className={itemClassName}
              linkClassName={linkClassName}
              activeClassName={activeClassName}
              separatorClassName={separatorClassName}
            />
          );
        })}
      </ol>

      {/* Desktop breadcrumbs */}
      <ol className="hidden md:flex items-center space-x-1">
        {truncatedDesktop.map((breadcrumb, index) => {
          const isLast = index === truncatedDesktop.length - 1;
          
          if (breadcrumb.id === 'ellipsis') {
            return (
              <BreadcrumbEllipsis
                key={breadcrumb.id}
                separator={separator}
                separatorClassName={separatorClassName}
              />
            );
          }

          return (
            <BreadcrumbItem
              key={breadcrumb.id}
              label={breadcrumb.label}
              path={breadcrumb.path}
              icon={breadcrumb.icon}
              isActive={breadcrumb.isActive}
              isLast={isLast}
              separator={separator}
              className={itemClassName}
              linkClassName={linkClassName}
              activeClassName={activeClassName}
              separatorClassName={separatorClassName}
            />
          );
        })}
      </ol>
    </nav>
  );
};

// Simple breadcrumb component without context (for standalone use)
export const SimpleBreadcrumbs: React.FC<{
  items: Array<{ label: string; path?: string; icon?: React.ReactNode }>;
  className?: string;
  separator?: React.ReactNode;
}> = ({ items, className, separator }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex', className)}>
      <ol className="flex items-center space-x-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <BreadcrumbItem
              key={`${item.path}-${index}`}
              label={item.label}
              path={item.path}
              icon={item.icon}
              isActive={isLast}
              isLast={isLast}
              separator={separator}
            />
          );
        })}
      </ol>
    </nav>
  );
};