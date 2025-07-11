import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AdaptiveSidebarProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  className?: string;
  sidebarClassName?: string;
  contentClassName?: string;
  side?: 'left' | 'right';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  overlay?: boolean;
  breakpoint?: 'sm' | 'md' | 'lg';
  width?: 'narrow' | 'medium' | 'wide';
  mobileFullScreen?: boolean;
}

const widthClasses = {
  narrow: 'w-48 lg:w-56',
  medium: 'w-56 lg:w-64',
  wide: 'w-64 lg:w-80',
};

const breakpointClasses = {
  sm: 'sm:flex',
  md: 'md:flex',
  lg: 'lg:flex',
};

export function AdaptiveSidebar({
  children,
  sidebar,
  className,
  sidebarClassName,
  contentClassName,
  side = 'left',
  collapsible = true,
  defaultCollapsed = false,
  overlay = false,
  breakpoint = 'lg',
  width = 'medium',
  mobileFullScreen = false,
}: AdaptiveSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Mobile drawer version
  const mobileDrawer = (
    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('fixed top-4 z-40', side === 'left' ? 'left-4' : 'right-4', breakpointClasses[breakpoint].replace('flex', 'hidden'))}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={side}
        className={cn(
          'p-0',
          mobileFullScreen ? 'w-full max-w-none' : widthClasses[width],
          sidebarClassName
        )}
      >
        <div className="h-full overflow-y-auto">
          {sidebar}
        </div>
      </SheetContent>
    </Sheet>
  );

  // Desktop sidebar version
  const desktopSidebar = (
    <aside
      className={cn(
        'hidden',
        breakpointClasses[breakpoint],
        'flex-col',
        'transition-all duration-300',
        !overlay && (isCollapsed ? 'w-16' : widthClasses[width]),
        overlay && 'fixed inset-y-0 z-30',
        overlay && !isCollapsed && widthClasses[width],
        overlay && isCollapsed && 'w-0',
        side === 'right' && 'order-2',
        sidebarClassName
      )}
    >
      {collapsible && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'absolute top-4 z-10',
            side === 'left' ? '-right-4' : '-left-4',
            'bg-background border shadow-sm'
          )}
        >
          {side === 'left' ? (
            isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          ) : (
            isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      )}
      
      <div className={cn('h-full overflow-y-auto', isCollapsed && 'hidden')}>
        {sidebar}
      </div>
    </aside>
  );

  return (
    <>
      {mobileDrawer}
      <div
        className={cn(
          'flex h-full',
          side === 'right' && 'flex-row-reverse',
          className
        )}
      >
        {desktopSidebar}
        <main
          className={cn(
            'flex-1 min-w-0',
            !overlay && !isCollapsed && `${breakpoint}:pr-4`,
            contentClassName
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}

// Fixed sidebar layout with header
interface AdaptiveSidebarLayoutProps extends AdaptiveSidebarProps {
  header?: React.ReactNode;
  headerClassName?: string;
}

export function AdaptiveSidebarLayout({
  header,
  headerClassName,
  children,
  sidebar,
  ...props
}: AdaptiveSidebarLayoutProps) {
  return (
    <div className="flex h-screen flex-col">
      {header && (
        <header className={cn('flex-shrink-0', headerClassName)}>
          {header}
        </header>
      )}
      <div className="flex-1 overflow-hidden">
        <AdaptiveSidebar sidebar={sidebar} {...props}>
          {children}
        </AdaptiveSidebar>
      </div>
    </div>
  );
}

// Navigation sidebar component
interface NavItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  children?: NavItem[];
}

interface AdaptiveNavSidebarProps {
  items: NavItem[];
  className?: string;
  itemClassName?: string;
  activeClassName?: string;
  onItemClick?: (item: NavItem) => void;
}

export function AdaptiveNavSidebar({
  items,
  className,
  itemClassName,
  activeClassName,
  onItemClick,
}: AdaptiveNavSidebarProps) {
  const renderNavItem = (item: NavItem, depth = 0) => {
    const handleClick = () => {
      if (item.onClick) {
        item.onClick();
      }
      if (onItemClick) {
        onItemClick(item);
      }
    };

    return (
      <div key={item.label}>
        <button
          onClick={handleClick}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            depth > 0 && 'pl-8',
            item.active && (activeClassName || 'bg-accent text-accent-foreground'),
            itemClassName
          )}
        >
          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
          <span className="flex-1 text-left">{item.label}</span>
        </button>
        {item.children && (
          <div className="ml-4">
            {item.children.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={cn('py-4', className)}>
      {items.map((item) => renderNavItem(item))}
    </nav>
  );
}