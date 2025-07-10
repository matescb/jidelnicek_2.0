import * as React from "react"
import { cn } from "@/lib/utils"

export interface TooltipProps {
  children: React.ReactNode
  content?: React.ReactNode
  className?: string
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ children, content, className, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    return (
      <div className="relative inline-block" ref={ref} {...props}>
        <div
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          {children}
        </div>
        {content && isVisible && (
          <div
            className={cn(
              "absolute z-10 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm tooltip dark:bg-gray-700",
              "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
              className
            )}
          >
            {content}
            <div className="tooltip-arrow" />
          </div>
        )}
      </div>
    )
  }
)
Tooltip.displayName = "Tooltip"

export { Tooltip }