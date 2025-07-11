# Mobile Components

A collection of mobile-optimized React components built with Framer Motion for smooth gestures and animations.

## Components

### BottomSheet
A swipeable drawer that slides up from the bottom of the screen.

```tsx
import { BottomSheet } from '@/components/mobile'

<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  snapPoints={[0.5, 0.9]} // 50% and 90% of screen height
  defaultSnapPoint={0}
>
  <YourContent />
</BottomSheet>
```

### MobileModal
Full-screen modal with swipe-to-close gesture support.

```tsx
import { MobileModal } from '@/components/mobile'

<MobileModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  allowSwipeDown={true}
>
  <YourContent />
</MobileModal>
```

### TabBar
Fixed bottom navigation with icon badges and animations.

```tsx
import { TabBar } from '@/components/mobile'

const tabs = [
  { id: 'home', label: 'Home', icon: HomeIcon, badge: 3 },
  { id: 'profile', label: 'Profile', icon: UserIcon }
]

<TabBar
  items={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

### PullToRefresh
Elastic pull-to-refresh with customizable indicators.

```tsx
import { PullToRefresh } from '@/components/mobile'

<PullToRefresh
  onRefresh={async () => {
    await fetchNewData()
  }}
  threshold={80}
>
  <YourScrollableContent />
</PullToRefresh>
```

### FloatingActionButton
Expandable FAB with mini action buttons.

```tsx
import { FloatingActionButton } from '@/components/mobile'

const actions = [
  { id: 'camera', label: 'Camera', icon: CameraIcon, onClick: openCamera },
  { id: 'gallery', label: 'Gallery', icon: PhotoIcon, onClick: openGallery }
]

<FloatingActionButton
  actions={actions}
  position="bottom-right"
  hideOnScroll={true}
/>
```

### MobileHeader
Sticky header with blur effect, search, and large title support.

```tsx
import { MobileHeader } from '@/components/mobile'

<MobileHeader
  title="Page Title"
  largeTitle={true}
  searchable={true}
  onSearch={handleSearch}
  onBack={() => navigate(-1)}
/>
```

### SwipeableListItem
List items with swipe actions for edit/delete operations.

```tsx
import { SwipeableEditDeleteItem } from '@/components/mobile'

<SwipeableEditDeleteItem
  onEdit={() => editItem(item.id)}
  onDelete={() => deleteItem(item.id)}
>
  <ItemContent />
</SwipeableEditDeleteItem>
```

## Features

- **Touch Gestures**: All components use Framer Motion for smooth, native-like touch interactions
- **Platform Consistency**: iOS and Android style variations where appropriate
- **Safe Area Support**: Built-in support for device safe areas (notches, home indicators)
- **Dark Mode**: Full dark mode support with proper color transitions
- **Accessibility**: ARIA labels and keyboard navigation where applicable
- **Performance**: Optimized animations and lazy rendering

## Usage Tips

1. **Safe Areas**: Components automatically handle safe areas, but you can use utility classes:
   - `.safe-area-top`, `.safe-area-bottom` for exact safe area padding
   - `.pt-safe`, `.pb-safe` for safe area with fallback padding

2. **Scroll Prevention**: BottomSheet and MobileModal prevent body scroll when open

3. **Gesture Conflicts**: Be mindful of gesture conflicts when nesting swipeable components

4. **Performance**: Use `hideOnScroll` prop on FAB and headers for better scroll performance

## Demo

See `MobileComponentsDemo.tsx` for a complete example of all components in action.