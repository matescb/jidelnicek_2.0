import React from 'react'
import clsx from 'clsx'
import { useIsMobile } from '@hooks/useMediaQuery'

interface Column<T> {
  key: string
  header: string
  accessor: (item: T) => React.ReactNode
  className?: string
  mobileLabel?: boolean // Show label on mobile
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T, index: number) => string | number
  className?: string
  emptyMessage?: string
  mobileCardClassName?: string
}

/**
 * Table that transforms into cards on mobile devices
 */
export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  className,
  emptyMessage = 'No data available',
  mobileCardClassName
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    )
  }

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item, index) => (
          <div
            key={keyExtractor(item, index)}
            className={clsx(
              'bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3',
              mobileCardClassName
            )}
          >
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between items-start">
                {column.mobileLabel !== false && (
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {column.header}:
                  </span>
                )}
                <span className={clsx('text-sm text-gray-900 dark:text-white', column.className)}>
                  {column.accessor(item)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Desktop table view
  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className={clsx('min-w-full divide-y divide-gray-300 dark:divide-gray-700', className)}>
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {data.map((item, index) => (
            <tr key={keyExtractor(item, index)} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={clsx(
                    'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white',
                    column.className
                  )}
                >
                  {column.accessor(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}