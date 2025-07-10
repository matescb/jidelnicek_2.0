import React, { useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  ExclamationTriangleIcon, 
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon 
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { FormError } from '../../hooks/useFormErrors';

interface FormErrorSummaryProps {
  /**
   * Array of form errors to display
   */
  errors: FormError[];
  /**
   * Title for the error summary
   */
  title?: string;
  /**
   * Whether the summary can be dismissed
   */
  dismissible?: boolean;
  /**
   * Callback when dismissed
   */
  onDismiss?: () => void;
  /**
   * Whether to group errors by field
   */
  groupByField?: boolean;
  /**
   * Maximum height before scrolling
   */
  maxHeight?: number;
  /**
   * Whether the summary starts collapsed
   */
  startCollapsed?: boolean;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Focus on field when error clicked
   */
  onErrorClick?: (fieldName: string) => void;
  /**
   * Show error count in header
   */
  showCount?: boolean;
}

export const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({
  errors,
  title,
  dismissible = true,
  onDismiss,
  groupByField = true,
  maxHeight = 200,
  startCollapsed = false,
  className,
  onErrorClick,
  showCount = true,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = React.useState(startCollapsed);
  const summaryRef = useRef<HTMLDivElement>(null);

  const hasErrors = errors.length > 0;

  // Group errors by field if requested
  const groupedErrors = React.useMemo(() => {
    if (!groupByField) return { general: errors };

    const groups: Record<string, FormError[]> = {};
    
    errors.forEach(error => {
      const key = error.field || 'general';
      if (!groups[key]) groups[key] = [];
      groups[key].push(error);
    });

    return groups;
  }, [errors, groupByField]);

  const handleErrorClick = useCallback((fieldName?: string) => {
    if (fieldName && onErrorClick) {
      onErrorClick(fieldName);
      
      // Focus on the field
      const fieldElement = document.querySelector(
        `[name="${fieldName}"], [id="${fieldName}"]`
      ) as HTMLElement;
      
      if (fieldElement) {
        fieldElement.focus();
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [onErrorClick]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  if (!hasErrors) return null;

  const defaultTitle = errors.length === 1 
    ? t('errors.validationError', 'Validation Error')
    : t('errors.validationErrors', 'Validation Errors');

  return (
    <AnimatePresence>
      <motion.div
        ref={summaryRef}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={clsx(
          'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
          'rounded-lg shadow-sm',
          className
        )}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon 
                className="h-5 w-5 text-red-600 dark:text-red-400" 
                aria-hidden="true"
              />
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                {title || defaultTitle}
                {showCount && (
                  <span className="ml-2 text-red-600 dark:text-red-400">
                    ({errors.length})
                  </span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {errors.length > 3 && (
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className={clsx(
                    'p-1 rounded hover:bg-red-100 dark:hover:bg-red-800/30',
                    'text-red-600 dark:text-red-400 transition-colors'
                  )}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
                >
                  {isCollapsed ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronUpIcon className="h-4 w-4" />
                  )}
                </button>
              )}
              {dismissible && onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className={clsx(
                    'p-1 rounded hover:bg-red-100 dark:hover:bg-red-800/30',
                    'text-red-600 dark:text-red-400 transition-colors'
                  )}
                  aria-label={t('common.dismiss', 'Dismiss')}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error list */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={clsx(
                  'px-4 py-3 space-y-2',
                  errors.length > 5 && 'overflow-y-auto'
                )}
                style={{ maxHeight: errors.length > 5 ? maxHeight : undefined }}
              >
                {Object.entries(groupedErrors).map(([fieldName, fieldErrors]) => (
                  <div key={fieldName} className="space-y-1">
                    {fieldName !== 'general' && groupByField && (
                      <h4 className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wider">
                        {fieldName}
                      </h4>
                    )}
                    <ul className="space-y-1">
                      {fieldErrors.map((error, index) => (
                        <li
                          key={`${fieldName}-${index}`}
                          className="text-sm text-red-600 dark:text-red-400"
                        >
                          {error.field && onErrorClick ? (
                            <button
                              type="button"
                              onClick={() => handleErrorClick(error.field)}
                              className={clsx(
                                'text-left hover:underline focus:underline',
                                'focus:outline-none focus:ring-2 focus:ring-red-500',
                                'focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                                'rounded px-1 -mx-1'
                              )}
                            >
                              • {error.message}
                            </button>
                          ) : (
                            <span>• {error.message}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed state indicator */}
        {isCollapsed && (
          <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {t('errors.clickToExpand', 'Click to view {{count}} errors', { count: errors.length })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Hook for managing form error summary
 */
export function useFormErrorSummary(errors: FormError[]) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const reset = useCallback(() => {
    setIsDismissed(false);
  }, []);

  // Reset dismissal when errors change
  React.useEffect(() => {
    if (errors.length > 0) {
      setIsDismissed(false);
    }
  }, [errors]);

  return {
    isDismissed,
    dismiss,
    reset,
    shouldShow: errors.length > 0 && !isDismissed,
  };
}