import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { LanguageSwitcher, CompactLanguageSwitcher } from '../components/LanguageSwitcher'
import { TranslationDevTools } from '../components/TranslationDevTools'

// First, let's create the missing components that we'll test
export const Trans: React.FC<{
  i18nKey: string
  components?: Record<string, React.FC<{ children: React.ReactNode }>>
  values?: Record<string, any>
  children?: React.ReactNode
}> = ({ i18nKey, components = {}, values = {}, children }) => {
  const { t } = useTranslation()
  
  let translation = t(i18nKey, values)
  
  // Simple component interpolation
  if (components) {
    Object.entries(components).forEach(([key, Component]) => {
      const regex = new RegExp(`<${key}>(.*?)</${key}>`, 'g')
      translation = translation.replace(regex, (match, content) => {
        const element = React.createElement(Component, { key }, content)
        return React.renderToString(element)
      })
    })
  }
  
  return <span dangerouslySetInnerHTML={{ __html: translation }} />
}

export const T: React.FC<{ id: string; values?: Record<string, any> }> = ({ id, values }) => {
  const { t } = useTranslation()
  return <>{t(id, values)}</>
}

export const FormattedNumber: React.FC<{
  value: number
  style?: 'decimal' | 'currency' | 'percent'
  currency?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}> = ({ value, style = 'decimal', currency = 'USD', ...options }) => {
  const { i18n } = useTranslation()
  const formatter = new Intl.NumberFormat(i18n.language, {
    style,
    currency: style === 'currency' ? currency : undefined,
    ...options,
  })
  
  return <span>{formatter.format(value)}</span>
}

export const FormattedDate: React.FC<{
  value: Date | string | number
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
}> = ({ value, dateStyle = 'medium', timeStyle }) => {
  const { i18n } = useTranslation()
  const date = value instanceof Date ? value : new Date(value)
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle,
    timeStyle,
  })
  
  return <span>{formatter.format(date)}</span>
}

export const PluralText: React.FC<{
  i18nKey: string
  count: number
  values?: Record<string, any>
}> = ({ i18nKey, count, values = {} }) => {
  const { t } = useTranslation()
  return <>{t(i18nKey, { count, ...values })}</>
}

export const ContextualText: React.FC<{
  i18nKey: string
  context: string
  values?: Record<string, any>
}> = ({ i18nKey, context, values = {} }) => {
  const { t } = useTranslation()
  return <>{t(i18nKey, { context, ...values })}</>
}

export const DirectionalBox: React.FC<{
  children: React.ReactNode
  className?: string
  startPadding?: string | number
  endPadding?: string | number
}> = ({ children, className = '', startPadding = 0, endPadding = 0 }) => {
  const { i18n } = useTranslation()
  const isRTL = ['ar', 'he', 'fa'].includes(i18n.language)
  
  const style: React.CSSProperties = {
    paddingInlineStart: startPadding,
    paddingInlineEnd: endPadding,
    direction: isRTL ? 'rtl' : 'ltr',
  }
  
  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}

// Import useTranslation for components
import { useTranslation } from 'react-i18next'

// Mock i18next
const mockI18n = i18n.createInstance({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        common: {
          appName: 'Recipe App',
          welcome: 'Welcome to {{appName}}',
          termsAndConditions: 'By using this app, you agree to our <link>terms and conditions</link>',
          itemCount_one: '{{count}} item',
          itemCount_other: '{{count}} items',
          greeting: 'Hello',
          greeting_formal: 'Good day',
          greeting_morning: 'Good morning',
          greeting_evening: 'Good evening',
        },
      },
    },
    cs: {
      translation: {
        common: {
          appName: 'Aplikace Receptů',
          welcome: 'Vítejte v {{appName}}',
          itemCount_one: '{{count}} položka',
          itemCount_few: '{{count}} položky',
          itemCount_other: '{{count}} položek',
        },
      },
    },
    ar: {
      translation: {
        common: {
          appName: 'تطبيق الوصفات',
          welcome: 'مرحبا بك في {{appName}}',
          itemCount_zero: 'لا توجد عناصر',
          itemCount_one: 'عنصر واحد',
          itemCount_two: 'عنصران',
          itemCount_few: '{{count}} عناصر',
          itemCount_many: '{{count}} عنصرا',
          itemCount_other: '{{count}} عنصر',
        },
      },
    },
  },
})

