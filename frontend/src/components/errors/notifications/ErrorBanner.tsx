import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'

export type ErrorBannerType = 'error' | 'warning' | 'success' | 'info'

interface ErrorBannerProps {
  /**
   * Type of banner
   */
  type?: ErrorBannerType
  /**
   * Banner title
   */
  title?: string
  /**
   * Banner message
   */
  message: string
  /**
   * Show as fixed banner at top/bottom
   */
  fixed?: boolean
  /**
   * Position when fixed
   */
  position?: 'top' | 'bottom'
  /**
   * Dismissible
   */
  dismissible?: boolean
  /**
   * On dismiss callback
   */
  onDismiss?: () => void
  /**
   * Primary action
   */
  primaryAction?: {
    label: string
    onClick: () => void
  }
  /**
   * Secondary action
   */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  /**
   * Show icon
   */
  showIcon?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Slim variant
   */
  slim?: boolean
}

const typeConfig: Record<ErrorBannerType, {
  icon: React.ComponentType<{ className?: string }>
  colors: {
    bg: string
    border: string
    icon: string
    text: string
    button: string
  }
}> = {
  error: {
    icon: AlertCircle,
    colors: {
      bg: 'bg-error-50 dark:bg-error-950',
      border: 'border-error-200 dark:border-error-800',
      icon: 'text-error-600 dark:text-error-400',
      text: 'text-error-800 dark:text-error-200',
      button: 'text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300'
    }
  },
  warning: {
    icon: AlertTriangle,
    colors: {
      bg: 'bg-warning-50 dark:bg-warning-950',
      border: 'border-warning-200 dark:border-warning-800',
      icon: 'text-warning-600 dark:text-warning-400',
      text: 'text-warning-800 dark:text-warning-200',
      button: 'text-warning-600 hover:text-warning-700 dark:text-warning-400 dark:hover:text-warning-300'
    }
  },
  success: {
    icon: CheckCircle,
    colors: {
      bg: 'bg-success-50 dark:bg-success-950',
      border: 'border-success-200 dark:border-success-800',
      icon: 'text-success-600 dark:text-success-400',
      text: 'text-success-800 dark:text-success-200',
      button: 'text-success-600 hover:text-success-700 dark:text-success-400 dark:hover:text-success-300'
    }
  },
  info: {
    icon: Info,
    colors: {
      bg: 'bg-info-50 dark:bg-info-950',
      border: 'border-info-200 dark:border-info-800',
      icon: 'text-info-600 dark:text-info-400',
      text: 'text-info-800 dark:text-info-200',
      button: 'text-info-600 hover:text-info-700 dark:text-info-400 dark:hover:text-info-300'
    }
  }
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  type = 'error',
  title,
  message,
  fixed = false,
  position = 'top',
  dismissible = true,
  onDismiss,
  primaryAction,
  secondaryAction,
  showIcon = true,
  className = '',
  slim = false
}) => {
  const { t } = useTypedTranslation()
  const config = typeConfig[type]
  const Icon = config.icon

  const containerClasses = `
    ${config.colors.bg} 
    ${config.colors.border} 
    border-y
    ${fixed ? 'fixed left-0 right-0 z-40' : 'relative'}
    ${fixed && position === 'top' ? 'top-0' : ''}
    ${fixed && position === 'bottom' ? 'bottom-0' : ''}
    ${className}
  `

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
        transition={{ duration: 0.3 }}
        className={containerClasses}
      >
        <div className={`${slim ? 'py-2' : 'py-4'} px-4 sm:px-6 lg:px-8`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              {showIcon && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                  className="flex-shrink-0"
                >
                  <Icon className={`${slim ? 'h-4 w-4' : 'h-5 w-5'} ${config.colors.icon}`} />
                </motion.div>
              )}
              
              <div className={`${showIcon ? 'ml-3' : ''} flex-1`}>
                <div className={`${slim ? 'flex items-center gap-4' : ''}`}>
                  {title && (
                    <h3 className={`${slim ? 'text-sm' : 'text-base'} font-medium ${config.colors.text}`}>
                      {title}
                    </h3>
                  )}
                  <p className={`${slim ? 'text-sm' : title ? 'mt-1 text-sm' : 'text-sm'} ${config.colors.text} opacity-90`}>
                    {message}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {(primaryAction || secondaryAction) && (
                <div className={`flex items-center gap-3 ${slim ? 'ml-4' : 'ml-6'}`}>
                  {secondaryAction && (
                    <button
                      onClick={secondaryAction.onClick}
                      className={`text-sm font-medium ${config.colors.button} whitespace-nowrap`}
                    >
                      {secondaryAction.label}
                    </button>
                  )}
                  {primaryAction && (
                    <Button
                      size={slim ? 'sm' : 'default'}
                      variant={type === 'error' ? 'destructive' : 'default'}
                      onClick={primaryAction.onClick}
                      className="whitespace-nowrap"
                    >
                      {primaryAction.label}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}

              {/* Dismiss button */}
              {dismissible && onDismiss && (
                <button
                  onClick={onDismiss}
                  className={`ml-4 flex-shrink-0 ${config.colors.icon} hover:opacity-70 transition-opacity`}
                >
                  <X className={slim ? 'h-4 w-4' : 'h-5 w-5'} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Persistent banner component with local storage
interface PersistentErrorBannerProps extends ErrorBannerProps {
  /**
   * Unique ID for persistence
   */
  id: string
  /**
   * Show only once per session
   */
  showOncePerSession?: boolean
  /**
   * Show only once ever
   */
  showOnce?: boolean
}

export const PersistentErrorBanner: React.FC<PersistentErrorBannerProps> = ({
  id,
  showOncePerSession = false,
  showOnce = false,
  onDismiss,
  ...props
}) => {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const storageKey = `banner_dismissed_${id}`
    const sessionKey = `banner_session_${id}`

    if (showOnce) {
      const isDismissed = localStorage.getItem(storageKey) === 'true'
      setIsVisible(!isDismissed)
    } else if (showOncePerSession) {
      const isDismissed = sessionStorage.getItem(sessionKey) === 'true'
      setIsVisible(!isDismissed)
    } else {
      setIsVisible(true)
    }
  }, [id, showOnce, showOncePerSession])

  const handleDismiss = () => {
    const storageKey = `banner_dismissed_${id}`
    const sessionKey = `banner_session_${id}`

    if (showOnce) {
      localStorage.setItem(storageKey, 'true')
    } else if (showOncePerSession) {
      sessionStorage.setItem(sessionKey, 'true')
    }

    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  return <ErrorBanner {...props} onDismiss={handleDismiss} />
}