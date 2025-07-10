import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';

export type MessageType = 'error' | 'warning' | 'info' | 'success';

interface InlineErrorProps {
  /**
   * Error/warning/info message
   */
  message?: string;
  /**
   * Message type affects styling
   */
  type?: MessageType;
  /**
   * Whether to show an icon
   */
  showIcon?: boolean;
  /**
   * Custom icon component
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Field ID for accessibility
   */
  fieldId?: string;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Animation configuration
   */
  animation?: {
    duration?: number;
    delay?: number;
    type?: 'slide' | 'fade' | 'scale';
  };
  /**
   * Compact mode for tight spaces
   */
  compact?: boolean;
}

const typeConfig = {
  error: {
    icon: ExclamationCircleIcon,
    textColor: 'text-red-600 dark:text-red-400',
    iconColor: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-50/50 dark:bg-red-900/10',
    borderColor: 'border-red-200 dark:border-red-800/50',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    textColor: 'text-amber-600 dark:text-amber-400',
    iconColor: 'text-amber-500 dark:text-amber-400',
    bgColor: 'bg-amber-50/50 dark:bg-amber-900/10',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
  },
  info: {
    icon: InformationCircleIcon,
    textColor: 'text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500 dark:text-blue-400',
    bgColor: 'bg-blue-50/50 dark:bg-blue-900/10',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
  },
  success: {
    icon: null,
    textColor: 'text-green-600 dark:text-green-400',
    iconColor: 'text-green-500 dark:text-green-400',
    bgColor: 'bg-green-50/50 dark:bg-green-900/10',
    borderColor: 'border-green-200 dark:border-green-800/50',
  },
};

const animationVariants = {
  slide: {
    initial: { opacity: 0, height: 0, y: -10 },
    animate: { opacity: 1, height: 'auto', y: 0 },
    exit: { opacity: 0, height: 0, y: -10 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  type = 'error',
  showIcon = true,
  icon,
  fieldId,
  className,
  animation = { duration: 200, delay: 0, type: 'slide' },
  compact = false,
}) => {
  const config = typeConfig[type];
  const Icon = icon || config.icon;
  const variants = animationVariants[animation.type || 'slide'];

  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={{
            duration: (animation.duration || 200) / 1000,
            delay: (animation.delay || 0) / 1000,
          }}
          className={clsx('overflow-hidden', className)}
        >
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            {...(fieldId && { id: `${fieldId}-${type}` })}
            className={clsx(
              'flex items-start gap-1.5',
              compact ? 'text-xs mt-0.5' : 'text-sm mt-1',
              config.textColor
            )}
          >
            {showIcon && Icon && (
              <Icon
                className={clsx(
                  'flex-shrink-0',
                  compact ? 'h-3 w-3 mt-0.5' : 'h-4 w-4 mt-0.5',
                  config.iconColor
                )}
                aria-hidden="true"
              />
            )}
            <span className="break-words">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Inline message component with background
 */
interface InlineMessageProps extends InlineErrorProps {
  /**
   * Show background and border
   */
  showBackground?: boolean;
  /**
   * Allow dismissing the message
   */
  dismissible?: boolean;
  /**
   * Callback when dismissed
   */
  onDismiss?: () => void;
}

export const InlineMessage: React.FC<InlineMessageProps> = ({
  message,
  type = 'info',
  showBackground = true,
  dismissible = false,
  onDismiss,
  className,
  ...props
}) => {
  const config = typeConfig[type];

  if (!message) return null;

  const content = <InlineError message={message} type={type} {...props} />;

  if (!showBackground) return content;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          'rounded-md border px-3 py-2',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">{content}</div>
          {dismissible && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={clsx(
                'p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5',
                'transition-colors',
                config.textColor
              )}
              aria-label="Dismiss message"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Multiple inline errors component
 */
interface MultipleInlineErrorsProps {
  /**
   * Array of error messages
   */
  errors?: string[];
  /**
   * Message type
   */
  type?: MessageType;
  /**
   * Show as list or separate messages
   */
  display?: 'list' | 'stack';
  /**
   * Field ID for accessibility
   */
  fieldId?: string;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Compact mode
   */
  compact?: boolean;
}

export const MultipleInlineErrors: React.FC<MultipleInlineErrorsProps> = ({
  errors = [],
  type = 'error',
  display = 'list',
  fieldId,
  className,
  compact = false,
}) => {
  if (!errors || errors.length === 0) return null;

  if (display === 'stack') {
    return (
      <div className={clsx('space-y-0.5', className)}>
        {errors.map((error, index) => (
          <InlineError
            key={index}
            message={error}
            type={type}
            fieldId={fieldId}
            compact={compact}
            showIcon={index === 0}
          />
        ))}
      </div>
    );
  }

  // List display
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <InlineError
      message={
        <ul className="space-y-0.5">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      }
      type={type}
      fieldId={fieldId}
      className={className}
      compact={compact}
      icon={Icon}
    />
  );
};