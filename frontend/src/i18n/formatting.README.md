# i18n Formatting Utilities

This module provides comprehensive internationalization formatting utilities for the Jidelnicek application, supporting both English and Czech locales.

## Features

- **Number Formatting**: Standard, compact, decimal, ordinal, and byte formatting
- **Currency Formatting**: Locale-aware currency display (EUR for English, CZK for Czech)
- **Date/Time Formatting**: Various date and time formats using date-fns
- **Relative Time**: "2 hours ago" style formatting
- **List Formatting**: Proper grammatical list joining
- **Duration Formatting**: Human-readable duration display for cooking times

## Installation

All utilities are already integrated with the existing i18n setup. No additional installation required.

## Usage

### React Hooks

The recommended way to use formatting in React components is through the provided hooks:

```tsx
import { useNumberFormat, useCurrencyFormat, useDateFormat } from '@/i18n/formatting'

function MyComponent() {
  const numberFormat = useNumberFormat()
  const currencyFormat = useCurrencyFormat()
  const dateFormat = useDateFormat()
  
  return (
    <div>
      <p>Number: {numberFormat.format(1234.56)}</p>
      <p>Currency: {currencyFormat.format(99.99)}</p>
      <p>Date: {dateFormat.format(new Date())}</p>
    </div>
  )
}
```

### Formatted Components

For simple formatting needs, use the pre-built components:

```tsx
import { Formatted } from '@/i18n/formatting'

function RecipeCard({ price, cookingTime, createdAt }) {
  return (
    <div>
      <Formatted.Currency value={price} />
      <Formatted.Duration minutes={cookingTime} />
      <Formatted.RelativeTime value={createdAt} />
    </div>
  )
}
```

### Direct Utility Functions

For non-React contexts or advanced use cases:

```tsx
import { formatNumber, formatCurrency, formatDate } from '@/i18n/formatting'

// Use with specific locale
const formattedNumber = formatNumber(1234.56, 'cs')
const formattedPrice = formatCurrency(99.99, 'en', 'USD')
const formattedDate = formatDate(new Date(), 'cs', 'yyyy-MM-dd')
```

## Hook Reference

### useNumberFormat

```tsx
const {
  format,         // Basic number formatting
  formatCompact,  // Compact notation (1.2K, 1.2M)
  formatDecimal,  // Decimal with precision control
  formatOrdinal,  // Ordinal numbers (1st, 2nd, 3rd)
  formatBytes,    // Byte size formatting
  locale          // Current locale
} = useNumberFormat(options?)
```

### useCurrencyFormat

```tsx
const {
  format,         // Currency formatting
  formatPercent,  // Percentage formatting
  currency,       // Default currency code
  locale          // Current locale
} = useCurrencyFormat(currency?, options?)
```

### useDateFormat

```tsx
const {
  format,         // Date formatting with date-fns
  formatDateTime, // Combined date and time
  formatTime,     // Time only
  formatDuration, // Duration in minutes to human-readable
  locale          // Current locale
} = useDateFormat(defaultFormatString?)
```

### useRelativeTime

```tsx
const {
  format,         // Relative time distance ("2 hours ago")
  formatRelative, // Relative date ("yesterday at 3:00 PM")
  locale          // Current locale
} = useRelativeTime()
```

### useListFormat

```tsx
const {
  format,  // List formatting with proper grammar
  locale   // Current locale
} = useListFormat(options?)
```

### useFormatting (Combined Hook)

```tsx
const {
  number,       // All number formatting functions
  currency,     // All currency formatting functions
  date,         // All date formatting functions
  relativeTime, // All relative time functions
  list          // List formatting functions
} = useFormatting()
```

## Component Reference

### Number Components

```tsx
// Basic number
<Formatted.Number value={1234.56} />

// Compact notation
<Formatted.Number value={1234567} compact />

// With decimal precision
<Formatted.Number value={1234.56} decimals={{ min: 2, max: 2 }} />

// Ordinal
<Formatted.Number value={21} ordinal />

// Bytes
<Formatted.Number value={1024 * 1024} bytes />
```

### Currency Components

```tsx
// Default locale currency
<Formatted.Currency value={99.99} />

// Specific currency
<Formatted.Currency value={99.99} currency="USD" />

// Custom options
<Formatted.Currency 
  value={99.99} 
  options={{ minimumFractionDigits: 0 }} 
/>

// Percentage
<Formatted.Percent value={0.15} />
```

### Date/Time Components

