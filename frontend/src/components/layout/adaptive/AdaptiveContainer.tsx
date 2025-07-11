import React from 'react';
import { cn } from '@/lib/utils';

interface AdaptiveContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'fluid' | 'fixed' | 'full';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  center?: boolean;
  safeArea?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  '7xl': 'max-w-7xl',
};

const paddingClasses = {
  none: '',
  sm: 'px-4 md:px-6 lg:px-8',
  md: 'px-6 md:px-8 lg:px-12',
  lg: 'px-8 md:px-12 lg:px-16',
};

export function AdaptiveContainer({
  children,
  className,
  variant = 'fixed',
  maxWidth = 'xl',
  padding = 'md',
  center = true,
  safeArea = true,
}: AdaptiveContainerProps) {
  return (
    <div
      className={cn(
        'w-full',
        variant === 'fluid' && 'min-w-0',
        variant === 'fixed' && maxWidthClasses[maxWidth],
        variant !== 'full' && center && 'mx-auto',
        paddingClasses[padding],
        safeArea && 'safe-area-inset-x',
        className
      )}
    >
      {children}
    </div>
  );
}

// Responsive section container
interface AdaptiveSectionProps extends AdaptiveContainerProps {
  as?: 'div' | 'section' | 'article' | 'main';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const spacingClasses = {
  none: '',
  sm: 'py-4 md:py-6 lg:py-8',
  md: 'py-6 md:py-8 lg:py-12',
  lg: 'py-8 md:py-12 lg:py-16',
};

export function AdaptiveSection({
  as: Component = 'section',
  spacing = 'md',
  children,
  className,
  ...containerProps
}: AdaptiveSectionProps) {
  return (
    <Component className={cn(spacingClasses[spacing], className)}>
      <AdaptiveContainer {...containerProps}>{children}</AdaptiveContainer>
    </Component>
  );
}

// Responsive grid container
interface AdaptiveGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-2 md:gap-3 lg:gap-4',
  md: 'gap-3 md:gap-4 lg:gap-6',
  lg: 'gap-4 md:gap-6 lg:gap-8',
};

export function AdaptiveGrid({
  children,
  className,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
}: AdaptiveGridProps) {
  const gridCols = cn(
    'grid',
    columns.mobile === 1 && 'grid-cols-1',
    columns.mobile === 2 && 'grid-cols-2',
    columns.tablet === 2 && 'md:grid-cols-2',
    columns.tablet === 3 && 'md:grid-cols-3',
    columns.tablet === 4 && 'md:grid-cols-4',
    columns.desktop === 2 && 'lg:grid-cols-2',
    columns.desktop === 3 && 'lg:grid-cols-3',
    columns.desktop === 4 && 'lg:grid-cols-4',
    columns.desktop === 5 && 'lg:grid-cols-5',
    columns.desktop === 6 && 'lg:grid-cols-6'
  );

  return (
    <div className={cn(gridCols, gapClasses[gap], className)}>
      {children}
    </div>
  );
}