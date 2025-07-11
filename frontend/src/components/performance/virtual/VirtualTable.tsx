import React, { useRef, forwardRef, useImperativeHandle, CSSProperties, HTMLAttributes } from 'react'
import { useVirtualList } from '@/hooks/useVirtualization'
import { cn } from '@/lib/utils'

export interface VirtualTableColumn<T> {
  key: string
  header: React.ReactNode
  width?: number | string
  minWidth?: number
  maxWidth?: number
  accessor: (item: T, index: number) => React.ReactNode
  sortable?: boolean
  resizable?: boolean
  sticky?: boolean
  align?: 'left' | 'center' | 'right'
  headerClassName?: string
  cellClassName?: string | ((item: T, index: number) => string)
}

export interface VirtualTableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  data: T[]
  columns: VirtualTableColumn<T>[]
  height: number | string
  width?: number | string
  rowHeight?: number | ((index: number) => number)
  headerHeight?: number
  overscan?: number
  getRowKey?: (item: T, index: number) => string | number
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  onRowClick?: (item: T, index: number) => void
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  selectedRowKeys?: Set<string | number>
  onRowSelect?: (keys: Set<string | number>) => void
  stickyHeader?: boolean
  striped?: boolean
  hoverable?: boolean
  bordered?: boolean
  emptyMessage?: React.ReactNode
  loadingMessage?: React.ReactNode
  isLoading?: boolean
  rowClassName?: string | ((item: T, index: number) => string)
  components?: {
    Table?: React.ComponentType<any>
    Header?: React.ComponentType<any>
    Body?: React.ComponentType<any>
    Row?: React.ComponentType<any>
    Cell?: React.ComponentType<any>
  }
}

export interface VirtualTableHandle {
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void
  scrollToOffset: (offset: number, options?: { smooth?: boolean }) => void
  getScrollOffset: () => number
  forceUpdate: () => void
}

/**
 * Virtual table component with fixed headers and efficient row rendering
 */
