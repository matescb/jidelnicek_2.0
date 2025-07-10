import React, { useState } from 'react'
import { ChevronUp, ChevronDown, MoreVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TouchableArea } from './TouchableArea'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export interface Column<T> {
  key: string
  header: string
  accessor: (item: T) => React.ReactNode
  sortable?: boolean
  width?: string | number
  mobileHidden?: boolean
  mobileOrder?: number
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  onSort?: (key: string, order: 'asc' | 'desc') => void
  onRowClick?: (item: T) => void
  actions?: (item: T) => React.ReactNode
  loading?: boolean
  emptyMessage?: string
  className?: string
  mobileRenderItem?: (item: T) => React.ReactNode
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onSort,
  onRowClick,
  actions,
  loading = false,
  emptyMessage,
  className = '',
  mobileRenderItem
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('md')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())
  
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return
    
    const newOrder = sortColumn === column.key && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortColumn(column.key)
    setSortOrder(newOrder)
    onSort(column.key, newOrder)
  }
  
  const toggleRowExpansion = (id: string | number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }
  
  // Mobile view
  if (isMobile && mobileRenderItem) {
    return (
      <div className={`space-y-4 ${className}`}>
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('common.loading')}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {emptyMessage || t('common.noData')}
          </div>
        ) : (
          data.map((item) => {
            const key = keyExtractor(item)
            const isExpanded = expandedRows.has(key)
            
            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
              >
                <TouchableArea
                  onClick={() => onRowClick?.(item)}
                  className="p-4"
                >
                  {mobileRenderItem(item)}
                </TouchableArea>
                
                {actions && (
                  <>
                    <TouchableArea
                      onClick={() => toggleRowExpansion(key)}
                      className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('common.actions')}
                      </span>
                      <MoreVertical className="w-4 h-4" />
                    </TouchableArea>
                    
                    {isExpanded && (
                      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                        {actions(item)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    )
  }
  
  // Desktop view
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`
                  px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                  ${column.sortable ? 'cursor-pointer select-none' : ''}
                  ${column.mobileHidden ? 'hidden md:table-cell' : ''}
                `}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column)}
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && (
                    <div className="flex flex-col">
                      <ChevronUp
                        className={`w-3 h-3 -mb-1 ${
                          sortColumn === column.key && sortOrder === 'asc'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-400'
                        }`}
                      />
                      <ChevronDown
                        className={`w-3 h-3 -mt-1 ${
                          sortColumn === column.key && sortOrder === 'desc'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </th>
            ))}
            {actions && (
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">{t('common.actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                {t('common.loading')}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                {emptyMessage || t('common.noData')}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                `}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100
                      ${column.mobileHidden ? 'hidden md:table-cell' : ''}
                    `}
                  >
                    {column.accessor(item)}
                  </td>
                ))}
                {actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {actions(item)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}