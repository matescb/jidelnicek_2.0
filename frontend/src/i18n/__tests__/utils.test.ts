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
  getRelativeTimeString,
} from '../utils/formatting'
import {
  validateTranslations,
  findMissingKeys,
  findUnusedKeys,
  validateInterpolations,
  validatePlurals,
  detectDuplicateValues,
  generateTranslationReport,
} from '../utils/validation'
import {
  getPluralForm,
  getPluralSuffix,
  createPluralKey,
  extractPluralKeys,
  validatePluralKeys,
  getPluralRules,
} from '../utils/pluralization'
import {
  buildKey,
  buildNamespacedKey,
  extractNamespace,
  extractKeyPath,
  isNamespacedKey,
  normalizeKey,
  splitKey,
  joinKeys,
} from '../utils/helpers'
import {
  createMissingTranslationHandler,
  trackMissingTranslation,
  getMissingTranslations,
  clearMissingTranslations,
  exportMissingTranslations,
} from '../utils/missing-tracker'
import {
  createLazyLoadHandler,
  preloadNamespace,
  preloadNamespaces,
  isNamespaceLoaded,
  getLoadedNamespaces,
} from '../utils/lazy-loading'
import {
  resolveContext,
  buildContextKey,
  getContextualValue,
  validateContextKey,
  extractContexts,
} from '../context/index'

// Mock Date for consistent testing
const mockDate = new Date('2024-01-15T12:00:00Z')
const mockNow = mockDate.getTime()

beforeAll(() => {
  jest.useFakeTimers()
  jest.setSystemTime(mockDate)
})

afterAll(() => {
  jest.useRealTimers()
})

