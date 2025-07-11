# Enhanced i18n Configuration for Jidelnicek 2.0

This directory contains an enhanced internationalization (i18n) setup for the React application with advanced features including namespace support, lazy loading, pluralization, context variations, and more.

## Features

### 1. **Namespace Support**
- Organize translations into logical namespaces (auth, recipes, trips, admin, etc.)
- Lazy load namespaces on demand to improve initial bundle size
- Type-safe namespace references

### 2. **Lazy Loading**
- Translation files are loaded only when needed
- Reduces initial bundle size
- Automatic loading when components request specific namespaces

### 3. **Enhanced Pluralization**
- Support for complex pluralization rules (Czech has 3 forms!)
- Automatic plural form selection based on language rules
- Type-safe plural keys

### 4. **Context Support**
- Gender variations (male/female/neutral)
- Formality levels (formal/informal)
- Automatic context-based translation selection

### 5. **Advanced Formatting**
- Date/time formatting with multiple styles
- Number formatting (decimal, percent, compact, scientific)
- Currency formatting with locale-specific defaults
- List formatting
- Relative time (e.g., "2 hours ago")
- File size formatting
- Duration formatting

### 6. **Backend Integration**
- Sync translations with backend API
- Report missing translations
- Update translations dynamically
- Caching strategies (localStorage, sessionStorage, memory)

### 7. **Developer Tools**
- Missing translation tracking
- Translation validation
- Dev tools UI component
- Export/import functionality

### 8. **Type Safety**
- Full TypeScript support
- Type-safe translation keys
- Autocomplete for translation keys
- Type checking for interpolation values

## Usage

### Basic Setup

```typescript
// Import the enhanced configuration
import i18n from '@/i18n/index.enhanced'

// In your main App component
import { I18nextProvider } from 'react-i18next'

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      {/* Your app */}
    </I18nextProvider>
  )
}
```

### Using Translations

#### Basic Usage
```typescript
import { useEnhancedTranslation } from '@/i18n/hooks/useTypedTranslation'

function MyComponent() {
  const { t } = useEnhancedTranslation('recipes')
  
  return <h1>{t('recipes.title')}</h1>
}
```

#### With Context (Gender/Formality)
```typescript
const { t, tContext } = useContextualTranslation('auth', {
  gender: 'female',
  formal: true
})

// Uses context automatically
<p>{t('auth.welcome')}</p>

// Override context
<p>{tContext('auth.welcome', { gender: 'male' })}</p>
```

#### Pluralization
```typescript
const { tPlural } = usePluralTranslation('recipes')

<p>{tPlural('recipes.ingredient', count)}</p>
// Outputs: "1 ingredient" or "5 ingredients"
```

#### Advanced Formatting
```typescript
const { tFormat } = useFormattedTranslation('common')

<p>{tFormat('common.date', { date: new Date() }, { date: 'date:long' })}</p>
<p>{tFormat('common.price', { price: 29.99 }, { price: 'currency:EUR' })}</p>
```

### Language Switching

```typescript
import { LanguageSwitcher } from '@/i18n/components/LanguageSwitcher'

// Dropdown variant
<LanguageSwitcher variant="dropdown" />

// Inline buttons
<LanguageSwitcher variant="inline" />

// Modal variant
<LanguageSwitcher variant="modal" />

// Programmatic
const { changeLanguage } = useEnhancedTranslation()
await changeLanguage('cs')
```

### Development Tools

```typescript
import { TranslationDevTools } from '@/i18n/components/TranslationDevTools'

// Add to your app in development
{process.env.NODE_ENV === 'development' && (
  <TranslationDevTools position="bottom-right" />
)}
```

## File Structure

```
i18n/
├── index.ts                    # Current basic configuration
├── index.enhanced.ts           # Enhanced configuration (use this!)
├── types.ts                    # TypeScript types and interfaces
├── components/
│   ├── LanguageSwitcher.tsx  # Language switching UI
│   └── TranslationDevTools.tsx # Dev tools UI
├── hooks/
│   └── useTypedTranslation.ts # Type-safe React hooks
├── utils/
│   ├── backend.ts             # Backend integration
│   ├── formatting.ts          # Format functions
│   ├── lazy-loading.ts        # Namespace lazy loading
│   ├── missing-tracker.ts     # Track missing translations
│   ├── pluralization.ts       # Pluralization rules
│   └── validation.ts          # Translation validation
├── locales/
│   ├── en.ts                  # English (legacy, for backwards compatibility)
│   ├── cs.ts                  # Czech (legacy, for backwards compatibility)
│   └── namespaces/            # New namespace-based structure
│       ├── common/
│       ├── auth/
│       ├── recipes/
│       ├── trips/
│       ├── admin/
│       ├── validation/
│       └── errors/
└── examples/
    └── usage.tsx              # Usage examples

```

## Migration Guide

To migrate from the current setup to the enhanced configuration:

1. **Update imports:**
   ```typescript
   // Old
   import i18n from '@/i18n'
   
   // New
   import i18n from '@/i18n/index.enhanced'
   ```

2. **Update hooks:**
   ```typescript
   // Old
   const { t } = useTranslation()
   
   // New (with type safety!)
   const { t } = useEnhancedTranslation('recipes')
   ```

3. **Split translations into namespaces:**
   - Move auth-related translations to `locales/namespaces/auth/`
   - Move recipe translations to `locales/namespaces/recipes/`
   - etc.

4. **Add context variations:**
   ```typescript
   // Add gender/formal variations
   welcome: 'Welcome back!',
   welcome_male: 'Welcome back, sir!',
   welcome_female: 'Welcome back, madam!',
   welcome_formal: 'Welcome back, esteemed user!',
   ```

5. **Update plurals:**
   ```typescript
   // Old
   ingredients: '{{count}} ingredients',
   
   // New (supports Czech pluralization)
   ingredient_one: '{{count}} ingredient',
   ingredient_few: '{{count}} ingredience',  // Czech 2-4
   ingredient_many: '{{count}} ingrediencí', // Czech 5+
   ```

## Configuration

### Environment Variables

```env
# Enable backend sync
VITE_I18N_USE_BACKEND=true
VITE_I18N_API_URL=https://api.example.com/translations
VITE_I18N_API_KEY=your-api-key
```

### Backend API Endpoints

If using backend sync, implement these endpoints:

- `GET /api/translations?language=en&namespace=recipes` - Fetch translations
- `POST /api/translations/missing` - Report missing translations
- `POST /api/translations/update` - Update a translation

## Best Practices

1. **Always use namespaces** - Don't put everything in 'common'
2. **Load only what you need** - Use namespace-specific hooks
3. **Provide context** - Use gender/formal variations where appropriate
4. **Track missing translations** - Use dev tools in development
5. **Validate regularly** - Run validation to ensure consistency
6. **Use type-safe hooks** - Leverage TypeScript for better DX

## Troubleshooting

### Translations not loading
- Check if namespace is properly imported
- Verify lazy loading is working
- Check browser console for errors

### Type errors
- Run `npm run type-check`
- Ensure translation keys match type definitions
- Update types when adding new translations

### Performance issues
- Enable lazy loading for large namespaces
- Use production build for testing
- Check if backend sync is causing delays

## Future Enhancements

- [ ] Right-to-left (RTL) language support
- [ ] Translation memory integration
- [ ] A/B testing for translations
- [ ] Machine translation integration
- [ ] Crowdsourced translation platform
- [ ] Version control for translations
- [ ] Translation analytics