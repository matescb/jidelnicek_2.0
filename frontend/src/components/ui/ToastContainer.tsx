import * as React from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Toast } from './toast'
import { cn } from '@/lib/utils'

export type ToastPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right'

interface ToastContainerProps {
  toasts: Array<{
    id: string
    title: string
    description?: string
    variant?: 'default' | 'success' | 'error' | 'warning' | 'info'
    action?: React.ReactNode
    duration?: number
    persistent?: boolean
    showProgress?: boolean
  }>
  position?: ToastPosition
  maxVisible?: number
  onClose: (id: string) => void
}

const positionClasses: Record<ToastPosition, string> = {
  'top-left': 'top-0 left-0 items-start',
  'top-center': 'top-0 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-0 right-0 items-end',
  'bottom-left': 'bottom-0 left-0 items-start',
  'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-0 right-0 items-end',
}

const getAnimationVariants = (position: ToastPosition) => {
  const isTop = position.startsWith('top')
  const isLeft = position.includes('left')
  const isRight = position.includes('right')
  const isCenter = position.includes('center')

  let initial = {}
  let animate = {}
  let exit = {}

  if (isTop) {
    initial = { y: -100, opacity: 0 }
    animate = { y: 0, opacity: 1 }
    exit = { y: -100, opacity: 0 }
  } else {
    initial = { y: 100, opacity: 0 }
    animate = { y: 0, opacity: 1 }
    exit = { y: 100, opacity: 0 }
  }

  if (isLeft && !isCenter) {
    initial = { ...initial, x: -100 }
    animate = { ...animate, x: 0 }
    exit = { ...exit, x: -100 }
  } else if (isRight && !isCenter) {
    initial = { ...initial, x: 100 }
    animate = { ...animate, x: 0 }
    exit = { ...exit, x: 100 }
  }

  return { initial, animate, exit }
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position = 'bottom-right',
  maxVisible = 5,
  onClose,
}) => {
  const [mounted, setMounted] = React.useState(false)
  const visibleToasts = toasts.slice(-maxVisible)
  const animationVariants = getAnimationVariants(position)
  const isTop = position.startsWith('top')

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        // Close the most recent toast
        onClose(toasts[toasts.length - 1].id)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [toasts, onClose])

  if (!mounted) {
    return null
  }

  const handleDragEnd = (id: string, info: PanInfo) => {
    const threshold = 100
    const velocity = 500

    if (
      Math.abs(info.offset.x) > threshold ||
      Math.abs(info.velocity.x) > velocity
    ) {
      onClose(id)
    }
  }

  const toastElements = (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2 p-4 pointer-events-none',
        positionClasses[position]
      )}
      style={{ maxHeight: '100vh' }}
    >
      <AnimatePresence mode="sync">
        {visibleToasts.map((toast, index) => (
          <motion.div
            key={toast.id}
            layout
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            dragTransition={{ bounceDamping: 20 }}
            onDragEnd={(_, info) => handleDragEnd(toast.id, info)}
            initial={animationVariants.initial}
            animate={animationVariants.animate}
            exit={animationVariants.exit}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
            style={{
              zIndex: visibleToasts.length - index,
              // Stack effect for multiple toasts
              scale: 1 - (visibleToasts.length - index - 1) * 0.05,
              y: isTop ? (visibleToasts.length - index - 1) * -10 : (visibleToasts.length - index - 1) * 10,
            }}
            className="pointer-events-auto touch-pan-y"
          >
            <Toast
              {...toast}
              onClose={() => onClose(toast.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )

  return createPortal(toastElements, document.body)
}