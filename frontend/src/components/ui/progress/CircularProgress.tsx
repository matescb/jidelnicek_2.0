import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../utils/cn';

interface CircularProgressProps {
  value?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  thickness?: number;
  variant?: 'primary' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  indeterminate?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 40,
  md: 56,
  lg: 72,
  xl: 96,
};

const variantClasses = {
  primary: 'text-blue-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
};

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value = 0,
  size = 'md',
  thickness = 4,
  variant = 'primary',
  showPercentage = true,
  indeterminate = false,
  className,
}) => {
  const dimension = sizeMap[size];
  const radius = (dimension - thickness) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  if (indeterminate) {
    return (
      <div className={cn('relative inline-flex', className)}>
        <motion.svg
          width={dimension}
          height={dimension}
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'linear',
          }}
        >
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={thickness}
            className="text-gray-200 dark:text-gray-700"
          />
          <motion.circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={thickness}
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            className={variantClasses[variant]}
            strokeLinecap="round"
          />
        </motion.svg>
      </div>
    );
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg width={dimension} height={dimension}>
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={variantClasses[variant]}
          strokeLinecap="round"
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
        />
      </svg>
      {showPercentage && !indeterminate && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            'font-semibold',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base',
            size === 'xl' && 'text-lg'
          )}>
            {Math.round(value)}%
          </span>
        </div>
      )}
    </div>
  );
};