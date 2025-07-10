import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { modalAnimation, getAnimation } from '@/utils/animations'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

interface DialogOverlayProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  /**
   * Whether clicking outside the dialog should close it
   * @default true
   */
  closeOnClickOutside?: boolean
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, closeOnClickOutside = true, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const dialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw] max-h-[95vh]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  /**
   * Whether clicking outside the dialog should close it
   * @default true
   */
  closeOnClickOutside?: boolean
  /**
   * Whether pressing escape should close the dialog
   * @default true
   */
  closeOnEscape?: boolean
  /**
   * Whether to show the close button
   * @default true
   */
  showCloseButton?: boolean
  /**
   * Custom animation variants for framer-motion
   */
  animationVariants?: {
    initial?: any
    animate?: any
    exit?: any
  }
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({
  className,
  children,
  size,
  closeOnClickOutside = true,
  closeOnEscape = true,
  showCloseButton = true,
  animationVariants,
  ...props
}, ref) => {
  const variants = getAnimation(animationVariants || modalAnimation)

  return (
    <DialogPortal>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DialogOverlay closeOnClickOutside={closeOnClickOutside} />
        </motion.div>
      </AnimatePresence>
      <DialogPrimitive.Content
        ref={ref}
        onEscapeKeyDown={(e) => {
          if (!closeOnEscape) {
            e.preventDefault()
          }
        }}
        onPointerDownOutside={(e) => {
          if (!closeOnClickOutside) {
            e.preventDefault()
          }
        }}
        onInteractOutside={(e) => {
          if (!closeOnClickOutside) {
            e.preventDefault()
          }
        }}
        asChild
        {...props}
      >
        <motion.div
          className={cn(
            dialogContentVariants({ size }),
            'focus:outline-none',
            // Responsive adjustments
            'max-h-[90vh] overflow-y-auto',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            // Mobile responsive styles
            'mx-4 sm:mx-0',
            size === 'full' && 'h-[95vh] overflow-hidden',
            className
          )}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
  type DialogOverlayProps,
}