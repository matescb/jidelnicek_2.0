import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Tooltip } from '../ui/Tooltip';

export type ValidationState = 'idle' | 'validating' | 'success' | 'error' | 'warning' | 'info';

interface ValidationIconProps {
  /**
   * Current validation state
   */
  state: ValidationState;
  /**
   * Validation message to show in tooltip
   */
  message?: string;
  /**
   * Icon size
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Whether to show tooltip on hover
   */
  showTooltip?: boolean;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Animation duration in milliseconds
   */
  animationDuration?: number;
  /**
   * Click handler
   */
  onClick?: () => void;
  /**
   * Whether the icon is clickable
   */
  clickable?: boolean;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const stateConfig = {
  idle: {
    icon: null,
    color: '',
    label: 'Idle',
  },
  validating: {
    icon: ArrowPathIcon,
    color: 'text-blue-500 dark:text-blue-400',
    label: 'Validating',
    animate: true,
  },
  success: {
    icon: CheckCircleIcon,
    color: 'text-green-500 dark:text-green-400',
    label: 'Valid',
  },
  error: {
    icon: ExclamationCircleIcon,
    color: 'text-red-500 dark:text-red-400',
    label: 'Error',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    color: 'text-amber-500 dark:text-amber-400',
    label: 'Warning',
  },
  info: {
    icon: InformationCircleIcon,
    color: 'text-blue-500 dark:text-blue-400',
    label: 'Info',
  },
};

export const ValidationIcon: React.FC<ValidationIconProps> = ({
  state,
  message,
  size = 'sm',
  showTooltip = true,
  className,
  animationDuration = 200,
  onClick,
  clickable = false,
}) => {
  const config = stateConfig[state];
  const Icon = config.icon;

  if (!Icon) return null;

  const iconElement = (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: animationDuration / 1000 }}
      className={clsx(
        'inline-flex items-center justify-center',
        clickable && 'cursor-pointer',
        className
      )}
      onClick={clickable ? onClick : undefined}
    >
      <Icon
        className={clsx(
          sizeClasses[size],
          config.color,
          config.animate && 'animate-spin',
          clickable && 'hover:opacity-80 transition-opacity'
        )}
        aria-label={config.label}
        aria-hidden={!message}
      />
    </motion.div>
  );

  if (showTooltip && message) {
    return (
      <Tooltip content={message} placement="top">
        {iconElement}
      </Tooltip>
    );
  }

  return iconElement;
};

/**
 * Validation icon with label
 */
interface ValidationIconWithLabelProps extends ValidationIconProps {
  /**
   * Label position
   */
  labelPosition?: 'left' | 'right';
  /**
   * Label text (defaults to state label)
   */
  label?: string;
  /**
   * Show label
   */
  showLabel?: boolean;
}

export const ValidationIconWithLabel: React.FC<ValidationIconWithLabelProps> = ({
  state,
  label,
  labelPosition = 'right',
  showLabel = true,
  ...props
}) => {
  const config = stateConfig[state];
  const displayLabel = label || config.label;

  return (
    <div className="inline-flex items-center gap-1.5">
      {showLabel && labelPosition === 'left' && (
        <span className={clsx('text-sm', config.color)}>{displayLabel}</span>
      )}
      <ValidationIcon state={state} {...props} />
      {showLabel && labelPosition === 'right' && (
        <span className={clsx('text-sm', config.color)}>{displayLabel}</span>
      )}
    </div>
  );
};

/**
 * Field validation indicator component
 */
interface FieldValidationIndicatorProps {
  /**
   * Field name
   */
  fieldName: string;
  /**
   * Validation state
   */
  state: ValidationState;
  /**
   * Error/warning/info message
   */
  message?: string;
  /**
   * Position relative to field
   */
  position?: 'inline' | 'absolute';
  /**
   * Custom CSS classes
   */
  className?: string;
}

export const FieldValidationIndicator: React.FC<FieldValidationIndicatorProps> = ({
  fieldName,
  state,
  message,
  position = 'absolute',
  className,
}) => {
  return (
    <AnimatePresence mode="wait">
      {state !== 'idle' && (
        <div
          className={clsx(
            position === 'absolute' && 'absolute right-2 top-1/2 -translate-y-1/2',
            position === 'inline' && 'inline-flex',
            className
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          <ValidationIcon
            state={state}
            message={message}
            showTooltip={true}
            size="sm"
          />
        </div>
      )}
    </AnimatePresence>
  );
};

