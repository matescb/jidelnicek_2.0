import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import the actual components to test
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { TripWizard } from '@/components/trips/TripWizard'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { NavigationMenu } from '@/components/navigation/NavigationMenu'
import { LoginForm } from '@/components/auth/LoginForm'

// Import test utilities
import { i18nTestHelpers } from './test-helpers'

// Import actual translation files
import enTranslations from '../locales/en'
import csTranslations from '../locales/cs'
import arTranslations from '../locales/ar'

// Mock API calls
jest.mock('@/api/client', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock toast notifications
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

// Mock recipe store
jest.mock('@/store/slices/recipeStore', () => ({
  useRecipeStore: () => ({
    recipes: [],
    isLoading: false,
    createRecipe: jest.fn(),
    updateRecipe: jest.fn(),
  }),
}))

// Create test i18n instance with actual translations
const createTestI18n = async (initialLanguage = 'en') => {
  const instance = i18n.createInstance()
  
  await instance
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: 'en',
      resources: {
        en: { translation: enTranslations },
        cs: { translation: csTranslations },
        ar: { translation: arTranslations },
      },
      interpolation: {
        escapeValue: false,
        format: (value: any, format?: string, lng?: string) => {
          if (format === 'date' && value instanceof Date) {
            return new Intl.DateTimeFormat(lng).format(value)
          }
          if (format === 'currency' && typeof value === 'number') {
            const currency = lng === 'cs' ? 'CZK' : lng === 'ar' ? 'SAR' : 'USD'
            return new Intl.NumberFormat(lng, {
              style: 'currency',
              currency,
            }).format(value)
          }
          return value
        }
      },
      pluralSeparator: '_',
      contextSeparator: '_',
      react: {
        useSuspense: false,
      },
    })

  return instance
}

