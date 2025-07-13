import { ReactWrapper } from 'enzyme'
import { RenderResult, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'

// Helper types
export type LanguageCode = 'en' | 'cs' | 'ar'
export type TestTranslations = Record<string, any>

/**
 * Test utilities for i18n testing
 */
export class I18nTestUtils {
  private i18nInstance: any

  constructor(i18nInstance: any) {
    this.i18nInstance = i18nInstance
  }

  /**
   * Change language and wait for translations to update
   */
  async changeLanguage(language: LanguageCode): Promise<void> {
    await this.i18nInstance.changeLanguage(language)
    // Wait for React components to re-render
    await waitFor(() => {
      expect(this.i18nInstance.language).toBe(language)
    })
  }

  /**
   * Test if all required translation keys exist for a language
   */
  checkTranslationKeys(
    requiredKeys: string[],
    language: LanguageCode,
    translations: TestTranslations
  ): { missing: string[]; present: string[] } {
    const missing: string[] = []
    const present: string[] = []

    const checkKey = (keyPath: string, obj: any): boolean => {
      const keys = keyPath.split('.')
      let current = obj
      
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key]
        } else {
          return false
        }
      }
      
      return current !== undefined && current !== null
    }

    for (const key of requiredKeys) {
      const exists = checkKey(key, translations[language]?.translation)
      if (exists) {
        present.push(key)
      } else {
        missing.push(key)
      }
    }

    return { missing, present }
  }

  /**
   * Calculate translation coverage percentage
   */
  calculateCoverage(
    baseLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    translations: TestTranslations
  ): number {
    const baseKeys = this.getAllTranslationKeys(translations[baseLanguage]?.translation)
    const targetKeys = this.getAllTranslationKeys(translations[targetLanguage]?.translation)
    
    const presentKeys = baseKeys.filter(key => targetKeys.includes(key))
    return baseKeys.length > 0 ? (presentKeys.length / baseKeys.length) * 100 : 0
  }

  /**
   * Get all translation keys from a translation object
   */
  private getAllTranslationKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = []
    
    if (!obj || typeof obj !== 'object') {
      return keys
    }

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      
      if (typeof value === 'string') {
        keys.push(fullKey)
      } else if (typeof value === 'object' && value !== null) {
        keys.push(...this.getAllTranslationKeys(value, fullKey))
      }
    }

    return keys
  }

  /**
   * Validate pluralization rules for a given count and language
   */
  validatePluralForm(
    key: string,
    count: number,
    language: LanguageCode,
    expectedForm: string
  ): boolean {
    const translation = this.i18nInstance.t(key, { count })
    return translation.includes(expectedForm) || translation === expectedForm
  }

  /**
   * Test interpolation with various value types
   */
  testInterpolation(
    key: string,
    values: Record<string, any>,
    expectedSubstrings: string[]
  ): { success: boolean; result: string; missingSubstrings: string[] } {
    const result = this.i18nInstance.t(key, values)
    const missingSubstrings = expectedSubstrings.filter(substr => !result.includes(substr))
    
    return {
      success: missingSubstrings.length === 0,
      result,
      missingSubstrings,
    }
  }

  /**
   * Check if text direction is correctly applied
   */
  checkTextDirection(language: LanguageCode): 'ltr' | 'rtl' {
    const rtlLanguages = ['ar', 'he', 'fa']
    return rtlLanguages.includes(language) ? 'rtl' : 'ltr'
  }

  /**
   * Validate that HTML lang and dir attributes are correctly set
   */
  validateDocumentAttributes(language: LanguageCode): boolean {
    const expectedDir = this.checkTextDirection(language)
    return (
      document.documentElement.lang === language &&
      document.documentElement.dir === expectedDir
    )
  }
}

/**
 * Test language switching scenarios
 */
export class LanguageSwitchingTestUtils {
  private user = userEvent.setup()

  /**
   * Switch language using dropdown language switcher
   */
  async switchLanguageDropdown(targetLanguage: LanguageCode): Promise<void> {
    const languageButton = screen.getByRole('button', { name: /change language/i })
    await this.user.click(languageButton)

    const languageNames = {
      en: /english/i,
      cs: /čeština/i,
      ar: /العربية/i,
    }

    const option = screen.getByRole('option', { name: languageNames[targetLanguage] })
    await this.user.click(option)
  }

