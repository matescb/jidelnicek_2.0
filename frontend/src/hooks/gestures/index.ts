/**
 * Touch gesture hooks for React applications
 * Supports both touch and mouse events for cross-platform compatibility
 */

export { useSwipe } from './useSwipe';
export type { UseSwipeOptions } from './useSwipe';

export { usePinch } from './usePinch';
export type { UsePinchOptions } from './usePinch';

export { useLongPress } from './useLongPress';
export type { UseLongPressOptions } from './useLongPress';

export { useDoubleTap } from './useDoubleTap';
export type { UseDoubleTapOptions } from './useDoubleTap';

export { useDrag } from './useDrag';
export type { UseDragOptions, DragConstraints, SnapPoint } from './useDrag';

export { useGesture } from './useGesture';
export type { UseGestureOptions } from './useGesture';

// Export utility functions and types
export {
  getDistance,
  getAngle,
  getVelocity,
  getCenterPoint,
  getEventPoint,
  isTouchEvent,
  getTouchPoints,
  getSwipeDirection,
  getPinchScale,
  clamp,
  applyFriction,
  isVelocityBelowThreshold,
  vibrate,
  preventAndStop,
  addPassiveEventListener,
  TouchTracker,
} from './utils';

export type { Point, TouchData, SwipeDirection } from './utils';