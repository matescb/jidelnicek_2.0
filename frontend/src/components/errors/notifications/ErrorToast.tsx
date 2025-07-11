import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'

export type ErrorToastType = 'error' | 'warning' | 'success' | 'info'

interface ErrorToastProps {
  /**
   * Toast ID for tracking
   */
  id: string
  /**
   * Type of toast
   */
  type?: ErrorToastType
  /**
   * Toast title
   */
  title?: string
  /**
   * Toast message
   */
  message: string
  /**
   * Action button
   */
  action?: {
    label: string
    onClick: () => void
  }
  /**
   * Auto-dismiss duration in milliseconds (0 to disable)
   */
  duration?: number
  /**
   * On close callback
   */
  onClose?: () => void
  /**
   * Position on screen
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

const typeConfig: Record<ErrorToastType, {
  icon: React.ComponentType<{ className?: string }>
  colors: {
    bg: string
    border: string
    icon: string
    text: string
  }
}> = {
  error: {
    icon: AlertCircle,
    colors: {
      bg: 'bg-error-50 dark:bg-error-950',
      border: 'border-error-200 dark:border-error-800',
      icon: 'text-error-600 dark:text-error-400',
      text: 'text-error-800 dark:text-error-200'
    }
  },
  warning: {
    icon: AlertTriangle,
    colors: {
      bg: 'bg-warning-50 dark:bg-warning-950',
      border: 'border-warning-200 dark:border-warning-800',
      icon: 'text-warning-600 dark:text-warning-400',
      text: 'text-warning-800 dark:text-warning-200'
    }
  },
  success: {
    icon: CheckCircle,
    colors: {
      bg: 'bg-success-50 dark:bg-success-950',
      border: 'border-success-200 dark:border-success-800',
      icon: 'text-success-600 dark:text-success-400',
      text: 'text-success-800 dark:text-success-200'
    }
  },
  info: {
    icon: Info,
    colors: {
      bg: 'bg-info-50 dark:bg-info-950',
      border: 'border-info-200 dark:border-info-800',
      icon: 'text-info-600 dark:text-info-400',
      text: 'text-info-800 dark:text-info-200'
    }
  }
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  id,
  type = 'error',
  title,
  message,
  action,
  duration = 5000,
  onClose,
  position = 'top-right'
}) => {
  const { t } = useTypedTranslation()
  const config = typeConfig[type]
  const Icon = config.icon

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const getPositionStyles = () => {
    switch (position) {
      case 'top-left':
        return { top: 20, left: 20 }
      case 'top-right':
        return { top: 20, right: 20 }
      case 'bottom-left':
        return { bottom: 20, left: 20 }
      case 'bottom-right':
        return { bottom: 20, right: 20 }
      case 'top-center':
        return { top: 20, left: '50%', x: '-50%' }
      case 'bottom-center':
        return { bottom: 20, left: '50%', x: '-50%' }
    }
  }

  const getAnimationProps = () => {
    const isTop = position.includes('top')
    const isLeft = position.includes('left')
    const isCenter = position.includes('center')

    if (isCenter) {
      return {
        initial: { opacity: 0, y: isTop ? -20 : 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: isTop ? -20 : 20 }
      }
    }

    return {
      initial: { opacity: 0, x: isLeft ? -100 : 100 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: isLeft ? -100 : 100 }
    }
  }

  return (
    <motion.div
      key={id}
      {...getAnimationProps()}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={getPositionStyles()}
      className={`fixed z-50 max-w-md w-full pointer-events-auto`}
    >
      <div className={`${config.colors.bg} ${config.colors.border} border rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
            >
              <Icon className={`h-5 w-5 ${config.colors.icon} flex-shrink-0`} />
            </motion.div>

            <div className="flex-1">
              {title && (
                <h4 className={`font-medium ${config.colors.text} mb-1`}>
                  {title}
                </h4>
              )}
              <p className={`text-sm ${config.colors.text} opacity-90`}>
                {message}
              </p>
              {action && (
                <button
                  onClick={action.onClick}
                  className={`mt-2 text-sm font-medium ${config.colors.icon} hover:underline focus:outline-none`}
                >
                  {action.label}
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className={`${config.colors.icon} hover:opacity-70 transition-opacity`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar for auto-dismiss */}
        {duration > 0 && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`h-1 ${config.colors.bg} opacity-50 origin-left`}
            style={{ backgroundColor: config.colors.icon.replace('text-', 'bg-') }}
          />
        )}
      </div>
    </motion.div>
  )
}

// Toast Container Component
interface ToastContainerProps {
  /**
   * Active toasts
   */
  toasts: Array<{
    id: string
    type?: ErrorToastType
    title?: string
    message: string
    action?: {
      label: string
      onClick: () => void
    }
    duration?: number
  }>
  /**
   * Remove toast callback
   */
  onRemove: (id: string) => void
  /**
   * Position on screen
   */
  position?: ErrorToastProps['position']
}

export const ErrorToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
  position = 'top-right'
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {toasts.map((toast, index) => (
          <ErrorToast
            key={toast.id}
            {...toast}
            position={position}
            onClose={() => onRemove(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Hook for managing toasts
export const useErrorToast = () => {
  const [toasts, setToasts] = React.useState<ToastContainerProps['toasts']>([])

  const showToast = React.useCallback((toast: Omit<ToastContainerProps['toasts'][0], 'id'>) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showError = React.useCallback((message: string, title?: string) => {
    showToast({ type: 'error', message, title })
  }, [showToast])

  const showWarning = React.useCallback((message: string, title?: string) => {
    showToast({ type: 'warning', message, title })
  }, [showToast])

  const showSuccess = React.useCallback((message: string, title?: string) => {
    showToast({ type: 'success', message, title })
  }, [showToast])

  const showInfo = React.useCallback((message: string, title?: string) => {
    showToast({ type: 'info', message, title })
  }, [showToast])

  return {
    toasts,
    showToast,
    removeToast,
    showError,
    showWarning,
    showSuccess,
    showInfo
  }
}