describe('Formatting Functions', () => {
  describe('formatNumber', () => {
    it('should format numbers with default locale', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56')
      expect(formatNumber(1234.56, 'en')).toBe('1,234.56')
      expect(formatNumber(1234.56, 'cs')).toBe('1 234,56')
      expect(formatNumber(1234.56, 'ar')).toContain('١٬٢٣٤٫٥٦')
    })

    it('should handle options', () => {
      expect(formatNumber(1234.5, 'en', { minimumFractionDigits: 2 })).toBe('1,234.50')
      expect(formatNumber(1234.567, 'en', { maximumFractionDigits: 2 })).toBe('1,234.57')
    })

    it('should handle edge cases', () => {
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(-1234.56)).toBe('-1,234.56')
      expect(formatNumber(NaN)).toBe('NaN')
      expect(formatNumber(Infinity)).toBe('∞')
    })
  })

  describe('formatCurrency', () => {
    it('should format currency', () => {
      expect(formatCurrency(1234.56, 'en', 'USD')).toBe('$1,234.56')
      expect(formatCurrency(1234.56, 'en', 'EUR')).toBe('€1,234.56')
      expect(formatCurrency(1234.56, 'cs', 'CZK')).toContain('1 234,56')
      expect(formatCurrency(1234.56, 'ar', 'SAR')).toContain('١٬٢٣٤٫٥٦')
    })

    it('should use locale default currency', () => {
      expect(localeCurrencies.en).toBe('USD')
      expect(localeCurrencies.cs).toBe('CZK')
      expect(localeCurrencies.ar).toBe('SAR')
    })

    it('should handle negative values', () => {
      expect(formatCurrency(-1234.56, 'en', 'USD')).toBe('-$1,234.56')
    })

    it('should handle currency display options', () => {
      expect(formatCurrency(1234.56, 'en', 'USD', { currencyDisplay: 'code' })).toContain('USD')
      expect(formatCurrency(1234.56, 'en', 'USD', { currencyDisplay: 'name' })).toContain('US dollar')
    })
  })

  describe('formatPercent', () => {
    it('should format percentages', () => {
      expect(formatPercent(0.125, 'en')).toBe('12.5%')
      expect(formatPercent(1, 'en')).toBe('100%')
      expect(formatPercent(0.125, 'cs')).toBe('12,5 %')
      expect(formatPercent(0.125, 'ar')).toContain('١٢٫٥')
    })

    it('should handle options', () => {
      expect(formatPercent(0.12345, 'en', { maximumFractionDigits: 2 })).toBe('12.35%')
    })
  })

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T10:30:00')

    it('should format dates with different locales', () => {
      expect(formatDate(testDate, 'en')).toBe('1/15/2024')
      expect(formatDate(testDate, 'cs')).toBe('15. 1. 2024')
      expect(formatDate(testDate, 'ar')).toContain('١٥')
    })

    it('should handle format strings', () => {
      expect(formatDate(testDate, 'en', 'short')).toBe('1/15/24')
      expect(formatDate(testDate, 'en', 'medium')).toBe('Jan 15, 2024')
      expect(formatDate(testDate, 'en', 'long')).toBe('January 15, 2024')
      expect(formatDate(testDate, 'en', 'full')).toContain('Monday')
    })

    it('should handle different input types', () => {
      expect(formatDate('2024-01-15', 'en')).toBe('1/15/2024')
      expect(formatDate(testDate.getTime(), 'en')).toBe('1/15/2024')
    })

    it('should handle invalid dates', () => {
      expect(formatDate('invalid', 'en')).toBe('Invalid Date')
      expect(formatDate(NaN, 'en')).toBe('Invalid Date')
    })
  })

  describe('formatDateTime', () => {
    const testDate = new Date('2024-01-15T10:30:00')

    it('should format date and time', () => {
      expect(formatDateTime(testDate, 'en')).toContain('1/15/2024')
      expect(formatDateTime(testDate, 'en')).toContain('10:30')
    })

    it('should handle style options', () => {
      expect(formatDateTime(testDate, 'en', 'short', 'short')).toContain('1/15/24')
      expect(formatDateTime(testDate, 'en', 'long', 'long')).toContain('January 15, 2024')
    })
  })

  describe('formatTime', () => {
    const testDate = new Date('2024-01-15T10:30:45')

    it('should format time', () => {
      expect(formatTime(testDate, 'en')).toBe('10:30 AM')
      expect(formatTime(testDate, 'en', { hour12: false })).toBe('10:30')
      expect(formatTime(testDate, 'en', { second: 'numeric' })).toBe('10:30:45 AM')
    })

    it('should handle different locales', () => {
      expect(formatTime(testDate, 'cs')).toBe('10:30')
      expect(formatTime(testDate, 'ar')).toContain('١٠:٣٠')
    })
  })

  describe('formatRelativeTime', () => {
    it('should format relative time', () => {
      const now = new Date('2024-01-15T12:00:00')
      const past = new Date('2024-01-15T11:00:00')
      const future = new Date('2024-01-15T14:00:00')

      expect(formatRelativeTime(past, 'en', now)).toBe('1 hour ago')
      expect(formatRelativeTime(future, 'en', now)).toBe('in 2 hours')
    })

    it('should handle different time units', () => {
      const now = new Date('2024-01-15T12:00:00')
      
      // Minutes
      const minutesAgo = new Date('2024-01-15T11:30:00')
      expect(formatRelativeTime(minutesAgo, 'en', now)).toBe('30 minutes ago')
      
      // Days
      const yesterday = new Date('2024-01-14T12:00:00')
      expect(formatRelativeTime(yesterday, 'en', now)).toBe('1 day ago')
      
      // Weeks
      const lastWeek = new Date('2024-01-08T12:00:00')
      expect(formatRelativeTime(lastWeek, 'en', now)).toBe('1 week ago')
    })

    it('should handle different locales', () => {
      const now = new Date('2024-01-15T12:00:00')
      const past = new Date('2024-01-15T11:00:00')

      expect(formatRelativeTime(past, 'cs', now)).toContain('před')
      expect(formatRelativeTime(past, 'ar', now)).toContain('منذ')
    })
  })

  describe('formatRelativeDate', () => {
    it('should format relative dates', () => {
      const now = new Date('2024-01-15T12:00:00')
      const yesterday = new Date('2024-01-14T12:00:00')
      const tomorrow = new Date('2024-01-16T12:00:00')

      expect(formatRelativeDate(yesterday, 'en', now)).toBe('yesterday')
      expect(formatRelativeDate(tomorrow, 'en', now)).toBe('tomorrow')
      expect(formatRelativeDate(now, 'en', now)).toBe('today')
    })

    it('should fallback to date format for distant dates', () => {
      const now = new Date('2024-01-15T12:00:00')
      const lastMonth = new Date('2023-12-15T12:00:00')

      expect(formatRelativeDate(lastMonth, 'en', now)).toContain('12/15/2023')
    })
  })

  describe('formatList', () => {
    it('should format lists', () => {
      expect(formatList(['Apple', 'Banana', 'Orange'], 'en')).toBe('Apple, Banana, and Orange')
      expect(formatList(['Apple', 'Banana'], 'en')).toBe('Apple and Banana')
      expect(formatList(['Apple'], 'en')).toBe('Apple')
      expect(formatList([], 'en')).toBe('')
    })

    it('should handle different types', () => {
      expect(formatList(['A', 'B', 'C'], 'en', { type: 'disjunction' })).toBe('A, B, or C')
      expect(formatList(['A', 'B', 'C'], 'en', { type: 'unit' })).toBe('A, B, C')
    })

    it('should handle different locales', () => {
      expect(formatList(['Jablko', 'Banán', 'Pomeranč'], 'cs')).toBe('Jablko, Banán a Pomeranč')
    })
  })

  describe('formatCompactNumber', () => {
    it('should format compact numbers', () => {
      expect(formatCompactNumber(1234, 'en')).toBe('1.2K')
      expect(formatCompactNumber(1234567, 'en')).toBe('1.2M')
      expect(formatCompactNumber(1234567890, 'en')).toBe('1.2B')
      expect(formatCompactNumber(999, 'en')).toBe('999')
    })

    it('should handle different locales', () => {
      expect(formatCompactNumber(1234, 'cs')).toContain('tis')
      expect(formatCompactNumber(1234567, 'cs')).toContain('mil')
    })
  })

  describe('formatDecimal', () => {
    it('should format decimals with precision', () => {
      expect(formatDecimal(3.14159, 'en', 2, 2)).toBe('3.14')
      expect(formatDecimal(3.1, 'en', 2, 2)).toBe('3.10')
      expect(formatDecimal(3.14159, 'en', 0, 3)).toBe('3.142')
    })

    it('should handle different locales', () => {
      expect(formatDecimal(3.14159, 'cs', 2, 2)).toBe('3,14')
    })
  })

  describe('formatOrdinal', () => {
    it('should format ordinal numbers', () => {
      expect(formatOrdinal(1, 'en')).toBe('1st')
      expect(formatOrdinal(2, 'en')).toBe('2nd')
      expect(formatOrdinal(3, 'en')).toBe('3rd')
      expect(formatOrdinal(4, 'en')).toBe('4th')
      expect(formatOrdinal(11, 'en')).toBe('11th')
      expect(formatOrdinal(21, 'en')).toBe('21st')
      expect(formatOrdinal(22, 'en')).toBe('22nd')
      expect(formatOrdinal(23, 'en')).toBe('23rd')
      expect(formatOrdinal(100, 'en')).toBe('100th')
    })

    it('should handle different locales', () => {
      // Czech doesn't have ordinal suffixes like English
      expect(formatOrdinal(1, 'cs')).toBe('1.')
      expect(formatOrdinal(2, 'cs')).toBe('2.')
    })
  })

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(0, 'en')).toBe('0 B')
      expect(formatBytes(1024, 'en')).toBe('1 KB')
      expect(formatBytes(1048576, 'en')).toBe('1 MB')
      expect(formatBytes(1073741824, 'en')).toBe('1 GB')
      expect(formatBytes(1099511627776, 'en')).toBe('1 TB')
    })

    it('should handle decimals', () => {
      expect(formatBytes(1536, 'en', 1)).toBe('1.5 KB')
      expect(formatBytes(1536, 'en', 2)).toBe('1.50 KB')
      expect(formatBytes(1536, 'en', 0)).toBe('2 KB')
    })

    it('should handle negative values', () => {
      expect(formatBytes(-1024, 'en')).toBe('-1 KB')
    })
  })

  describe('formatDuration', () => {
    it('should format duration in minutes', () => {
      expect(formatDuration(0, 'en')).toBe('0m')
      expect(formatDuration(30, 'en')).toBe('30m')
      expect(formatDuration(60, 'en')).toBe('1h')
      expect(formatDuration(90, 'en')).toBe('1h 30m')
      expect(formatDuration(125, 'en')).toBe('2h 5m')
      expect(formatDuration(1440, 'en')).toBe('1d')
      expect(formatDuration(1500, 'en')).toBe('1d 1h')
    })

    it('should handle different locales', () => {
      expect(formatDuration(90, 'cs')).toBe('1h 30m')
      // Different locales might have different abbreviations
    })
  })

  describe('getRelativeTimeString', () => {
    it('should calculate relative time correctly', () => {
      const now = new Date('2024-01-15T12:00:00')
      
      // Seconds
      const seconds = new Date('2024-01-15T11:59:30')
      expect(getRelativeTimeString(seconds, now)).toEqual({ value: -30, unit: 'second' })
      
      // Minutes
      const minutes = new Date('2024-01-15T11:30:00')
      expect(getRelativeTimeString(minutes, now)).toEqual({ value: -30, unit: 'minute' })
      
      // Hours
      const hours = new Date('2024-01-15T09:00:00')
      expect(getRelativeTimeString(hours, now)).toEqual({ value: -3, unit: 'hour' })
      
      // Days
      const days = new Date('2024-01-12T12:00:00')
      expect(getRelativeTimeString(days, now)).toEqual({ value: -3, unit: 'day' })
      
      // Weeks
      const weeks = new Date('2024-01-01T12:00:00')
      expect(getRelativeTimeString(weeks, now)).toEqual({ value: -2, unit: 'week' })
      
      // Months
      const months = new Date('2023-10-15T12:00:00')
      expect(getRelativeTimeString(months, now)).toEqual({ value: -3, unit: 'month' })
      
      // Years
      const years = new Date('2022-01-15T12:00:00')
      expect(getRelativeTimeString(years, now)).toEqual({ value: -2, unit: 'year' })
    })

    it('should handle future dates', () => {
      const now = new Date('2024-01-15T12:00:00')
      const future = new Date('2024-01-15T14:30:00')
      
      expect(getRelativeTimeString(future, now)).toEqual({ value: 2.5, unit: 'hour' })
    })
  })
})

