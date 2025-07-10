import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type TooltipPlacement = 
  | 'top' 
  | 'top-start' 
  | 'top-end'
  | 'bottom' 
  | 'bottom-start' 
  | 'bottom-end'
  | 'left' 
  | 'left-start' 
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual';
export type TooltipSize = 'sm' | 'md' | 'lg';
export type TooltipVariant = 'dark' | 'light';

interface TooltipProps {
  /**
   * Content to display in the tooltip
   */
  content: React.ReactNode;
  /**
   * Children that trigger the tooltip
   */
  children: React.ReactNode;
  /**
   * Placement of the tooltip
   */
  placement?: TooltipPlacement;
  /**
   * Delay before showing tooltip (ms)
   */
  showDelay?: number;
  /**
   * Delay before hiding tooltip (ms)
   */
  hideDelay?: number;
  /**
   * Whether tooltip is disabled
   */
  disabled?: boolean;
  /**
   * Custom CSS classes for tooltip
   */
  className?: string;
  /**
   * Z-index for tooltip
   */
  zIndex?: number;
  /**
   * Trigger mode
   */
  trigger?: TooltipTrigger | TooltipTrigger[];
  /**
   * Whether to show arrow
   */
  arrow?: boolean;
  /**
   * Offset from trigger element (px)
   */
  offset?: number;
  /**
   * Whether to flip placement when space is limited
   */
  flip?: boolean;
  /**
   * Maximum width of tooltip
   */
  maxWidth?: number | string;
  /**
   * Size variant
   */
  size?: TooltipSize;
  /**
   * Style variant
   */
  variant?: TooltipVariant;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Callback when open state changes
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Whether tooltip should stay open on hover
   */
  interactive?: boolean;
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
};

const variantClasses = {
  dark: 'bg-gray-900 dark:bg-gray-800 text-white',
  light: 'bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-800 shadow-lg border border-gray-200 dark:border-gray-300',
};

const motionVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  showDelay = 200,
  hideDelay = 0,
  disabled = false,
  className,
  zIndex = 9999,
  trigger = 'hover',
  arrow = true,
  offset = 8,
  flip = true,
  maxWidth = 250,
  size = 'md',
  variant = 'dark',
  open: controlledOpen,
  onOpenChange,
  interactive = false,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [actualPlacement, setActualPlacement] = useState(placement);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback((open: boolean) => {
    if (!isControlled) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  }, [isControlled, onOpenChange]);

  const show = useCallback(() => {
    if (disabled) return;
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
    
    if (showDelay > 0) {
      showTimeoutRef.current = setTimeout(() => {
        setOpen(true);
      }, showDelay);
    } else {
      setOpen(true);
    }
  }, [disabled, showDelay, setOpen]);

  const hide = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = undefined;
    }
    
    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, hideDelay);
    } else {
      setOpen(false);
    }
  }, [hideDelay, setOpen]);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;
    
    let top = 0;
    let left = 0;
    let finalPlacement = placement;
    
    const placements = {
      'top': () => {
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      },
      'top-start': () => {
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left;
      },
      'top-end': () => {
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.right - tooltipRect.width;
      },
      'bottom': () => {
        top = triggerRect.bottom + offset;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      },
      'bottom-start': () => {
        top = triggerRect.bottom + offset;
        left = triggerRect.left;
      },
      'bottom-end': () => {
        top = triggerRect.bottom + offset;
        left = triggerRect.right - tooltipRect.width;
      },
      'left': () => {
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - offset;
      },
      'left-start': () => {
        top = triggerRect.top;
        left = triggerRect.left - tooltipRect.width - offset;
      },
      'left-end': () => {
        top = triggerRect.bottom - tooltipRect.height;
        left = triggerRect.left - tooltipRect.width - offset;
      },
      'right': () => {
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + offset;
      },
      'right-start': () => {
        top = triggerRect.top;
        left = triggerRect.right + offset;
      },
      'right-end': () => {
        top = triggerRect.bottom - tooltipRect.height;
        left = triggerRect.right + offset;
      },
    };
    
    // Calculate initial position
    placements[placement]();
    
    // Auto-flip logic
    if (flip) {
      const willOverflowTop = top < padding;
      const willOverflowBottom = top + tooltipRect.height > viewportHeight - padding;
      const willOverflowLeft = left < padding;
      const willOverflowRight = left + tooltipRect.width > viewportWidth - padding;
      
      if (placement.startsWith('top') && willOverflowTop) {
        finalPlacement = placement.replace('top', 'bottom') as TooltipPlacement;
        placements[finalPlacement]();
      } else if (placement.startsWith('bottom') && willOverflowBottom) {
        finalPlacement = placement.replace('bottom', 'top') as TooltipPlacement;
        placements[finalPlacement]();
      } else if (placement.startsWith('left') && willOverflowLeft) {
        finalPlacement = placement.replace('left', 'right') as TooltipPlacement;
        placements[finalPlacement]();
      } else if (placement.startsWith('right') && willOverflowRight) {
        finalPlacement = placement.replace('right', 'left') as TooltipPlacement;
        placements[finalPlacement]();
      }
    }
    
    // Ensure tooltip stays within viewport
    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }
    
    setPosition({ top, left });
    setActualPlacement(finalPlacement);
  }, [placement, offset, flip]);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      
      // Recalculate position on scroll or resize
      const handlePositionUpdate = () => calculatePosition();
      window.addEventListener('scroll', handlePositionUpdate, true);
      window.addEventListener('resize', handlePositionUpdate);
      
      return () => {
        window.removeEventListener('scroll', handlePositionUpdate, true);
        window.removeEventListener('resize', handlePositionUpdate);
      };
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (triggers.includes('hover')) show();
  };

  const handleMouseLeave = () => {
    if (triggers.includes('hover') && !interactive) hide();
  };

  const handleClick = () => {
    if (triggers.includes('click')) {
      isOpen ? hide() : show();
    }
  };

  const handleFocus = () => {
    if (triggers.includes('focus')) show();
  };

  const handleBlur = () => {
    if (triggers.includes('focus')) hide();
  };

  const handleTooltipMouseEnter = () => {
    if (interactive && triggers.includes('hover')) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }
    }
  };

  const handleTooltipMouseLeave = () => {
    if (interactive && triggers.includes('hover')) {
      hide();
    }
  };

  // Touch device support
  useEffect(() => {
    if (!triggerRef.current) return;
    
    const element = triggerRef.current;
    let touchTimeout: NodeJS.Timeout;
    
    const handleTouchStart = () => {
      if (triggers.includes('hover') || triggers.includes('click')) {
        touchTimeout = setTimeout(() => {
          show();
        }, 500); // Long press for 500ms
      }
    };
    
    const handleTouchEnd = () => {
      if (touchTimeout) {
        clearTimeout(touchTimeout);
      }
      if (isOpen) {
        setTimeout(() => hide(), 2000); // Auto-hide after 2s
      }
    };
    
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [triggers, isOpen, show, hide]);

  if (disabled || !content) {
    return <>{children}</>;
  }

  const arrowClasses = cn(
    'absolute w-2 h-2 transform rotate-45',
    variant === 'dark' ? 'bg-gray-900 dark:bg-gray-800' : 'bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-300',
    {
      'bottom-[-4px] left-1/2 -translate-x-1/2': actualPlacement.startsWith('top'),
      'top-[-4px] left-1/2 -translate-x-1/2': actualPlacement.startsWith('bottom'),
      'right-[-4px] top-1/2 -translate-y-1/2': actualPlacement.startsWith('left'),
      'left-[-4px] top-1/2 -translate-y-1/2': actualPlacement.startsWith('right'),
      'border-t border-l': actualPlacement.startsWith('bottom'),
      'border-b border-r': actualPlacement.startsWith('top'),
      'border-t border-r': actualPlacement.startsWith('left'),
      'border-b border-l': actualPlacement.startsWith('right'),
    }
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="inline-block"
        aria-describedby={isOpen ? 'tooltip' : undefined}
      >
        {children}
      </div>
      
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={tooltipRef}
              id="tooltip"
              role="tooltip"
              variants={motionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className={cn(
                'fixed rounded-md shadow-lg',
                sizeClasses[size],
                variantClasses[variant],
                interactive ? 'pointer-events-auto' : 'pointer-events-none',
                className
              )}
              style={{
                top: position.top,
                left: position.left,
                zIndex,
                maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
              }}
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              {content}
              {arrow && <div className={arrowClasses} />}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

// Compound components for more control
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, ...props }, ref) => {
  if (asChild) {
    return React.cloneElement(props.children as React.ReactElement, {
      ...props,
      ref,
    });
  }
  return <div ref={ref as any} {...props} />;
});
TooltipTrigger.displayName = 'TooltipTrigger';

export const TooltipContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => {
  return <div {...props} />;
};