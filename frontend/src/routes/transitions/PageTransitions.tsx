import React, { ReactNode, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLocation, useNavigationType } from 'react-router-dom';
import { useTransitionProvider } from './TransitionProvider';
import { useNavigationDirection } from './hooks';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { ProgressBar } from './ProgressBar';

interface PageTransitionsProps {
  children: ReactNode;
  mode?: TransitionMode;
  direction?: TransitionDirection;
  duration?: number;
  showProgress?: boolean;
  className?: string;
  onTransitionStart?: () => void;
  onTransitionComplete?: () => void;
  onTransitionEnd?: () => void;
  preserveScroll?: boolean;
  customTransition?: Variants;
  easing?: string | number[];
  stagger?: number;
  skipInitial?: boolean;
}

export type TransitionMode = 'fade' | 'slide' | 'scale' | 'flip' | 'slideUp' | 'slideDown' | 'zoom' | 'rotate' | 'none';
export type TransitionDirection = 'forward' | 'backward' | 'auto';

// Enhanced transition variants with direction awareness
const transitionVariants: Record<TransitionMode, Record<TransitionDirection, Variants>> = {
  fade: {
    forward: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    backward: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    auto: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
  },
  slide: {
    forward: {
      initial: { x: '100%', opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: '-100%', opacity: 0 },
    },
    backward: {
      initial: { x: '-100%', opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: '100%', opacity: 0 },
    },
    auto: {
      initial: { x: '100%', opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: '-100%', opacity: 0 },
    },
  },
  slideUp: {
    forward: {
      initial: { y: '100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '-100%', opacity: 0 },
    },
    backward: {
      initial: { y: '-100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 },
    },
    auto: {
      initial: { y: '100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '-100%', opacity: 0 },
    },
  },
  slideDown: {
    forward: {
      initial: { y: '-100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 },
    },
    backward: {
      initial: { y: '100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '-100%', opacity: 0 },
    },
    auto: {
      initial: { y: '-100%', opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 },
    },
  },
  scale: {
    forward: {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 1.2, opacity: 0 },
    },
    backward: {
      initial: { scale: 1.2, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.8, opacity: 0 },
    },
    auto: {
      initial: { scale: 0.95, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.95, opacity: 0 },
    },
  },
  zoom: {
    forward: {
      initial: { scale: 0, opacity: 0, rotate: 180 },
      animate: { scale: 1, opacity: 1, rotate: 0 },
      exit: { scale: 2, opacity: 0, rotate: -180 },
    },
    backward: {
      initial: { scale: 2, opacity: 0, rotate: -180 },
      animate: { scale: 1, opacity: 1, rotate: 0 },
      exit: { scale: 0, opacity: 0, rotate: 180 },
    },
    auto: {
      initial: { scale: 0.5, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 1.5, opacity: 0 },
    },
  },
  flip: {
    forward: {
      initial: { rotateY: 90, opacity: 0 },
      animate: { rotateY: 0, opacity: 1 },
      exit: { rotateY: -90, opacity: 0 },
    },
    backward: {
      initial: { rotateY: -90, opacity: 0 },
      animate: { rotateY: 0, opacity: 1 },
      exit: { rotateY: 90, opacity: 0 },
    },
    auto: {
      initial: { rotateY: 90, opacity: 0 },
      animate: { rotateY: 0, opacity: 1 },
      exit: { rotateY: -90, opacity: 0 },
    },
  },
  rotate: {
    forward: {
      initial: { rotate: 180, scale: 0.8, opacity: 0 },
      animate: { rotate: 0, scale: 1, opacity: 1 },
      exit: { rotate: -180, scale: 0.8, opacity: 0 },
    },
    backward: {
      initial: { rotate: -180, scale: 0.8, opacity: 0 },
      animate: { rotate: 0, scale: 1, opacity: 1 },
      exit: { rotate: 180, scale: 0.8, opacity: 0 },
    },
    auto: {
      initial: { rotate: 90, scale: 0.9, opacity: 0 },
      animate: { rotate: 0, scale: 1, opacity: 1 },
      exit: { rotate: -90, scale: 0.9, opacity: 0 },
    },
  },
  none: {
    forward: {
      initial: {},
      animate: {},
      exit: {},
    },
    backward: {
      initial: {},
      animate: {},
      exit: {},
    },
    auto: {
      initial: {},
      animate: {},
      exit: {},
    },
  },
};

export const PageTransitions: React.FC<PageTransitionsProps> = ({
  children,
  mode,
  direction = 'auto',
  duration,
  showProgress = true,
  className = '',
  onTransitionStart,
  onTransitionComplete,
  onTransitionEnd,
  preserveScroll = true,
  customTransition,
  easing = [0.4, 0, 0.2, 1],
  stagger = 0,
  skipInitial = false,
}) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { settings, getRouteTransition } = useTransitionProvider();
  const navigationDirection = useNavigationDirection();

  // Determine the effective transition mode
  const effectiveMode = mode || getRouteTransition(location.pathname)?.mode || settings.defaultTransition;
  
  // Determine the effective direction
  const effectiveDirection = direction === 'auto' 
    ? (navigationDirection || (navigationType === 'POP' ? 'backward' : 'forward'))
    : direction;

  // Get the appropriate variants
  const variants = useMemo(() => {
    if (customTransition) return customTransition;
    
    const routeConfig = getRouteTransition(location.pathname);
    if (routeConfig?.customTransition) return routeConfig.customTransition;
    
    return transitionVariants[effectiveMode][effectiveDirection];
  }, [effectiveMode, effectiveDirection, location.pathname, customTransition, getRouteTransition]);

  // Calculate transition duration
  const transitionDuration = useMemo(() => {
    const baseDuration = duration || getRouteTransition(location.pathname)?.duration || 0.3;
    return baseDuration * settings.speedMultiplier;
  }, [duration, location.pathname, settings.speedMultiplier, getRouteTransition]);

  // Handle transition callbacks
  useEffect(() => {
    if (onTransitionStart) {
      onTransitionStart();
    }

    const timer = setTimeout(() => {
      if (onTransitionComplete) {
        onTransitionComplete();
      }
    }, transitionDuration * 1000);

    return () => clearTimeout(timer);
  }, [location.pathname, onTransitionStart, onTransitionComplete, transitionDuration]);

  // Track transition state for advanced callbacks
  const handleAnimationComplete = useCallback(() => {
    if (onTransitionEnd) {
      onTransitionEnd();
    }
  }, [onTransitionEnd]);

  // Handle scroll restoration
  useEffect(() => {
    if (!preserveScroll) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, preserveScroll]);

  if (!settings.enabled) {
    return <>{children}</>;
  }

  return (
    <>
      {showProgress && <ProgressBar />}
      <RouteErrorBoundary>
        <AnimatePresence mode="wait" initial={!skipInitial}>
          <motion.div
            key={location.pathname}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: transitionDuration,
              ease: easing,
              perspective: 1000,
              staggerChildren: stagger,
            }}
            onAnimationComplete={handleAnimationComplete}
            className={`page-transition ${effectiveMode} ${className}`}
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              transformStyle: 'preserve-3d',
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

// Enhanced individual page transition wrapper
interface PageTransitionWrapperProps {
  children: ReactNode;
  mode?: TransitionMode;
  duration?: number;
  delay?: number;
  className?: string;
  onEnter?: () => void;
  onExit?: () => void;
}

export const PageTransitionWrapper: React.FC<PageTransitionWrapperProps> = ({
  children,
  mode = 'fade',
  duration = 0.3,
  delay = 0,
  className = '',
  onEnter,
  onExit,
}) => {
  const { settings } = useTransitionProvider();
  const effectiveDuration = duration * settings.speedMultiplier;

  useEffect(() => {
    if (onEnter) {
      const timer = setTimeout(onEnter, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [onEnter, delay]);

  useEffect(() => {
    return () => {
      if (onExit) {
        onExit();
      }
    };
  }, [onExit]);

  const variants = transitionVariants[mode]['forward'];

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: effectiveDuration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Staggered content animation
interface StaggeredContentProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export const StaggeredContent: React.FC<StaggeredContentProps> = ({
  children,
  staggerDelay = 0.1,
  className = '',
}) => {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        animate: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

// Staggered item animation
interface StaggeredItemProps {
  children: ReactNode;
  className?: string;
}

export const StaggeredItem: React.FC<StaggeredItemProps> = ({
  children,
  className = '',
}) => {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { y: 20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -20, opacity: 0 },
      }}
    >
      {children}
    </motion.div>
  );
};