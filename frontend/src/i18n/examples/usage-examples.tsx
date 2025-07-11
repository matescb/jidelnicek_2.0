import React from 'react'
import {
  useTypedTranslation,
  useNamespaceTranslation,
  useDynamicTranslation,
  useTranslationExists,
  usePluralTranslation,
  useContextualTranslation,
  useMissingTranslations,
  useTranslationKeys,
} from '../hooks'
import {
  Trans,
  T,
  Plural,
  SmartPlural,
  Missing,
  ConditionalT,
  FallbackT,
  TranslatedList,
  TranslationDebugger,
  LanguageSpecific,
} from '../../components/i18n'
import {
  keyBuilder,
  missingTranslationDetector,
  fallbackManager,
  interpolationHelpers,
  formatHelpers,
  developmentHelpers,
} from '../utils'

/**
 * Example 1: Basic type-safe translation hook
 */
function BasicTranslationExample() {
  const { t } = useTypedTranslation()
  
  return (
    <div>
      {/* TypeScript will autocomplete available keys */}
      <h1>{t('auth.login')}</h1>
      <p>{t('auth.tagline')}</p>
      
      {/* With interpolation - TypeScript knows about required params */}
      <p>{t('auth.passwordMin', { replace: { min: 8 } })}</p>
    </div>
  )
}

/**
 * Example 2: Namespace-specific translations
 */
function NamespaceTranslationExample() {
  const { t } = useNamespaceTranslation('recipes')
  
  return (
    <div>
      {/* No need to prefix with 'recipes.' */}
      <h1>{t('title')}</h1>
      <button>{t('createNew')}</button>
      <input placeholder={t('searchPlaceholder')} />
    </div>
  )
}

/**
 * Example 3: Dynamic key generation
 */
function DynamicTranslationExample() {
  const { buildKey, t, tSafe } = useDynamicTranslation()
  
  const difficulty = 'easy' // This could come from props or state
  const unit = 'kg' // Dynamic unit
  
  return (
    <div>
      {/* Build keys dynamically */}
      <p>{t(buildKey('recipes', 'difficultyLevels', difficulty))}</p>
      <p>{t(buildKey('recipes', 'units', unit))}</p>
      
      {/* Safe translation with fallback */}
      <p>{tSafe(buildKey('recipes', 'custom', 'key'), 'Default text')}</p>
    </div>
  )
}

/**
 * Example 4: Check if translations exist
 */
function TranslationExistsExample() {
  const { exists, getAvailableLanguages } = useTranslationExists()
  
  // Conditionally render based on translation availability
  if (exists('recipes.specialFeature')) {
    return <div>Special feature UI</div>
  }
  
  // Show available languages for a key
  const languages = getAvailableLanguages('auth.login')
  console.log('Available in:', languages) // ['en', 'cs']
  
  return <div>Default UI</div>
}

/**
 * Example 5: Pluralization
 */
function PluralizationExample() {
  const { tPlural } = usePluralTranslation()
  const [count, setCount] = React.useState(1)
  
  return (
    <div>
      {/* Using the hook */}
      <p>{tPlural('form.seconds', count)}</p>
      
      {/* Using components */}
      <Plural
        singular="recipes.recipe"
        plural="recipes.recipes"
        count={count}
        showCount
      />
      
      {/* Smart plural with i18next built-in support */}
      <SmartPlural i18nKey="form.seconds" count={count} />
      
      <button onClick={() => setCount(count + 1)}>Add</button>
    </div>
  )
}

/**
 * Example 6: Translation components
 */
function TranslationComponentsExample() {
  const isLoggedIn = true
  
  return (
    <div>
      {/* Simple translation */}
      <T key="auth.login" />
      
      {/* With interpolation and custom component */}
      <T 
        key="auth.passwordMin" 
        values={{ min: 8 }} 
        component="strong"
      />
      
      {/* Trans for complex HTML */}
      <Trans i18nKey="auth.passwordRequirements">
        Password must contain <strong>uppercase</strong>, lowercase, 
        <em>number</em>, and special character
      </Trans>
      
      {/* Conditional translation */}
      <ConditionalT
        condition={isLoggedIn}
        trueKey="navigation.dashboard"
        falseKey="auth.login"
      />
      
      {/* Fallback chain */}
      <FallbackT
        keys={['recipes.customMessage', 'recipes.defaultMessage', 'common.info']}
        fallback="No message"
      />
      
      {/* Missing translation indicator */}
      <Missing 
        i18nKey="some.missing.key" 
        fallback="Default content"
      />
      
      {/* List of translations */}
      <TranslatedList
        items={['navigation.dashboard', 'navigation.recipes', 'navigation.trips']}
        component="ul"
        itemComponent="li"
      />
    </div>
  )
}

