# Jídelníček Component Library Specification

## 1. Design Tokens

### 1.1 Color Palette

#### Primary Colors
```css
/* Outdoor Green - Primary brand color */
--color-primary-50: #f0f7e8;
--color-primary-100: #d8ebc4;
--color-primary-200: #bed09d;
--color-primary-300: #9bb571;
--color-primary-400: #789a4f;
--color-primary-500: #567f2d;
--color-primary-600: #2D5016; /* Primary */
--color-primary-700: #254119;
--color-primary-800: #1d3314;
--color-primary-900: #14240e;
```

#### Secondary Colors
```css
/* Earth Brown - Secondary accent */
--color-secondary-50: #faf7f4;
--color-secondary-100: #f0e8dd;
--color-secondary-200: #e2d0bb;
--color-secondary-300: #d0b494;
--color-secondary-400: #b8906a;
--color-secondary-500: #9f6e42;
--color-secondary-600: #7d5633;
--color-secondary-700: #5c4027;
--color-secondary-800: #3d2a1a;
--color-secondary-900: #1f150d;
```

#### Semantic Colors
```css
/* Success */
--color-success-50: #f0fcf9;
--color-success-100: #c6f8e8;
--color-success-200: #9df3d7;
--color-success-300: #65e7bc;
--color-success-400: #3cdca5;
--color-success-500: #22c997;
--color-success-600: #1ba37a;
--color-success-700: #157d5e;

/* Warning */
--color-warning-50: #fffbeb;
--color-warning-100: #fef3c7;
--color-warning-200: #fde68a;
--color-warning-300: #fcd34d;
--color-warning-400: #fbbf24;
--color-warning-500: #f59e0b;
--color-warning-600: #d97706;
--color-warning-700: #b45309;

/* Error */
--color-error-50: #fef2f2;
--color-error-100: #fee2e2;
--color-error-200: #fecaca;
--color-error-300: #fca5a5;
--color-error-400: #f87171;
--color-error-500: #ef4444;
--color-error-600: #dc2626;
--color-error-700: #b91c1c;

/* Info */
--color-info-50: #eff6ff;
--color-info-100: #dbeafe;
--color-info-200: #bfdbfe;
--color-info-300: #93c5fd;
--color-info-400: #60a5fa;
--color-info-500: #3b82f6;
--color-info-600: #2563eb;
--color-info-700: #1d4ed8;

/* Neutral */
--color-neutral-50: #f9fafb;
--color-neutral-100: #f3f4f6;
--color-neutral-200: #e5e7eb;
--color-neutral-300: #d1d5db;
--color-neutral-400: #9ca3af;
--color-neutral-500: #6b7280;
--color-neutral-600: #4b5563;
--color-neutral-700: #374151;
--color-neutral-800: #1f2937;
--color-neutral-900: #111827;
```

### 1.2 Typography Scale

```css
/* Font Families */
--font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-family-secondary: 'Roboto Slab', Georgia, serif;
--font-family-mono: 'JetBrains Mono', Consolas, monospace;

/* Font Sizes */
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */
--font-size-4xl: 2.25rem;   /* 36px */
--font-size-5xl: 3rem;      /* 48px */

/* Font Weights */
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-none: 1;
--line-height-tight: 1.25;
--line-height-snug: 1.375;
--line-height-normal: 1.5;
--line-height-relaxed: 1.625;
--line-height-loose: 2;
```

### 1.3 Spacing System (4px base unit)

```css
--spacing-0: 0;
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-7: 1.75rem;  /* 28px */
--spacing-8: 2rem;     /* 32px */
--spacing-10: 2.5rem;  /* 40px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */
--spacing-20: 5rem;    /* 80px */
--spacing-24: 6rem;    /* 96px */
```

### 1.4 Border Radius Values

```css
--border-radius-none: 0;
--border-radius-sm: 0.125rem;   /* 2px */
--border-radius-base: 0.25rem;  /* 4px */
--border-radius-md: 0.375rem;   /* 6px */
--border-radius-lg: 0.5rem;     /* 8px */
--border-radius-xl: 0.75rem;    /* 12px */
--border-radius-2xl: 1rem;      /* 16px */
--border-radius-3xl: 1.5rem;    /* 24px */
--border-radius-full: 9999px;
```

