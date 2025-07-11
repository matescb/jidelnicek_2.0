import { renderHook, act } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import React from 'react'
import i18n from 'i18next'
import {
  useTypedTranslation,
  useNamespaceTranslation,
  useDynamicTranslation,
  useTranslationExists,
  usePluralTranslation,
  useContextualTranslation,
  useMissingTranslations,
  useTranslationKeys,
} from '../hooks/useTranslation'
import {
  useNumberFormat,
  useCurrencyFormat,
  useDateFormat,
  useRelativeTime,
  useListFormat,
  useFormatting,
} from '../hooks/useFormatting'

// Mock i18next
const mockI18n = {
  language: 'en',
  changeLanguage: jest.fn(),
  exists: jest.fn(),
  t: jest.fn(),
  options: {
    resources: {
      en: {
        translation: {
          auth: {
            login: 'Login',
            welcome: 'Welcome',
            welcome_male: 'Welcome sir',
            welcome_female: 'Welcome madam',
            welcome_formal: 'Welcome esteemed user',
            passwordMin: 'Password must be at least {{min}} characters',
          },
          common: {
            status: 'Status',
            status_active: 'Active',
            status_inactive: 'Inactive',
            appName: 'Recipe App',
          },
          recipes: {
            recipes_one: '{{count}} recipe',
            recipes_other: '{{count}} recipes',
            ingredient_one: '{{count}} ingredient',
            ingredient_other: '{{count}} ingredients',
            units: {
              g: 'grams',
              kg: 'kilograms',
            },
          },
        },
      },
      cs: {
        translation: {
          auth: {
            login: 'Přihlásit se',
            welcome: 'Vítejte',
          },
          common: {
            appName: 'Aplikace Receptů',
          },
        },
      },
      ar: {
        translation: {
          auth: {
            login: 'تسجيل الدخول',
            welcome: 'مرحبا',
          },
          common: {
            appName: 'تطبيق الوصفات',
          },
        },
      },
    },
    fallbackLng: 'en',
  },
}

// Helper to create wrapper
const createWrapper = (customI18n = mockI18n) => {
  return ({ children }: { children: React.ReactNode }) => (
    <I18nextProvider i18n={customI18n as any}>
      {children}
    </I18nextProvider>
  )
}

describe('useTypedTranslation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockI18n.t.mockImplementation((key: string, options?: any) => {
      const keys = key.split('.')
      let value: any = mockI18n.options.resources[mockI18n.language]?.translation
      
      for (const k of keys) {
        value = value?.[k]
      }
      
      if (typeof value === 'string' && options) {
        // Simple interpolation
        Object.entries(options).forEach(([k, v]) => {
          value = value.replace(`{{${k}}}`, String(v))
        })
      }
      
      return value || key
    })
    
    mockI18n.exists.mockImplementation((key: string) => {
      const keys = key.split('.')
      let value: any = mockI18n.options.resources[mockI18n.language]?.translation
      
      for (const k of keys) {
        value = value?.[k]
      }
      
      return value !== undefined
    })
  })

  it('should translate with type safety', () => {
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.t('auth.login')).toBe('Login')
    expect(result.current.t('common.appName')).toBe('Recipe App')
  })

  it('should handle interpolation', () => {
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.t('auth.passwordMin', { min: 8 })).toBe(
      'Password must be at least 8 characters'
    )
  })

  it('should change language', async () => {
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.language).toBe('en')
    
    await act(async () => {
      mockI18n.language = 'cs'
      await result.current.changeLanguage('cs')
    })

    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('cs')
  })

  it('should track missing translations in development', () => {
    const originalEnv = import.meta.env.DEV
    Object.defineProperty(import.meta.env, 'DEV', { value: true, configurable: true })
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    mockI18n.exists.mockReturnValue(false)
    
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    result.current.t('missing.key')
    
    expect(consoleSpy).toHaveBeenCalledWith('Missing translation: en:missing.key')
    
    consoleSpy.mockRestore()
    Object.defineProperty(import.meta.env, 'DEV', { value: originalEnv, configurable: true })
  })
})