describe('Pluralization Utilities', () => {
  describe('getPluralForm', () => {
    it('should get plural form for English', () => {
      expect(getPluralForm(0, 'en')).toBe('other')
      expect(getPluralForm(1, 'en')).toBe('one')
      expect(getPluralForm(2, 'en')).toBe('other')
      expect(getPluralForm(100, 'en')).toBe('other')
    })

    it('should get plural form for Czech', () => {
      expect(getPluralForm(0, 'cs')).toBe('other')
      expect(getPluralForm(1, 'cs')).toBe('one')
      expect(getPluralForm(2, 'cs')).toBe('few')
      expect(getPluralForm(3, 'cs')).toBe('few')
      expect(getPluralForm(4, 'cs')).toBe('few')
      expect(getPluralForm(5, 'cs')).toBe('other')
    })

    it('should get plural form for Arabic', () => {
      expect(getPluralForm(0, 'ar')).toBe('zero')
      expect(getPluralForm(1, 'ar')).toBe('one')
      expect(getPluralForm(2, 'ar')).toBe('two')
      expect(getPluralForm(3, 'ar')).toBe('few')
      expect(getPluralForm(11, 'ar')).toBe('many')
      expect(getPluralForm(100, 'ar')).toBe('other')
    })
  })

  describe('getPluralSuffix', () => {
    it('should get plural suffix', () => {
      expect(getPluralSuffix(1, 'en')).toBe('_one')
      expect(getPluralSuffix(2, 'en')).toBe('_other')
      expect(getPluralSuffix(0, 'ar')).toBe('_zero')
      expect(getPluralSuffix(2, 'ar')).toBe('_two')
    })
  })

  describe('createPluralKey', () => {
    it('should create plural key', () => {
      expect(createPluralKey('items', 1, 'en')).toBe('items_one')
      expect(createPluralKey('items', 5, 'en')).toBe('items_other')
      expect(createPluralKey('items', 0, 'ar')).toBe('items_zero')
    })
  })

  describe('extractPluralKeys', () => {
    it('should extract plural keys', () => {
      const keys = extractPluralKeys('items_one')
      expect(keys).toEqual({
        base: 'items',
        forms: ['one'],
      })
    })

    it('should handle multiple forms', () => {
      const keys = extractPluralKeys('items_one_two_few')
      expect(keys).toEqual({
        base: 'items',
        forms: ['one', 'two', 'few'],
      })
    })

    it('should handle non-plural keys', () => {
      const keys = extractPluralKeys('regular_key')
      expect(keys).toEqual({
        base: 'regular_key',
        forms: [],
      })
    })
  })

  describe('validatePluralKeys', () => {
    it('should validate plural keys for locale', () => {
      const translations = {
        items_one: 'one item',
        items_other: 'many items',
      }

      const result = validatePluralKeys(translations, 'en')
      expect(result.valid).toBe(true)
      expect(result.complete).toContain('items')
    })

    it('should detect incomplete plurals', () => {
      const translations = {
        items_one: 'one item',
        // Missing items_other
      }

      const result = validatePluralKeys(translations, 'en')
      expect(result.valid).toBe(false)
      expect(result.incomplete).toContain('items')
      expect(result.missing.items).toContain('other')
    })

    it('should detect invalid plural forms', () => {
      const translations = {
        items_one: 'one item',
        items_two: 'two items', // Invalid for English
        items_other: 'many items',
      }

      const result = validatePluralKeys(translations, 'en')
      expect(result.valid).toBe(false)
      expect(result.invalid.items).toContain('two')
    })
  })

  describe('getPluralRules', () => {
    it('should get plural rules for locale', () => {
      const rules = getPluralRules('en')
      expect(rules.select(0)).toBe('other')
      expect(rules.select(1)).toBe('one')
      expect(rules.select(2)).toBe('other')
    })

    it('should handle different locales', () => {
      const csRules = getPluralRules('cs')
      expect(csRules.select(1)).toBe('one')
      expect(csRules.select(2)).toBe('few')
      expect(csRules.select(5)).toBe('other')
    })
  })
})

