import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Home, Search, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTypedTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorIllustration } from '../illustrations/ErrorIllustration'

interface ErrorPage404Props {
  /**
   * Custom title for the error page
   */
  title?: string
  /**
   * Custom message for the error page
   */
  message?: string
  /**
   * Show search button
   */
  showSearch?: boolean
  /**
   * Custom action button
   */
  customAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
}

export const ErrorPage404: React.FC<ErrorPage404Props> = ({
  title,
  message,
  showSearch = true,
  customAction
}) => {
  const { t } = useTypedTranslation()
  const navigate = useNavigate()

  const handleGoHome = () => {
    navigate('/')
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleSearch = () => {
    navigate('/search')
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
          <h1 className="text-8xl md:text-9xl font-bold text-primary-600 dark:text-primary-400">
            404
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
            type="404"
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
            {title || t('errors.404.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-md mx-auto">
            {message || t('errors.404.message')}
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

          {showSearch && (
            <Button
              variant="ghost"
              size="lg"
              onClick={handleSearch}
              className="min-w-[160px]"
            >
              <Search className="h-5 w-5" />
              {t('errors.actions.search')}
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
          {t('errors.404.helpText')}
        </motion.p>
      </motion.div>
    </div>
  )
}