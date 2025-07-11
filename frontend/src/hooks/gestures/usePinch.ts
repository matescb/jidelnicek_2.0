import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getDistance,
  getCenterPoint,
  getTouchPoints,
  preventAndStop,
  clamp,
  type Point,
} from './utils';

export interface UsePinchOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  doubleTapToReset?: boolean;
  onPinchStart?: (scale: number, center: Point) => void;
  onPinchMove?: (scale: number, center: Point) => void;
  onPinchEnd?: (scale: number, center: Point) => void;
  onDoubleTap?: (point: Point) => void;
}

interface PinchState {
  isActive: boolean;
  startDistance: number;
  startScale: number;
  startPoints: [Point, Point] | null;
  lastTapTime: number;
  lastTapPoint: Point | null;
}

export function usePinch(
  elementRef: React.RefObject<HTMLElement>,
  options: UsePinchOptions = {}
) {
  const {
    minScale = 0.5,
    maxScale = 4,
    initialScale = 1,
    doubleTapToReset = true,
    onPinchStart,
    onPinchMove,
    onPinchEnd,
    onDoubleTap,
  } = options;

  const [scale, setScale] = useState(initialScale);
  const [center, setCenter] = useState<Point>({ x: 0, y: 0 });

  const stateRef = useRef<PinchState>({
    isActive: false,
    startDistance: 0,
    startScale: scale,
    startPoints: null,
    lastTapTime: 0,
    lastTapPoint: null,
  });

  const resetScale = useCallback(() => {
    setScale(initialScale);
  }, [initialScale]);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      const state = stateRef.current;

      // Handle double tap
      if (event.touches.length === 1) {
        const touchPoint = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        const currentTime = Date.now();
        const tapDelta = currentTime - state.lastTapTime;

        if (
          tapDelta < 300 &&
          state.lastTapPoint &&
          getDistance(touchPoint, state.lastTapPoint) < 30
        ) {
          // Double tap detected
          if (doubleTapToReset) {
            resetScale();
          }
          onDoubleTap?.(touchPoint);
        }

        state.lastTapTime = currentTime;
        state.lastTapPoint = touchPoint;
      }

      // Start pinch gesture
      if (event.touches.length === 2) {
        preventAndStop(event);

        const points = getTouchPoints(event);
        const point1 = points[0];
        const point2 = points[1];
        const distance = getDistance(point1, point2);
        const centerPoint = getCenterPoint(point1, point2);

        state.isActive = true;
        state.startDistance = distance;
        state.startScale = scale;
        state.startPoints = [point1, point2];

        setCenter(centerPoint);
        onPinchStart?.(scale, centerPoint);
      }
    },
    [scale, doubleTapToReset, resetScale, onPinchStart, onDoubleTap]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const state = stateRef.current;

      if (!state.isActive || event.touches.length !== 2) {
        return;
      }

      preventAndStop(event);

      const points = getTouchPoints(event);
      const point1 = points[0];
      const point2 = points[1];
      const currentDistance = getDistance(point1, point2);
      const centerPoint = getCenterPoint(point1, point2);

      // Calculate scale
      const scaleDelta = currentDistance / state.startDistance;
      const newScale = clamp(state.startScale * scaleDelta, minScale, maxScale);

      setScale(newScale);
      setCenter(centerPoint);
      onPinchMove?.(newScale, centerPoint);
    },
    [minScale, maxScale, onPinchMove]
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const state = stateRef.current;

      if (state.isActive && event.touches.length < 2) {
        state.isActive = false;
        state.startPoints = null;
        onPinchEnd?.(scale, center);
      }
    },
    [scale, center, onPinchEnd]
  );

  const handleTouchCancel = useCallback(() => {
    const state = stateRef.current;
    if (state.isActive) {
      state.isActive = false;
      state.startPoints = null;
      onPinchEnd?.(scale, center);
    }
  }, [scale, center, onPinchEnd]);

  // Mouse wheel zoom support
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      preventAndStop(event);

      const rect = elementRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Calculate scale based on wheel delta
      const scaleDelta = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = clamp(scale * scaleDelta, minScale, maxScale);

      setScale(newScale);
      setCenter(centerPoint);
      onPinchMove?.(newScale, centerPoint);
    },
    [scale, minScale, maxScale, elementRef, onPinchMove]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchCancel);
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      element.removeEventListener('wheel', handleWheel);
    };
  }, [
    elementRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleWheel,
  ]);

  return {
    scale,
    center,
    isActive: stateRef.current.isActive,
    resetScale,
    setScale: (newScale: number) => setScale(clamp(newScale, minScale, maxScale)),
  };
}