describe('Key Builder Utilities', () => {
  describe('buildKey', () => {
    it('should build keys from parts', () => {
      expect(buildKey('auth', 'login')).toBe('auth.login')
      expect(buildKey('auth', 'errors', 'invalid')).toBe('auth.errors.invalid')
      expect(buildKey()).toBe('')
      expect(buildKey('single')).toBe('single')
    })

    it('should filter empty parts', () => {
      expect(buildKey('auth', '', 'login')).toBe('auth.login')
      expect(buildKey('', 'auth', '', 'login', '')).toBe('auth.login')
    })
  })

  describe('buildNamespacedKey', () => {
    it('should build namespaced keys', () => {
      expect(buildNamespacedKey('auth', 'login')).toBe('auth:login')
      expect(buildNamespacedKey('auth', 'errors.invalid')).toBe('auth:errors.invalid')
    })
  })

  describe('extractNamespace', () => {
    it('should extract namespace from key', () => {
      expect(extractNamespace('auth:login')).toBe('auth')
      expect(extractNamespace('auth:errors.invalid')).toBe('auth')
      expect(extractNamespace('login')).toBe(null)
    })
  })

  describe('extractKeyPath', () => {
    it('should extract key path', () => {
      expect(extractKeyPath('auth:login')).toBe('login')
      expect(extractKeyPath('auth:errors.invalid')).toBe('errors.invalid')
      expect(extractKeyPath('login')).toBe('login')
    })
  })

  describe('isNamespacedKey', () => {
    it('should check if key is namespaced', () => {
      expect(isNamespacedKey('auth:login')).toBe(true)
      expect(isNamespacedKey('login')).toBe(false)
      expect(isNamespacedKey('auth.login')).toBe(false)
    })
  })

  describe('normalizeKey', () => {
    it('should normalize keys', () => {
      expect(normalizeKey(' auth.login ')).toBe('auth.login')
      expect(normalizeKey('auth..login')).toBe('auth.login')
      expect(normalizeKey('auth...login')).toBe('auth.login')
      expect(normalizeKey('.auth.login.')).toBe('auth.login')
    })
  })

  describe('splitKey', () => {
    it('should split keys', () => {
      expect(splitKey('auth.login')).toEqual(['auth', 'login'])
      expect(splitKey('auth.errors.invalid')).toEqual(['auth', 'errors', 'invalid'])
      expect(splitKey('single')).toEqual(['single'])
    })
  })

  describe('joinKeys', () => {
    it('should join keys', () => {
      expect(joinKeys(['auth', 'login'])).toBe('auth.login')
      expect(joinKeys(['auth', 'errors', 'invalid'])).toBe('auth.errors.invalid')
      expect(joinKeys(['single'])).toBe('single')
      expect(joinKeys([])).toBe('')
    })
  })
})

