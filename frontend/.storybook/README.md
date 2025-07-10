# Storybook Configuration

This directory contains the Storybook configuration for the Jidelnicek frontend.

## Features

- **React + TypeScript** support with Vite builder for fast HMR
- **Dark mode toggle** - Use the moon/sun icon in the toolbar to switch themes
- **Component documentation** - All components are documented with examples
- **Interactive controls** - Modify props in real-time
- **Responsive viewport testing** - Test components at different screen sizes

## Available Stories

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