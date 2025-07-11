import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

interface ValidationErrorProps {
  error?: string;
  touched?: boolean;
  className?: string;
}

export const ValidationError: React.FC<ValidationErrorProps> = ({
  error,
  touched,
  className = ''
}) => {
  const showError = touched && error;

  return (
    <AnimatePresence>
      {showError && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: 'auto', 
            opacity: 1,
            transition: {
              height: { type: 'spring', damping: 25 },
              opacity: { duration: 0.2 }
            }
          }}
          exit={{ 
            height: 0, 
            opacity: 0,
            transition: {
              height: { duration: 0.2 },
              opacity: { duration: 0.1 }
            }
          }}
          className={`overflow-hidden ${className}`}
        >
          <motion.div
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mt-1"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ 
                scale: 1,
                transition: { type: 'spring', damping: 15 }
              }}
            >
              <AlertCircle className="h-4 w-4" />
            </motion.div>
            <span>{error}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface FieldValidationWrapperProps {
  error?: string;
  touched?: boolean;
  children: React.ReactNode;
}

export const FieldValidationWrapper: React.FC<FieldValidationWrapperProps> = ({
  error,
  touched,
  children
}) => {
  const hasError = touched && error;

  return (
    <div className="relative">
      <motion.div
        animate={hasError ? {
          x: [-2, 2, -2, 2, 0],
          transition: { duration: 0.4 }
        } : {}}
      >
        {children}
      </motion.div>

      {/* Red border pulse */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            className="absolute inset-0 rounded-md border-2 border-red-500 pointer-events-none"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [1.02, 1, 1.02],
              transition: {
                duration: 1,
                repeat: 2
              }
            }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <ValidationError error={error} touched={touched} />
    </div>
  );
};

interface ValidationTooltipProps {
  error?: string;
  touched?: boolean;
  children: React.ReactNode;
}

export const ValidationTooltip: React.FC<ValidationTooltipProps> = ({
  error,
  touched,
  children
}) => {
  const showError = touched && error;

  return (
    <div className="relative">
      {children}
      
      <AnimatePresence>
        {showError && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              transition: { type: 'spring', damping: 20 }
            }}
            exit={{ 
              opacity: 0, 
              y: 5, 
              scale: 0.95,
              transition: { duration: 0.2 }
            }}
            className="absolute left-0 top-full mt-1 z-50"
          >
            <div className="relative">
              {/* Arrow */}
              <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 dark:bg-red-500 rotate-45" />
              
              {/* Tooltip content */}
              <div className="bg-red-600 dark:bg-red-500 text-white text-sm px-3 py-2 rounded-md shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface InlineValidationErrorProps {
  errors: string[];
  className?: string;
}

export const InlineValidationError: React.FC<InlineValidationErrorProps> = ({
  errors,
  className = ''
}) => {
  return (
    <AnimatePresence>
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className={`bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-4 ${className}`}
        >
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            </motion.div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Please fix the following errors:
              </h4>
              <ul className="space-y-1">
                <AnimatePresence>
                  {errors.map((error, index) => (
                    <motion.li
                      key={error}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ 
                        opacity: 1, 
                        x: 0,
                        transition: { delay: index * 0.05 }
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"
                    >
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {error}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};