  /**
   * Switch language using inline language switcher
   */
  async switchLanguageInline(targetLanguage: LanguageCode): Promise<void> {
    const languageNames = {
      en: /switch to english/i,
      cs: /switch to czech/i,
      ar: /switch to arabic/i,
    }

    const button = screen.getByRole('button', { name: languageNames[targetLanguage] })
    await this.user.click(button)
  }

  /**
   * Test rapid language switching to detect race conditions
   */
  async testRapidSwitching(languages: LanguageCode[]): Promise<void> {
    for (const language of languages) {
      await this.switchLanguageInline(language)
      // Small delay to simulate real user interaction
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}

/**
 * Layout testing utilities for different text lengths
 */
export class LayoutTestUtils {
  /**
   * Measure text overflow in an element
   */
  measureTextOverflow(element: HTMLElement): {
    isOverflowing: boolean
    scrollWidth: number
    clientWidth: number
    overflowAmount: number
  } {
    const scrollWidth = element.scrollWidth
    const clientWidth = element.clientWidth
    const isOverflowing = scrollWidth > clientWidth
    const overflowAmount = scrollWidth - clientWidth

    return {
      isOverflowing,
      scrollWidth,
      clientWidth,
      overflowAmount,
    }
  }

  /**
   * Test if text fits within container constraints
   */
  testTextFit(
    testId: string,
    maxWidth: number,
    maxHeight?: number
  ): { fits: boolean; measurements: DOMRect } {
    const element = screen.getByTestId(testId)
    const rect = element.getBoundingClientRect()
    
    const widthFits = rect.width <= maxWidth
    const heightFits = maxHeight ? rect.height <= maxHeight : true
    
    return {
      fits: widthFits && heightFits,
      measurements: rect,
    }
  }

  /**
   * Compare element sizes across different languages
   */
  async compareElementSizes(
    testId: string,
    languages: LanguageCode[],
    i18nUtils: I18nTestUtils,
    rerenderComponent: () => void
  ): Promise<Record<LanguageCode, DOMRect>> {
    const sizes: Record<string, DOMRect> = {}

    for (const language of languages) {
      await i18nUtils.changeLanguage(language)
      rerenderComponent()
      
      await waitFor(() => {
        const element = screen.getByTestId(testId)
        sizes[language] = element.getBoundingClientRect()
      })
    }

    return sizes as Record<LanguageCode, DOMRect>
  }

  /**
   * Test responsive behavior with different text lengths
   */
  async testResponsiveText(
    testId: string,
    breakpoints: number[],
    languages: LanguageCode[],
    i18nUtils: I18nTestUtils,
    rerenderComponent: () => void
  ): Promise<{
    language: LanguageCode
    breakpoint: number
    measurements: DOMRect
    isResponsive: boolean
  }[]> {
    const results: any[] = []

    for (const language of languages) {
      await i18nUtils.changeLanguage(language)
      
      for (const breakpoint of breakpoints) {
        // Simulate viewport resize
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: breakpoint,
        })
        
        window.dispatchEvent(new Event('resize'))
        rerenderComponent()

        await waitFor(() => {
          const element = screen.getByTestId(testId)
          const rect = element.getBoundingClientRect()
          
          // Basic responsiveness check - element should not exceed viewport
          const isResponsive = rect.width <= breakpoint
          
          results.push({
            language,
            breakpoint,
            measurements: rect,
            isResponsive,
          })
        })
      }
    }

    return results
  }
}

/**
 * Form validation testing utilities
 */
export class FormValidationTestUtils {
  private user = userEvent.setup()

  /**
   * Test form validation messages in multiple languages
   */
  async testValidationMessages(
    formData: {
      fieldTestId: string
      invalidValue: string
      errorMessageTestId: string
      expectedErrorKey: string
    }[],
    languages: LanguageCode[],
    i18nUtils: I18nTestUtils,
    rerenderComponent: () => void
  ): Promise<{
    language: LanguageCode
    field: string
    errorMessage: string
    isTranslated: boolean
  }[]> {
    const results: any[] = []

    for (const language of languages) {
      await i18nUtils.changeLanguage(language)
      rerenderComponent()

      for (const field of formData) {
        const input = screen.getByTestId(field.fieldTestId)
        
        // Clear and enter invalid value
        await this.user.clear(input)
        await this.user.type(input, field.invalidValue)
        
        // Trigger validation (blur or form submission)
        await this.user.tab()

        await waitFor(() => {
          const errorElement = screen.getByTestId(field.errorMessageTestId)
          const errorMessage = errorElement.textContent || ''
          
          // Check if error message is translated (not just the key)
          const isTranslated = !errorMessage.includes(field.expectedErrorKey) && errorMessage.length > 0
          
          results.push({
            language,
            field: field.fieldTestId,
            errorMessage,
            isTranslated,
          })
        })
      }
    }

    return results
  }

