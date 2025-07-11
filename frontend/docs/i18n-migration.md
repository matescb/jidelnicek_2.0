# i18n Migration Guide

This guide helps you migrate existing components to use the i18n system in the Jídelníček application.

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Basic Text Migration](#basic-text-migration)
3. [Dynamic Content Migration](#dynamic-content-migration)
4. [Form Migration](#form-migration)
5. [Date and Number Migration](#date-and-number-migration)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)
8. [Performance Considerations](#performance-considerations)
9. [Checklist](#checklist)

## Migration Overview

### Before You Start

1. **Identify all hardcoded text** in your component
2. **Plan your translation keys** using a logical hierarchy
3. **Consider context variations** (gender, formality, plurals)
4. **Test in all supported languages** (English, Czech, Arabic)

### Migration Steps

1. Import necessary hooks and components
2. Replace hardcoded text with translation keys
3. Add translations to locale files
4. Update TypeScript types
5. Test the component

## Basic Text Migration

### Simple Text

**Before:**
```tsx
function Header() {
  return (
    <header>
      <h1>Welcome to Jídelníček</h1>
      <p>Your meal planning assistant</p>
    </header>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'

function Header() {
  const { t } = useTranslation()
  
  return (
    <header>
      <h1>{t('common.appTitle')}</h1>
      <p>{t('common.appTagline')}</p>
    </header>
  )
}
```

**Add to locale files:**
```typescript
// en.ts
export default {
  common: {
    appTitle: 'Welcome to Jídelníček',
    appTagline: 'Your meal planning assistant'
  }
}

// cs.ts
export default {
  common: {
    appTitle: 'Vítejte v Jídelníčku',
    appTagline: 'Váš pomocník pro plánování jídel'
  }
}
```

### Text with Variables

**Before:**
```tsx
function UserGreeting({ userName, recipeCount }) {
  return (
    <div>
      <h2>Hello, {userName}!</h2>
      <p>You have {recipeCount} recipes.</p>
    </div>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'
import { PluralText } from '@/components/i18n/PluralComponents'

function UserGreeting({ userName, recipeCount }) {
  const { t } = useTranslation()
  
  return (
    <div>
      <h2>{t('user.greeting', { name: userName })}</h2>
      <p>
        <PluralText 
          i18nKey="user.recipeCount" 
          count={recipeCount} 
        />
      </p>
    </div>
  )
}
```

**Add to locale files:**
```typescript
// en.ts
user: {
  greeting: 'Hello, {{name}}!',
  recipeCount_one: 'You have {{count}} recipe.',
  recipeCount_other: 'You have {{count}} recipes.'
}

// cs.ts
user: {
  greeting: 'Ahoj, {{name}}!',
  recipeCount_one: 'Máte {{count}} recept.',
  recipeCount_few: 'Máte {{count}} recepty.',
  recipeCount_many: 'Máte {{count}} receptů.'
}
```

## Dynamic Content Migration

### Conditional Text

**Before:**
```tsx
function StatusMessage({ isLoggedIn, isPremium }) {
  return (
    <div>
      {isLoggedIn ? (
        isPremium ? 
          <p>Welcome back, Premium member!</p> : 
          <p>Welcome back!</p>
      ) : (
        <p>Please log in to continue.</p>
      )}
    </div>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'

function StatusMessage({ isLoggedIn, isPremium }) {
  const { t } = useTranslation()
  
  const getStatusKey = () => {
    if (!isLoggedIn) return 'status.loggedOut'
    return isPremium ? 'status.premiumUser' : 'status.regularUser'
  }
  
  return (
    <div>
      <p>{t(getStatusKey())}</p>
    </div>
  )
}
```

### Lists and Arrays

**Before:**
```tsx
function IngredientList({ ingredients }) {
  const formatted = ingredients.join(', ')
  return <p>Ingredients: {formatted}</p>
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'
import { Formatted } from '@/i18n/formatting'

function IngredientList({ ingredients }) {
  const { t } = useTranslation()
  
  return (
    <p>
      {t('recipe.ingredients')}: {' '}
      <Formatted.List items={ingredients} />
    </p>
  )
}
```

## Form Migration

### Form Labels and Placeholders

**Before:**
```tsx
function RecipeForm() {
  return (
    <form>
      <label>
        Recipe Name
        <input placeholder="Enter recipe name" />
      </label>
      <label>
        Cooking Time (minutes)
        <input type="number" placeholder="e.g., 30" />
      </label>
      <button type="submit">Save Recipe</button>
    </form>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'

function RecipeForm() {
  const { t } = useTranslation('recipes')
  
  return (
    <form>
      <label>
        {t('recipes:form.nameLabel')}
        <input placeholder={t('recipes:form.namePlaceholder')} />
      </label>
      <label>
        {t('recipes:form.cookingTimeLabel')}
        <input 
          type="number" 
          placeholder={t('recipes:form.cookingTimePlaceholder')} 
        />
      </label>
      <button type="submit">
        {t('recipes:form.saveButton')}
      </button>
    </form>
  )
}
```

### Validation Messages

**Before:**
```tsx
function RecipeForm() {
  const [errors, setErrors] = useState({})
  
  return (
    <form>
      <input name="title" />
      {errors.title && (
        <span className="error">Recipe name is required</span>
      )}
      {errors.cookingTime && (
        <span className="error">
          Cooking time must be between 1 and 480 minutes
        </span>
      )}
    </form>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'

function RecipeForm() {
  const { t } = useTranslation('validation')
  const [errors, setErrors] = useState({})
  
  return (
    <form>
      <input name="title" />
      {errors.title && (
        <span className="error">
          {t('validation:recipe.titleRequired')}
        </span>
      )}
      {errors.cookingTime && (
        <span className="error">
          {t('validation:recipe.cookingTimeRange', { min: 1, max: 480 })}
        </span>
      )}
    </form>
  )
}
```

## Date and Number Migration

### Dates

**Before:**
```tsx
function RecipeCard({ recipe }) {
  const formattedDate = new Date(recipe.createdAt).toLocaleDateString()
  
  return (
    <div>
      <h3>{recipe.title}</h3>
      <p>Created on {formattedDate}</p>
      <p>Last updated {getRelativeTime(recipe.updatedAt)}</p>
    </div>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'
import { Formatted } from '@/i18n/formatting'

function RecipeCard({ recipe }) {
  const { t } = useTranslation()
  
  return (
    <div>
      <h3>{recipe.title}</h3>
      <p>
        {t('recipe.createdOn', { 
          date: <Formatted.Date value={recipe.createdAt} />
        })}
      </p>
      <p>
        {t('recipe.lastUpdated', {
          time: <Formatted.RelativeTime value={recipe.updatedAt} />
        })}
      </p>
    </div>
  )
}
```

### Numbers and Currency

**Before:**
```tsx
function PriceDisplay({ price, servings }) {
  const pricePerServing = (price / servings).toFixed(2)
  
  return (
    <div>
      <p>Total: €{price.toFixed(2)}</p>
      <p>Per serving: €{pricePerServing}</p>
      <p>Serves {servings} people</p>
    </div>
  )
}
```

**After:**
```tsx
import { useTranslation } from 'react-i18next'
import { Formatted } from '@/i18n/formatting'
import { PluralText } from '@/components/i18n/PluralComponents'

function PriceDisplay({ price, servings }) {
  const { t } = useTranslation()
  const pricePerServing = price / servings
  
  return (
    <div>
      <p>
        {t('pricing.total')}: {' '}
        <Formatted.Currency value={price} />
      </p>
      <p>
        {t('pricing.perServing')}: {' '}
        <Formatted.Currency value={pricePerServing} />
      </p>
      <p>
        <PluralText 
          i18nKey="pricing.serves" 
          count={servings} 
        />
      </p>
    </div>
  )
}
```

## Common Patterns

### Pattern 1: Context-Aware Components

When text depends on user attributes:

```tsx
import { ContextualText } from '@/components/i18n/PluralComponents'

function UserAction({ user, action }) {
  return (
    <ContextualText
      i18nKey={`actions.${action}`}
      context={{ 
        gender: user.gender,
        formality: user.prefersFormal ? 'formal' : 'informal'
      }}
      values={{ userName: user.name }}
    />
  )
}
```

### Pattern 2: Dynamic Key Construction

When you need to build keys dynamically:

```tsx
import { useTranslation } from 'react-i18next'

function RecipeCategory({ category }) {
  const { t } = useTranslation()
  
  // Safe dynamic key construction
  const categoryKey = `categories.${category}` as const
  const categoryName = t(categoryKey, category) // Fallback to category name
  
  return <span>{categoryName}</span>
}
```

### Pattern 3: Nested Component Translation

For components with many text elements:

```tsx
import { useTranslation } from 'react-i18next'

function RecipeDetails({ recipe }) {
  const { t } = useTranslation('recipes')
  
  // Create a scoped translation function
  const tDetail = (key: string, options?: any) => 
    t(`recipes:details.${key}`, options)
  
  return (
    <div>
      <h2>{tDetail('title')}</h2>
      <p>{tDetail('prepTime', { time: recipe.prepTime })}</p>
      <p>{tDetail('difficulty', { level: recipe.difficulty })}</p>
      <section>
        <h3>{tDetail('ingredients.title')}</h3>
        {/* ... */}
      </section>
    </div>
  )
}
```

### Pattern 4: Component-Specific Namespace

For large components with many translations:

```tsx
import { useTypedTranslation } from '@/i18n/hooks/useTypedTranslation'

function ShoppingList() {
  // Load component-specific namespace
  const { t, ready } = useTypedTranslation('shopping')
  
  if (!ready) return <LoadingSpinner />
  
  return (
    <div>
      <h1>{t('shopping:title')}</h1>
      {/* All shopping-related translations */}
    </div>
  )
}
```

### Pattern 5: RTL-Aware Components

For components that need RTL support:

```tsx
import { useDirection } from '@/components/rtl'
import { DirectionalBox } from '@/components/rtl'

function NavigationItem({ icon, label }) {
  const { isRTL } = useDirection()
  
  return (
    <DirectionalBox
      display="flex"
      alignItems="center"
      marginStart="1rem"
      mirrorTransform={isRTL && icon.shouldMirror}
    >
      {icon.component}
      <span>{label}</span>
    </DirectionalBox>
  )
}
```

## Troubleshooting

### Issue: Translation Key Not Found

**Symptoms:**
- Shows the key instead of translation
- Console warning about missing translation

**Solutions:**
1. Check key exists in locale files
2. Verify namespace is loaded
3. Check for typos in key name
4. Run `npm run i18n:extract` to find missing keys

```tsx
// Debug missing keys
import { useTranslation } from 'react-i18next'

function Debug() {
  const { t, i18n } = useTranslation()
  
  // Check if key exists
  console.log(i18n.exists('common.myKey')) // true/false
  
  // Check loaded namespaces
  console.log(i18n.hasLoadedNamespace('recipes')) // true/false
}
```

### Issue: Pluralization Not Working

**Symptoms:**
- Always shows same plural form
- Wrong plural form for the count

**Solutions:**
1. Ensure all plural forms are provided for the language
2. Use `PluralText` component instead of manual handling
3. Check pluralization rules for the language

```typescript
// Czech requires three forms
plurals: {
  recipe_one: '{{count}} recept',    // 1
  recipe_few: '{{count}} recepty',   // 2-4
  recipe_many: '{{count}} receptů'   // 5+
}
```

### Issue: Interpolation Not Working

**Symptoms:**
- Shows `{{variable}}` instead of value
- Variables not replaced

**Solutions:**
1. Pass values object to translation function
2. Check variable names match exactly
3. Ensure values are not undefined

```tsx
// ❌ Wrong
t('welcome')  // "Hello {{name}}"

// ✅ Correct
t('welcome', { name: 'John' })  // "Hello John"
```

### Issue: TypeScript Errors

**Symptoms:**
- Type errors for translation keys
- Missing type definitions

**Solutions:**
1. Run `npm run i18n:types` to regenerate types
2. Use typed hooks for better type safety
3. Ensure imports are correct

```tsx
// Use typed hooks
import { useTypedTranslation } from '@/i18n/hooks/useTypedTranslation'

const { t } = useTypedTranslation('recipes')
// Now TypeScript knows valid keys for 'recipes' namespace
```

## Performance Considerations

### 1. Lazy Load Namespaces

Don't load all translations at once:

```tsx
// ❌ Loading everything
import { useTranslation } from 'react-i18next'
const { t } = useTranslation(['common', 'recipes', 'trips', 'admin'])

// ✅ Load only what's needed
import { useTypedTranslation } from '@/i18n/hooks/useTypedTranslation'
const { t } = useTypedTranslation('recipes') // Only loads recipes namespace
```

### 2. Memoize Formatted Components

Prevent unnecessary re-renders:

```tsx
import { memo } from 'react'
import { Formatted } from '@/i18n/formatting'

const PriceDisplay = memo(({ price }) => (
  <Formatted.Currency value={price} />
))
```

### 3. Use Translation Keys Efficiently

```tsx
// ❌ Multiple translation calls
<div>
  <h1>{t('recipe.title')}</h1>
  <p>{t('recipe.description')}</p>
  <span>{t('recipe.author')}</span>
</div>

// ✅ Consider grouping related translations
const recipeTexts = {
  title: t('recipe.title'),
  description: t('recipe.description'),
  author: t('recipe.author')
}

<div>
  <h1>{recipeTexts.title}</h1>
  <p>{recipeTexts.description}</p>
  <span>{recipeTexts.author}</span>
</div>
```

### 4. Avoid Dynamic Keys in Loops

```tsx
// ❌ Dynamic keys in render
items.map(item => (
  <div key={item.id}>
    {t(`items.${item.type}.name`)}
  </div>
))

// ✅ Pre-translate or use a mapping
const itemTypes = {
  food: t('items.food.name'),
  drink: t('items.drink.name'),
  // ...
}

items.map(item => (
  <div key={item.id}>
    {itemTypes[item.type] || item.type}
  </div>
))
```

## Checklist

Use this checklist when migrating a component:

- [ ] **Identify all hardcoded text**
  - [ ] UI labels
  - [ ] Button text
  - [ ] Error messages
  - [ ] Placeholder text
  - [ ] Alt text for images
  - [ ] Title attributes
  - [ ] Aria labels

- [ ] **Plan translation structure**
  - [ ] Choose appropriate namespace
  - [ ] Design key hierarchy
  - [ ] Identify plural cases
  - [ ] Identify context variations

- [ ] **Replace hardcoded text**
  - [ ] Import translation hook
  - [ ] Replace text with t() calls
  - [ ] Add interpolation for dynamic values
  - [ ] Use appropriate components (PluralText, ContextualText)

- [ ] **Handle formatting**
  - [ ] Replace date formatting with Formatted.Date
  - [ ] Replace number formatting with Formatted.Number
  - [ ] Replace currency with Formatted.Currency
  - [ ] Replace lists with Formatted.List

- [ ] **Add translations**
  - [ ] Add English translations (reference)
  - [ ] Add Czech translations
  - [ ] Add Arabic translations
  - [ ] Include all plural forms
  - [ ] Include all context variations

- [ ] **Update types**
  - [ ] Run `npm run i18n:types`
  - [ ] Fix any TypeScript errors
  - [ ] Use typed hooks where possible

- [ ] **Test thoroughly**
  - [ ] Test in English
  - [ ] Test in Czech (check plurals)
  - [ ] Test in Arabic (check RTL)
  - [ ] Test with long text
  - [ ] Test with missing data
  - [ ] Test error states

- [ ] **Performance check**
  - [ ] Lazy load namespaces
  - [ ] Memoize where appropriate
  - [ ] Check bundle size impact

- [ ] **Documentation**
  - [ ] Update component documentation
  - [ ] Document any special translation needs
  - [ ] Note context requirements

## Example: Complete Migration

Here's a complete example of migrating a recipe card component:

### Before Migration

```tsx
// RecipeCard.tsx - BEFORE
import React from 'react'
import { Recipe } from '@/types'

interface RecipeCardProps {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
}

export function RecipeCard({ recipe, onEdit, onDelete }: RecipeCardProps) {
  const formattedDate = new Date(recipe.createdAt).toLocaleDateString()
  const cookingTime = recipe.cookingTime
  const servings = recipe.servings
  
  return (
    <div className="recipe-card">
      <h3>{recipe.title}</h3>
      <p className="description">{recipe.description}</p>
      
      <div className="meta">
        <span>Cooking time: {cookingTime} minutes</span>
        <span>Serves {servings} people</span>
        <span>Created on {formattedDate}</span>
      </div>
      
      <div className="ingredients">
        <h4>Ingredients:</h4>
        <p>{recipe.ingredients.join(', ')}</p>
      </div>
      
      <div className="actions">
        <button onClick={onEdit}>Edit Recipe</button>
        <button onClick={onDelete} className="danger">
          Delete Recipe
        </button>
      </div>
      
      {recipe.isVegetarian && (
        <span className="badge">Vegetarian</span>
      )}
    </div>
  )
}
```

### After Migration

```tsx
// RecipeCard.tsx - AFTER
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Recipe } from '@/types'
import { Formatted } from '@/i18n/formatting'
import { PluralText } from '@/components/i18n/PluralComponents'

interface RecipeCardProps {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
}

export function RecipeCard({ recipe, onEdit, onDelete }: RecipeCardProps) {
  const { t } = useTranslation('recipes')
  
  return (
    <div className="recipe-card">
      <h3>{recipe.title}</h3>
      <p className="description">{recipe.description}</p>
      
      <div className="meta">
        <span>
          {t('recipes:cookingTime')}: {' '}
          <Formatted.Duration minutes={recipe.cookingTime} />
        </span>
        <span>
          <PluralText 
            i18nKey="recipes:servings" 
            count={recipe.servings} 
          />
        </span>
        <span>
          {t('recipes:createdOn', {
            date: <Formatted.Date value={recipe.createdAt} />
          })}
        </span>
      </div>
      
      <div className="ingredients">
        <h4>{t('recipes:ingredients.title')}:</h4>
        <p>
          <Formatted.List items={recipe.ingredients} />
        </p>
      </div>
      
      <div className="actions">
        <button onClick={onEdit}>
          {t('recipes:actions.edit')}
        </button>
        <button onClick={onDelete} className="danger">
          {t('recipes:actions.delete')}
        </button>
      </div>
      
      {recipe.isVegetarian && (
        <span className="badge">
          {t('recipes:badges.vegetarian')}
        </span>
      )}
    </div>
  )
}
```

### Translation Files

```typescript
// locales/en.ts
export default {
  recipes: {
    cookingTime: 'Cooking time',
    servings_one: 'Serves {{count}} person',
    servings_other: 'Serves {{count}} people',
    createdOn: 'Created on {{date}}',
    ingredients: {
      title: 'Ingredients'
    },
    actions: {
      edit: 'Edit Recipe',
      delete: 'Delete Recipe'
    },
    badges: {
      vegetarian: 'Vegetarian'
    }
  }
}

// locales/cs.ts
export default {
  recipes: {
    cookingTime: 'Doba vaření',
    servings_one: 'Pro {{count}} osobu',
    servings_few: 'Pro {{count}} osoby',
    servings_many: 'Pro {{count}} osob',
    createdOn: 'Vytvořeno {{date}}',
    ingredients: {
      title: 'Ingredience'
    },
    actions: {
      edit: 'Upravit recept',
      delete: 'Smazat recept'
    },
    badges: {
      vegetarian: 'Vegetariánské'
    }
  }
}

// locales/ar.ts
export default {
  recipes: {
    cookingTime: 'وقت الطهي',
    servings_zero: 'لا يخدم أحد',
    servings_one: 'يخدم شخص واحد',
    servings_two: 'يخدم شخصين',
    servings_few: 'يخدم {{count}} أشخاص',
    servings_many: 'يخدم {{count}} شخصًا',
    servings_other: 'يخدم {{count}} شخص',
    createdOn: 'تم الإنشاء في {{date}}',
    ingredients: {
      title: 'المكونات'
    },
    actions: {
      edit: 'تعديل الوصفة',
      delete: 'حذف الوصفة'
    },
    badges: {
      vegetarian: 'نباتي'
    }
  }
}
```

This migration example shows:
- Replacing hardcoded text with translations
- Using formatting components for dates and durations
- Implementing proper pluralization
- Organizing translation keys logically
- Supporting all three languages with their specific requirements