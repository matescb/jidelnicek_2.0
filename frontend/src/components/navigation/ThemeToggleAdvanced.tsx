import React, { useState, useRef, useEffect } from 'react'
import { 
  SunIcon, 
  MoonIcon, 
  ComputerDesktopIcon,
  CheckIcon 
} from '@heroicons/react/24/outline'
import { useTheme } from '@hooks/useTheme'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeToggleAdvancedProps {
  className?: string
  compact?: boolean
  showCurrentMode?: boolean
}

export const ThemeToggleAdvanced: React.FC<ThemeToggleAdvancedProps> = ({ 
  className = '',
  compact = false,
  showCurrentMode = true
}) => {
  const { theme, themeMode, setThemeMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  // Handle system theme changes
  useEffect(() => {
    if (themeMode === 'system') {
      // System theme is already handled by the useTheme hook
    }
  }, [themeMode])
  
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
  
  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    setIsOpen(false)
  }
  
  const getCurrentIcon = () => {
    const iconClass = compact ? 'h-4 w-4' : 'h-5 w-5'
    
    if (themeMode === 'system') {
      return <ComputerDesktopIcon className={`${iconClass} text-gray-600 dark:text-gray-300`} />
    } else if (theme === 'light') {
      return <SunIcon className={`${iconClass} text-amber-500`} />
    } else {
      return <MoonIcon className={`${iconClass} text-blue-400`} />
    }
  }
  
  const themeOptions: { mode: ThemeMode; label: string; icon: JSX.Element }[] = [
    {
      mode: 'light',
      label: 'Light',
      icon: <SunIcon className="h-4 w-4 text-amber-500" />
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: <MoonIcon className="h-4 w-4 text-blue-400" />
    },
    {
      mode: 'system',
      label: 'System',
      icon: <ComputerDesktopIcon className="h-4 w-4 text-gray-500" />
    }
  ]
  
  const buttonPadding = compact ? 'px-2 py-1.5' : 'px-3 py-2'
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${buttonPadding}
          flex items-center gap-2
          rounded-lg
          text-gray-600 dark:text-gray-300
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
          transition-all duration-200 ease-in-out
          ${className}
        `}
        aria-label="Theme settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center gap-2">
          {getCurrentIcon()}
          {showCurrentMode && !compact && (
            <span className="text-sm font-medium">
              {themeMode === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}
            </span>
          )}
        </div>
        <svg
          className={`
            h-4 w-4 transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}
          `}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div
          className={`
            absolute z-50
            ${compact ? 'right-0' : 'left-0'}
            mt-2
            w-48
            rounded-lg
            bg-white dark:bg-gray-800
            shadow-lg ring-1 ring-black ring-opacity-5
            focus:outline-none
            animate-in fade-in slide-in-from-top-1
            duration-200
          `}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="theme-menu"
        >
          <div className="py-1" role="none">
            {themeOptions.map((option) => (
              <button
                key={option.mode}
                onClick={() => handleThemeChange(option.mode)}
                className={`
                  w-full px-4 py-2
                  flex items-center justify-between
                  text-sm text-gray-700 dark:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors duration-150
                  ${themeMode === option.mode ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                `}
                role="menuitem"
              >
                <div className="flex items-center gap-3">
                  {option.icon}
                  <span className="font-medium">{option.label}</span>
                </div>
                {themeMode === option.mode && (
                  <CheckIcon className="h-4 w-4 text-primary-500" />
                )}
              </button>
            ))}
          </div>
          
        </div>
      )}
    </div>
  )
}

// Add custom keyframes for animations if not already in your CSS
const animationStyles = `
  @keyframes animate-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-in {
    animation: animate-in 0.2s ease-out;
  }
`

// Inject styles (you might want to move this to your global CSS)
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = animationStyles
  document.head.appendChild(styleElement)
}