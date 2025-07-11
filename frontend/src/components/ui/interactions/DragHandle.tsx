import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls, DragHandlers } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DragHandleProps {
  children: React.ReactNode;
  className?: string;
  handleClassName?: string;
  onDragStart?: () => void;
  onDragEnd?: (info: any) => void;
  onDrag?: (event: any, info: any) => void;
  dragConstraints?: any;
  dragElastic?: number;
  dragMomentum?: boolean;
  showGhost?: boolean;
  dropZones?: Array<{
    id: string;
    element: HTMLElement | null;
  }>;
  onDrop?: (dropZoneId: string | null) => void;
  disabled?: boolean;
}

export const DragHandle: React.FC<DragHandleProps> = ({
  children,
  className,
  handleClassName,
  onDragStart,
  onDragEnd,
  onDrag,
  dragConstraints,
  dragElastic = 0.2,
  dragMomentum = true,
  showGhost = true,
  dropZones = [],
  onDrop,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);
  const dragControls = useDragControls();
  const elementRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const checkDropZones = (x: number, y: number) => {
    let foundDropZone: string | null = null;

    dropZones.forEach(({ id, element }) => {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        foundDropZone = id;
      }
    });

    setActiveDropZone(foundDropZone);
    return foundDropZone;
  };

  const handleDragStart: DragHandlers['onDragStart'] = (event, info) => {
    setIsDragging(true);
    onDragStart?.();

    if (showGhost && elementRef.current && ghostRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      ghostRef.current.style.width = `${rect.width}px`;
      ghostRef.current.style.height = `${rect.height}px`;
      ghostRef.current.style.left = `${rect.left}px`;
      ghostRef.current.style.top = `${rect.top}px`;
      ghostRef.current.style.display = 'block';
    }
  };

  const handleDrag: DragHandlers['onDrag'] = (event, info) => {
    const { point } = info;
    checkDropZones(point.x, point.y);
    onDrag?.(event, info);

    if (showGhost && ghostRef.current) {
      ghostRef.current.style.transform = `translate(${info.offset.x}px, ${info.offset.y}px)`;
    }
  };

  const handleDragEnd: DragHandlers['onDragEnd'] = (event, info) => {
    setIsDragging(false);
    const { point } = info;
    const dropZoneId = checkDropZones(point.x, point.y);
    
    onDragEnd?.(info);
    onDrop?.(dropZoneId);
    setActiveDropZone(null);

    if (showGhost && ghostRef.current) {
      ghostRef.current.style.display = 'none';
    }
  };

  useEffect(() => {
    // Highlight active drop zones
    dropZones.forEach(({ id, element }) => {
      if (!element) return;
      
      if (isDragging && activeDropZone === id) {
        element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50', 'bg-blue-50', 'dark:bg-blue-900/20');
      } else {
        element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50', 'bg-blue-50', 'dark:bg-blue-900/20');
      }
    });
  }, [isDragging, activeDropZone, dropZones]);

  return (
    <>
      <motion.div
        ref={elementRef}
        className={cn(
          'relative',
          isDragging && 'z-50',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        drag={!disabled}
        dragControls={dragControls}
        dragConstraints={dragConstraints}
        dragElastic={dragElastic}
        dragMomentum={dragMomentum}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileDrag={{
          scale: 1.05,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        transition={{
          scale: { duration: 0.2 },
        }}
      >
        <div
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 p-1',
            'cursor-grab active:cursor-grabbing',
            'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            'transition-colors duration-200',
            disabled && 'cursor-not-allowed',
            handleClassName
          )}
          onPointerDown={(e) => !disabled && dragControls.start(e)}
        >
          <GripVertical className="h-5 w-5" />
        </div>
        {children}
      </motion.div>

      {/* Ghost element */}
      {showGhost && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed z-40 opacity-50"
          style={{ display: 'none' }}
        >
          <div className={cn('h-full w-full', className)}>{children}</div>
        </div>
      )}
    </>
  );
};