describe('Validation Utilities', () => {
  describe('findMissingKeys', () => {
    it('should find missing keys', () => {
      const source = {
        auth: {
          login: 'Login',
          logout: 'Logout',
        },
        common: {
          save: 'Save',
        },
      }

      const target = {
        auth: {
          login: 'Přihlásit',
        },
      }

      const missing = findMissingKeys(source, target)
      expect(missing).toContain('auth.logout')
      expect(missing).toContain('common.save')
      expect(missing).not.toContain('auth.login')
    })
  })

  describe('findUnusedKeys', () => {
    it('should find unused keys', () => {
      const source = {
        auth: {
          login: 'Login',
        },
      }

      const target = {
        auth: {
          login: 'Přihlásit',
          logout: 'Odhlásit',
        },
        extra: {
          key: 'Extra',
        },
      }

      const unused = findUnusedKeys(source, target)
      expect(unused).toContain('auth.logout')
      expect(unused).toContain('extra.key')
      expect(unused).not.toContain('auth.login')
    })
  })

  describe('validateInterpolations', () => {
    it('should validate interpolations', () => {
      const translations = {
        valid: 'Hello {{name}}',
        mismatch: 'Hello {{name}}',
        invalid: 'Hello {{name}',
        multiple: 'Hello {{firstName}} {{lastName}}',
      }

      const reference = {
        valid: 'Hello {{name}}',
        mismatch: 'Hello {{username}}',
        invalid: 'Hello {{name}}',
        multiple: 'Hello {{firstName}} {{lastName}}',
      }

      const result = validateInterpolations(translations, reference)
      
      expect(result.valid).toContain('valid')
      expect(result.valid).toContain('multiple')
      expect(result.mismatched).toHaveProperty('mismatch')
      expect(result.mismatched.mismatch.expected).toContain('username')
      expect(result.mismatched.mismatch.actual).toContain('name')
      expect(result.invalid).toContain('invalid')
    })
  })

  describe('validatePlurals', () => {
    it('should validate plural forms', () => {
      const translations = {
        'items_one': 'one item',
        'items_other': 'many items',
        'incomplete_one': 'one thing',
        // Missing incomplete_other
      }

      const result = validatePlurals(translations, 'en')
      expect(result.complete).toContain('items')
      expect(result.incomplete).toContain('incomplete')
    })
  })

  describe('detectDuplicateValues', () => {
    it('should detect duplicate values', () => {
      const translations = {
        save: 'Save',
        submit: 'Save', // Duplicate
        cancel: 'Cancel',
        close: 'Cancel', // Duplicate
        unique: 'Unique',
      }

      const duplicates = detectDuplicateValues(translations)
      expect(duplicates).toHaveProperty('Save')
      expect(duplicates.Save).toContain('save')
      expect(duplicates.Save).toContain('submit')
      expect(duplicates).toHaveProperty('Cancel')
      expect(duplicates.Cancel).toContain('cancel')
      expect(duplicates.Cancel).toContain('close')
      expect(duplicates).not.toHaveProperty('Unique')
    })
  })

  describe('generateTranslationReport', () => {
    it('should generate comprehensive report', () => {
      const source = {
        auth: {
          login: 'Login {{username}}',
          logout: 'Logout',
        },
        items_one: 'one item',
        items_other: 'many items',
      }

      const target = {
        auth: {
          login: 'Přihlásit {{name}}', // Wrong interpolation
        },
        items_one: 'jedna položka',
        // Missing items_other
        extra: 'Extra key',
      }

      const report = generateTranslationReport(source, target, 'cs')
      
      expect(report.missing).toContain('auth.logout')
      expect(report.unused).toContain('extra')
      expect(report.interpolationErrors.mismatched).toHaveProperty('auth.login')
      expect(report.pluralErrors.incomplete).toContain('items')
      expect(report.coverage).toBeLessThan(100)
      expect(report.timestamp).toBeInstanceOf(Date)
    })
  })
})

