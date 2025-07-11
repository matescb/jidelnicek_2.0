import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, ChevronDown } from 'lucide-react'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'

export type ErrorAlertType = 'error' | 'warning' | 'success' | 'info'

interface ErrorAlertProps {
  /**
   * Type of alert
   */
  type?: ErrorAlertType
  /**
   * Alert title
   */
  title?: string
  /**
   * Alert message
   */
  message: string
  /**
   * Additional details
   */
  details?: string | React.ReactNode
  /**
   * Show icon
   */
  showIcon?: boolean
  /**
   * Dismissible
   */
  dismissible?: boolean
  /**
   * On dismiss callback
   */
  onDismiss?: () => void
  /**
   * Collapsible details
   */
  collapsible?: boolean
  /**
   * Initially collapsed
   */
  initiallyCollapsed?: boolean
  /**
   * Alert actions
   */
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }>
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Compact variant
   */
  compact?: boolean
}

const typeConfig: Record<ErrorAlertType, {
  icon: React.ComponentType<{ className?: string }>
  colors: {
    bg: string
    border: string
    icon: string
    title: string
    text: string
    details: string
  }
}> = {
  error: {
    icon: AlertCircle,
    colors: {
      bg: 'bg-error-50 dark:bg-error-950',
      border: 'border-error-200 dark:border-error-800',
      icon: 'text-error-600 dark:text-error-400',
      title: 'text-error-800 dark:text-error-200',
      text: 'text-error-700 dark:text-error-300',
      details: 'bg-error-100 dark:bg-error-900 text-error-800 dark:text-error-200'
    }
  },
  warning: {
    icon: AlertTriangle,
    colors: {
      bg: 'bg-warning-50 dark:bg-warning-950',
      border: 'border-warning-200 dark:border-warning-800',
      icon: 'text-warning-600 dark:text-warning-400',
      title: 'text-warning-800 dark:text-warning-200',
      text: 'text-warning-700 dark:text-warning-300',
      details: 'bg-warning-100 dark:bg-warning-900 text-warning-800 dark:text-warning-200'
    }
  },
  success: {
    icon: CheckCircle,
    colors: {
      bg: 'bg-success-50 dark:bg-success-950',
      border: 'border-success-200 dark:border-success-800',
      icon: 'text-success-600 dark:text-success-400',
      title: 'text-success-800 dark:text-success-200',
      text: 'text-success-700 dark:text-success-300',
      details: 'bg-success-100 dark:bg-success-900 text-success-800 dark:text-success-200'
    }
  },
  info: {
    icon: Info,
    colors: {
      bg: 'bg-info-50 dark:bg-info-950',
      border: 'border-info-200 dark:border-info-800',
      icon: 'text-info-600 dark:text-info-400',
      title: 'text-info-800 dark:text-info-200',
      text: 'text-info-700 dark:text-info-300',
      details: 'bg-info-100 dark:bg-info-900 text-info-800 dark:text-info-200'
    }
  }
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  type = 'error',
  title,
  message,
  details,
  showIcon = true,
  dismissible = false,
  onDismiss,
  collapsible = false,
  initiallyCollapsed = true,
  actions,
  className = '',
  compact = false
}) => {
  const { t } = useTypedTranslation()
  const [isCollapsed, setIsCollapsed] = React.useState(initiallyCollapsed && collapsible)
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`
        ${config.colors.bg} 
        ${config.colors.border} 
        border rounded-lg
        ${compact ? 'p-3' : 'p-4'}
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="flex-shrink-0"
          >
            <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${config.colors.icon} mt-0.5`} />
          </motion.div>
        )}

        <div className="flex-1">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {title && (
                <h4 className={`font-medium ${config.colors.title} ${compact ? 'text-sm' : 'text-base'}`}>
                  {title}
                </h4>
              )}
              <p className={`${title ? 'mt-1' : ''} ${config.colors.text} ${compact ? 'text-sm' : 'text-base'}`}>
                {message}
              </p>
            </div>

            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className={`ml-4 ${config.colors.icon} hover:opacity-70 transition-opacity flex-shrink-0`}
              >
                <X className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
              </button>
            )}
          </div>

          {/* Collapsible toggle */}
          {details && collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`
                mt-2 inline-flex items-center gap-1 
                ${config.colors.icon} hover:opacity-80 
                text-sm font-medium
              `}
            >
              <motion.div
                animate={{ rotate: isCollapsed ? 0 : 180 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
              {isCollapsed ? t('errors.showDetails') : t('errors.hideDetails')}
            </button>
          )}

          {/* Details */}
          <AnimatePresence>
            {details && (!collapsible || !isCollapsed) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`mt-3 ${config.colors.details} rounded p-3 text-sm`}>
                  {typeof details === 'string' ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs">{details}</pre>
                  ) : (
                    details
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          {actions && actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`
                    text-sm font-medium px-3 py-1.5 rounded
                    transition-colors
                    ${action.variant === 'primary'
                      ? `${config.colors.bg} ${config.colors.border} border ${config.colors.title} hover:opacity-80`
                      : `${config.colors.icon} hover:underline`
                    }
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Alert Stack Component for multiple alerts
interface AlertStackProps {
  /**
   * Array of alerts
   */
  alerts: Array<{
    id: string
    type?: ErrorAlertType
    title?: string
    message: string
    details?: string | React.ReactNode
    dismissible?: boolean
  }>
  /**
   * Remove alert callback
   */
  onRemove: (id: string) => void
  /**
   * Maximum visible alerts
   */
    maxVisible?: number
  /**
   * Additional CSS classes
   */
  className?: string
}

export const ErrorAlertStack: React.FC<AlertStackProps> = ({
  alerts,
  onRemove,
  maxVisible = 3,
  className = ''
}) => {
  const visibleAlerts = alerts.slice(0, maxVisible)
  const hiddenCount = alerts.length - maxVisible

  return (
    <div className={`space-y-3 ${className}`}>
      <AnimatePresence>
        {visibleAlerts.map((alert) => (
          <ErrorAlert
            key={alert.id}
            {...alert}
            onDismiss={alert.dismissible ? () => onRemove(alert.id) : undefined}
          />
        ))}
      </AnimatePresence>
      
      {hiddenCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-text-muted text-center"
        >
          {hiddenCount} more alert{hiddenCount > 1 ? 's' : ''} hidden
        </motion.div>
      )}
    </div>
  )
}