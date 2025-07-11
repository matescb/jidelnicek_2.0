import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getEventPoint,
  isTouchEvent,
  preventAndStop,
  clamp,
  applyFriction,
  isVelocityBelowThreshold,
  type Point,
} from './utils';

export interface DragConstraints {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface SnapPoint {
  x: number;
  y: number;
  id?: string;
}

export interface UseDragOptions {
  axis?: 'x' | 'y' | 'both';
  constraints?: DragConstraints;
  snapToGrid?: number;
  snapPoints?: SnapPoint[];
  snapThreshold?: number;
  momentum?: boolean;
  friction?: number;
  preventDefault?: boolean;
  onDragStart?: (point: Point) => void;
  onDrag?: (point: Point, delta: Point) => void;
  onDragEnd?: (point: Point, velocity: Point) => void;
  onSnap?: (snapPoint: SnapPoint) => void;
}

interface DragState {
  isDragging: boolean;
  startPoint: Point | null;
  lastPoint: Point | null;
  offset: Point;
  velocity: Point;
  lastTime: number;
}

export function useDrag(
  elementRef: React.RefObject<HTMLElement>,
  options: UseDragOptions = {}
) {
  const {
    axis = 'both',
    constraints,
    snapToGrid,
    snapPoints,
    snapThreshold = 30,
    momentum = true,
    friction = 0.95,
    preventDefault = true,
    onDragStart,
    onDrag,
    onDragEnd,
    onSnap,
  } = options;

  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const stateRef = useRef<DragState>({
    isDragging: false,
    startPoint: null,
    lastPoint: null,
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    lastTime: 0,
  });

  const animationFrameRef = useRef<number | null>(null);

  const constrainPosition = useCallback(
    (point: Point): Point => {
      let { x, y } = point;

      if (constraints) {
        if (constraints.left !== undefined) x = Math.max(x, constraints.left);
        if (constraints.right !== undefined) x = Math.min(x, constraints.right);
        if (constraints.top !== undefined) y = Math.max(y, constraints.top);
        if (constraints.bottom !== undefined) y = Math.min(y, constraints.bottom);
      }

      return { x, y };
    },
    [constraints]
  );

  const snapToGrid = useCallback(
    (point: Point): Point => {
      if (!snapToGrid) return point;

      return {
        x: Math.round(point.x / snapToGrid) * snapToGrid,
        y: Math.round(point.y / snapToGrid) * snapToGrid,
      };
    },
    [snapToGrid]
  );

  const findNearestSnapPoint = useCallback(
    (point: Point): SnapPoint | null => {
      if (!snapPoints || snapPoints.length === 0) return null;

      let nearestPoint: SnapPoint | null = null;
      let minDistance = Infinity;

      for (const snapPoint of snapPoints) {
        const dx = point.x - snapPoint.x;
        const dy = point.y - snapPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance && distance < snapThreshold) {
          minDistance = distance;
          nearestPoint = snapPoint;
        }
      }

      return nearestPoint;
    },
    [snapPoints, snapThreshold]
  );

  const updatePosition = useCallback(
    (point: Point, applySnap = false): Point => {
      let newPosition = { ...point };

      // Apply axis constraints
      if (axis === 'x') newPosition.y = position.y;
      if (axis === 'y') newPosition.x = position.x;

      // Apply boundary constraints
      newPosition = constrainPosition(newPosition);

      // Apply grid snapping
      if (snapToGrid && applySnap) {
        newPosition = snapToGrid(newPosition);
      }

      // Apply point snapping
      if (snapPoints && applySnap) {
        const snapPoint = findNearestSnapPoint(newPosition);
        if (snapPoint) {
          newPosition = { x: snapPoint.x, y: snapPoint.y };
          onSnap?.(snapPoint);
        }
      }

      setPosition(newPosition);
      return newPosition;
    },
    [axis, position, constrainPosition, snapToGrid, snapPoints, findNearestSnapPoint, onSnap]
  );