describe('Missing Translation Tracker', () => {
  beforeEach(() => {
    clearMissingTranslations()
  })

  describe('trackMissingTranslation', () => {
    it('should track missing translations', () => {
      trackMissingTranslation('auth.login', 'en')
      trackMissingTranslation('auth.logout', 'en')
      trackMissingTranslation('auth.login', 'cs')

      const missing = getMissingTranslations()
      expect(missing).toHaveLength(3)
      expect(missing.some(m => m.key === 'auth.login' && m.language === 'en')).toBe(true)
      expect(missing.some(m => m.key === 'auth.logout' && m.language === 'en')).toBe(true)
      expect(missing.some(m => m.key === 'auth.login' && m.language === 'cs')).toBe(true)
    })

    it('should not track duplicates', () => {
      trackMissingTranslation('auth.login', 'en')
      trackMissingTranslation('auth.login', 'en')

      const missing = getMissingTranslations()
      expect(missing).toHaveLength(1)
    })
  })

  describe('createMissingTranslationHandler', () => {
    it('should create handler that tracks missing translations', () => {
      const handler = createMissingTranslationHandler()
      
      handler('en', 'common', 'auth.login')
      handler('cs', 'common', 'auth.login')

      const missing = getMissingTranslations()
      expect(missing).toHaveLength(2)
    })
  })

  describe('exportMissingTranslations', () => {
    it('should export missing translations by language', () => {
      trackMissingTranslation('auth.login', 'en')
      trackMissingTranslation('auth.logout', 'en')
      trackMissingTranslation('common.save', 'cs')

      const exported = exportMissingTranslations()
      expect(exported.en).toContain('auth.login')
      expect(exported.en).toContain('auth.logout')
      expect(exported.cs).toContain('common.save')
    })
  })
})

