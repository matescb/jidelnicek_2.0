# Enhanced Route Transitions - Feature Documentation

This document describes the enhanced features added to the route transition system.

## New Transition Modes

### Additional Animation Modes
- **slideUp**: Slides content up from bottom
- **slideDown**: Slides content down from top  
- **zoom**: Zooms in/out with rotation effect
- **rotate**: Rotates content during transition

### Usage Example
```tsx
<PageTransitions mode="zoom" duration={0.3}>
  {/* Your content */}
</PageTransitions>
```

## Enhanced TransitionProvider Features

### New Settings
```tsx
interface TransitionSettings {
  enabled: boolean;
  defaultTransition: TransitionMode;
  speedMultiplier: number;
  enablePreload: boolean;
  preserveScrollDefault: boolean;
  reducedMotion: boolean;           // NEW: Respects user motion preferences
  enableSoundEffects: boolean;       // NEW: Optional transition sounds
  transitionQuality: 'low' | 'medium' | 'high'; // NEW: Performance tuning
}
```

### Local Storage Persistence
Settings are now automatically saved to localStorage and restored on page reload.

### Reduced Motion Support
Automatically detects and respects the user's motion preferences from their OS settings.

## Enhanced ScrollRestoration

### New Props
```tsx
interface ScrollRestorationProps {
  // ... existing props ...
  onSave?: (position: ScrollPosition) => void;
  scrollBehavior?: ScrollBehavior;
  offset?: number;              // Offset for fixed headers
  restoreKey?: string;          // Multiple positions per route
}
```

### Enhanced ScrollToTopButton
```tsx
<ScrollToTopButton 
  threshold={200}
  position="left"  // or "right"
  offset={{ bottom: '2rem', left: '2rem' }}
  ariaLabel="Back to top"
/>
```

## Enhanced PreloadManager

### Network-Aware Preloading
```tsx
<PreloadManager 
  enableNetworkAwarePreload={true}  // Respects data saver and connection speed
  onPreloadError={(path, error) => console.error(error)}
  onPreloadSuccess={(path) => console.log(`Preloaded: ${path}`)}
/>
```

### Enhanced PreloadConfig
```tsx
interface PreloadConfig {
  path: string;
  priority: 'high' | 'medium' | 'low';
  component?: () => Promise<any>;
  data?: () => Promise<any>;
  resources?: string[];
  timestamp?: number;
  retryCount?: number;      // NEW: Retry tracking
  maxRetries?: number;      // NEW: Max retry attempts
  ttl?: number;            // NEW: Time to live for cache
}
```

### Enhanced PreloadLink
```tsx
<PreloadLink 
  to="/gallery" 
  priority="high"
  preloadOnFocus={true}      // Preload on keyboard focus
  preloadDelay={200}         // Delay before preloading on hover
>
  Gallery
</PreloadLink>
```

## New Hooks

### useGestureTransition
Enable swipe navigation gestures:

```tsx
const { dragX, isDragging, dragProps } = useGestureTransition();

return (
  <div 
    {...dragProps}
    style={{ 
      transform: `translateX(${dragX}px)`,
      opacity: isDragging ? 0.8 : 1 
    }}
  >
    {/* Content */}
  </div>
);
```

### useTransitionPerformance
Monitor transition performance:

```tsx
const { metrics, startMonitoring, stopMonitoring } = useTransitionPerformance();

// Start monitoring on mount
useEffect(() => {
  startMonitoring();
  return () => stopMonitoring();
}, []);

console.log(`FPS: ${metrics.fps}`);
console.log(`Dropped frames: ${metrics.dropped}`);
```

### Enhanced useRouteTransition
```tsx
const {
  isTransitioning,
  transitionPhase,  // 'idle' | 'exit' | 'enter'
  currentPath,
  previousPath,
} = useRouteTransition({
  mode: 'slide',
  duration: 0.3,
  onTransitionStart: () => {},
  onTransitionEnd: () => {},
  onEnter: () => {},
  onExit: () => {},
});
```

### Enhanced useTransitionState
```tsx
const {
  isEntering,
  isExiting,
  isActive,
  phase,
  progress,      // 0 to 1
  direction,     // 'forward' | 'backward' | null
} = useTransitionState(300);
```

## Enhanced PageTransitions Props

### New Props
```tsx
interface PageTransitionsProps {
  // ... existing props ...
  onTransitionEnd?: () => void;      // Fired when animation completes
  easing?: string | number[];        // Custom easing function
  stagger?: number;                  // Stagger child animations
  skipInitial?: boolean;             // Skip initial animation
}
```

### Custom Easing Example
```tsx
<PageTransitions
  mode="slide"
  easing={[0.68, -0.55, 0.265, 1.55]} // Elastic easing
  stagger={0.1}
>
  {/* Content */}
</PageTransitions>
```

## Network Awareness

The system now checks network conditions before preloading:
- Respects data saver mode
- Avoids preloading on slow connections (2G, slow-2g)
- Automatically retries failed preloads

## Performance Optimizations

### Transition Quality Settings
Adjust quality based on device performance:

```tsx
const { setTransitionQuality } = useTransitionSettings();

// Detect device performance and adjust
if (deviceIsLowEnd) {
  setTransitionQuality('low');
}
```

### Quality Levels
- **Low**: Simplified animations, reduced effects
- **Medium**: Standard animations (default)
- **High**: Full animations with all effects

## Accessibility Enhancements

### Reduced Motion
Automatically detects `prefers-reduced-motion` and simplifies or disables animations.

### Sound Effects (Optional)
```tsx
interface RouteTransitionConfig {
  // ... existing config ...
  soundEffect?: string;  // Path to sound file
}
```

### ARIA Improvements
- Better screen reader announcements
- Customizable ARIA labels
- Focus management during transitions

## Migration Guide

The enhanced features are backward compatible. To use new features:

1. Update TransitionProvider with new settings:
```tsx
<TransitionProvider
  initialSettings={{
    reducedMotion: false,
    enableSoundEffects: false,
    transitionQuality: 'medium',
  }}
>
```

2. Add network-aware preloading:
```tsx
<PreloadManager enableNetworkAwarePreload={true}>
```

3. Use new transition modes:
```tsx
<PageTransitions mode="zoom">
```

4. Add gesture support:
```tsx
const { dragProps } = useGestureTransition();
```

## Best Practices

1. **Performance**: Use `transitionQuality: 'low'` on low-end devices
2. **Accessibility**: Always respect `reducedMotion` preference
3. **Preloading**: Set appropriate priorities (high for critical routes)
4. **Network**: Enable network-aware preloading for better UX
5. **Monitoring**: Use performance monitoring in development

## Examples

See `examples.tsx` for comprehensive usage examples of all enhanced features.