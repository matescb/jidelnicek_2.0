import React from 'react'
import { useTheme } from '../hooks/useTheme'
import { useSystemThemePreference } from '../hooks/useSystemThemePreference'
import { ThemeModeSelector, ThemeToggleButton } from '../components/ThemeModeSelector'

/**
 * Demo component showcasing the enhanced theme system features
 * 
 * Features demonstrated:
 * - System preference detection
 * - Automatic theme switching
 * - Smooth transitions
 * - Theme mode selection
 * - Custom theme registration
 */
export const ThemeSystemDemo: React.FC = () => {
  const {
    theme,
    themeMode,
    setTheme,
    setThemeMode,
    toggleTheme,
    registerCustomTheme,
    availableThemes,
    systemTheme,
    isSystemMode,
    prefersReducedMotion
  } = useTheme()

  const { systemTheme: detectedSystemTheme, mediaQuery } = useSystemThemePreference()

  // Example: Register a custom theme
  const registerSolarizedTheme = () => {
    registerCustomTheme('solarized', {
      name: 'Solarized',
      colors: {
        primary: {
          50: '#fdf6e3',
          100: '#eee8d5',
          200: '#93a1a1',
          300: '#839496',
          400: '#657b83',
          500: '#586e75',
          600: '#073642',
          700: '#002b36',
          800: '#001e26',
          900: '#001217'
        },
        // ... other color scales
        background: '#fdf6e3',
        surface: '#eee8d5',
        surfaceElevated: '#e9e2cf',
        card: '#eee8d5',
        popover: '#fdf6e3',
        modal: '#fdf6e3',
        text: {
          primary: '#073642',
          secondary: '#586e75',
          muted: '#657b83',
          disabled: '#93a1a1',
          inverse: '#fdf6e3'
        },
        border: {
          default: '#93a1a1',
          subtle: '#eee8d5',
          strong: '#657b83'
        }
      },
      typography: {
        fontFamily: {
          sans: 'system-ui, -apple-system, sans-serif',
          mono: 'Consolas, Monaco, monospace'
        }
      },
      spacing: {
        unit: 4,
        containerPadding: '1rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }
    })
  }

  return (
    <div className="theme-system-demo p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-8">
        Enhanced Theme System Demo
      </h1>

      <div className="grid gap-8">
        {/* Current State Display */}
        <section className="bg-surface rounded-lg p-6 border border-border-default">
          <h2 className="text-xl font-semibold mb-4">Current Theme State</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-text-secondary">Active Theme:</dt>
              <dd className="text-text-primary">{theme}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Theme Mode:</dt>
              <dd className="text-text-primary">{themeMode}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">System Preference:</dt>
              <dd className="text-text-primary">{systemTheme}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Following System:</dt>
              <dd className="text-text-primary">{isSystemMode ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Reduced Motion:</dt>
              <dd className="text-text-primary">{prefersReducedMotion ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Available Themes:</dt>
              <dd className="text-text-primary">{availableThemes.join(', ')}</dd>
            </div>
          </dl>
        </section>

        {/* Theme Controls */}
        <section className="bg-surface rounded-lg p-6 border border-border-default">
          <h2 className="text-xl font-semibold mb-4">Theme Controls</h2>
          
          <div className="space-y-4">
            {/* Theme Mode Selector */}
            <ThemeModeSelector />

            {/* Quick Actions */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
              >
                Toggle Theme
              </button>

              <button
                onClick={() => setThemeMode('system')}
                className="px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 transition-colors"
              >
                Use System
              </button>

              <button
                onClick={() => setTheme('light')}
                className="px-4 py-2 bg-surface border border-border-default rounded-md hover:bg-surfaceElevated transition-colors"
              >
                Force Light
              </button>

              <button
                onClick={() => setTheme('dark')}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors"
              >
                Force Dark
              </button>
            </div>
          </div>
        </section>

        {/* Custom Theme Registration */}
        <section className="bg-surface rounded-lg p-6 border border-border-default">
          <h2 className="text-xl font-semibold mb-4">Custom Themes</h2>
          <p className="text-text-secondary mb-4">
            Register custom themes dynamically:
          </p>
          <button
            onClick={registerSolarizedTheme}
            className="px-4 py-2 bg-info-500 text-white rounded-md hover:bg-info-600 transition-colors"
          >
            Register Solarized Theme
          </button>
        </section>

        {/* System Information */}
        <section className="bg-surface rounded-lg p-6 border border-border-default">
          <h2 className="text-xl font-semibold mb-4">System Information</h2>
          <div className="space-y-2 text-sm">
            <p className="text-text-secondary">
              Media Query Support: {mediaQuery ? 'Yes' : 'No'}
            </p>
            <p className="text-text-secondary">
              Detected System Theme: {detectedSystemTheme}
            </p>
            <p className="text-text-secondary">
              Browser prefers-color-scheme: {
                window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
              }
            </p>
          </div>
        </section>

        {/* Usage Examples */}
        <section className="bg-surface rounded-lg p-6 border border-border-default">
          <h2 className="text-xl font-semibold mb-4">Usage Examples</h2>
          <pre className="bg-card p-4 rounded-md overflow-x-auto text-sm">
{`// Import the hook
import { useTheme } from '../hooks/useTheme'

// Use in component
const MyComponent = () => {
  const { 
    theme,
    themeMode,
    setThemeMode,
    isSystemMode 
  } = useTheme()

  return (
    <div>
      {/* Follow system preference */}
      <button onClick={() => setThemeMode('system')}>
        Auto
      </button>
      
      {/* Manual theme selection */}
      <button onClick={() => setThemeMode('dark')}>
        Dark
      </button>
    </div>
  )
}`}
          </pre>
        </section>
      </div>
    </div>
  )
}