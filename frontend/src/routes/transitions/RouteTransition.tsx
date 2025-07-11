import React, { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useProgressBar } from './hooks';
import { ProgressBar } from './ProgressBar';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { getTransitionVariants } from './transitions';

interface RouteTransitionProps {
  children: ReactNode;
  mode?: 'fade' | 'slide' | 'scale' | 'none';
  duration?: number;
  showProgress?: boolean;
  className?: string;
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({
  children,
  mode = 'fade',
  duration = 0.3,
  showProgress = true,
  className = '',
}) => {
  const location = useLocation();
  const { start, complete } = useProgressBar();
  const variants = getTransitionVariants(mode, duration);

  useEffect(() => {
    if (showProgress) {
      start();
      // Simulate loading completion
      const timer = setTimeout(() => {
        complete();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, showProgress, start, complete]);

  return (
    <>
      {showProgress && <ProgressBar />}
      <RouteErrorBoundary>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`route-transition ${className}`}
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <React.Suspense
              fallback={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center min-h-screen"
                >
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                  </div>
                </motion.div>
              }
            >
              {children}
            </React.Suspense>
          </motion.div>
        </AnimatePresence>
      </RouteErrorBoundary>
    </>
  );
};

// Wrapper component for individual route transitions
interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Section transition for lazy-loaded components
interface SectionTransitionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const SectionTransition: React.FC<SectionTransitionProps> = ({
  children,
  delay = 0,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};