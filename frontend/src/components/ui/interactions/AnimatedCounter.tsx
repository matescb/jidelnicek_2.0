import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatCurrency?: boolean;
  locale?: string;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'circIn' | 'circOut' | 'circInOut';
  onComplete?: () => void;
}

const easingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  circIn: (t: number) => 1 - Math.sqrt(1 - t * t),
  circOut: (t: number) => Math.sqrt(1 - (t - 1) * (t - 1)),
  circInOut: (t: number) =>
    t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - 4 * (t - 1) * (t - 1)) + 1) / 2,
};

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  className,
  duration = 1,
  decimals = 0,
  prefix = '',
  suffix = '',
  formatCurrency = false,
  locale = 'en-US',
  easing = 'easeOut',
  onComplete,
}) => {
  const motionValue = useMotionValue(0);
  const previousValue = useRef(0);

  const formatNumber = (num: number): string => {
    if (formatCurrency) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    }

    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const displayValue = useTransform(motionValue, (latest) => {
    const formatted = formatNumber(latest);
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    const animation = animate(motionValue, value, {
      duration,
      ease: easingFunctions[easing],
      onComplete,
    });

    previousValue.current = value;

    return animation.stop;
  }, [value, duration, easing, motionValue, onComplete]);

  const isIncreasing = value > previousValue.current;
  const isDecreasing = value < previousValue.current;

  return (
    <motion.span
      className={cn('inline-block tabular-nums', className)}
      initial={false}
      animate={{
        scale: isIncreasing ? [1, 1.05, 1] : isDecreasing ? [1, 0.95, 1] : 1,
        color: isIncreasing
          ? ['currentColor', '#10b981', 'currentColor']
          : isDecreasing
          ? ['currentColor', '#ef4444', 'currentColor']
          : 'currentColor',
      }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut',
      }}
    >
      <motion.span>{displayValue}</motion.span>
    </motion.span>
  );
};