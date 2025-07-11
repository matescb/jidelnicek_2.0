# Error State Animation Components

A comprehensive collection of animated error state components built with React, Framer Motion, and Tailwind CSS.

## Components

### ErrorAnimation
Animated error icons with different styles:
- **error** - Animated X mark with pulse effect
- **warning** - Warning triangle with shake animation
- **offline** - Wi-Fi disconnection animation
- **404** - Animated 404 with search icon
- **glitch** - Glitch effect animation

```tsx
import { ErrorAnimation } from '@/components/ui/error';

<ErrorAnimation type="error" size="lg" />
```

### ErrorMessage
Displays error messages with animations:
- Shake animation on appear
- Red pulse/glow effect
- Expandable details section
- Copy to clipboard functionality

```tsx
import { ErrorMessage } from '@/components/ui/error';

<ErrorMessage
  title="Connection Failed"
  message="Unable to connect to server"
  details="Error: ECONNREFUSED"
  type="error"
  onDismiss={() => handleDismiss()}
/>
```

### ErrorBoundaryUI
Full-page error boundary UI with:
- Falling blocks animation
- Broken screen effect
- Retry functionality
- Error reporting
- Navigation to home

```tsx
import { ErrorBoundaryUI } from '@/components/ui/error';

<ErrorBoundaryUI
  error={error}
  resetError={resetError}
  errorInfo={errorInfo}
/>
```

### ValidationError
Form validation error components:
- Field shake animation
- Red border pulse
- Tooltip variations
- Smooth height transitions

```tsx
import { FieldValidationWrapper } from '@/components/ui/error';

<FieldValidationWrapper error={error} touched={touched}>
  <Input {...inputProps} />
</FieldValidationWrapper>
```

### NetworkError
Network-specific error states:
- Wi-Fi disconnection animation
- Online/offline detection
- Retry with loading state
- Connection status indicator

```tsx
import { NetworkError } from '@/components/ui/error';

<NetworkError
  onRetry={handleRetry}
  message="Failed to load data"
/>
```

### EmptyState
Empty/no results states with animations:
- Search not found
- Empty box animation
- Filtered results empty
- Suggestions carousel

```tsx
import { EmptyState } from '@/components/ui/error';

<EmptyState
  type="search"
  title="No results found"
  description="Try adjusting your search"
  suggestions={['Pasta', 'Pizza', 'Salad']}
  action={{
    label: 'Clear filters',
    onClick: clearFilters
  }}
/>
```

## Features

- **Smooth Animations**: Built with Framer Motion for fluid, performant animations
- **Dark Mode Support**: All components work seamlessly in light and dark modes
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Responsive**: Adapts to different screen sizes
- **TypeScript**: Full type safety with TypeScript
- **Customizable**: Easy to customize colors, sizes, and animations

## Usage

Import components from the error module:

```tsx
import { 
  ErrorAnimation,
  ErrorMessage,
  NetworkError,
  EmptyState 
} from '@/components/ui/error';
```

## Animation Highlights

1. **Glitch Effects**: Realistic glitch animations for critical errors
2. **Physics-based**: Spring animations for natural movement
3. **Contextual**: Different animations for different error types
4. **Interactive**: Hover and click animations for better UX
5. **Performance**: Optimized animations that won't impact performance

## Showcase

View all components in action by importing the ErrorShowcase:

```tsx
import { ErrorShowcase } from '@/components/ui/error/ErrorShowcase';

// In your app
<ErrorShowcase />
```