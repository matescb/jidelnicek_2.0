import React from 'react'
import { useTheme } from '../hooks/useTheme'

/**
 * Theme Mode Selector Component
 * 
 * Provides UI for selecting between system, light, and dark theme modes
 * Automatically follows system preference when in system mode
 */
export const ThemeModeSelector: React.FC = () => {
  const { 
    theme, 
    themeMode, 
    setThemeMode, 
    systemTheme, 
    isSystemMode,
    availableThemes 
  } = useTheme()

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setThemeMode(e.target.value)
  }

  return (
    <div className="theme-mode-selector">
      <label htmlFor="theme-mode" className="block text-sm font-medium text-text-primary mb-2">
        Theme Mode
      </label>
      <select
        id="theme-mode"
        value={themeMode}
        onChange={handleModeChange}
        className="block w-full px-3 py-2 bg-surface border border-border-default rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="system">System (currently {systemTheme})</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        {/* Show custom themes if available */}
        {availableThemes
          .filter(t => t !== 'light' && t !== 'dark')
          .map(themeName => (
            <option key={themeName} value={themeName}>
              {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
            </option>
          ))}
      </select>
      
      {isSystemMode && (
        <p className="mt-2 text-sm text-text-secondary">
          Following system preference: {systemTheme} mode
        </p>
      )}
      
      <div className="mt-4 text-sm text-text-muted">
        <p>Current theme: {theme}</p>
        <p>Mode: {themeMode}</p>
      </div>
    </div>
  )
}

/**
 * Simple Theme Toggle Button
 * 
 * Provides a button to quickly toggle between themes
 * When in system mode, switches to manual mode
 */
export const ThemeToggleButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme, isSystemMode } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle-button ${className}`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      title={isSystemMode ? 'Currently following system preference' : `Current theme: ${theme}`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}