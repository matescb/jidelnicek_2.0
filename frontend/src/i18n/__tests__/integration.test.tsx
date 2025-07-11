import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useTypedTranslation } from '../hooks/useTranslation'
import { useNumberFormat, useCurrencyFormat, useDateFormat } from '../hooks/useFormatting'
import { updateDocumentDirection, isRTL } from '../rtl'

// Test translations
const testTranslations = {
  en: {
    translation: {
      common: {
        welcome: 'Welcome',
        greeting: 'Hello {{name}}',
        items_one: '{{count}} item',
        items_other: '{{count}} items',
        price: 'Price: {{amount}}',
        date: 'Date: {{date}}',
        list: 'Items: {{items}}',
      },
      auth: {
        login: 'Sign In',
        logout: 'Sign Out',
        profile: 'Profile',
      },
      recipes: {
        title: 'Recipes',
        search: 'Search recipes...',
        ingredients: 'Ingredients',
      },
    },
  },
  cs: {
    translation: {
      common: {
        welcome: 'Vítejte',
        greeting: 'Ahoj {{name}}',
        items_one: '{{count}} položka',
        items_few: '{{count}} položky',
        items_other: '{{count}} položek',
        price: 'Cena: {{amount}}',
        date: 'Datum: {{date}}',
        list: 'Položky: {{items}}',
      },
      auth: {
        login: 'Přihlásit se',
        logout: 'Odhlásit se',
        profile: 'Profil',
      },
      recipes: {
        title: 'Recepty',
        search: 'Hledat recepty...',
        ingredients: 'Ingredience',
      },
    },
  },
  ar: {
    translation: {
      common: {
        welcome: 'مرحبا',
        greeting: 'مرحبا {{name}}',
        items_zero: 'لا توجد عناصر',
        items_one: 'عنصر واحد',
        items_two: 'عنصران',
        items_few: '{{count}} عناصر',
        items_many: '{{count}} عنصرا',
        items_other: '{{count}} عنصر',
        price: 'السعر: {{amount}}',
        date: 'التاريخ: {{date}}',
        list: 'العناصر: {{items}}',
      },
      auth: {
        login: 'تسجيل الدخول',
        logout: 'تسجيل الخروج',
        profile: 'الملف الشخصي',
      },
      recipes: {
        title: 'الوصفات',
        search: 'البحث عن وصفات...',
        ingredients: 'المكونات',
      },
    },
  },
}

// Test component using multiple hooks
const TestComponent: React.FC = () => {
  const { t, language } = useTypedTranslation()
  const { format: formatNumber } = useNumberFormat()
  const { format: formatCurrency } = useCurrencyFormat()
  const { format: formatDate } = useDateFormat()

  const [count, setCount] = React.useState(1)
  const testDate = new Date('2024-01-15')

  return (
    <div data-testid="test-component">
      <h1>{t('common.welcome')}</h1>
      <p>{t('common.greeting', { name: 'User' })}</p>
      <p data-testid="item-count">{t('common.items', { count })}</p>
      <p data-testid="price">{t('common.price', { amount: formatCurrency(99.99) })}</p>
      <p data-testid="date">{t('common.date', { date: formatDate(testDate) })}</p>
      <p data-testid="current-language">Language: {language}</p>
      <p data-testid="formatted-number">{formatNumber(1234.56)}</p>
      
      <button onClick={() => setCount(count + 1)}>Add Item</button>
      
      <div data-testid="auth-section">
        <button>{t('auth.login')}</button>
        <button>{t('auth.logout')}</button>
        <button>{t('auth.profile')}</button>
      </div>

      <div data-testid="recipes-section">
        <h2>{t('recipes.title')}</h2>
        <input placeholder={t('recipes.search')} />
        <span>{t('recipes.ingredients')}</span>
      </div>
    </div>
  )
}

// Initialize i18n for tests
const setupI18n = async (initialLanguage = 'en') => {
  const instance = i18n.createInstance()
  
  await instance
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: 'en',
      resources: testTranslations,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })

  return instance
}

// Create wrapper with i18n
const createWrapper = (i18nInstance: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <I18nextProvider i18n={i18nInstance}>
      {children}
    </I18nextProvider>
  )
}

