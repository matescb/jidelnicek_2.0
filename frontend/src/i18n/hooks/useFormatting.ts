import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatRelativeDate,
  formatList,
  formatCompactNumber,
  formatDecimal,
  formatOrdinal,
  formatBytes,
  formatDuration,
  localeCurrencies,
} from '../utils/formatting'
import type { LanguageCode } from '../index'

// Hook for number formatting
export const useNumberFormat = (options?: Intl.NumberFormatOptions) => {
  const { i18n } = useTranslation()
  const locale = i18n.language
  
  const format = useCallback(
    (value: number, overrideOptions?: Intl.NumberFormatOptions) => {
      return formatNumber(value, locale, { ...options, ...overrideOptions })
    },
    [locale, options]
  )
  
  const formatCompact = useCallback(
    (value: number) => formatCompactNumber(value, locale),
    [locale]
  )
  
  const formatDecimalNumber = useCallback(
    (value: number, minDecimals?: number, maxDecimals?: number) => {
      return formatDecimal(value, locale, minDecimals, maxDecimals)
    },
    [locale]
  )
  
  const formatOrdinalNumber = useCallback(
    (value: number) => formatOrdinal(value, locale),
    [locale]
  )
  
  const formatBytesSize = useCallback(
    (bytes: number, decimals?: number) => formatBytes(bytes, locale, decimals),
    [locale]
  )
  
  return {
    format,
    formatCompact,
    formatDecimal: formatDecimalNumber,
    formatOrdinal: formatOrdinalNumber,
    formatBytes: formatBytesSize,
    locale,
  }
}

// Hook for currency formatting
export const useCurrencyFormat = (
  currency?: string,
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>
) => {
  const { i18n } = useTranslation()
  const locale = i18n.language
  
  const defaultCurrency = useMemo(
    () => currency || localeCurrencies[locale as LanguageCode] || 'EUR',
    [currency, locale]
  )
  
  const format = useCallback(
    (
      value: number,
      overrideCurrency?: string,
      overrideOptions?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>
    ) => {
      return formatCurrency(
        value,
        locale,
        overrideCurrency || defaultCurrency,
        { ...options, ...overrideOptions }
      )
    },
    [locale, defaultCurrency, options]
  )
  
  const formatPercent = useCallback(
    (value: number, overrideOptions?: Omit<Intl.NumberFormatOptions, 'style'>) => {
      return formatPercent(value, locale, overrideOptions)
    },
    [locale]
  )
  
  return {
    format,
    formatPercent,
    currency: defaultCurrency,
    locale,
  }
}

// Hook for date formatting
export const useDateFormat = (defaultFormatString?: string) => {
  const { i18n } = useTranslation()
  const locale = i18n.language
  
  const format = useCallback(
    (date: Date | string | number, formatString?: string) => {
      return formatDate(date, locale, formatString || defaultFormatString)
    },
    [locale, defaultFormatString]
  )
  
  const formatDateTimeValue = useCallback(
    (
      date: Date | string | number,
      dateStyle?: Intl.DateTimeFormatOptions['dateStyle'],
      timeStyle?: Intl.DateTimeFormatOptions['timeStyle']
    ) => {
      return formatDateTime(date, locale, dateStyle, timeStyle)
    },
    [locale]
  )
  
  const formatTimeValue = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      return formatTime(date, locale, options)
    },
    [locale]
  )
  
  const formatDurationValue = useCallback(
    (minutes: number) => formatDuration(minutes, locale),
    [locale]
  )
  
  return {
    format,
    formatDateTime: formatDateTimeValue,
    formatTime: formatTimeValue,
    formatDuration: formatDurationValue,
    locale,
  }
}

// Hook for relative time formatting
export const useRelativeTime = () => {
  const { i18n } = useTranslation()
  const locale = i18n.language
  
  const format = useCallback(
    (date: Date | string | number, baseDate?: Date) => {
      return formatRelativeTime(date, locale, baseDate)
    },
    [locale]
  )
  
  const formatRelative = useCallback(
    (date: Date | string | number, baseDate?: Date) => {
      return formatRelativeDate(date, locale, baseDate)
    },
    [locale]
  )
  
  return {
    format,
    formatRelative,
    locale,
  }
}

// Hook for list formatting
export const useListFormat = (options?: Intl.ListFormatOptions) => {
  const { i18n } = useTranslation()
  const locale = i18n.language
  
  const format = useCallback(
    (items: string[], overrideOptions?: Intl.ListFormatOptions) => {
      return formatList(items, locale, { ...options, ...overrideOptions })
    },
    [locale, options]
  )
  
  return {
    format,
    locale,
  }
}

// Combined formatting hook for convenience
export const useFormatting = () => {
  const numberFormat = useNumberFormat()
  const currencyFormat = useCurrencyFormat()
  const dateFormat = useDateFormat()
  const relativeTime = useRelativeTime()
  const listFormat = useListFormat()
  
  return {
    number: numberFormat,
    currency: currencyFormat,
    date: dateFormat,
    relativeTime,
    list: listFormat,
  }
}