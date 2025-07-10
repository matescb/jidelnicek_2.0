import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TouchableArea } from './TouchableArea'

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
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0)
  const contentRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)
  
  useEffect(() => {
    if (!contentRef.current) return
    
    const content = contentRef.current
    const updateHeight = () => {
      if (isOpen) {
        setHeight(content.scrollHeight)
      } else {
        setHeight(0)
      }
    }
    
    // Initial height
    updateHeight()
    
    // Update height on content changes
    const observer = new ResizeObserver(updateHeight)
    observer.observe(content)
    
    return () => observer.disconnect()
  }, [isOpen, children])
  
  const toggle = () => {
    if (isAnimating.current) return
    
    const newState = !isOpen
    setIsOpen(newState)
    onToggle?.(newState)
    
    if (contentRef.current) {
      isAnimating.current = true
      const content = contentRef.current
      
      if (newState) {
        // Opening
        setHeight(content.scrollHeight)
        
        // After animation, set to auto for dynamic content
        setTimeout(() => {
          setHeight(undefined)
          isAnimating.current = false
        }, 300)
      } else {
        // Closing
        setHeight(content.scrollHeight)
        
        // Force reflow
        content.offsetHeight
        
        requestAnimationFrame(() => {
          setHeight(0)
          setTimeout(() => {
            isAnimating.current = false
          }, 300)
        })
      }
    }
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
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          )}
          
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
      
      <div
        ref={contentRef}
        className="overflow-hidden transition-[height] duration-300 ease-in-out"
        style={{ height }}
      >
        <div className={`p-4 pt-0 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  )
}