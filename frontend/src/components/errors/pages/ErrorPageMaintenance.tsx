import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wrench, Clock, Bell, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorPageMaintenanceProps {
  /**
   * Custom title for the error page
   */
  title?: string
  /**
   * Custom message for the error page
   */
  message?: string
  /**
   * Estimated end time for maintenance
   */
  estimatedEndTime?: Date
  /**
   * Show progress bar
   */
  showProgress?: boolean
  /**
   * Progress percentage (0-100)
   */
  progress?: number
  /**
   * Show notification subscribe
   */
  showNotificationSubscribe?: boolean
  /**
   * Notification subscribe callback
   */
  onSubscribeNotification?: (email: string) => Promise<void>
  /**
   * Status page URL
   */
  statusPageUrl?: string
  /**
   * Custom action button
   */
  customAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
}

export const ErrorPageMaintenance: React.FC<ErrorPageMaintenanceProps> = ({
  title,
  message,
  estimatedEndTime,
  showProgress = false,
  progress = 0,
  showNotificationSubscribe = false,
  onSubscribeNotification,
  statusPageUrl,
  customAction
}) => {
  const { t } = useTypedTranslation()
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [email, setEmail] = useState('')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!estimatedEndTime) return

    const updateTimeRemaining = () => {
      const now = new Date().getTime()
      const end = estimatedEndTime.getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeRemaining(t('errors.maintenance.completed'))
        // Auto-refresh when maintenance is expected to be done
        setTimeout(() => window.location.reload(), 5000)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeRemaining(t('errors.maintenance.timeRemaining', { 
          hours, 
          minutes 
        }))
      } else if (minutes > 0) {
        setTimeRemaining(t('errors.maintenance.timeRemainingMinutes', { 
          minutes,
          seconds 
        }))
      } else {
        setTimeRemaining(t('errors.maintenance.timeRemainingSeconds', { 
          seconds 
        }))
      }
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [estimatedEndTime, t])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !onSubscribeNotification) return

    setIsSubscribing(true)
    try {
      await onSubscribeNotification(email)
      setIsSubscribed(true)
    } catch (error) {
      console.error('Failed to subscribe:', error)
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center"
      >
        {/* Animated Wrench Icon */}
        <motion.div
          animate={{ 
            rotate: [0, -30, 30, -30, 0],
            y: [0, -10, 0]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatDelay: 1
          }}
          className="mb-8"
        >
          <Wrench className="w-24 h-24 mx-auto text-warning-500 dark:text-warning-400" />
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <ErrorIllustration
            type="maintenance"
            className="w-64 h-64 mx-auto"
            animated
          />
        </motion.div>

        {/* Title and Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
            {title || t('errors.maintenance.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-md mx-auto">
            {message || t('errors.maintenance.message')}
          </p>
        </motion.div>

        {/* Time Remaining */}
        {estimatedEndTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning-100 dark:bg-warning-900 text-warning-700 dark:text-warning-300">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{timeRemaining}</span>
            </div>
          </motion.div>
        )}

        {/* Progress Bar */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-8 max-w-md mx-auto"
          >
            <div className="text-sm text-text-muted mb-2">
              {t('errors.maintenance.progress', { progress })}
            </div>
            <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-primary-500 rounded-full"
              />
            </div>
          </motion.div>
        )}

        {/* Notification Subscribe */}
        {showNotificationSubscribe && !isSubscribed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mb-8 max-w-md mx-auto"
          >
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('errors.maintenance.emailPlaceholder')}
                className="flex-1 px-4 py-2 rounded-md border border-border bg-surface text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <Button
                type="submit"
                variant="default"
                disabled={isSubscribing || !email}
              >
                <Bell className="h-4 w-4" />
                {isSubscribing ? t('errors.maintenance.subscribing') : t('errors.maintenance.subscribe')}
              </Button>
            </form>
          </motion.div>
        )}

        {/* Success Message */}
        {isSubscribed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-3 rounded-md bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-300"
          >
            {t('errors.maintenance.subscribeSuccess')}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {statusPageUrl && (
            <Button
              variant="default"
              size="lg"
              onClick={() => window.open(statusPageUrl, '_blank')}
              className="min-w-[160px]"
            >
              <ExternalLink className="h-5 w-5" />
              {t('errors.actions.statusPage')}
            </Button>
          )}

          {customAction && (
            <Button
              variant="secondary"
              size="lg"
              onClick={customAction.onClick}
              className="min-w-[160px]"
            >
              {customAction.icon}
              {customAction.label}
            </Button>
          )}
        </motion.div>

        {/* Help text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 space-y-2"
        >
          <p className="text-sm text-text-muted">
            {t('errors.maintenance.helpText')}
          </p>
          <div className="text-xs text-text-muted space-y-1">
            <p>{t('errors.maintenance.features')}</p>
            <ul className="list-disc list-inside">
              <li>{t('errors.maintenance.feature1')}</li>
              <li>{t('errors.maintenance.feature2')}</li>
              <li>{t('errors.maintenance.feature3')}</li>
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}