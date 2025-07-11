import { useEffect, useRef, useCallback } from 'react';
import {
  getEventPoint,
  getDistance,
  isTouchEvent,
  preventAndStop,
  type Point,
} from './utils';

export interface UseDoubleTapOptions {
  timeWindow?: number;
  maxDistance?: number;
  preventDefault?: boolean;
  preventClick?: boolean;
  onSingleTap?: (point: Point) => void;
  onTripleTap?: (point: Point) => void;
}

interface DoubleTapState {
  lastTapTime: number;
  lastTapPoint: Point | null;
  tapCount: number;
  timeoutId: NodeJS.Timeout | null;
}

export function useDoubleTap(
  elementRef: React.RefObject<HTMLElement>,
  onDoubleTap: (point: Point) => void,
  options: UseDoubleTapOptions = {}
) {
  const {
    timeWindow = 300,
    maxDistance = 30,
    preventDefault = true,
    preventClick = true,
    onSingleTap,
    onTripleTap,
  } = options;

  const stateRef = useRef<DoubleTapState>({
    lastTapTime: 0,
    lastTapPoint: null,
    tapCount: 0,
    timeoutId: null,
  });

  const clearTapTimeout = useCallback(() => {
    const state = stateRef.current;
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
  }, []);

  const resetTapState = useCallback(() => {
    clearTapTimeout();
    stateRef.current.tapCount = 0;
    stateRef.current.lastTapPoint = null;
  }, [clearTapTimeout]);

  const handleTap = useCallback(
    (event: TouchEvent | MouseEvent) => {
      // Skip if multiple touches
      if (isTouchEvent(event) && event.touches.length > 1) {
        resetTapState();
        return;
      }

      if (preventDefault) {
        preventAndStop(event);
      }

      const state = stateRef.current;
      const currentTime = Date.now();
      const tapPoint = getEventPoint(event);

      // Check if this tap is within the time window and distance threshold
      const isValidTap =
        state.lastTapPoint &&
        currentTime - state.lastTapTime < timeWindow &&
        getDistance(tapPoint, state.lastTapPoint) < maxDistance;

      if (isValidTap) {
        clearTapTimeout();
        state.tapCount++;

        if (state.tapCount === 2) {
          // Double tap
          onDoubleTap(tapPoint);
          if (!onTripleTap) {
            resetTapState();
          }
        } else if (state.tapCount === 3 && onTripleTap) {
          // Triple tap
          onTripleTap(tapPoint);
          resetTapState();
        }

        // Set timeout to reset if no more taps
        if (state.tapCount < 3 && onTripleTap) {
          state.timeoutId = setTimeout(resetTapState, timeWindow);
        }
      } else {
        // First tap or tap after timeout
        clearTapTimeout();
        state.tapCount = 1;
        state.lastTapTime = currentTime;
        state.lastTapPoint = tapPoint;

        // Set timeout for single tap
        if (onSingleTap) {
          state.timeoutId = setTimeout(() => {
            if (state.tapCount === 1) {
              onSingleTap(tapPoint);
            }
            resetTapState();
          }, timeWindow);
        } else {
          state.timeoutId = setTimeout(resetTapState, timeWindow);
        }
      }
    },
    [
      timeWindow,
      maxDistance,
      preventDefault,
      onDoubleTap,
      onSingleTap,
      onTripleTap,
      clearTapTimeout,
      resetTapState,
    ]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (preventClick && stateRef.current.tapCount > 0) {
        preventAndStop(event);
      }
    },
    [preventClick]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    const handleTouchEnd = (event: TouchEvent) => {
      // Only handle single touch end
      if (event.changedTouches.length === 1) {
        handleTap(event);
      }
    };

    element.addEventListener('touchend', handleTouchEnd, { passive: !preventDefault });

    // Mouse events
    element.addEventListener('mouseup', handleTap);

    // Prevent click if needed
    if (preventClick) {
      element.addEventListener('click', handleClick, { capture: true });
    }

    return () => {
      clearTapTimeout();
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('mouseup', handleTap);
      if (preventClick) {
        element.removeEventListener('click', handleClick, { capture: true });
      }
    };
  }, [elementRef, preventDefault, preventClick, handleTap, handleClick, clearTapTimeout]);

  return {
    tapCount: stateRef.current.tapCount,
    reset: resetTapState,
  };
}