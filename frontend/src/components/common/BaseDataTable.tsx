import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Download, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';

// Generic types for the data table
export interface Column<T> {
  key: keyof T | string;
  header: string;
  accessor?: (item: T) => any;
  render?: (value: any, item: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  visible?: boolean;
  width?: string;
  sticky?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string;
  // Pagination
  pageSize?: number;
  pageSizeOptions?: number[];
  // Selection
  selectable?: boolean;
  multiSelect?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (selected: T[]) => void;
  // Sorting
  defaultSort?: { key: string; direction: 'asc' | 'desc' }[];
  multiSort?: boolean;
  // Search & Filter
  searchable?: boolean;
  searchPlaceholder?: string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  // Styling
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string;
  // Actions
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  // Export
  exportable?: boolean;
  exportFilename?: string;
  onExport?: (data: T[], selected: boolean) => void;
  // Virtualization
  virtualized?: boolean;
  rowHeight?: number;
  // Empty state
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  // Unique key
  getRowKey: (item: T) => string | number;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export function BaseDataTable<T extends Record<string, any>>({
  data,
  columns: initialColumns,
  loading = false,
  error,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  selectable = false,
  multiSelect = false,
  selectedRows = [],
  onSelectionChange,
  defaultSort = [],
  multiSort = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  globalFilter = '',
  onGlobalFilterChange,
  className = '',
  striped = true,
  hoverable = true,
  compact = false,
  stickyHeader = true,
  maxHeight = '600px',
  onRowClick,
  rowClassName,
  exportable = true,
  exportFilename = 'data-export',
  onExport,
  virtualized = false,
  rowHeight = 48,
  emptyMessage = 'No data available',
  emptyIcon,
  getRowKey,
}: DataTableProps<T>) {
  // State management
  const [columns, setColumns] = useState(() =>
    initialColumns.map(col => ({ ...col, visible: col.visible !== false }))
  );
  const [sortConfig, setSortConfig] = useState<SortConfig[]>(defaultSort);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState(globalFilter);
  const [internalSelectedRows, setInternalSelectedRows] = useState<T[]>(selectedRows);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  
  const tableRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use external or internal filter state
  const activeGlobalFilter = onGlobalFilterChange ? globalFilter : internalGlobalFilter;
  const activeSelectedRows = onSelectionChange ? selectedRows : internalSelectedRows;

  // Update internal state when external props change
  useEffect(() => {
    if (!onSelectionChange) {
      setInternalSelectedRows(selectedRows);
    }
  }, [selectedRows, onSelectionChange]);

  useEffect(() => {
    if (!onGlobalFilterChange) {
      setInternalGlobalFilter(globalFilter);
    }
  }, [globalFilter, onGlobalFilterChange]);

  // Filtering logic
  const filteredData = useMemo(() => {
    if (!activeGlobalFilter) return data;

    const lowerFilter = activeGlobalFilter.toLowerCase();
    return data.filter(item => {
      return columns.some(col => {
        if (!col.filterable !== false) {
          const value = col.accessor ? col.accessor(item) : item[col.key as keyof T];
          return String(value).toLowerCase().includes(lowerFilter);
        }
        return false;
      });
    });
  }, [data, activeGlobalFilter, columns]);

  // Sorting logic
  const sortedData = useMemo(() => {
    if (sortConfig.length === 0) return filteredData;

    return [...filteredData].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
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
    });
  }, [filteredData, sortConfig, columns]);

  // Pagination logic
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handlers
  const handleSort = useCallback((key: string) => {
    setSortConfig(current => {
      const existingIndex = current.findIndex(s => s.key === key);
      
      if (!multiSort) {
        if (existingIndex === -1) {
          return [{ key, direction: 'asc' }];
        }
        const existing = current[existingIndex];
        if (existing.direction === 'asc') {
          return [{ key, direction: 'desc' }];
        }
        return [];
      } else {
        const newConfig = [...current];
        if (existingIndex === -1) {
          newConfig.push({ key, direction: 'asc' });
        } else {
          if (newConfig[existingIndex].direction === 'asc') {
            newConfig[existingIndex].direction = 'desc';
          } else {
            newConfig.splice(existingIndex, 1);
          }
        }
        return newConfig;
      }
    });
  }, [multiSort]);

