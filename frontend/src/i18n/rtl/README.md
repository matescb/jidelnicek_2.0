# RTL (Right-to-Left) Support

This directory contains utilities and components for comprehensive RTL support in the application.

## Features

- 🌐 Automatic RTL detection based on language
- 🔄 Direction-aware components and hooks
- 📐 CSS logical properties for automatic layout flipping
- 🎨 RTL-specific CSS utilities
- 🔧 Manual direction toggle for testing
- 📝 Support for RTL languages (Arabic, Hebrew, Persian, etc.)

## Usage

### 1. DirectionalProvider

The app is wrapped with `DirectionalProvider` which manages the text direction:

```tsx
import { DirectionalProvider } from '@/components/rtl'

function App() {
  return (
    <DirectionalProvider>
      {/* Your app content */}
    </DirectionalProvider>
  )
}
```

### 2. DirectionalBox Component

Use `DirectionalBox` for direction-aware layouts:

```tsx
import { DirectionalBox } from '@/components/rtl'

<DirectionalBox
  marginStart="1rem"      // margin-inline-start
  paddingEnd="2rem"       // padding-inline-end
  borderStart="2px solid" // border-inline-start
  textAlign="start"       // text-align: start
  mirrorTransform        // Flips horizontally in RTL
>
  Content
</DirectionalBox>
```

### 3. useDirection Hook

Access direction information in your components:

```tsx
import { useDirection } from '@/components/rtl'

function MyComponent() {
  const { direction, isRTL, toggleDirection } = useDirection()
  
  return (
    <div>
      Current direction: {direction}
      {isRTL && <span>RTL mode active</span>}
    </div>
  )
}
```

### 4. CSS Utilities

Use logical property utilities in your classes:

```html
<!-- Margins -->
<div class="ms-4 me-8">...</div>  <!-- margin start/end -->

<!-- Padding -->
<div class="ps-2 pe-4">...</div>  <!-- padding start/end -->

<!-- Borders -->
<div class="border-s-4 border-e-0">...</div>  <!-- border start/end -->

<!-- Position -->
<div class="start-0 end-4">...</div>  <!-- inset-inline-start/end -->

<!-- Text -->
<div class="text-start">...</div>  <!-- text-align: start -->

<!-- Float -->
<div class="float-start">...</div>  <!-- float: inline-start -->
```

### 5. Adding RTL Languages

To add a new RTL language:

1. Add the language code to `RTL_LANGUAGES` in `/i18n/rtl/index.ts`
2. Add language configuration to `/i18n/index.ts`:

```ts
export const languages = {
  // ... existing languages
  he: { 
    code: 'he', 
    name: 'Hebrew', 
    nativeName: 'עברית',
    flag: '🇮🇱',
    dir: 'rtl'  // Important!
  },
}
```

3. Add translations in `/i18n/locales/he.ts`

## CSS Logical Properties

The implementation uses CSS logical properties which automatically adjust for RTL:

- `margin-inline-start/end` instead of `margin-left/right`
- `padding-inline-start/end` instead of `padding-left/right`
- `inset-inline-start/end` instead of `left/right`
- `border-inline-start/end` instead of `border-left/right`
- `text-align: start/end` instead of `text-align: left/right`

## Directional Animations

Animations automatically adjust for RTL:

```css
.animate-slide-in-from-start  /* Slides from left in LTR, right in RTL */
.animate-slide-in-from-end    /* Slides from right in LTR, left in RTL */
```

## Testing RTL

1. Switch to Arabic language from the language selector
2. Use the "Toggle Direction" button for manual testing
3. Check that:
   - Text alignment switches appropriately
   - Margins and paddings flip
   - Icons that should mirror are flipped
   - Animations come from the correct direction
   - Form inputs align correctly

## Browser Support

- Modern browsers with CSS logical properties support
- Fallbacks included for older browsers
- Tested on Chrome, Firefox, Safari, and Edge

## Best Practices

1. Always use logical properties instead of physical ones
2. Use `DirectionalBox` for complex directional layouts
3. Test your UI in both LTR and RTL modes
4. Consider which icons should mirror (arrows) and which shouldn't (logos)
5. Use `dir="auto"` on user input fields for mixed content