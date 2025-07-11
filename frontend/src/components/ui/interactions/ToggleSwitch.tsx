import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onIcon?: LucideIcon;
  offIcon?: LucideIcon;
  onColor?: string;
  offColor?: string;
  label?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onCheckedChange,
  className,
  size = 'md',
  disabled = false,
  loading = false,
  onIcon: OnIcon,
  offIcon: OffIcon,
  onColor = 'bg-blue-500',
  offColor = 'bg-gray-300',
  label,
}) => {
  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-4 w-4', icon: 'h-3 w-3', translate: 'translate-x-4' },
    md: { track: 'h-6 w-11', thumb: 'h-5 w-5', icon: 'h-3.5 w-3.5', translate: 'translate-x-5' },
    lg: { track: 'h-8 w-14', thumb: 'h-7 w-7', icon: 'h-4 w-4', translate: 'translate-x-6' },
  };

  const currentSize = sizes[size];
  const isActive = checked && !disabled;

  const handleClick = () => {
    if (!disabled && !loading) {
      onCheckedChange(!checked);
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled || loading}
        onClick={handleClick}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          currentSize.track,
          isActive ? onColor : offColor,
          (disabled || loading) && 'cursor-not-allowed opacity-50'
        )}
      >
        <motion.span
          className={cn(
            'pointer-events-none inline-flex items-center justify-center rounded-full',
            'bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
            currentSize.thumb
          )}
          animate={{
            x: checked ? currentSize.translate.replace('translate-x-', '') + 'px' : '1px',
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{
                  rotate: {
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  },
                }}
                className={cn('rounded-full border-2 border-gray-300 border-t-gray-600', currentSize.icon)}
              />
            ) : (
              <motion.div
                key={checked ? 'on' : 'off'}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {checked && OnIcon && (
                  <OnIcon className={cn('text-blue-500', currentSize.icon)} />
                )}
                {!checked && OffIcon && (
                  <OffIcon className={cn('text-gray-400', currentSize.icon)} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.span>
      </button>

      {label && (
        <label
          className={cn(
            'text-sm font-medium text-gray-700 dark:text-gray-300',
            (disabled || loading) && 'opacity-50',
            !disabled && !loading && 'cursor-pointer'
          )}
          onClick={handleClick}
        >
          {label}
        </label>
      )}
    </div>
  );
};