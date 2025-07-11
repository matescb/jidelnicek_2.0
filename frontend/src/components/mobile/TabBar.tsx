import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export interface TabItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
  onClick?: () => void
}

interface TabBarProps {
  items: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  showLabels?: boolean
  variant?: 'default' | 'floating'
}

export const TabBar: React.FC<TabBarProps> = ({
  items,
  activeTab,
  onTabChange,
  className,
  showLabels = true,
  variant = 'default'
}) => {
  const containerClasses = clsx(
    'flex items-center justify-around',
    'bg-white dark:bg-gray-900',
    'safe-area-bottom',
    {
      'fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700': 
        variant === 'default',
      'mx-4 mb-4 rounded-2xl shadow-lg': 
        variant === 'floating'
    },
    className
  )

  return (
    <nav className={containerClasses}>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id

        return (
          <button
            key={item.id}
            onClick={() => {
              onTabChange(item.id)
              item.onClick?.()
            }}
            className={clsx(
              'relative flex flex-col items-center justify-center',
              'py-2 px-3 min-w-[64px] flex-1',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
            )}
          >
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 z-0"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <div className="h-full w-full flex items-center justify-center">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full" />
                </div>
              </motion.div>
            )}

            {/* Icon with badge */}
            <div className="relative z-10">
              <Icon
                className={clsx(
                  'w-6 h-6 transition-colors duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              />
              
              {/* Badge */}
              {item.badge !== undefined && (
                <span
                  className={clsx(
                    'absolute -top-1 -right-1',
                    'min-w-[18px] h-[18px] px-1',
                    'flex items-center justify-center',
                    'text-xs font-medium text-white',
                    'bg-red-500 rounded-full',
                    'transform scale-90'
                  )}
                >
                  {typeof item.badge === 'number' && item.badge > 99 
                    ? '99+' 
                    : item.badge}
                </span>
              )}
            </div>

            {/* Label */}
            {showLabels && (
              <motion.span
                initial={false}
                animate={{
                  scale: isActive ? 1 : 0.95,
                  opacity: isActive ? 1 : 0.7
                }}
                className={clsx(
                  'text-xs mt-1 z-10',
                  'transition-colors duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {item.label}
              </motion.span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// Example animated tab indicator variant
export const AnimatedTabBar: React.FC<TabBarProps> = (props) => {
  const activeIndex = props.items.findIndex(item => item.id === props.activeTab)

  return (
    <div className="relative">
      <TabBar {...props} />
      
      {/* Animated indicator line */}
      <motion.div
        className="absolute top-0 left-0 h-0.5 bg-primary-600 dark:bg-primary-400"
        initial={false}
        animate={{
          width: `${100 / props.items.length}%`,
          x: `${activeIndex * 100}%`
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  )
}