  /**
   * Test form placeholder translations
   */
  async testPlaceholderTranslations(
    fields: { testId: string; expectedKey: string }[],
    languages: LanguageCode[],
    i18nUtils: I18nTestUtils,
    rerenderComponent: () => void
  ): Promise<{
    language: LanguageCode
    field: string
    placeholder: string
    isTranslated: boolean
  }[]> {
    const results: any[] = []

    for (const language of languages) {
      await i18nUtils.changeLanguage(language)
      rerenderComponent()

      for (const field of fields) {
        await waitFor(() => {
          const input = screen.getByTestId(field.testId)
          const placeholder = input.getAttribute('placeholder') || ''
          
          // Check if placeholder is not the translation key
          const isTranslated = !placeholder.includes(field.expectedKey) && placeholder.length > 0
          
          results.push({
            language,
            field: field.testId,
            placeholder,
            isTranslated,
          })
        })
      }
    }

    return results
  }
}

/**
 * Accessibility testing utilities for i18n
 */
export class AccessibilityTestUtils {
  /**
   * Check if ARIA labels are translated
   */
  async testAriaLabels(
    elements: { role: string; name: RegExp; expectedKey: string }[],
    languages: LanguageCode[],
    i18nUtils: I18nTestUtils,
    rerenderComponent: () => void
  ): Promise<{
    language: LanguageCode
    element: string
    ariaLabel: string
    isTranslated: boolean
  }[]> {
    const results: any[] = []

    for (const language of languages) {
      await i18nUtils.changeLanguage(language)
      rerenderComponent()

      for (const elementInfo of elements) {
        await waitFor(() => {
          const element = screen.getByRole(elementInfo.role, { name: elementInfo.name })
          const ariaLabel = element.getAttribute('aria-label') || ''
          
          // Check if aria-label is translated
          const isTranslated = !ariaLabel.includes(elementInfo.expectedKey) && ariaLabel.length > 0
          
          results.push({
            language,
            element: `${elementInfo.role}:${elementInfo.name.source}`,
            ariaLabel,
            isTranslated,
          })
        })
      }
    }

    return results
  }

  /**
   * Test screen reader announcements for language changes
   */
  testLanguageChangeAnnouncements(
    liveRegionTestId: string
  ): { hasLiveRegion: boolean; announcementText: string } {
    try {
      const liveRegion = screen.getByTestId(liveRegionTestId)
      const hasCorrectAttributes = 
        liveRegion.getAttribute('aria-live') === 'polite' &&
        liveRegion.getAttribute('aria-atomic') === 'true'
      
      return {
        hasLiveRegion: hasCorrectAttributes,
        announcementText: liveRegion.textContent || '',
      }
    } catch {
      return {
        hasLiveRegion: false,
        announcementText: '',
      }
    }
  }

  /**
   * Check focus management during language changes
   */
  async testFocusManagement(
    focusedElementTestId: string,
    languageSwitcher: LanguageSwitchingTestUtils,
    targetLanguage: LanguageCode
  ): Promise<{ focusPreserved: boolean; activeElement: string }> {
    const initialElement = screen.getByTestId(focusedElementTestId)
    initialElement.focus()
    
    const initialActiveElement = document.activeElement
    
    await languageSwitcher.switchLanguageDropdown(targetLanguage)
    
    await waitFor(() => {
      const currentActiveElement = document.activeElement
      const focusPreserved = currentActiveElement === initialActiveElement ||
                            currentActiveElement?.getAttribute('data-testid') === focusedElementTestId
      
      return {
        focusPreserved,
        activeElement: currentActiveElement?.tagName || 'none',
      }
    })

    return {
      focusPreserved: false,
      activeElement: 'none',
    }
  }
}

/**
 * Performance testing utilities for i18n
 */
