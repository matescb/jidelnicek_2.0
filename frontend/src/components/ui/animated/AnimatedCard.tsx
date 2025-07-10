import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hover, tap, focus, scaleIn, getAnimation, cardFlip } from '@/utils/animations';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  /** Enable hover animations */
  hoverEffect?: boolean;
  /** Enable tap animations */
  tapEffect?: boolean;
  /** Enable focus animations */
  focusEffect?: boolean;
  /** Custom hover scale */
  hoverScale?: number;
  /** Enable 3D tilt effect on hover */
  tiltEffect?: boolean;
  /** Maximum tilt angle */
  maxTilt?: number;
  /** Enable flip animation */
  flipOnClick?: boolean;
  /** Back content for flip cards */
  backContent?: React.ReactNode;
  /** Animation variants */
  variants?: any;
  /** Click handler */
  onClick?: () => void;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className,
  hoverEffect = true,
  tapEffect = true,
  focusEffect = true,
  hoverScale = 1.02,
  tiltEffect = false,
  maxTilt = 10,
  flipOnClick = false,
  backContent,
  variants = scaleIn,
  onClick,
}) => {
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [rotateX, setRotateX] = React.useState(0);
  const [rotateY, setRotateY] = React.useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltEffect) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);
    
    setRotateX(-percentY * maxTilt);
    setRotateY(percentX * maxTilt);
  };

  const handleMouseLeave = () => {
    if (!tiltEffect) return;
    setRotateX(0);
    setRotateY(0);
  };

  const handleClick = () => {
    if (flipOnClick && backContent) {
      setIsFlipped(!isFlipped);
    }
    onClick?.();
  };

  const cardStyle = tiltEffect ? {
    rotateX,
    rotateY,
    transformPerspective: 1000,
  } : {};

  const animationProps = {
    ...(hoverEffect && { whileHover: { scale: hoverScale, ...hover } }),
    ...(tapEffect && { whileTap: tap }),
    ...(focusEffect && { whileFocus: focus }),
  };

  if (flipOnClick && backContent) {
    return (
      <motion.div
        className={cn("relative preserve-3d cursor-pointer", className)}
        style={{ perspective: 1000 }}
        onClick={handleClick}
      >
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              className="w-full backface-hidden"
              variants={getAnimation(variants)}
              initial="initial"
              animate="animate"
              exit={{ rotateY: 90 }}
              transition={{ duration: 0.3 }}
              style={cardStyle}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              {...animationProps}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="back"
              className="w-full backface-hidden"
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: -90 }}
              transition={{ duration: 0.3 }}
              style={{ ...cardStyle, rotateY: 180 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              {...animationProps}
            >
              {backContent}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      variants={getAnimation(variants)}
      initial="initial"
      animate="animate"
      exit="exit"
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      {...animationProps}
    >
      {children}
    </motion.div>
  );
};

// Specialized card for images with loading states
interface AnimatedImageCardProps extends AnimatedCardProps {
  src: string;
  alt: string;
  /** Show skeleton while loading */
  showSkeleton?: boolean;
}

export const AnimatedImageCard: React.FC<AnimatedImageCardProps> = ({
  src,
  alt,
  showSkeleton = true,
  children,
  ...props
}) => {
  const [isLoading, setIsLoading] = React.useState(true);

  return (
    <AnimatedCard {...props}>
      <div className="relative">
        {showSkeleton && isLoading && (
          <motion.div
            className="absolute inset-0 bg-gray-200 dark:bg-gray-700"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoading(false)}
          className={cn("w-full h-full object-cover", isLoading && "opacity-0")}
        />
        {children}
      </div>
    </AnimatedCard>
  );
};

