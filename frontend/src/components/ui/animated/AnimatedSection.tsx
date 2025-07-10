import React from 'react';
import { motion, useInView, useAnimation } from 'framer-motion';
import { fadeIn, slideIn, scaleIn, getAnimation } from '@/utils/animations';

type AnimationType = 'fade' | 'slide' | 'scale' | 'custom';
type SlideDirection = 'left' | 'right' | 'up' | 'down';

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  /** Type of animation */
  animation?: AnimationType;
  /** Direction for slide animation */
  direction?: SlideDirection;
  /** Custom animation variants */
  variants?: any;
  /** Trigger animation when element comes into view */
  animateOnScroll?: boolean;
  /** How much of the element should be visible before triggering */
  threshold?: number;
  /** Whether to animate only once */
  once?: boolean;
  /** Delay before animation starts */
  delay?: number;
  /** Duration of the animation */
  duration?: number;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  className,
  animation = 'fade',
  direction = 'up',
  variants,
  animateOnScroll = true,
  threshold = 0.3,
  once = true,
  delay = 0,
  duration,
}) => {
  const ref = React.useRef(null);
  const controls = useAnimation();
  const inView = useInView(ref, { 
    once, 
    amount: threshold 
  });

  React.useEffect(() => {
    if (animateOnScroll && inView) {
      controls.start('animate');
    } else if (animateOnScroll && !inView && !once) {
      controls.start('initial');
    }
  }, [controls, inView, animateOnScroll, once]);

  // Get animation variants based on type
  const getAnimationVariants = () => {
    if (variants) return variants;
    
    switch (animation) {
      case 'slide':
        return slideIn(direction);
      case 'scale':
        return scaleIn;
      case 'fade':
      default:
        return fadeIn;
    }
  };

  const animationVariants = getAnimation(getAnimationVariants());

  // Add delay to animation if specified
  const modifiedVariants = delay > 0 ? {
    ...animationVariants,
    animate: {
      ...animationVariants.animate,
      transition: {
        ...animationVariants.animate?.transition,
        delay,
        duration: duration || animationVariants.animate?.transition?.duration,
      }
    }
  } : animationVariants;

  return (
    <motion.section
      ref={ref}
      className={className}
      variants={modifiedVariants}
      initial="initial"
      animate={animateOnScroll ? controls : "animate"}
      exit="exit"
    >
      {children}
    </motion.section>
  );
};

// Parallax section component
interface ParallaxSectionProps {
  children: React.ReactNode;
  className?: string;
  /** Parallax offset in pixels */
  offset?: number;
  /** Speed of parallax effect (0-1) */
  speed?: number;
}

export const ParallaxSection: React.FC<ParallaxSectionProps> = ({
  children,
  className,
  offset = 50,
  speed = 0.5,
}) => {
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [-offset * speed, offset * speed]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y }}
    >
      {children}
    </motion.div>
  );
};

// Import necessary hooks
import { useScroll, useTransform } from 'framer-motion';