### 1.5 Shadow/Elevation System

```css
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-base: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
--shadow-2xl: 0 35px 60px -20px rgba(0, 0, 0, 0.3);
--shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
```

## 2. Core Components

### 2.1 Buttons

#### Variants
- **Primary**: Green background for main actions
- **Secondary**: Earth brown for secondary actions
- **Ghost**: Transparent with border
- **Danger**: Red for destructive actions
- **Success**: Green for confirmations
- **Link**: Text-only button style

#### Sizes
- **Small**: Height 32px, padding 8px 12px, font-size 14px
- **Medium**: Height 40px, padding 10px 16px, font-size 16px
- **Large**: Height 48px, padding 12px 24px, font-size 18px

#### States
- **Default**: Base appearance
- **Hover**: Slight color darkening, cursor pointer
- **Active**: Pressed state with shadow-inner
- **Disabled**: Opacity 50%, cursor not-allowed
- **Loading**: Show spinner, disable interactions

#### Accessibility
- Minimum touch target 44x44px
- Focus outline: 2px solid primary color with 2px offset
- ARIA labels for icon-only buttons
- Loading state announces to screen readers

### 2.2 Form Inputs

#### Text Input
- Height: 40px
- Border: 1px solid neutral-300
- Border radius: 6px
- Padding: 10px 12px
- Focus: Primary color border with shadow
- Error state: Red border with error message below
- Success state: Green border with checkmark icon
- Helper text: 12px below input

#### Number Input
- Same styling as text input
- Increment/decrement buttons on right
- Min/max validation
- Step increments (customizable)
- Decimal precision support

#### Select Dropdown
- Native select with custom styling
- Chevron icon on right
- Option groups support
- Multi-select variant available
- Search functionality for long lists

#### Textarea
- Min height: 80px
- Auto-resize option
- Character counter
- Same border/focus states as inputs
- Scrollbar styling

### 2.3 Cards

#### Recipe Card
```
+----------------------------------+
| [Image]                          |
| Recipe Name                      |
| ⭐ 4.5 (23 reviews) | 👤 Author |
| 🕐 45 min | 🔥 350 kcal/100g    |
| [Tags: Vegan, Quick]             |
+----------------------------------+
```
- Hover: Elevation increase, slight scale
- Click area: Entire card
- Image lazy loading
- Truncate long names with ellipsis

#### Meal Card
```
+----------------------------------+
| Breakfast - Day 3                |
| [Recipe Name]                    |
| Per person: 450 kcal             |
| Total: 2,250 kcal                |
| [Edit] [Delete] [Notes]          |
+----------------------------------+
```
- Draggable handle on left
- Collapsible nutrition details
- Quick actions on hover

#### Day Card
```
+----------------------------------+
| Day 5 - March 15, 2025          |
| [Drag Handle] [Collapse Toggle]  |
|                                  |
| Breakfast: Oatmeal Mix          |
| Lunch: Trail Mix                 |
| Dinner: Freeze-dried Pasta      |
| Snacks: 2 items                 |
|                                  |
| Total: 2,800 kcal | 450g        |
+----------------------------------+
```
- Drag-and-drop enabled
- Expandable meal details
- Day summary at bottom

### 2.4 Navigation

#### Header
```
+--------------------------------------------------------+
| [Logo] Jídelníček    [Recipes] [Trips] [Profile] [EN] |
+--------------------------------------------------------+
```
- Sticky positioning
- Mobile hamburger menu
- Active page highlighting
- User avatar dropdown

#### Tabs
```
+--------------------------------------------------+
| [Overview] [Meals] [Shopping List] [Nutrition]   |
+--------------------------------------------------+
```
- Underline active indicator
- Swipe gesture on mobile
- Keyboard navigation
- Badge support for counts

#### Breadcrumbs
```
Home > My Trips > Summer Hike 2025 > Day 3
```
- Chevron separators
- Truncate middle items on mobile
- Current page non-clickable

### 2.5 Modals and Dialogs

#### Standard Modal
- Backdrop: Dark overlay (rgba(0,0,0,0.5))
- Container: White background, rounded corners
- Max width: 600px (responsive)
- Close button: Top right X
- Focus trap enabled
- ESC key to close