  const applyMomentum = useCallback(() => {
    const state = stateRef.current;

    if (!momentum || state.isDragging) return;

    const animate = () => {
      if (state.isDragging || isVelocityBelowThreshold(state.velocity)) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      // Apply friction
      state.velocity = applyFriction(state.velocity, friction);

      // Update position
      const newPosition = updatePosition({
        x: position.x + state.velocity.x,
        y: position.y + state.velocity.y,
      });

      // Stop if hit constraints
      if (
        constraints &&
        ((constraints.left !== undefined && newPosition.x <= constraints.left) ||
          (constraints.right !== undefined && newPosition.x >= constraints.right) ||
          (constraints.top !== undefined && newPosition.y <= constraints.top) ||
          (constraints.bottom !== undefined && newPosition.y >= constraints.bottom))
      ) {
        state.velocity = { x: 0, y: 0 };
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [momentum, friction, position, constraints, updatePosition]);

  const handleStart = useCallback(
    (event: TouchEvent | MouseEvent) => {
      // Skip if multiple touches
      if (isTouchEvent(event) && event.touches.length > 1) return;

      if (preventDefault) {
        preventAndStop(event);
      }

      const point = getEventPoint(event);
      const state = stateRef.current;

      state.isDragging = true;
      state.startPoint = point;
      state.lastPoint = point;
      state.offset = {
        x: point.x - position.x,
        y: point.y - position.y,
      };
      state.velocity = { x: 0, y: 0 };
      state.lastTime = Date.now();

      setIsDragging(true);
      onDragStart?.(point);

      // Cancel any ongoing momentum animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    },
    [preventDefault, position, onDragStart]
  );

  const handleMove = useCallback(
    (event: TouchEvent | MouseEvent) => {
      const state = stateRef.current;
      if (!state.isDragging || !state.startPoint) return;

      if (preventDefault) {
        preventAndStop(event);
      }

      const currentPoint = getEventPoint(event);
      const currentTime = Date.now();
      const deltaTime = currentTime - state.lastTime;

      // Calculate velocity
      if (deltaTime > 0 && state.lastPoint) {
        state.velocity = {
          x: (currentPoint.x - state.lastPoint.x) / deltaTime * 16, // Convert to 60fps
          y: (currentPoint.y - state.lastPoint.y) / deltaTime * 16,
        };
      }

      // Calculate new position
      const newPosition = {
        x: currentPoint.x - state.offset.x,
        y: currentPoint.y - state.offset.y,
      };

      const constrainedPosition = updatePosition(newPosition);
      const delta = {
        x: constrainedPosition.x - position.x,
        y: constrainedPosition.y - position.y,
      };

      onDrag?.(constrainedPosition, delta);

      state.lastPoint = currentPoint;
      state.lastTime = currentTime;
    },
    [preventDefault, position, updatePosition, onDrag]
  );

  const handleEnd = useCallback(
    (event: TouchEvent | MouseEvent) => {
      const state = stateRef.current;
      if (!state.isDragging) return;

      const endPoint = getEventPoint(event);
      state.isDragging = false;
      setIsDragging(false);

      // Apply final snapping
      updatePosition(position, true);

      onDragEnd?.(endPoint, state.velocity);

      // Start momentum animation if enabled
      if (momentum && (Math.abs(state.velocity.x) > 0.1 || Math.abs(state.velocity.y) > 0.1)) {
        applyMomentum();
      }
    },
    [position, momentum, updatePosition, onDragEnd, applyMomentum]
  );

  const handleCancel = useCallback(() => {
    const state = stateRef.current;
    state.isDragging = false;
    state.velocity = { x: 0, y: 0 };
    setIsDragging(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

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
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleCancel);
      element.removeEventListener('mousedown', handleStart);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    elementRef,
    preventDefault,
    handleStart,
    handleMove,
    handleEnd,
    handleCancel,
  ]);

  return {
    position,
    isDragging,
    setPosition: (newPosition: Point) => updatePosition(newPosition, true),
    reset: () => updatePosition({ x: 0, y: 0 }, true),
  };
}