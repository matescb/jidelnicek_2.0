# Dark Mode Implementation Guide

## Overview

This project implements a comprehensive dark mode system using CSS custom properties (variables) for smooth theme switching with proper contrast ratios and accessibility.

## CSS Variables Structure

### Color Variables

All colors are defined as CSS variables in `/src/styles/globals.css`:

- **Color Scales**: Each semantic color (primary, secondary, success, warning, error, info) has 10 shades (50-900/950)
- **Single Colors**: Background, surface, card, modal colors
- **Text Colors**: Primary, secondary, muted, disabled, inverse
- **Border Colors**: Default, subtle, strong, focus
- **Input Colors**: Background, border states, placeholder
- **Interactive States**: Hover, pressed, selected, disabled overlays
- **Additional**: Link colors, status colors, code highlighting, scrollbar colors

### Theme Switching

The dark theme is applied by adding the `.dark` class to the document root:

```html
<html class="dark">
```

All dark mode colors are automatically applied through CSS variables that change based on this class.

## Usage in Components

### Using CSS Variables

```css
/* In your CSS/SCSS files */
.my-component {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.my-button {
  background-color: var(--color-primary-600);
  color: white;
}

.my-button:hover {
  background-color: var(--color-primary-700);
}
```

### Using with Tailwind CSS

The project is configured to use these CSS variables with Tailwind utilities:

```jsx
// Using color utilities
<div className="bg-surface text-text-primary border-border">
  <button className="bg-primary-600 hover:bg-primary-700 text-white">
    Click me
  </button>
</div>

// Using semantic classes
<div className="card">
  <div className="card-header">
    <h2 className="text-text-primary">Title</h2>
  </div>
  <div className="card-body">
    <p className="text-text-secondary">Content</p>
  </div>
</div>
```

## React Integration

### Using the Theme Hook

```tsx
import { useTheme } from '@/hooks/useTheme';

function ThemeToggle() {
  const { theme, toggleTheme, setThemeMode, themeMode } = useTheme();
  
  return (
    <div>
      <button onClick={toggleTheme}>
        Current theme: {theme}
      </button>
      
      <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}
```

### Using Theme Context

```tsx
import { ThemeProvider, useThemeContext } from '@/hooks/useTheme';

// Wrap your app
function App() {
  return (
    <ThemeProvider>
      <YourAppContent />
    </ThemeProvider>
  );
}

// Use in components
function MyComponent() {
  const { theme } = useThemeContext();
  
  return (
    <div className={theme === 'dark' ? 'some-dark-class' : 'some-light-class'}>
      Content
    </div>
  );
}
```

## Preventing Flash of Incorrect Theme

Add the theme initialization script to your HTML head:

```tsx
// In Next.js _document.tsx
import { readFileSync } from 'fs';
import { join } from 'path';

const themeInitScript = readFileSync(
  join(process.cwd(), 'src/scripts/theme-init.js'),
  'utf8'
);

<Head>
  <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
</Head>
```

## Smooth Transitions

The system includes smooth transitions for theme switching:

1. All color-related properties transition smoothly by default
2. The `theme-transitioning` class temporarily disables transitions during initial load
3. Transition duration is controlled by CSS variables (`--transition-base`, etc.)

## Accessibility Considerations

1. **Contrast Ratios**: All color combinations meet WCAG AA standards
2. **Focus Indicators**: Custom focus rings with proper contrast in both themes
3. **Selection Colors**: Theme-aware text selection colors
4. **Reduced Motion**: Respects `prefers-reduced-motion` for transitions

## Creating New Components

When creating new components, follow these guidelines:

1. **Always use CSS variables** for colors instead of hardcoded values
2. **Test in both themes** to ensure proper contrast and visibility
3. **Use semantic color names** (e.g., `--color-text-primary` not `--color-gray-900`)
4. **Consider hover/focus states** with appropriate color variations

### Example Component

```css
.custom-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  box-shadow: var(--shadow-md);
}

.custom-card:hover {
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-lg);
}

.custom-card-title {
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  margin-bottom: var(--spacing-2);
}

.custom-card-description {
  color: var(--color-text-secondary);
  font-size: var(--text-base);
}
```

## Customizing Colors

To customize the color palette:

1. Edit the CSS variables in `/src/styles/globals.css`
2. Ensure you update both light and dark theme values
3. Maintain proper contrast ratios for accessibility
4. Test thoroughly in both themes

## Utility Functions

```typescript
import { getCSSVar, setCSSVar, checkContrast } from '@/utils/theme';

// Get a CSS variable value
const primaryColor = getCSSVar('color-primary-500');

// Set a CSS variable dynamically
setCSSVar('color-primary-500', '#5b21b6');

// Check contrast ratio
const meetsStandard = checkContrast('#ffffff', '#000000', 'AA');
```

## Best Practices

1. **Consistency**: Use the predefined color variables consistently
2. **Semantic Naming**: Use semantic color names that describe purpose, not appearance
3. **Testing**: Always test components in both light and dark themes
4. **Performance**: CSS variables are performant and update instantly
5. **Fallbacks**: Provide fallback values for critical colors if needed

## Troubleshooting

### Theme not persisting
- Check localStorage permissions
- Ensure theme initialization script is running

### Flash of wrong theme
- Verify theme-init.js is in the document head
- Check that the script runs before React hydration

### Transitions not smooth
- Check for `theme-transitioning` class conflicts
- Verify transition CSS variables are defined

### Colors not updating
- Ensure `.dark` class is properly toggled on document root
- Check CSS variable names match exactly
- Verify no hardcoded colors override variables