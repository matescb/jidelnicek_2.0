import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"
import { Badge } from "./badge"
import { hover, tap, focus } from "@/utils/animations"

const cardVariants = cva(
  "rounded-lg bg-card text-card-foreground transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-white dark:bg-gray-900",
        primary: "bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800",
        secondary: "bg-secondary-50 dark:bg-secondary-950 border-secondary-200 dark:border-secondary-800",
        success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
        warning: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
        error: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
        gradient: "bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950 dark:to-secondary-950",
      },
      elevation: {
        flat: "shadow-none",
        raised: "shadow-sm hover:shadow-md",
        elevated: "shadow-lg hover:shadow-xl",
      },
      border: {
        none: "border-0",
        subtle: "border border-gray-200 dark:border-gray-800",
        prominent: "border-2 border-gray-300 dark:border-gray-700",
      },
      interactive: {
        static: "",
        hover: "hover:scale-[1.02] hover:-translate-y-1 cursor-pointer",
        clickable: "cursor-pointer active:scale-[0.98]",
      },
    },
    defaultVariants: {
      variant: "default",
      elevation: "raised",
      border: "subtle",
      interactive: "static",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
  loading?: boolean
  disabled?: boolean
  selected?: boolean
  gradient?: boolean
  withAnimation?: boolean
  animationType?: 'scale' | 'fade' | 'slide'
  ribbon?: {
    text: string
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  }
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className, 
    variant,
    elevation,
    border,
    interactive,
    loading = false,
    disabled = false,
    selected = false,
    gradient = false,
    withAnimation = false,
    animationType = 'scale',
    ribbon,
    children,
    ...props 
  }, ref) => {
    const Component = withAnimation ? motion.div : 'div'
    
    const animationVariants = {
      scale: {
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.9, opacity: 0 }
      },
      fade: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      },
      slide: {
        initial: { x: -20, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: 20, opacity: 0 }
      }
    }

    const cardContent = (
      <>
        {ribbon && (
          <div className="absolute -top-2 -right-2 z-10">
            <Badge
              variant={ribbon.color || 'primary'}
              className="px-3 py-1 shadow-md"
            >
              {ribbon.text}
            </Badge>
          </div>
        )}
        {loading ? (
          <div className="p-6">
            <Skeleton className="h-4 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2 mb-4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          children
        )}
      </>
    )

    const componentProps = withAnimation ? {
      ...animationVariants[animationType],
      whileHover: interactive === 'hover' || interactive === 'clickable' ? hover : undefined,
      whileTap: interactive === 'clickable' ? tap : undefined,
      whileFocus: focus,
      transition: { duration: 0.2 }
    } : {}

    return (
      <Component
        ref={ref}
        className={cn(
          cardVariants({ variant: gradient ? 'gradient' : variant, elevation, border, interactive }),
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          selected && "ring-2 ring-primary-500 ring-offset-2",
          "relative overflow-hidden",
          className
        )}
        {...componentProps}
        {...props}
      >
        {cardContent}
      </Component>
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// New component for image headers
interface CardImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string
  alt: string
  height?: string
  overlay?: boolean
  overlayContent?: React.ReactNode
}

const CardImage = React.forwardRef<HTMLDivElement, CardImageProps>(
  ({ className, src, alt, height = "h-48", overlay = false, overlayContent, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-hidden", height, className)} {...props}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      )}
      {overlayContent && (
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          {overlayContent}
        </div>
      )}
    </div>
  )
)
CardImage.displayName = "CardImage"

// New component for actions footer
interface CardActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'left' | 'center' | 'right' | 'between'
}

const CardActions = React.forwardRef<HTMLDivElement, CardActionsProps>(
  ({ className, align = 'right', children, ...props }, ref) => {
    const alignmentClasses = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between'
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 p-6 pt-0",
          alignmentClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardActions.displayName = "CardActions"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  CardImage,
  CardActions
}