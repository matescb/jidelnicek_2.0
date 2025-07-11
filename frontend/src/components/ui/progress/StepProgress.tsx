import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface StepProgressProps {
  steps: Step[];
  orientation?: 'horizontal' | 'vertical';
  clickable?: boolean;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

const statusColors = {
  pending: 'bg-gray-300 dark:bg-gray-600',
  active: 'bg-blue-600 dark:bg-blue-500',
  completed: 'bg-green-600 dark:bg-green-500',
  error: 'bg-red-600 dark:bg-red-500',
};

const lineColors = {
  pending: 'bg-gray-300 dark:bg-gray-600',
  active: 'bg-blue-600 dark:bg-blue-500',
  completed: 'bg-green-600 dark:bg-green-500',
  error: 'bg-gray-300 dark:bg-gray-600',
};

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  orientation = 'horizontal',
  clickable = false,
  onStepClick,
  className,
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'flex',
        isHorizontal ? 'flex-row items-center' : 'flex-col',
        className
      )}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === 'completed';
        const isActive = step.status === 'active';
        const isError = step.status === 'error';

        return (
          <div
            key={step.id}
            className={cn(
              'flex',
              isHorizontal ? 'items-center' : 'flex-col',
              !isLast && (isHorizontal ? 'flex-1' : '')
            )}
          >
            {/* Step */}
            <div
              className={cn(
                'flex',
                isHorizontal ? 'flex-col items-center' : 'items-start',
                clickable && 'cursor-pointer'
              )}
              onClick={() => clickable && onStepClick?.(step.id)}
            >
              {/* Step indicator */}
              <motion.div
                className={cn(
                  'relative flex items-center justify-center w-10 h-10 rounded-full text-white',
                  statusColors[step.status],
                  isActive && 'ring-4 ring-blue-200 dark:ring-blue-800'
                )}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : isError ? (
                  <X className="w-5 h-5" />
                ) : step.icon ? (
                  <div className="w-5 h-5">{step.icon}</div>
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </motion.div>

              {/* Step content */}
              <div
                className={cn(
                  'mt-2',
                  isHorizontal ? 'text-center' : 'ml-4',
                  !isHorizontal && 'flex-1'
                )}
              >
                <p
                  className={cn(
                    'text-sm font-medium',
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : isError
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  isHorizontal
                    ? 'flex-1 h-0.5 mx-2'
                    : 'w-0.5 h-16 ml-5 my-2',
                  index < steps.findIndex(s => s.status === 'active' || s.status === 'pending')
                    ? lineColors.completed
                    : lineColors.pending
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};