#### Confirmation Dialog
```
+--------------------------------+
| Delete Recipe?                 |
|                                |
| This action cannot be undone.  |
| The recipe will be permanently |
| removed.                       |
|                                |
| [Cancel] [Delete Recipe]       |
+--------------------------------+
```

### 2.6 Tables

#### Sortable Headers
- Click to sort ascending/descending
- Arrow indicators for sort direction
- Multi-column sort with numbers

#### Responsive Behavior
- Horizontal scroll on mobile
- Sticky first column option
- Collapsible rows for details

#### Row Actions
- Hover to reveal actions
- Bulk selection checkboxes
- Context menu on right-click

### 2.7 Lists

#### Ingredient List
```
+--------------------------------+
| ☐ 200g Rolled Oats            |
| ☐ 50g Nuts & Seeds Mix        |
| ☐ 30g Dried Fruits            |
| ☐ 15g Protein Powder          |
+--------------------------------+
```
- Checkbox for tracking
- Quantity editing inline
- Drag to reorder
- Group by category

#### Shopping List
```
Grains & Cereals
  • 1.2kg Rolled Oats
  • 500g Quinoa

Proteins
  • 300g Nuts Mix
  • 200g Protein Powder

[Generate PDF] [Email List]
```

## 3. Specialized Components

### 3.1 Nutrition Display Widget

```
+----------------------------------+
| Nutrition per 100g               |
| Energy: 385 kcal                 |
|                                  |
| Macronutrients:                  |
| Protein: 12.5g                   |
| Carbs: 58.2g (sugars: 8.1g)     |
| Fats: 11.3g (saturated: 2.1g)   |
|                                  |
| [Show all nutrients ▼]           |
+----------------------------------+
```
- Collapsible sections
- Progress bars for daily values
- Color coding for high/low values
- Comparison mode

### 3.2 Participant Coefficient Slider

```
John Doe
[====|===========] 75%
Min: 10%  Max: 300%

[Reset to 100%]
```
- Touch-friendly handle (minimum 44x44px)
- Number input alternative
- Live preview of effects (e.g., "600 kcal base × 75% = 450 kcal portion")
- Preset buttons: Child (70%), Teen (120%), Active Adult (150%)
- Range: 10-300% as per PRD requirements
- Visual indicator for coefficient impact on meal portions
- Does NOT affect snacks or drinks quantities

### 3.3 Drag-and-Drop Day Cards

Visual Feedback:
- Grab cursor on hover
- Lift animation on drag start
- Drop zone highlighting
- Smooth reorder animation
- Undo option after drop

Accessibility:
- Keyboard alternative (Ctrl+arrows)
- Screen reader announcements
- Focus management

### 3.4 Recipe Rating Stars

```
★★★★☆ 4.2 (156 reviews)
```
- Half-star precision
- Hover to preview rating
- Click to rate (if allowed)
- Tooltip with breakdown

### 3.5 Progress Indicators

#### Linear Progress
```
Planning: 75% complete
[████████████░░░░]
```

#### Circular Progress
```
   75%
 ╱     ╲
│   🥾  │
 ╲     ╱
```

#### Step Progress
```
● Recipe Selection
● Participant Setup
○ Meal Assignment
○ Review & Export
```

### 3.6 Empty States

#### No Recipes
```
+----------------------------------+
|                                  |
|         🍳                       |
|                                  |
|    No recipes yet!               |
|                                  |
| Create your first recipe or      |
| browse the marketplace.          |
|                                  |
| [Create Recipe] [Browse]         |
|                                  |
+----------------------------------+
```

### 3.7 Error States

#### Form Validation Error
```
+----------------------------------+
| Recipe Name*                     |
| [                              ] |
| ⚠️ Recipe name is required       |
+----------------------------------+
```

#### Page Error
```
+----------------------------------+
|                                  |
|         ⚠️                       |
|                                  |
|    Something went wrong          |
|                                  |
| We couldn't load your trips.     |
| Please try again.                |
|                                  |
| [Retry] [Go Home]                |
|                                  |
+----------------------------------+
```

## 4. Layout Components

### 4.1 Grid System

12-column grid with responsive breakpoints:
- Mobile: 1 column (< 640px)
- Tablet: 6 columns (640px - 1024px)
- Desktop: 12 columns (> 1024px)

