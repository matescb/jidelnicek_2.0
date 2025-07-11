import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatList,
  formatCompactNumber,
  formatDecimal,
  formatOrdinal,
  formatBytes,
  formatDuration,
} from '../formatting'

describe('Number Formatting', () => {
  describe('formatNumber', () => {
    it('formats numbers correctly for English locale', () => {
      expect(formatNumber(1234567.89, 'en')).toBe('1,234,567.89')
      expect(formatNumber(1000, 'en')).toBe('1,000')
    })

    it('formats numbers correctly for Czech locale', () => {
      expect(formatNumber(1234567.89, 'cs')).toBe('1 234 567,89')
      expect(formatNumber(1000, 'cs')).toBe('1 000')
    })

    it('handles options correctly', () => {
      expect(formatNumber(1234.5, 'en', { minimumFractionDigits: 2 })).toBe('1,234.50')
      expect(formatNumber(1234.5, 'cs', { maximumFractionDigits: 0 })).toBe('1 235')
    })

    it('handles errors gracefully', () => {
      expect(formatNumber(123, 'invalid-locale')).toBe('123')
    })
  })

  describe('formatCurrency', () => {
    it('formats currency correctly for English locale', () => {
      expect(formatCurrency(99.99, 'en')).toBe('€99.99')
      expect(formatCurrency(99.99, 'en', 'USD')).toBe('$99.99')
    })

    it('formats currency correctly for Czech locale', () => {
      expect(formatCurrency(99.99, 'cs')).toMatch(/99,99/)
      expect(formatCurrency(99.99, 'cs', 'EUR')).toMatch(/€/)
    })

    it('handles negative values', () => {
      expect(formatCurrency(-50, 'en')).toMatch(/-/)
    })
  })

  describe('formatPercent', () => {
    it('formats percentages correctly', () => {
      expect(formatPercent(0.15, 'en')).toBe('15%')
      expect(formatPercent(0.1523, 'en', { maximumFractionDigits: 1 })).toBe('15.2%')
      expect(formatPercent(1, 'en')).toBe('100%')
    })
  })

  describe('formatCompactNumber', () => {
    it('formats compact numbers correctly', () => {
      expect(formatCompactNumber(1234, 'en')).toBe('1.2K')
      expect(formatCompactNumber(1234567, 'en')).toBe('1.2M')
      expect(formatCompactNumber(1234567890, 'en')).toBe('1.2B')
    })
  })

  describe('formatDecimal', () => {
    it('formats decimals with specified precision', () => {
      expect(formatDecimal(123.456789, 'en', 2, 2)).toBe('123.46')
      expect(formatDecimal(123, 'en', 2, 2)).toBe('123.00')
      expect(formatDecimal(123.456789, 'en', 0, 4)).toBe('123.4568')
    })
  })

  describe('formatOrdinal', () => {
    it('formats ordinals correctly for English', () => {
      expect(formatOrdinal(1, 'en')).toBe('1st')
      expect(formatOrdinal(2, 'en')).toBe('2nd')
      expect(formatOrdinal(3, 'en')).toBe('3rd')
      expect(formatOrdinal(4, 'en')).toBe('4th')
      expect(formatOrdinal(21, 'en')).toBe('21st')
      expect(formatOrdinal(22, 'en')).toBe('22nd')
      expect(formatOrdinal(23, 'en')).toBe('23rd')
    })

    it('formats ordinals correctly for Czech', () => {
      expect(formatOrdinal(1, 'cs')).toBe('1.')
      expect(formatOrdinal(2, 'cs')).toBe('2.')
      expect(formatOrdinal(10, 'cs')).toBe('10.')
    })
  })

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0, 'en')).toBe('0 Bytes')
      expect(formatBytes(1024, 'en')).toBe('1 KB')
      expect(formatBytes(1024 * 1024, 'en')).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 1024, 'en')).toBe('1 GB')
      expect(formatBytes(1536, 'en', 2)).toBe('1.5 KB')
      expect(formatBytes(1024 * 1024 * 1.5, 'en', 1)).toBe('1.5 MB')
    })
  })
})

