# Micro-Interactions Library

A comprehensive collection of smooth, accessible micro-interactions built with Framer Motion and React.

## Components

### HoverCard
Interactive hover effects with 3D tilt, scale, and glow options.

```tsx
import { HoverCard } from '@/components/ui/interactions';

<HoverCard
  tiltAmount={20}
  scale={1.1}
  glowEffect
  magneticCursor
>
  <div className="p-6 bg-white rounded-lg">
    Hover me!
  </div>
</HoverCard>
```

### ClickRipple
Material Design-inspired ripple effect on click.

```tsx
import { ClickRipple } from '@/components/ui/interactions';

<ClickRipple
  color="rgba(59, 130, 246, 0.5)"
  duration={0.8}
>
  <button className="px-4 py-2 bg-blue-500 text-white rounded">
    Click me
  </button>
</ClickRipple>
```

### LikeButton
Animated like button with particle effects and count animation.

```tsx
import { LikeButton } from '@/components/ui/interactions';

<LikeButton
  initialCount={42}
  onLike={(liked) => console.log('Liked:', liked)}
  enableConfetti
  showCount
/>
```

### ToggleSwitch
Enhanced toggle switch with smooth animations and loading states.

```tsx
import { ToggleSwitch } from '@/components/ui/interactions';
import { Moon, Sun } from 'lucide-react';

<ToggleSwitch
  checked={isDarkMode}
  onCheckedChange={setIsDarkMode}
  onIcon={Moon}
  offIcon={Sun}
  label="Dark Mode"
/>
```

### AnimatedCounter
Smooth number animations with formatting options.

```tsx
import { AnimatedCounter } from '@/components/ui/interactions';

<AnimatedCounter
  value={1234.56}
  duration={2}
  decimals={2}
  formatCurrency
  prefix="$"
  easing="circOut"
/>
```

### DragHandle
Drag and drop functionality with visual feedback.

```tsx
import { DragHandle } from '@/components/ui/interactions';

<DragHandle
  onDrop={(dropZoneId) => console.log('Dropped in:', dropZoneId)}
  dropZones={[
    { id: 'zone1', element: document.getElementById('dropzone1') }
  ]}
  showGhost
>
  <div className="p-4 bg-gray-100 rounded">
    Drag me!
  </div>
</DragHandle>
```

### FeedbackButton
Button with loading, success, and error states.

```tsx
import { FeedbackButton } from '@/components/ui/interactions';
import { Save } from 'lucide-react';

<FeedbackButton
  onClick={async () => {
    await saveData();
  }}
  icon={Save}
  successText="Saved!"
  errorText="Failed to save"
>
  Save Changes
</FeedbackButton>
```

### InteractionProvider
Global settings for all interactions.

```tsx
import { InteractionProvider } from '@/components/ui/interactions';

<InteractionProvider
  defaultSettings={{
    animationSpeed: 1.5,
    enableHaptics: true,
    enableSounds: false,
  }}
>
  <App />
</InteractionProvider>
```

## Hooks

### useInteractions
Access and update interaction settings.

```tsx
const { reducedMotion, animationSpeed, updateSettings } = useInteractions();
```

### useHaptic
Trigger haptic feedback.

```tsx
const { trigger } = useHaptic();
trigger('success'); // 'light' | 'medium' | 'heavy' | 'success' | 'error'
```

### useSound
Play interaction sounds.

```tsx
const { play } = useSound();
play('click'); // 'click' | 'success' | 'error' | 'hover'
```

### useAnimationSpeed
Get adjusted animation durations.

```tsx
const { duration } = useAnimationSpeed();
const adjustedDuration = duration(300); // Adjusts based on global speed
```

## Accessibility

- All components respect `prefers-reduced-motion`
- Proper ARIA attributes and keyboard support
- Focus indicators and screen reader announcements
- Disable animations with `reducedMotion` setting

## Performance

- GPU-accelerated animations with `transform` and `opacity`
- Lazy animation calculations
- Proper cleanup of event listeners
- Optimized re-renders with proper memoization