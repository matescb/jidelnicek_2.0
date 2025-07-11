# i18n Quick Reference

Welcome to the Jídelníček internationalization system. This README provides a quick overview of the i18n features and links to detailed documentation.

## 📚 Documentation

- **[i18n Guide](../../docs/i18n-guide.md)** - Complete guide for using i18n features
- **[Developer Reference](../../docs/i18n-reference.md)** - Comprehensive API reference
- **[Migration Guide](../../docs/i18n-migration.md)** - How to migrate existing components

## 🚀 Quick Start

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

## 🌐 Supported Languages

- **English** (`en`) - Reference language
- **Czech** (`cs`) - Complex pluralization
- **Arabic** (`ar`) - RTL support

## ✨ Key Features

- **Type-safe translations** with TypeScript
- **Complex pluralization** for all languages
- **Context support** (gender, formality)
- **Number & date formatting** with locale awareness
- **RTL support** with directional components
- **Translation management** tools and scripts
- **Lazy loading** for performance

## 📁 Architecture Overview

```
src/i18n/
├── components/          # React components (LanguageSwitcher, etc.)
├── hooks/              # Custom hooks (useTypedTranslation, useFormatting)
├── locales/            # Translation files
│   ├── en.ts          # English translations
│   ├── cs.ts          # Czech translations
│   └── ar.ts          # Arabic translations
├── scripts/            # CLI tools for translation management
├── utils/              # Formatting, validation, helpers
└── types.ts            # TypeScript definitions
```

## 🛠️ Common Tasks

### Add New Translation

1. Add to English file (`/locales/en.ts`)
2. Run `npm run i18n:sync` to sync to other languages
3. Add translations for Czech and Arabic
4. Run `npm run i18n:types` to update TypeScript types

### Check Translation Coverage

```bash
npm run i18n:coverage
```

### Extract and Validate

```bash
npm run i18n:check
```

### Full Update Workflow

```bash
npm run i18n:update
```

## 🔧 Advanced Features

### Pluralization

```tsx
import { PluralText } from '@/components/i18n/PluralComponents'

<PluralText i18nKey="plurals.recipe" count={5} />
// Outputs: "5 receptů" (Czech), "5 recipes" (English)
```

### Context Support

```tsx
import { ContextualText } from '@/components/i18n/PluralComponents'

<ContextualText 
  i18nKey="contexts.userArrived" 
  context={{ gender: 'feminine' }}
  values={{ name: 'Marie' }}
/>
// Outputs: "Marie přišla" (Czech feminine form)
```

### Formatting

```tsx
import { Formatted } from '@/i18n/formatting'

<Formatted.Number value={1234.56} />         // 1,234.56
<Formatted.Currency value={99.99} />         // €99.99
<Formatted.Date value={new Date()} />        // 1/11/2025
<Formatted.RelativeTime value={yesterday} /> // yesterday
```

## 📖 Detailed Feature Documentation

## Pluralization

### Overview

The application supports complex pluralization rules for three languages:

- **English**: Simple rules (one/other)
- **Czech**: Complex rules (one/few/many)
- **Arabic**: Most complex rules (zero/one/two/few/many/other)

### Czech Pluralization Rules

```
1 → one (1 recept)
2-4 → few (2 recepty, 3 recepty, 4 recepty)
5+ → many (5 receptů, 10 receptů)

Special: Numbers ending in 2,3,4 (except 12,13,14) use 'few'
- 22 → few (22 recepty)
- 102 → few (102 recepty)
- 12 → many (12 receptů)
```

### Arabic Pluralization Rules

```
0 → zero (لا توجد وصفات)
1 → one (وصفة واحدة)
2 → two (وصفتان)
3-10 → few (3 وصفات)
11-99 → many (20 وصفة)
100+ → other (100 وصفة)
```

### Translation File Structure

