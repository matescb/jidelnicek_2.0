import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, getAnimation } from '@/utils/animations';

interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string;
  /** Custom animation variants */
  variants?: any;
  /** Whether to animate only once */
  once?: boolean;
  /** Custom transition configuration */
  transition?: any;
  /** Page key for AnimatePresence */
  pageKey?: string;
}

export const AnimatedPage: React.FC<AnimatedPageProps> = ({
  children,
  className,
  variants = pageTransition,
  once = true,
  transition,
  pageKey,
}) => {
  const animationVariants = getAnimation(variants);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        className={className}
        variants={animationVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Hook for page transitions
export const usePageTransition = (pathname: string) => {
  return {
    pageKey: pathname,
    variants: pageTransition,
  };
};