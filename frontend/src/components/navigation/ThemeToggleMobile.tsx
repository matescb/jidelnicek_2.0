import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { useTheme } from '@hooks/useTheme'

interface ThemeToggleMobileProps {
  className?: string
  position?: 'floating' | 'inline'
}

const iconVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  exit: { scale: 0, rotate: 180, opacity: 0 }
}

const fabVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 }
}

export const ThemeToggleMobile: React.FC<ThemeToggleMobileProps> = ({
  className = '',
  position = 'inline'
}) => {
  const { theme, themeMode, setThemeMode } = useTheme()
  const [isExpanded, setIsExpanded] = React.useState(false)

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
          className={`h-5 w-5 ${theme === 'dark' ? 'text-blue-400' : 'text-amber-500'}`}
        />
      )
    } else if (theme === 'light') {
      return <SunIcon className="h-5 w-5 text-amber-500" />
    } else {
      return <MoonIcon className="h-5 w-5 text-blue-400" />
    }
  }

  const modeOptions = [
    { mode: 'light', icon: SunIcon, color: 'text-amber-500', label: 'Light' },
    { mode: 'dark', icon: MoonIcon, color: 'text-blue-400', label: 'Dark' },
    { mode: 'system', icon: ComputerDesktopIcon, color: 'text-gray-500', label: 'System' }
  ]

  if (position === 'floating') {
    return (
      <motion.div
        className={`fixed bottom-4 right-4 z-50 ${className}`}
        initial="initial"
        animate="animate"
        variants={fabVariants}
      >
        <div className="relative">
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 min-w-[120px]"
              >
                {modeOptions.map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => {
                      setThemeMode(option.mode as 'light' | 'dark' | 'system')
                      setIsExpanded(false)
                    }}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 rounded-md
                      text-sm font-medium
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors duration-150
                      ${themeMode === option.mode ? 'bg-gray-100 dark:bg-gray-700' : ''}
                    `}
                    aria-label={`Switch to ${option.label} mode`}
                  >
                    <option.icon className={`h-4 w-4 ${option.color}`} />
                    <span className="text-gray-700 dark:text-gray-200">{option.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            onBlur={(e) => {
              // Close menu when focus leaves the component
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setIsExpanded(false)
              }
            }}
            className={`
              p-3
              rounded-full
              bg-white dark:bg-gray-800
              shadow-lg hover:shadow-xl
              text-gray-600 dark:text-gray-300
              focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
              transition-all duration-200
            `}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Theme options"
            aria-expanded={isExpanded}
            aria-haspopup="true"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={themeMode + theme}
                variants={iconVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                {getIcon()}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>
    )
  }

  // Inline compact version for mobile navigation
  return (
    <motion.button
      onClick={handleCycle}
      className={`
        p-2
        rounded-lg
        text-gray-600 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
        transition-all duration-200
        ${className}
      `}
      whileTap={{ scale: 0.95 }}
      aria-label={`Theme: ${themeMode === 'system' ? `System (${theme})` : theme}. Tap to change.`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={themeMode + theme}
          variants={iconVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {getIcon()}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  )
}