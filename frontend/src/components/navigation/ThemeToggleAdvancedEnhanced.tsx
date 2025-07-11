import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  SunIcon, 
  MoonIcon, 
  ComputerDesktopIcon,
  CheckIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { useTheme } from '@hooks/useTheme'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeToggleAdvancedEnhancedProps {
  className?: string
  compact?: boolean
  showCurrentMode?: boolean
  showCustomThemes?: boolean
  position?: 'left' | 'right'
}

const dropdownVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95, 
    y: -10,
    transition: { duration: 0.2, ease: 'easeInOut' }
  },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { 
      duration: 0.2, 
      ease: 'easeOutCubic',
      staggerChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2 }
  }
}

const iconRotateVariants = {
  closed: { rotate: 0 },
  open: { rotate: 180 }
}

export const ThemeToggleAdvancedEnhanced: React.FC<ThemeToggleAdvancedEnhancedProps> = ({ 
  className = '',
  compact = false,
  showCurrentMode = true,
  showCustomThemes = false,
  position = 'left'
}) => {
  const { theme, themeMode, setThemeMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'Escape':
          setIsOpen(false)
          buttonRef.current?.focus()
          break
        case 'ArrowDown':
          event.preventDefault()
          const firstOption = dropdownRef.current?.querySelector('[role="menuitem"]') as HTMLElement
          firstOption?.focus()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])
  
  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  const handleKeyNavigation = (event: React.KeyboardEvent, mode: ThemeMode, index: number) => {
    const menuItems = dropdownRef.current?.querySelectorAll('[role="menuitem"]')
    
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        handleThemeChange(mode)
        break
      case 'ArrowDown':
        event.preventDefault()
        const nextItem = menuItems?.[index + 1] as HTMLElement
        nextItem?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        const prevItem = menuItems?.[index - 1] as HTMLElement
        prevItem?.focus()
        break
      case 'Tab':
        // Let Tab close the menu
        setIsOpen(false)
        break
    }
  }
  
  const getCurrentIcon = () => {
    const iconClass = compact ? 'h-4 w-4' : 'h-5 w-5'
    
    if (themeMode === 'system') {
      return (
        <motion.div
          animate={{ rotate: theme === 'dark' ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ComputerDesktopIcon className={`${iconClass} text-gray-600 dark:text-gray-300`} />
        </motion.div>
      )
    } else if (theme === 'light') {
      return <SunIcon className={`${iconClass} text-amber-500`} />
    } else {
      return <MoonIcon className={`${iconClass} text-blue-400`} />
    }
  }
  
  const themeOptions: { mode: ThemeMode; label: string; icon: JSX.Element; description: string }[] = [
    {
      mode: 'light',
      label: 'Light',
      icon: <SunIcon className="h-4 w-4 text-amber-500" />,
      description: 'Always use light theme'
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: <MoonIcon className="h-4 w-4 text-blue-400" />,
      description: 'Always use dark theme'
    },
    {
      mode: 'system',
      label: 'System',
      icon: <ComputerDesktopIcon className="h-4 w-4 text-gray-500" />,
      description: 'Follow system preference'
    }
  ]
  
  const buttonPadding = compact ? 'px-2 py-1.5' : 'px-3 py-2'
  
  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${buttonPadding}
          flex items-center gap-2
          rounded-lg
          text-gray-600 dark:text-gray-300
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
          focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900
          transition-all duration-200 ease-in-out
          ${className}
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label="Theme settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="theme-menu"
      >
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={themeMode + theme}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              {getCurrentIcon()}
            </motion.div>
          </AnimatePresence>
          {showCurrentMode && !compact && (
            <span className="text-sm font-medium">
              {themeMode === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}
            </span>
          )}
        </div>
        <motion.div
          variants={iconRotateVariants}
          animate={isOpen ? 'open' : 'closed'}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </motion.div>
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="theme-menu"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`
              absolute z-50
              ${position === 'right' ? 'right-0' : 'left-0'}
              mt-2
              w-56
              rounded-lg
              bg-white dark:bg-gray-800
              shadow-xl ring-1 ring-black ring-opacity-5
              focus:outline-none
              overflow-hidden
            `}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="theme-menu"
          >
            <div className="py-1" role="none">
              {themeOptions.map((option, index) => (
                <motion.button
                  key={option.mode}
                  variants={itemVariants}
                  onClick={() => handleThemeChange(option.mode)}
                  onKeyDown={(e) => handleKeyNavigation(e, option.mode, index)}
                  className={`
                    w-full px-4 py-3
                    flex items-start gap-3
                    text-left
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    focus:bg-gray-100 dark:focus:bg-gray-700
                    focus:outline-none
                    transition-colors duration-150
                    ${themeMode === option.mode ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                  `}
                  role="menuitem"
                  tabIndex={-1}
                  aria-checked={themeMode === option.mode}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {option.icon}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {option.label}
                      </span>
                      <AnimatePresence>
                        {themeMode === option.mode && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CheckIcon className="h-4 w-4 text-primary-500" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
            
            {showCustomThemes && (
              <motion.div
                variants={itemVariants}
                className="border-t border-gray-200 dark:border-gray-700 py-2"
              >
                <div className="px-4 py-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    More Options
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Placeholder for custom theme settings
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  role="menuitem"
                >
                  Customize Theme...
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}