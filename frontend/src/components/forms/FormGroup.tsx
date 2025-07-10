import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormContext } from 'react-hook-form';

interface FormGroupProps {
  /**
   * Group title
   */
  title?: string;
  /**
   * Group description
   */
  description?: string;
  /**
   * Children components (form fields)
   */
  children: React.ReactNode;
  /**
   * Whether the group is collapsible
   */
  collapsible?: boolean;
  /**
   * Default collapsed state
   */
  defaultCollapsed?: boolean;
  /**
   * Show border around group
   */
  bordered?: boolean;
  /**
   * Background variant
   */
  variant?: 'default' | 'filled' | 'elevated';
  /**
   * Spacing size
   */
  spacing?: 'sm' | 'md' | 'lg';
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Show separator line between fields
   */
  separated?: boolean;
  /**
   * Conditional rendering based on form values
   */
  showIf?: (values: any) => boolean;
  /**
   * Icon component
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Show error indicator if any field in group has error
   */
  showErrorIndicator?: boolean;
  /**
   * Columns for grid layout
   */
  columns?: 1 | 2 | 3 | 4;
  /**
   * Custom header actions
   */
  headerActions?: React.ReactNode;
}

const spacingClasses = {
  sm: 'space-y-3',
  md: 'space-y-4',
  lg: 'space-y-6',
};

const variantClasses = {
  default: '',
  filled: 'bg-gray-50 dark:bg-gray-800/50',
  elevated: 'bg-white dark:bg-gray-900 shadow-sm',
};

export const FormGroup: React.FC<FormGroupProps> = ({
  title,
  description,
  children,
  collapsible = false,
  defaultCollapsed = false,
  bordered = false,
  variant = 'default',
  spacing = 'md',
  className,
  separated = false,
  showIf,
  icon: Icon,
  showErrorIndicator = true,
  columns = 1,
  headerActions,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const formContext = useFormContext();
  
  // Check if should show based on condition
  if (showIf && formContext) {
    const values = formContext.watch();
    if (!showIf(values)) {
      return null;
    }
  }

  // Check for errors in group fields
  const hasErrors = showErrorIndicator && formContext && Object.keys(formContext.formState.errors).length > 0;

  const content = (
    <div
      className={clsx(
        columns > 1 && 'grid gap-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        !separated && spacingClasses[spacing]
      )}
    >
      {separated ? (
        React.Children.map(children, (child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < React.Children.count(children) - 1 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-4" />
            )}
          </React.Fragment>
        ))
      ) : (
        children
      )}
    </div>
  );

  const header = (title || description || (collapsible && !title)) && (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-500" />
              )}
            </button>
          )}
          
          {Icon && (
            <Icon
              className={clsx(
                'h-5 w-5',
                hasErrors ? 'text-red-500' : 'text-gray-400'
              )}
            />
          )}
          
          {title && (
            <h3
              className={clsx(
                'text-lg font-medium',
                hasErrors
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100',
                collapsible && 'cursor-pointer select-none'
              )}
              onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
            >
              {title}
              {hasErrors && showErrorIndicator && (
                <span className="ml-2 text-sm text-red-600 dark:text-red-400">
                  (has errors)
                </span>
              )}
            </h3>
          )}
        </div>
        
        {headerActions && (
          <div className="flex items-center gap-2">
            {headerActions}
          </div>
        )}
      </div>
      
      {description && !isCollapsed && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );

  return (
    <div
      className={clsx(
        'relative',
        bordered && 'border border-gray-200 dark:border-gray-700 rounded-lg',
        variantClasses[variant],
        (bordered || variant !== 'default') && 'p-4 sm:p-6',
        className
      )}
    >
      {header}
      
      <AnimatePresence initial={false}>
        {(!collapsible || !isCollapsed) && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Preset form group variants
 */
export const FormSection: React.FC<Omit<FormGroupProps, 'bordered' | 'variant'>> = (props) => (
  <FormGroup {...props} bordered variant="filled" />
);

export const FormCard: React.FC<Omit<FormGroupProps, 'bordered' | 'variant'>> = (props) => (
  <FormGroup {...props} bordered variant="elevated" />
);

/**
 * Conditional form group that shows/hides based on a field value
 */
interface ConditionalFormGroupProps extends Omit<FormGroupProps, 'showIf'> {
  /**
   * Field name to watch
   */
  watchField: string;
  /**
   * Value(s) that should show the group
   */
  showWhen: any | ((value: any) => boolean);
}

export const ConditionalFormGroup: React.FC<ConditionalFormGroupProps> = ({
  watchField,
  showWhen,
  ...props
}) => {
  const showIf = (values: any) => {
    const fieldValue = values[watchField];
    if (typeof showWhen === 'function') {
      return showWhen(fieldValue);
    }
    return fieldValue === showWhen;
  };

  return <FormGroup {...props} showIf={showIf} />;
};