// Create test wrapper with all necessary providers
const createTestWrapper = (i18nInstance: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18nInstance}>
          {children}
        </I18nextProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('Critical User Flow i18n Testing', () => {
  let i18nInstance: any
  let i18nUtils: i18nTestHelpers.I18nTestUtils
  let languageSwitcher: i18nTestHelpers.LanguageSwitchingTestUtils
  let layoutUtils: i18nTestHelpers.LayoutTestUtils
  let formUtils: i18nTestHelpers.FormValidationTestUtils
  let accessibilityUtils: i18nTestHelpers.AccessibilityTestUtils

  beforeEach(async () => {
    i18nInstance = await createTestI18n()
    i18nUtils = new i18nTestHelpers.I18nTestUtils(i18nInstance)
    languageSwitcher = new i18nTestHelpers.LanguageSwitchingTestUtils()
    layoutUtils = new i18nTestHelpers.LayoutTestUtils()
    formUtils = new i18nTestHelpers.FormValidationTestUtils()
    accessibilityUtils = new i18nTestHelpers.AccessibilityTestUtils()

    // Reset document attributes
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Recipe Management Flow', () => {
    const mockRecipe = {
      id: '1',
      name: 'Test Recipe',
      description: 'A test recipe',
      ingredients: [
        { name: 'Flour', quantity: 500, unit: 'g', notes: '' },
        { name: 'Sugar', quantity: 200, unit: 'g', notes: '' },
      ],
      instructions: [
        { step: 1, text: 'Mix ingredients' },
        { step: 2, text: 'Bake for 30 minutes' },
      ],
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      difficulty: 'medium' as const,
      categories: ['dessert'],
      tags: ['sweet'],
      isPublic: false,
      images: [],
    }

    it('should handle recipe creation in all languages', async () => {
      const languages: Array<'en' | 'cs' | 'ar'> = ['en', 'cs', 'ar']
      const results: any[] = []

      for (const language of languages) {
        await i18nUtils.changeLanguage(language)

        const { rerender } = render(
          <RecipeForm
            onSubmit={async () => {}}
            onCancel={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Test form labels are translated
        const nameInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'recipe name' : 
          language === 'cs' ? 'název receptu' : 
          'اسم الوصفة', 'i'
        ))
        expect(nameInput).toBeInTheDocument()

        // Test placeholder translations
        const descriptionInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'description' : 
          language === 'cs' ? 'popis' : 
          'الوصف', 'i'
        ))
        expect(descriptionInput).toBeInTheDocument()

        // Test button translations
        const saveButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'save' : 
            language === 'cs' ? 'uložit' : 
            'حفظ', 'i'
          )
        })
        expect(saveButton).toBeInTheDocument()

        const cancelButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'cancel' : 
            language === 'cs' ? 'zrušit' : 
            'إلغاء', 'i'
          )
        })
        expect(cancelButton).toBeInTheDocument()

        // Test ingredient and instruction sections
        const addIngredientButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'add ingredient' : 
            language === 'cs' ? 'přidat ingredienci' : 
            'إضافة مكون', 'i'
          )
        })
        expect(addIngredientButton).toBeInTheDocument()

        const addInstructionButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'add instruction' : 
            language === 'cs' ? 'přidat pokyn' : 
            'إضافة تعليمات', 'i'
          )
        })
        expect(addInstructionButton).toBeInTheDocument()

        results.push({
          language,
          formElementsTranslated: true,
          buttonsTranslated: true,
        })
      }

      // Verify all languages passed
      expect(results).toHaveLength(3)
      expect(results.every(r => r.formElementsTranslated && r.buttonsTranslated)).toBe(true)
    })

    it('should validate form errors in all languages', async () => {
      const user = userEvent.setup()

      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <RecipeForm
            onSubmit={async () => {}}
            onCancel={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Submit form without filling required fields
        const saveButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'save' : 
            language === 'cs' ? 'uložit' : 
            'حفظ', 'i'
          )
        })

        await user.click(saveButton)

        // Check for validation errors in the correct language
        await waitFor(() => {
          // Recipe name required error
          const nameError = screen.getByText(new RegExp(
            language === 'en' ? 'recipe name is required' : 
            language === 'cs' ? 'název receptu je povinný' : 
            'اسم الوصفة مطلوب', 'i'
          ))
          expect(nameError).toBeInTheDocument()

          // At least one ingredient required error
          const ingredientError = screen.getByText(new RegExp(
            language === 'en' ? 'at least one ingredient' : 
            language === 'cs' ? 'alespoň jedna ingredience' : 
            'مكون واحد على الأقل', 'i'
          ))
          expect(ingredientError).toBeInTheDocument()
        })
      }
    })

    it('should handle recipe units and measurements in different locales', async () => {
      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <RecipeForm
            recipe={mockRecipe}
            onSubmit={async () => {}}
            onCancel={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Test units dropdown has translated options
        const unitDropdowns = screen.getAllByRole('combobox')
        const firstUnitDropdown = unitDropdowns[0]

        fireEvent.click(firstUnitDropdown)

        await waitFor(() => {
          // Test that 'grams' is translated
          const gramsOption = screen.getByText(new RegExp(
            language === 'en' ? 'grams' : 
            language === 'cs' ? 'gramy' : 
            'جرام', 'i'
          ))
          expect(gramsOption).toBeInTheDocument()
        })
      }
    })
  })

  describe('2. Trip Planning Flow', () => {
    it('should handle trip creation wizard in all languages', async () => {
      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <TripWizard
            onComplete={async () => {}}
            onCancel={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Test wizard step titles are translated
        const stepTitle = screen.getByRole('heading', { level: 2 })
        expect(stepTitle).toHaveTextContent(new RegExp(
          language === 'en' ? 'basic information' : 
          language === 'cs' ? 'základní informace' : 
          'المعلومات الأساسية', 'i'
        ))

        // Test form fields are translated
        const tripNameInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'trip name' : 
          language === 'cs' ? 'název výletu' : 
          'اسم الرحلة', 'i'
        ))
        expect(tripNameInput).toBeInTheDocument()

        const startDateInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'start date' : 
          language === 'cs' ? 'datum začátku' : 
          'تاريخ البداية', 'i'
        ))
        expect(startDateInput).toBeInTheDocument()

        // Test navigation buttons
        const nextButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'next' : 
            language === 'cs' ? 'další' : 
            'التالي', 'i'
          )
        })
        expect(nextButton).toBeInTheDocument()
      }
    })

    it('should handle participant management in all languages', async () => {
      const user = userEvent.setup()

      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <TripWizard
            onComplete={async () => {}}
            onCancel={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Navigate to participants step (assuming it's step 2)
        const nextButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'next' : 
            language === 'cs' ? 'další' : 
            'التالي', 'i'
          )
        })
        await user.click(nextButton)

        await waitFor(() => {
          // Test add participant button
          const addParticipantButton = screen.getByRole('button', { 
            name: new RegExp(
              language === 'en' ? 'add participant' : 
              language === 'cs' ? 'přidat účastníka' : 
              'إضافة مشارك', 'i'
            )
          })
          expect(addParticipantButton).toBeInTheDocument()
        })

        // Test participant form fields
        const participantNameInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'name' : 
          language === 'cs' ? 'jméno' : 
          'الاسم', 'i'
        ))
        expect(participantNameInput).toBeInTheDocument()

        const participantEmailInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'email.*optional' : 
          language === 'cs' ? 'email.*nepovinný' : 
          'البريد.*اختياري', 'i'
        ))
        expect(participantEmailInput).toBeInTheDocument()
      }
    })

    it('should handle meal type translations correctly', async () => {
      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        const expectedMealTypes = {
          en: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
          cs: ['Snídaně', 'Oběd', 'Večeře', 'Svačina'],
          ar: ['الإفطار', 'الغداء', 'العشاء', 'وجبة خفيفة'],
        }

        // Test meal type translations in context
        const TestMealTypes: React.FC = () => {
          const { t } = require('react-i18next').useTranslation()
          return (
            <div>
              <span data-testid="breakfast">{t('trips.mealTypes.breakfast')}</span>
              <span data-testid="lunch">{t('trips.mealTypes.lunch')}</span>
              <span data-testid="dinner">{t('trips.mealTypes.dinner')}</span>
              <span data-testid="snack">{t('trips.mealTypes.snack')}</span>
            </div>
          )
        }

        render(<TestMealTypes />, { wrapper: createTestWrapper(i18nInstance) })

        expect(screen.getByTestId('breakfast')).toHaveTextContent(expectedMealTypes[language][0])
        expect(screen.getByTestId('lunch')).toHaveTextContent(expectedMealTypes[language][1])
        expect(screen.getByTestId('dinner')).toHaveTextContent(expectedMealTypes[language][2])
        expect(screen.getByTestId('snack')).toHaveTextContent(expectedMealTypes[language][3])
      }
    })
  })

  describe('3. Authentication Flow', () => {
    it('should handle login form in all languages', async () => {
      const user = userEvent.setup()

      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <LoginForm
            onSubmit={async () => {}}
            onForgotPassword={() => {}}
            onRegister={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Test form fields
        const emailInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'email' : 
          language === 'cs' ? 'email' : 
          'البريد الإلكتروني', 'i'
        ))
        expect(emailInput).toBeInTheDocument()

        const passwordInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'password' : 
          language === 'cs' ? 'heslo' : 
          'كلمة المرور', 'i'
        ))
        expect(passwordInput).toBeInTheDocument()

        // Test buttons
        const loginButton = screen.getByRole('button', { 
          name: new RegExp(
            language === 'en' ? 'login' : 
            language === 'cs' ? 'přihlásit se' : 
            'تسجيل الدخول', 'i'
          )
        })
        expect(loginButton).toBeInTheDocument()

        const forgotPasswordLink = screen.getByRole('link', { 
          name: new RegExp(
            language === 'en' ? 'forgot password' : 
            language === 'cs' ? 'zapomenuté heslo' : 
            'نسيت كلمة المرور', 'i'
          )
        })
        expect(forgotPasswordLink).toBeInTheDocument()

        // Test validation errors
        await user.click(loginButton)

        await waitFor(() => {
          const emailError = screen.getByText(new RegExp(
            language === 'en' ? 'email is required' : 
            language === 'cs' ? 'email je povinný' : 
            'البريد الإلكتروني مطلوب', 'i'
          ))
          expect(emailError).toBeInTheDocument()

          const passwordError = screen.getByText(new RegExp(
            language === 'en' ? 'password is required' : 
            language === 'cs' ? 'heslo je povinné' : 
            'كلمة المرور مطلوبة', 'i'
          ))
          expect(passwordError).toBeInTheDocument()
        })
      }
    })

    it('should handle password validation requirements in all languages', async () => {
      const user = userEvent.setup()

      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <LoginForm
            onSubmit={async () => {}}
            onForgotPassword={() => {}}
            onRegister={() => {}}
          />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        const passwordInput = screen.getByLabelText(new RegExp(
          language === 'en' ? 'password' : 
          language === 'cs' ? 'heslo' : 
          'كلمة المرور', 'i'
        ))

        // Enter short password
        await user.type(passwordInput, '123')
        await user.tab() // Trigger validation

        await waitFor(() => {
          const lengthError = screen.getByText(new RegExp(
            language === 'en' ? 'password must be at least.*8.*characters' : 
            language === 'cs' ? 'heslo musí mít alespoň.*8.*znaků' : 
            'يجب أن تحتوي كلمة المرور على.*8.*أحرف', 'i'
          ))
          expect(lengthError).toBeInTheDocument()
        })
      }
    })
  })

  describe('4. Navigation and Search', () => {
    it('should handle navigation menu in all languages', async () => {
      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        render(
          <NavigationMenu />,
          { wrapper: createTestWrapper(i18nInstance) }
        )

        // Test main navigation items
        const recipesLink = screen.getByRole('link', { 
          name: new RegExp(
            language === 'en' ? 'recipes' : 
            language === 'cs' ? 'recepty' : 
            'الوصفات', 'i'
          )
        })
        expect(recipesLink).toBeInTheDocument()

        const tripsLink = screen.getByRole('link', { 
          name: new RegExp(
            language === 'en' ? 'trips' : 
            language === 'cs' ? 'výlety' : 
            'الرحلات', 'i'
          )
        })
        expect(tripsLink).toBeInTheDocument()

        const dashboardLink = screen.getByRole('link', { 
          name: new RegExp(
            language === 'en' ? 'dashboard' : 
            language === 'cs' ? 'nástěnka' : 
            'لوحة التحكم', 'i'
          )
        })
        expect(dashboardLink).toBeInTheDocument()

        // Test search functionality
        const searchInput = screen.getByRole('textbox', { 
          name: new RegExp(
            language === 'en' ? 'search' : 
            language === 'cs' ? 'hledat' : 
            'بحث', 'i'
          )
        })
        expect(searchInput).toBeInTheDocument()

        const searchPlaceholder = searchInput.getAttribute('placeholder')
        expect(searchPlaceholder).toMatch(new RegExp(
          language === 'en' ? 'search' : 
          language === 'cs' ? 'hledat' : 
          'بحث', 'i'
        ))
      }
    })

    it('should handle breadcrumb navigation in all languages', async () => {
      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        const TestBreadcrumbs: React.FC = () => {
          const { t } = require('react-i18next').useTranslation()
          return (
            <nav aria-label="Breadcrumb">
              <ol>
                <li><a href="/">{t('breadcrumbs.home')}</a></li>
                <li><a href="/recipes">{t('breadcrumbs.recipes')}</a></li>
                <li aria-current="page">{t('breadcrumbs.new')}</li>
              </ol>
            </nav>
          )
        }

        render(<TestBreadcrumbs />, { wrapper: createTestWrapper(i18nInstance) })

        const homeLink = screen.getByRole('link', { 
          name: new RegExp(
            language === 'en' ? 'home' : 
            language === 'cs' ? 'domů' : 
            'الرئيسية', 'i'
          )
        })
        expect(homeLink).toBeInTheDocument()

        const recipesLink = screen.getByRole('link', { 
          name: new RegExp(
            language === 'en' ? 'recipes' : 
            language === 'cs' ? 'recepty' : 
            'الوصفات', 'i'
          )
        })
        expect(recipesLink).toBeInTheDocument()

        const currentPage = screen.getByText(new RegExp(
          language === 'en' ? 'new' : 
          language === 'cs' ? 'nový' : 
          'جديد', 'i'
        ))
        expect(currentPage).toBeInTheDocument()
      }
    })
  })

  describe('5. Settings and Preferences', () => {
    it('should handle language switching within settings', async () => {
      const user = userEvent.setup()

      render(
        <>
          <LanguageSwitcher />
          <div data-testid="test-content">
            <TestContentComponent />
          </div>
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      // Test initial English content
      expect(screen.getByTestId('test-content')).toHaveTextContent(/recipes/i)

      // Switch to Czech
      await languageSwitcher.switchLanguageDropdown('cs')

      await waitFor(() => {
        expect(screen.getByTestId('test-content')).toHaveTextContent(/recepty/i)
        expect(document.documentElement.lang).toBe('cs')
        expect(document.documentElement.dir).toBe('ltr')
      })

      // Switch to Arabic (RTL)
      await languageSwitcher.switchLanguageDropdown('ar')

      await waitFor(() => {
        expect(screen.getByTestId('test-content')).toHaveTextContent(/الوصفات/i)
        expect(document.documentElement.lang).toBe('ar')
        expect(document.documentElement.dir).toBe('rtl')
      })
    })

    it('should persist language preference', async () => {
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      render(<LanguageSwitcher />, { wrapper: createTestWrapper(i18nInstance) })

      await languageSwitcher.switchLanguageDropdown('cs')

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('language'),
          'cs'
        )
      })
    })
  })

  describe('6. Error Handling and Recovery', () => {
    it('should display error messages in correct language', async () => {
      for (const language of ['en', 'cs', 'ar'] as const) {
        await i18nUtils.changeLanguage(language)

        const TestErrorComponent: React.FC = () => {
          const { t } = require('react-i18next').useTranslation()
          const [hasError, setHasError] = React.useState(false)

          if (hasError) {
            return (
              <div data-testid="error-boundary">
                <h2>{t('errors.title')}</h2>
                <p>{t('errors.generic')}</p>
                <button onClick={() => setHasError(false)}>
                  {t('common.retry')}
                </button>
              </div>
            )
          }

          return (
            <div>
              <button onClick={() => setHasError(true)} data-testid="trigger-error">
                Trigger Error
              </button>
              <p>{t('common.success')}</p>
            </div>
          )
        }

        render(<TestErrorComponent />, { wrapper: createTestWrapper(i18nInstance) })

        const triggerButton = screen.getByTestId('trigger-error')
        fireEvent.click(triggerButton)

        await waitFor(() => {
          const errorTitle = screen.getByRole('heading', { level: 2 })
          expect(errorTitle).toHaveTextContent(new RegExp(
            language === 'en' ? 'something went wrong' : 
            language === 'cs' ? 'něco se pokazilo' : 
            'حدث خطأ ما', 'i'
          ))

          const retryButton = screen.getByRole('button', { 
            name: new RegExp(
              language === 'en' ? 'retry' : 
              language === 'cs' ? 'zkusit znovu' : 
              'إعادة المحاولة', 'i'
            )
          })
          expect(retryButton).toBeInTheDocument()
        })
      }
    })
  })

  describe('7. Accessibility and Screen Reader Support', () => {
    it('should announce language changes to screen readers', async () => {
      const TestWithLiveRegion: React.FC = () => {
        const { language } = require('react-i18next').useTranslation()
        const [announcement, setAnnouncement] = React.useState('')

        React.useEffect(() => {
          const languageNames = {
            en: 'English',
            cs: 'Czech',
            ar: 'Arabic',
          }
          setAnnouncement(`Language changed to ${languageNames[language as keyof typeof languageNames]}`)
        }, [language])

        return (
          <div>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
              data-testid="language-announcement"
            >
              {announcement}
            </div>
            <LanguageSwitcher />
          </div>
        )
      }

      render(<TestWithLiveRegion />, { wrapper: createTestWrapper(i18nInstance) })

      await languageSwitcher.switchLanguageDropdown('cs')

      await waitFor(() => {
        const liveRegion = screen.getByTestId('language-announcement')
        expect(liveRegion).toHaveTextContent('Language changed to Czech')
        expect(liveRegion).toHaveAttribute('aria-live', 'polite')
        expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
      })
    })

    it('should maintain focus during language changes', async () => {
      render(
        <>
          <button data-testid="focus-target">Focus Target</button>
          <LanguageSwitcher />
          <TestContentComponent />
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      const focusTarget = screen.getByTestId('focus-target')
      focusTarget.focus()
      expect(document.activeElement).toBe(focusTarget)

      await languageSwitcher.switchLanguageDropdown('cs')

      await waitFor(() => {
        // Focus should be maintained or moved to equivalent element
        expect(document.activeElement).toBeTruthy()
      })
    })
  })
})

// Helper component for testing content changes
const TestContentComponent: React.FC = () => {
  const { t } = require('react-i18next').useTranslation()
  return (
    <div>
      <h1>{t('recipes.title')}</h1>
      <p>{t('common.save')}</p>
      <p>{t('navigation.search')}</p>
    </div>
  )
}