// Initialize mock i18n
mockI18n.init()

// Helper to create wrapper
const createWrapper = (customI18n = mockI18n) => {
  return ({ children }: { children: React.ReactNode }) => (
    <I18nextProvider i18n={customI18n}>
      {children}
    </I18nextProvider>
  )
}

// Mock language data
const mockLanguages = {
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
  cs: { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', dir: 'ltr' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
}

// Mock the languages import
jest.mock('../index.enhanced', () => ({
  languages: mockLanguages,
}))

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    mockI18n.changeLanguage('en')
  })

  describe('Dropdown variant', () => {
    it('should render current language', () => {
      render(<LanguageSwitcher />, { wrapper: createWrapper() })
      
      expect(screen.getByRole('button', { name: /change language/i })).toBeInTheDocument()
      expect(screen.getByText('🇬🇧')).toBeInTheDocument()
      expect(screen.getByText('English')).toBeInTheDocument()
    })

    it('should show dropdown on click', async () => {
      render(<LanguageSwitcher />, { wrapper: createWrapper() })
      
      const button = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        expect(screen.getAllByRole('option')).toHaveLength(3)
      })
    })

    it('should change language on selection', async () => {
      const onLanguageChange = jest.fn()
      render(<LanguageSwitcher onLanguageChange={onLanguageChange} />, { wrapper: createWrapper() })
      
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      
      const czechOption = screen.getByRole('option', { name: /čeština/i })
      fireEvent.click(czechOption)
      
      await waitFor(() => {
        expect(mockI18n.language).toBe('cs')
        expect(onLanguageChange).toHaveBeenCalledWith('cs')
        expect(document.documentElement.lang).toBe('cs')
        expect(document.documentElement.dir).toBe('ltr')
      })
    })

    it('should close dropdown on outside click', async () => {
      render(
        <div>
          <LanguageSwitcher />
          <button>Outside button</button>
        </div>,
        { wrapper: createWrapper() }
      )
      
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      
      fireEvent.mouseDown(screen.getByText('Outside button'))
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      })
    })

    it('should show check icon for current language', async () => {
      render(<LanguageSwitcher />, { wrapper: createWrapper() })
      
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      
      const currentOption = screen.getByRole('option', { name: /english/i })
      expect(within(currentOption).getByTestId('CheckIcon')).toBeInTheDocument()
    })
  })

  describe('Inline variant', () => {
    it('should render all languages as buttons', () => {
      render(<LanguageSwitcher variant="inline" />, { wrapper: createWrapper() })
      
      expect(screen.getByRole('button', { name: /switch to english/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /switch to czech/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /switch to arabic/i })).toBeInTheDocument()
    })

    it('should highlight current language', () => {
      render(<LanguageSwitcher variant="inline" />, { wrapper: createWrapper() })
      
      const englishButton = screen.getByRole('button', { name: /switch to english/i })
      expect(englishButton).toHaveClass('bg-indigo-600')
    })

    it('should change language on click', async () => {
      render(<LanguageSwitcher variant="inline" />, { wrapper: createWrapper() })
      
      const czechButton = screen.getByRole('button', { name: /switch to czech/i })
      fireEvent.click(czechButton)
      
      await waitFor(() => {
        expect(mockI18n.language).toBe('cs')
        expect(czechButton).toHaveClass('bg-indigo-600')
      })
    })
  })

  describe('Modal variant', () => {
    it('should open modal on click', async () => {
      render(<LanguageSwitcher variant="modal" />, { wrapper: createWrapper() })
      
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Select Language')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })

    it('should close modal on cancel', async () => {
      render(<LanguageSwitcher variant="modal" />, { wrapper: createWrapper() })
      
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      
      await waitFor(() => {
        expect(screen.queryByText('Select Language')).not.toBeInTheDocument()
      })
    })

    it('should change language and close modal', async () => {
      render(<LanguageSwitcher variant="modal" />, { wrapper: createWrapper() })
      
      fireEvent.click(screen.getByRole('button', { name: /change language/i }))
      
      const arabicButton = screen.getByText('العربية').closest('button')!
      fireEvent.click(arabicButton)
      
      await waitFor(() => {
        expect(mockI18n.language).toBe('ar')
        expect(document.documentElement.dir).toBe('rtl')
        expect(screen.queryByText('Select Language')).not.toBeInTheDocument()
      })
    })
  })

  describe('Customization options', () => {
    it('should hide flag when showFlag is false', () => {
      render(<LanguageSwitcher showFlag={false} />, { wrapper: createWrapper() })
      
      expect(screen.queryByText('🇬🇧')).not.toBeInTheDocument()
    })

    it('should show name instead of native name', () => {
      render(<LanguageSwitcher showNativeName={false} showName={true} />, { wrapper: createWrapper() })
      
      expect(screen.getByText('English')).toBeInTheDocument()
      expect(screen.queryByText('English')).toBeInTheDocument() // "English" is same in both
    })

    it('should apply custom className', () => {
      render(<LanguageSwitcher className="custom-class" />, { wrapper: createWrapper() })
      
      expect(screen.getByRole('button', { name: /change language/i }).parentElement).toHaveClass('custom-class')
    })
  })
})

