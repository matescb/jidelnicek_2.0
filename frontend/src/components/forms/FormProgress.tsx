/**
 * Form submission progress indicators
 * Includes linear, circular, and step-based progress components
 */

import React from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Linear progress bar component
 */
export interface LinearProgressProps {
  /**
   * Progress value (0-100)
   */
  value: number
  /**
   * Progress bar height
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Show percentage label
   */
  showLabel?: boolean
  /**
   * Label position
   */
  labelPosition?: 'top' | 'inside' | 'bottom'
  /**
   * Progress bar color
   */
  color?: 'primary' | 'success' | 'warning' | 'danger'
  /**
   * Animated progress
   */
  animated?: boolean
  /**
   * Striped pattern
   */
  striped?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Buffer value for indeterminate progress
   */
  buffer?: number
  /**
   * Custom label (overrides percentage)
   */
  label?: string
}

export const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  size = 'md',
  showLabel = false,
  labelPosition = 'top',
  color = 'primary',
  animated = true,
  striped = false,
  className,
  buffer,
  label,
}) => {
  const { t } = useTranslation()
  const clampedValue = Math.min(100, Math.max(0, value))
  const clampedBuffer = buffer !== undefined ? Math.min(100, Math.max(0, buffer)) : undefined

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const colorClasses = {
    primary: 'bg-primary-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  }

  const stripedPattern = striped
    ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:20px_100%] animate-shimmer'
    : ''

  const progressLabel = label || `${clampedValue}%`

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && labelPosition === 'top' && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {progressLabel}
        </div>
      )}

      <div className="relative">
        <div
          className={clsx(
            'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
            sizeClasses[size]
          )}
        >
          {/* Buffer bar */}
          {clampedBuffer !== undefined && (
            <div
              className={clsx(
                'absolute inset-y-0 left-0 bg-gray-300 dark:bg-gray-600 opacity-50',
                animated && 'transition-all duration-300'
              )}
              style={{ width: `${clampedBuffer}%` }}
            />
          )}

          {/* Progress bar */}
          <div
            className={clsx(
              'h-full rounded-full relative overflow-hidden',
              colorClasses[color],
              animated && 'transition-all duration-300',
              stripedPattern
            )}
            style={{ width: `${clampedValue}%` }}
            role="progressbar"
            aria-valuenow={clampedValue}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('form.progress', { value: clampedValue })}
          >
            {showLabel && labelPosition === 'inside' && clampedValue > 20 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                {progressLabel}
              </span>
            )}
          </div>
        </div>

        {showLabel && labelPosition === 'inside' && clampedValue <= 20 && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-700 dark:text-gray-300 font-medium">
            {progressLabel}
          </span>
        )}
      </div>

      {showLabel && labelPosition === 'bottom' && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {progressLabel}
        </div>
      )}
    </div>
  )
}

/**
 * Circular progress indicator component
 */
export interface CircularProgressProps {
  /**
   * Progress value (0-100)
   */
  value: number
  /**
   * Circle size
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Stroke width
   */
  strokeWidth?: number
  /**
   * Show percentage label
   */
  showLabel?: boolean
  /**
   * Progress color
   */
  color?: 'primary' | 'success' | 'warning' | 'danger'
  /**
   * Background circle color
   */
  trackColor?: string
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Custom label content
   */
  labelContent?: React.ReactNode
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 'md',
  strokeWidth,
  showLabel = true,
  color = 'primary',
  trackColor = 'stroke-gray-200 dark:stroke-gray-700',
  className,
  labelContent,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value))

  const sizeConfig = {
    sm: { diameter: 40, strokeWidth: strokeWidth || 3, fontSize: 'text-xs' },
    md: { diameter: 60, strokeWidth: strokeWidth || 4, fontSize: 'text-sm' },
    lg: { diameter: 80, strokeWidth: strokeWidth || 5, fontSize: 'text-base' },
    xl: { diameter: 100, strokeWidth: strokeWidth || 6, fontSize: 'text-lg' },
  }

  const config = sizeConfig[size]
  const radius = (config.diameter - config.strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference

  const colorClasses = {
    primary: 'stroke-primary-600',
    success: 'stroke-green-600',
    warning: 'stroke-yellow-600',
    danger: 'stroke-red-600',
  }

  return (
    <div className={clsx('relative inline-flex', className)}>
      <svg
        width={config.diameter}
        height={config.diameter}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          fill="none"
          className={trackColor}
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          fill="none"
          className={clsx(colorClasses[color], 'transition-all duration-300')}
          strokeWidth={config.strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <div
          className={clsx(
            'absolute inset-0 flex items-center justify-center',
            config.fontSize,
            'font-medium text-gray-700 dark:text-gray-300'
          )}
        >
          {labelContent || `${clampedValue}%`}
        </div>
      )}
    </div>
  )
}

/**
 * Step indicator for multi-step forms
 */
