import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorMessageProps {
  title: string;
  message: string;
  details?: string;
  type?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  details,
  type = 'error',
  onDismiss
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const colorMap = {
    error: 'red',
    warning: 'yellow',
    info: 'blue'
  };

  const color = colorMap[type];

  const handleCopy = useCallback(async () => {
    const errorText = `${title}\n${message}${details ? `\n\nDetails:\n${details}` : ''}`;
    await navigator.clipboard.writeText(errorText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [title, message, details]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        transition: { type: 'spring', damping: 20 }
      }}
      exit={{ opacity: 0, x: 20 }}
      className={`relative rounded-lg border bg-${color}-50 dark:bg-${color}-950 p-4`}
    >
      {/* Pulse effect */}
      <motion.div
        className={`absolute inset-0 rounded-lg bg-${color}-500`}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, 0.1, 0],
          scale: [1, 1.02, 1]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          repeatDelay: 1
        }}
      />

      {/* Shake animation on appear */}
      <motion.div
        initial={{ x: 0 }}
        animate={{ 
          x: [-10, 10, -10, 10, 0],
          transition: { duration: 0.5 }
        }}
        className="relative z-10"
      >
        <div className="flex items-start gap-3">
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 0.5,
              delay: 0.2
            }}
          >
            <AlertCircle className={`h-5 w-5 text-${color}-600 dark:text-${color}-400 mt-0.5`} />
          </motion.div>

          <div className="flex-1">
            <h3 className={`font-semibold text-${color}-800 dark:text-${color}-200`}>
              {title}
            </h3>
            <p className={`mt-1 text-sm text-${color}-700 dark:text-${color}-300`}>
              {message}
            </p>

            {details && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-6 px-2 text-xs"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                  </motion.div>
                  {isExpanded ? 'Hide' : 'Show'} details
                </Button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ 
                        height: 'auto', 
                        opacity: 1,
                        transition: { 
                          height: { type: 'spring', damping: 25 },
                          opacity: { duration: 0.2, delay: 0.1 }
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
                      className="overflow-hidden"
                    >
                      <pre className={`mt-2 text-xs bg-${color}-100 dark:bg-${color}-900 p-2 rounded overflow-auto`}>
                        {details}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopy}
            >
              <AnimatePresence mode="wait">
                {isCopied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDismiss}
              >
                <motion.div
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="h-4 w-4" />
                </motion.div>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Animated error toast
export const ErrorToast: React.FC<ErrorMessageProps> = (props) => {
  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25 }}
    >
      <ErrorMessage {...props} />
    </motion.div>
  );
};