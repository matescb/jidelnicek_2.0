/**
 * Tests for gesture hooks
 */

import { renderHook, act } from '@testing-library/react';
import {
  useSwipe,
  usePinch,
  useLongPress,
  useDrag,
} from '../../hooks/useGestures';
import {
  createTouchEvent,
  createPointerEvent,
  simulateSwipe,
  simulatePinch,
  waitForAnimation,
} from './utils';

describe('useSwipe', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  it('should detect swipe left', async () => {
    const onSwipe = jest.fn();
    renderHook(() => useSwipe(element, { onSwipe }));

    await simulateSwipe(element, 200, 100, 50, 100, 200);

    expect(onSwipe).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'left',
        deltaX: -150,
        deltaY: 0,
        velocity: expect.any(Number),
      })
    );
  });

  it('should detect swipe right', async () => {
    const onSwipe = jest.fn();
    renderHook(() => useSwipe(element, { onSwipe }));

    await simulateSwipe(element, 50, 100, 200, 100, 200);

    expect(onSwipe).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'right',
        deltaX: 150,
        deltaY: 0,
        velocity: expect.any(Number),
      })
    );
  });

  it('should detect swipe up', async () => {
    const onSwipe = jest.fn();
    renderHook(() => useSwipe(element, { onSwipe }));

    await simulateSwipe(element, 100, 200, 100, 50, 200);

    expect(onSwipe).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'up',
        deltaX: 0,
        deltaY: -150,
        velocity: expect.any(Number),
      })
    );
  });

  it('should detect swipe down', async () => {
    const onSwipe = jest.fn();
    renderHook(() => useSwipe(element, { onSwipe }));

    await simulateSwipe(element, 100, 50, 100, 200, 200);

    expect(onSwipe).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'down',
        deltaX: 0,
        deltaY: 150,
        velocity: expect.any(Number),
      })
    );
  });

  it('should respect threshold', async () => {
    const onSwipe = jest.fn();
    renderHook(() => useSwipe(element, { onSwipe, threshold: 100 }));

    // Swipe less than threshold
    await simulateSwipe(element, 100, 100, 150, 100, 200);

    expect(onSwipe).not.toHaveBeenCalled();

    // Swipe more than threshold
    await simulateSwipe(element, 100, 100, 250, 100, 200);

    expect(onSwipe).toHaveBeenCalled();
  });

  it('should call onSwipeStart and onSwipeEnd', async () => {
    const onSwipeStart = jest.fn();
    const onSwipeEnd = jest.fn();
    const onSwipe = jest.fn();

    renderHook(() =>
      useSwipe(element, { onSwipe, onSwipeStart, onSwipeEnd })
    );

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }])
      );
    });

    expect(onSwipeStart).toHaveBeenCalledWith({ x: 100, y: 100 });

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchend', [{ clientX: 200, clientY: 100 }])
      );
    });

    expect(onSwipeEnd).toHaveBeenCalled();
  });

  it('should handle mouse events when touch is not available', () => {
    const onSwipe = jest.fn();
    renderHook(() => useSwipe(element, { onSwipe }));

    act(() => {
      element.dispatchEvent(
        new MouseEvent('mousedown', { clientX: 100, clientY: 100 })
      );
    });

    act(() => {
      element.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 200, clientY: 100 })
      );
    });

    act(() => {
      element.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 200, clientY: 100 })
      );
    });

    expect(onSwipe).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'right',
        deltaX: 100,
      })
    );
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListener = jest.spyOn(element, 'removeEventListener');
    const { unmount } = renderHook(() => useSwipe(element, {}));

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'touchstart',
      expect.any(Function)
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'mousedown',
      expect.any(Function)
    );
  });
});

describe('usePinch', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  it('should detect pinch zoom in', async () => {
    const onPinch = jest.fn();
    renderHook(() => usePinch(element, { onPinch }));

    await simulatePinch(element, 2, 200);

    expect(onPinch).toHaveBeenCalledWith(
      expect.objectContaining({
        scale: expect.any(Number),
        center: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      })
    );

    const lastCall = onPinch.mock.calls[onPinch.mock.calls.length - 1][0];
    expect(lastCall.scale).toBeGreaterThan(1);
  });

  it('should detect pinch zoom out', async () => {
    const onPinch = jest.fn();
    renderHook(() => usePinch(element, { onPinch }));

    await simulatePinch(element, 0.5, 200);

    const lastCall = onPinch.mock.calls[onPinch.mock.calls.length - 1][0];
    expect(lastCall.scale).toBeLessThan(1);
  });

  it('should call onPinchStart and onPinchEnd', async () => {
    const onPinchStart = jest.fn();
    const onPinchEnd = jest.fn();

    renderHook(() =>
      usePinch(element, { onPinch: jest.fn(), onPinchStart, onPinchEnd })
    );

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ])
      );
    });

    expect(onPinchStart).toHaveBeenCalled();

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchend', [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ])
      );
    });

    expect(onPinchEnd).toHaveBeenCalled();
  });

  it('should respect minimum scale', async () => {
    const onPinch = jest.fn();
    renderHook(() => usePinch(element, { onPinch, minScale: 0.5 }));

    // Try to pinch below minimum
    await simulatePinch(element, 0.3, 200);

    const lastCall = onPinch.mock.calls[onPinch.mock.calls.length - 1][0];
    expect(lastCall.scale).toBeGreaterThanOrEqual(0.5);
  });

  it('should respect maximum scale', async () => {
    const onPinch = jest.fn();
    renderHook(() => usePinch(element, { onPinch, maxScale: 3 }));

    // Try to pinch above maximum
    await simulatePinch(element, 5, 200);

    const lastCall = onPinch.mock.calls[onPinch.mock.calls.length - 1][0];
    expect(lastCall.scale).toBeLessThanOrEqual(3);
  });
});

