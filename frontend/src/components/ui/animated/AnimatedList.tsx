import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem, getAnimation } from '@/utils/animations';

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each item animation in seconds */
  staggerDelay?: number;
  /** Initial delay before starting animations */
  delayChildren?: number;
  /** Whether to animate on scroll */
  animateOnScroll?: boolean;
  /** Custom variants for the container */
  variants?: any;
  /** Custom variants for items */
  itemVariants?: any;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className,
  staggerDelay = 0.05,
  delayChildren = 0.02,
  animateOnScroll = false,
  variants = staggerContainer,
  itemVariants = staggerItem,
}) => {
  const containerVariants = {
    ...variants,
    animate: {
      ...variants.animate,
      transition: {
        ...variants.animate?.transition,
        staggerChildren: staggerDelay,
        delayChildren: delayChildren,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={getAnimation(containerVariants)}
      initial="initial"
      animate="animate"
      exit="exit"
      viewport={animateOnScroll ? { once: true, amount: 0.3 } : undefined}
      whileInView={animateOnScroll ? "animate" : undefined}
    >
      <AnimatePresence>
        {React.Children.map(children, (child, index) => (
          <AnimatedListItem key={index} variants={itemVariants}>
            {child}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

interface AnimatedListItemProps {
  children: React.ReactNode;
  variants?: any;
  className?: string;
  onClick?: () => void;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  variants = staggerItem,
  className,
  onClick,
}) => {
  return (
    <motion.div
      className={className}
      variants={getAnimation(variants)}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
};