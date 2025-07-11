import React from 'react'
import { 
  useEnhancedTranslation, 
  useContextualTranslation,
  usePluralTranslation,
  useFormattedTranslation 
} from '../hooks/useTypedTranslation'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { TranslationDevTools } from '../components/TranslationDevTools'

// Example 1: Basic usage with type safety
export const BasicExample: React.FC = () => {
  const { t, ready } = useEnhancedTranslation('auth')
  
  if (!ready) return <div>Loading translations...</div>
  
  return (
    <div>
      <h1>{t('auth.login')}</h1>
      <p>{t('auth.tagline')}</p>
      <p>{t('auth.passwordMin', { min: 8 })}</p>
    </div>
  )
}

// Example 2: Context-aware translations (gender, formality)
export const ContextExample: React.FC<{ 
  userGender?: 'male' | 'female' | 'neutral'
  isFormal?: boolean 
}> = ({ userGender = 'neutral', isFormal = false }) => {
  const { t, tWithContext } = useContextualTranslation('auth', {
    gender: userGender,
    formal: isFormal
  })
  
  return (
    <div>
      {/* Will automatically use gender/formal variations if available */}
      <h1>{t('auth.welcome')}</h1>
      
      {/* Override context for specific translation */}
      <p>{tWithContext('auth.welcome', { gender: 'female', formal: true })}</p>
    </div>
  )
}

// Example 3: Pluralization
export const PluralExample: React.FC = () => {
  const { tPlural } = usePluralTranslation('recipes')
  const [count, setCount] = React.useState(1)
  
  return (
    <div>
      <p>{tPlural('recipes.ingredient', count, { count })}</p>
      <p>{tPlural('recipes.serving', count, { count })}</p>
      
      <button onClick={() => setCount(count + 1)}>
        Add one (current: {count})
      </button>
    </div>
  )
}

// Example 4: Advanced formatting
export const FormattingExample: React.FC = () => {
  const { tFormat } = useFormattedTranslation('recipes')
  
  const recipe = {
    prepTime: 30,
    cookTime: 45,
    servings: 4,
    calories: 350,
    created: new Date()
  }
  
  return (
    <div>
      {/* Format values inline */}
      <p>{tFormat('recipes.prepTime', 
        { time: recipe.prepTime }, 
        { time: 'duration' }
      )}</p>
      
      {/* Multiple formatted values */}
      <p>{tFormat('recipes.nutritionInfo', 
        { 
          calories: recipe.calories,
          servings: recipe.servings,
          date: recipe.created
        }, 
        { 
          calories: 'number',
          servings: 'number',
          date: 'date:medium'
        }
      )}</p>
    </div>
  )
}

// Example 5: Complete application setup
export const AppExample: React.FC = () => {
  const { t, language, changeLanguage } = useEnhancedTranslation(['common', 'auth'])
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with language switcher */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          
          <div className="flex items-center gap-4">
            {/* Different variants of language switcher */}
            <LanguageSwitcher variant="dropdown" />
            <LanguageSwitcher variant="inline" showFlag={false} />
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <h2>{t('auth.login')}</h2>
        <p>Current language: {language}</p>
        
        {/* Programmatic language change */}
        <button onClick={() => changeLanguage('cs')}>
          Switch to Czech
        </button>
      </main>
      
      {/* Dev tools in development */}
      <TranslationDevTools position="bottom-right" />
    </div>
  )
}

// Example 6: Lazy loading namespaces
export const LazyLoadExample: React.FC = () => {
  const { t, ready } = useEnhancedTranslation('admin')
  
  // The 'admin' namespace will be loaded on demand
  if (!ready) {
    return <div>Loading admin translations...</div>
  }
  
  return (
    <div>
      <h1>{t('admin.dashboard')}</h1>
      <p>{t('admin.users.total', { count: 42 })}</p>
    </div>
  )
}

// Example 7: Translation existence check
export const ExistenceCheckExample: React.FC = () => {
  const { t, exists } = useEnhancedTranslation('common')
  
  const renderContent = (key: string) => {
    if (exists(key)) {
      return <p>{t(key)}</p>
    }
    return <p className="text-red-500">Translation missing: {key}</p>
  }
  
  return (
    <div>
      {renderContent('common.welcome')}
      {renderContent('common.nonExistentKey')}
    </div>
  )
}

// Example 8: Using with React components
export const ComponentExample: React.FC = () => {
  const { t } = useEnhancedTranslation('common')
  
  return (
    <div>
      {/* Trans component for complex translations with components */}
      <p>
        {t('common.termsAndConditions', {
          link: (chunks: any) => <a href="/terms" className="text-blue-500">{chunks}</a>,
          bold: (chunks: any) => <strong>{chunks}</strong>
        })}
      </p>
    </div>
  )
}