describe('Context Utilities', () => {
  describe('resolveContext', () => {
    it('should resolve context values', () => {
      const context = {
        gender: 'female',
        formal: true,
        time: 'morning',
      }

      expect(resolveContext(context, 'gender')).toBe('female')
      expect(resolveContext(context, 'formal')).toBe('formal')
      expect(resolveContext(context, 'time')).toBe('morning')
      expect(resolveContext(context, 'missing')).toBe('')
    })

    it('should handle boolean contexts', () => {
      expect(resolveContext({ formal: true }, 'formal')).toBe('formal')
      expect(resolveContext({ formal: false }, 'formal')).toBe('')
    })
  })

  describe('buildContextKey', () => {
    it('should build context keys', () => {
      expect(buildContextKey('greeting', 'morning')).toBe('greeting_morning')
      expect(buildContextKey('greeting', '')).toBe('greeting')
      expect(buildContextKey('auth.welcome', 'formal')).toBe('auth.welcome_formal')
    })
  })

  describe('getContextualValue', () => {
    it('should get contextual value', () => {
      const translations = {
        greeting: 'Hello',
        greeting_morning: 'Good morning',
        greeting_evening: 'Good evening',
        greeting_formal: 'Good day',
      }

      expect(getContextualValue(translations, 'greeting', 'morning')).toBe('Good morning')
      expect(getContextualValue(translations, 'greeting', 'evening')).toBe('Good evening')
      expect(getContextualValue(translations, 'greeting', 'unknown')).toBe('Hello')
      expect(getContextualValue(translations, 'missing', 'any')).toBe(null)
    })
  })

  describe('validateContextKey', () => {
    it('should validate context keys', () => {
      expect(validateContextKey('greeting_morning')).toBe(true)
      expect(validateContextKey('greeting_formal_male')).toBe(true)
      expect(validateContextKey('greeting')).toBe(false)
      expect(validateContextKey('_context')).toBe(false)
      expect(validateContextKey('key_')).toBe(false)
    })
  })

  describe('extractContexts', () => {
    it('should extract contexts from translations', () => {
      const translations = {
        greeting: 'Hello',
        greeting_morning: 'Good morning',
        greeting_evening: 'Good evening',
        greeting_formal: 'Good day',
        welcome: 'Welcome',
        welcome_male: 'Welcome sir',
        welcome_female: 'Welcome madam',
      }

      const contexts = extractContexts(translations)
      expect(contexts.greeting).toContain('morning')
      expect(contexts.greeting).toContain('evening')
      expect(contexts.greeting).toContain('formal')
      expect(contexts.welcome).toContain('male')
      expect(contexts.welcome).toContain('female')
    })
  })
})

