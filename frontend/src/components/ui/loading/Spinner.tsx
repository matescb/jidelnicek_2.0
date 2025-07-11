import React from 'react'
import { motion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        circle: '',
        dots: 'space-x-1',
        bars: 'space-x-1',
        pulse: ''
      },
      size: {
        xs: 'scale-50',
        sm: 'scale-75',
        md: 'scale-100',
        lg: 'scale-125',
        xl: 'scale-150'
      },
      color: {
        primary: 'text-primary-600',
        secondary: 'text-secondary-600',
        destructive: 'text-error-600',
        success: 'text-success-600',
        warning: 'text-warning-600',
        current: 'text-current'
      },
      speed: {
        slow: '',
        normal: '',
        fast: ''
      }
    },
    defaultVariants: {
      variant: 'circle',
      size: 'md',
      color: 'primary',
      speed: 'normal'
    }
  }
)

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
  label?: string
  showLabel?: boolean
}

const CircleSpinner: React.FC<{ speed: string }> = ({ speed }) => {
  const duration = speed === 'slow' ? 1.5 : speed === 'fast' ? 0.6 : 1
  
  return (
    <svg 
      className="animate-spin" 
      style={{ animationDuration: `${duration}s` }}
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
      width="24"
      height="24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

const DotsSpinner: React.FC<{ speed: string }> = ({ speed }) => {
  const duration = speed === 'slow' ? 1.4 : speed === 'fast' ? 0.6 : 1
  
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-current rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration,
            repeat: Infinity,
            delay: i * (duration / 3)
          }}
        />
      ))}
    </>
  )
}

const BarsSpinner: React.FC<{ speed: string }> = ({ speed }) => {
  const duration = speed === 'slow' ? 1.2 : speed === 'fast' ? 0.5 : 0.8
  
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-1 h-6 bg-current rounded-full"
          animate={{
            scaleY: [0.5, 1, 0.5]
          }}
          transition={{
            duration,
            repeat: Infinity,
            delay: i * (duration / 4)
          }}
        />
      ))}
    </>
  )
}

const PulseSpinner: React.FC<{ speed: string }> = ({ speed }) => {
  const duration = speed === 'slow' ? 2 : speed === 'fast' ? 0.8 : 1.2
  
  return (
    <motion.div
      className="w-12 h-12 bg-current rounded-full"
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.7, 0.3, 0.7]
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

export const Spinner: React.FC<SpinnerProps> = ({
  variant = 'circle',
  size,
  color,
  speed = 'normal',
  className,
  label = 'Loading',
  showLabel = false
}) => {
  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsSpinner speed={speed} />
      case 'bars':
        return <BarsSpinner speed={speed} />
      case 'pulse':
        return <PulseSpinner speed={speed} />
      case 'circle':
      default:
        return <CircleSpinner speed={speed} />
    }
  }

  return (
    <div className={cn('inline-flex flex-col items-center justify-center gap-2', className)}>
      <div
        className={cn(spinnerVariants({ variant, size, color }))}
        role="status"
        aria-label={label}
      >
        {renderSpinner()}
      </div>
      {showLabel && (
        <span className="text-sm text-text-muted">{label}</span>
      )}
    </div>
  )
}