  const handleSelectRow = useCallback((item: T) => {
    const key = getRowKey(item);
    const isSelected = activeSelectedRows.some(row => getRowKey(row) === key);
    
    let newSelection: T[];
    if (multiSelect) {
      if (isSelected) {
        newSelection = activeSelectedRows.filter(row => getRowKey(row) !== key);
      } else {
        newSelection = [...activeSelectedRows, item];
      }
    } else {
      newSelection = isSelected ? [] : [item];
    }

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedRows(newSelection);
    }
  }, [activeSelectedRows, multiSelect, onSelectionChange, getRowKey]);

  const handleSelectAll = useCallback(() => {
    const allSelected = paginatedData.every(item =>
      activeSelectedRows.some(row => getRowKey(row) === getRowKey(item))
    );

    let newSelection: T[];
    if (allSelected) {
      // Deselect all on current page
      const pageKeys = new Set(paginatedData.map(item => getRowKey(item)));
      newSelection = activeSelectedRows.filter(row => !pageKeys.has(getRowKey(row)));
    } else {
      // Select all on current page
      const existingKeys = new Set(activeSelectedRows.map(row => getRowKey(row)));
      const toAdd = paginatedData.filter(item => !existingKeys.has(getRowKey(item)));
      newSelection = [...activeSelectedRows, ...toAdd];
    }

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedRows(newSelection);
    }
  }, [paginatedData, activeSelectedRows, onSelectionChange, getRowKey]);

  const handleExport = useCallback((selectedOnly: boolean) => {
    const dataToExport = selectedOnly ? activeSelectedRows : sortedData;
    
    if (onExport) {
      onExport(dataToExport, selectedOnly);
    } else {
      // Default CSV export
      const visibleColumns = columns.filter(col => col.visible);
      const headers = visibleColumns.map(col => col.header).join(',');
      const rows = dataToExport.map(item =>
        visibleColumns.map(col => {
          const value = col.accessor ? col.accessor(item) : item[col.key as keyof T];
          return JSON.stringify(value ?? '');
        }).join(',')
      );
      
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportFilename}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [activeSelectedRows, sortedData, columns, exportFilename, onExport]);

  const toggleColumn = useCallback((key: string) => {
    setColumns(current =>
      current.map(col =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  }, []);

  const handleGlobalFilterChange = useCallback((value: string) => {
    if (onGlobalFilterChange) {
      onGlobalFilterChange(value);
    } else {
      setInternalGlobalFilter(value);
    }
    setCurrentPage(0); // Reset to first page on filter
  }, [onGlobalFilterChange]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
  }, []);

  // Visible columns
  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  // Render helpers
  const getSortIcon = (key: string) => {
    const config = sortConfig.find(s => s.key === key);
    if (!config) return null;
    
    return config.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const getSortIndex = (key: string) => {
    if (!multiSort) return null;
    const index = sortConfig.findIndex(s => s.key === key);
    return index === -1 ? null : index + 1;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <X className="w-12 h-12 mb-4" />
        <p className="text-lg font-medium">Error loading data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        {emptyIcon || <X className="w-12 h-12 mb-4" />}
        <p className="text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        {searchable && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              value={activeGlobalFilter}
              onChange={(e) => handleGlobalFilterChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Column Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Toggle columns"
            >
              <Eye className="w-5 h-5" />
            </button>
            
            {showColumnToggle && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Visible Columns</p>
                  {columns.map(col => (
                    <label key={String(col.key)} className="flex items-center p-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumn(String(col.key))}
                        className="mr-2"
                      />
                      <span className="text-sm">{col.header}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          {exportable && (
            <button
              onClick={() => handleExport(false)}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Export all data"
            >
              <Download className="w-5 h-5" />
            </button>
          )}

          {/* Export Selected */}
          {exportable && selectable && activeSelectedRows.length > 0 && (
            <button
              onClick={() => handleExport(true)}
              className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm"
              title="Export selected"
            >
              Export {activeSelectedRows.length} selected
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        {/* Desktop Table */}
        <div className={`hidden md:block overflow-auto ${stickyHeader ? 'relative' : ''}`} style={{ maxHeight }} ref={tableRef}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
              <tr>
                {/* Select All Checkbox */}
                {selectable && multiSelect && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={paginatedData.length > 0 && paginatedData.every(item =>
                        activeSelectedRows.some(row => getRowKey(row) === getRowKey(item))
                      )}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}

                {/* Column Headers */}
                {visibleColumns.map(column => (
                  <th
                    key={String(column.key)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.sortable !== false ? 'cursor-pointer select-none' : ''
                    } ${column.sticky ? 'sticky left-0 bg-gray-50 z-10' : ''}`}
                    style={{ width: column.width }}
                    onClick={() => column.sortable !== false && handleSort(String(column.key))}
                  >
                    <div className="flex items-center gap-1">
                      {column.header}
                      {column.sortable !== false && (
                        <div className="flex items-center">
                          {getSortIcon(String(column.key))}
                          {multiSort && getSortIndex(String(column.key)) && (
                            <span className="text-xs ml-1">{getSortIndex(String(column.key))}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((item, index) => {
                const key = getRowKey(item);
                const isSelected = activeSelectedRows.some(row => getRowKey(row) === key);
                const rowClass = rowClassName ? rowClassName(item) : '';

                return (
                  <tr
                    key={key}
                    className={`
                      ${striped && index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                      ${hoverable ? 'hover:bg-gray-100' : ''}
                      ${isSelected ? 'bg-primary-50' : ''}
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${rowClass}
                    `}
                    onClick={() => onRowClick && onRowClick(item)}
                  >
                    {/* Select Checkbox */}
                    {selectable && (
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type={multiSelect ? 'checkbox' : 'radio'}
                          checked={isSelected}
                          onChange={() => handleSelectRow(item)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}

                    {/* Data Cells */}
                    {visibleColumns.map(column => {
                      const value = column.accessor ? column.accessor(item) : item[column.key as keyof T];
                      const cellContent = column.render ? column.render(value, item) : value;

                      return (
                        <td
                          key={String(column.key)}
                          className={`px-6 ${compact ? 'py-2' : 'py-4'} whitespace-nowrap text-sm ${
                            column.sticky ? 'sticky left-0 bg-inherit z-10' : ''
                          }`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {paginatedData.map((item, index) => {
            const key = getRowKey(item);
            const isSelected = activeSelectedRows.some(row => getRowKey(row) === key);
            const rowClass = rowClassName ? rowClassName(item) : '';

            return (
              <div
                key={key}
                className={`p-4 border-b border-gray-200 ${
                  isSelected ? 'bg-primary-50' : ''
                } ${onRowClick ? 'cursor-pointer' : ''} ${rowClass}`}
                onClick={() => onRowClick && onRowClick(item)}
              >
                {selectable && (
                  <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type={multiSelect ? 'checkbox' : 'radio'}
                      checked={isSelected}
                      onChange={() => handleSelectRow(item)}
                      className="rounded border-gray-300"
                    />
                  </div>
                )}

                {visibleColumns.map(column => {
                  const value = column.accessor ? column.accessor(item) : item[column.key as keyof T];
                  const cellContent = column.render ? column.render(value, item) : value;

                  return (
                    <div key={String(column.key)} className="mb-2">
                      <div className="text-xs font-medium text-gray-500 uppercase">
                        {column.header}
                      </div>
                      <div className="mt-1">{cellContent}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">
              Showing {currentPage * pageSize + 1} to{' '}
              {Math.min((currentPage + 1) * pageSize, sortedData.length)} of{' '}
              {sortedData.length} entries
            </span>
            
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            
            <button
              onClick={() => setCurrentPage(current => Math.max(0, current - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            <span className="text-sm">
              Page {currentPage + 1} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(current => Math.min(totalPages - 1, current + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>

            <button
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}