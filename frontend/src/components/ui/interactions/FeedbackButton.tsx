import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface FeedbackButtonProps {
  children: React.ReactNode;
  onClick: () => Promise<void> | void;
  className?: string;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  successDuration?: number;
  errorDuration?: number;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  showIcon?: boolean;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  children,
  onClick,
  className,
  loadingText = 'Loading...',
  successText = 'Success!',
  errorText = 'Error!',
  successDuration = 2000,
  errorDuration = 2000,
  icon: Icon,
  variant = 'default',
  size = 'md',
  disabled = false,
  showIcon = true,
}) => {
  const [state, setState] = useState<ButtonState>('idle');

  const handleClick = async () => {
    if (disabled || state !== 'idle') return;

    setState('loading');
    try {
      await onClick();
      setState('success');
      setTimeout(() => setState('idle'), successDuration);
    } catch (error) {
      setState('error');
      setTimeout(() => setState('idle'), errorDuration);
    }
  };

  const variants = {
    default: 'bg-blue-500 text-white hover:bg-blue-600',
    outline: 'border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const getStateStyles = () => {
    switch (state) {
      case 'success':
        return 'bg-green-500 hover:bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 hover:bg-red-500 text-white';
      default:
        return '';
    }
  };

  const shakeAnimation = {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 },
  };

  const bounceAnimation = {
    y: [0, -10, 0],
    transition: { duration: 0.3 },
  };

  return (
    <motion.button
      className={cn(
        'relative inline-flex items-center justify-center gap-2',
        'rounded-md font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        getStateStyles(),
        className
      )}
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      animate={state === 'error' ? shakeAnimation : state === 'success' ? bounceAnimation : {}}
    >
      <AnimatePresence mode="wait">
        {showIcon && (
          <motion.div
            key={state}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {state === 'loading' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {state === 'success' && (
              <Check className="h-4 w-4" />
            )}
            {state === 'error' && (
              <X className="h-4 w-4" />
            )}
            {state === 'idle' && Icon && (
              <Icon className="h-4 w-4" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {state === 'idle' && children}
          {state === 'loading' && loadingText}
          {state === 'success' && successText}
          {state === 'error' && errorText}
        </motion.span>
      </AnimatePresence>

      {/* Background animations */}
      {state === 'success' && (
        <motion.div
          className="absolute inset-0 rounded-md bg-green-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}

      {state === 'error' && (
        <motion.div
          className="absolute inset-0 rounded-md bg-red-400"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </motion.button>
  );
};