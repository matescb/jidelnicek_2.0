# Storybook Configuration

This directory contains the Storybook configuration for the Jidelnicek frontend.

## Features

- **React + TypeScript** support with Vite builder for fast HMR
- **Enhanced Theme Switching** - Use the paintbrush icon in the toolbar to switch between Light, Dark, or System themes
- **Theme Comparison Mode** - Toggle side-by-side view to see components in both themes simultaneously
- **Persistent Theme Selection** - Your theme preference is saved across sessions
- **Component documentation** - All components are documented with examples
- **Interactive controls** - Modify props in real-time
- **Responsive viewport testing** - Test components at different screen sizes

## Theme Switching Guide

### Using the Theme Switcher
1. Click the **paintbrush icon** in the Storybook toolbar
2. Choose your preferred theme:
   - **Light Theme** (sun icon) - Light mode with bright colors
   - **Dark Theme** (moon icon) - Dark mode for low-light environments
   - **System Theme** (browser icon) - Follows your OS theme preference

### Theme Comparison Mode
1. Click the **side-by-side icon** in the toolbar
2. Toggle "Theme Comparison" to see components in both themes
3. Perfect for ensuring design consistency across themes

### Theme Persistence
- Your theme selection is automatically saved
- Refreshing the page maintains your chosen theme
- Each Storybook instance remembers its own theme preference

## Available Stories

### Theme Examples
- **Theme/Demo** - Comprehensive showcase of themed components

### Core Components
- **Button** - All variants, sizes, states, loading, and icon support
- **Dialog** - Modal dialogs with sizes, animations, and behaviors
- **Toast** - Notification system with positions and variants
- **Tooltip** - Flexible tooltips with all positions and triggers

### Form Components
- **ComboBox** - Advanced select with search, multi-select, and async loading

### Layout Components
- **Card** - Versatile cards with variants, elevations, and animations
- **Loading** - Complete loading system (spinners, dots, progress, skeletons)

## Running Storybook

```bash
npm run storybook        # Start development server
npm run build-storybook  # Build static Storybook
```

## Adding New Stories

1. Create a `ComponentName.stories.tsx` file next to your component
2. Follow the Component Story Format (CSF3):

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

const meta = {
  title: 'Category/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Component description',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    // Define controls
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};
```

## Configuration Files

- `main.ts` - Main configuration with addons and Vite setup
- `preview.tsx` - Global decorators, parameters, and dark mode
- `manager.ts` - UI theme configuration

## Best Practices

1. **Group related stories** - Use folders in the title (e.g., 'Components/Button')
2. **Provide meaningful names** - Use descriptive names for story exports
3. **Add controls** - Make props interactive with argTypes
4. **Document thoroughly** - Add descriptions to components and props
5. **Show all states** - Include loading, error, disabled states
6. **Test responsiveness** - Use the viewport addon to test mobile/tablet
7. **Consider accessibility** - Test with keyboard navigation
8. **Test in both themes** - Always verify components look good in light and dark modes
9. **Use theme comparison** - Check side-by-side view for visual consistency
10. **Follow theme conventions** - Use CSS variables like `bg-background`, `text-foreground`

## Theme Development Tips

### Writing Theme-Aware Components
```tsx
// DO: Use theme-aware utility classes
<div className="bg-background text-foreground border-border">

// DON'T: Use fixed colors
<div className="bg-white text-black border-gray-200">
```

### Testing Theme Changes
1. Use the theme switcher to test all three modes
2. Enable theme comparison for quick visual checks
3. Pay attention to:
   - Text contrast and readability
   - Border visibility
   - Shadow effects
   - Hover/focus states
   - Component boundaries