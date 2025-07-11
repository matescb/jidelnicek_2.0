import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface FABAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  color?: string
}

interface FloatingActionButtonProps {
  onClick?: () => void
  actions?: FABAction[]
  icon?: React.ComponentType<{ className?: string }>
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  hideOnScroll?: boolean
  className?: string
  buttonClassName?: string
  size?: 'sm' | 'md' | 'lg'
  extended?: boolean
  label?: string
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  actions = [],
  icon: Icon = PlusIcon,
  position = 'bottom-right',
  hideOnScroll = true,
  className,
  buttonClassName,
  size = 'md',
  extended = false,
  label
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const controls = useAnimation()

  useEffect(() => {
    if (!hideOnScroll) return

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hideOnScroll])

  const handleMainClick = () => {
    if (actions.length > 0) {
      setIsExpanded(!isExpanded)
    } else if (onClick) {
      onClick()
    }
  }

  const handleActionClick = (action: FABAction) => {
    action.onClick()
    setIsExpanded(false)
  }

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
  }

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  }

  const iconSizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 bg-black/20 z-40"
          />
        )}
      </AnimatePresence>

      {/* FAB Container */}
      <motion.div
        animate={{
          y: isVisible ? 0 : 100,
          opacity: isVisible ? 1 : 0
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={clsx(
          'fixed z-50 safe-area-bottom',
          positionClasses[position],
          className
        )}
      >
        {/* Mini FABs */}
        <AnimatePresence>
          {isExpanded && actions.map((action, index) => {
            const ActionIcon = action.icon
            
            return (
              <motion.div
                key={action.id}
                initial={{ scale: 0, y: 20, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  y: 0, 
                  opacity: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  scale: 0, 
                  y: 20, 
                  opacity: 0,
                  transition: { delay: (actions.length - index - 1) * 0.05 }
                }}
                className="flex items-center justify-end mb-4"
              >
                {/* Label */}
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className={clsx(
                    'mr-3 px-3 py-1',
                    'bg-gray-800 text-white text-sm',
                    'rounded-lg shadow-lg',
                    'whitespace-nowrap'
                  )}
                >
                  {action.label}
                </motion.span>

                {/* Mini FAB */}
                <button
                  onClick={() => handleActionClick(action)}
                  className={clsx(
                    'w-12 h-12 rounded-full shadow-lg',
                    'flex items-center justify-center',
                    'transition-transform active:scale-95',
                    action.color || 'bg-gray-600 hover:bg-gray-700',
                    'text-white'
                  )}
                  aria-label={action.label}
                >
                  <ActionIcon className="w-5 h-5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          onClick={handleMainClick}
          animate={{ rotate: isExpanded ? 45 : 0 }}
          whileTap={{ scale: 0.95 }}
          className={clsx(
            'rounded-full shadow-lg',
            'flex items-center justify-center',
            'bg-primary-600 hover:bg-primary-700',
            'text-white font-medium',
            'transition-colors',
            extended ? 'px-4' : sizeClasses[size],
            !extended && sizeClasses[size],
            buttonClassName
          )}
          aria-label={label || 'Floating action button'}
        >
          <Icon className={clsx(iconSizeClasses[size], extended && 'mr-2')} />
          {extended && label && (
            <span className="text-sm">{label}</span>
          )}
        </motion.button>
      </motion.div>
    </>
  )
}

// Simplified FAB variant
export const SimpleFAB: React.FC<{
  onClick: () => void
  icon?: React.ComponentType<{ className?: string }>
  className?: string
  hideOnScroll?: boolean
}> = ({ onClick, icon: Icon = PlusIcon, className, hideOnScroll = true }) => {
  return (
    <FloatingActionButton
      onClick={onClick}
      icon={Icon}
      hideOnScroll={hideOnScroll}
      className={className}
    />
  )
}