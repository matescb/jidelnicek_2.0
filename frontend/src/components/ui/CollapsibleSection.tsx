import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TouchableArea } from './TouchableArea'
import { collapse, getAnimation } from '@/utils/animations'

interface CollapsibleSectionProps {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  onToggle?: (isOpen: boolean) => void
  className?: string
  headerClassName?: string
  contentClassName?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  onToggle,
  className = '',
  headerClassName = '',
  contentClassName = '',
  icon,
  badge
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  const toggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    onToggle?.(newState)
  }
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}>
      <TouchableArea
        onClick={toggle}
        className={`
          flex items-center justify-between w-full p-4 text-left
          hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
          ${headerClassName}
        `}
      >
        <div className="flex items-center gap-3 flex-1">
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          </motion.div>
          
          {icon && (
            <div className="text-gray-600 dark:text-gray-400 flex-shrink-0">
              {icon}
            </div>
          )}
          
          <div className="flex-1 font-medium text-gray-900 dark:text-gray-100">
            {title}
          </div>
          
          {badge && (
            <div className="ml-2 flex-shrink-0">
              {badge}
            </div>
          )}
        </div>
      </TouchableArea>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={getAnimation(collapse)}
            className="overflow-hidden"
          >
            <div className={`p-4 pt-0 ${contentClassName}`}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}