describe('Lazy Loading Utilities', () => {
  beforeEach(() => {
    // Reset loaded namespaces
    getLoadedNamespaces().forEach(ns => {
      // Mock unload
    })
  })

  describe('preloadNamespace', () => {
    it('should preload namespace', async () => {
      const mockLoader = jest.fn().mockResolvedValue({
        auth: { login: 'Login' },
      })

      await preloadNamespace('auth', 'en', mockLoader)
      
      expect(mockLoader).toHaveBeenCalledWith('auth', 'en')
      expect(isNamespaceLoaded('auth', 'en')).toBe(true)
    })

    it('should not reload already loaded namespace', async () => {
      const mockLoader = jest.fn().mockResolvedValue({})

      await preloadNamespace('auth', 'en', mockLoader)
      await preloadNamespace('auth', 'en', mockLoader)
      
      expect(mockLoader).toHaveBeenCalledTimes(1)
    })
  })

  describe('preloadNamespaces', () => {
    it('should preload multiple namespaces', async () => {
      const mockLoader = jest.fn().mockResolvedValue({})

      await preloadNamespaces(['auth', 'common', 'recipes'], 'en', mockLoader)
      
      expect(mockLoader).toHaveBeenCalledTimes(3)
      expect(isNamespaceLoaded('auth', 'en')).toBe(true)
      expect(isNamespaceLoaded('common', 'en')).toBe(true)
      expect(isNamespaceLoaded('recipes', 'en')).toBe(true)
    })
  })

  describe('createLazyLoadHandler', () => {
    it('should create lazy load handler', () => {
      const mockBackend = {
        read: jest.fn((lng, ns, callback) => {
          callback(null, { login: 'Login' })
        }),
      }

      const handler = createLazyLoadHandler(mockBackend)
      
      const callback = jest.fn()
      handler('en', 'auth', callback)
      
      expect(mockBackend.read).toHaveBeenCalledWith('en', 'auth', expect.any(Function))
      expect(callback).toHaveBeenCalledWith(null, { login: 'Login' })
    })

    it('should handle errors', () => {
      const mockBackend = {
        read: jest.fn((lng, ns, callback) => {
          callback(new Error('Failed to load'), null)
        }),
      }

      const handler = createLazyLoadHandler(mockBackend)
      
      const callback = jest.fn()
      handler('en', 'auth', callback)
      
      expect(callback).toHaveBeenCalledWith(expect.any(Error), null)
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('Format functions with invalid inputs', () => {
    it('should handle null/undefined gracefully', () => {
      expect(formatNumber(null as any)).toBe('0')
      expect(formatNumber(undefined as any)).toBe('0')
      expect(formatDate(null as any, 'en')).toBe('Invalid Date')
      expect(formatList(null as any, 'en')).toBe('')
      expect(formatList(undefined as any, 'en')).toBe('')
    })

    it('should handle invalid locales', () => {
      expect(() => formatNumber(1234, 'invalid')).not.toThrow()
      expect(() => formatDate(new Date(), 'invalid')).not.toThrow()
    })
  })

  describe('Key utilities with edge cases', () => {
    it('should handle empty strings', () => {
      expect(buildKey('', '', '')).toBe('')
      expect(normalizeKey('')).toBe('')
      expect(splitKey('')).toEqual([''])
      expect(joinKeys(['', '', ''])).toBe('..')
    })

    it('should handle special characters', () => {
      expect(normalizeKey('auth@login')).toBe('auth@login')
      expect(splitKey('auth:login.test')).toEqual(['auth:login', 'test'])
    })
  })

  describe('Validation with malformed data', () => {
    it('should handle circular references', () => {
      const circular: any = { a: 'test' }
      circular.self = circular

      expect(() => findMissingKeys(circular, {})).not.toThrow()
      expect(() => validateInterpolations(circular, {})).not.toThrow()
    })

    it('should handle non-object inputs', () => {
      expect(findMissingKeys('string' as any, {})).toEqual([])
      expect(findMissingKeys({}, 'string' as any)).toEqual([])
      expect(validateInterpolations(null as any, {})).toEqual({
        valid: [],
        invalid: [],
        mismatched: {},
      })
    })
  })
})