```typescript
// English
plurals: {
  recipe_one: '{{count}} recipe',
  recipe_other: '{{count}} recipes',
}

// Czech
plurals: {
  recipe_one: '{{count}} recept',
  recipe_few: '{{count}} recepty',
  recipe_many: '{{count}} receptů',
}

// Arabic
plurals: {
  recipe_zero: 'لا توجد وصفات',
  recipe_one: 'وصفة واحدة',
  recipe_two: 'وصفتان',
  recipe_few: '{{count}} وصفات',
  recipe_many: '{{count}} وصفة',
  recipe_other: '{{count}} وصفة',
}
```

## Context Support

### Gender Context

Supports masculine, feminine, and neuter forms:

```typescript
// Czech
contexts: {
  userArrived_masculine: '{{name}} přišel',
  userArrived_feminine: '{{name}} přišla',
  userArrived_neuter: '{{name}} přišlo',
}

// Arabic
contexts: {
  userCreated_masculine: '{{name}} أنشأ',
  userCreated_feminine: '{{name}} أنشأت',
}
```

### Formality Context

Supports formal and informal variations:

```typescript
contexts: {
  welcome_formal: 'Dobrý den',     // Czech formal
  welcome_informal: 'Ahoj',        // Czech informal
  
  greeting_formal: 'Dear {{name}}', // English formal
  greeting_informal: 'Hey {{name}}', // English informal
}
```

### Combined Contexts

Can combine multiple contexts:

```typescript
contexts: {
  thankYou_formal_masculine: 'Děkujeme Vám, pane {{name}}',
  thankYou_formal_feminine: 'Děkujeme Vám, paní {{name}}',
  thankYou_informal_masculine: 'Díky, {{name}}',
  thankYou_informal_feminine: 'Díky, {{name}}',
}
```

## Ordinal Numbers

Each language has its own ordinal formatting:

- **English**: 1st, 2nd, 3rd, 4th, 21st, 22nd, etc.
- **Czech**: 1., 2., 3., 4., etc.
- **Arabic**: ال1, ال2, ال3, etc.

## Components

### PluralText

Renders text with proper pluralization:

```tsx
import { PluralText } from '@/components/i18n/PluralComponents'

// Simple usage
<PluralText i18nKey="plurals.recipe" count={5} />
// Output: "5 receptů" (Czech)

// With interpolation
<PluralText 
  i18nKey="plurals.recipesInTrip" 
  count={3}
  values={{ participants: 10 }}
/>
// Output: "Tento výlet obsahuje 3 recepty pro 10 lidí"
```

### ContextualText

Renders text with context variations:

```tsx
import { ContextualText } from '@/components/i18n/PluralComponents'

// Gender context
<ContextualText 
  i18nKey="contexts.userArrived" 
  context={{ gender: 'feminine' }}
  values={{ name: 'Marie' }}
/>
// Output: "Marie přišla" (Czech)

// Formality context
<ContextualText 
  i18nKey="contexts.welcome" 
  context={{ formality: 'formal' }}
/>
// Output: "Dobrý den" (Czech)

// Combined context
<ContextualText 
  i18nKey="contexts.thankYou" 
  context={{ gender: 'masculine', formality: 'formal' }}
  values={{ name: 'Novák' }}
/>
// Output: "Děkujeme Vám, pane Novák" (Czech)
```

### OrdinalText

Renders ordinal numbers:

```tsx
import { OrdinalText } from '@/components/i18n/PluralComponents'

// Just the ordinal
<OrdinalText value={1} />
// Output: "1st" (English), "1." (Czech), "ال1" (Arabic)

// With translation key
<OrdinalText value={3} i18nKey="plurals.place" />
// Output: "3rd place" (English), "3. místo" (Czech)
```

### PluralContextText

Combines pluralization and context:

```tsx
import { PluralContextText } from '@/components/i18n/PluralComponents'

<PluralContextText 
  i18nKey="plurals.participantJoined"
  count={2}
  context={{ gender: 'feminine' }}
/>
// Output varies by language and handles both plural and gender
```

## Hooks

### usePlural

Programmatic access to pluralization:

