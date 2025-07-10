# Toast Notification System

A comprehensive toast notification system with animations, gestures, and full accessibility support.

## Components

### Toast
The base toast component that displays individual notifications.

### ToastContainer
Manages the positioning and animations of multiple toasts.

### ToastProvider
Context provider that should wrap your application to enable toast notifications.

## Setup

1. Wrap your application with the ToastProvider:

```tsx
import { ToastProvider } from '@/components/ui/ToastProvider'

function App() {
  return (
    <ToastProvider>
      {/* Your app content */}
    </ToastProvider>
  )
}
```

2. Use the `useToast` hook anywhere in your application:

```tsx
import { useToast } from '@/hooks/useToast'

function MyComponent() {
  const { success, error, warning, info } = useToast()

  const handleSave = () => {
    // Your save logic
    success('Saved!', 'Your changes have been saved successfully.')
  }

  return <button onClick={handleSave}>Save</button>
}
```

## Usage Examples

### Basic Toasts

```tsx
const { success, error, warning, info, toast } = useToast()

// Success toast
success('Success!', 'Your changes have been saved.')

// Error toast
error('Error!', 'Something went wrong.')

// Warning toast
warning('Warning!', 'This action cannot be undone.')

// Info toast
info('Info', 'New features are available.')

// Default toast
toast.default('Hello', 'This is a default toast.')
```

### Toast with Action

```tsx
toast.default('File deleted', 'The file has been moved to trash.', {
  action: {
    label: 'Undo',
    onClick: () => {
      // Restore the file
      success('Restored', 'The file has been restored.')
    }
  }
})
```

### Persistent Toast

```tsx
info('System Update', 'A new version is available.', {
  persistent: true,
  showProgress: false
})
```

### Promise-based Toasts

```tsx
const { promise } = useToast()

// Automatically shows loading, success, or error states
await promise(
  fetchData(),
  {
    loading: 'Loading data...',
    success: 'Data loaded successfully!',
    error: 'Failed to load data'
  }
)

// With dynamic messages
await promise(
  saveUser(userData),
  {
    loading: 'Saving user...',
    success: (user) => `User ${user.name} saved!`,
    error: (err) => `Error: ${err.message}`
  }
)
```

### Custom Duration

```tsx
success('Quick message', 'This will disappear quickly', {
  duration: 2000 // 2 seconds
})
```

### Manual Control

```tsx
const { addToast, updateToast, removeToast } = useToast()

// Add a custom toast
const toastId = addToast({
  title: 'Processing...',
  variant: 'default',
  persistent: true
})

// Update the toast
updateToast(toastId, {
  title: 'Processing complete!',
  variant: 'success',
  persistent: false
})

// Remove the toast
removeToast(toastId)
```

## Configuration

### Position

```tsx
const { setPosition } = useToast()

// Available positions:
// 'top-left', 'top-center', 'top-right'
// 'bottom-left', 'bottom-center', 'bottom-right'
setPosition('top-right')
```

### Max Visible Toasts

```tsx
const { setMaxVisible } = useToast()

// Show maximum 3 toasts at a time
setMaxVisible(3)
```

### Default Duration

```tsx
const { setDefaultDuration } = useToast()

// Set default duration to 3 seconds
setDefaultDuration(3000)
```

## Features

- **Multiple Variants**: success, error, warning, info, and default
- **Positioning**: 6 position options
- **Auto-dismiss**: Configurable duration with progress indicator
- **Manual Dismiss**: Close button and swipe-to-dismiss on mobile
- **Keyboard Support**: Press Escape to dismiss the most recent toast
- **Accessibility**: Full screen reader support with ARIA attributes
- **Dark Mode**: Automatic theme detection and styling
- **Actions**: Add buttons for undo/retry functionality
- **Promises**: Automatic loading/success/error states for async operations
- **Queue Management**: Limit visible toasts with smooth animations
- **Persistence**: Settings saved to localStorage
- **Mobile Optimized**: Touch gestures and responsive design

## Styling

The toast system uses Tailwind CSS and respects your application's theme. Colors are automatically adjusted for dark mode.

### Variant Colors
- **Default**: Neutral colors matching your theme
- **Success**: Green color scheme
- **Error**: Red color scheme
- **Warning**: Yellow color scheme
- **Info**: Blue color scheme

## Accessibility

- All toasts have proper ARIA attributes
- Screen readers announce new toasts
- Keyboard navigation support
- High contrast mode compatible
- Motion reduced mode respected

## Best Practices

1. **Keep messages concise**: Use short, clear titles and descriptions
2. **Use appropriate variants**: Match the toast type to the message importance
3. **Provide actions when relevant**: Add undo/retry buttons for reversible actions
4. **Don't overuse**: Avoid showing too many toasts at once
5. **Consider persistence**: Use persistent toasts for critical information
6. **Test on mobile**: Ensure swipe gestures work correctly on touch devices