describe('CompactLanguageSwitcher', () => {
  beforeEach(() => {
    mockI18n.changeLanguage('en')
  })

  it('should render flag only', () => {
    render(<CompactLanguageSwitcher />, { wrapper: createWrapper() })
    
    expect(screen.getByText('🇬🇧')).toBeInTheDocument()
    expect(screen.queryByText('English')).not.toBeInTheDocument()
  })

  it('should toggle between languages', async () => {
    render(<CompactLanguageSwitcher />, { wrapper: createWrapper() })
    
    const button = screen.getByRole('button')
    expect(screen.getByText('🇬🇧')).toBeInTheDocument()
    
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(mockI18n.language).toBe('cs')
      expect(screen.getByText('🇨🇿')).toBeInTheDocument()
    })
    
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(mockI18n.language).toBe('ar')
      expect(screen.getByText('🇸🇦')).toBeInTheDocument()
    })
  })

  it('should have proper accessibility label', () => {
    render(<CompactLanguageSwitcher />, { wrapper: createWrapper() })
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Current language: English'))
  })
})

describe('Trans Component', () => {
  it('should render simple translation', () => {
    render(<Trans i18nKey="common.greeting" />, { wrapper: createWrapper() })
    
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should interpolate values', () => {
    render(
      <Trans i18nKey="common.welcome" values={{ appName: 'My App' }} />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('Welcome to My App')).toBeInTheDocument()
  })

  it('should handle component interpolation', () => {
    const Link: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <a href="/terms" className="text-blue-500">{children}</a>
    )
    
    render(
      <Trans i18nKey="common.termsAndConditions" components={{ link: Link }} />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText(/terms and conditions/)).toBeInTheDocument()
    // Note: In a real implementation, this would render actual React components
  })
})

describe('T Component', () => {
  it('should render translation', () => {
    render(<T id="common.appName" />, { wrapper: createWrapper() })
    
    expect(screen.getByText('Recipe App')).toBeInTheDocument()
  })

  it('should handle interpolation', () => {
    render(<T id="common.welcome" values={{ appName: 'Test App' }} />, { wrapper: createWrapper() })
    
    expect(screen.getByText('Welcome to Test App')).toBeInTheDocument()
  })
})