describe('useNamespaceTranslation', () => {
  it('should translate within namespace', () => {
    const { result } = renderHook(() => useNamespaceTranslation('auth'), {
      wrapper: createWrapper(),
    })

    expect(result.current.t('login')).toBe('Login')
    expect(result.current.t('welcome')).toBe('Welcome')
  })

  it('should support prefixed translation', () => {
    const { result } = renderHook(() => useNamespaceTranslation('auth'), {
      wrapper: createWrapper(),
    })

    expect(result.current.tWithPrefix('common.appName')).toBe('Recipe App')
  })
})

describe('useDynamicTranslation', () => {
  it('should build dynamic keys', () => {
    const { result } = renderHook(() => useDynamicTranslation(), {
      wrapper: createWrapper(),
    })

    const key = result.current.buildKey('recipes', 'units', 'g')
    expect(key).toBe('recipes.units.g')
    expect(result.current.t(key)).toBe('grams')
  })

  it('should build namespaced keys', () => {
    const { result } = renderHook(() => useDynamicTranslation(), {
      wrapper: createWrapper(),
    })

    const key = result.current.buildNamespacedKey('recipes', 'units', 'kg')
    expect(key).toBe('recipes.units.kg')
    expect(result.current.t(key)).toBe('kilograms')
  })

  it('should handle safe translation with default', () => {
    const { result } = renderHook(() => useDynamicTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.tSafe('missing.key', 'Default value')).toBe('Default value')
    expect(result.current.tSafe('auth.login', 'Default')).toBe('Login')
  })

  it('should warn about missing dynamic keys in development', () => {
    const originalEnv = import.meta.env.DEV
    Object.defineProperty(import.meta.env, 'DEV', { value: true, configurable: true })
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    mockI18n.exists.mockReturnValue(false)
    
    const { result } = renderHook(() => useDynamicTranslation(), {
      wrapper: createWrapper(),
    })

    result.current.t('dynamic.missing.key')
    
    expect(consoleSpy).toHaveBeenCalledWith('Dynamic translation key not found: dynamic.missing.key')
    
    consoleSpy.mockRestore()
    Object.defineProperty(import.meta.env, 'DEV', { value: originalEnv, configurable: true })
  })
})

describe('useTranslationExists', () => {
  it('should check if translation exists', () => {
    const { result } = renderHook(() => useTranslationExists(), {
      wrapper: createWrapper(),
    })

    expect(result.current.exists('auth.login')).toBe(true)
    expect(result.current.exists('missing.key')).toBe(false)
  })

  it('should check existence in specific language', () => {
    const { result } = renderHook(() => useTranslationExists(), {
      wrapper: createWrapper(),
    })

    mockI18n.exists.mockImplementation((key: string, options?: any) => {
      const lang = options?.lng || mockI18n.language
      const keys = key.split('.')
      let value: any = mockI18n.options.resources[lang]?.translation
      
      for (const k of keys) {
        value = value?.[k]
      }
      
      return value !== undefined
    })

    expect(result.current.existsInLanguage('auth.login', 'en')).toBe(true)
    expect(result.current.existsInLanguage('auth.login', 'cs')).toBe(true)
    expect(result.current.existsInLanguage('recipes.units.g', 'cs')).toBe(false)
  })

  it('should get available languages for key', () => {
    const { result } = renderHook(() => useTranslationExists(), {
      wrapper: createWrapper(),
    })

    mockI18n.exists.mockImplementation((key: string, options?: any) => {
      const lang = options?.lng || mockI18n.language
      return ['en', 'cs'].includes(lang) && key === 'auth.login'
    })

    const languages = result.current.getAvailableLanguages('auth.login')
    expect(languages).toContain('en')
    expect(languages).toContain('cs')
  })
})