```tsx
// Date only
<Formatted.Date value={new Date()} />

// Custom format
<Formatted.Date value={date} format="yyyy-MM-dd" />

// Date and time
<Formatted.DateTime value={date} />

// With style options
<Formatted.DateTime 
  value={date} 
  dateStyle="full" 
  timeStyle="short" 
/>

// Time only
<Formatted.Time value={date} />

// Duration (cooking time)
<Formatted.Duration minutes={90} />
```

### Relative Time Components

```tsx
// Time distance
<Formatted.RelativeTime value={pastDate} />

// Relative format
<Formatted.RelativeTime value={pastDate} style="relative" />

// With base date
<Formatted.RelativeTime value={date} baseDate={referenceDate} />
```

### List Component

```tsx
// Basic list
<Formatted.List items={['Apple', 'Banana', 'Orange']} />

// Disjunction (or)
<Formatted.List 
  items={items} 
  options={{ type: 'disjunction' }} 
/>

// Unit list
<Formatted.List 
  items={items} 
  options={{ type: 'unit' }} 
/>
```

## Locale-Specific Behavior

### Currency Defaults
- English (`en`): EUR (€)
- Czech (`cs`): CZK (Kč)

### Number Formatting
- English: 1,234.56
- Czech: 1 234,56

### List Formatting
- English: "Apple, Banana, and Orange"
- Czech: "Jablko, Banán a Pomeranč"

### Duration Formatting
- English: "1 hour and 30 minutes"
- Czech: "1 hodina a 30 minut"

## Error Handling

All formatting functions include error handling and fallbacks:

- Invalid dates return "Invalid Date"
- Invalid numbers return the original value as string
- Unsupported locales fall back to English
- Empty lists return empty string

## Performance Considerations

- All hooks use `useCallback` and `useMemo` for optimization
- Components are wrapped with `React.memo`
- Formatting functions are pure and can be memoized
- Consider using the combined `useFormatting` hook to reduce hook calls

## Examples

### Recipe Card Example

```tsx
import { Formatted } from '@/i18n/formatting'

export const RecipeCard = ({ recipe }) => (
  <div className="recipe-card">
    <h3>{recipe.title}</h3>
    <div className="recipe-details">
      <span>Price: <Formatted.Currency value={recipe.price} /></span>
      <span>Time: <Formatted.Duration minutes={recipe.cookingTime} /></span>
      <span>Added: <Formatted.RelativeTime value={recipe.createdAt} /></span>
    </div>
    <div className="ingredients">
      Ingredients: <Formatted.List items={recipe.ingredients} />
    </div>
  </div>
)
```

### Dashboard Statistics Example

```tsx
import { useFormatting } from '@/i18n/formatting'

export const DashboardStats = ({ stats }) => {
  const formatting = useFormatting()
  
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h4>Total Revenue</h4>
        <p className="stat-value">
          {formatting.currency.format(stats.revenue)}
        </p>
      </div>
      <div className="stat-card">
        <h4>Orders Today</h4>
        <p className="stat-value">
          {formatting.number.formatCompact(stats.orders)}
        </p>
      </div>
      <div className="stat-card">
        <h4>Avg. Cooking Time</h4>
        <p className="stat-value">
          {formatting.date.formatDuration(stats.avgCookingTime)}
        </p>
      </div>
    </div>
  )
}
```

### Form Input Example

```tsx
import { useCurrencyFormat } from '@/i18n/formatting'

export const PriceInput = ({ value, onChange }) => {
  const currencyFormat = useCurrencyFormat()
  
  const handleBlur = (e) => {
    const formatted = currencyFormat.format(parseFloat(e.target.value) || 0)
    e.target.value = formatted
  }
  
  return (
    <input
      type="number"
      defaultValue={value}
      onBlur={handleBlur}
      onChange={onChange}
      placeholder={`Price (${currencyFormat.currency})`}
    />
  )
}
```

## Testing

All formatting utilities include comprehensive unit tests. Run tests with:

```bash
npm test src/i18n/utils/__tests__/formatting.test.ts
```

## Contributing

When adding new formatting functions:

1. Add the utility function to `utils/formatting.ts`
2. Create a corresponding hook in `hooks/useFormatting.ts`
3. Add a component to `FormattedComponents.tsx`
4. Include tests in `__tests__/formatting.test.ts`
5. Update this documentation

## Migration Guide

If migrating from inline Intl usage:

```tsx
// Before
const formatted = new Intl.NumberFormat('cs-CZ').format(1234.56)

// After (with hook)
const { format } = useNumberFormat()
const formatted = format(1234.56)

// After (with component)
<Formatted.Number value={1234.56} />
```