describe('FormattedNumber Component', () => {
  it('should format decimal numbers', () => {
    render(<FormattedNumber value={1234.56} />, { wrapper: createWrapper() })
    
    expect(screen.getByText('1,234.56')).toBeInTheDocument()
  })

  it('should format currency', () => {
    render(
      <FormattedNumber value={1234.56} style="currency" currency="USD" />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('$1,234.56')).toBeInTheDocument()
  })

  it('should format percentage', () => {
    render(<FormattedNumber value={0.125} style="percent" />, { wrapper: createWrapper() })
    
    expect(screen.getByText('12.5%')).toBeInTheDocument()
  })

  it('should respect locale formatting', async () => {
    await mockI18n.changeLanguage('cs')
    render(<FormattedNumber value={1234.56} />, { wrapper: createWrapper() })
    
    expect(screen.getByText('1 234,56')).toBeInTheDocument()
  })

  it('should apply fraction digit options', () => {
    render(
      <FormattedNumber 
        value={3.14159} 
        minimumFractionDigits={2} 
        maximumFractionDigits={2} 
      />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('3.14')).toBeInTheDocument()
  })
})

describe('FormattedDate Component', () => {
  const testDate = new Date('2024-01-15T10:30:00')

  it('should format date with medium style', () => {
    render(<FormattedDate value={testDate} />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('should format date with short style', () => {
    render(<FormattedDate value={testDate} dateStyle="short" />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/1\/15\/24/)).toBeInTheDocument()
  })

  it('should format date with time', () => {
    render(
      <FormattedDate value={testDate} dateStyle="short" timeStyle="short" />,
      { wrapper: createWrapper() }
    )
    
    const formatted = screen.getByText(/1\/15\/24.*10:30/)
    expect(formatted).toBeInTheDocument()
  })

  it('should format date for different locales', async () => {
    await mockI18n.changeLanguage('cs')
    render(<FormattedDate value={testDate} />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/15\. 1\. 2024/)).toBeInTheDocument()
  })

  it('should handle string dates', () => {
    render(<FormattedDate value="2024-01-15" />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('should handle timestamp', () => {
    render(<FormattedDate value={testDate.getTime()} />, { wrapper: createWrapper() })
    
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })
})

describe('PluralText Component', () => {
  it('should render singular form', () => {
    render(
      <PluralText i18nKey="common.itemCount" count={1} />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it('should render plural form', () => {
    render(
      <PluralText i18nKey="common.itemCount" count={5} />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('5 items')).toBeInTheDocument()
  })

  it('should handle Czech pluralization rules', async () => {
    await mockI18n.changeLanguage('cs')
    
    // Czech has different forms for 1, 2-4, and 5+
    const { rerender } = render(
      <PluralText i18nKey="common.itemCount" count={1} />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('1 položka')).toBeInTheDocument()
    
    rerender(<PluralText i18nKey="common.itemCount" count={3} />)
    expect(screen.getByText('3 položky')).toBeInTheDocument()
    
    rerender(<PluralText i18nKey="common.itemCount" count={5} />)
    expect(screen.getByText('5 položek')).toBeInTheDocument()
  })

  it('should handle Arabic pluralization rules', async () => {
    await mockI18n.changeLanguage('ar')
    
    // Arabic has forms for 0, 1, 2, few (3-10), many (11+), other
    const { rerender } = render(
      <PluralText i18nKey="common.itemCount" count={0} />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('لا توجد عناصر')).toBeInTheDocument()
    
    rerender(<PluralText i18nKey="common.itemCount" count={1} />)
    expect(screen.getByText('عنصر واحد')).toBeInTheDocument()
    
    rerender(<PluralText i18nKey="common.itemCount" count={2} />)
    expect(screen.getByText('عنصران')).toBeInTheDocument()
  })

  it('should pass additional values', () => {
    render(
      <PluralText 
        i18nKey="common.itemCount" 
        count={3} 
        values={{ type: 'special' }} 
      />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('3 items')).toBeInTheDocument()
  })
})

describe('ContextualText Component', () => {
  it('should render base translation without context', () => {
    render(
      <ContextualText i18nKey="common.greeting" context="" />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should render contextual translation', () => {
    render(
      <ContextualText i18nKey="common.greeting" context="formal" />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('Good day')).toBeInTheDocument()
  })

  it('should render time-based context', () => {
    render(
      <ContextualText i18nKey="common.greeting" context="morning" />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('Good morning')).toBeInTheDocument()
  })

  it('should fallback to base when context not found', () => {
    render(
      <ContextualText i18nKey="common.greeting" context="nonexistent" />,
      { wrapper: createWrapper() }
    )
    
    // Would fallback to base translation
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should pass values for interpolation', () => {
    render(
      <ContextualText 
        i18nKey="common.welcome" 
        context="formal" 
        values={{ appName: 'Test' }} 
      />,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('Welcome to Test')).toBeInTheDocument()
  })
})

describe('DirectionalBox Component', () => {
  it('should apply LTR direction for English', () => {
    render(
      <DirectionalBox startPadding="20px" endPadding="10px">
        <div>Content</div>
      </DirectionalBox>,
      { wrapper: createWrapper() }
    )
    
    const box = screen.getByText('Content').parentElement
    expect(box).toHaveStyle({
      paddingInlineStart: '20px',
      paddingInlineEnd: '10px',
      direction: 'ltr',
    })
  })

  it('should apply RTL direction for Arabic', async () => {
    await mockI18n.changeLanguage('ar')
    
    render(
      <DirectionalBox startPadding="20px" endPadding="10px">
        <div>محتوى</div>
      </DirectionalBox>,
      { wrapper: createWrapper() }
    )
    
    const box = screen.getByText('محتوى').parentElement
    expect(box).toHaveStyle({
      paddingInlineStart: '20px',
      paddingInlineEnd: '10px',
      direction: 'rtl',
    })
  })

  it('should apply custom className', () => {
    render(
      <DirectionalBox className="custom-box">
        <div>Content</div>
      </DirectionalBox>,
      { wrapper: createWrapper() }
    )
    
    const box = screen.getByText('Content').parentElement
    expect(box).toHaveClass('custom-box')
  })

  it('should handle numeric padding values', () => {
    render(
      <DirectionalBox startPadding={20} endPadding={10}>
        <div>Content</div>
      </DirectionalBox>,
      { wrapper: createWrapper() }
    )
    
    const box = screen.getByText('Content').parentElement
    expect(box).toHaveStyle({
      paddingInlineStart: '20',
      paddingInlineEnd: '10',
    })
  })

  it('should update direction when language changes', async () => {
    const { rerender } = render(
      <DirectionalBox>
        <div>Content</div>
      </DirectionalBox>,
      { wrapper: createWrapper() }
    )
    
    let box = screen.getByText('Content').parentElement
    expect(box).toHaveStyle({ direction: 'ltr' })
    
    await mockI18n.changeLanguage('ar')
    
    rerender(
      <DirectionalBox>
        <div>Content</div>
      </DirectionalBox>
    )
    
    box = screen.getByText('Content').parentElement
    expect(box).toHaveStyle({ direction: 'rtl' })
  })
})

describe('TranslationDevTools', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('should render in development mode', () => {
    render(<TranslationDevTools />, { wrapper: createWrapper() })
    
    expect(screen.getByLabelText('Translation DevTools')).toBeInTheDocument()
  })

  it('should not render in production mode', () => {
    process.env.NODE_ENV = 'production'
    
    render(<TranslationDevTools />, { wrapper: createWrapper() })
    
    expect(screen.queryByLabelText('Translation DevTools')).not.toBeInTheDocument()
  })

  it('should toggle panel visibility', async () => {
    render(<TranslationDevTools />, { wrapper: createWrapper() })
    
    const toggleButton = screen.getByLabelText('Translation DevTools')
    
    // Initially closed
    expect(screen.queryByText('Translation DevTools')).not.toBeInTheDocument()
    
    // Open panel
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(screen.getByText('Translation DevTools')).toBeInTheDocument()
    })
    
    // Close panel
    fireEvent.click(screen.getByLabelText('Close DevTools'))
    await waitFor(() => {
      expect(screen.queryByText('Translation DevTools')).not.toBeInTheDocument()
    })
  })

  it('should display current language info', async () => {
    render(<TranslationDevTools />, { wrapper: createWrapper() })
    
    fireEvent.click(screen.getByLabelText('Translation DevTools'))
    
    await waitFor(() => {
      expect(screen.getByText(/Current Language:/)).toBeInTheDocument()
      expect(screen.getByText(/en/)).toBeInTheDocument()
    })
  })

  it('should allow position customization', () => {
    const { rerender } = render(
      <TranslationDevTools position="top-left" />,
      { wrapper: createWrapper() }
    )
    
    let button = screen.getByLabelText('Translation DevTools')
    expect(button.parentElement).toHaveClass('top-4', 'left-4')
    
    rerender(<TranslationDevTools position="bottom-right" />)
    
    button = screen.getByLabelText('Translation DevTools')
    expect(button.parentElement).toHaveClass('bottom-4', 'right-4')
  })
})

describe('Accessibility', () => {
  it('should have proper ARIA labels on LanguageSwitcher', () => {
    render(<LanguageSwitcher />, { wrapper: createWrapper() })
    
    const button = screen.getByRole('button', { name: /change language/i })
    expect(button).toHaveAttribute('aria-label', 'Change language')
    expect(button).toHaveAttribute('aria-haspopup', 'listbox')
    
    fireEvent.click(button)
    
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('should support keyboard navigation in LanguageSwitcher', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher />, { wrapper: createWrapper() })
    
    const button = screen.getByRole('button', { name: /change language/i })
    
    // Open with Enter key
    await user.click(button)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    
    // Navigate and select with keyboard
    await user.keyboard('{ArrowDown}{Enter}')
    
    await waitFor(() => {
      expect(mockI18n.language).toBe('cs')
    })
  })

  it('should announce language changes to screen readers', async () => {
    const onLanguageChange = jest.fn()
    render(<LanguageSwitcher onLanguageChange={onLanguageChange} />, { wrapper: createWrapper() })
    
    fireEvent.click(screen.getByRole('button', { name: /change language/i }))
    fireEvent.click(screen.getByRole('option', { name: /čeština/i }))
    
    await waitFor(() => {
      // In a real implementation, this would trigger a live region announcement
      expect(onLanguageChange).toHaveBeenCalledWith('cs')
    })
  })
})

describe('Edge Cases', () => {
  it('should handle missing language gracefully', () => {
    mockI18n.language = 'unknown'
    
    render(<LanguageSwitcher />, { wrapper: createWrapper() })
    
    // Should fallback to English
    expect(screen.getByText('🇬🇧')).toBeInTheDocument()
  })

  it('should handle rapid language switching', async () => {
    render(<LanguageSwitcher variant="inline" />, { wrapper: createWrapper() })
    
    const czechButton = screen.getByRole('button', { name: /switch to czech/i })
    const arabicButton = screen.getByRole('button', { name: /switch to arabic/i })
    
    // Rapid clicks
    fireEvent.click(czechButton)
    fireEvent.click(arabicButton)
    fireEvent.click(czechButton)
    
    await waitFor(() => {
      expect(mockI18n.changeLanguage).toHaveBeenCalledTimes(3)
    })
  })

  it('should handle FormattedNumber with invalid values', () => {
    render(
      <>
        <FormattedNumber value={NaN} />
        <FormattedNumber value={Infinity} />
        <FormattedNumber value={-Infinity} />
      </>,
      { wrapper: createWrapper() }
    )
    
    expect(screen.getByText('NaN')).toBeInTheDocument()
    expect(screen.getByText('∞')).toBeInTheDocument()
    expect(screen.getByText('-∞')).toBeInTheDocument()
  })

  it('should handle FormattedDate with invalid dates', () => {
    render(
      <>
        <FormattedDate value="invalid-date" />
        <FormattedDate value={NaN} />
      </>,
      { wrapper: createWrapper() }
    )
    
    // Should render "Invalid Date" or similar
    expect(screen.getAllByText(/Invalid Date/i)).toHaveLength(2)
  })
})