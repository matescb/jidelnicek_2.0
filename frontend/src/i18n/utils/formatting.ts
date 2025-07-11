import { format, formatDistance, formatRelative, isValid, parseISO } from 'date-fns'
import { cs, enUS } from 'date-fns/locale'
import type { LanguageCode } from '../index'

// Locale mapping for date-fns
export const dateFnsLocales = {
  en: enUS,
  cs: cs,
} as const

// Currency mapping per locale
export const localeCurrencies: Record<LanguageCode, string> = {
  en: 'EUR',
  cs: 'CZK',
}

// Number formatting utilities
export const formatNumber = (
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string => {
  try {
    return new Intl.NumberFormat(locale, options).format(value)
  } catch (error) {
    console.error('Number formatting error:', error)
    return value.toString()
  }
}

export const formatCurrency = (
  value: number,
  locale: string,
  currency?: string,
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>
): string => {
  const currencyCode = currency || localeCurrencies[locale as LanguageCode] || 'EUR'
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      ...options,
    }).format(value)
  } catch (error) {
    console.error('Currency formatting error:', error)
    return `${currencyCode} ${formatNumber(value, locale)}`
  }
}

export const formatPercent = (
  value: number,
  locale: string,
  options?: Omit<Intl.NumberFormatOptions, 'style'>
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      ...options,
    }).format(value)
  } catch (error) {
    console.error('Percent formatting error:', error)
    return `${(value * 100).toFixed(2)}%`
  }
}

// Date formatting utilities
export const formatDate = (
  date: Date | string | number,
  locale: string,
  formatString: string = 'PP'
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date)
    
    if (!isValid(dateObj)) {
      console.error('Invalid date:', date)
      return 'Invalid Date'
    }
    
    const dateFnsLocale = dateFnsLocales[locale as LanguageCode] || enUS
    return format(dateObj, formatString, { locale: dateFnsLocale })
  } catch (error) {
    console.error('Date formatting error:', error)
    return 'Invalid Date'
  }
}

export const formatDateTime = (
  date: Date | string | number,
  locale: string,
  dateStyle: Intl.DateTimeFormatOptions['dateStyle'] = 'medium',
  timeStyle: Intl.DateTimeFormatOptions['timeStyle'] = 'short'
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date)
    
    if (!isValid(dateObj)) {
      console.error('Invalid date:', date)
      return 'Invalid Date'
    }
    
    return new Intl.DateTimeFormat(locale, {
      dateStyle,
      timeStyle,
    }).format(dateObj)
  } catch (error) {
    console.error('DateTime formatting error:', error)
    return 'Invalid Date'
  }
}

export const formatTime = (
  date: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date)
    
    if (!isValid(dateObj)) {
      console.error('Invalid date:', date)
      return 'Invalid Time'
    }
    
    return new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      ...options,
    }).format(dateObj)
  } catch (error) {
    console.error('Time formatting error:', error)
    return 'Invalid Time'
  }
}

export const formatRelativeTime = (
  date: Date | string | number,
  locale: string,
  baseDate: Date = new Date()
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date)
    
    if (!isValid(dateObj)) {
      console.error('Invalid date:', date)
      return 'Invalid Date'
    }
    
    const dateFnsLocale = dateFnsLocales[locale as LanguageCode] || enUS
    return formatDistance(dateObj, baseDate, {
      addSuffix: true,
      locale: dateFnsLocale,
    })
  } catch (error) {
    console.error('Relative time formatting error:', error)
    return 'Invalid Date'
  }
}

export const formatRelativeDate = (
  date: Date | string | number,
  locale: string,
  baseDate: Date = new Date()
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date)
    
    if (!isValid(dateObj)) {
      console.error('Invalid date:', date)
      return 'Invalid Date'
    }
    
    const dateFnsLocale = dateFnsLocales[locale as LanguageCode] || enUS
    return formatRelative(dateObj, baseDate, { locale: dateFnsLocale })
  } catch (error) {
    console.error('Relative date formatting error:', error)
    return 'Invalid Date'
  }
}

// List formatting utilities
export const formatList = (
  items: string[],
  locale: string,
  options?: Intl.ListFormatOptions
): string => {
  if (items.length === 0) return ''
  
  try {
    // Check if ListFormat is supported
    if (typeof Intl.ListFormat !== 'undefined') {
      return new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
        ...options,
      }).format(items)
    }
  } catch (error) {
    console.error('List formatting error:', error)
  }
  
  // Fallback for browsers without ListFormat support
  if (items.length === 1) return items[0]
  if (items.length === 2) {
    return locale === 'cs' ? `${items[0]} a ${items[1]}` : `${items[0]} and ${items[1]}`
  }
  
  const lastItem = items[items.length - 1]
  const otherItems = items.slice(0, -1).join(', ')
  return locale === 'cs' 
    ? `${otherItems} a ${lastItem}`
    : `${otherItems}, and ${lastItem}`
}

// Utility functions for common formatting patterns
export const formatCompactNumber = (
  value: number,
  locale: string
): string => {
  return formatNumber(value, locale, {
    notation: 'compact',
    compactDisplay: 'short',
  })
}

export const formatDecimal = (
  value: number,
  locale: string,
  minDecimals: number = 0,
  maxDecimals: number = 2
): string => {
  return formatNumber(value, locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  })
}

export const formatOrdinal = (
  value: number,
  locale: string
): string => {
  // English ordinals
  if (locale === 'en') {
    const pr = new Intl.PluralRules(locale, { type: 'ordinal' })
    const suffixes = {
      one: 'st',
      two: 'nd',
      few: 'rd',
      other: 'th',
    }
    const rule = pr.select(value) as keyof typeof suffixes
    return `${value}${suffixes[rule] || 'th'}`
  }
  
  // Czech ordinals (simplified)
  if (locale === 'cs') {
    return `${value}.`
  }
  
  // Fallback
  return value.toString()
}

// Bytes formatting
export const formatBytes = (
  bytes: number,
  locale: string,
  decimals: number = 2
): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  
  return `${formatDecimal(value, locale, 0, decimals)} ${sizes[i]}`
}

// Duration formatting (for cooking times, etc.)
export const formatDuration = (
  minutes: number,
  locale: string
): string => {
  if (minutes < 60) {
    return locale === 'cs' 
      ? `${minutes} ${minutes === 1 ? 'minuta' : minutes < 5 ? 'minuty' : 'minut'}`
      : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (remainingMinutes === 0) {
    return locale === 'cs'
      ? `${hours} ${hours === 1 ? 'hodina' : hours < 5 ? 'hodiny' : 'hodin'}`
      : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  
  const hoursPart = locale === 'cs'
    ? `${hours} ${hours === 1 ? 'hodina' : hours < 5 ? 'hodiny' : 'hodin'}`
    : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  
  const minutesPart = locale === 'cs'
    ? `${remainingMinutes} ${remainingMinutes === 1 ? 'minuta' : remainingMinutes < 5 ? 'minuty' : 'minut'}`
    : `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`
  
  return locale === 'cs' ? `${hoursPart} a ${minutesPart}` : `${hoursPart} and ${minutesPart}`
}