import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BaseDataTable, DataTableProps, Column } from './BaseDataTable';

interface VirtualizedDataTableProps<T> extends DataTableProps<T> {
  rowHeight?: number;
  overscan?: number;
  estimatedTotalHeight?: number;
}

export function VirtualizedDataTable<T extends Record<string, any>>({
  data,
  rowHeight = 48,
  overscan = 5,
  estimatedTotalHeight,
  ...restProps
}: VirtualizedDataTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    data.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );

  const visibleData = data.slice(startIndex, endIndex);
  const totalHeight = estimatedTotalHeight || data.length * rowHeight;
  const offsetY = startIndex * rowHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Create a custom render wrapper that handles virtualization
  const VirtualizedWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
      ref={containerRef}
      className="relative overflow-auto"
      style={{ maxHeight: restProps.maxHeight || '600px' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // Override the data with visible subset
  return (
    <BaseDataTable
      {...restProps}
      data={visibleData}
      virtualized={true}
      className={`virtualized-table ${restProps.className || ''}`}
    />
  );
}

// Hook for infinite scrolling with virtualization
export function useInfiniteVirtualization<T>({
  fetchMore,
  hasMore,
  threshold = 0.8,
}: {
  fetchMore: () => Promise<void>;
  hasMore: boolean;
  threshold?: number;
}) {
  const [loading, setLoading] = useState(false);

  const handleScroll = useCallback(
    async (e: React.UIEvent<HTMLDivElement>) => {
      if (loading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage > threshold) {
        setLoading(true);
        try {
          await fetchMore();
        } finally {
          setLoading(false);
        }
      }
    },
    [fetchMore, hasMore, loading, threshold]
  );

  return { handleScroll, loading };
}