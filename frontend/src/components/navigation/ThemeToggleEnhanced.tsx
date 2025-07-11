import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { useTheme } from '@hooks/useTheme'

interface ThemeToggleEnhancedProps {
  className?: string
  variant?: 'icon' | 'icon-text'
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
}

const iconVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  exit: { scale: 0, rotate: 180, opacity: 0 }
}

const tooltipVariants = {
  initial: { opacity: 0, scale: 0.95, y: -5 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -5 }
}

export const ThemeToggleEnhanced: React.FC<ThemeToggleEnhancedProps> = ({
  className = '',
  variant = 'icon',
  size = 'md',
  showTooltip = true,
  tooltipPosition = 'bottom'
}) => {
  const { theme, themeMode, setThemeMode, isSystemTheme } = useTheme()
  const [showTooltipState, setShowTooltipState] = React.useState(false)

  const sizeClasses = {
    sm: {
      button: 'p-1.5',
      icon: 'h-4 w-4',
      text: 'text-xs'
    },
    md: {
      button: 'p-2',
      icon: 'h-5 w-5',
      text: 'text-sm'
    },
    lg: {
      button: 'p-2.5',
      icon: 'h-6 w-6',
      text: 'text-base'
    }
  }

  const tooltipPositions = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2'
  }

  const arrowPositions = {
    top: 'top-full border-t-gray-900 dark:border-t-gray-700',
    bottom: 'bottom-full border-b-gray-900 dark:border-b-gray-700',
    left: 'left-full border-l-gray-900 dark:border-l-gray-700',
    right: 'right-full border-r-gray-900 dark:border-r-gray-700'
  }

  const handleCycle = () => {
    if (themeMode === 'light') {
      setThemeMode('dark')
    } else if (themeMode === 'dark') {
      setThemeMode('system')
    } else {
      setThemeMode('light')
    }
  }

  const getIcon = () => {
    if (themeMode === 'system') {
      return (
        <ComputerDesktopIcon 
          className={`${sizeClasses[size].icon} ${theme === 'dark' ? 'text-blue-400' : 'text-amber-500'}`}
        />
      )
    } else if (theme === 'light') {
      return <SunIcon className={`${sizeClasses[size].icon} text-amber-500`} />
    } else {
      return <MoonIcon className={`${sizeClasses[size].icon} text-blue-400`} />
    }
  }

  const getLabel = () => {
    if (themeMode === 'system') {
      return `System (${theme === 'dark' ? 'Dark' : 'Light'})`
    }
    return theme === 'light' ? 'Light' : 'Dark'
  }

  const getTooltipText = () => {
    if (themeMode === 'light') {
      return 'Switch to dark mode'
    } else if (themeMode === 'dark') {
      return 'Switch to system mode'
    } else {
      return 'Switch to light mode'
    }
  }

  return (
    <div className="relative inline-flex">
      <motion.button
        onClick={handleCycle}
        onMouseEnter={() => setShowTooltipState(true)}
        onMouseLeave={() => setShowTooltipState(false)}
        onFocus={() => setShowTooltipState(true)}
        onBlur={() => setShowTooltipState(false)}
        className={`
          ${sizeClasses[size].button}
          relative
          inline-flex items-center gap-2
          rounded-lg
          text-gray-600 dark:text-gray-300
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
          focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900
          transition-all duration-200 ease-in-out
          ${className}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Current theme: ${getLabel()}. ${getTooltipText()}`}
        aria-pressed={theme === 'dark'}
        aria-describedby={showTooltip ? 'theme-tooltip' : undefined}
      >
        <div className="relative flex items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={themeMode + theme}
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {getIcon()}
            </motion.div>
          </AnimatePresence>
          
          {variant === 'icon-text' && (
            <motion.span 
              className={`${sizeClasses[size].text} font-medium`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              {getLabel()}
            </motion.span>
          )}
        </div>
      </motion.button>

      {showTooltip && (
        <AnimatePresence>
          {showTooltipState && (
            <motion.div
              id="theme-tooltip"
              role="tooltip"
              variants={tooltipVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className={`
                absolute z-50
                ${tooltipPositions[tooltipPosition]}
                ${tooltipPosition === 'left' || tooltipPosition === 'right' ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2'}
                px-3 py-1.5 text-xs font-medium
                text-white bg-gray-900 dark:bg-gray-700
                rounded-md shadow-lg
                whitespace-nowrap
                pointer-events-none
              `}
            >
              {getTooltipText()}
              <div 
                className={`
                  absolute
                  ${tooltipPosition === 'top' || tooltipPosition === 'bottom' ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2'}
                  border-4 border-transparent
                  ${arrowPositions[tooltipPosition]}
                `}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}