/**
 * Format a date string or Date object to a localized date string
 * @param date The date to format
 * @param locale The locale to use (defaults to browser locale)
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, locale?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Return a simple format if date is invalid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }
  
  // Use the browser's locale by default
  const userLocale = locale || navigator.language
  
  return dateObj.toLocaleDateString(userLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format a date range
 * @param startDate Start date
 * @param endDate End date
 * @param locale The locale to use
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date, locale?: string): string {
  return `${formatDate(startDate, locale)} - ${formatDate(endDate, locale)}`
}

/**
 * Calculate the number of days between two dates
 * @param startDate Start date
 * @param endDate End date
 * @returns Number of days
 */
export function daysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Check if a date is in the past
 * @param date Date to check
 * @returns True if date is in the past
 */
export function isPastDate(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj < new Date()
}

/**
 * Check if a date is today
 * @param date Date to check
 * @returns True if date is today
 */
export function isToday(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  
  return dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
}

/**
 * Get a relative time string (e.g., "2 days ago", "in 3 hours")
 * @param date Date to format
 * @param locale The locale to use
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date, locale?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = dateObj.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)
  
  const userLocale = locale || navigator.language
  const rtf = new Intl.RelativeTimeFormat(userLocale, { numeric: 'auto' })
  
  if (Math.abs(diffDay) >= 30) {
    const diffMonth = Math.round(diffDay / 30)
    return rtf.format(diffMonth, 'month')
  } else if (Math.abs(diffDay) >= 1) {
    return rtf.format(diffDay, 'day')
  } else if (Math.abs(diffHour) >= 1) {
    return rtf.format(diffHour, 'hour')
  } else if (Math.abs(diffMin) >= 1) {
    return rtf.format(diffMin, 'minute')
  } else {
    return rtf.format(diffSec, 'second')
  }
}