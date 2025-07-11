import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface AdaptiveFormProps {
  children: React.ReactNode;
  className?: string;
  onSubmit?: (e: React.FormEvent) => void;
  layout?: 'vertical' | 'horizontal' | 'inline';
  mobileLayout?: 'vertical' | 'horizontal';
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-2 md:gap-3',
  md: 'gap-4 md:gap-6',
  lg: 'gap-6 md:gap-8',
};

export function AdaptiveForm({
  children,
  className,
  onSubmit,
  layout = 'vertical',
  mobileLayout = 'vertical',
  columns = 1,
  gap = 'md',
}: AdaptiveFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  const formClass = cn(
    'w-full',
    columns > 1 && 'grid',
    columns === 2 && 'md:grid-cols-2',
    columns === 3 && 'md:grid-cols-3',
    columns === 4 && 'md:grid-cols-4',
    gapClasses[gap],
    className
  );

  return (
    <form onSubmit={handleSubmit} className={formClass}>
      {children}
    </form>
  );
}

// Adaptive form field component
interface AdaptiveFormFieldProps {
  children: React.ReactNode;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  layout?: 'vertical' | 'horizontal';
  mobileLayout?: 'vertical' | 'horizontal';
  span?: 1 | 2 | 3 | 4 | 'full';
}

export function AdaptiveFormField({
  children,
  label,
  description,
  error,
  required,
  className,
  labelClassName,
  layout = 'vertical',
  mobileLayout = 'vertical',
  span = 1,
}: AdaptiveFormFieldProps) {
  const fieldClass = cn(
    'space-y-2',
    span === 'full' && 'md:col-span-full',
    span === 2 && 'md:col-span-2',
    span === 3 && 'md:col-span-3',
    span === 4 && 'md:col-span-4',
    layout === 'horizontal' && 'md:grid md:grid-cols-3 md:gap-4 md:space-y-0',
    className
  );

  const labelWrapperClass = cn(
    layout === 'horizontal' && 'md:text-right md:pt-2',
    labelClassName
  );

  const inputWrapperClass = cn(
    layout === 'horizontal' && 'md:col-span-2'
  );

  return (
    <div className={fieldClass}>
      {label && (
        <div className={labelWrapperClass}>
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
      )}
      <div className={inputWrapperClass}>
        {children}
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive mt-1">{error}</p>
        )}
      </div>
    </div>
  );
}

// Form section component
interface AdaptiveFormSectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export function AdaptiveFormSection({
  children,
  title,
  description,
  className,
  columns = 1,
  gap = 'md',
}: AdaptiveFormSectionProps) {
  const sectionClass = cn(
    'space-y-4',
    className
  );

  const fieldsClass = cn(
    columns > 1 && 'grid',
    columns === 2 && 'md:grid-cols-2',
    columns === 3 && 'md:grid-cols-3',
    columns === 4 && 'md:grid-cols-4',
    gapClasses[gap]
  );

  return (
    <div className={sectionClass}>
      {(title || description) && (
        <div className="space-y-1 pb-2">
          {title && (
            <h3 className="text-lg font-medium">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className={fieldsClass}>
        {children}
      </div>
    </div>
  );
}

// Responsive form actions component
interface AdaptiveFormActionsProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
  mobileAlign?: 'stack' | 'inline';
  sticky?: boolean;
}

const alignClasses = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  between: 'justify-between',
};

export function AdaptiveFormActions({
  children,
  className,
  align = 'right',
  mobileAlign = 'stack',
  sticky = false,
}: AdaptiveFormActionsProps) {
  const actionsClass = cn(
    'flex gap-2 pt-4',
    mobileAlign === 'stack' && 'flex-col sm:flex-row',
    alignClasses[align],
    sticky && 'sticky bottom-0 bg-background py-4 border-t mt-4 -mx-4 px-4',
    className
  );

  return (
    <div className={actionsClass}>
      {children}
    </div>
  );
}

// Input group component for related fields
interface AdaptiveInputGroupProps {
  children: React.ReactNode;
  className?: string;
  layout?: 'horizontal' | 'vertical';
  mobileLayout?: 'vertical' | 'horizontal';
  gap?: 'sm' | 'md';
}

export function AdaptiveInputGroup({
  children,
  className,
  layout = 'horizontal',
  mobileLayout = 'vertical',
  gap = 'sm',
}: AdaptiveInputGroupProps) {
  const groupClass = cn(
    'flex',
    mobileLayout === 'vertical' && 'flex-col',
    layout === 'horizontal' && 'sm:flex-row',
    gap === 'sm' ? 'gap-2' : 'gap-4',
    className
  );

  return (
    <div className={groupClass}>
      {React.Children.map(children, (child, index) => (
        <div className="flex-1 min-w-0">
          {child}
        </div>
      ))}
    </div>
  );
}

// Fieldset component for grouping related fields
interface AdaptiveFieldsetProps {
  children: React.ReactNode;
  legend?: string;
  className?: string;
  disabled?: boolean;
}

export function AdaptiveFieldset({
  children,
  legend,
  className,
  disabled = false,
}: AdaptiveFieldsetProps) {
  return (
    <fieldset
      className={cn(
        'space-y-4 p-4 border rounded-lg',
        disabled && 'opacity-50',
        className
      )}
      disabled={disabled}
    >
      {legend && (
        <legend className="text-sm font-medium px-2 -ml-2">
          {legend}
        </legend>
      )}
      {children}
    </fieldset>
  );
}