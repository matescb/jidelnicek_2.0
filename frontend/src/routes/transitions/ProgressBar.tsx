import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressBar } from './hooks';

interface ProgressBarProps {
  color?: string;
  height?: number;
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  color = 'bg-blue-600',
  height = 3,
  showPercentage = false,
  className = '',
}) => {
  const { progress, isLoading } = useProgressBar();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed top-0 left-0 right-0 z-50 ${className}`}
          style={{ height: `${height}px` }}
        >
          <motion.div
            className={`h-full ${color} shadow-lg`}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{
              duration: 0.3,
              ease: 'easeInOut',
            }}
          />
          
          {showPercentage && progress > 0 && progress < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-gray-800 text-white text-xs px-2 py-1 rounded"
            >
              {Math.round(progress)}%
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Standalone progress bar component for manual control
interface ManualProgressBarProps {
  progress: number;
  visible: boolean;
  color?: string;
  height?: number;
  showPercentage?: boolean;
  className?: string;
}

export const ManualProgressBar: React.FC<ManualProgressBarProps> = ({
  progress,
  visible,
  color = 'bg-blue-600',
  height = 3,
  showPercentage = false,
  className = '',
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`relative ${className}`}
          style={{ height: `${height}px` }}
        >
          <div className="absolute inset-0 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${color}`}
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{
                duration: 0.3,
                ease: 'easeInOut',
              }}
            />
          </div>
          
          {showPercentage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium">
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Indeterminate progress bar
interface IndeterminateProgressBarProps {
  visible: boolean;
  color?: string;
  height?: number;
  className?: string;
}

export const IndeterminateProgressBar: React.FC<IndeterminateProgressBarProps> = ({
  visible,
  color = 'bg-blue-600',
  height = 3,
  className = '',
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`relative overflow-hidden ${className}`}
          style={{ height: `${height}px` }}
        >
          <div className="absolute inset-0 bg-gray-200">
            <motion.div
              className={`absolute h-full w-1/3 ${color}`}
              animate={{
                x: ['0%', '200%', '0%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Circular progress indicator
interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showPercentage?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 48,
  strokeWidth = 4,
  color = '#3B82F6',
  showPercentage = true,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          style={{
            strokeDasharray: circumference,
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </svg>
      
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
};

// Step progress indicator
interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  className?: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps,
  labels = [],
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const label = labels[index];

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted || isCurrent ? '#3B82F6' : '#E5E7EB',
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className={isCompleted || isCurrent ? 'text-white' : 'text-gray-600'}>
                    {index + 1}
                  </span>
                )}
              </motion.div>
              {label && (
                <span className="mt-2 text-xs text-gray-600">{label}</span>
              )}
            </div>
            
            {index < totalSteps - 1 && (
              <div className="flex-1 mx-4">
                <div className="h-1 bg-gray-200 rounded relative overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-blue-600"
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  />
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};