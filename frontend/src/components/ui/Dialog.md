# Dialog Component Documentation

The Dialog component is an enhanced modal dialog built on top of Radix UI's Dialog primitives, featuring size variants, smooth animations, and comprehensive accessibility support.

## Features

- **Size Variants**: Five predefined sizes (sm, md, lg, xl, full) using Class Variance Authority (CVA)
- **Smooth Animations**: Framer Motion integration for enter/exit animations
- **Accessibility**: Full keyboard navigation and focus trap support via Radix UI
- **Responsive Design**: Automatically adapts to mobile screens
- **Dark Mode**: Fully compatible with dark mode themes
- **Customizable Behavior**: Control close triggers (escape key, outside click)
- **TypeScript Support**: Full type safety with exported interfaces

## Installation

The component requires the following dependencies (already installed):
- `@radix-ui/react-dialog`
- `class-variance-authority`
- `framer-motion`
- `lucide-react`

## Basic Usage

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function MyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a description of the dialog content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Your content here */}
        </div>
        <DialogFooter>
          <Button>Action</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Size Variants

The dialog supports five size variants:

```tsx
<DialogContent size="sm">  {/* max-width: 384px */}
<DialogContent size="md">  {/* max-width: 512px (default) */}
<DialogContent size="lg">  {/* max-width: 768px */}
<DialogContent size="xl">  {/* max-width: 1024px */}
<DialogContent size="full"> {/* 95% viewport width/height */}
```

## Props

### DialogContent Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'` | Size variant of the dialog |
| `closeOnClickOutside` | `boolean` | `true` | Whether clicking outside closes the dialog |
| `closeOnEscape` | `boolean` | `true` | Whether pressing Escape closes the dialog |
| `showCloseButton` | `boolean` | `true` | Whether to show the close (X) button |
| `animationVariants` | `object` | `undefined` | Custom Framer Motion animation variants |
| `className` | `string` | `undefined` | Additional CSS classes |

## Custom Animations

You can provide custom Framer Motion variants:

```tsx
const customVariants = {
  initial: { 
    opacity: 0, 
    scale: 0.5,
    rotate: -10
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      damping: 15,
      stiffness: 200
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.5,
    rotate: 10,
    transition: {
      duration: 0.3
    }
  }
}

<DialogContent animationVariants={customVariants}>
  {/* Content */}
</DialogContent>
```

## Controlled State

For controlled dialogs, use the `open` and `onOpenChange` props:

```tsx
function ControlledDialog() {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>
        {/* Content */}
      </DialogContent>
    </Dialog>
  )
}
```

## Preventing Close

To create a dialog that requires explicit user action:

```tsx
<DialogContent 
  closeOnClickOutside={false}
  closeOnEscape={false}
  showCloseButton={false}
>
  <DialogHeader>
    <DialogTitle>Important Action Required</DialogTitle>
  </DialogHeader>
  <div className="py-4">
    <p>You must complete this action to continue.</p>
  </div>
  <DialogFooter>
    <Button onClick={() => setOpen(false)}>
      Complete Action
    </Button>
  </DialogFooter>
</DialogContent>
```

## Accessibility Features

- **Focus Management**: Automatically moves focus to the dialog and returns it when closed
- **Keyboard Navigation**: 
  - `Escape`: Closes the dialog (if enabled)
  - `Tab`: Cycles through focusable elements
  - `Shift + Tab`: Cycles backwards
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Portal Rendering**: Renders outside the DOM hierarchy to avoid z-index issues

## Responsive Behavior

The dialog automatically adapts to mobile screens:
- Margins adjust on small screens (`mx-4` on mobile)
- Maximum height is limited to 90% of viewport
- Content becomes scrollable when it exceeds available space
- Full-size variant optimizes for mobile viewing

## Dark Mode

The dialog uses theme-aware classes:
- `bg-background`: Adapts to light/dark theme
- `text-foreground`: Ensures readable text
- `border`: Theme-aware border color
- Overlay uses `bg-black/80` with backdrop blur

## TypeScript Types

The component exports the following types:

```tsx
import type { DialogContentProps, DialogOverlayProps } from '@/components/ui/dialog'

// DialogContentProps includes:
// - All HTMLDivElement props
// - size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
// - closeOnClickOutside?: boolean
// - closeOnEscape?: boolean
// - showCloseButton?: boolean
// - animationVariants?: { initial?: any; animate?: any; exit?: any }
```

## Best Practices

1. **Use Semantic Structure**: Always include DialogHeader with DialogTitle for accessibility
2. **Provide Descriptions**: Use DialogDescription to explain the dialog's purpose
3. **Button Placement**: Place primary actions on the right in DialogFooter
4. **Size Selection**: Choose the smallest size that comfortably fits your content
5. **Loading States**: Show loading indicators for async operations
6. **Error Handling**: Display errors within the dialog rather than closing it

## Examples

See `DialogExample.tsx` for comprehensive examples demonstrating all features.