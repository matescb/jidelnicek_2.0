import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../utils/cn';

interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'error';
  striped?: boolean;
  animated?: boolean;
  indeterminate?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

const variantClasses = {
  primary: 'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  error: 'bg-red-600',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  label,
  showPercentage = false,
  size = 'md',
  variant = 'primary',
  striped = false,
  animated = false,
  indeterminate = false,
  className,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>}
          {showPercentage && !indeterminate && (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div
        className={cn(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        {indeterminate ? (
          <motion.div
            className={cn(
              'h-full rounded-full',
              variantClasses[variant],
              striped && 'bg-striped',
              animated && striped && 'bg-striped-animated'
            )}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: 'linear',
            }}
            style={{ width: '30%' }}
          />
        ) : (
          <motion.div
            className={cn(
              'h-full rounded-full',
              variantClasses[variant],
              striped && 'bg-striped',
              animated && striped && 'bg-striped-animated'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{
              duration: 0.5,
              ease: 'easeOut',
            }}
          />
        )}
      </div>
    </div>
  );
};