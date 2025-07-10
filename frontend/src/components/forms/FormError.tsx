import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface FormErrorProps {
  /**
   * Error message(s) to display
   */
  error?: string | string[];
  /**
   * Field name for ARIA attributes
   */
  fieldName?: string;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Show icon with error
   */
  showIcon?: boolean;
  /**
   * Icon component (defaults to ExclamationCircleIcon)
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Error severity affects styling
   */
  severity?: 'error' | 'warning' | 'info';
  /**
   * Animation duration in milliseconds
   */
  animationDuration?: number;
}

const severityStyles = {
  error: {
    text: 'text-red-600 dark:text-red-400',
    icon: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
  },
  warning: {
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
  },
  info: {
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
};

export const FormError: React.FC<FormErrorProps> = ({
  error,
  fieldName,
  className,
  showIcon = true,
  icon: Icon = ExclamationCircleIcon,
  severity = 'error',
  animationDuration = 200,
}) => {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  const hasErrors = errors.length > 0;
  const styles = severityStyles[severity];

  return (
    <AnimatePresence mode="wait">
      {hasErrors && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }}
          transition={{ duration: animationDuration / 1000 }}
          className={clsx('overflow-hidden', className)}
        >
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            {...(fieldName && { 'aria-describedby': `${fieldName}-error` })}
            className="space-y-1 mt-1"
          >
            {errors.map((errorMessage, index) => (
              <div
                key={index}
                id={fieldName && index === 0 ? `${fieldName}-error` : undefined}
                className={clsx(
                  'flex items-start gap-1.5 text-sm',
                  styles.text
                )}
              >
                {showIcon && (
                  <Icon
                    className={clsx(
                      'h-4 w-4 mt-0.5 flex-shrink-0',
                      styles.icon
                    )}
                    aria-hidden="true"
                  />
                )}
                <span className="break-words">{errorMessage}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Compound component for form field with error
 */
interface FormFieldWithErrorProps {
  children: React.ReactNode;
  error?: string | string[];
  fieldName?: string;
  className?: string;
}

export const FormFieldWithError: React.FC<FormFieldWithErrorProps> = ({
  children,
  error,
  fieldName,
  className,
}) => {
  const hasError = error && (Array.isArray(error) ? error.length > 0 : true);

  return (
    <div className={clsx('space-y-1', className)}>
      <div
        className={clsx(
          'transition-colors duration-200',
          hasError && 'has-error'
        )}
      >
        {children}
      </div>
      <FormError error={error} fieldName={fieldName} />
    </div>
  );
};