export interface StepIndicatorProps {
  /**
   * Total number of steps
   */
  steps: number
  /**
   * Current step (1-based)
   */
  currentStep: number
  /**
   * Step labels
   */
  labels?: string[]
  /**
   * Variant style
   */
  variant?: 'dots' | 'numbers' | 'progress'
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Show labels
   */
  showLabels?: boolean
  /**
   * Clickable steps
   */
  clickable?: boolean
  /**
   * Step click handler
   */
  onStepClick?: (step: number) => void
  /**
   * Additional CSS classes
   */
  className?: string
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  labels,
  variant = 'numbers',
  size = 'md',
  showLabels = true,
  clickable = false,
  onStepClick,
  className,
}) => {
  const { t } = useTranslation()

  const sizeConfig = {
    sm: { dotSize: 'w-2 h-2', numberSize: 'w-6 h-6 text-xs', spacing: 'gap-2' },
    md: { dotSize: 'w-3 h-3', numberSize: 'w-8 h-8 text-sm', spacing: 'gap-3' },
    lg: { dotSize: 'w-4 h-4', numberSize: 'w-10 h-10 text-base', spacing: 'gap-4' },
  }

  const config = sizeConfig[size]

  if (variant === 'progress') {
    return (
      <div className={clsx('w-full', className)}>
        <LinearProgress
          value={(currentStep / steps) * 100}
          size={size}
          showLabel={showLabels}
          label={`${t('form.step')} ${currentStep} / ${steps}`}
        />
      </div>
    )
  }

  const renderStep = (index: number) => {
    const stepNumber = index + 1
    const isActive = stepNumber === currentStep
    const isCompleted = stepNumber < currentStep
    const label = labels?.[index] || `${t('form.step')} ${stepNumber}`

    const stepContent = (
      <>
        {variant === 'dots' ? (
          <div
            className={clsx(
              config.dotSize,
              'rounded-full transition-all duration-200',
              isActive && 'bg-primary-600 scale-125',
              isCompleted && 'bg-primary-600',
              !isActive && !isCompleted && 'bg-gray-300 dark:bg-gray-600'
            )}
          />
        ) : (
          <div
            className={clsx(
              config.numberSize,
              'rounded-full flex items-center justify-center font-medium transition-all duration-200',
              isActive && 'bg-primary-600 text-white',
              isCompleted && 'bg-primary-600 text-white',
              !isActive && !isCompleted && 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            )}
          >
            {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
          </div>
        )}
        {showLabels && labels && (
          <span
            className={clsx(
              'text-xs mt-1 text-center',
              isActive && 'text-primary-600 font-medium',
              !isActive && 'text-gray-600 dark:text-gray-400'
            )}
          >
            {label}
          </span>
        )}
      </>
    )

    if (clickable && onStepClick) {
      return (
        <button
          key={index}
          onClick={() => onStepClick(stepNumber)}
          className={clsx(
            'flex flex-col items-center',
            'hover:opacity-80 transition-opacity',
            stepNumber > currentStep && 'cursor-not-allowed opacity-50'
          )}
          disabled={stepNumber > currentStep}
          aria-label={label}
          aria-current={isActive ? 'step' : undefined}
        >
          {stepContent}
        </button>
      )
    }

    return (
      <div
        key={index}
        className="flex flex-col items-center"
        aria-label={label}
        aria-current={isActive ? 'step' : undefined}
      >
        {stepContent}
      </div>
    )
  }

  return (
    <div
      className={clsx('flex items-start justify-between', config.spacing, className)}
      role="group"
      aria-label={t('form.progress')}
    >
      {Array.from({ length: steps }, (_, i) => renderStep(i))}
    </div>
  )
}

/**
 * Progress with ETA calculation
 */
export interface ProgressWithETAProps {
  /**
   * Current progress (0-100)
   */
  progress: number
  /**
   * Start time (timestamp)
   */
  startTime: number
  /**
   * Show ETA
   */
  showETA?: boolean
  /**
   * Show elapsed time
   */
  showElapsed?: boolean
  /**
   * Progress bar props
   */
  progressProps?: Omit<LinearProgressProps, 'value'>
}

export const ProgressWithETA: React.FC<ProgressWithETAProps> = ({
  progress,
  startTime,
  showETA = true,
  showElapsed = false,
  progressProps = {},
}) => {
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = React.useState(Date.now())

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const elapsedMs = currentTime - startTime
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const progressPerMs = progress / elapsedMs
  const remainingMs = progress > 0 ? (100 - progress) / progressPerMs : 0
  const remainingSeconds = Math.floor(remainingMs / 1000)

  const formatTime = (seconds: number) => {
    if (seconds < 60) return t('form.seconds', { count: seconds })
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return t('form.minutesSeconds', { minutes, seconds: remainingSeconds })
  }

  return (
    <div className="w-full space-y-2">
      <LinearProgress value={progress} showLabel {...progressProps} />
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
        {showElapsed && (
          <span>{t('form.elapsed', { time: formatTime(elapsedSeconds) })}</span>
        )}
        {showETA && progress > 0 && progress < 100 && (
          <span className="ml-auto">
            {t('form.remaining', { time: formatTime(remainingSeconds) })}
          </span>
        )}
      </div>
    </div>
  )
}