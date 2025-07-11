import { useEffect, useRef, useCallback } from 'react';
import {
  getEventPoint,
  getSwipeDirection,
  getDistance,
  isTouchEvent,
  preventAndStop,
  type Point,
  type SwipeDirection,
} from './utils';

export interface UseSwipeOptions {
  threshold?: number;
  velocityThreshold?: number;
  preventDefaultOnSwipe?: boolean;
  preventScrollOnSwipe?: boolean;
  touchOnly?: boolean;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipe?: (direction: SwipeDirection) => void;
}

interface SwipeState {
  startPoint: Point | null;
  startTime: number;
  isTracking: boolean;
  lastPoint: Point | null;
}

export function useSwipe(
  elementRef: React.RefObject<HTMLElement>,
  options: UseSwipeOptions = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    preventDefaultOnSwipe = true,
    preventScrollOnSwipe = true,
    touchOnly = false,
    onSwipeUp,
    onSwipeDown,
    onSwipeLeft,
    onSwipeRight,
    onSwipe,
  } = options;

  const stateRef = useRef<SwipeState>({
    startPoint: null,
    startTime: 0,
    isTracking: false,
    lastPoint: null,
  });

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      // Call specific direction handler
      switch (direction) {
        case 'up':
          onSwipeUp?.();
          break;
        case 'down':
          onSwipeDown?.();
          break;
        case 'left':
          onSwipeLeft?.();
          break;
        case 'right':
          onSwipeRight?.();
          break;
      }

      // Call general swipe handler
      onSwipe?.(direction);
    },
    [onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight, onSwipe]
  );

  const handleStart = useCallback(
    (event: TouchEvent | MouseEvent) => {
      // Skip if touch only mode and not a touch event
      if (touchOnly && !isTouchEvent(event)) {
        return;
      }

      // Skip if multiple touches (prevent conflicts with pinch)
      if (isTouchEvent(event) && event.touches.length > 1) {
        stateRef.current.isTracking = false;
        return;
      }

      const point = getEventPoint(event);
      stateRef.current = {
        startPoint: point,
        startTime: Date.now(),
        isTracking: true,
        lastPoint: point,
      };
    },
    [touchOnly]
  );

  const handleMove = useCallback(
    (event: TouchEvent | MouseEvent) => {
      const state = stateRef.current;
      if (!state.isTracking || !state.startPoint) {
        return;
      }

      // Skip if multiple touches
      if (isTouchEvent(event) && event.touches.length > 1) {
        state.isTracking = false;
        return;
      }

      const currentPoint = getEventPoint(event);
      state.lastPoint = currentPoint;

      // Prevent scrolling while swiping if enabled
      if (preventScrollOnSwipe) {
        const distance = getDistance(state.startPoint, currentPoint);
        if (distance > 10) {
          preventAndStop(event);
        }
      }
    },
    [preventScrollOnSwipe]
  );

  const handleEnd = useCallback(
    (event: TouchEvent | MouseEvent) => {
      const state = stateRef.current;
      if (!state.isTracking || !state.startPoint || !state.lastPoint) {
        return;
      }

      state.isTracking = false;

      const endPoint = getEventPoint(event);
      const deltaTime = (Date.now() - state.startTime) / 1000;
      const distance = getDistance(state.startPoint, endPoint);
      const velocity = deltaTime > 0 ? distance / deltaTime : 0;

      // Check if swipe meets criteria
      if (distance >= threshold || velocity >= velocityThreshold) {
        const direction = getSwipeDirection(state.startPoint, endPoint, threshold);
        if (direction) {
          if (preventDefaultOnSwipe) {
            preventAndStop(event);
          }
          handleSwipe(direction);
        }
      }

      // Reset state
      stateRef.current = {
        startPoint: null,
        startTime: 0,
        isTracking: false,
        lastPoint: null,
      };
    },
    [threshold, velocityThreshold, preventDefaultOnSwipe, handleSwipe]
  );

  const handleCancel = useCallback(() => {
    stateRef.current = {
      startPoint: null,
      startTime: 0,
      isTracking: false,
      lastPoint: null,
    };
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    element.addEventListener('touchstart', handleStart, { passive: !preventScrollOnSwipe });
    element.addEventListener('touchmove', handleMove, { passive: !preventScrollOnSwipe });
    element.addEventListener('touchend', handleEnd);
    element.addEventListener('touchcancel', handleCancel);

    // Mouse events (if not touch only)
    if (!touchOnly) {
      element.addEventListener('mousedown', handleStart);
      element.addEventListener('mousemove', handleMove);
      element.addEventListener('mouseup', handleEnd);
      element.addEventListener('mouseleave', handleCancel);
    }

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleCancel);

      if (!touchOnly) {
        element.removeEventListener('mousedown', handleStart);
        element.removeEventListener('mousemove', handleMove);
        element.removeEventListener('mouseup', handleEnd);
        element.removeEventListener('mouseleave', handleCancel);
      }
    };
  }, [
    elementRef,
    touchOnly,
    preventScrollOnSwipe,
    handleStart,
    handleMove,
    handleEnd,
    handleCancel,
  ]);

  return {
    isTracking: stateRef.current.isTracking,
  };
}