import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryUIProps {
  error: Error;
  resetError: () => void;
  errorInfo?: React.ErrorInfo;
}

export const ErrorBoundaryUI: React.FC<ErrorBoundaryUIProps> = ({
  error,
  resetError,
  errorInfo
}) => {
  const [isReporting, setIsReporting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const handleReport = async () => {
    setIsReporting(true);
    // Simulate error reporting
    await new Promise(resolve => setTimeout(resolve, 2000));
    setReportSent(true);
    setIsReporting(false);
  };

  const handleHomeClick = () => {
    window.location.href = '/';
  };

  // Falling blocks animation
  const blocks = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    delay: i * 0.1,
    x: Math.random() * 200 - 100,
    rotation: Math.random() * 360
  }));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      {/* Falling blocks */}
      <div className="absolute inset-0 overflow-hidden">
        {blocks.map(block => (
          <motion.div
            key={block.id}
            className="absolute w-20 h-20 bg-red-500/10 rounded-lg"
            initial={{ 
              y: -100,
              x: `${50 + block.x}%`,
              rotate: 0
            }}
            animate={{ 
              y: '100vh',
              rotate: block.rotation
            }}
            transition={{ 
              duration: 3,
              delay: block.delay,
              ease: 'easeIn',
              repeat: Infinity,
              repeatDelay: 2
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-2xl w-full"
      >
        {/* Broken screen effect */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5"
            animate={{ 
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{ 
              duration: 10,
              repeat: Infinity,
              repeatType: 'reverse'
            }}
          />

          {/* Glitch lines */}
          <motion.div
            className="absolute inset-0"
            animate={{ 
              opacity: [0, 1, 0],
            }}
            transition={{ 
              duration: 0.1,
              repeat: Infinity,
              repeatDelay: 5
            }}
          >
            <div className="h-px bg-red-500 absolute top-1/4 w-full" />
            <div className="h-px bg-cyan-500 absolute top-1/2 w-full" />
            <div className="h-px bg-yellow-500 absolute top-3/4 w-full" />
          </motion.div>

          <div className="relative p-8 md:p-12">
            {/* Error icon with animation */}
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, 0]
              }}
              transition={{ 
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2
              }}
              className="flex justify-center mb-6"
            >
              <div className="relative">
                <AlertTriangle className="h-24 w-24 text-red-500" />
                <motion.div
                  className="absolute inset-0 bg-red-500 rounded-full blur-xl"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0, 0.5]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity
                  }}
                />
              </div>
            </motion.div>

            <h1 className="text-3xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
              Oops! Something went wrong
            </h1>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              We encountered an unexpected error. Don't worry, our team has been notified.
            </p>

            {/* Error details */}
            <div className="mb-8">
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              >
                <span className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Error details
                </span>
                <motion.div
                  animate={{ rotate: isDetailsOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>

              <AnimatePresence>
                {isDetailsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                      <p className="font-mono text-sm text-red-600 dark:text-red-400 mb-2">
                        {error.message}
                      </p>
                      {errorInfo && (
                        <details className="text-xs text-gray-600 dark:text-gray-400">
                          <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                            Stack trace
                          </summary>
                          <pre className="mt-2 overflow-auto max-h-48">
                            {errorInfo.componentStack}
                          </pre>
                        </details>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={resetError}
                className="flex-1"
                size="lg"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ 
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                  className="mr-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </motion.div>
                Try again
              </Button>

              <Button
                onClick={handleHomeClick}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Home className="mr-2 h-4 w-4" />
                Go home
              </Button>

              <Button
                onClick={handleReport}
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={isReporting || reportSent}
              >
                <AnimatePresence mode="wait">
                  {reportSent ? (
                    <motion.span
                      key="sent"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center"
                    >
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      Reported
                    </motion.span>
                  ) : (
                    <motion.span
                      key="report"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center"
                    >
                      <Bug className="mr-2 h-4 w-4" />
                      {isReporting ? 'Reporting...' : 'Report issue'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};