```tsx
import { usePlural } from '@/components/i18n/PluralComponents'

const Component = () => {
  const { plural, ordinal } = usePlural()
  
  const recipeText = plural('plurals.recipe', 5)
  // "5 receptů" (Czech)
  
  const position = ordinal(1)
  // "1st" (English)
  
  return <div>{recipeText}, {position}</div>
}
```

### useContext

Programmatic access to contextual translations:

```tsx
import { useContext } from '@/components/i18n/PluralComponents'

const Component = () => {
  const { contextual } = useContext()
  
  const greeting = contextual('contexts.greeting', {
    formality: 'formal'
  }, {
    name: 'Smith'
  })
  // "Dear Smith" (English formal)
  
  return <div>{greeting}</div>
}
```

### usePluralContext

Combines plural and context features:

```tsx
import { usePluralContext } from '@/components/i18n/PluralComponents'

const Component = () => {
  const { pluralContext, ordinal } = usePluralContext()
  
  const message = pluralContext(
    'plurals.participantJoined',
    3,
    { gender: 'masculine' }
  )
  
  return <div>{message}</div>
}
```

## Examples

### Recipe Counter

```tsx
const RecipeCounter = ({ count }: { count: number }) => (
  <div>
    <PluralText i18nKey="plurals.recipeCount" count={count} />
  </div>
)

// count=0: "Nemáte žádné recepty" (Czech)
// count=1: "Máte 1 recept" (Czech)
// count=3: "Máte 3 recepty" (Czech)
// count=5: "Máte 5 receptů" (Czech)
```

### User Actions

```tsx
const UserAction = ({ user }: { user: User }) => (
  <ContextualText 
    i18nKey="contexts.userCreated"
    context={{ gender: user.gender }}
    values={{ name: user.name }}
  />
)

// Male user: "Jan vytvořil" (Czech)
// Female user: "Marie vytvořila" (Czech)
```

### Leaderboard

```tsx
const LeaderboardEntry = ({ position, name }: Props) => (
  <div>
    <OrdinalText value={position} i18nKey="plurals.place" />
    {' - '}
    {name}
  </div>
)

// position=1: "1st place - John" (English)
// position=2: "2. místo - Marie" (Czech)
```

### Trip Summary

```tsx
const TripSummary = ({ recipes, participants }: Props) => (
  <PluralText 
    i18nKey="plurals.recipesInTrip"
    count={recipes}
    values={{ participants }}
  />
)

// recipes=0, participants=5: 
// "لا تحتوي هذه الرحلة على أي وصفات" (Arabic)
// recipes=3, participants=10:
// "This trip contains 3 recipes for 10 people" (English)
```

## Best Practices

1. **Always provide all plural forms** for languages that need them
2. **Test with edge cases**: 0, 1, 2, 5, 11, 21, 100, etc.
3. **Use context variations** when the translation depends on user attributes
4. **Combine features** when needed (plural + context)
5. **Leverage TypeScript** for type safety with translation keys
6. **Keep translations consistent** across all plural forms
7. **Document special cases** in your translation files

## Adding New Languages

To add a new language with complex pluralization:

1. Add pluralization rules in `/src/i18n/pluralization/index.ts`
2. Add the language to the `pluralizationResolver`
3. Create translation files with all required plural forms
4. Test with various numbers to ensure correctness

Example for Polish (similar to Czech):

```typescript
export const polishPluralRules = (count: number): string => {
  if (count === 1) return 'one'
  
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastDigit >= 2 && lastDigit <= 4 && 
      (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'few'
  }
  
  return 'many'
}
```

## Troubleshooting

### Common Issues

1. **Missing plural form**: Ensure all required forms are provided
2. **Wrong plural form selected**: Check the pluralization rules
3. **Context not working**: Verify the context key format (e.g., `_masculine`)
4. **Ordinals not displaying**: Check the formatter is registered

### Debug Mode

Enable debug mode to see which keys are being resolved:

```typescript
i18n.init({
  debug: true,
  // ... other options
})
```

This will log all translation lookups to the console.