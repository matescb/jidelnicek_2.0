import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
  color: string;
}

interface LikeButtonProps {
  initialCount?: number;
  onLike?: (liked: boolean) => void;
  className?: string;
  showCount?: boolean;
  enableConfetti?: boolean;
  disabled?: boolean;
  defaultLiked?: boolean;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  initialCount = 0,
  onLike,
  className,
  showCount = true,
  enableConfetti = true,
  disabled = false,
  defaultLiked = false,
}) => {
  const [liked, setLiked] = useState(defaultLiked);
  const [count, setCount] = useState(initialCount);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const colors = ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff'];

  const handleClick = useCallback(() => {
    if (disabled || isAnimating) return;

    setIsAnimating(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((prev) => prev + (newLiked ? 1 : -1));

    if (newLiked && enableConfetti) {
      const newParticles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: 0,
        y: 0,
        angle: (360 / 12) * i,
        distance: 50 + Math.random() * 30,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(newParticles);

      setTimeout(() => {
        setParticles([]);
      }, 800);
    }

    setTimeout(() => {
      setIsAnimating(false);
    }, 300);

    onLike?.(newLiked);
  }, [liked, disabled, isAnimating, enableConfetti, colors, onLike]);

  return (
    <button
      className={cn(
        'relative flex items-center gap-2 rounded-full px-4 py-2',
        'transition-all duration-200',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      <div className="relative">
        <motion.div
          animate={{
            scale: liked ? [1, 1.2, 0.85, 1] : 1,
          }}
          transition={{
            duration: 0.4,
            ease: 'easeInOut',
          }}
        >
          <Heart
            className={cn(
              'h-5 w-5 transition-colors duration-200',
              liked ? 'fill-red-500 text-red-500' : 'text-gray-600'
            )}
          />
        </motion.div>

        {/* Particle burst effect */}
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full"
              style={{
                backgroundColor: particle.color,
              }}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: Math.cos((particle.angle * Math.PI) / 180) * particle.distance,
                y: Math.sin((particle.angle * Math.PI) / 180) * particle.distance,
                scale: [0, 1.5, 0],
                opacity: [1, 1, 0],
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: 0.8,
                ease: 'easeOut',
              }}
            />
          ))}
        </AnimatePresence>

        {/* Heart pulse effect */}
        {liked && (
          <motion.div
            className="absolute inset-0 rounded-full bg-red-500"
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </div>

      {showCount && (
        <AnimatePresence mode="wait">
          <motion.span
            key={count}
            className="text-sm font-medium text-gray-600 dark:text-gray-400"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {count}
          </motion.span>
        </AnimatePresence>
      )}
    </button>
  );
};