/**
 * Example 7: Development tools
 */
function DevelopmentToolsExample() {
  const { checkCoverage, getMissingFromStore } = useMissingTranslations()
  
  // Check translation coverage
  const report = checkCoverage()
  console.log('Coverage:', report)
  
  // Get missing translations detected during runtime
  const missing = getMissingFromStore()
  console.log('Missing:', missing)
  
  return (
    <div>
      {/* Debug component (only in dev) */}
      <TranslationDebugger i18nKey="auth.login" />
      
      {/* Language-specific content */}
      <LanguageSpecific languages={['cs']}>
        <p>This only shows in Czech</p>
      </LanguageSpecific>
    </div>
  )
}

/**
 * Example 8: Using helper utilities
 */
function HelperUtilitiesExample() {
  // Key building
  const key = keyBuilder.join('auth', 'login') // 'auth.login'
  const namespace = keyBuilder.getNamespace('auth.login') // 'auth'
  
  // Missing detection
  const coverage = missingTranslationDetector.getCoverage('cs')
  const missing = missingTranslationDetector.getMissingForLanguage('cs')
  
  // Fallback management
  const text = fallbackManager.getWithFallback('some.key', 'Default')
  const textChain = fallbackManager.getWithFallbacks(
    ['pref.key', 'fallback.key', 'default.key'],
    'Ultimate default'
  )
  
  // Interpolation validation
  const validation = interpolationHelpers.validateParams(
    'auth.passwordMin',
    { min: 8, extra: 'unused' }
  )
  console.log(validation) // { valid: true, missing: [], extra: ['extra'] }
  
  // Formatting
  const formatted = {
    number: formatHelpers.number(1234.56),
    date: formatHelpers.date(new Date()),
    currency: formatHelpers.currency(99.99, 'EUR'),
    relative: formatHelpers.relativeTime(new Date(Date.now() + 3600000)),
  }
  
  // Development helpers
  if (import.meta.env.DEV) {
    developmentHelpers.logMissingTranslations()
    const validation = developmentHelpers.validateTranslations()
    console.log('Valid:', validation.valid)
  }
  
  return <div>{JSON.stringify(formatted, null, 2)}</div>
}

/**
 * Example 9: Translation key builder pattern
 */
function KeyBuilderExample() {
  const keys = useTranslationKeys('recipes')
  const { t } = useTypedTranslation()
  
  // Build keys with proxy pattern
  const titleKey = keys.title() // 'recipes.title'
  const unitKey = keys.units.kg() // 'recipes.units.kg'
  
  return (
    <div>
      <h1>{t(titleKey as any)}</h1>
      <p>{t(unitKey as any)}</p>
    </div>
  )
}

/**
 * Example 10: Complete form with translations
 */
function TranslatedFormExample() {
  const { t } = useTypedTranslation()
  const { tPlural } = usePluralTranslation()
  const [errors, setErrors] = React.useState<string[]>([])
  
  return (
    <form>
      <div>
        <label>
          <T key="auth.email" />
        </label>
        <input 
          type="email" 
          placeholder={t('auth.email')}
          required
        />
      </div>
      
      <div>
        <label>
          <T key="auth.password" />
        </label>
        <input 
          type="password" 
          placeholder={t('auth.password')}
          required
        />
        <small>
          <Trans i18nKey="auth.passwordMin" values={{ min: 8 }}>
            Password must be at least <strong>{{min}}</strong> characters
          </Trans>
        </small>
      </div>
      
      {errors.length > 0 && (
        <div className="errors">
          <h3>
            <SmartPlural 
              i18nKey="errors.validationErrors" 
              count={errors.length} 
            />
          </h3>
          <TranslatedList
            items={errors as any}
            component="ul"
            itemComponent="li"
            itemClassName="error"
          />
        </div>
      )}
      
      <button type="submit">
        <T key="auth.login" />
      </button>
    </form>
  )
}

// Export all examples
export {
  BasicTranslationExample,
  NamespaceTranslationExample,
  DynamicTranslationExample,
  TranslationExistsExample,
  PluralizationExample,
  TranslationComponentsExample,
  DevelopmentToolsExample,
  HelperUtilitiesExample,
  KeyBuilderExample,
  TranslatedFormExample,
}