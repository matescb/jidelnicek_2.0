import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

export interface I18nFormats {
  formatDate: (date: Date | string, format?: 'date' | 'datetime') => string
  formatNumber: (value: number, format?: 'number' | 'currency') => string
  formatTime: (date: Date | string) => string
  formatRelativeTime: (date: Date | string) => string
}

export function useI18nFormats(): I18nFormats {
  const { i18n } = useTranslation()

  const formatDate = useCallback(
    (date: Date | string, format: 'date' | 'datetime' = 'date') => {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      
      if (format === 'datetime') {
        return new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(dateObj)
      }
      
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium'
      }).format(dateObj)
    },
    [i18n.language]
  )

  const formatTime = useCallback(
    (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      
      return new Intl.DateTimeFormat(i18n.language, {
        timeStyle: 'short'
      }).format(dateObj)
    },
    [i18n.language]
  )

  const formatNumber = useCallback(
    (value: number, format: 'number' | 'currency' = 'number') => {
      if (format === 'currency') {
        return new Intl.NumberFormat(i18n.language, {
          style: 'currency',
          currency: i18n.language === 'cs' ? 'CZK' : 'EUR'
        }).format(value)
      }
      
      return new Intl.NumberFormat(i18n.language).format(value)
    },
    [i18n.language]
  )

  const formatRelativeTime = useCallback(
    (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)
      
      const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
      
      if (diffInSeconds < 60) {
        return rtf.format(-diffInSeconds, 'second')
      } else if (diffInSeconds < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute')
      } else if (diffInSeconds < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour')
      } else if (diffInSeconds < 604800) {
        return rtf.format(-Math.floor(diffInSeconds / 86400), 'day')
      } else if (diffInSeconds < 2592000) {
        return rtf.format(-Math.floor(diffInSeconds / 604800), 'week')
      } else if (diffInSeconds < 31536000) {
        return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month')
      } else {
        return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year')
      }
    },
    [i18n.language]
  )

  return {
    formatDate,
    formatTime,
    formatNumber,
    formatRelativeTime
  }
}