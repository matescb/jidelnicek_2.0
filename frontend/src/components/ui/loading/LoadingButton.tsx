import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { Button, ButtonProps } from '../button'
import { Spinner } from './Spinner'
import { cn } from '@/lib/utils'

export interface LoadingButtonProps extends Omit<ButtonProps, 'isLoading'> {
  isLoading?: boolean
  loadingText?: string
  isSuccess?: boolean
  successText?: string
  isError?: boolean
  errorText?: string
  showIcon?: boolean
  spinnerVariant?: 'circle' | 'dots' | 'bars' | 'pulse'
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText,
  isSuccess = false,
  successText,
  isError = false,
  errorText,
  showIcon = true,
  spinnerVariant = 'circle',
  children,
  disabled,
  className,
  variant = 'default',
  size = 'default',
  ...props
}) => {
  const isDisabled = disabled || isLoading || isSuccess || isError
  
  const getButtonVariant = () => {
    if (isSuccess) return 'default'
    if (isError) return 'destructive'
    return variant
  }
  
  const getContent = () => {
    if (isLoading) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="inline-flex items-center gap-2"
        >
          <Spinner 
            variant={spinnerVariant} 
            size="sm" 
            color="current"
          />
          {loadingText || children}
        </motion.div>
      )
    }
    
    if (isSuccess) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="inline-flex items-center gap-2"
        >
          {showIcon && <Check className="h-4 w-4" />}
          {successText || 'Success!'}
        </motion.div>
      )
    }
    
    if (isError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="inline-flex items-center gap-2"
        >
          {showIcon && <X className="h-4 w-4" />}
          {errorText || 'Error!'}
        </motion.div>
      )
    }
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {children}
      </motion.div>
    )
  }
  
  return (
    <Button
      {...props}
      variant={getButtonVariant()}
      size={size}
      disabled={isDisabled}
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        isSuccess && 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700',
        className
      )}
    >
      <AnimatePresence mode="wait">
        {getContent()}
      </AnimatePresence>
    </Button>
  )
}