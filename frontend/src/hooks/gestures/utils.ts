/**
 * Gesture utility functions for touch and mouse event handling
 */

export interface Point {
  x: number;
  y: number;
}

export interface TouchData {
  identifier: number;
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  velocityX: number;
  velocityY: number;
}

/**
 * Calculate distance between two points
 */
export function getDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate angle between two points in radians
 */
export function getAngle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Calculate velocity between two points over time
 */
export function getVelocity(
  startPoint: Point,
  endPoint: Point,
  deltaTime: number
): Point {
  if (deltaTime === 0) return { x: 0, y: 0 };
  return {
    x: (endPoint.x - startPoint.x) / deltaTime,
    y: (endPoint.y - startPoint.y) / deltaTime,
  };
}

/**
 * Get the center point between two points
 */
export function getCenterPoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Get point from touch or mouse event
 */
export function getEventPoint(
  event: TouchEvent | MouseEvent,
  touchIndex = 0
): Point {
  if ('touches' in event) {
    const touch = event.touches[touchIndex] || event.changedTouches[touchIndex];
    return touch ? { x: touch.clientX, y: touch.clientY } : { x: 0, y: 0 };
  }
  return { x: event.clientX, y: event.clientY };
}

/**
 * Check if event is a touch event
 */
export function isTouchEvent(
  event: TouchEvent | MouseEvent
): event is TouchEvent {
  return 'touches' in event;
}

/**
 * Get all touch points from event
 */
export function getTouchPoints(event: TouchEvent): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < event.touches.length; i++) {
    points.push({
      x: event.touches[i].clientX,
      y: event.touches[i].clientY,
    });
  }
  return points;
}

/**
 * Detect swipe direction based on movement
 */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export function getSwipeDirection(
  startPoint: Point,
  endPoint: Point,
  threshold = 30
): SwipeDirection | null {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Not enough movement
  if (absDx < threshold && absDy < threshold) {
    return null;
  }

  // Determine primary direction
  if (absDx > absDy) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

/**
 * Calculate pinch scale based on two touch points
 */
export function getPinchScale(
  startPoints: [Point, Point],
  currentPoints: [Point, Point]
): number {
  const startDistance = getDistance(startPoints[0], startPoints[1]);
  const currentDistance = getDistance(currentPoints[0], currentPoints[1]);
  return currentDistance / startDistance;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Apply momentum decay to velocity
 */
export function applyFriction(velocity: Point, friction = 0.95): Point {
  return {
    x: velocity.x * friction,
    y: velocity.y * friction,
  };
}

/**
 * Check if velocity is below threshold
 */
export function isVelocityBelowThreshold(
  velocity: Point,
  threshold = 0.01
): boolean {
  return Math.abs(velocity.x) < threshold && Math.abs(velocity.y) < threshold;
}

/**
 * Request vibration feedback if available
 */
export function vibrate(pattern: number | number[] = 50): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Prevent default and stop propagation for event
 */
export function preventAndStop(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Add passive event listener with fallback
 */
export function addPassiveEventListener(
  element: HTMLElement | Document | Window,
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
): void {
  let passiveSupported = false;

  try {
    const opts = Object.defineProperty({}, 'passive', {
      get() {
        passiveSupported = true;
        return true;
      },
    });
    window.addEventListener('test', null as any, opts);
    window.removeEventListener('test', null as any, opts);
  } catch (e) {
    // Passive not supported
  }

  const listenerOptions =
    passiveSupported && typeof options === 'object'
      ? { ...options, passive: true }
      : options;

  element.addEventListener(event, handler, listenerOptions);
}

/**
 * Track touch data for gesture recognition
 */
export class TouchTracker {
  private touches = new Map<number, TouchData>();

  start(touch: Touch): void {
    this.touches.set(touch.identifier, {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentX: touch.clientX,
      currentY: touch.clientY,
      velocityX: 0,
      velocityY: 0,
    });
  }

  update(touch: Touch): void {
    const data = this.touches.get(touch.identifier);
    if (!data) return;

    const deltaTime = (Date.now() - data.startTime) / 1000;
    const velocity = getVelocity(
      { x: data.currentX, y: data.currentY },
      { x: touch.clientX, y: touch.clientY },
      deltaTime
    );

    data.currentX = touch.clientX;
    data.currentY = touch.clientY;
    data.velocityX = velocity.x;
    data.velocityY = velocity.y;
  }

  end(touch: Touch): TouchData | undefined {
    const data = this.touches.get(touch.identifier);
    if (data) {
      this.touches.delete(touch.identifier);
    }
    return data;
  }

  get(identifier: number): TouchData | undefined {
    return this.touches.get(identifier);
  }

  clear(): void {
    this.touches.clear();
  }

  get size(): number {
    return this.touches.size;
  }
}