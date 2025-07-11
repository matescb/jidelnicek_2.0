# Responsive Component Tests

This directory contains comprehensive tests for responsive UI components and utilities.

## Test Structure

### Core Test Files

- **`utils.ts`** - Shared test utilities and helpers
  - Window resize mocking
  - Media query mocking
  - Touch/gesture simulation
  - Viewport presets
  - Observer mocking (Intersection, Resize)

- **`hooks.test.ts`** - Tests for responsive hooks
  - `useMediaQuery` - Media query detection
  - `useBreakpoint` - Breakpoint detection
  - `useResponsive` - Device type detection
  - `useWindowSize` - Window dimensions tracking

- **`grid.test.tsx`** - Tests for grid layout components
  - `Grid` - Responsive grid container
  - `GridItem` - Grid item with span control
  - `ResponsiveGrid` - Auto-fit grid
  - `FlexGrid` - Flexbox-based grid

- **`mobile.test.tsx`** - Tests for mobile-specific components
  - `BottomSheet` - Swipeable bottom sheet
  - `TabBar` - Mobile navigation tabs
  - `PullToRefresh` - Pull-to-refresh functionality
  - `SwipeableListItem` - Swipeable list actions

- **`gestures.test.ts`** - Tests for gesture hooks
  - `useSwipe` - Swipe gesture detection
  - `usePinch` - Pinch zoom gestures
  - `useLongPress` - Long press detection
  - `useDrag` - Drag interactions

- **`navigation.test.tsx`** - Tests for responsive navigation
  - `ResponsiveNav` - Adaptive navigation bar
  - `MobileMenu` - Mobile slide-out menu
  - `Sidebar` - Collapsible sidebar
  - `SearchModal` - Responsive search interface

- **`adaptive.test.tsx`** - Tests for adaptive layouts
  - `Container` - Responsive container
  - `ResponsiveTable` - Table to card transformation
  - `AdaptiveDialog` - Modal to bottom sheet
  - `ResponsiveForm` - Adaptive form layouts

- **`typography.test.tsx`** - Tests for responsive typography
  - `FluidText` - Fluid typography scaling
  - `ResponsiveHeading` - Responsive headings
  - `ReadingWidth` - Optimal reading width
  - `TruncatedText` - Text truncation

## Running Tests

```bash
# Run all responsive tests
npm test src/__tests__/responsive/

# Run specific test file
npm test src/__tests__/responsive/hooks.test.ts

# Run with coverage
npm test -- --coverage src/__tests__/responsive/

# Run in watch mode
npm test -- --watch src/__tests__/responsive/
```

## Test Utilities

### Mock Window Resize

```typescript
import { mockWindowResize, viewports } from './utils';

// Resize to mobile viewport
mockWindowResize(viewports.mobile.width, viewports.mobile.height);

// Resize to custom size
mockWindowResize(1440, 900);
```

### Mock Media Queries

```typescript
import { mockMediaQuery } from './utils';

// Mock a specific media query
mockMediaQuery('(min-width: 768px)', true);

// Mock multiple queries
mockMediaQuery('(max-width: 639px)', false);
mockMediaQuery('(min-width: 640px)', true);
```

### Simulate Touch Gestures

```typescript
import { simulateSwipe, simulatePinch } from './utils';

// Simulate swipe
await simulateSwipe(element, 0, 0, 100, 0, 300); // Right swipe

// Simulate pinch
await simulatePinch(element, 2, 200); // Zoom in 2x
```

## Common Test Patterns

### Testing Responsive Behavior

```typescript
it('should adapt to viewport changes', () => {
  // Start with desktop
  mockWindowResize(viewports.desktop.width, viewports.desktop.height);
  render(<Component />);
  expect(screen.getByTestId('desktop-view')).toBeInTheDocument();

  // Change to mobile
  mockWindowResize(viewports.mobile.width, viewports.mobile.height);
  expect(screen.getByTestId('mobile-view')).toBeInTheDocument();
});
```

### Testing Touch Interactions

```typescript
it('should handle swipe gestures', async () => {
  render(<SwipeableComponent onSwipe={handleSwipe} />);
  
  const element = screen.getByTestId('swipeable');
  await simulateSwipe(element, 0, 0, 100, 0);
  
  expect(handleSwipe).toHaveBeenCalledWith({
    direction: 'right',
    deltaX: 100,
    deltaY: 0,
    velocity: expect.any(Number)
  });
});
```

### Testing Media Query Hooks

```typescript
it('should respond to media query changes', () => {
  const mediaQueryList = mockMediaQuery('(min-width: 768px)', false);
  const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
  
  expect(result.current).toBe(false);
  
  // Simulate media query change
  act(() => {
    mediaQueryList.matches = true;
    mediaQueryList.addEventListener.mock.calls
      .find(([event]) => event === 'change')[1]
      ({ matches: true });
  });
  
  expect(result.current).toBe(true);
});
```

## Coverage Goals

- **Hooks**: 100% coverage of all responsive hooks
- **Components**: Full coverage of responsive behavior
- **Edge Cases**: SSR safety, unmount cleanup, error states
- **Interactions**: Touch, keyboard, and mouse events
- **Animations**: Transition and animation completion