describe('usePluralTranslation', () => {
  beforeEach(() => {
    mockI18n.t.mockImplementation((key: string, options?: any) => {
      const count = options?.count
      const pluralKey = count === 1 ? `${key}_one` : `${key}_other`
      const keys = pluralKey.split('.')
      let value: any = mockI18n.options.resources[mockI18n.language]?.translation
      
      for (const k of keys) {
        value = value?.[k]
      }
      
      if (typeof value === 'string' && options) {
        Object.entries(options).forEach(([k, v]) => {
          value = value.replace(`{{${k}}}`, String(v))
        })
      }
      
      return value || key
    })
  })

  it('should handle pluralization', () => {
    const { result } = renderHook(() => usePluralTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.tPlural('recipes.recipes', 1)).toBe('1 recipe')
    expect(result.current.tPlural('recipes.recipes', 5)).toBe('5 recipes')
    expect(result.current.tPlural('recipes.ingredient', 0)).toBe('0 ingredients')
    expect(result.current.tPlural('recipes.ingredient', 1)).toBe('1 ingredient')
  })

  it('should handle plural with default values', () => {
    const { result } = renderHook(() => usePluralTranslation(), {
      wrapper: createWrapper(),
    })

    expect(
      result.current.tPluralWithDefault(
        'missing.plural.key',
        1,
        'One item',
        'Many items'
      )
    ).toBe('One item')

    expect(
      result.current.tPluralWithDefault(
        'missing.plural.key',
        5,
        'One item',
        'Many items'
      )
    ).toBe('Many items')
  })
})

describe('useContextualTranslation', () => {
  beforeEach(() => {
    mockI18n.t.mockImplementation((key: string, options?: any) => {
      const context = options?.context
      const contextKey = context ? `${key}_${context}` : key
      const keys = contextKey.split('.')
      let value: any = mockI18n.options.resources[mockI18n.language]?.translation
      
      for (const k of keys) {
        value = value?.[k]
      }
      
      return value || key
    })
  })

  it('should handle contextual translations', () => {
    const { result } = renderHook(() => useContextualTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.tContext('auth.welcome', 'male')).toBe('Welcome sir')
    expect(result.current.tContext('auth.welcome', 'female')).toBe('Welcome madam')
    expect(result.current.tContext('auth.welcome', 'formal')).toBe('Welcome esteemed user')
  })

  it('should handle contextual translation with default', () => {
    const { result } = renderHook(() => useContextualTranslation(), {
      wrapper: createWrapper(),
    })

    expect(
      result.current.tContextWithDefault(
        'auth.welcome',
        'unknown',
        'Welcome guest'
      )
    ).toBe('Welcome guest')

    expect(
      result.current.tContextWithDefault(
        'common.status',
        'active',
        'Default status'
      )
    ).toBe('Active')
  })
})

describe('useMissingTranslations', () => {
  it('should get all translation keys', () => {
    const { result } = renderHook(() => useMissingTranslations(), {
      wrapper: createWrapper(),
    })

    const keys = result.current.getAllKeys()
    expect(keys).toContain('auth.login')
    expect(keys).toContain('common.appName')
    expect(keys).toContain('recipes.units.g')
  })

  it('should find missing keys for language', () => {
    const { result } = renderHook(() => useMissingTranslations(), {
      wrapper: createWrapper(),
    })

    mockI18n.exists.mockImplementation((key: string, options?: any) => {
      const lang = options?.lng || mockI18n.language
      if (lang === 'cs') {
        return ['auth.login', 'auth.welcome', 'common.appName'].includes(key)
      }
      return true
    })

    const missing = result.current.getMissingKeys('cs')
    expect(missing).toContain('recipes.units.g')
    expect(missing).not.toContain('auth.login')
  })

  it('should generate coverage report', () => {
    const { result } = renderHook(() => useMissingTranslations(), {
      wrapper: createWrapper(),
    })

    mockI18n.exists.mockImplementation((key: string, options?: any) => {
      const lang = options?.lng || mockI18n.language
      if (lang === 'cs') {
        return ['auth.login', 'auth.welcome', 'common.appName'].some(k => key.includes(k))
      }
      return true
    })

    const report = result.current.checkCoverage()
    expect(report.totalKeys).toBeGreaterThan(0)
    expect(report.missingKeys).toHaveProperty('en')
    expect(report.missingKeys).toHaveProperty('cs')
    expect(report.coveragePercentage.en).toBe(100)
    expect(report.coveragePercentage.cs).toBeLessThan(100)
    expect(report.timestamp).toBeInstanceOf(Date)
  })
})

