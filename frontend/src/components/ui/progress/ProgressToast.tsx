import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { ProgressBar } from './ProgressBar';

interface ProgressToastProps {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status?: 'loading' | 'success' | 'error' | 'info';
  autoClose?: boolean;
  autoCloseDelay?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

const statusIcons = {
  loading: <Loader2 className="w-5 h-5 animate-spin" />,
  success: <CheckCircle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
};

const statusColors = {
  loading: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-gray-600 dark:text-gray-400',
};

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

export const ProgressToast: React.FC<ProgressToastProps> = ({
  id,
  title,
  description,
  progress,
  status = 'loading',
  autoClose = true,
  autoCloseDelay = 3000,
  onClose,
  action,
  position = 'top-right',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const isComplete = progress >= 100;
  const finalStatus = isComplete && status === 'loading' ? 'success' : status;

  useEffect(() => {
    if (autoClose && isComplete) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isComplete, autoClose, autoCloseDelay, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={id}
          initial={{ opacity: 0, y: position.includes('top') ? -20 : 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          className={cn(
            'fixed z-50 pointer-events-auto',
            positionClasses[position],
            className
          )}
        >
          <div className="w-80 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={cn('mt-0.5', statusColors[finalStatus])}>
                    {statusIcons[finalStatus]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {title}
                    </p>
                    {description && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!isComplete && (
                <div className="mt-3">
                  <ProgressBar
                    value={progress}
                    size="xs"
                    variant={
                      finalStatus === 'error' ? 'error' : 'primary'
                    }
                    showPercentage
                    animated
                  />
                </div>
              )}

              {action && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={action.onClick}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Progress Toast Container for managing multiple toasts
interface ProgressToastContainerProps {
  toasts: ProgressToastProps[];
  position?: ProgressToastProps['position'];
}

export const ProgressToastContainer: React.FC<ProgressToastContainerProps> = ({
  toasts,
  position = 'top-right',
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div
        className={cn(
          'absolute flex flex-col space-y-3',
          position.includes('top') ? 'top-4' : 'bottom-4',
          position.includes('right') ? 'right-4' : 'left-4',
          position.includes('bottom') && 'flex-col-reverse'
        )}
      >
        {toasts.map((toast) => (
          <ProgressToast key={toast.id} {...toast} position={position} />
        ))}
      </div>
    </div>
  );
};