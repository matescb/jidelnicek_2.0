import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { MEDIA_QUERIES } from './constants';

interface TouchCapabilities {
  hasTouch: boolean;
  hasMouse: boolean;
  hasHover: boolean;
  hasFinePointer: boolean;
  hasCoarsePointer: boolean;
  hasAnyPointer: boolean;
  maxTouchPoints: number;
  primaryPointerType: 'touch' | 'mouse' | 'pen' | 'unknown';
}

/**
 * Hook for detecting touch capabilities and pointer types
 * @returns Object with touch and pointer information
 */
export function useTouchDetection(): TouchCapabilities {
  // Media query checks
  const hasHoverCapability = useMediaQuery(MEDIA_QUERIES.hover);
  const hasTouchCapability = useMediaQuery(MEDIA_QUERIES.touch);
  const hasFinePointer = useMediaQuery('(pointer: fine)');
  const hasCoarsePointer = useMediaQuery('(pointer: coarse)');
  const hasAnyPointer = useMediaQuery('(any-pointer)');
  
  // State for dynamic detection
  const [touchDetected, setTouchDetected] = useState(false);
  const [mouseDetected, setMouseDetected] = useState(false);
  const [lastPointerType, setLastPointerType] = useState<'touch' | 'mouse' | 'pen' | 'unknown'>('unknown');
  
  // Get max touch points
  const getMaxTouchPoints = useCallback((): number => {
    if (typeof window === 'undefined' || !navigator) {
      return 0;
    }
    
    return navigator.maxTouchPoints || 0;
  }, []);
  
  const [maxTouchPoints, setMaxTouchPoints] = useState(getMaxTouchPoints);
  
  // Detect touch support
  const hasTouchSupport = useCallback((): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }
    
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(any-hover: none)').matches)
    );
  }, []);
  
  // Event handlers for dynamic detection
  const handleTouchStart = useCallback(() => {
    setTouchDetected(true);
    setLastPointerType('touch');
  }, []);
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // Only register mouse if it's a real mouse event (not emulated)
    if (event.sourceCapabilities?.firesTouchEvents === false) {
      setMouseDetected(true);
      setLastPointerType('mouse');
    }
  }, []);
  
  const handlePointerDown = useCallback((event: PointerEvent) => {
    switch (event.pointerType) {
      case 'touch':
        setTouchDetected(true);
        setLastPointerType('touch');
        break;
      case 'mouse':
        setMouseDetected(true);
        setLastPointerType('mouse');
        break;
      case 'pen':
        setLastPointerType('pen');
        break;
    }
  }, []);
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Update max touch points
    setMaxTouchPoints(getMaxTouchPoints());
    
    // Add event listeners for dynamic detection
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Use pointer events if available
    if (window.PointerEvent) {
      window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    }
    
    // Cleanup
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mousemove', handleMouseMove);
      if (window.PointerEvent) {
        window.removeEventListener('pointerdown', handlePointerDown);
      }
    };
  }, [handleTouchStart, handleMouseMove, handlePointerDown, getMaxTouchPoints]);
  
  // Determine primary pointer type
  const primaryPointerType = lastPointerType !== 'unknown'
    ? lastPointerType
    : hasTouchCapability
    ? 'touch'
    : hasFinePointer
    ? 'mouse'
    : 'unknown';
  
  return {
    hasTouch: hasTouchSupport() || touchDetected || hasTouchCapability,
    hasMouse: mouseDetected || (!hasTouchCapability && hasFinePointer),
    hasHover: hasHoverCapability,
    hasFinePointer,
    hasCoarsePointer,
    hasAnyPointer,
    maxTouchPoints,
    primaryPointerType,
  };
}

/**
 * Hook for checking if device is primarily touch-based
 * @returns Boolean indicating if device is touch-primary
 */
export function useIsTouchDevice(): boolean {
  const { hasTouch, primaryPointerType } = useTouchDetection();
  return hasTouch && primaryPointerType === 'touch';
}

/**
 * Hook for checking if device supports hover interactions
 * @returns Boolean indicating hover support
 */
export function useHasHover(): boolean {
  const { hasHover } = useTouchDetection();
  return hasHover;
}

/**
 * Hook for checking if device has mouse support
 * @returns Boolean indicating mouse support
 */
export function useHasMouse(): boolean {
  const { hasMouse } = useTouchDetection();
  return hasMouse;
}

/**
 * Hook for getting primary input method
 * @returns Primary pointer type
 */
export function usePrimaryPointer(): 'touch' | 'mouse' | 'pen' | 'unknown' {
  const { primaryPointerType } = useTouchDetection();
  return primaryPointerType;
}