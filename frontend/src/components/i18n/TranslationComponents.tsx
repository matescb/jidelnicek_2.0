import React, { ReactElement, ReactNode, useMemo } from 'react'
import { Trans as I18nTrans } from 'react-i18next'
import { useTypedTranslation, useTranslationExists, usePluralTranslation } from '../../i18n/hooks/useTranslation'
import type { TranslationKey, TranslationOptions, TransProps } from '../../i18n/types'

/**
 * Type-safe Trans component wrapper with better TypeScript support
 * 
 * @example
 * <Trans i18nKey="auth.passwordMin" values={{ min: 8 }}>
 *   Password must be at least <strong>{{min}}</strong> characters
 * </Trans>
 */
export function Trans<K extends TranslationKey>({
  i18nKey,
  values,
  components,
  children,
  ...props
}: TransProps<K>) {
  const { t } = useTypedTranslation()

  return (
    <I18nTrans
      i18nKey={i18nKey as string}
      values={values}
      components={components}
      t={t as any}
      {...props}
    >
      {children}
    </I18nTrans>
  )
}

/**
 * Simple translation component for basic text
 * 
 * @example
 * <T key="auth.login" />
 * <T key="auth.passwordMin" values={{ min: 8 }} />
 */
interface TProps<K extends TranslationKey = TranslationKey> {
  key: K
  values?: TranslationOptions['replace']
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
}

export function T<K extends TranslationKey>({
  key,
  values,
  component: Component = 'span',
  className,
}: TProps<K>) {
  const { t } = useTypedTranslation()
  
  const text = t(key, { replace: values } as any)
  
  return <Component className={className}>{text}</Component>
}

/**
 * Plural component for handling pluralization
 * 
 * @example
 * <Plural
 *   singular="recipes.recipe"
 *   plural="recipes.recipes"
 *   count={count}
 * />
 */
interface PluralProps {
  singular: TranslationKey
  plural: TranslationKey
  count: number
  values?: Record<string, any>
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
  showCount?: boolean
  countComponent?: keyof JSX.IntrinsicElements | React.ComponentType<any>
}

export function Plural({
  singular,
  plural,
  count,
  values,
  component: Component = 'span',
  className,
  showCount = false,
  countComponent: CountComponent = 'strong',
}: PluralProps) {
  const { t } = useTypedTranslation()
  
  const key = count === 1 ? singular : plural
  const text = t(key, { ...values, count } as any)
  
  if (showCount) {
    return (
      <Component className={className}>
        <CountComponent>{count}</CountComponent> {text}
      </Component>
    )
  }
  
  return <Component className={className}>{text}</Component>
}

/**
 * Smart plural component that uses i18next's built-in pluralization
 * 
 * @example
 * <SmartPlural
 *   i18nKey="form.seconds"
 *   count={seconds}
 * />
 */
interface SmartPluralProps {
  i18nKey: TranslationKey
  count: number
  values?: Record<string, any>
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
}

export function SmartPlural({
  i18nKey,
  count,
  values,
  component: Component = 'span',
  className,
}: SmartPluralProps) {
  const { tPlural } = usePluralTranslation()
  
  const text = tPlural(i18nKey, count, values)
  
  return <Component className={className}>{text}</Component>
}

/**
 * Missing translation component for development
 * Shows a warning when a translation is missing
 * 
 * @example
 * <Missing i18nKey="some.missing.key" fallback="Default text" />
 */
interface MissingProps {
  i18nKey: TranslationKey
  fallback?: ReactNode
  showKey?: boolean
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
  warnInProduction?: boolean
}

export function Missing({
  i18nKey,
  fallback,
  showKey = true,
  component: Component = 'span',
  className,
  warnInProduction = false,
}: MissingProps) {
  const { exists } = useTranslationExists()
  const { t } = useTypedTranslation()
  
  const isMissing = !exists(i18nKey)
  
  // Warn in development or if explicitly requested in production
  if (isMissing && (import.meta.env.DEV || warnInProduction)) {
    console.warn(`Missing translation: ${i18nKey}`)
  }
  
  if (isMissing) {
    const content = fallback || (showKey ? `[${i18nKey}]` : 'Missing translation')
    
    if (import.meta.env.DEV) {
      return (
        <Component 
          className={className} 
          style={{ 
            backgroundColor: 'rgba(255, 0, 0, 0.1)', 
            border: '1px dashed red',
            padding: '2px 4px',
            borderRadius: '2px',
          }}
          title={`Missing translation: ${i18nKey}`}
        >
          {content}
        </Component>
      )
    }
    
    return <Component className={className}>{content}</Component>
  }
  
  return <Component className={className}>{t(i18nKey)}</Component>
}

/**
 * Conditional translation component
 * Shows different translations based on a condition
 * 
 * @example
 * <ConditionalT
 *   condition={isLoggedIn}
 *   trueKey="navigation.dashboard"
 *   falseKey="auth.login"
 * />
 */
interface ConditionalTProps {
  condition: boolean
  trueKey: TranslationKey
  falseKey: TranslationKey
  trueValues?: Record<string, any>
  falseValues?: Record<string, any>
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
}

export function ConditionalT({
  condition,
  trueKey,
  falseKey,
  trueValues,
  falseValues,
  component: Component = 'span',
  className,
}: ConditionalTProps) {
  const { t } = useTypedTranslation()
  
  const key = condition ? trueKey : falseKey
  const values = condition ? trueValues : falseValues
  
  const text = t(key, { replace: values } as any)
  
  return <Component className={className}>{text}</Component>
}

/**
 * Translation with fallback chain
 * Tries multiple keys in order until one exists
 * 
 * @example
 * <FallbackT
 *   keys={['recipes.specialMessage', 'recipes.defaultMessage', 'common.message']}
 *   fallback="No message available"
 * />
 */
interface FallbackTProps {
  keys: TranslationKey[]
  fallback?: ReactNode
  values?: Record<string, any>
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
}

export function FallbackT({
  keys,
  fallback = '',
  values,
  component: Component = 'span',
  className,
}: FallbackTProps) {
  const { exists } = useTranslationExists()
  const { t } = useTypedTranslation()
  
  const existingKey = useMemo(() => {
    return keys.find(key => exists(key))
  }, [keys, exists])
  
  if (!existingKey) {
    return <Component className={className}>{fallback}</Component>
  }
  
  const text = t(existingKey, { replace: values } as any)
  
  return <Component className={className}>{text}</Component>
}

/**
 * List translation component
 * Renders a list of translated items
 * 
 * @example
 * <TranslatedList
 *   items={['auth.login', 'auth.register', 'auth.logout']}
 *   component="ul"
 *   itemComponent="li"
 * />
 */
interface TranslatedListProps {
  items: TranslationKey[]
  component?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  itemComponent?: keyof JSX.IntrinsicElements | React.ComponentType<any>
  className?: string
  itemClassName?: string
  separator?: ReactNode
}

export function TranslatedList({
  items,
  component: Component = 'div',
  itemComponent: ItemComponent = 'span',
  className,
  itemClassName,
  separator,
}: TranslatedListProps) {
  const { t } = useTypedTranslation()
  
  return (
    <Component className={className}>
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <ItemComponent className={itemClassName}>
            {t(item)}
          </ItemComponent>
          {separator && index < items.length - 1 && separator}
        </React.Fragment>
      ))}
    </Component>
  )
}

/**
 * Development-only translation debugger
 * Shows translation key, value, and metadata
 * 
 * @example
 * <TranslationDebugger i18nKey="auth.login" />
 */
interface TranslationDebuggerProps {
  i18nKey: TranslationKey
  showMetadata?: boolean
  className?: string
}

export function TranslationDebugger({
  i18nKey,
  showMetadata = true,
  className,
}: TranslationDebuggerProps) {
  if (!import.meta.env.DEV) {
    return null
  }
  
  const { t, language } = useTypedTranslation()
  const { exists, getAvailableLanguages } = useTranslationExists()
  
  const value = t(i18nKey)
  const isExists = exists(i18nKey)
  const availableLanguages = getAvailableLanguages(i18nKey)
  
  return (
    <div 
      className={className}
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '8px',
        margin: '4px 0',
        backgroundColor: '#f9f9f9',
        fontSize: '12px',
        fontFamily: 'monospace',
      }}
    >
      <div><strong>Key:</strong> {i18nKey}</div>
      <div><strong>Value:</strong> {value}</div>
      <div><strong>Exists:</strong> {isExists ? 'Yes' : 'No'}</div>
      <div><strong>Current Language:</strong> {language}</div>
      
      {showMetadata && (
        <>
          <div><strong>Available in:</strong> {availableLanguages.join(', ')}</div>
          <div>
            <strong>Has interpolation:</strong> 
            {value.includes('{{') ? 'Yes' : 'No'}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Language-specific content component
 * Shows content only for specific languages
 * 
 * @example
 * <LanguageSpecific languages={['cs']}>
 *   <p>This content only shows in Czech</p>
 * </LanguageSpecific>
 */
interface LanguageSpecificProps {
  languages: string[]
  children: ReactNode
  fallback?: ReactNode
}

export function LanguageSpecific({
  languages,
  children,
  fallback = null,
}: LanguageSpecificProps) {
  const { language } = useTypedTranslation()
  
  if (languages.includes(language)) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}