describe('useTranslationKeys', () => {
  it('should create key builders', () => {
    const { result } = renderHook(() => useTranslationKeys('recipes'), {
      wrapper: createWrapper(),
    })

    const key = result.current.units.g()
    expect(key).toBe('recipes.units.g')
  })

  it('should create nested key builders', () => {
    const { result } = renderHook(() => useTranslationKeys('auth'), {
      wrapper: createWrapper(),
    })

    const loginKey = result.current.login()
    expect(loginKey).toBe('auth.login')
    
    const welcomeKey = result.current.welcome()
    expect(welcomeKey).toBe('auth.welcome')
  })
})

describe('Formatting Hooks', () => {
  describe('useNumberFormat', () => {
    it('should format numbers', () => {
      const { result } = renderHook(() => useNumberFormat(), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(1234.56)).toBe('1,234.56')
      expect(result.current.formatCompact(1500)).toBe('1.5K')
      expect(result.current.formatDecimal(3.14159, 2, 2)).toBe('3.14')
      expect(result.current.formatOrdinal(1)).toBe('1st')
      expect(result.current.formatOrdinal(2)).toBe('2nd')
      expect(result.current.formatOrdinal(3)).toBe('3rd')
      expect(result.current.formatOrdinal(4)).toBe('4th')
      expect(result.current.formatBytes(1024)).toBe('1 KB')
      expect(result.current.formatBytes(1048576)).toBe('1 MB')
    })

    it('should respect locale for number formatting', async () => {
      mockI18n.language = 'cs'
      const { result } = renderHook(() => useNumberFormat(), {
        wrapper: createWrapper(),
      })

      // Czech uses space as thousands separator and comma as decimal
      expect(result.current.format(1234.56)).toBe('1 234,56')
    })

    it('should format with override options', () => {
      const { result } = renderHook(() => useNumberFormat({ minimumFractionDigits: 2 }), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(1234)).toBe('1,234.00')
      expect(result.current.format(1234.5, { minimumFractionDigits: 0 })).toBe('1,235')
    })
  })

  describe('useCurrencyFormat', () => {
    it('should format currency', () => {
      const { result } = renderHook(() => useCurrencyFormat('USD'), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(1234.56)).toBe('$1,234.56')
      expect(result.current.format(1234.56, 'EUR')).toBe('€1,234.56')
      expect(result.current.formatPercent(0.125)).toBe('12.5%')
    })

    it('should use locale default currency', () => {
      mockI18n.language = 'cs'
      const { result } = renderHook(() => useCurrencyFormat(), {
        wrapper: createWrapper(),
      })

      expect(result.current.currency).toBe('CZK')
    })

    it('should format currency for Arabic locale', () => {
      mockI18n.language = 'ar'
      const { result } = renderHook(() => useCurrencyFormat('SAR'), {
        wrapper: createWrapper(),
      })

      // Arabic uses different number format
      expect(result.current.format(1234.56)).toContain('١٬٢٣٤٫٥٦')
    })
  })

  describe('useDateFormat', () => {
    it('should format dates', () => {
      const date = new Date('2024-01-15T10:30:00')
      const { result } = renderHook(() => useDateFormat(), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(date)).toContain('1/15/2024')
      expect(result.current.formatDateTime(date, 'short', 'short')).toContain('1/15/24')
      expect(result.current.formatTime(date)).toContain('10:30')
      expect(result.current.formatDuration(90)).toBe('1h 30m')
    })

    it('should format dates for Czech locale', () => {
      mockI18n.language = 'cs'
      const date = new Date('2024-01-15T10:30:00')
      const { result } = renderHook(() => useDateFormat(), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(date)).toContain('15. 1. 2024')
    })
  })

  describe('useRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15T12:00:00'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should format relative time', () => {
      const { result } = renderHook(() => useRelativeTime(), {
        wrapper: createWrapper(),
      })

      const pastDate = new Date('2024-01-15T11:00:00')
      const futureDate = new Date('2024-01-15T14:00:00')

      expect(result.current.format(pastDate)).toBe('1 hour ago')
      expect(result.current.format(futureDate)).toBe('in 2 hours')
    })

    it('should format relative date', () => {
      const { result } = renderHook(() => useRelativeTime(), {
        wrapper: createWrapper(),
      })

      const yesterday = new Date('2024-01-14T12:00:00')
      const tomorrow = new Date('2024-01-16T12:00:00')

      expect(result.current.formatRelative(yesterday)).toBe('yesterday')
      expect(result.current.formatRelative(tomorrow)).toBe('tomorrow')
    })
  })

  describe('useListFormat', () => {
    it('should format lists', () => {
      const { result } = renderHook(() => useListFormat(), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(['Apple', 'Banana', 'Orange'])).toBe('Apple, Banana, and Orange')
      expect(result.current.format(['Apple', 'Banana'])).toBe('Apple and Banana')
      expect(result.current.format(['Apple'])).toBe('Apple')
    })

    it('should format lists with options', () => {
      const { result } = renderHook(() => useListFormat({ type: 'disjunction' }), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(['Apple', 'Banana', 'Orange'])).toBe('Apple, Banana, or Orange')
    })

    it('should format lists for Czech locale', () => {
      mockI18n.language = 'cs'
      const { result } = renderHook(() => useListFormat(), {
        wrapper: createWrapper(),
      })

      expect(result.current.format(['Jablko', 'Banán', 'Pomeranč'])).toBe('Jablko, Banán a Pomeranč')
    })
  })

  describe('useFormatting', () => {
    it('should provide all formatting utilities', () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: createWrapper(),
      })

      expect(result.current.number).toBeDefined()
      expect(result.current.currency).toBeDefined()
      expect(result.current.date).toBeDefined()
      expect(result.current.relativeTime).toBeDefined()
      expect(result.current.list).toBeDefined()

      // Test basic functionality
      expect(result.current.number.format(1234)).toBe('1,234')
      expect(result.current.currency.format(99.99)).toContain('99.99')
      expect(result.current.list.format(['A', 'B'])).toBe('A and B')
    })
  })
})

describe('RTL Support in Hooks', () => {
  it('should detect RTL language', () => {
    mockI18n.language = 'ar'
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.language).toBe('ar')
    // Additional RTL-specific tests would go here
  })
})

describe('Edge Cases and Error Handling', () => {
  it('should handle undefined namespace gracefully', () => {
    const { result } = renderHook(() => useTypedTranslation(undefined), {
      wrapper: createWrapper(),
    })

    expect(() => result.current.t('auth.login')).not.toThrow()
  })

  it('should handle empty interpolation values', () => {
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.t('auth.passwordMin', {})).toBe('Password must be at least {{min}} characters')
  })

  it('should handle null or undefined count in pluralization', () => {
    const { result } = renderHook(() => usePluralTranslation(), {
      wrapper: createWrapper(),
    })

    expect(() => result.current.tPlural('recipes.recipes', null as any)).not.toThrow()
    expect(() => result.current.tPlural('recipes.recipes', undefined as any)).not.toThrow()
  })

  it('should handle invalid language codes gracefully', () => {
    const { result } = renderHook(() => useTypedTranslation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.changeLanguage('invalid-lang' as any)
    })

    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('invalid-lang')
  })
})