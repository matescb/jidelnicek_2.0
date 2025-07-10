import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

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
  delay?: number;
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
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delay = 200,
  disabled = false,
  className,
  zIndex = 9999,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;
      
      switch (placement) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.right + 8;
          break;
      }
      
      // Ensure tooltip stays within viewport
      const padding = 8;
      if (left < padding) left = padding;
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
      }
      
      setPosition({ top, left });
    }
  }, [isVisible, placement]);

  const handleMouseEnter = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          className={clsx(
            'fixed px-2 py-1 text-xs rounded shadow-lg',
            'bg-gray-900 dark:bg-gray-700 text-white',
            'pointer-events-none whitespace-nowrap',
            'transition-all duration-100 ease-out',
            className
          )}
          style={{
            top: position.top,
            left: position.left,
            zIndex,
          }}
        >
          {content}
          <div
            className={clsx(
              'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45',
              placement === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
              placement === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
              placement === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
              placement === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
            )}
          />
        </div>,
        document.body
      )}
    </>
  );
};