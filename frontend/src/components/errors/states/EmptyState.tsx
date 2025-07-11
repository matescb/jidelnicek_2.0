import React from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, FileText, Package, Users, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

export type EmptyStateType = 'search' | 'list' | 'data' | 'products' | 'users' | 'default'

interface EmptyStateProps {
  /**
   * Type of empty state to display
   */
  type?: EmptyStateType
  /**
   * Custom title
   */
  title?: string
  /**
   * Custom message
   */
  message?: string
  /**
   * Show illustration
   */
  showIllustration?: boolean
  /**
   * Custom illustration
   */
  customIllustration?: React.ReactNode
  /**
   * Primary action
   */
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  /**
   * Secondary action
   */
  secondaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Compact mode for smaller containers
   */
  compact?: boolean
}

const typeConfig: Record<EmptyStateType, {
  icon: React.ComponentType<{ className?: string }>
  defaultTitle: string
  defaultMessage: string
  illustrationType: string
}> = {
  search: {
    icon: Search,
    defaultTitle: 'errors.empty.search.title',
    defaultMessage: 'errors.empty.search.message',
    illustrationType: 'search'
  },
  list: {
    icon: FileText,
    defaultTitle: 'errors.empty.list.title',
    defaultMessage: 'errors.empty.list.message',
    illustrationType: 'empty'
  },
  data: {
    icon: Inbox,
    defaultTitle: 'errors.empty.data.title',
    defaultMessage: 'errors.empty.data.message',
    illustrationType: 'empty'
  },
  products: {
    icon: Package,
    defaultTitle: 'errors.empty.products.title',
    defaultMessage: 'errors.empty.products.message',
    illustrationType: 'empty'
  },
  users: {
    icon: Users,
    defaultTitle: 'errors.empty.users.title',
    defaultMessage: 'errors.empty.users.message',
    illustrationType: 'empty'
  },
  default: {
    icon: Inbox,
    defaultTitle: 'errors.empty.default.title',
    defaultMessage: 'errors.empty.default.message',
    illustrationType: 'empty'
  }
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  message,
  showIllustration = true,
  customIllustration,
  primaryAction,
  secondaryAction,
  className = '',
  compact = false
}) => {
  const { t } = useTypedTranslation()
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-16'} px-4 ${className}`}
    >
      {/* Illustration */}
      {showIllustration && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className={compact ? 'mb-4' : 'mb-8'}
        >
          {customIllustration || (
            <ErrorIllustration
              type={config.illustrationType}
              className={compact ? 'w-32 h-32' : 'w-48 h-48'}
              animated
            />
          )}
        </motion.div>
      )}

      {/* Icon */}
      {!showIllustration && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className={compact ? 'mb-4' : 'mb-6'}
        >
          <div className="p-4 rounded-full bg-surface-elevated">
            <Icon className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} text-text-muted`} />
          </div>
        </motion.div>
      )}

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-center max-w-md"
      >
        <h3 className={`font-semibold text-text-primary ${compact ? 'text-lg mb-2' : 'text-xl mb-3'}`}>
          {title || t(config.defaultTitle)}
        </h3>
        <p className={`text-text-secondary ${compact ? 'text-sm' : 'text-base'}`}>
          {message || t(config.defaultMessage)}
        </p>
      </motion.div>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className={`flex flex-col sm:flex-row gap-3 ${compact ? 'mt-4' : 'mt-6'}`}
        >
          {primaryAction && (
            <Button
              variant="default"
              size={compact ? 'sm' : 'default'}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon || <Plus className="h-4 w-4" />}
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}