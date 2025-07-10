import React from 'react'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useTheme } from '@hooks/useTheme'

interface ThemeToggleProps {
  className?: string
  compact?: boolean
  showTooltip?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  compact = false,
  showTooltip = true 
}) => {
  const { theme, toggleTheme, transitions } = useTheme()
  
  const iconSize = compact ? 'h-4 w-4' : 'h-5 w-5'
  const buttonPadding = compact ? 'p-1.5' : 'p-2'
  
  return (
    <div className="relative group">
      <button
        onClick={toggleTheme}
        className={`
          ${buttonPadding} 
          relative
          rounded-lg
          text-gray-600 dark:text-gray-300
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
          transition-all duration-200 ease-in-out
          transform hover:scale-105 active:scale-95
          ${className}
        `}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        aria-pressed={theme === 'dark'}
      >
        <div className="relative w-5 h-5 overflow-hidden">
          <div
            className={`
              absolute inset-0 
              transform transition-all duration-300 ease-in-out
              ${theme === 'light' ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0'}
            `}
          >
            <SunIcon className={`${iconSize} text-amber-500`} />
          </div>
          <div
            className={`
              absolute inset-0 
              transform transition-all duration-300 ease-in-out
              ${theme === 'dark' ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}
            `}
          >
            <MoonIcon className={`${iconSize} text-blue-400`} />
          </div>
        </div>
      </button>
      
      {showTooltip && (
        <div
          role="tooltip"
          className={`
            absolute z-10 
            ${compact ? 'bottom-full mb-1' : 'top-full mt-2'}
            left-1/2 transform -translate-x-1/2
            px-2 py-1 text-xs font-medium
            text-white bg-gray-900 dark:bg-gray-700
            rounded-md shadow-lg
            opacity-0 invisible group-hover:opacity-100 group-hover:visible
            transition-all duration-200
            whitespace-nowrap
            pointer-events-none
          `}
        >
          {theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          <div 
            className={`
              absolute ${compact ? 'top-full' : 'bottom-full'} 
              left-1/2 transform -translate-x-1/2
              border-4 border-transparent
              ${compact 
                ? 'border-t-gray-900 dark:border-t-gray-700' 
                : 'border-b-gray-900 dark:border-b-gray-700'
              }
            `}
          />
        </div>
      )}
    </div>
  )
}