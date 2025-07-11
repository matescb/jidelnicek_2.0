# Responsive Navigation System

This directory contains an enhanced responsive navigation system that automatically adapts to different screen sizes and provides a seamless user experience across devices.

## Components Overview

### 1. NavigationContext (`NavigationContext.tsx`)
Central state management for the navigation system using React Context.

**Features:**
- Tracks navigation states (sidebar, mobile menu, search, etc.)
- Detects screen size and scroll position
- Provides hooks for easy state access
- Automatically adjusts behavior based on screen size

**Usage:**
```tsx
import { NavigationProvider, useNavigation } from './NavigationContext';

// Wrap your app
<NavigationProvider>
  <App />
</NavigationProvider>

// Use in components
const { toggleSidebar, isSidebarOpen } = useNavigation();
```

### 2. ResponsiveNav (`ResponsiveNav.tsx`)
Main wrapper component that orchestrates the responsive navigation layout.

**Features:**
- Automatically switches between desktop/mobile layouts
- Manages transitions between breakpoints
- Handles body scroll locking for mobile menu
- Provides smooth animations

**Usage:**
```tsx
import { ResponsiveNavigation } from './ResponsiveNav';

<ResponsiveNavigation>
  <YourAppContent />
</ResponsiveNavigation>
```

### 3. MegaMenu (`MegaMenu.tsx`)
Desktop-only mega dropdown menu with rich content.

**Features:**
- Multi-column layout
- Featured content sections
- Image previews
- Hover interactions
- Click-outside detection

**Configuration:**
```tsx
const megaMenuConfig = {
  recipes: {
    title: 'Recipes',
    description: 'Discover delicious recipes',
    items: [...],
    featured: {
      title: 'Recipe of the Day',
      image: '/images/featured.jpg',
      link: '/recipes/featured'
    }
  }
};
```

### 4. MobileBottomNav (`MobileBottomNav.tsx`)
Fixed bottom navigation for mobile devices.

**Features:**
- Icon-first design
- Active route indicator with animation
- Touch-optimized tap targets
- Safe area support for devices with notches
- Optional swipe gestures
- Notification badges

### 5. CollapsibleSidebar (`CollapsibleSidebar.tsx`)
Enhanced sidebar with responsive behavior.

**Features:**
- Full mode on desktop (with labels)
- Mini mode on tablets (icons only)
- Swipe gestures on mobile
- Resizable on desktop (drag edge)
- Smooth transitions
- Tooltip support in mini mode

### 6. SearchModal (`SearchModal.tsx`)
Responsive search interface.

**Features:**
- Full-screen on mobile
- Modal on desktop
- Recent search history
- Trending searches
- Voice search support
- Keyboard navigation (↑↓, Enter, Esc)
- Keyboard shortcut (Cmd/Ctrl + K)

## Responsive Breakpoints

The system uses three main breakpoints:

| Breakpoint | Screen Size | Features |
|------------|------------|----------|
| Mobile | < 640px | Bottom nav, full-screen menus, swipe gestures |
| Tablet | 640px - 1024px | Mini sidebar, modal search, tooltips |
| Desktop | > 1024px | Full sidebar, mega menu, resizable panels |

## Implementation Guide

### Basic Setup

1. Import required styles:
```tsx
import './styles/navigation.css';
```

2. Wrap your app with providers:
```tsx
import { NavigationProvider, ResponsiveNavigation } from './components/navigation';

function App() {
  return (
    <NavigationProvider>
      <ResponsiveNavigation>
        <Routes>
          {/* Your routes */}
        </Routes>
      </ResponsiveNavigation>
    </NavigationProvider>
  );
}
```

### Using Navigation Hooks

```tsx
import { useNavigation, useScreenSize } from './components/navigation';

function MyComponent() {
  const { toggleSearch, isSearchOpen } = useNavigation();
  const { isMobile, isTablet, isDesktop } = useScreenSize();

  return (
    <div>
      {isMobile && <MobileSpecificContent />}
      {isDesktop && <DesktopSpecificContent />}
      
      <button onClick={toggleSearch}>
        Search (Cmd+K)
      </button>
    </div>
  );
}
```

### Customizing the Sidebar

```tsx
<CollapsibleSidebar
  isOpen={isSidebarOpen}
  onToggle={toggleSidebar}
  miniMode={isTablet} // Auto mini mode on tablets
/>
```

### Adding Mega Menu Items

```tsx
const customMegaMenu = {
  products: {
    title: 'Our Products',
    items: [
      {
        label: 'All Products',
        path: '/products',
        icon: FiPackage,
        description: 'Browse our catalog'
      }
    ],
    featured: {
      title: 'New Arrivals',
      image: '/images/new-products.jpg',
      link: '/products/new'
    }
  }
};
```

## CSS Classes & Utilities

### Safe Area Support
- `.safe-area-bottom` - Adds bottom padding for devices with home indicators
- `.h-safe-area-inset-bottom` - Sets height to safe area inset

### Touch Optimization
- `.touch-manipulation` - Optimizes touch response
- `.navigation-item` - Prevents text selection

### Animations
- `.transition-responsive` - Smooth responsive transitions
- `.voice-recording` - Pulse animation for voice search
- `.bottom-nav-active` - Active indicator animation

## Accessibility Features

- Keyboard navigation support
- ARIA labels and landmarks
- Focus management
- Screen reader announcements
- Reduced motion support

## Performance Considerations

- Lazy loading for mobile menu
- Debounced resize handlers
- Optimized re-renders with React.memo
- CSS-based animations
- Conditional rendering based on screen size

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- iOS Safari (with safe area support)
- Android Chrome
- Progressive enhancement for older browsers