export const VirtualTable = forwardRef(<T,>(
  {
    data,
    columns,
    height,
    width = '100%',
    rowHeight = 48,
    headerHeight = 48,
    overscan = 5,
    getRowKey,
    onScroll,
    onRowClick,
    onSort,
    sortBy,
    sortDirection = 'asc',
    selectedRowKeys,
    onRowSelect,
    stickyHeader = true,
    striped = false,
    hoverable = true,
    bordered = true,
    emptyMessage = 'No data available',
    loadingMessage = 'Loading...',
    isLoading = false,
    rowClassName,
    components = {},
    className,
    style,
    ...props
  }: VirtualTableProps<T>,
  ref: React.Ref<VirtualTableHandle>
) => {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const {
    Table = 'div',
    Header = 'div',
    Body = 'div',
    Row = 'div',
    Cell = 'div'
  } = components

  const estimateSize = typeof rowHeight === 'function' 
    ? rowHeight 
    : () => rowHeight as number

  const {
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset,
    measureElement
  } = useVirtualList({
    items: data,
    estimateSize,
    overscan,
    paddingStart: stickyHeader ? headerHeight : 0,
    getScrollElement: () => scrollElementRef.current,
    getItemKey: getRowKey ? (index) => getRowKey(data[index], index) : undefined
  })

  // Handle sticky header scroll sync
  const handleBodyScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current && scrollElementRef.current) {
      headerRef.current.scrollLeft = scrollElementRef.current.scrollLeft
    }
    onScroll?.(e)
  }, [onScroll])

  // Handle row selection
  const handleRowClick = React.useCallback((item: T, index: number) => {
    if (onRowSelect && getRowKey) {
      const key = getRowKey(item, index)
      const newSelection = new Set(selectedRowKeys || [])
      
      if (newSelection.has(key)) {
        newSelection.delete(key)
      } else {
        newSelection.add(key)
      }
      
      onRowSelect(newSelection)
    }
    
    onRowClick?.(item, index)
  }, [onRowSelect, selectedRowKeys, getRowKey, onRowClick])

  // Handle column sorting
  const handleColumnSort = React.useCallback((columnKey: string) => {
    if (onSort) {
      const newDirection = sortBy === columnKey && sortDirection === 'asc' ? 'desc' : 'asc'
      onSort(columnKey, newDirection)
    }
  }, [onSort, sortBy, sortDirection])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => scrollToIndex(index, options),
    scrollToOffset: (offset, options) => {
      if (scrollElementRef.current) {
        if (options?.smooth) {
          scrollElementRef.current.scrollTo({
            top: offset,
            behavior: 'smooth'
          })
        } else {
          scrollElementRef.current.scrollTop = offset
        }
      }
    },
    getScrollOffset: () => {
      if (!scrollElementRef.current) return 0
      return scrollElementRef.current.scrollTop
    },
    forceUpdate: () => {
      virtualItems.forEach((item) => {
        const element = document.querySelector(`[data-row-index="${item.index}"]`) as HTMLElement
        if (element) {
          measureElement(element, item.index)
        }
      })
    }
  }), [virtualItems, scrollToIndex, measureElement])

  // Handle empty state
  if (!isLoading && data.length === 0) {
    return (
      <Table
        className={cn(
          'flex items-center justify-center text-gray-500 dark:text-gray-400',
          className
        )}
        style={{
          height,
          width,
          ...style
        }}
        {...props}
      >
        {emptyMessage}
      </Table>
    )
  }

  // Handle loading state
  if (isLoading && data.length === 0) {
    return (
      <Table
        className={cn(
          'flex items-center justify-center text-gray-500 dark:text-gray-400',
          className
        )}
        style={{
          height,
          width,
          ...style
        }}
        {...props}
      >
        {loadingMessage}
      </Table>
    )
  }

  const tableStyle: CSSProperties = {
    height,
    width,
    position: 'relative',
    ...style
  }

  const headerStyle: CSSProperties = {
    position: stickyHeader ? 'sticky' : 'relative',
    top: 0,
    height: headerHeight,
    zIndex: 10,
    backgroundColor: 'inherit',
    overflow: 'hidden'
  }

  const bodyStyle: CSSProperties = {
    height: stickyHeader ? `calc(100% - ${headerHeight}px)` : '100%',
    overflow: 'auto',
    position: 'relative'
  }

  const contentStyle: CSSProperties = {
    height: totalSize,
    position: 'relative'
  }

  // Calculate total table width
  const tableWidth = columns.reduce((total, col) => {
    const width = typeof col.width === 'number' ? col.width : 120
    return total + width
  }, 0)

  const rowStyle: CSSProperties = {
    display: 'flex',
    width: tableWidth,
    minWidth: '100%'
  }

  return (
    <Table
      className={cn(
        'virtual-table',
        bordered && 'virtual-table-bordered',
        className
      )}
      style={tableStyle}
      role="table"
      {...props}
    >
      {/* Header */}
      <Header
        ref={headerRef}
        className="virtual-table-header"
        style={headerStyle}
        role="rowgroup"
      >
        <div
          className={cn(
            'virtual-table-header-row',
            'flex items-center',
            bordered && 'border-b'
          )}
          style={rowStyle}
          role="row"
        >
          {columns.map((column) => (
            <Cell
              key={column.key}
              className={cn(
                'virtual-table-header-cell',
                'px-4 py-2 font-medium text-gray-700 dark:text-gray-300',
                column.sortable && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800',
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                bordered && 'border-r last:border-r-0',
                column.headerClassName
              )}
              style={{
                width: column.width || 'auto',
                minWidth: column.minWidth,
                maxWidth: column.maxWidth,
                flex: column.width ? `0 0 ${column.width}px` : '1 1 auto'
              }}
              onClick={() => column.sortable && handleColumnSort(column.key)}
              role="columnheader"
              aria-sort={
                sortBy === column.key
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex items-center justify-between">
                {column.header}
                {column.sortable && sortBy === column.key && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </Cell>
          ))}
        </div>
      </Header>

      {/* Body */}
      <Body
        ref={scrollElementRef}
        className="virtual-table-body"
        style={bodyStyle}
        onScroll={handleBodyScroll}
        role="rowgroup"
        tabIndex={0}
        aria-label="Table data"
      >
        <div style={contentStyle}>
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index]
            if (!item) return null

            const key = getRowKey 
              ? getRowKey(item, virtualRow.index) 
              : virtualRow.index

            const isSelected = selectedRowKeys?.has(key)
            const isEven = virtualRow.index % 2 === 0

            const itemRowClassName = typeof rowClassName === 'function'
              ? rowClassName(item, virtualRow.index)
              : rowClassName

            return (
              <Row
                key={key}
                data-row-index={virtualRow.index}
                className={cn(
                  'virtual-table-row',
                  'flex items-center',
                  hoverable && 'hover:bg-gray-50 dark:hover:bg-gray-800',
                  striped && isEven && 'bg-gray-50/50 dark:bg-gray-800/50',
                  isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                  onRowClick && 'cursor-pointer',
                  bordered && 'border-b',
                  itemRowClassName
                )}
                style={{
                  ...rowStyle,
                  position: 'absolute',
                  top: virtualRow.start,
                  height: virtualRow.size
                }}
                onClick={() => handleRowClick(item, virtualRow.index)}
                ref={(el: HTMLElement | null) => measureElement(el, virtualRow.index)}
                role="row"
                aria-rowindex={virtualRow.index + 1}
                aria-selected={isSelected}
              >
                {columns.map((column) => {
                  const cellClassName = typeof column.cellClassName === 'function'
                    ? column.cellClassName(item, virtualRow.index)
                    : column.cellClassName

                  return (
                    <Cell
                      key={column.key}
                      className={cn(
                        'virtual-table-cell',
                        'px-4 py-2',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        bordered && 'border-r last:border-r-0',
                        cellClassName
                      )}
                      style={{
                        width: column.width || 'auto',
                        minWidth: column.minWidth,
                        maxWidth: column.maxWidth,
                        flex: column.width ? `0 0 ${column.width}px` : '1 1 auto'
                      }}
                      role="cell"
                    >
                      {column.accessor(item, virtualRow.index)}
                    </Cell>
                  )
                })}
              </Row>
            )
          })}
        </div>
      </Body>
    </Table>
  )
})

VirtualTable.displayName = 'VirtualTable'