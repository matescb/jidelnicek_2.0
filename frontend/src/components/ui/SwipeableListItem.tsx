import React, { useRef, useState, useCallback } from 'react'
import { TouchableArea } from './TouchableArea'

interface SwipeAction {
  label: string
  icon?: React.ReactNode
  color: string
  bgColor: string
  onClick: () => void
}

interface SwipeableListItemProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  threshold?: number
  className?: string
  onSwipeStart?: () => void
  onSwipeEnd?: () => void
}

export function SwipeableListItem({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
  className = '',
  onSwipeStart,
  onSwipeEnd
}: SwipeableListItemProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)
  const [actionTriggered, setActionTriggered] = useState<'left' | 'right' | null>(null)
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    setStartX(touch.clientX)
    setCurrentX(touch.clientX)
    setIsSwiping(true)
    onSwipeStart?.()
  }, [onSwipeStart])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    setCurrentX(touch.clientX)
    
    // Limit swipe distance
    const maxSwipe = Math.max(leftActions.length, rightActions.length) * threshold
    const limitedDelta = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX))
    
    setOffset(limitedDelta)
    
    // Check if action threshold is reached
    if (Math.abs(limitedDelta) >= threshold) {
      const direction = limitedDelta > 0 ? 'left' : 'right'
      setActionTriggered(direction)
    } else {
      setActionTriggered(null)
    }
  }, [isSwiping, startX, leftActions.length, rightActions.length, threshold])
  
  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return
    
    setIsSwiping(false)
    onSwipeEnd?.()
    
    // Trigger action if threshold was reached
    if (actionTriggered) {
      const actions = actionTriggered === 'left' ? leftActions : rightActions
      const actionIndex = Math.floor(Math.abs(offset) / threshold) - 1
      
      if (actions[actionIndex]) {
        actions[actionIndex].onClick()
      }
    }
    
    // Animate back to center
    setOffset(0)
    setActionTriggered(null)
  }, [isSwiping, actionTriggered, leftActions, rightActions, offset, threshold, onSwipeEnd])
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setStartX(e.clientX)
    setCurrentX(e.clientX)
    setIsSwiping(true)
    onSwipeStart?.()
  }, [onSwipeStart])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSwiping) return
    
    const deltaX = e.clientX - startX
    setCurrentX(e.clientX)
    
    // Limit swipe distance
    const maxSwipe = Math.max(leftActions.length, rightActions.length) * threshold
    const limitedDelta = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX))
    
    setOffset(limitedDelta)
    
    // Check if action threshold is reached
    if (Math.abs(limitedDelta) >= threshold) {
      const direction = limitedDelta > 0 ? 'left' : 'right'
      setActionTriggered(direction)
    } else {
      setActionTriggered(null)
    }
  }, [isSwiping, startX, leftActions.length, rightActions.length, threshold])
  
  const handleMouseUp = useCallback(() => {
    handleTouchEnd()
  }, [handleTouchEnd])
  
  const handleMouseLeave = useCallback(() => {
    if (isSwiping) {
      handleTouchEnd()
    }
  }, [isSwiping, handleTouchEnd])
  
  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left Actions */}
      {leftActions.length > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-stretch"
          style={{
            transform: `translateX(${Math.min(0, offset - threshold * leftActions.length)}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {leftActions.map((action, index) => (
            <TouchableArea
              key={index}
              onClick={action.onClick}
              className={`
                flex items-center justify-center px-4
                ${action.bgColor}
                ${actionTriggered === 'left' && Math.floor(offset / threshold) - 1 === index ? 'opacity-100' : 'opacity-70'}
              `}
              style={{ minWidth: threshold }}
            >
              <div className="flex flex-col items-center gap-1">
                {action.icon && (
                  <div className={action.color}>
                    {action.icon}
                  </div>
                )}
                <span className={`text-xs font-medium ${action.color}`}>
                  {action.label}
                </span>
              </div>
            </TouchableArea>
          ))}
        </div>
      )}
      
      {/* Right Actions */}
      {rightActions.length > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{
            transform: `translateX(${Math.max(0, offset + threshold * rightActions.length)}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {rightActions.map((action, index) => (
            <TouchableArea
              key={index}
              onClick={action.onClick}
              className={`
                flex items-center justify-center px-4
                ${action.bgColor}
                ${actionTriggered === 'right' && Math.floor(-offset / threshold) - 1 === index ? 'opacity-100' : 'opacity-70'}
              `}
              style={{ minWidth: threshold }}
            >
              <div className="flex flex-col items-center gap-1">
                {action.icon && (
                  <div className={action.color}>
                    {action.icon}
                  </div>
                )}
                <span className={`text-xs font-medium ${action.color}`}>
                  {action.label}
                </span>
              </div>
            </TouchableArea>
          ))}
        </div>
      )}
      
      {/* Main Content */}
      <div
        className="relative bg-white dark:bg-gray-800"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  )
}