describe('i18n Integration Tests', () => {
  let i18nInstance: any

  beforeEach(async () => {
    i18nInstance = await setupI18n()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Language Switching', () => {
    it('should switch language and update all translations', async () => {
      render(
        <>
          <TestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Initial state - English
      expect(screen.getByText('Welcome')).toBeInTheDocument()
      expect(screen.getByText('Hello User')).toBeInTheDocument()
      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.getByText('Recipes')).toBeInTheDocument()
      expect(screen.getByTestId('current-language')).toHaveTextContent('Language: en')

      // Switch to Czech
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByText('Vítejte')).toBeInTheDocument()
        expect(screen.getByText('Ahoj User')).toBeInTheDocument()
        expect(screen.getByText('Přihlásit se')).toBeInTheDocument()
        expect(screen.getByText('Recepty')).toBeInTheDocument()
        expect(screen.getByTestId('current-language')).toHaveTextContent('Language: cs')
      })

      // Switch to Arabic
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(screen.getByText('مرحبا')).toBeInTheDocument()
        expect(screen.getByText('مرحبا User')).toBeInTheDocument()
        expect(screen.getByText('تسجيل الدخول')).toBeInTheDocument()
        expect(screen.getByText('الوصفات')).toBeInTheDocument()
        expect(screen.getByTestId('current-language')).toHaveTextContent('Language: ar')
      })
    })

    it('should update formatting when language changes', async () => {
      render(
        <>
          <TestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Check English formatting
      expect(screen.getByTestId('formatted-number')).toHaveTextContent('1,234.56')
      expect(screen.getByTestId('price')).toHaveTextContent('$99.99')
      expect(screen.getByTestId('date')).toHaveTextContent('1/15/2024')

      // Switch to Czech
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByTestId('formatted-number')).toHaveTextContent('1 234,56')
        expect(screen.getByTestId('price')).toHaveTextContent('99,99 Kč')
        expect(screen.getByTestId('date')).toHaveTextContent('15. 1. 2024')
      })
    })

    it('should handle pluralization rules for different languages', async () => {
      render(
        <>
          <TestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      const addButton = screen.getByText('Add Item')

      // English pluralization
      expect(screen.getByTestId('item-count')).toHaveTextContent('1 item')
      fireEvent.click(addButton)
      await waitFor(() => {
        expect(screen.getByTestId('item-count')).toHaveTextContent('2 items')
      })

      // Switch to Czech
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByTestId('item-count')).toHaveTextContent('2 položky')
      })

      // Add more items to test Czech pluralization
      fireEvent.click(addButton) // 3 items
      fireEvent.click(addButton) // 4 items
      await waitFor(() => {
        expect(screen.getByTestId('item-count')).toHaveTextContent('4 položky')
      })

      fireEvent.click(addButton) // 5 items
      await waitFor(() => {
        expect(screen.getByTestId('item-count')).toHaveTextContent('5 položek')
      })

      // Switch to Arabic
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(screen.getByTestId('item-count')).toHaveTextContent('5 عناصر')
      })
    })
  })

  describe('Language Persistence', () => {
    it('should persist language selection to localStorage', async () => {
      render(<LanguageSwitcher />, { wrapper: createWrapper(i18nInstance) })

      // Switch to Czech
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('i18nextLng', 'cs')
      })
    })

    it('should restore language from localStorage on init', async () => {
      // Mock localStorage to return Czech
      ;(window.localStorage.getItem as jest.Mock).mockReturnValue('cs')

      const persistedI18n = await setupI18n()
      
      render(<TestComponent />, { wrapper: createWrapper(persistedI18n) })

      await waitFor(() => {
        expect(screen.getByText('Vítejte')).toBeInTheDocument()
        expect(screen.getByTestId('current-language')).toHaveTextContent('Language: cs')
      })
    })
  })

  describe('RTL Support', () => {
    it('should update document direction for RTL languages', async () => {
      render(<LanguageSwitcher />, { wrapper: createWrapper(i18nInstance) })

      // Initial LTR
      expect(document.documentElement.dir).toBe('ltr')

      // Switch to Arabic (RTL)
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(document.documentElement.dir).toBe('rtl')
        expect(document.documentElement.lang).toBe('ar')
      })

      // Switch back to English (LTR)
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /english/i }))

      await waitFor(() => {
        expect(document.documentElement.dir).toBe('ltr')
        expect(document.documentElement.lang).toBe('en')
      })
    })

    it('should apply RTL-specific styles', async () => {
      // Component that uses RTL-aware styles
      const RTLAwareComponent: React.FC = () => {
        const { language } = useTypedTranslation()
        const isRTLLang = isRTL(language)

        return (
          <div
            data-testid="rtl-box"
            style={{
              paddingInlineStart: '20px',
              paddingInlineEnd: '10px',
              textAlign: isRTLLang ? 'right' : 'left',
            }}
          >
            Content
          </div>
        )
      }

      render(
        <>
          <RTLAwareComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      const box = screen.getByTestId('rtl-box')

      // LTR styles
      expect(box).toHaveStyle({ textAlign: 'left' })

      // Switch to Arabic
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(box).toHaveStyle({ textAlign: 'right' })
      })
    })
  })

  describe('Real Component Integration', () => {
    it('should translate navigation menu', async () => {
      const NavigationMenu: React.FC = () => {
        const { t } = useTypedTranslation()

        return (
          <nav data-testid="navigation">
            <a href="/recipes">{t('recipes.title')}</a>
            <a href="/profile">{t('auth.profile')}</a>
            <button>{t('auth.logout')}</button>
          </nav>
        )
      }

      render(
        <>
          <NavigationMenu />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Check English
      expect(screen.getByText('Recipes')).toBeInTheDocument()
      expect(screen.getByText('Profile')).toBeInTheDocument()
      expect(screen.getByText('Sign Out')).toBeInTheDocument()

      // Switch to Czech
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByText('Recepty')).toBeInTheDocument()
        expect(screen.getByText('Profil')).toBeInTheDocument()
        expect(screen.getByText('Odhlásit se')).toBeInTheDocument()
      })
    })

    it('should translate form with placeholders', async () => {
      const SearchForm: React.FC = () => {
        const { t } = useTypedTranslation()

        return (
          <form data-testid="search-form">
            <input
              type="text"
              placeholder={t('recipes.search')}
              aria-label={t('recipes.search')}
            />
            <button type="submit">{t('common.search', 'Search')}</button>
          </form>
        )
      }

      render(
        <>
          <SearchForm />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      const input = screen.getByRole('textbox')

      // Check English
      expect(input).toHaveAttribute('placeholder', 'Search recipes...')
      expect(input).toHaveAttribute('aria-label', 'Search recipes...')

      // Switch to Arabic
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(input).toHaveAttribute('placeholder', 'البحث عن وصفات...')
        expect(input).toHaveAttribute('aria-label', 'البحث عن وصفات...')
      })
    })

    it('should handle dynamic content updates', async () => {
      const DynamicContent: React.FC = () => {
        const { t } = useTypedTranslation()
        const [items, setItems] = React.useState(['Apple', 'Banana'])

        return (
          <div data-testid="dynamic-content">
            <p>{t('common.items', { count: items.length })}</p>
            <ul>
              {items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <button onClick={() => setItems([...items, 'Orange'])}>
              Add Item
            </button>
          </div>
        )
      }

      render(
        <>
          <DynamicContent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Initial state
      expect(screen.getByText('2 items')).toBeInTheDocument()

      // Add item
      fireEvent.click(screen.getByText('Add Item'))
      await waitFor(() => {
        expect(screen.getByText('3 items')).toBeInTheDocument()
      })

      // Switch language and verify count updates
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByText('3 položky')).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Loading', () => {
    it('should handle rapid language switching', async () => {
      render(<LanguageSwitcher variant="inline" />, { wrapper: createWrapper(i18nInstance) })

      const czechButton = screen.getByRole('button', { name: /switch to czech/i })
      const arabicButton = screen.getByRole('button', { name: /switch to arabic/i })
      const englishButton = screen.getByRole('button', { name: /switch to english/i })

      // Rapid switching
      fireEvent.click(czechButton)
      fireEvent.click(arabicButton)
      fireEvent.click(englishButton)
      fireEvent.click(czechButton)

      await waitFor(() => {
        expect(i18nInstance.language).toBe('cs')
      })
    })

    it('should maintain state during language changes', async () => {
      const StatefulComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        const [count, setCount] = React.useState(0)
        const [text, setText] = React.useState('')

        return (
          <div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('common.input', 'Enter text')}
            />
            <button onClick={() => setCount(count + 1)}>
              {t('common.increment', 'Increment')}: {count}
            </button>
            <p data-testid="state-values">
              Count: {count}, Text: {text}
            </p>
          </div>
        )
      }

      render(
        <>
          <StatefulComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Set some state
      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /increment/i })

      fireEvent.change(input, { target: { value: 'Test text' } })
      fireEvent.click(button)
      fireEvent.click(button)

      expect(screen.getByTestId('state-values')).toHaveTextContent('Count: 2, Text: Test text')

      // Change language
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      // State should be preserved
      await waitFor(() => {
        expect(screen.getByTestId('state-values')).toHaveTextContent('Count: 2, Text: Test text')
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing translations gracefully', async () => {
      const ComponentWithMissingTranslations: React.FC = () => {
        const { t } = useTypedTranslation()

        return (
          <div>
            <p data-testid="missing">{t('missing.key.path' as any)}</p>
            <p data-testid="partial">{t('common.nonexistent' as any)}</p>
          </div>
        )
      }

      render(<ComponentWithMissingTranslations />, { wrapper: createWrapper(i18nInstance) })

      // Should show the key as fallback
      expect(screen.getByTestId('missing')).toHaveTextContent('missing.key.path')
      expect(screen.getByTestId('partial')).toHaveTextContent('common.nonexistent')
    })

    it('should handle malformed interpolation gracefully', async () => {
      const ComponentWithBadInterpolation: React.FC = () => {
        const { t } = useTypedTranslation()

        return (
          <div>
            <p data-testid="missing-value">{t('common.greeting', {})}</p>
            <p data-testid="extra-value">{t('common.welcome', { extra: 'value' })}</p>
          </div>
        )
      }

      render(<ComponentWithBadInterpolation />, { wrapper: createWrapper(i18nInstance) })

      // Should handle missing interpolation value
      expect(screen.getByTestId('missing-value')).toHaveTextContent('Hello {{name}}')
      
      // Should ignore extra interpolation value
      expect(screen.getByTestId('extra-value')).toHaveTextContent('Welcome')
    })

    it('should recover from language loading errors', async () => {
      const errorI18n = await setupI18n()
      
      // Mock a language loading error
      const originalChangeLanguage = errorI18n.changeLanguage
      errorI18n.changeLanguage = jest.fn().mockRejectedValueOnce(new Error('Failed to load language'))

      render(
        <>
          <TestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(errorI18n) }
      )

      // Try to switch language
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      // Should still show English content
      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Restore original function
      errorI18n.changeLanguage = originalChangeLanguage
    })
  })

  describe('Accessibility', () => {
    it('should announce language changes to screen readers', async () => {
      // Create a live region for announcements
      const LiveRegion: React.FC = () => {
        const { language } = useTypedTranslation()
        const [announcement, setAnnouncement] = React.useState('')

        React.useEffect(() => {
          const languageNames: Record<string, string> = {
            en: 'English',
            cs: 'Czech',
            ar: 'Arabic',
          }
          setAnnouncement(`Language changed to ${languageNames[language]}`)
        }, [language])

        return (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            data-testid="live-region"
          >
            {announcement}
          </div>
        )
      }

      render(
        <>
          <LiveRegion />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Switch language
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByTestId('live-region')).toHaveTextContent('Language changed to Czech')
      })
    })

    it('should maintain focus after language change', async () => {
      render(
        <>
          <TestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Focus on a button
      const loginButton = screen.getByRole('button', { name: 'Sign In' })
      loginButton.focus()
      expect(document.activeElement).toBe(loginButton)

      // Change language
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      // Focus should remain on the same button (now with Czech text)
      await waitFor(() => {
        const czechLoginButton = screen.getByRole('button', { name: 'Přihlásit se' })
        expect(document.activeElement).toBe(czechLoginButton)
      })
    })
  })

  describe('Advanced Integration Scenarios', () => {
    it('should handle nested component translations', async () => {
      const ParentComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <h1>{t('recipes.title')}</h1>
            <ChildComponent />
          </div>
        )
      }

      const ChildComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <p>{t('recipes.ingredients')}</p>
            <GrandchildComponent />
          </div>
        )
      }

      const GrandchildComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return <span>{t('recipes.search')}</span>
      }

      render(
        <>
          <ParentComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // Verify all levels have English translations
      expect(screen.getByText('Recipes')).toBeInTheDocument()
      expect(screen.getByText('Ingredients')).toBeInTheDocument()
      expect(screen.getByText('Search recipes...')).toBeInTheDocument()

      // Switch language and verify all levels update
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(screen.getByText('الوصفات')).toBeInTheDocument()
        expect(screen.getByText('المكونات')).toBeInTheDocument()
        expect(screen.getByText('البحث عن وصفات...')).toBeInTheDocument()
      })
    })

    it('should handle conditional rendering based on language', async () => {
      const ConditionalComponent: React.FC = () => {
        const { t, language } = useTypedTranslation()

        return (
          <div>
            <h1>{t('common.welcome')}</h1>
            {language === 'ar' && (
              <p data-testid="rtl-notice">This content is displayed in RTL mode</p>
            )}
            {language === 'cs' && (
              <p data-testid="czech-notice">Special Czech content</p>
            )}
            {language === 'en' && (
              <p data-testid="english-notice">English-specific content</p>
            )}
          </div>
        )
      }

      render(
        <>
          <ConditionalComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createWrapper(i18nInstance) }
      )

      // English content
      expect(screen.getByTestId('english-notice')).toBeInTheDocument()
      expect(screen.queryByTestId('czech-notice')).not.toBeInTheDocument()
      expect(screen.queryByTestId('rtl-notice')).not.toBeInTheDocument()

      // Switch to Czech
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.queryByTestId('english-notice')).not.toBeInTheDocument()
        expect(screen.getByTestId('czech-notice')).toBeInTheDocument()
        expect(screen.queryByTestId('rtl-notice')).not.toBeInTheDocument()
      })

      // Switch to Arabic
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(screen.queryByTestId('english-notice')).not.toBeInTheDocument()
        expect(screen.queryByTestId('czech-notice')).not.toBeInTheDocument()
        expect(screen.getByTestId('rtl-notice')).toBeInTheDocument()
      })
    })
  })
})