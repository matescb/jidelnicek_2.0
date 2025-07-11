import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AdaptiveHeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  image?: {
    src: string;
    alt: string;
  };
  actions?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'centered' | 'split' | 'background';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'center' | 'right';
  mobileAlign?: 'left' | 'center' | 'right';
  overlay?: boolean;
}

const sizeClasses = {
  sm: 'py-8 md:py-12 lg:py-16',
  md: 'py-12 md:py-16 lg:py-24',
  lg: 'py-16 md:py-24 lg:py-32',
  xl: 'py-24 md:py-32 lg:py-48',
};

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function AdaptiveHero({
  title,
  subtitle,
  description,
  image,
  actions,
  className,
  variant = 'default',
  size = 'md',
  align = 'left',
  mobileAlign = 'center',
  overlay = false,
}: AdaptiveHeroProps) {
  const containerClass = cn(
    'relative overflow-hidden',
    sizeClasses[size],
    className
  );

  const contentClass = cn(
    'container mx-auto px-4 md:px-6 lg:px-8',
    variant === 'centered' && 'max-w-3xl',
    variant === 'split' && 'grid md:grid-cols-2 gap-8 items-center'
  );

  const textClass = cn(
    alignClasses[mobileAlign],
    `md:${alignClasses[align]}`,
    variant === 'centered' && 'mx-auto'
  );

  // Background image variant
  if (variant === 'background' && image) {
    return (
      <div
        className={containerClass}
        style={{
          backgroundImage: `url(${image.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {overlay && (
          <div className="absolute inset-0 bg-black/50" />
        )}
        <div className={cn(contentClass, 'relative z-10')}>
          <div className={cn(textClass, 'text-white')}>
            {subtitle && (
              <p className="text-sm uppercase tracking-wider mb-2 opacity-90">
                {subtitle}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4">
              {title}
            </h1>
            {description && (
              <p className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl">
                {description}
              </p>
            )}
            {actions && (
              <div className={cn(
                'flex gap-4',
                mobileAlign === 'center' && 'justify-center',
                align === 'center' && 'md:justify-center',
                mobileAlign === 'right' && 'justify-end',
                align === 'right' && 'md:justify-end'
              )}>
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Split variant
  if (variant === 'split' && image) {
    return (
      <div className={containerClass}>
        <div className={contentClass}>
          <div className={cn(textClass, 'order-2 md:order-1')}>
            {subtitle && (
              <p className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
                {subtitle}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              {title}
            </h1>
            {description && (
              <p className="text-lg text-muted-foreground mb-8 max-w-xl">
                {description}
              </p>
            )}
            {actions && (
              <div className={cn(
                'flex gap-4',
                mobileAlign === 'center' && 'justify-center',
                align === 'center' && 'md:justify-center',
                mobileAlign === 'right' && 'justify-end',
                align === 'right' && 'md:justify-end'
              )}>
                {actions}
              </div>
            )}
          </div>
          <div className="order-1 md:order-2">
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-auto rounded-lg shadow-xl"
            />
          </div>
        </div>
      </div>
    );
  }

  // Default and centered variants
  return (
    <div className={containerClass}>
      <div className={contentClass}>
        <div className={textClass}>
          {subtitle && (
            <p className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
              {subtitle}
            </p>
          )}
          <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4">
            {title}
          </h1>
          {description && (
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
              {description}
            </p>
          )}
          {actions && (
            <div className={cn(
              'flex gap-4 flex-col sm:flex-row',
              mobileAlign === 'center' && 'items-center',
              align === 'center' && 'sm:justify-center',
              mobileAlign === 'right' && 'items-end',
              align === 'right' && 'sm:justify-end'
            )}>
              {actions}
            </div>
          )}
        </div>
        {image && variant === 'default' && (
          <div className="mt-8 md:mt-12">
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-auto rounded-lg shadow-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Feature hero with icon grid
interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface AdaptiveFeatureHeroProps extends Omit<AdaptiveHeroProps, 'image'> {
  features: Feature[];
  featuresLayout?: 'grid' | 'row';
}

export function AdaptiveFeatureHero({
  features,
  featuresLayout = 'grid',
  ...heroProps
}: AdaptiveFeatureHeroProps) {
  const featuresClass = cn(
    'mt-12 md:mt-16',
    featuresLayout === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8',
    featuresLayout === 'row' && 'flex flex-col md:flex-row gap-6 md:gap-8 justify-center'
  );

  return (
    <div>
      <AdaptiveHero {...heroProps} />
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className={featuresClass}>
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                'text-center',
                featuresLayout === 'row' && 'flex-1 max-w-xs'
              )}
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// CTA Hero section
interface AdaptiveCTAHeroProps {
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'bordered';
}

export function AdaptiveCTAHero({
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  size = 'md',
  variant = 'default',
}: AdaptiveCTAHeroProps) {
  const containerClass = cn(
    'rounded-lg',
    size === 'sm' && 'p-6 md:p-8',
    size === 'md' && 'p-8 md:p-12',
    size === 'lg' && 'p-12 md:p-16',
    variant === 'default' && 'bg-muted',
    variant === 'gradient' && 'bg-gradient-to-r from-primary/10 to-primary/5',
    variant === 'bordered' && 'border-2 border-primary',
    className
  );

  return (
    <div className={containerClass}>
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
          {title}
        </h2>
        {description && (
          <p className="text-lg text-muted-foreground mb-8">
            {description}
          </p>
        )}
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {primaryAction && (
              <Button
                size="lg"
                variant={primaryAction.variant || 'default'}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                size="lg"
                variant="outline"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}