export class PerformanceTestUtils {
  /**
   * Measure language switching performance
   */
  async measureLanguageSwitchTime(
    switcher: LanguageSwitchingTestUtils,
    fromLanguage: LanguageCode,
    toLanguage: LanguageCode,
    testElementId: string
  ): Promise<{
    switchTime: number
    renderTime: number
    totalTime: number
  }> {
    const startTime = performance.now()
    
    await switcher.switchLanguageDropdown(toLanguage)
    
    const switchTime = performance.now() - startTime
    const renderStartTime = performance.now()
    
    await waitFor(() => {
      const element = screen.getByTestId(testElementId)
      expect(element).toBeInTheDocument()
    })
    
    const renderTime = performance.now() - renderStartTime
    const totalTime = performance.now() - startTime
    
    return {
      switchTime,
      renderTime,
      totalTime,
    }
  }

  /**
   * Test memory usage during rapid language switching
   */
  async testMemoryUsage(
    switcher: LanguageSwitchingTestUtils,
    languages: LanguageCode[],
    iterations: number = 10
  ): Promise<{
    initialMemory: number
    finalMemory: number
    memoryIncrease: number
    averageSwitchTime: number
  }> {
    // Note: This requires browser support for performance.memory
    const getMemoryUsage = () => {
      return (performance as any).memory?.usedJSHeapSize || 0
    }

    const initialMemory = getMemoryUsage()
    const switchTimes: number[] = []

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      
      for (const language of languages) {
        await switcher.switchLanguageInline(language)
      }
      
      const endTime = performance.now()
      switchTimes.push(endTime - startTime)
    }

    const finalMemory = getMemoryUsage()
    
    return {
      initialMemory,
      finalMemory,
      memoryIncrease: finalMemory - initialMemory,
      averageSwitchTime: switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length,
    }
  }
}

/**
 * Integration testing utilities
 */
export class IntegrationTestUtils {
  /**
   * Test complete user workflow in multiple languages
   */
  async testWorkflow(
    steps: Array<{
      description: string
      action: () => Promise<void>
      verification: () => Promise<void>
    }>,
    languages: LanguageCode[],
    i18nUtils: I18nTestUtils,
    rerenderComponent: () => void
  ): Promise<{
    language: LanguageCode
    step: string
    success: boolean
    error?: string
  }[]> {
    const results: any[] = []

    for (const language of languages) {
      await i18nUtils.changeLanguage(language)
      rerenderComponent()

      for (const step of steps) {
        try {
          await step.action()
          await step.verification()
          
          results.push({
            language,
            step: step.description,
            success: true,
          })
        } catch (error) {
          results.push({
            language,
            step: step.description,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    return results
  }
}

/**
 * Utility to create mock translations for testing
 */
export class MockTranslationBuilder {
  private translations: Record<string, any> = {}

  /**
   * Add a namespace with translations
   */
  addNamespace(
    namespace: string,
    translations: Record<LanguageCode, Record<string, any>>
  ): this {
    for (const [language, data] of Object.entries(translations)) {
      if (!this.translations[language]) {
        this.translations[language] = { translation: {} }
      }
      this.translations[language].translation[namespace] = data
    }
    return this
  }

  /**
   * Add pluralization examples
   */
  addPlurals(
    key: string,
    translations: Record<LanguageCode, Record<string, string>>
  ): this {
    for (const [language, pluralForms] of Object.entries(translations)) {
      if (!this.translations[language]) {
        this.translations[language] = { translation: {} }
      }
      if (!this.translations[language].translation.plurals) {
        this.translations[language].translation.plurals = {}
      }
      
      for (const [form, text] of Object.entries(pluralForms)) {
        this.translations[language].translation.plurals[`${key}_${form}`] = text
      }
    }
    return this
  }

  /**
   * Add context examples
   */
  addContexts(
    key: string,
    translations: Record<LanguageCode, Record<string, string>>
  ): this {
    for (const [language, contextForms] of Object.entries(translations)) {
      if (!this.translations[language]) {
        this.translations[language] = { translation: {} }
      }
      if (!this.translations[language].translation.contexts) {
        this.translations[language].translation.contexts = {}
      }
      
      for (const [context, text] of Object.entries(contextForms)) {
        this.translations[language].translation.contexts[`${key}_${context}`] = text
      }
    }
    return this
  }

  /**
   * Build the final translation object
   */
  build(): Record<string, any> {
    return this.translations
  }
}

// Export default collection of utilities
export const i18nTestHelpers = {
  I18nTestUtils,
  LanguageSwitchingTestUtils,
  LayoutTestUtils,
  FormValidationTestUtils,
  AccessibilityTestUtils,
  PerformanceTestUtils,
  IntegrationTestUtils,
  MockTranslationBuilder,
}

export default i18nTestHelpers