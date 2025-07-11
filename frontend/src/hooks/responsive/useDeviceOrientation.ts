import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { MEDIA_QUERIES, ORIENTATIONS, Orientation } from './constants';

interface DeviceOrientationState {
  orientation: Orientation;
  isPortrait: boolean;
  isLandscape: boolean;
  angle: number;
  type: OrientationType | undefined;
  canLock: boolean;
}

type OrientationType = 
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

type OrientationLockType = 
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

/**
 * Hook for device orientation detection and management
 * @returns Object with orientation information and utilities
 */
export function useDeviceOrientation(): DeviceOrientationState & {
  lock: (orientation: OrientationLockType) => Promise<void>;
  unlock: () => void;
} {
  // Media query detection
  const isPortraitQuery = useMediaQuery(MEDIA_QUERIES.portrait);
  const isLandscapeQuery = useMediaQuery(MEDIA_QUERIES.landscape);
  
  // State for orientation details
  const [angle, setAngle] = useState(0);
  const [orientationType, setOrientationType] = useState<OrientationType | undefined>();
  const [canLock, setCanLock] = useState(false);
  
  // Determine current orientation
  const orientation: Orientation = isPortraitQuery
    ? ORIENTATIONS.PORTRAIT
    : ORIENTATIONS.LANDSCAPE;
  
  // Get current orientation details
  const getOrientationDetails = useCallback(() => {
    if (typeof window === 'undefined') {
      return { angle: 0, type: undefined };
    }
    
    // Modern API
    if (window.screen?.orientation) {
      return {
        angle: window.screen.orientation.angle,
        type: window.screen.orientation.type as OrientationType,
      };
    }
    
    // Legacy API
    if ('orientation' in window) {
      return {
        angle: (window as any).orientation as number,
        type: undefined,
      };
    }
    
    return { angle: 0, type: undefined };
  }, []);
  
  // Handle orientation change
  const handleOrientationChange = useCallback(() => {
    const { angle: newAngle, type } = getOrientationDetails();
    setAngle(newAngle);
    setOrientationType(type);
  }, [getOrientationDetails]);
  
  // Lock orientation
  const lock = useCallback(async (lockType: OrientationLockType) => {
    if (typeof window === 'undefined' || !window.screen?.orientation?.lock) {
      console.warn('Screen Orientation API not supported');
      return;
    }
    
    try {
      await window.screen.orientation.lock(lockType);
    } catch (error) {
      console.error('Failed to lock orientation:', error);
      throw error;
    }
  }, []);
  
  // Unlock orientation
  const unlock = useCallback(() => {
    if (typeof window === 'undefined' || !window.screen?.orientation?.unlock) {
      console.warn('Screen Orientation API not supported');
      return;
    }
    
    try {
      window.screen.orientation.unlock();
    } catch (error) {
      console.error('Failed to unlock orientation:', error);
    }
  }, []);
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Initialize orientation details
    const { angle: initialAngle, type } = getOrientationDetails();
    setAngle(initialAngle);
    setOrientationType(type);
    
    // Check if orientation lock is supported
    setCanLock(!!window.screen?.orientation?.lock);
    
    // Add event listeners
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    } else if ('orientationchange' in window) {
      window.addEventListener('orientationchange', handleOrientationChange);
    }
    
    // Cleanup
    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      } else if ('orientationchange' in window) {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, [handleOrientationChange, getOrientationDetails]);
  
  return {
    orientation,
    isPortrait: orientation === ORIENTATIONS.PORTRAIT,
    isLandscape: orientation === ORIENTATIONS.LANDSCAPE,
    angle,
    type: orientationType,
    canLock,
    lock,
    unlock,
  };
}

/**
 * Hook for checking if device is in portrait orientation
 * @returns Boolean indicating portrait orientation
 */
export function useIsPortrait(): boolean {
  const { isPortrait } = useDeviceOrientation();
  return isPortrait;
}

/**
 * Hook for checking if device is in landscape orientation
 * @returns Boolean indicating landscape orientation
 */
export function useIsLandscape(): boolean {
  const { isLandscape } = useDeviceOrientation();
  return isLandscape;
}

/**
 * Hook for getting current orientation angle
 * @returns Current orientation angle in degrees
 */
export function useOrientationAngle(): number {
  const { angle } = useDeviceOrientation();
  return angle;
}

/**
 * Hook for locking screen orientation
 * @param orientation - Orientation to lock to
 * @returns Object with lock and unlock functions
 */
export function useOrientationLock(orientation?: OrientationLockType): {
  lock: () => Promise<void>;
  unlock: () => void;
  canLock: boolean;
} {
  const { lock: lockOrientation, unlock, canLock } = useDeviceOrientation();
  
  const lock = useCallback(async () => {
    if (orientation) {
      await lockOrientation(orientation);
    }
  }, [orientation, lockOrientation]);
  
  // Auto-lock on mount if orientation is provided
  useEffect(() => {
    if (orientation && canLock) {
      lock().catch(console.error);
    }
    
    // Cleanup: unlock on unmount
    return () => {
      if (canLock) {
        unlock();
      }
    };
  }, [orientation, canLock, lock, unlock]);
  
  return { lock, unlock, canLock };
}