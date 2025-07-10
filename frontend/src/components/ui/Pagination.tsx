import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TouchableArea } from './TouchableArea'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  showPageNumbers?: boolean
  maxPageButtons?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showPageNumbers = true,
  maxPageButtons = 7
}: PaginationProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('sm')
  
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const halfButtons = Math.floor((maxPageButtons - 3) / 2)
    
    if (totalPages <= maxPageButtons) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage <= halfButtons + 2) {
        // Near the beginning
        for (let i = 2; i <= maxPageButtons - 2; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - halfButtons - 1) {
        // Near the end
        pages.push('ellipsis')
        for (let i = totalPages - maxPageButtons + 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // In the middle
        pages.push('ellipsis')
        for (let i = currentPage - halfButtons; i <= currentPage + halfButtons; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }
    
    return pages
  }
  
  const pageNumbers = getPageNumbers()
  
  if (totalPages <= 1) {
    return null
  }
  
  // Mobile pagination - simple prev/next
  if (isMobile) {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <TouchableArea
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            ${currentPage === 1
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
            }
          `}
        >
          <ChevronLeft className="w-5 h-5" />
          <span>{t('common.previous')}</span>
        </TouchableArea>
        
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t('common.page')} {currentPage} {t('common.of')} {totalPages}
        </span>
        
        <TouchableArea
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            ${currentPage === totalPages
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
            }
          `}
        >
          <span>{t('common.next')}</span>
          <ChevronRight className="w-5 h-5" />
        </TouchableArea>
      </div>
    )
  }
  
  // Desktop pagination
  return (
    <nav className={`flex items-center justify-center gap-2 ${className}`}>
      {/* Previous Button */}
      <TouchableArea
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`
          p-2 rounded-lg
          ${currentPage === 1
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
          }
        `}
        aria-label={t('common.previous')}
      >
        <ChevronLeft className="w-5 h-5" />
      </TouchableArea>
      
      {/* Page Numbers */}
      {showPageNumbers && (
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-3 py-2 text-gray-400 dark:text-gray-600"
                >
                  ...
                </span>
              )
            }
            
            const isActive = page === currentPage
            
            return (
              <TouchableArea
                key={page}
                onClick={() => onPageChange(page)}
                className={`
                  min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium
                  ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
                  }
                `}
              >
                {page}
              </TouchableArea>
            )
          })}
        </div>
      )}
      
      {/* Next Button */}
      <TouchableArea
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`
          p-2 rounded-lg
          ${currentPage === totalPages
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
          }
        `}
        aria-label={t('common.next')}
      >
        <ChevronRight className="w-5 h-5" />
      </TouchableArea>
    </nav>
  )
}