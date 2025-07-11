import React, { useEffect, useRef, useState } from 'react'
import { motion, useAnimation, useMotionValue, PanInfo } from 'framer-motion'
import clsx from 'clsx'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  snapPoints?: number[]
  defaultSnapPoint?: number
  className?: string
  onSnapPointChange?: (index: number) => void
  showHandle?: boolean
  backdropClassName?: string
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  snapPoints = [0.5, 0.9],
  defaultSnapPoint = 0,
  className,
  onSnapPointChange,
  showHandle = true,
  backdropClassName
}) => {
  const [currentSnapPoint, setCurrentSnapPoint] = useState(defaultSnapPoint)
  const controls = useAnimation()
  const y = useMotionValue(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [windowHeight, setWindowHeight] = useState(0)

  useEffect(() => {
    setWindowHeight(window.innerHeight)
    const handleResize = () => setWindowHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when open
      document.body.style.overflow = 'hidden'
      const snapHeight = windowHeight * (1 - snapPoints[currentSnapPoint])
      controls.start({ y: snapHeight })
    } else {
      document.body.style.overflow = 'unset'
      controls.start({ y: windowHeight })
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, currentSnapPoint, controls, snapPoints, windowHeight])

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { velocity, offset } = info
    const currentY = y.get()
    
    // Close if dragged down with velocity or past threshold
    if (velocity.y > 500 || currentY > windowHeight * 0.8) {
      controls.start({ y: windowHeight })
      onClose()
      return
    }

    // Find closest snap point
    let closestSnapIndex = 0
    let closestDistance = Infinity

    snapPoints.forEach((point, index) => {
      const snapY = windowHeight * (1 - point)
      const distance = Math.abs(currentY - snapY)
      if (distance < closestDistance) {
        closestDistance = distance
        closestSnapIndex = index
      }
    })

    setCurrentSnapPoint(closestSnapIndex)
    onSnapPointChange?.(closestSnapIndex)
    const targetY = windowHeight * (1 - snapPoints[closestSnapIndex])
    controls.start({ y: targetY })
  }

  if (!isOpen && y.get() === windowHeight) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 1 : 0 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className={clsx(
          'fixed inset-0 bg-black/50 z-40',
          backdropClassName
        )}
      />

      {/* Bottom Sheet */}
      <motion.div
        ref={containerRef}
        style={{ y }}
        initial={{ y: windowHeight }}
        animate={controls}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className={clsx(
          'fixed inset-x-0 bottom-0 z-50',
          'bg-white dark:bg-gray-900',
          'rounded-t-2xl shadow-xl',
          'max-h-[95vh]',
          className
        )}
      >
        {/* Handle */}
        {showHandle && (
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain h-full px-4 pb-safe">
          {children}
        </div>
      </motion.div>
    </>
  )
}