describe('useLongPress', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    jest.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(element);
    jest.useRealTimers();
  });

  it('should trigger long press after delay', () => {
    const onLongPress = jest.fn();
    renderHook(() => useLongPress(element, { onLongPress }));

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }])
      );
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledWith({ x: 100, y: 100 });
  });

  it('should respect custom delay', () => {
    const onLongPress = jest.fn();
    renderHook(() => useLongPress(element, { onLongPress, delay: 1000 }));

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }])
      );
    });

    act(() => {
      jest.advanceTimersByTime(999);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(onLongPress).toHaveBeenCalled();
  });

  it('should cancel on move beyond threshold', () => {
    const onLongPress = jest.fn();
    renderHook(() =>
      useLongPress(element, { onLongPress, moveThreshold: 10 })
    );

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }])
      );
    });

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 115, clientY: 100 }])
      );
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should cancel on touch end', () => {
    const onLongPress = jest.fn();
    renderHook(() => useLongPress(element, { onLongPress }));

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }])
      );
    });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }])
      );
    });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should call onPressStart and onPressEnd', () => {
    const onPressStart = jest.fn();
    const onPressEnd = jest.fn();

    renderHook(() =>
      useLongPress(element, {
        onLongPress: jest.fn(),
        onPressStart,
        onPressEnd,
      })
    );

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }])
      );
    });

    expect(onPressStart).toHaveBeenCalledWith({ x: 100, y: 100 });

    act(() => {
      element.dispatchEvent(
        createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }])
      );
    });

    expect(onPressEnd).toHaveBeenCalled();
  });
});

describe('useDrag', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    Object.defineProperties(element, {
      offsetWidth: { value: 200 },
      offsetHeight: { value: 100 },
    });
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  it('should track drag movement', () => {
    const onDrag = jest.fn();
    renderHook(() => useDrag(element, { onDrag }));

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 100, clientY: 50 })
      );
    });

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 150, clientY: 75 })
      );
    });

    expect(onDrag).toHaveBeenCalledWith({
      x: 150,
      y: 75,
      deltaX: 50,
      deltaY: 25,
    });
  });

  it('should respect constraints', () => {
    const onDrag = jest.fn();
    renderHook(() =>
      useDrag(element, {
        onDrag,
        constraints: {
          minX: 0,
          maxX: 100,
          minY: 0,
          maxY: 50,
        },
      })
    );

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 25 })
      );
    });

    // Try to drag beyond constraints
    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 200, clientY: 100 })
      );
    });

    expect(onDrag).toHaveBeenCalledWith({
      x: 100, // Constrained to maxX
      y: 50, // Constrained to maxY
      deltaX: 50,
      deltaY: 25,
    });
  });

  it('should handle axis locking', () => {
    const onDrag = jest.fn();
    renderHook(() => useDrag(element, { onDrag, axis: 'x' }));

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 100, clientY: 50 })
      );
    });

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 150, clientY: 100 })
      );
    });

    expect(onDrag).toHaveBeenCalledWith({
      x: 150,
      y: 50, // Y should not change
      deltaX: 50,
      deltaY: 0,
    });
  });

  it('should call lifecycle callbacks', () => {
    const onDragStart = jest.fn();
    const onDragEnd = jest.fn();

    renderHook(() =>
      useDrag(element, {
        onDrag: jest.fn(),
        onDragStart,
        onDragEnd,
      })
    );

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 100, clientY: 50 })
      );
    });

    expect(onDragStart).toHaveBeenCalledWith({ x: 100, y: 50 });

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerup', { clientX: 150, clientY: 75 })
      );
    });

    expect(onDragEnd).toHaveBeenCalledWith({ x: 150, y: 75 });
  });

  it('should handle momentum', async () => {
    const onDrag = jest.fn();
    renderHook(() => useDrag(element, { onDrag, momentum: true }));

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 100, clientY: 50 })
      );
    });

    // Quick swipe
    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointermove', { clientX: 200, clientY: 50 })
      );
    });

    act(() => {
      element.dispatchEvent(
        createPointerEvent('pointerup', { clientX: 200, clientY: 50 })
      );
    });

    // Should continue moving after release
    await waitForAnimation();
    
    const calls = onDrag.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.x).toBeGreaterThan(200);
  });
});