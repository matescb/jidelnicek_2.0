import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const toastVariants = cva(
  'relative flex items-start gap-3 w-full max-w-md p-4 pr-6 rounded-lg border shadow-lg',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground border-border',
        success: 'bg-success-50 text-success-900 border-success-200',
        error: 'bg-error-50 text-error-900 border-error-200',
        warning: 'bg-warning-50 text-warning-900 border-warning-200',
        info: 'bg-info-50 text-info-900 border-info-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const toastIconVariants = {
  default: null,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title: string
  description?: string
  action?: React.ReactNode
  onClose?: () => void
  duration?: number
  persistent?: boolean
  showProgress?: boolean
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ 
    className, 
    variant = 'default', 
    title,
    description,
    action,
    onClose,
    duration = 5000,
    persistent = false,
    showProgress = true,
    ...props 
  }, ref) => {
    const [progress, setProgress] = React.useState(100)
    const Icon = toastIconVariants[variant || 'default']

    React.useEffect(() => {
      if (!persistent && duration > 0 && showProgress) {
        const interval = 50 // Update every 50ms
        const decrement = (100 / duration) * interval

        const timer = setInterval(() => {
          setProgress((prev) => {
            const newProgress = prev - decrement
            if (newProgress <= 0) {
              clearInterval(timer)
              return 0
            }
            return newProgress
          })
        }, interval)

        return () => clearInterval(timer)
      }
    }, [duration, persistent, showProgress])

    React.useEffect(() => {
      if (!persistent && duration > 0 && progress === 0 && onClose) {
        onClose()
      }
    }, [progress, onClose, persistent, duration])

    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        role="alert"
        aria-live="polite"
        {...props}
      >
        {Icon && (
          <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold leading-none">{title}</p>
          {description && (
            <p className="text-sm opacity-90">{description}</p>
          )}
          {action && (
            <div className="mt-2">{action}</div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-1 top-1 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {showProgress && !persistent && duration > 0 && (
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-current opacity-20 rounded-b-lg"
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        )}
      </div>
    )
  }
)

Toast.displayName = 'Toast'

export { Toast, toastVariants }