import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ChevronRight } from 'lucide-react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  cell?: (item: T) => React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
  className?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface AdaptiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
  mobileVariant?: 'cards' | 'list' | 'scroll';
  cardClassName?: string;
  onRowClick?: (item: T) => void;
  getRowKey?: (item: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
  compact?: boolean;
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function AdaptiveTable<T extends Record<string, any>>({
  data,
  columns,
  className,
  mobileVariant = 'cards',
  cardClassName,
  onRowClick,
  getRowKey = (item) => item.id || JSON.stringify(item),
  emptyMessage = 'No data available',
  loading = false,
  compact = false,
}: AdaptiveTableProps<T>) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  // Filter columns by priority for responsive display
  const visibleColumns = columns.filter((col) => {
    if (!isTablet) return true;
    if (isMobile) return col.priority === 'high';
    return col.priority !== 'low';
  });

  // Render cell content
  const renderCell = (item: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(item);
    }
    const value = column.key.includes('.')
      ? column.key.split('.').reduce((obj, key) => obj?.[key], item as any)
      : item[column.key as keyof T];
    return value?.toString() || '-';
  };

  // Mobile card view
  const renderCard = (item: T) => {
    const key = getRowKey(item);
    const highPriorityColumns = columns.filter((col) => col.priority === 'high');
    const otherColumns = columns.filter((col) => col.priority !== 'high');

    return (
      <Card
        key={key}
        className={cn(
          'mb-4 cursor-pointer transition-shadow hover:shadow-md',
          cardClassName
        )}
        onClick={() => onRowClick?.(item)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {highPriorityColumns.map((col) => (
                <div key={col.key.toString()} className="font-medium">
                  {renderCell(item, col)}
                </div>
              ))}
            </div>
            {onRowClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {otherColumns.length > 0 && (
          <CardContent className="pt-0">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {otherColumns.map((col) => (
                <div key={col.key.toString()}>
                  <dt className="text-muted-foreground">{col.header}</dt>
                  <dd className="font-medium">{renderCell(item, col)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        )}
      </Card>
    );
  };

  // Mobile list view
  const renderListItem = (item: T) => {
    const key = getRowKey(item);
    const primaryColumn = columns.find((col) => col.priority === 'high');
    const secondaryColumns = columns.filter(
      (col) => col.priority !== 'high' && col.priority !== 'low'
    );

    return (
      <div
        key={key}
        className={cn(
          'flex items-center justify-between p-4 border-b cursor-pointer',
          'hover:bg-accent/50 transition-colors',
          cardClassName
        )}
        onClick={() => onRowClick?.(item)}
      >
        <div className="flex-1 min-w-0">
          {primaryColumn && (
            <div className="font-medium truncate">
              {renderCell(item, primaryColumn)}
            </div>
          )}
          {secondaryColumns.length > 0 && (
            <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
              {secondaryColumns.slice(0, 2).map((col) => (
                <span key={col.key.toString()}>
                  {col.header}: {renderCell(item, col)}
                </span>
              ))}
            </div>
          )}
        </div>
        {onRowClick && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  // Mobile view
  if (isMobile && mobileVariant !== 'scroll') {
    return (
      <div className={className}>
        {mobileVariant === 'cards'
          ? data.map((item) => renderCard(item))
          : data.map((item) => renderListItem(item))}
      </div>
    );
  }

  // Desktop table view (or mobile scroll)
  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map((column) => (
              <TableHead
                key={column.key.toString()}
                className={cn(
                  alignClasses[column.align || 'left'],
                  column.className
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const key = getRowKey(item);
            return (
              <TableRow
                key={key}
                className={cn(
                  onRowClick && 'cursor-pointer hover:bg-accent/50',
                  compact && 'h-10'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {visibleColumns.map((column) => (
                  <TableCell
                    key={`${key}-${column.key.toString()}`}
                    className={cn(
                      alignClasses[column.align || 'left'],
                      column.className,
                      compact && 'py-2'
                    )}
                  >
                    {renderCell(item, column)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Responsive data grid component
interface AdaptiveDataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
  gridClassName?: string;
  itemClassName?: string;
  onItemClick?: (item: T) => void;
  getItemKey?: (item: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
}

export function AdaptiveDataGrid<T extends Record<string, any>>({
  data,
  columns,
  className,
  gridClassName,
  itemClassName,
  onItemClick,
  getItemKey = (item) => item.id || JSON.stringify(item),
  emptyMessage = 'No data available',
  loading = false,
}: AdaptiveDataGridProps<T>) {
  const renderCell = (item: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(item);
    }
    const value = column.key.includes('.')
      ? column.key.split('.').reduce((obj, key) => obj?.[key], item as any)
      : item[column.key as keyof T];
    return value?.toString() || '-';
  };

  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
        gridClassName,
        className
      )}
    >
      {data.map((item) => {
        const key = getItemKey(item);
        return (
          <Card
            key={key}
            className={cn(
              'cursor-pointer transition-shadow hover:shadow-md',
              itemClassName
            )}
            onClick={() => onItemClick?.(item)}
          >
            <CardContent className="p-4">
              <dl className="space-y-2">
                {columns.map((column) => (
                  <div key={column.key.toString()}>
                    <dt className="text-sm text-muted-foreground">{column.header}</dt>
                    <dd className="font-medium">{renderCell(item, column)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}