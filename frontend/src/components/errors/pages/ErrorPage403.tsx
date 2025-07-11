import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Home, LogIn, ChevronLeft, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorPage403Props {
  /**
   * Custom title for the error page
   */
  title?: string
  /**
   * Custom message for the error page
   */
  message?: string
  /**
   * Show login button
   */
  showLogin?: boolean
  /**
   * Custom action button
   */
  customAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  /**
   * User's authentication status
   */
  isAuthenticated?: boolean
}

export const ErrorPage403: React.FC<ErrorPage403Props> = ({
  title,
  message,
  showLogin = true,
  customAction,
  isAuthenticated = false
}) => {
  const { t } = useTypedTranslation()
  const navigate = useNavigate()

  const handleGoHome = () => {
    navigate('/')
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleLogin = () => {
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center"
      >
        {/* Error Code */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-8xl md:text-9xl font-bold text-error-600 dark:text-error-400">
            403
          </h1>
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <ErrorIllustration
            type="403"
            className="w-64 h-64 mx-auto"
            animated
          />
        </motion.div>

        {/* Lock Icon Animation */}
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-6"
        >
          <Lock className="w-16 h-16 mx-auto text-error-500 dark:text-error-400" />
        </motion.div>

        {/* Title and Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
            {title || t('errors.403.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-md mx-auto">
            {message || (isAuthenticated 
              ? t('errors.403.messageAuthenticated') 
              : t('errors.403.messageUnauthenticated'))}
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button
            variant="default"
            size="lg"
            onClick={handleGoHome}
            className="min-w-[160px]"
          >
            <Home className="h-5 w-5" />
            {t('errors.actions.goHome')}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleGoBack}
            className="min-w-[160px]"
          >
            <ChevronLeft className="h-5 w-5" />
            {t('errors.actions.goBack')}
          </Button>

          {showLogin && !isAuthenticated && (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleLogin}
              className="min-w-[160px]"
            >
              <LogIn className="h-5 w-5" />
              {t('errors.actions.login')}
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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 text-sm text-text-muted"
        >
          {isAuthenticated 
            ? t('errors.403.helpTextAuthenticated') 
            : t('errors.403.helpTextUnauthenticated')}
        </motion.p>
      </motion.div>
    </div>
  )
}