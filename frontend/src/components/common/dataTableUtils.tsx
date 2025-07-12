import { Column } from './BaseDataTable';

// Utility types
export type SortDirection = 'asc' | 'desc';
export type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between';

export interface FilterConfig<T> {
  column: keyof T;
  operator: FilterOperator;
  value: any;
  value2?: any; // For 'between' operator
}

export interface ColumnGroup<T> {
  header: string;
  columns: Column<T>[];
}

// Sorting utilities
export function createSortFunction<T extends Record<string, any>>(
  sortConfigs: Array<{ key: string; direction: SortDirection }>,
  columns: Column<T>[]
) {
  return (a: T, b: T): number => {
    for (const { key, direction } of sortConfigs) {
      const column = columns.find(col => col.key === key);
      if (!column) continue;

      const aValue = column.accessor ? column.accessor(a) : a[key as keyof T];
      const bValue = column.accessor ? column.accessor(b) : b[key as keyof T];

      if (aValue === bValue) continue;

      const modifier = direction === 'asc' ? 1 : -1;
      
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }

      return (aValue < bValue ? -1 : 1) * modifier;
    }
    return 0;
  };
}

// Filtering utilities
export function createFilterFunction<T extends Record<string, any>>(
  filters: FilterConfig<T>[],
  columns: Column<T>[]
) {
  return (item: T): boolean => {
    return filters.every(filter => {
      const column = columns.find(col => col.key === filter.column);
      if (!column) return true;

      const value = column.accessor ? column.accessor(item) : item[filter.column];
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        
        case 'startsWith':
          return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
        
        case 'endsWith':
          return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
        
        case 'greaterThan':
          return value > filter.value;
        
        case 'lessThan':
          return value < filter.value;
        
        case 'between':
          return value >= filter.value && value <= filter.value2;
        
        default:
          return true;
      }
    });
  };
}

// Column presets
export const createDateColumn = <T extends Record<string, any>>(
  key: keyof T,
  header: string,
  options: Partial<Column<T>> = {}
): Column<T> => ({
  key,
  header,
  sortable: true,
  render: (value: Date) => value?.toLocaleDateString() || '-',
  ...options,
});

export const createCurrencyColumn = <T extends Record<string, any>>(
  key: keyof T,
  header: string,
  currency = 'USD',
  options: Partial<Column<T>> = {}
): Column<T> => ({
  key,
  header,
  sortable: true,
  render: (value: number) => 
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value || 0),
  ...options,
});

export const createPercentColumn = <T extends Record<string, any>>(
  key: keyof T,
  header: string,
  options: Partial<Column<T>> = {}
): Column<T> => ({
  key,
  header,
  sortable: true,
  render: (value: number) => `${(value * 100).toFixed(2)}%`,
  ...options,
});

export const createBooleanColumn = <T extends Record<string, any>>(
  key: keyof T,
  header: string,
  trueLabel = 'Yes',
  falseLabel = 'No',
  options: Partial<Column<T>> = {}
): Column<T> => ({
  key,
  header,
  sortable: true,
  render: (value: boolean) => (
    <span className={value ? 'text-green-600' : 'text-gray-400'}>
      {value ? trueLabel : falseLabel}
    </span>
  ),
  ...options,
});

// Export utilities
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: Column<T>[],
  filename = 'export'
): void {
  const visibleColumns = columns.filter(col => col.visible !== false);
  const headers = visibleColumns.map(col => col.header).join(',');
  
  const rows = data.map(item =>
    visibleColumns.map(col => {
      const value = col.accessor ? col.accessor(item) : item[col.key as keyof T];
      
      // Handle special cases
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object') return JSON.stringify(value);
      
      // Escape values containing commas or quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',')
  );
  
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  filename = 'export'
): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Accessibility helpers
export function getTableAriaLabel<T extends Record<string, any>>(
  data: T[],
  selectedCount: number,
  totalCount: number
): string {
  const parts = [`Table with ${totalCount} rows`];
  
  if (selectedCount > 0) {
    parts.push(`${selectedCount} selected`);
  }
  
  if (data.length < totalCount) {
    parts.push(`showing ${data.length} of ${totalCount}`);
  }
  
  return parts.join(', ');
}

// Performance helpers
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;
  
  return (...args: Parameters<T>) => {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}