describe('Date Formatting', () => {
  const testDate = new Date('2024-01-15T14:30:00')
  const testDateString = '2024-01-15T14:30:00'

  describe('formatDate', () => {
    it('formats dates correctly', () => {
      const result = formatDate(testDate, 'en')
      expect(result).toContain('Jan')
      expect(result).toContain('2024')
    })

    it('handles date strings', () => {
      const result = formatDate(testDateString, 'en')
      expect(result).toContain('Jan')
      expect(result).toContain('2024')
    })

    it('handles invalid dates', () => {
      expect(formatDate('invalid', 'en')).toBe('Invalid Date')
      expect(formatDate(new Date('invalid'), 'en')).toBe('Invalid Date')
    })

    it('uses custom format strings', () => {
      expect(formatDate(testDate, 'en', 'yyyy')).toBe('2024')
      expect(formatDate(testDate, 'en', 'MM/dd/yyyy')).toBe('01/15/2024')
    })
  })

  describe('formatDateTime', () => {
    it('formats date and time correctly', () => {
      const result = formatDateTime(testDate, 'en')
      expect(result).toContain('Jan')
      expect(result).toContain('2024')
      expect(result).toMatch(/2:30|14:30/)
    })

    it('respects style options', () => {
      const result = formatDateTime(testDate, 'en', 'full', 'medium')
      expect(result.length).toBeGreaterThan(20)
    })
  })

  describe('formatTime', () => {
    it('formats time correctly', () => {
      const result = formatTime(testDate, 'en')
      expect(result).toMatch(/2:30|14:30/)
    })
  })

  describe('formatRelativeTime', () => {
    it('formats relative time correctly', () => {
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      
      const result = formatRelativeTime(twoHoursAgo, 'en', now)
      expect(result).toContain('2 hours ago')
    })

    it('handles future dates', () => {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      
      const result = formatRelativeTime(tomorrow, 'en', now)
      expect(result).toContain('in')
      expect(result).toContain('day')
    })
  })
})

describe('List Formatting', () => {
  describe('formatList', () => {
    it('formats lists correctly for English', () => {
      expect(formatList([], 'en')).toBe('')
      expect(formatList(['Apple'], 'en')).toBe('Apple')
      expect(formatList(['Apple', 'Banana'], 'en')).toBe('Apple and Banana')
      expect(formatList(['Apple', 'Banana', 'Orange'], 'en')).toBe('Apple, Banana, and Orange')
    })

    it('formats lists correctly for Czech', () => {
      expect(formatList(['Jablko', 'Banán'], 'cs')).toBe('Jablko a Banán')
      expect(formatList(['Jablko', 'Banán', 'Pomeranč'], 'cs')).toBe('Jablko, Banán a Pomeranč')
    })

    it('handles different list types', () => {
      const items = ['Apple', 'Banana', 'Orange']
      const disjunction = formatList(items, 'en', { type: 'disjunction' })
      expect(disjunction).toContain('or')
    })
  })
})

describe('Duration Formatting', () => {
  describe('formatDuration', () => {
    it('formats minutes correctly for English', () => {
      expect(formatDuration(0, 'en')).toBe('0 minutes')
      expect(formatDuration(1, 'en')).toBe('1 minute')
      expect(formatDuration(30, 'en')).toBe('30 minutes')
      expect(formatDuration(60, 'en')).toBe('1 hour')
      expect(formatDuration(90, 'en')).toBe('1 hour and 30 minutes')
      expect(formatDuration(120, 'en')).toBe('2 hours')
      expect(formatDuration(135, 'en')).toBe('2 hours and 15 minutes')
    })

    it('formats minutes correctly for Czech', () => {
      expect(formatDuration(0, 'cs')).toBe('0 minut')
      expect(formatDuration(1, 'cs')).toBe('1 minuta')
      expect(formatDuration(2, 'cs')).toBe('2 minuty')
      expect(formatDuration(5, 'cs')).toBe('5 minut')
      expect(formatDuration(60, 'cs')).toBe('1 hodina')
      expect(formatDuration(90, 'cs')).toBe('1 hodina a 30 minut')
      expect(formatDuration(120, 'cs')).toBe('2 hodiny')
      expect(formatDuration(300, 'cs')).toBe('5 hodin')
    })
  })
})