Gap sizes: 16px (mobile), 24px (tablet), 32px (desktop)

### 4.2 Container Widths

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

Padding: 16px (mobile), 24px (tablet), 32px (desktop)

### 4.3 Responsive Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

## 5. Component Guidelines

### Accessibility Standards
- WCAG 2.1 Level AA compliance
- Color contrast ratios: 4.5:1 for normal text, 3:1 for large text
- Keyboard navigation for all interactive elements
- ARIA labels and descriptions where needed
- Focus indicators visible and clear
- Screen reader tested

### Performance Considerations
- Lazy loading for images and heavy components
- Virtual scrolling for long lists
- Debounced inputs for search/filter
- Optimistic UI updates
- Progressive enhancement

### Internationalization
- RTL layout support ready
- Text expansion space (German +35%)
- Date/time formatting per locale
- Number formatting per locale
- Translatable UI strings

### Motion and Animation
- Respect prefers-reduced-motion
- Duration: 200ms for micro-interactions
- Easing: ease-out for most animations
- No auto-playing animations
- Smooth transitions between states

### Dark Mode Support
- Separate color tokens for dark theme
- System preference detection
- Manual toggle option
- Persistent user preference
- Smooth theme transitions

## 6. Implementation Notes

### Component Props Standard
```typescript
interface ComponentProps {
  className?: string;      // Additional CSS classes
  style?: CSSProperties;   // Inline styles
  id?: string;            // DOM ID
  testId?: string;        // Testing identifier
  ariaLabel?: string;     // Accessibility label
  disabled?: boolean;     // Disabled state
  loading?: boolean;      // Loading state
  error?: string;         // Error message
  onChange?: Function;    // Change handler
  onBlur?: Function;      // Blur handler
  onFocus?: Function;     // Focus handler
}
```

### Naming Conventions
- Components: PascalCase (RecipeCard)
- CSS classes: kebab-case (recipe-card)
- CSS variables: kebab-case (--color-primary)
- Props: camelCase (isDisabled)
- Events: onEventName (onClick)

### 3.8 Nutritional Accuracy Display

```
+----------------------------------+
| Nutritional Values (per 100g)    |
| -------------------------------- |
| Calories: 385.2 kcal            |
| Proteins: 12.5g                 |
| Carbs: 58.2g                    |
| Fats: 11.3g                     |
|                                 |
| ⚠️ Accuracy: 99.9% guaranteed    |
+----------------------------------+
```
- Display with 1 decimal place precision
- Internal calculations maintain full precision
- Rounding only for display
- Visual indicator for calculation confidence
- Tooltip explaining accuracy guarantee

### 3.9 Export Format Selector

```
+----------------------------------+
| Export Trip Summary              |
| -------------------------------- |
| Select Format:                   |
| ○ PDF (Printable)               |
| ● Excel (Editable)              |
| ○ Text (Simple)                 |
|                                 |
| Include:                        |
| ☑ Shopping List                 |
| ☑ Nutritional Summary           |
| ☑ Day-by-Day Breakdown          |
| ☐ Participant Details           |
|                                 |
| [Export] [Cancel]               |
+----------------------------------+
```

### 3.10 PWA Components (Phase 2)

#### Offline Status Indicator
```
+----------------------------------+
| 🔴 Offline Mode                  |
| Changes will sync when online    |
+----------------------------------+
```

#### Sync Status
```
Syncing... [████████░░] 80%
Last synced: 5 minutes ago
```

### 3.11 Calculation Confidence Indicator

```
+----------------------------------+
| Recipe Nutrition Confidence      |
| -------------------------------- |
| ✅ High (100% complete data)     |
| ⚠️ Medium (85% complete)         |
| ❌ Low (Missing key nutrients)   |
|                                 |
| Missing: Vitamin D, Iron        |
+----------------------------------+
```

### Testing Requirements
- Unit tests for logic
- Visual regression tests
- Accessibility tests
- Performance benchmarks
- Cross-browser testing
- **Calculation accuracy tests (99.9% requirement)**
- **Component response time tests (<200ms)**

This component library provides a comprehensive foundation for building the Jídelníček application with consistency, accessibility, and excellent user experience at its core.