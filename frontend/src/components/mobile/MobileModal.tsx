import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimation, PanInfo } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface MobileModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  showCloseButton?: boolean
  allowSwipeDown?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  zIndex?: number
}

export const MobileModal: React.FC<MobileModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  allowSwipeDown = true,
  className,
  headerClassName,
  contentClassName,
  zIndex = 50
}) => {
  const controls = useAnimation()
  const [isDragging, setIsDragging] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false)
    
    // Close if dragged down more than 100px or with velocity
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    } else {
      controls.start({ y: 0 })
    }
  }

  const modalVariants = {
    hidden: { y: '100%', transition: { type: 'tween', duration: 0.3 } },
    visible: { y: 0, transition: { type: 'tween', duration: 0.3 } }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ zIndex }}
            className="fixed inset-0 bg-black/50"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            drag={allowSwipeDown ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            style={{ zIndex: zIndex + 1 }}
            className={clsx(
              'fixed inset-0',
              'bg-white dark:bg-gray-900',
              'flex flex-col',
              className
            )}
          >
            {/* Header */}
            <div
              className={clsx(
                'flex items-center justify-between',
                'px-4 py-3 border-b border-gray-200 dark:border-gray-700',
                'safe-area-top',
                headerClassName
              )}
            >
              {allowSwipeDown && (
                <div className="absolute left-1/2 -translate-x-1/2 top-2">
                  <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>
              )}
              
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>

            {/* Content */}
            <div
              className={clsx(
                'flex-1 overflow-y-auto overscroll-contain',
                'px-4 py-4 safe-area-bottom',
                contentClassName
              )}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Stack provider for managing multiple modals
interface ModalStackContextType {
  stack: string[]
  pushModal: (id: string) => void
  popModal: () => void
  clearStack: () => void
}

const ModalStackContext = React.createContext<ModalStackContextType>({
  stack: [],
  pushModal: () => {},
  popModal: () => {},
  clearStack: () => {}
})

export const ModalStackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<string[]>([])

  const pushModal = (id: string) => {
    setStack(prev => [...prev, id])
  }

  const popModal = () => {
    setStack(prev => prev.slice(0, -1))
  }

  const clearStack = () => {
    setStack([])
  }

  return (
    <ModalStackContext.Provider value={{ stack, pushModal, popModal, clearStack }}>
      {children}
    </ModalStackContext.Provider>
  )
}

export const useModalStack = () => {
  const context = React.useContext(ModalStackContext)
  if (!context) {
    throw new Error('useModalStack must be used within ModalStackProvider')
  }
  return context
}