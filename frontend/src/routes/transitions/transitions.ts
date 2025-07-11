import { Variants } from 'framer-motion';

// Fade transition
export const fadeVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

// Slide transitions
export const slideLeftVariants: Variants = {
  initial: {
    x: '100%',
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: '-100%',
    opacity: 0,
  },
};

export const slideRightVariants: Variants = {
  initial: {
    x: '-100%',
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: '100%',
    opacity: 0,
  },
};

export const slideUpVariants: Variants = {
  initial: {
    y: '100%',
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: '-100%',
    opacity: 0,
  },
};

export const slideDownVariants: Variants = {
  initial: {
    y: '-100%',
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: '100%',
    opacity: 0,
  },
};

// Scale transitions
export const scaleVariants: Variants = {
  initial: {
    scale: 0.8,
    opacity: 0,
  },
  animate: {
    scale: 1,
    opacity: 1,
  },
  exit: {
    scale: 0.8,
    opacity: 0,
  },
};

export const scaleFadeVariants: Variants = {
  initial: {
    scale: 0.95,
    opacity: 0,
  },
  animate: {
    scale: 1,
    opacity: 1,
  },
  exit: {
    scale: 1.05,
    opacity: 0,
  },
};

// Rotate transitions
export const rotateVariants: Variants = {
  initial: {
    rotate: -180,
    opacity: 0,
  },
  animate: {
    rotate: 0,
    opacity: 1,
  },
  exit: {
    rotate: 180,
    opacity: 0,
  },
};

// Combined transitions
export const slideScaleVariants: Variants = {
  initial: {
    x: 50,
    scale: 0.95,
    opacity: 0,
  },
  animate: {
    x: 0,
    scale: 1,
    opacity: 1,
  },
  exit: {
    x: -50,
    scale: 0.95,
    opacity: 0,
  },
};

// Page transition presets
export const pageTransitions = {
  fade: {
    variants: fadeVariants,
    transition: { duration: 0.3 },
  },
  slideLeft: {
    variants: slideLeftVariants,
    transition: { type: 'tween', ease: 'easeInOut', duration: 0.4 },
  },
  slideRight: {
    variants: slideRightVariants,
    transition: { type: 'tween', ease: 'easeInOut', duration: 0.4 },
  },
  slideUp: {
    variants: slideUpVariants,
    transition: { type: 'tween', ease: 'easeInOut', duration: 0.4 },
  },
  scale: {
    variants: scaleVariants,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  scaleFade: {
    variants: scaleFadeVariants,
    transition: { duration: 0.3 },
  },
  none: {
    variants: {},
    transition: { duration: 0 },
  },
};

// Get transition variants by mode
export const getTransitionVariants = (
  mode: 'fade' | 'slide' | 'scale' | 'none' = 'fade',
  duration: number = 0.3
): Variants => {
  switch (mode) {
    case 'fade':
      return {
        ...fadeVariants,
        animate: {
          ...fadeVariants.animate,
          transition: { duration },
        },
      };
    case 'slide':
      return {
        ...slideLeftVariants,
        animate: {
          ...slideLeftVariants.animate,
          transition: { duration, type: 'tween', ease: 'easeInOut' },
        },
      };
    case 'scale':
      return {
        ...scaleVariants,
        animate: {
          ...scaleVariants.animate,
          transition: { duration, type: 'spring', stiffness: 300, damping: 30 },
        },
      };
    case 'none':
      return {
        initial: {},
        animate: {},
        exit: {},
      };
    default:
      return fadeVariants;
  }
};

// Stagger children animation
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: {
    y: 20,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
};

// List item animations
export const listItemVariants: Variants = {
  initial: {
    x: -20,
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: 20,
    opacity: 0,
  },
};

// Modal/overlay transitions
export const overlayVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

export const modalVariants: Variants = {
  initial: {
    scale: 0.9,
    opacity: 0,
    y: 20,
  },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
  },
  exit: {
    scale: 0.9,
    opacity: 0,
    y: 20,
  },
};

// Custom timing functions
export const timingFunctions = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  sharp: [0.4, 0, 0.6, 1],
  smooth: [0.25, 0.1, 0.25, 1],
};

// Spring presets
export const springPresets = {
  gentle: { type: 'spring', stiffness: 120, damping: 20 },
  wobbly: { type: 'spring', stiffness: 180, damping: 12 },
  stiff: { type: 'spring', stiffness: 400, damping: 40 },
  slow: { type: 'spring', stiffness: 60, damping: 20 },
};

// Transition utilities
export const createCustomTransition = (
  from: any,
  to: any,
  options: {
    duration?: number;
    ease?: number[] | string;
    delay?: number;
  } = {}
) => {
  const { duration = 0.3, ease = 'easeInOut', delay = 0 } = options;
  
  return {
    initial: from,
    animate: {
      ...to,
      transition: {
        duration,
        ease,
        delay,
      },
    },
    exit: from,
  };
};

// Route-specific transitions
export const routeTransitions = {
  dashboard: pageTransitions.fade,
  recipes: pageTransitions.slideLeft,
  trips: pageTransitions.scale,
  admin: pageTransitions.scaleFade,
  settings: pageTransitions.fade,
  profile: pageTransitions.slideUp,
};