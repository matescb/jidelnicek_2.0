import React from 'react'
import { ThemeToggle } from './ThemeToggle'
import { ThemeToggleAdvanced } from './ThemeToggleAdvanced'

/**
 * Theme Toggle Component Examples
 * 
 * This file demonstrates various configurations and use cases
 * for the ThemeToggle and ThemeToggleAdvanced components.
 */

export const ThemeToggleExamples: React.FC = () => {
  return (
    <div className="space-y-8 p-8 bg-gray-50 dark:bg-gray-900">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Theme Toggle Components
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Enhanced theme switching components with animations and accessibility features.
        </p>
      </div>

      {/* Simple Theme Toggle Examples */}
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Simple Theme Toggle
        </h3>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Default</p>
            <ThemeToggle />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Compact</p>
            <ThemeToggle compact />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">No Tooltip</p>
            <ThemeToggle showTooltip={false} />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Custom Class</p>
            <ThemeToggle className="shadow-lg" />
          </div>
        </div>
      </section>

      {/* Advanced Theme Toggle Examples */}
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Advanced Theme Toggle (with System Support)
        </h3>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Default</p>
            <ThemeToggleAdvanced />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Compact</p>
            <ThemeToggleAdvanced compact />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Hide Current Mode</p>
            <ThemeToggleAdvanced showCurrentMode={false} />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Custom Styled</p>
            <ThemeToggleAdvanced className="border-2 border-primary-500" />
          </div>
        </div>
      </section>

      {/* Usage in Different Contexts */}
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Usage in Different Contexts
        </h3>
        
        {/* Navigation Bar Example */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Navigation Bar</h4>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">Settings</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Example */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 max-w-xs">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Mobile Menu</h4>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              Profile
            </button>
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              Settings
            </button>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-gray-700 dark:text-gray-300">Theme</span>
              <ThemeToggle compact />
            </div>
          </div>
        </div>
        
        {/* Settings Panel Example */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Settings Panel</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Appearance</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize how the app looks on your device
                </p>
              </div>
              <ThemeToggleAdvanced />
            </div>
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Code Examples
        </h3>
        
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <pre className="text-sm">
{`// Simple Theme Toggle
import { ThemeToggle } from '@components/navigation'

// Basic usage
<ThemeToggle />

// Compact mode for mobile
<ThemeToggle compact />

// Without tooltip
<ThemeToggle showTooltip={false} />

// Advanced Theme Toggle with System Support
import { ThemeToggleAdvanced } from '@components/navigation'

// Full featured dropdown
<ThemeToggleAdvanced />

// Compact without mode label
<ThemeToggleAdvanced compact showCurrentMode={false} />

// With custom styling
<ThemeToggleAdvanced className="custom-class" />`}
          </pre>
        </div>
      </section>
    </div>
  )
}