import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getEventPoint,
  getDistance,
  isTouchEvent,
  vibrate,
  preventAndStop,
  type Point,
} from './utils';

export interface UseLongPressOptions {
  duration?: number;
  movementThreshold?: number;
  preventDefault?: boolean;
  vibrateOnStart?: boolean;
  vibratePattern?: number | number[];
  onStart?: (point: Point) => void;
  onMove?: (point: Point) => void;
  onEnd?: (point: Point, duration: number) => void;
  onCancel?: () => void;
}

interface LongPressState {
  isActive: boolean;
  startPoint: Point | null;
  startTime: number;
  timeoutId: NodeJS.Timeout | null;
  currentPoint: Point | null;
}

export function useLongPress(
  elementRef: React.RefObject<HTMLElement>,
  onLongPress: (point: Point) => void,
  options: UseLongPressOptions = {}
) {
  const {
    duration = 500,
    movementThreshold = 10,
    preventDefault = true,
    vibrateOnStart = true,
    vibratePattern = 50,
    onStart,
    onMove,
    onEnd,
    onCancel,
  } = options;

  const [isPressed, setIsPressed] = useState(false);
  const [progress, setProgress] = useState(0);

  const stateRef = useRef<LongPressState>({
    isActive: false,
    startPoint: null,
    startTime: 0,
    timeoutId: null,
    currentPoint: null,
  });

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    const state = stateRef.current;
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    const state = stateRef.current;
    clearTimers();
    setIsPressed(false);
    setProgress(0);
    state.isActive = false;
    state.startPoint = null;
    state.currentPoint = null;
    onCancel?.();
  }, [clearTimers, onCancel]);

  const handleStart = useCallback(
    (event: TouchEvent | MouseEvent) => {
      // Skip if multiple touches
      if (isTouchEvent(event) && event.touches.length > 1) {
        handleCancel();
        return;
      }

      if (preventDefault) {
        preventAndStop(event);
      }

      const point = getEventPoint(event);
      const state = stateRef.current;

      state.isActive = true;
      state.startPoint = point;
      state.currentPoint = point;
      state.startTime = Date.now();

      setIsPressed(true);
      setProgress(0);
      onStart?.(point);

      // Start progress tracking
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        const currentProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(currentProgress);
      }, 16); // ~60fps

      // Set timeout for long press
      state.timeoutId = setTimeout(() => {
        if (state.isActive && state.startPoint) {
          if (vibrateOnStart) {
            vibrate(vibratePattern);
          }
          onLongPress(state.startPoint);
          handleCancel();
        }
      }, duration);
    },
    [
      duration,
      preventDefault,
      vibrateOnStart,
      vibratePattern,
      onLongPress,
      onStart,
      handleCancel,
    ]
  );

  const handleMove = useCallback(
    (event: TouchEvent | MouseEvent) => {
      const state = stateRef.current;
      if (!state.isActive || !state.startPoint) return;

      const currentPoint = getEventPoint(event);
      state.currentPoint = currentPoint;

      // Check if movement exceeds threshold
      const distance = getDistance(state.startPoint, currentPoint);
      if (distance > movementThreshold) {
        handleCancel();
      } else {
        onMove?.(currentPoint);
      }
    },
    [movementThreshold, onMove, handleCancel]
  );

  const handleEnd = useCallback(
    (event: TouchEvent | MouseEvent) => {
      const state = stateRef.current;
      if (!state.isActive) return;

      const endPoint = getEventPoint(event);
      const pressDuration = Date.now() - state.startTime;

      clearTimers();
      setIsPressed(false);
      setProgress(0);

      if (state.isActive && pressDuration < duration) {
        onEnd?.(endPoint, pressDuration);
      }

      state.isActive = false;
      state.startPoint = null;
      state.currentPoint = null;
    },
    [duration, clearTimers, onEnd]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    element.addEventListener('touchstart', handleStart, { passive: !preventDefault });
    element.addEventListener('touchmove', handleMove, { passive: !preventDefault });
    element.addEventListener('touchend', handleEnd);
    element.addEventListener('touchcancel', handleCancel);

    // Mouse events
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('mousemove', handleMove);
    element.addEventListener('mouseup', handleEnd);
    element.addEventListener('mouseleave', handleCancel);

    // Context menu (right-click)
    const handleContextMenu = (e: Event) => {
      if (preventDefault && stateRef.current.isActive) {
        e.preventDefault();
      }
    };
    element.addEventListener('contextmenu', handleContextMenu);

    return () => {
      clearTimers();
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleCancel);
      element.removeEventListener('mousedown', handleStart);
      element.removeEventListener('mousemove', handleMove);
      element.removeEventListener('mouseup', handleEnd);
      element.removeEventListener('mouseleave', handleCancel);
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    elementRef,
    preventDefault,
    handleStart,
    handleMove,
    handleEnd,
    handleCancel,
    clearTimers,
  ]);

  return {
    isPressed,
    progress,
    cancel: handleCancel,
  };
}