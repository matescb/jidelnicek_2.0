import { Variants, TargetAndTransition } from 'framer-motion';

/**
 * Animation utility library for consistent motion across the application
 * Following Material Design motion principles
 */

// Check for reduced motion preference
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Spring configurations for consistent physics
export const springPresets = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 300, damping: 24 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
  stiff: { type: 'spring', stiffness: 500, damping: 30 },
} as const;

// Duration presets (in seconds)
export const durations = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
} as const;

// Easing curves
export const easings = {
  easeOut: [0.0, 0.0, 0.2, 1.0],
  easeIn: [0.4, 0.0, 1.0, 1.0],
  easeInOut: [0.4, 0.0, 0.2, 1.0],
  sharp: [0.4, 0.0, 0.6, 1.0],
} as const;

// Base fade animation
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: durations.normal, ease: easings.easeOut }
  },
  exit: { 
    opacity: 0,
    transition: { duration: durations.fast, ease: easings.easeIn }
  },
};

// Slide animations
export const slideIn = (direction: 'left' | 'right' | 'up' | 'down' = 'left'): Variants => {
  const getOffset = () => {
    switch (direction) {
      case 'left': return { x: -20 };
      case 'right': return { x: 20 };
      case 'up': return { y: -20 };
      case 'down': return { y: 20 };
    }
  };

  return {
    initial: { opacity: 0, ...getOffset() },
    animate: { 
      opacity: 1, 
      x: 0, 
      y: 0,
      transition: springPresets.gentle
    },
    exit: { 
      opacity: 0, 
      ...getOffset(),
      transition: { duration: durations.fast, ease: easings.easeIn }
    },
  };
};

// Scale animations
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: springPresets.snappy
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: { duration: durations.fast, ease: easings.easeIn }
  },
};

// Stagger animations for lists
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: springPresets.gentle
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: durations.fast }
  },
};

// Page transitions
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: durations.normal,
      ease: easings.easeOut,
      when: 'beforeChildren',
      staggerChildren: 0.1,
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { 
      duration: durations.fast,
      ease: easings.easeIn,
    }
  },
};

// Micro-interactions
export const hover: TargetAndTransition = {
  scale: 1.02,
  transition: springPresets.snappy,
};

export const tap: TargetAndTransition = {
  scale: 0.98,
  transition: springPresets.snappy,
};

export const focus: TargetAndTransition = {
  scale: 1.02,
  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)',
  transition: springPresets.gentle,
};

// Complex animations
export const modalAnimation: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: springPresets.snappy
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 10,
    transition: { duration: durations.fast, ease: easings.easeIn }
  },
};

export const drawerAnimation = (side: 'left' | 'right' | 'top' | 'bottom' = 'left'): Variants => {
  const getInitialPosition = () => {
    switch (side) {
      case 'left': return { x: '-100%' };
      case 'right': return { x: '100%' };
      case 'top': return { y: '-100%' };
      case 'bottom': return { y: '100%' };
    }
  };

  return {
    initial: getInitialPosition(),
    animate: { 
      x: 0, 
      y: 0,
      transition: springPresets.gentle
    },
    exit: {
      ...getInitialPosition(),
      transition: { duration: durations.normal, ease: easings.easeIn }
    },
  };
};

// Skeleton loading animation
export const skeletonPulse: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Accordion/Collapsible animations
export const collapse: Variants = {
  open: {
    height: 'auto',
    opacity: 1,
    transition: springPresets.gentle,
  },
  collapsed: {
    height: 0,
    opacity: 0,
    transition: springPresets.gentle,
  },
};

// Notification animations
export const notificationSlide: Variants = {
  initial: { x: '100%', opacity: 0 },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: springPresets.snappy
  },
  exit: { 
    x: '100%', 
    opacity: 0,
    transition: { duration: durations.fast, ease: easings.easeIn }
  },
};

// Loading spinner animation
export const spin: TargetAndTransition = {
  rotate: 360,
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear',
  },
};

// Utility function to get safe animations
export const getAnimation = (animation: Variants | TargetAndTransition): Variants | TargetAndTransition => {
  if (prefersReducedMotion()) {
    // Return instant transitions for reduced motion
    if ('initial' in animation && 'animate' in animation) {
      return {
        initial: animation.initial,
        animate: {
          ...animation.animate,
          transition: { duration: 0 }
        },
        exit: animation.exit ? {
          ...animation.exit,
          transition: { duration: 0 }
        } : undefined,
      } as Variants;
    }
    return { transition: { duration: 0 } };
  }
  return animation;
};

// Gesture animations
export const swipeAnimation = {
  whileHover: hover,
  whileTap: tap,
  whileFocus: focus,
  transition: springPresets.snappy,
};

// Parallax effect
export const parallax = (offset: number = 50): Variants => ({
  initial: { y: -offset },
  animate: { 
    y: offset,
    transition: {
      duration: durations.verySlow,
      ease: 'linear',
    }
  },
});

// Text reveal animation
export const textReveal: Variants = {
  initial: { 
    opacity: 0,
    y: 20,
    clipPath: 'inset(100% 0% 0% 0%)',
  },
  animate: { 
    opacity: 1,
    y: 0,
    clipPath: 'inset(0% 0% 0% 0%)',
    transition: {
      duration: durations.slow,
      ease: easings.easeOut,
    }
  },
};

// Card flip animation
export const cardFlip: Variants = {
  initial: { rotateY: 0 },
  flipped: { 
    rotateY: 180,
    transition: springPresets.snappy
  },
};

// Utility for creating custom spring animations
export const createSpringAnimation = (
  from: any,
  to: any,
  config: typeof springPresets[keyof typeof springPresets] = springPresets.gentle
): TargetAndTransition => ({
  ...to,
  transition: config,
});

// Utility for creating custom timed animations
export const createTimedAnimation = (
  from: any,
  to: any,
  duration: number = durations.normal,
  ease: number[] | string = easings.easeOut
): Variants => ({
  initial: from,
  animate: {
    ...to,
    transition: { duration, ease }
  },
});