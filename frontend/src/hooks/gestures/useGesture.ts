import { useRef, useCallback, useEffect } from 'react';
import { useSwipe, type UseSwipeOptions } from './useSwipe';
import { usePinch, type UsePinchOptions } from './usePinch';
import { useLongPress, type UseLongPressOptions } from './useLongPress';
import { useDoubleTap, type UseDoubleTapOptions } from './useDoubleTap';
import { useDrag, type UseDragOptions } from './useDrag';
import type { Point } from './utils';

export interface UseGestureOptions {
  swipe?: UseSwipeOptions & { enabled?: boolean };
  pinch?: UsePinchOptions & { enabled?: boolean };
  longPress?: {
    enabled?: boolean;
    onLongPress: (point: Point) => void;
  } & UseLongPressOptions;
  doubleTap?: {
    enabled?: boolean;
    onDoubleTap: (point: Point) => void;
  } & UseDoubleTapOptions;
  drag?: UseDragOptions & { enabled?: boolean };
  priority?: Array<'swipe' | 'pinch' | 'longPress' | 'doubleTap' | 'drag'>;
}

interface GestureState {
  activeGestures: Set<string>;
  lastActiveTime: Record<string, number>;
}

/**
 * Combined gesture hook that manages multiple gestures with conflict resolution
 */
export function useGesture(
  elementRef: React.RefObject<HTMLElement>,
  options: UseGestureOptions = {}
) {
  const {
    swipe,
    pinch,
    longPress,
    doubleTap,
    drag,
    priority = ['pinch', 'drag', 'longPress', 'doubleTap', 'swipe'],
  } = options;

  const stateRef = useRef<GestureState>({
    activeGestures: new Set(),
    lastActiveTime: {},
  });

  // Create refs for gesture elements to avoid re-renders
  const swipeRef = useRef<HTMLElement | null>(null);
  const pinchRef = useRef<HTMLElement | null>(null);
  const longPressRef = useRef<HTMLElement | null>(null);
  const doubleTapRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<HTMLElement | null>(null);

  // Track active gestures
  const setGestureActive = useCallback((gesture: string, active: boolean) => {
    const state = stateRef.current;
    if (active) {
      state.activeGestures.add(gesture);
      state.lastActiveTime[gesture] = Date.now();
    } else {
      state.activeGestures.delete(gesture);
    }
  }, []);

  // Check if a gesture should be allowed based on priority
  const shouldAllowGesture = useCallback(
    (gesture: string): boolean => {
      const state = stateRef.current;
      
      // If no other gestures are active, allow
      if (state.activeGestures.size === 0) return true;
      
      // If this gesture is already active, continue
      if (state.activeGestures.has(gesture)) return true;
      
      // Check priority
      const currentPriority = priority.indexOf(gesture as any);
      if (currentPriority === -1) return true; // Not in priority list, allow
      
      // Check against active gestures
      for (const activeGesture of state.activeGestures) {
        const activePriority = priority.indexOf(activeGesture as any);
        if (activePriority !== -1 && activePriority < currentPriority) {
          // Higher priority gesture is active
          return false;
        }
      }
      
      return true;
    },
    [priority]
  );

  // Initialize gesture hooks conditionally
  const swipeState = useSwipe(swipeRef, {
    ...swipe,
    onSwipe: (direction) => {
      if (swipe?.enabled !== false && shouldAllowGesture('swipe')) {
        swipe?.onSwipe?.(direction);
      }
    },
    onSwipeUp: () => {
      if (swipe?.enabled !== false && shouldAllowGesture('swipe')) {
        swipe?.onSwipeUp?.();
      }
    },
    onSwipeDown: () => {
      if (swipe?.enabled !== false && shouldAllowGesture('swipe')) {
        swipe?.onSwipeDown?.();
      }
    },
    onSwipeLeft: () => {
      if (swipe?.enabled !== false && shouldAllowGesture('swipe')) {
        swipe?.onSwipeLeft?.();
      }
    },
    onSwipeRight: () => {
      if (swipe?.enabled !== false && shouldAllowGesture('swipe')) {
        swipe?.onSwipeRight?.();
      }
    },
  });

  const pinchState = usePinch(pinchRef, {
    ...pinch,
    onPinchStart: (scale, center) => {
      if (pinch?.enabled !== false && shouldAllowGesture('pinch')) {
        setGestureActive('pinch', true);
        pinch?.onPinchStart?.(scale, center);
      }
    },
    onPinchMove: (scale, center) => {
      if (pinch?.enabled !== false && stateRef.current.activeGestures.has('pinch')) {
        pinch?.onPinchMove?.(scale, center);
      }
    },
    onPinchEnd: (scale, center) => {
      if (pinch?.enabled !== false) {
        setGestureActive('pinch', false);
        pinch?.onPinchEnd?.(scale, center);
      }
    },
  });

  const longPressState = useLongPress(
    longPressRef,
    (point) => {
      if (longPress?.enabled !== false && shouldAllowGesture('longPress')) {
        longPress?.onLongPress?.(point);
      }
    },
    {
      ...longPress,
      onStart: (point) => {
        if (longPress?.enabled !== false && shouldAllowGesture('longPress')) {
          setGestureActive('longPress', true);
          longPress?.onStart?.(point);
        }
      },
      onEnd: (point, duration) => {
        if (longPress?.enabled !== false) {
          setGestureActive('longPress', false);
          longPress?.onEnd?.(point, duration);
        }
      },
      onCancel: () => {
        setGestureActive('longPress', false);
        longPress?.onCancel?.();
      },
    }
  );

  const doubleTapState = useDoubleTap(
    doubleTapRef,
    (point) => {
      if (doubleTap?.enabled !== false && shouldAllowGesture('doubleTap')) {
        doubleTap?.onDoubleTap?.(point);
      }
    },
    doubleTap
  );

  const dragState = useDrag(dragRef, {
    ...drag,
    onDragStart: (point) => {
      if (drag?.enabled !== false && shouldAllowGesture('drag')) {
        setGestureActive('drag', true);
        drag?.onDragStart?.(point);
      }
    },
    onDrag: (point, delta) => {
      if (drag?.enabled !== false && stateRef.current.activeGestures.has('drag')) {
        drag?.onDrag?.(point, delta);
      }
    },
    onDragEnd: (point, velocity) => {
      if (drag?.enabled !== false) {
        setGestureActive('drag', false);
        drag?.onDragEnd?.(point, velocity);
      }
    },
  });

  // Sync element refs
  useEffect(() => {
    const element = elementRef.current;
    if (element) {
      swipeRef.current = element;
      pinchRef.current = element;
      longPressRef.current = element;
      doubleTapRef.current = element;
      dragRef.current = element;
    }
  }, [elementRef]);

  // Clean up active gestures on unmount
  useEffect(() => {
    return () => {
      stateRef.current.activeGestures.clear();
    };
  }, []);

  return {
    swipe: swipeState,
    pinch: pinchState,
    longPress: longPressState,
    doubleTap: doubleTapState,
    drag: dragState,
    activeGestures: Array.from(stateRef.current.activeGestures),
    isGestureActive: (gesture: string) => stateRef.current.activeGestures.has(gesture),
  };
}