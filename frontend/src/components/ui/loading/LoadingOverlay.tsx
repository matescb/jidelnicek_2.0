import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import { Button } from '../button'

export interface LoadingOverlayProps {
  isOpen: boolean
  message?: string
  progress?: number
  onCancel?: () => void
  variant?: 'default' | 'blur' | 'dark'
  spinnerVariant?: 'circle' | 'dots' | 'bars' | 'pulse'
  className?: string
  zIndex?: number
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isOpen,
  message = 'Loading...',
  progress,
  onCancel,
  variant = 'default',
  spinnerVariant = 'circle',
  className,
  zIndex = 50
}) => {
  const backdropClasses = {
    default: 'bg-white/80 dark:bg-gray-900/80',
    blur: 'bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm',
    dark: 'bg-black/50'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed inset-0 flex items-center justify-center',
            backdropClasses[variant],
            className
          )}
          style={{ zIndex }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-sm w-full mx-4"
          >
            {onCancel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="absolute top-2 right-2"
                aria-label="Cancel loading"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            <div className="flex flex-col items-center gap-4">
              <Spinner 
                variant={spinnerVariant} 
                size="lg" 
                color="primary"
              />
              
              {message && (
                <p className="text-center text-gray-700 dark:text-gray-300">
                  {message}
                </p>
              )}
              
              {progress !== undefined && (
                <div className="w-full">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary-600 dark:bg-primary-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
              
              {onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  className="mt-2"
                >
                  Cancel
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}