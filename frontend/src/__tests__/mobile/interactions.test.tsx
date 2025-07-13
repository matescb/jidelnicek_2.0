/**
 * Mobile-specific interaction and pattern tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import { BottomSheet } from '../../components/mobile/BottomSheet';
import { PullToRefresh } from '../../components/mobile/PullToRefresh';
import { SwipeableListItem } from '../../components/mobile/SwipeableListItem';
import { TabBar } from '../../components/mobile/TabBar';
import { MobileBottomNav } from '../../components/navigation/MobileBottomNav';
import { 
  mockWindowResize, 
  VIEWPORT_PRESETS,
  simulateSwipe,
  simulatePinch,
  createTouchEvent
} from '../utils/responsive';
import { 
  testKeyboardNavigation, 
  testAriaStates,
  testFocusManagement 
} from '../utils/accessibility';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Mobile Interactions', () => {
  beforeEach(() => {
    mockWindowResize(VIEWPORT_PRESETS.mobile.medium.width, VIEWPORT_PRESETS.mobile.medium.height);
    vi.clearAllMocks();
  });

  describe('Bottom Sheet Component', () => {
    it('should handle swipe gestures to open/close', async () => {
      const onOpenChange = vi.fn();
      
      renderWithProviders(
        <BottomSheet
          isOpen={false}
          onOpenChange={onOpenChange}
          data-testid="bottom-sheet"
        >
          <div>Bottom sheet content</div>
        </BottomSheet>
      );

      const trigger = screen.getByTestId('bottom-sheet-trigger');
      
      // Swipe up to open
      await simulateSwipe(trigger, {
        direction: 'up',
        distance: 200,
        duration: 300,
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('should snap to positions based on swipe velocity', async () => {
      const onSnapToPosition = vi.fn();
      
      renderWithProviders(
        <BottomSheet
          isOpen={true}
          snapPoints={[0.3, 0.6, 0.9]}
          onSnapToPosition={onSnapToPosition}
          data-testid="snappable-sheet"
        >
          <div>Snappable content</div>
        </BottomSheet>
      );

      const sheet = screen.getByTestId('snappable-sheet');
      
      // Fast swipe up should snap to highest position
      await simulateSwipe(sheet, {
        direction: 'up',
        distance: 100,
        duration: 150, // Fast swipe
      });

      expect(onSnapToPosition).toHaveBeenCalledWith(0.9);
      
      // Slow swipe down should snap to middle
      await simulateSwipe(sheet, {
        direction: 'down',
        distance: 80,
        duration: 500, // Slow swipe
      });

      expect(onSnapToPosition).toHaveBeenCalledWith(0.6);
    });

    it('should be accessible with keyboard navigation', async () => {
      const onClose = vi.fn();
      
      renderWithProviders(
        <BottomSheet
          isOpen={true}
          onOpenChange={onClose}
          data-testid="accessible-sheet"
        >
          <button data-testid="sheet-button">Action</button>
          <input data-testid="sheet-input" placeholder="Type here" />
        </BottomSheet>
      );

      await testFocusManagement({
        triggerSelector: 'bottom-sheet-trigger',
        modalSelector: 'accessible-sheet',
        firstFocusableSelector: 'sheet-button',
        lastFocusableSelector: 'sheet-input',
      });
    });

    it('should handle backdrop interaction', async () => {
      const onClose = vi.fn();
      
      renderWithProviders(
        <BottomSheet
          isOpen={true}
          onOpenChange={onClose}
          data-testid="backdrop-sheet"
        >
          <div>Sheet content</div>
        </BottomSheet>
      );

      const backdrop = screen.getByTestId('bottom-sheet-backdrop');
      const user = userEvent.setup();
      
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledWith(false);
    });
  });

  describe('Pull to Refresh Component', () => {
    it('should trigger refresh on pull gesture', async () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      
      renderWithProviders(
        <PullToRefresh onRefresh={onRefresh} data-testid="pull-refresh">
          <div style={{ height: '200vh' }}>
            Long content to scroll
          </div>
        </PullToRefresh>
      );

      const container = screen.getByTestId('pull-refresh');
      
      // Simulate pull gesture at top of page
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      
      await simulateSwipe(container, {
        direction: 'down',
        distance: 120, // Threshold typically around 100px
        duration: 400,
        startPosition: { x: 200, y: 50 },
      });

      expect(onRefresh).toHaveBeenCalled();
    });

    it('should show loading indicator during refresh', async () => {
      const onRefresh = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      renderWithProviders(
        <PullToRefresh onRefresh={onRefresh} data-testid="loading-refresh">
          <div>Content</div>
        </PullToRefresh>
      );

      const container = screen.getByTestId('loading-refresh');
      
      await simulateSwipe(container, {
        direction: 'down',
        distance: 120,
        duration: 400,
      });

      // Should show loading indicator
      expect(screen.getByTestId('refresh-loading')).toBeInTheDocument();
      expect(screen.getByLabelText('Refreshing content')).toBeInTheDocument();
    });

    it('should provide haptic feedback on supported devices', async () => {
      const mockVibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
      });

      const onRefresh = vi.fn().mockResolvedValue(undefined);
      
      renderWithProviders(
        <PullToRefresh onRefresh={onRefresh} hapticFeedback={true}>
          <div>Content with haptics</div>
        </PullToRefresh>
      );

      const container = screen.getByTestId('pull-refresh-container');
      
      await simulateSwipe(container, {
        direction: 'down',
        distance: 120,
        duration: 400,
      });

      expect(mockVibrate).toHaveBeenCalledWith(50); // Light haptic
    });
  });

  describe('Swipeable List Item Component', () => {
    const actions = [
      { id: 'delete', label: 'Delete', color: 'red', icon: 'trash' },
      { id: 'edit', label: 'Edit', color: 'blue', icon: 'pencil' },
      { id: 'share', label: 'Share', color: 'green', icon: 'share' },
    ];

    it('should reveal actions on swipe', async () => {
      const onAction = vi.fn();
      
      renderWithProviders(
        <SwipeableListItem
          actions={actions}
          onAction={onAction}
          data-testid="swipeable-item"
        >
          <div>List item content</div>
        </SwipeableListItem>
      );

      const item = screen.getByTestId('swipeable-item');
      
      // Swipe left to reveal actions
      await simulateSwipe(item, {
        direction: 'left',
        distance: 100,
        duration: 300,
      });

      // Actions should be visible
      expect(screen.getByTestId('action-delete')).toBeVisible();
      expect(screen.getByTestId('action-edit')).toBeVisible();
      expect(screen.getByTestId('action-share')).toBeVisible();
    });

    it('should handle threshold-based action triggering', async () => {
      const onAction = vi.fn();
      
      renderWithProviders(
        <SwipeableListItem
          actions={actions}
          onAction={onAction}
          quickActionThreshold={150}
          data-testid="threshold-item"
        >
          <div>Threshold item</div>
        </SwipeableListItem>
      );

      const item = screen.getByTestId('threshold-item');
      
      // Long swipe should trigger first action immediately
      await simulateSwipe(item, {
        direction: 'left',
        distance: 200, // Above threshold
        duration: 300,
      });

      expect(onAction).toHaveBeenCalledWith('delete');
    });

    it('should support keyboard action triggering', async () => {
      const onAction = vi.fn();
      
      renderWithProviders(
        <SwipeableListItem
          actions={actions}
          onAction={onAction}
          data-testid="keyboard-item"
        >
          <div>Keyboard accessible item</div>
        </SwipeableListItem>
      );

      const user = userEvent.setup();
      const item = screen.getByTestId('keyboard-item');
      
      // Focus item and use keyboard shortcuts
      await user.click(item);
      
      // Long press simulation (contextmenu event)
      item.dispatchEvent(new Event('contextmenu'));
      
      // Actions menu should appear
      expect(screen.getByRole('menu')).toBeInTheDocument();
      
      // Navigate and select action
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      expect(onAction).toHaveBeenCalled();
    });

    it('should handle bi-directional swipes', async () => {
      const leftActions = [
        { id: 'archive', label: 'Archive', color: 'yellow', icon: 'archive' },
      ];
      const rightActions = [
        { id: 'flag', label: 'Flag', color: 'orange', icon: 'flag' },
      ];

      const onAction = vi.fn();
      
      renderWithProviders(
        <SwipeableListItem
          leftActions={leftActions}
          rightActions={rightActions}
          onAction={onAction}
          data-testid="bidirectional-item"
        >
          <div>Bidirectional item</div>
        </SwipeableListItem>
      );

      const item = screen.getByTestId('bidirectional-item');
      
      // Swipe right to reveal left actions
      await simulateSwipe(item, {
        direction: 'right',
        distance: 100,
        duration: 300,
      });

      expect(screen.getByTestId('action-archive')).toBeVisible();
      
      // Reset and swipe left to reveal right actions
      await simulateSwipe(item, {
        direction: 'left',
        distance: 100,
        duration: 300,
      });

      expect(screen.getByTestId('action-flag')).toBeVisible();
    });
  });

  describe('Tab Bar Component', () => {
    const tabs = [
      { id: 'recipes', label: 'Recipes', icon: 'utensils' },
      { id: 'trips', label: 'Trips', icon: 'map' },
      { id: 'shopping', label: 'Shopping', icon: 'shopping-cart' },
      { id: 'profile', label: 'Profile', icon: 'user' },
    ];

    it('should handle tab selection', async () => {
      const onTabChange = vi.fn();
      
      renderWithProviders(
        <TabBar
          tabs={tabs}
          activeTab="recipes"
          onTabChange={onTabChange}
          data-testid="tab-bar"
        />
      );

      const user = userEvent.setup();
      const tripsTab = screen.getByTestId('tab-trips');
      
      await user.click(tripsTab);
      expect(onTabChange).toHaveBeenCalledWith('trips');
    });

    it('should support keyboard navigation', async () => {
      const onTabChange = vi.fn();
      
      renderWithProviders(
        <TabBar
          tabs={tabs}
          activeTab="recipes"
          onTabChange={onTabChange}
          data-testid="keyboard-tab-bar"
        />
      );

      const user = userEvent.setup();
      const tabList = screen.getByRole('tablist');
      
      // Focus first tab
      await user.tab();
      expect(screen.getByTestId('tab-recipes')).toHaveFocus();
      
      // Arrow navigation
      await user.keyboard('{ArrowRight}');
      expect(screen.getByTestId('tab-trips')).toHaveFocus();
      
      await user.keyboard('{ArrowRight}');
      expect(screen.getByTestId('tab-shopping')).toHaveFocus();
      
      // Wrap to beginning
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');
      expect(screen.getByTestId('tab-recipes')).toHaveFocus();
    });

    it('should show badge notifications', () => {
      const tabsWithBadges = tabs.map(tab => ({
        ...tab,
        badge: tab.id === 'trips' ? 3 : undefined,
      }));

      renderWithProviders(
        <TabBar
          tabs={tabsWithBadges}
          activeTab="recipes"
          onTabChange={vi.fn()}
          data-testid="badge-tab-bar"
        />
      );

      const tripsTab = screen.getByTestId('tab-trips');
      const badge = tripsTab.querySelector('[data-testid="tab-badge"]');
      
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
      expect(badge).toHaveAttribute('aria-label', '3 notifications');
    });
  });

  describe('Mobile Bottom Navigation', () => {
    it('should adapt to safe area on iOS devices', () => {
      // Mock iOS safe area
      Object.defineProperty(document.documentElement.style, 'getPropertyValue', {
        value: vi.fn((prop) => {
          if (prop === '--sat-bottom') return '34px';
          return '';
        }),
        writable: true,
      });

      renderWithProviders(<MobileBottomNav />);

      const bottomNav = screen.getByTestId('mobile-bottom-nav');
      const computedStyle = getComputedStyle(bottomNav);
      
      expect(computedStyle.paddingBottom).toBe('34px');
    });

    it('should handle landscape orientation', () => {
      mockWindowResize(VIEWPORT_PRESETS.mobile.medium.height, VIEWPORT_PRESETS.mobile.medium.width);
      
      // Mock landscape orientation
      Object.defineProperty(window.screen, 'orientation', {
        value: { type: 'landscape-primary' },
        writable: true,
      });

      renderWithProviders(<MobileBottomNav />);

      const bottomNav = screen.getByTestId('mobile-bottom-nav');
      expect(bottomNav).toHaveClass('landscape');
    });
  });

  describe('Touch and Gesture Recognition', () => {
    it('should differentiate between tap and long press', async () => {
      const onTap = vi.fn();
      const onLongPress = vi.fn();
      
      renderWithProviders(
        <div
          data-testid="gesture-target"
          onTouchStart={() => {}}
          onTouchEnd={() => onTap()}
          onContextMenu={() => onLongPress()}
          className="w-32 h-32 bg-blue-500"
        >
          Gesture Target
        </div>
      );

      const target = screen.getByTestId('gesture-target');
      
      // Short tap
      target.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      setTimeout(() => {
        target.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]));
      }, 50);
      
      await waitFor(() => expect(onTap).toHaveBeenCalled());
      
      // Long press
      target.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      setTimeout(() => {
        target.dispatchEvent(new Event('contextmenu'));
      }, 600);
      
      await waitFor(() => expect(onLongPress).toHaveBeenCalled());
    });

    it('should handle multi-touch gestures', async () => {
      const onPinch = vi.fn();
      
      renderWithProviders(
        <div
          data-testid="multi-touch-target"
          onTouchStart={() => {}}
          onTouchMove={() => {}}
          onTouchEnd={() => onPinch()}
          className="w-64 h-64 bg-green-500"
        >
          Multi-touch Target
        </div>
      );

      const target = screen.getByTestId('multi-touch-target');
      
      await simulatePinch(target, {
        scale: 1.5,
        duration: 400,
      });

      expect(onPinch).toHaveBeenCalled();
    });

    it('should prevent accidental touches', () => {
      renderWithProviders(
        <div
          data-testid="touch-prevention"
          className="w-full h-20 bg-red-500"
          style={{ touchAction: 'manipulation' }}
        >
          Touch Prevention
        </div>
      );

      const target = screen.getByTestId('touch-prevention');
      const computedStyle = getComputedStyle(target);
      
      expect(computedStyle.touchAction).toBe('manipulation');
    });
  });

  describe('Mobile Performance Optimizations', () => {
    it('should use transform for animations', () => {
      renderWithProviders(
        <div
          data-testid="animated-element"
          className="transform transition-transform duration-300 translate-x-0 hover:translate-x-4"
        >
          Animated Element
        </div>
      );

      const element = screen.getByTestId('animated-element');
      const computedStyle = getComputedStyle(element);
      
      // Transform should be used instead of left/top
      expect(computedStyle.transform).toBeDefined();
    });

    it('should use will-change for optimal performance', () => {
      renderWithProviders(
        <div
          data-testid="optimized-element"
          className="will-change-transform"
        >
          Performance Optimized
        </div>
      );

      const element = screen.getByTestId('optimized-element');
      const computedStyle = getComputedStyle(element);
      
      expect(computedStyle.willChange).toBe('transform');
    });

    it('should handle momentum scrolling', () => {
      renderWithProviders(
        <div
          data-testid="scrollable-container"
          className="overflow-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ height: '200vh' }}>Long content</div>
        </div>
      );

      const container = screen.getByTestId('scrollable-container');
      const computedStyle = getComputedStyle(container);
      
      expect(computedStyle.WebkitOverflowScrolling).toBe('touch');
    });
  });
});