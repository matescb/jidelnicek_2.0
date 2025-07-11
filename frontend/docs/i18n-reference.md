# i18n Developer Reference

This is a comprehensive reference for all i18n hooks, components, utilities, and scripts available in the Jídelníček application.

## Table of Contents

1. [Hooks](#hooks)
2. [Components](#components)
3. [Formatting Utilities](#formatting-utilities)
4. [Translation Management Scripts](#translation-management-scripts)
5. [TypeScript Integration](#typescript-integration)
6. [Architecture](#architecture)

## Hooks

### useTranslation

The basic hook from react-i18next with our configuration.

```tsx
import { useTranslation } from 'react-i18next'

function Component() {
  const { t, i18n, ready } = useTranslation()
  
  return (
    <div>
      <p>{t('common.welcome')}</p>
      <p>Current language: {i18n.language}</p>
      <button onClick={() => i18n.changeLanguage('cs')}>
        Switch to Czech
      </button>
    </div>
  )
}
```

### useTypedTranslation

Type-safe translation hook with automatic namespace loading.

```tsx
import { useTypedTranslation } from '@/i18n/hooks/useTypedTranslation'

function Component() {
  const { t, i18n, ready } = useTypedTranslation('recipes')
  
  // TypeScript validates the key
  return <h1>{t('recipes.title')}</h1>
}

// With multiple namespaces
function MultiNamespaceComponent() {
  const { t } = useTypedTranslation(['common', 'recipes'])
  
  return (
    <>
      <h1>{t('common:welcome')}</h1>
      <p>{t('recipes:description')}</p>
    </>
  )
}
```

### useContextualTranslation

Hook with built-in context support for gender and formality.

```tsx
import { useContextualTranslation } from '@/i18n/hooks/useTypedTranslation'

function Component({ user }) {
  const { t, tWithContext } = useContextualTranslation('common', {
    formality: user.prefersFormal ? 'formal' : 'informal'
  })
  
  return (
    <div>
      {/* Uses default context */}
      <p>{t('common.greeting', { name: user.name })}</p>
      
      {/* Override context */}
      <p>{tWithContext(
        'common.farewell',
        { gender: user.gender },
        { name: user.name }
      )}</p>
    </div>
  )
}
```

### usePluralTranslation

Specialized hook for pluralization.

```tsx
import { usePluralTranslation } from '@/i18n/hooks/useTypedTranslation'

function Component({ items }) {
  const { tPlural, t } = usePluralTranslation('recipes')
  
  return (
    <div>
      <h2>{t('recipes.title')}</h2>
      <p>{tPlural('recipes.count', items.length)}</p>
    </div>
  )
}
```

### useEnhancedTranslation

Combined hook with all features.

```tsx
import { useEnhancedTranslation } from '@/i18n/hooks/useTypedTranslation'

function Component() {
  const {
    t,
    tContext,
    tPlural,
    tFormat,
    exists,
    language,
    changeLanguage,
    ready
  } = useEnhancedTranslation('common')
  
  if (!ready) return <Loading />
  
  return (
    <div>
      {/* Basic translation */}
      <p>{t('common.welcome')}</p>
      
      {/* With context */}
      <p>{tContext('common.greeting', { formality: 'formal' })}</p>
      
      {/* With pluralization */}
      <p>{tPlural('common.items', 5)}</p>
      
      {/* With formatting */}
      <p>{tFormat('common.date', { date: new Date() }, { date: 'date' })}</p>
      
      {/* Check if key exists */}
      {exists('common.beta') && <BetaFeature />}
    </div>
  )
}
```

### Formatting Hooks

#### useNumberFormat

```tsx
import { useNumberFormat } from '@/i18n/hooks/useFormatting'

function Component() {
  const {
    format,
    formatCompact,
    formatDecimal,
    formatOrdinal,
    formatBytes,
    locale
  } = useNumberFormat()
  
  return (
    <div>
      <p>{format(1234.56)}</p>                    {/* 1,234.56 */}
      <p>{formatCompact(1500000)}</p>             {/* 1.5M */}
      <p>{formatDecimal(1.5, 2, 2)}</p>           {/* 1.50 */}
      <p>{formatOrdinal(1)}</p>                   {/* 1st */}
      <p>{formatBytes(1024)}</p>                  {/* 1 KB */}
    </div>
  )
}
```

#### useCurrencyFormat

```tsx
import { useCurrencyFormat } from '@/i18n/hooks/useFormatting'

function Component() {
  const { format, formatPercent, currency } = useCurrencyFormat('EUR')
  
  return (
    <div>
      <p>{format(99.99)}</p>                      {/* €99.99 */}
      <p>{format(100, 'USD')}</p>                 {/* $100.00 */}
      <p>{formatPercent(0.15)}</p>                {/* 15% */}
      <p>Default currency: {currency}</p>
    </div>
  )
}
```

#### useDateFormat

```tsx
import { useDateFormat } from '@/i18n/hooks/useFormatting'

function Component() {
  const {
    format,
    formatDateTime,
    formatTime,
    formatDuration
  } = useDateFormat()
  
  const now = new Date()
  
  return (
    <div>
      <p>{format(now)}</p>                        {/* 1/11/2025 */}
      <p>{format(now, 'full')}</p>                {/* Friday, January 11, 2025 */}
      <p>{formatDateTime(now, 'long', 'short')}</p> {/* January 11, 2025 at 3:30 PM */}
      <p>{formatTime(now)}</p>                    {/* 3:30 PM */}
      <p>{formatDuration(90)}</p>                 {/* 1 hour 30 minutes */}
    </div>
  )
}
```

#### useRelativeTime

```tsx
import { useRelativeTime } from '@/i18n/hooks/useFormatting'

function Component() {
  const { format, formatRelative } = useRelativeTime()
  
  const yesterday = new Date(Date.now() - 86400000)
  const lastWeek = new Date(Date.now() - 604800000)
  
  return (
    <div>
      <p>{format(yesterday)}</p>                  {/* yesterday */}
      <p>{format(lastWeek)}</p>                   {/* 7 days ago */}
      <p>{formatRelative(yesterday)}</p>          {/* yesterday at 3:30 PM */}
    </div>
  )
}
```

#### useListFormat

```tsx
import { useListFormat } from '@/i18n/hooks/useFormatting'

function Component() {
  const { format } = useListFormat({ style: 'long', type: 'conjunction' })
  
  const items = ['Apple', 'Banana', 'Orange']
  
  return (
    <div>
      <p>{format(items)}</p>                      {/* Apple, Banana, and Orange */}
      <p>{format(items, { type: 'disjunction' })}</p> {/* Apple, Banana, or Orange */}
    </div>
  )
}
```

### Custom Hooks

#### usePlural

```tsx
import { usePlural } from '@/components/i18n/PluralComponents'

function Component() {
  const { plural, ordinal } = usePlural()
  
  return (
    <div>
      <p>{plural('plurals.recipe', 5)}</p>
      <p>{ordinal(1)} place</p>
    </div>
  )
}
```

#### useContext

```tsx
import { useContext } from '@/components/i18n/PluralComponents'

function Component() {
  const { contextual } = useContext()
  
  const greeting = contextual(
    'contexts.greeting',
    { formality: 'formal' },
    { name: 'Dr. Smith' }
  )
  
  return <p>{greeting}</p>
}
```

## Components

### Language Switcher Components

#### LanguageSwitcher

Full-featured language switcher with multiple variants.

```tsx
import { LanguageSwitcher } from '@/i18n/components/LanguageSwitcher'

// Dropdown variant (default)
<LanguageSwitcher />

// Inline buttons
<LanguageSwitcher variant="inline" />

// Modal variant
<LanguageSwitcher variant="modal" />

// Customization options
<LanguageSwitcher
  showFlag={true}
  showName={false}
  showNativeName={true}
  className="my-custom-class"
  onLanguageChange={(lang) => console.log('Changed to:', lang)}
/>
```

#### CompactLanguageSwitcher

Minimal language switcher for mobile/compact layouts.

```tsx
import { CompactLanguageSwitcher } from '@/i18n/components/LanguageSwitcher'

// Shows only flag, cycles through languages on click
<CompactLanguageSwitcher className="fixed bottom-4 right-4" />
```

### Translation Components

#### PluralText

Handles pluralization automatically.

```tsx
import { PluralText } from '@/components/i18n/PluralComponents'

// Simple usage
<PluralText i18nKey="plurals.recipe" count={5} />

// With interpolation
<PluralText 
  i18nKey="plurals.recipesInTrip" 
  count={3}
  values={{ participants: 10 }}
/>

// With className
<PluralText 
  i18nKey="plurals.items" 
  count={itemCount}
  className="text-gray-600"
/>
```

#### ContextualText

Handles context variations (gender, formality).

```tsx
import { ContextualText } from '@/components/i18n/PluralComponents'

// Gender context
<ContextualText 
  i18nKey="contexts.userArrived" 
  context={{ gender: 'feminine' }}
  values={{ name: 'Marie' }}
/>

// Formality context
<ContextualText 
  i18nKey="contexts.welcome" 
  context={{ formality: 'formal' }}
/>

// Combined contexts
<ContextualText 
  i18nKey="contexts.thankYou" 
  context={{ gender: 'masculine', formality: 'formal' }}
  values={{ name: 'Mr. Smith' }}
/>
```

#### OrdinalText

Formats ordinal numbers.

```tsx
import { OrdinalText } from '@/components/i18n/PluralComponents'

// Just the ordinal
<OrdinalText value={1} />                          // "1st"

// With translation key
<OrdinalText value={3} i18nKey="plurals.place" /> // "3rd place"

// With className
<OrdinalText value={position} className="font-bold" />
```

#### PluralContextText

Combines pluralization and context.

```tsx
import { PluralContextText } from '@/components/i18n/PluralComponents'

<PluralContextText 
  i18nKey="plurals.participantJoined"
  count={2}
  context={{ gender: 'feminine' }}
  values={{ eventName: 'Summer Camp' }}
/>
```

### Formatting Components

All formatting components are available under the `Formatted` namespace:

```tsx
import { Formatted } from '@/i18n/formatting'

// Numbers
<Formatted.Number value={1234.56} />
<Formatted.Number value={1500000} compact />
<Formatted.Number value={1} ordinal />
<Formatted.Number value={1024} bytes />

// Currency
<Formatted.Currency value={99.99} />
<Formatted.Currency value={100} currency="USD" />

// Percentages
<Formatted.Percent value={0.856} />
<Formatted.Percent value={0.5} options={{ minimumFractionDigits: 0 }} />

// Dates
<Formatted.Date value={new Date()} />
<Formatted.Date value={date} format="full" />

// Date & Time
<Formatted.DateTime value={new Date()} />
<Formatted.DateTime value={date} dateStyle="long" timeStyle="short" />

// Time
<Formatted.Time value={new Date()} />
<Formatted.Time value={date} options={{ hour12: false }} />

// Relative Time
<Formatted.RelativeTime value={yesterday} />
<Formatted.RelativeTime value={date} style="relative" />

// Duration
<Formatted.Duration minutes={90} />

// Lists
<Formatted.List items={['Apple', 'Banana', 'Orange']} />
<Formatted.List 
  items={names} 
  options={{ style: 'narrow', type: 'unit' }} 
/>
```

### RTL Components

#### DirectionalProvider

Wraps the app to provide RTL support.

```tsx
import { DirectionalProvider } from '@/components/rtl'

function App() {
  return (
    <DirectionalProvider>
      <YourApp />
    </DirectionalProvider>
  )
}
```

#### DirectionalBox

Direction-aware box component.

```tsx
import { DirectionalBox } from '@/components/rtl'

<DirectionalBox
  marginStart="1rem"      // margin-inline-start
  paddingEnd="2rem"       // padding-inline-end
  borderStart="2px solid" // border-inline-start
  textAlign="start"       // text-align: start
  mirrorTransform         // Flips horizontally in RTL
  className="my-class"
>
  Content
</DirectionalBox>
```

### Development Tools

#### TranslationDevTools

Development-only component for debugging translations.

```tsx
import { TranslationDevTools } from '@/i18n/components/TranslationDevTools'

// Add to your app in development
{process.env.NODE_ENV === 'development' && <TranslationDevTools />}

// Features:
// - Missing key tracker
// - Language switcher
// - Namespace inspector
// - Translation key search
// - Export/import tools
```

## Formatting Utilities

### Number Formatting

```typescript
import { 
  formatNumber,
  formatCompactNumber,
  formatDecimal,
  formatOrdinal,
  formatBytes 
} from '@/i18n/formatting'

// Basic number formatting
formatNumber(1234.56, 'en')              // "1,234.56"
formatNumber(1234.56, 'cs')              // "1 234,56"

// Compact numbers
formatCompactNumber(1500000, 'en')       // "1.5M"
formatCompactNumber(1500, 'en')          // "1.5K"

// Decimals with precision
formatDecimal(1.5, 'en', 2, 2)          // "1.50"
formatDecimal(1.234, 'en', 0, 2)        // "1.23"

// Ordinals
formatOrdinal(1, 'en')                   // "1st"
formatOrdinal(2, 'en')                   // "2nd"
formatOrdinal(3, 'cs')                   // "3."

// Bytes
formatBytes(1024, 'en')                  // "1 KB"
formatBytes(1536, 'en', 1)               // "1.5 KB"
```

### Currency Formatting

```typescript
import { formatCurrency, formatPercent } from '@/i18n/formatting'

// Currency
formatCurrency(99.99, 'en', 'USD')       // "$99.99"
formatCurrency(99.99, 'cs', 'CZK')       // "99,99 Kč"
formatCurrency(99.99, 'ar', 'SAR')       // "٩٩٫٩٩ ر.س"

// Percentages
formatPercent(0.856, 'en')               // "85.6%"
formatPercent(0.5, 'en', { minimumFractionDigits: 0 }) // "50%"
```

### Date Formatting

```typescript
import { 
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatRelativeDate,
  formatDuration 
} from '@/i18n/formatting'

const date = new Date('2025-01-11T15:30:00')

// Date formatting
formatDate(date, 'en')                   // "1/11/2025"
formatDate(date, 'en', 'full')           // "Saturday, January 11, 2025"
formatDate(date, 'cs')                   // "11. 1. 2025"

// DateTime formatting
formatDateTime(date, 'en')               // "1/11/2025, 3:30 PM"
formatDateTime(date, 'en', 'long', 'short') // "January 11, 2025 at 3:30 PM"

// Time formatting
formatTime(date, 'en')                   // "3:30 PM"
formatTime(date, 'en', { hour12: false }) // "15:30"

// Relative time
formatRelativeTime(yesterday, 'en')      // "yesterday"
formatRelativeTime(lastWeek, 'en')       // "7 days ago"

// Relative date
formatRelativeDate(yesterday, 'en')      // "yesterday at 3:30 PM"

// Duration
formatDuration(90, 'en')                 // "1 hour 30 minutes"
formatDuration(45, 'cs')                 // "45 minut"
```

### List Formatting

```typescript
import { formatList } from '@/i18n/formatting'

const items = ['Apple', 'Banana', 'Orange']

// Conjunction (and)
formatList(items, 'en')                  // "Apple, Banana, and Orange"
formatList(items, 'cs')                  // "Apple, Banana a Orange"

// Disjunction (or)
formatList(items, 'en', { type: 'disjunction' }) // "Apple, Banana, or Orange"

// Unit list
formatList(items, 'en', { type: 'unit' }) // "Apple, Banana, Orange"
```

## Translation Management Scripts

### Extract Keys

Scan codebase for translation key usage.

```bash
npm run i18n:extract

# Output:
# - src/i18n/reports/extraction-report.json
# - src/i18n/reports/key-usage.json
```

Report includes:
- All translation keys found in code
- File locations for each key
- Missing translations per locale
- Unused translation keys

### Validate Translations

Check translation files for issues.

```bash
npm run i18n:validate

# Checks for:
# - Missing interpolation variables
# - HTML tag consistency
# - Whitespace issues
# - Punctuation consistency
# - Missing plural forms
# - Empty values
```

### Sync Translations

Synchronize translations between locales.

```bash
# Interactive mode
npm run i18n:sync

# Non-interactive mode
npm run i18n:sync:auto

# Options
npm run i18n:sync -- --no-add           # Don't add missing keys
npm run i18n:sync -- --remove-extra     # Remove extra keys
npm run i18n:sync -- --no-update-empty  # Don't update empty values
```

### Generate Types

Generate TypeScript types from translations.

```bash
npm run i18n:types

# Generates:
# - Translation key types
# - Namespace types
# - Plural key types
# - Full type definitions
```

### Coverage Report

Generate translation coverage statistics.

```bash
npm run i18n:coverage

# Output:
# - src/i18n/reports/coverage-report.json
# - src/i18n/reports/coverage-report.md
```

### Workflow Commands

```bash
# Check translations (extract + validate)
npm run i18n:check

# Update translations (extract + sync + types)
npm run i18n:update
```

### CLI Tool

Interactive command-line interface for all operations.

```bash
npm run i18n:cli

# Menu options:
# 1. Extract translation keys
# 2. Validate translations
# 3. Sync translations
# 4. Generate TypeScript types
# 5. Generate coverage report
# 6. Full update (extract + sync + types)
# 7. Export translations for translators
# 8. Import translations from file
```

## TypeScript Integration

### Type Definitions

The system generates complete TypeScript types from your translations:

```typescript
// Auto-generated types
export interface TranslationResources {
  common: {
    welcome: string
    greeting: string
    // ... all your keys
  }
  recipes: {
    title: string
    // ... all your keys
  }
}

// Namespace types
export type Namespace = 'common' | 'recipes' | 'trips' | 'admin'

// Translation key types
export type TranslationKey = 
  | 'common.welcome'
  | 'common.greeting'
  | 'recipes.title'
  // ... all keys

// Plural key types
export type PluralKey =
  | 'plurals.recipe'
  | 'plurals.participant'
  // ... all plural keys
```

### Type-Safe Usage

```typescript
import { useTypedTranslation } from '@/i18n/hooks/useTypedTranslation'
import type { Namespace, TranslationKey } from '@/i18n/types'

// Component with type-safe translations
function MyComponent() {
  const { t } = useTypedTranslation('recipes')
  
  // ✅ TypeScript validates these keys
  const title = t('recipes.title')
  const description = t('recipes.description')
  
  // ❌ TypeScript error: invalid key
  const invalid = t('recipes.nonexistent')
}

// Utility function with type safety
function getTranslation(key: TranslationKey): string {
  return i18n.t(key)
}

// Type-safe namespace loading
async function loadNamespace(ns: Namespace) {
  await i18n.loadNamespaces(ns)
}
```

### Context Types

```typescript
export interface TranslationContext {
  gender?: 'masculine' | 'feminine' | 'neuter'
  formality?: 'formal' | 'informal'
}

// Usage
const { tContext } = useEnhancedTranslation()
tContext('common.greeting', { 
  gender: 'feminine',    // ✅ Type-safe
  formality: 'formal'    // ✅ Type-safe
})
```

## Architecture

### Translation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Translation Key Usage Flow                   │
└─────────────────────────────────────────────────────────────────┘

1. Component requests translation:
   Component ──> useTranslation() ──> t('common.welcome')
                        │
                        ▼
2. Key resolution:
   i18next ──> Check namespace ──> Check language ──> Check key
                        │                  │               │
                        ▼                  ▼               ▼
                   'common'            'cs'         'welcome'
                        │                  │               │
                        └──────────────────┴───────────────┘
                                          │
                                          ▼
3. Feature processing:
   ┌─────────────────────────────────────────────┐
   │  Pluralization?  ──> Apply plural rules     │
   │  Context?        ──> Apply context suffix   │
   │  Interpolation?  ──> Replace variables      │
   │  Formatting?     ──> Apply formatters       │
   └─────────────────────────────────────────────┘
                        │
                        ▼
4. Return translated string:
   "Vítejte" (Czech) or "Welcome" (English) or "مرحبا" (Arabic)
```

### Directory Structure

```
src/i18n/
├── index.ts                 # Main i18n configuration
├── index.enhanced.ts        # Enhanced features & namespace loading
├── types.ts                 # TypeScript type definitions
├── components/              # i18n React components
│   ├── LanguageSwitcher.tsx
│   └── TranslationDevTools.tsx
├── context/                 # React context for i18n
│   └── index.ts
├── hooks/                   # Custom React hooks
│   ├── index.ts
│   ├── useFormatting.ts
│   ├── useTranslation.ts
│   └── useTypedTranslation.ts
├── locales/                 # Translation files
│   ├── en.ts               # English (reference)
│   ├── cs.ts               # Czech
│   ├── ar.ts               # Arabic
│   └── namespaces/         # Lazy-loaded namespaces
│       ├── admin/
│       ├── auth/
│       ├── recipes/
│       └── trips/
├── management/              # Translation management utilities
│   └── index.ts
├── pluralization/           # Pluralization rules
│   └── index.ts
├── rtl/                     # RTL support
│   ├── index.ts
│   └── README.md
├── scripts/                 # CLI tools
│   ├── cli.js
│   ├── extract-keys.js
│   ├── generate-types.js
│   ├── sync-translations.js
│   └── validate-translations.js
├── utils/                   # Utility functions
│   ├── formatting.ts
│   ├── helpers.ts
│   ├── lazy-loading.ts
│   ├── missing-tracker.ts
│   ├── pluralization.ts
│   └── validation.ts
└── reports/                 # Generated reports
    ├── coverage-report.json
    ├── extraction-report.json
    └── validation-report.json
```

### Configuration

The main configuration is in `src/i18n/index.ts`:

```typescript
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    
    // Detection
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'jidelnicek-language',
    },
    
    // Interpolation
    interpolation: {
      escapeValue: false,
      format: (value, format, lng) => {
        // Custom formatting logic
      }
    },
    
    // Pluralization
    pluralSeparator: '_',
    contextSeparator: '_',
    pluralResolver: (count, options) => {
      // Custom plural rules
    },
    
    // React options
    react: {
      useSuspense: false,
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'u'],
    }
  })
```

### Namespace Loading

Namespaces can be loaded on-demand:

```typescript
import { loadNamespaces, isNamespaceLoaded } from '@/i18n/index.enhanced'

// Load single namespace
await loadNamespaces(['recipes'])

// Load multiple namespaces
await loadNamespaces(['recipes', 'trips'])

// Check if loaded
if (!isNamespaceLoaded('admin')) {
  await loadNamespaces(['admin'])
}

// Preload all namespaces
await preloadAllNamespaces()
```

### Adding New Features

To add new i18n features:

1. **New Hook**: Add to `/hooks/` directory
2. **New Component**: Add to `/components/i18n/`
3. **New Utility**: Add to `/utils/`
4. **New Script**: Add to `/scripts/`
5. **Update Types**: Run `npm run i18n:types`
6. **Update Documentation**: Update this reference

### Performance Considerations

1. **Lazy Loading**: Large namespaces are loaded on-demand
2. **Memoization**: Components use React.memo for performance
3. **Caching**: Browser caches language preference
4. **Bundle Size**: Each locale is a separate bundle
5. **Type Generation**: Types are generated at build time

### Testing

```typescript
// Mock i18n in tests
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: jest.fn(),
      language: 'en'
    }
  })
}))

// Test with different languages
describe('Component', () => {
  it('renders in Czech', () => {
    const { t } = useTranslation()
    jest.mocked(t).mockImplementation((key) => {
      const translations = { 'common.welcome': 'Vítejte' }
      return translations[key] || key
    })
    
    // Test your component
  })
})
```