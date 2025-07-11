/**
 * UX enhancement components for real-time validation feedback
 * 
 * These components provide visual feedback, field status indicators,
 * and error summaries for improved user experience.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Loader2,
  ChevronRight,
  X
} from 'lucide-react';
import { ErrorMessage, ErrorSeverity } from '@/utils/validation/errorMessages';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';

// Field status indicator component
export interface FieldStatusIndicatorProps {
  status: 'default' | 'validating' | 'valid' | 'error' | 'warning';
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export const FieldStatusIndicator: React.FC<FieldStatusIndicatorProps> = ({
  status,
  message,
  size = 'md',
  showTooltip = true,
  className,
}) => {
  const [showMessage, setShowMessage] = useState(false);

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const statusConfig = {
    default: {
      icon: null,
      color: 'text-gray-400',
    },
    validating: {
      icon: <Loader2 className={clsx(sizeClasses[size], 'animate-spin')} />,
      color: 'text-blue-500',
    },
    valid: {
      icon: <CheckCircle className={sizeClasses[size]} />,
      color: 'text-green-500',
    },
    error: {
      icon: <AlertCircle className={sizeClasses[size]} />,
      color: 'text-red-500',
    },
    warning: {
      icon: <AlertTriangle className={sizeClasses[size]} />,
      color: 'text-yellow-500',
    },
  };

  const config = statusConfig[status];

  if (!config.icon) return null;

  return (
    <div 
      className={clsx('relative inline-flex items-center', className)}
      onMouseEnter={() => setShowMessage(true)}
      onMouseLeave={() => setShowMessage(false)}
    >
      <span className={config.color}>
        {config.icon}
      </span>
      
      {showTooltip && message && (
        <AnimatePresence>
          {showMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute z-10 px-2 py-1 text-sm text-white bg-gray-900 rounded shadow-lg whitespace-nowrap -top-8 left-1/2 transform -translate-x-1/2"
            >
              {message}
              <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

// Live validation feedback component
export interface LiveValidationFeedbackProps {
  isValidating: boolean;
  isValid: boolean;
  error?: string;
  warnings?: string[];
  showWhenValid?: boolean;
  showWhenValidating?: boolean;
  mode?: 'inline' | 'float' | 'tooltip';
  position?: 'bottom' | 'right' | 'top';
  className?: string;
}

export const LiveValidationFeedback: React.FC<LiveValidationFeedbackProps> = ({
  isValidating,
  isValid,
  error,
  warnings = [],
  showWhenValid = true,
  showWhenValidating = true,
  mode = 'inline',
  position = 'bottom',
  className,
}) => {
  const { t } = useI18n();

  const shouldShow = (isValidating && showWhenValidating) || 
                    (isValid && showWhenValid) || 
                    error || 
                    warnings.length > 0;

  if (!shouldShow) return null;

  const content = (
    <div className={clsx(
      'text-sm',
      mode === 'inline' && 'mt-1',
      mode === 'float' && 'absolute z-10 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700',
      mode === 'tooltip' && 'absolute z-10 bg-gray-900 text-white rounded px-2 py-1',
      position === 'bottom' && 'top-full',
      position === 'right' && 'left-full ml-2',
      position === 'top' && 'bottom-full mb-1',
      className
    )}>
      <AnimatePresence mode="wait">
        {isValidating && (
          <motion.div
            key="validating"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center text-blue-600 dark:text-blue-400"
          >
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('validation.checking')}
          </motion.div>
        )}
        
        {!isValidating && isValid && showWhenValid && (
          <motion.div
            key="valid"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center text-green-600 dark:text-green-400"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('validation.valid')}
          </motion.div>
        )}
        
        {!isValidating && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        
        {!isValidating && warnings.length > 0 && (
          <motion.div
            key="warnings"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            {warnings.map((warning, index) => (
              <div key={index} className="flex items-start text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (mode === 'inline') {
    return content;
  }

  return <div className="relative">{content}</div>;
};

// Error summary component
export interface ErrorSummaryProps {
  errors: ErrorMessage[];
  title?: string;
  showSeverityIcons?: boolean;
  groupBySeverity?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onErrorClick?: (error: ErrorMessage) => void;
  className?: string;
}

export const ErrorSummary: React.FC<ErrorSummaryProps> = ({
  errors,
  title,
  showSeverityIcons = true,
  groupBySeverity = false,
  collapsible = false,
  defaultExpanded = true,
  onErrorClick,
  className,
}) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const summaryRef = useRef<HTMLDivElement>(null);

  const severityIcons: Record<ErrorSeverity, React.ReactNode> = {
    error: <AlertCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
  };

  const severityColors: Record<ErrorSeverity, string> = {
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const severityBgColors: Record<ErrorSeverity, string> = {
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  useEffect(() => {
    if (errors.length > 0 && summaryRef.current) {
      summaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [errors.length]);

  if (errors.length === 0) return null;

  const groupedErrors = groupBySeverity
    ? errors.reduce((acc, error) => {
        const severity = error.severity || 'error';
        if (!acc[severity]) acc[severity] = [];
        acc[severity].push(error);
        return acc;
      }, {} as Record<ErrorSeverity, ErrorMessage[]>)
    : { all: errors };

  const renderError = (error: ErrorMessage, index: number) => (
    <motion.li
      key={`${error.key}-${index}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
        onErrorClick && 'cursor-pointer'
      )}
      onClick={() => onErrorClick?.(error)}
    >
      {showSeverityIcons && (
        <span className={severityColors[error.severity || 'error']}>
          {severityIcons[error.severity || 'error']}
        </span>
      )}
      <span className="text-sm">{error.message}</span>
    </motion.li>
  );

  const content = (
    <div className="space-y-2">
      {Object.entries(groupedErrors).map(([severity, errors]) => (
        <div key={severity} className="space-y-1">
          {groupBySeverity && severity !== 'all' && (
            <h4 className={clsx(
              'text-xs font-medium uppercase tracking-wider',
              severityColors[severity as ErrorSeverity]
            )}>
              {t(`validation.severity.${severity}`)}
            </h4>
          )}
          <ul className="space-y-1">
            {errors.map((error, index) => renderError(error, index))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div
      ref={summaryRef}
      className={clsx(
        'rounded-lg border p-4',
        errors.some(e => e.severity === 'error') && severityBgColors.error,
        errors.every(e => e.severity === 'warning') && severityBgColors.warning,
        errors.every(e => e.severity === 'info') && severityBgColors.info,
        className
      )}
    >
      {(title || collapsible) && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">
            {title || t('validation.summary.title')}
          </h3>
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              <ChevronRight 
                className={clsx(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </Button>
          )}
        </div>
      )}
      
      <AnimatePresence>
        {(!collapsible || isExpanded) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Field validation progress indicator
export interface ValidationProgressIndicatorProps {
  totalFields: number;
  validatedFields: number;
  validFields: number;
  showPercentage?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const ValidationProgressIndicator: React.FC<ValidationProgressIndicatorProps> = ({
  totalFields,
  validatedFields,
  validFields,
  showPercentage = true,
  showDetails = false,
  className,
}) => {
  const { t } = useI18n();
  const percentage = totalFields > 0 ? Math.round((validFields / totalFields) * 100) : 0;
  const isComplete = validatedFields === totalFields && validFields === totalFields;

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {t('validation.progress.label')}
        </span>
        {showPercentage && (
          <span className={clsx(
            'font-medium',
            isComplete ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'
          )}>
            {percentage}%
          </span>
        )}
      </div>
      
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={clsx(
            'absolute inset-y-0 left-0 rounded-full',
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      
      {showDetails && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('validation.progress.validated', { count: validatedFields, total: totalFields })}</span>
          <span>{t('validation.progress.valid', { count: validFields })}</span>
        </div>
      )}
    </div>
  );
};