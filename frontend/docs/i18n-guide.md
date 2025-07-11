# Internationalization (i18n) Guide

Welcome to the Jídelníček internationalization guide. This document will help you understand and use the i18n features in our application.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Available Languages](#available-languages)
4. [Basic Usage](#basic-usage)
5. [Adding New Translations](#adding-new-translations)
6. [Adding New Languages](#adding-new-languages)
7. [Best Practices](#best-practices)
8. [Common Tasks](#common-tasks)

## Overview

The Jídelníček application uses a comprehensive i18n system built on:
- **react-i18next** for React integration
- **i18next** for core translation functionality
- **TypeScript** for type-safe translations
- **Custom hooks and components** for enhanced functionality

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Your App                             │
├─────────────────────────────────────────────────────────────┤
│                    React Components                          │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Language │  │   Plural/     │  │    Formatted        │  │
│  │ Switcher │  │   Context     │  │    Components       │  │
│  └──────────┘  │  Components   │  │  (Number, Date...)  │  │
│                └──────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Custom Hooks                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   useTyped   │  │useFormatting │  │  useContextual  │  │
│  │ Translation  │  │  (numbers,   │  │  Translation    │  │
│  └──────────────┘  │   dates...)  │  └─────────────────┘  │
│                    └──────────────┘                        │
├─────────────────────────────────────────────────────────────┤
│                    react-i18next                            │
├─────────────────────────────────────────────────────────────┤
│                      i18next Core                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Language    │  │Pluralization │  │   Formatting    │  │
│  │  Detection   │  │    Rules     │  │   Functions     │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   Translation Files                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │  en.ts   │  │  cs.ts   │  │  ar.ts   │                │
│  └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- 🌐 **Multi-language support** (English, Czech, Arabic)
- 📝 **Type-safe translations** with TypeScript
- 🔢 **Complex pluralization** rules for each language
- 👥 **Context support** (gender, formality)
- 💰 **Formatting utilities** (numbers, dates, currency)
- 📱 **RTL support** for Arabic
- 🔍 **Translation management** tools
- ⚡ **Lazy loading** for performance

## Quick Start

### Using Translations in Components

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  
  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('common.greeting', { name: 'Alice' })}</p>
    </div>
  )
}
```

### Switching Languages

```tsx
import { LanguageSwitcher } from '@/i18n/components/LanguageSwitcher'

function Header() {
  return (
    <nav>
      <LanguageSwitcher />
    </nav>
  )
}
```

## Available Languages

The application currently supports three languages:

| Language | Code | Native Name | Direction |
|----------|------|-------------|-----------|
| English  | `en` | English     | LTR       |
| Czech    | `cs` | Čeština     | LTR       |
| Arabic   | `ar` | العربية    | RTL       |

## Basic Usage

### Simple Translations

```tsx
// Basic translation
<p>{t('recipes.title')}</p>

// With interpolation
<p>{t('recipes.byAuthor', { author: 'John' })}</p>

// With default value
<p>{t('recipes.new', 'New Recipe')}</p>
```

### Pluralization

Use the `PluralText` component for automatic pluralization:

```tsx
import { PluralText } from '@/components/i18n/PluralComponents'

// Automatically selects correct plural form
<PluralText i18nKey="plurals.recipe" count={5} />
// Output: "5 receptů" (Czech), "5 recipes" (English)
```

### Context (Gender/Formality)

Use the `ContextualText` component for context-aware translations:

```tsx
import { ContextualText } from '@/components/i18n/PluralComponents'

// Gender context
<ContextualText 
  i18nKey="contexts.userArrived" 
  context={{ gender: 'feminine' }}
  values={{ name: 'Marie' }}
/>
// Output: "Marie přišla" (Czech feminine form)

// Formality context
<ContextualText 
  i18nKey="contexts.welcome" 
  context={{ formality: 'formal' }}
/>
// Output: "Dobrý den" (Czech formal)
```

### Formatting

Use the `Formatted` components for automatic locale-aware formatting:

```tsx
import { Formatted } from '@/i18n/formatting'

// Numbers
<Formatted.Number value={1234.56} />
// Output: "1,234.56" (EN), "1 234,56" (CS)

// Currency
<Formatted.Currency value={99.99} />
// Output: "€99.99" (EN), "99,99 Kč" (CS)

// Dates
<Formatted.Date value={new Date()} />
// Output: "1/11/2025" (EN), "11. 1. 2025" (CS)

// Relative time
<Formatted.RelativeTime value={yesterday} />
// Output: "yesterday" (EN), "včera" (CS)
```

## Adding New Translations

### 1. Add to English (Reference) File

Edit `/src/i18n/locales/en.ts`:

```typescript
export default {
  common: {
    welcome: 'Welcome',
    // Add your new key here
    newFeature: 'New Feature'
  },
  // ... other namespaces
}
```

### 2. Run Sync Command

This will add the key to other locales with placeholders:

```bash
npm run i18n:sync
```

### 3. Add Translations for Other Languages

Edit `/src/i18n/locales/cs.ts` and `/src/i18n/locales/ar.ts`:

```typescript
// Czech
export default {
  common: {
    welcome: 'Vítejte',
    newFeature: 'Nová funkce' // Add Czech translation
  }
}

// Arabic
export default {
  common: {
    welcome: 'مرحبا',
    newFeature: 'ميزة جديدة' // Add Arabic translation
  }
}
```

### 4. Generate TypeScript Types

```bash
npm run i18n:types
```

## Adding New Languages

### 1. Add Language Configuration

Edit `/src/i18n/index.ts`:

```typescript
export const languages = {
  // ... existing languages
  de: { 
    code: 'de', 
    name: 'German', 
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    dir: 'ltr' // or 'rtl' for RTL languages
  },
}
```

### 2. Create Translation File

Create `/src/i18n/locales/de.ts`:

```typescript
export default {
  common: {
    welcome: 'Willkommen',
    greeting: 'Hallo {{name}}',
    // ... all other translations
  },
  // ... other namespaces
}
```

### 3. Import in Main i18n File

Edit `/src/i18n/index.ts`:

```typescript
import deTranslations from './locales/de'

const resources = {
  // ... existing languages
  de: { translation: deTranslations },
}
```

### 4. Add Pluralization Rules (if needed)

For languages with complex pluralization, edit `/src/i18n/pluralization/index.ts`:

```typescript
// Example for German (similar to English)
const germanPluralRules = (count: number): string => {
  return count === 1 ? 'one' : 'other'
}

export const pluralizationResolver = (lng: string) => {
  switch (lng) {
    // ... existing cases
    case 'de':
      return germanPluralRules
    default:
      return defaultPluralRules
  }
}
```

### 5. Update Scripts Configuration

Edit the scripts in `/src/i18n/scripts/` to include the new locale in the `LOCALES` array.

## Best Practices

### 1. Key Naming Conventions

```typescript
// Use nested structure for organization
{
  recipes: {
    title: 'Recipes',
    list: {
      empty: 'No recipes found',
      loading: 'Loading recipes...'
    }
  }
}

// Use descriptive keys
✅ recipes.deleteConfirmation
❌ recipes.conf1
```

### 2. Interpolation Values

```typescript
// Always use meaningful variable names
✅ t('recipes.byAuthor', { author: user.name })
❌ t('recipes.byAuthor', { x: user.name })

// Document expected values in comments
{
  // {{count}} - number of recipes
  // {{author}} - recipe author name
  recipeCount: '{{author}} has {{count}} recipes'
}
```

### 3. Plural Forms

```typescript
// Always provide all required plural forms
{
  recipe_one: '{{count}} recipe',
  recipe_other: '{{count}} recipes', // Required for English
  
  // Czech requires three forms
  recipe_one: '{{count}} recept',
  recipe_few: '{{count}} recepty',
  recipe_many: '{{count}} receptů'
}
```

### 4. Context Variations

```typescript
// Use consistent context suffixes
{
  userJoined_masculine: '{{name}} joined',
  userJoined_feminine: '{{name}} joined',
  
  welcome_formal: 'Welcome, Sir/Madam',
  welcome_informal: 'Hey there!'
}
```

### 5. TypeScript Usage

```typescript
// Use type-safe hooks
import { useTypedTranslation } from '@/i18n/hooks/useTypedTranslation'

function MyComponent() {
  const { t } = useTypedTranslation('recipes')
  
  // TypeScript will validate the key
  return <h1>{t('recipes.title')}</h1>
}
```

## Common Tasks

### Check Translation Coverage

```bash
npm run i18n:coverage
```

This generates a report showing:
- Translation coverage percentage
- Missing translations
- Unused translations

### Extract Used Keys

```bash
npm run i18n:extract
```

This scans your codebase and reports:
- All translation keys used in code
- Keys missing from translation files
- Unused translation keys

### Validate Translations

```bash
npm run i18n:validate
```

This checks for:
- Missing interpolation variables
- Inconsistent punctuation
- Empty translations
- Missing plural forms

### Quick Development Workflow

```bash
# After adding new translation keys in code
npm run i18n:update

# This runs:
# 1. Extract keys from code
# 2. Sync translations
# 3. Generate TypeScript types
```

### Export for Translators

```javascript
// Use the management utilities
import management from '@/i18n/management'

// Export to JSON
await management.exportForTranslators('cs', 'json')

// Export to CSV
await management.exportForTranslators('cs', 'csv')
```

## Troubleshooting

### Translation Not Showing

1. Check the key exists in the translation file
2. Ensure the namespace is loaded
3. Verify the language is set correctly
4. Check for typos in the key name

### Pluralization Not Working

1. Ensure all required plural forms are provided
2. Check the count is being passed correctly
3. Verify the plural rules for the language

### RTL Layout Issues

1. Ensure the language has `dir: 'rtl'` in configuration
2. Use logical CSS properties (`margin-inline-start` instead of `margin-left`)
3. Check the `DirectionalProvider` is wrapping your app

### Type Errors

1. Run `npm run i18n:types` to regenerate types
2. Ensure you're using the typed hooks
3. Check for mismatched namespaces

## Next Steps

- Learn about [advanced features](./i18n-reference.md) like lazy loading and namespace organization
- Read the [migration guide](./i18n-migration.md) for updating existing components
- Explore the [developer reference](./i18n-reference.md) for all hooks and utilities