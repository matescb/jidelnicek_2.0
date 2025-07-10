import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "./LoadingSpinner"
import { hover, tap, focus } from "@/utils/animations"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:shadow-md active:bg-primary-800 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-600 dark:active:bg-primary-700",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md active:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 dark:active:bg-red-800",
        outline:
          "border border-gray-300 bg-white shadow-sm hover:bg-gray-50 hover:shadow-md active:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800 dark:active:bg-gray-700",
        secondary:
          "bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 hover:shadow-md active:bg-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:active:bg-gray-600",
        ghost: "hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100 dark:active:bg-gray-700",
        link: "text-primary-600 underline-offset-4 hover:underline hover:text-primary-700 active:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 dark:active:text-primary-500",
      },
      size: {
        default: "h-10 px-4 py-2 gap-2",
        sm: "h-8 rounded-md px-3 py-1.5 gap-1.5 text-xs",
        lg: "h-12 rounded-md px-8 py-3 gap-3 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Helper function to get spinner size based on button size
const getSpinnerSize = (size: string | null | undefined): 'sm' => {
  switch (size) {
    case 'sm':
      return 'sm'
    case 'lg':
      return 'sm'
    default:
      return 'sm'
  }
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * If true, button will render as a Radix UI Slot component
   */
  asChild?: boolean
  /**
   * If true, shows loading spinner and disables button
   */
  isLoading?: boolean
  /**
   * If true, button will take full width of its container
   */
  fullWidth?: boolean
  /**
   * Icon element to display on the left side of the button
   */
  leftIcon?: React.ReactNode
  /**
   * Icon element to display on the right side of the button
   */
  rightIcon?: React.ReactNode
  /**
   * Loading text to display when isLoading is true
   */
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    isLoading = false, 
    fullWidth = false, 
    leftIcon,
    rightIcon,
    loadingText,
    children, 
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : motion.button
    
    // Determine if button is effectively disabled
    const isDisabled = disabled || isLoading
    
    // Prepare content
    const content = (
      <>
        {isLoading ? (
          <>
            <LoadingSpinner 
              size={getSpinnerSize(size)} 
              className="shrink-0"
            />
            {loadingText && <span>{loadingText}</span>}
            {!loadingText && children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </>
    )
    
    // Animation props for motion button
    const motionProps = !asChild && !isDisabled ? {
      whileHover: hover,
      whileTap: tap,
      whileFocus: focus,
    } : {}
    
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          fullWidth && 'w-full',
          isLoading && 'relative'
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        {...motionProps}
        {...props}
      >
        {content}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }