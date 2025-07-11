/**
 * Helper components for advanced i18n features
 * Provides easy-to-use components for pluralization, context, and ordinals
 */

import React from 'react'
import { useTranslation } from '../../i18n/hooks/useTranslation'
import { getOrdinalSuffix } from '../../i18n/pluralization'
import { buildContextOptions, type ContextOptions } from '../../i18n/context'
import type { TFunction, TOptions } from 'i18next'

/**
 * Props for PluralText component
 */
interface PluralTextProps {
  /**
   * Translation key (will be suffixed with plural form)
   */
  i18nKey: string
  /**
   * Count for pluralization
   */
  count: number
  /**
   * Namespace for translation
   */
  ns?: string
  /**
   * Additional values for interpolation
   */
  values?: Record<string, any>
  /**
   * Custom component to wrap the text
   */
  component?: React.ElementType
  /**
   * Additional i18next options
   */
  options?: TOptions
}

/**
 * Component for rendering pluralized text
 * Automatically handles plural forms based on count and language
 * 
 * @example
 * <PluralText i18nKey="items" count={5} />
 * // Renders: "5 položek" (Czech) or "5 items" (English)
 * 
 * @example
 * <PluralText i18nKey="recipes.count" count={1} values={{ name: "Apple Pie" }} />
 * // Renders: "1 recept: Apple Pie" (Czech) or "1 recipe: Apple Pie" (English)
 */
export const PluralText: React.FC<PluralTextProps> = ({
  i18nKey,
  count,
  ns,
  values = {},
  component: Component = 'span',
  options = {}
}) => {
  const { t } = useTranslation()
  
  const translationOptions: TOptions = {
    ...options,
    count,
    ...values
  }
  
  if (ns) {
    translationOptions.ns = ns
  }
  
  return <Component>{t(i18nKey, translationOptions)}</Component>
}

/**
 * Props for ContextualText component
 */
interface ContextualTextProps {
  /**
   * Translation key (will be suffixed with context)
   */
  i18nKey: string
  /**
   * Context options (gender, formality, etc.)
   */
  context: ContextOptions
  /**
   * Namespace for translation
   */
  ns?: string
  /**
   * Additional values for interpolation
   */
  values?: Record<string, any>
  /**
   * Custom component to wrap the text
   */
  component?: React.ElementType
  /**
   * Additional i18next options
   */
  options?: TOptions
}

/**
 * Component for rendering context-aware text
 * Handles gender, formality, and custom contexts
 * 
 * @example
 * <ContextualText i18nKey="welcome" context={{ formality: 'formal' }} />
 * // Renders: "Dobrý den" (Czech formal) or "Welcome" (English)
 * 
 * @example
 * <ContextualText 
 *   i18nKey="user.action" 
 *   context={{ gender: 'feminine' }} 
 *   values={{ name: "Marie" }}
 * />
 * // Renders: "Marie přišla" (Czech feminine) or "Marie arrived" (English)
 */
export const ContextualText: React.FC<ContextualTextProps> = ({
  i18nKey,
  context,
  ns,
  values = {},
  component: Component = 'span',
  options = {}
}) => {
  const { t } = useTranslation()
  
  const translationOptions = buildContextOptions(
    {
      ...options,
      ...values,
      ...(ns && { ns })
    },
    context
  )
  
  return <Component>{t(i18nKey, translationOptions)}</Component>
}

/**
 * Props for OrdinalText component
 */
interface OrdinalTextProps {
  /**
   * Number to display as ordinal
   */
  value: number
  /**
   * Translation key for text template (optional)
   */
  i18nKey?: string
  /**
   * Whether to show only the ordinal suffix
   */
  suffixOnly?: boolean
  /**
   * Custom component to wrap the text
   */
  component?: React.ElementType
  /**
   * Additional values for interpolation
   */
  values?: Record<string, any>
}

/**
 * Component for rendering ordinal numbers
 * Handles language-specific ordinal formatting
 * 
 * @example
 * <OrdinalText value={1} />
 * // Renders: "1st" (English), "1." (Czech), "ال1" (Arabic)
 * 
 * @example
 * <OrdinalText value={3} i18nKey="place" />
 * // Renders: "3rd place" (English), "3. místo" (Czech)
 */
export const OrdinalText: React.FC<OrdinalTextProps> = ({
  value,
  i18nKey,
  suffixOnly = false,
  component: Component = 'span',
  values = {}
}) => {
  const { t, i18n } = useTranslation()
  const ordinal = getOrdinalSuffix(value, i18n.language)
  
  if (suffixOnly) {
    return <Component>{ordinal}</Component>
  }
  
  if (i18nKey) {
    return (
      <Component>
        {t(i18nKey, { ordinal, value, ...values })}
      </Component>
    )
  }
  
  return <Component>{ordinal}</Component>
}

/**
 * Props for PluralContextText component
 */
interface PluralContextTextProps {
  /**
   * Translation key
   */
  i18nKey: string
  /**
   * Count for pluralization
   */
  count: number
  /**
   * Context options
   */
  context: ContextOptions
  /**
   * Namespace for translation
   */
  ns?: string
  /**
   * Additional values for interpolation
   */
  values?: Record<string, any>
  /**
   * Custom component to wrap the text
   */
  component?: React.ElementType
  /**
   * Additional i18next options
   */
  options?: TOptions
}

/**
 * Combined component for plural and context-aware text
 * Handles both pluralization and context in one component
 * 
 * @example
 * <PluralContextText 
 *   i18nKey="user.items"
 *   count={2}
 *   context={{ gender: 'feminine', formality: 'informal' }}
 *   values={{ name: "Marie" }}
 * />
 * // Renders: "Marie má 2 položky" (Czech feminine informal)
 */
export const PluralContextText: React.FC<PluralContextTextProps> = ({
  i18nKey,
  count,
  context,
  ns,
  values = {},
  component: Component = 'span',
  options = {}
}) => {
  const { t } = useTranslation()
  
  const translationOptions = buildContextOptions(
    {
      ...options,
      count,
      ...values,
      ...(ns && { ns })
    },
    context
  )
  
  return <Component>{t(i18nKey, translationOptions)}</Component>
}

/**
 * Hook for using plural forms programmatically
 */
export const usePlural = () => {
  const { t, i18n } = useTranslation()
  
  /**
   * Get pluralized translation
   */
  const plural = (key: string, count: number, options?: TOptions) => {
    return t(key, { count, ...options })
  }
  
  /**
   * Get ordinal number
   */
  const ordinal = (value: number) => {
    return getOrdinalSuffix(value, i18n.language)
  }
  
  return { plural, ordinal }
}

/**
 * Hook for using contextual translations programmatically
 */
export const useContext = () => {
  const { t } = useTranslation()
  
  /**
   * Get contextual translation
   */
  const contextual = (key: string, context: ContextOptions, options?: TOptions) => {
    const translationOptions = buildContextOptions(options || {}, context)
    return t(key, translationOptions)
  }
  
  return { contextual }
}

/**
 * Combined hook for plural and context
 */
export const usePluralContext = () => {
  const { t } = useTranslation()
  const { ordinal } = usePlural()
  
  /**
   * Get translation with both plural and context
   */
  const pluralContext = (
    key: string,
    count: number,
    context: ContextOptions,
    options?: TOptions
  ) => {
    const translationOptions = buildContextOptions(
      { count, ...options },
      context
    )
    return t(key, translationOptions)
  }
  
  return { pluralContext, ordinal }
}

/**
 * Export all components and hooks
 */
export default {
  PluralText,
  ContextualText,
  OrdinalText,
  PluralContextText,
  usePlural,
  useContext,
  usePluralContext
}