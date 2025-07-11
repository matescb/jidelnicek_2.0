import React from 'react'
import { ThemeToggle } from './ThemeToggle'
import { ThemeToggleAdvanced } from './ThemeToggleAdvanced'
import { ThemeToggleEnhanced } from './ThemeToggleEnhanced'
import { ThemeToggleAdvancedEnhanced } from './ThemeToggleAdvancedEnhanced'
import { ThemeToggleMobile } from './ThemeToggleMobile'

export const ThemeToggleDemo: React.FC = () => {
  return (
    <div className="p-8 space-y-12 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Theme Toggle Components
        </h1>

        {/* Original Components */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Original Components
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
              Basic Theme Toggle
            </h3>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <ThemeToggle compact />
              <ThemeToggle showTooltip={false} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
              Advanced Theme Toggle
            </h3>
            <div className="flex items-center gap-4">
              <ThemeToggleAdvanced />
              <ThemeToggleAdvanced compact />
              <ThemeToggleAdvanced showCurrentMode={false} />
            </div>
          </div>
        </section>

        {/* Enhanced Components */}
        <section className="space-y-6 mt-12">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Enhanced Components with Animations
          </h2>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
              Enhanced Theme Toggle
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ThemeToggleEnhanced size="sm" />
                <ThemeToggleEnhanced size="md" />
                <ThemeToggleEnhanced size="lg" />
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggleEnhanced variant="icon-text" size="sm" />
                <ThemeToggleEnhanced variant="icon-text" size="md" />
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggleEnhanced tooltipPosition="top" />
                <ThemeToggleEnhanced tooltipPosition="left" />
                <ThemeToggleEnhanced tooltipPosition="right" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
              Advanced Enhanced Theme Toggle
            </h3>
            <div className="flex items-center gap-4">
              <ThemeToggleAdvancedEnhanced />
              <ThemeToggleAdvancedEnhanced compact />
              <ThemeToggleAdvancedEnhanced position="right" />
              <ThemeToggleAdvancedEnhanced showCustomThemes />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
              Mobile Theme Toggle
            </h3>
            <div className="flex items-center gap-4">
              <ThemeToggleMobile />
              <ThemeToggleMobile className="bg-gray-100 dark:bg-gray-700 rounded-lg" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Note: The floating FAB version is positioned fixed at bottom-right of the viewport
            </p>
          </div>
        </section>

        {/* Feature Comparison */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Feature Comparison
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="pb-3 font-medium text-gray-700 dark:text-gray-300">Component</th>
                  <th className="pb-3 font-medium text-gray-700 dark:text-gray-300">Features</th>
                  <th className="pb-3 font-medium text-gray-700 dark:text-gray-300">Best Use Case</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                <tr className="border-b dark:border-gray-700">
                  <td className="py-3 font-medium">ThemeToggle</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Simple toggle, tooltip, compact mode
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Basic light/dark switching
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-3 font-medium">ThemeToggleEnhanced</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Smooth animations, system mode, multiple sizes, keyboard navigation
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Modern UI with accessibility focus
                  </td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-3 font-medium">ThemeToggleAdvancedEnhanced</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Dropdown menu, descriptions, custom themes support, full keyboard navigation
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Power users, multiple theme options
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium">ThemeToggleMobile</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Compact design, floating FAB option, touch-optimized
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    Mobile navigation, small screens
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Accessibility Notes */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Accessibility Features
          </h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-500">✓</span>
                Full keyboard navigation support (Tab, Enter, Space, Arrow keys, Escape)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">✓</span>
                Proper ARIA labels and roles for screen readers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">✓</span>
                Focus indicators and ring styles
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">✓</span>
                Descriptive tooltips and aria-describedby associations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">✓</span>
                Motion animations respect prefers-reduced-motion
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* Floating FAB Demo - Only show on larger screens */}
      <div className="hidden md:block">
        <ThemeToggleMobile position="floating" />
      </div>
    </div>
  )
}