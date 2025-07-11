import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Variants } from 'framer-motion';
import { TransitionMode } from './PageTransitions';

interface TransitionSettings {
  enabled: boolean;
  defaultTransition: TransitionMode;
  speedMultiplier: number;
  enablePreload: boolean;
  preserveScrollDefault: boolean;
  reducedMotion: boolean;
  enableSoundEffects: boolean;
  transitionQuality: 'low' | 'medium' | 'high';
}

interface RouteTransitionConfig {
  mode: TransitionMode;
  duration?: number;
  customTransition?: Variants;
  preserveScroll?: boolean;
  preload?: boolean;
  priority?: number;
  easing?: string | number[];
  delay?: number;
  soundEffect?: string;
}

interface TransitionContextValue {
  settings: TransitionSettings;
  updateSettings: (settings: Partial<TransitionSettings>) => void;
  routeOverrides: Map<string, RouteTransitionConfig>;
  setRouteTransition: (path: string, config: RouteTransitionConfig) => void;
  removeRouteTransition: (path: string) => void;
  getRouteTransition: (path: string) => RouteTransitionConfig | undefined;
  clearRouteTransitions: () => void;
}

const defaultSettings: TransitionSettings = {
  enabled: true,
  defaultTransition: 'fade',
  speedMultiplier: 1,
  enablePreload: true,
  preserveScrollDefault: true,
  reducedMotion: false,
  enableSoundEffects: false,
  transitionQuality: 'medium',
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

interface TransitionProviderProps {
  children: ReactNode;
  initialSettings?: Partial<TransitionSettings>;
  routeConfigs?: Record<string, RouteTransitionConfig>;
}

export const TransitionProvider: React.FC<TransitionProviderProps> = ({
  children,
  initialSettings = {},
  routeConfigs = {},
}) => {
  // Check for user's motion preferences
  const prefersReducedMotion = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, []);

  const [settings, setSettings] = useState<TransitionSettings>({
    ...defaultSettings,
    ...initialSettings,
    reducedMotion: initialSettings.reducedMotion ?? prefersReducedMotion,
  });

  const [routeOverrides] = useState<Map<string, RouteTransitionConfig>>(
    new Map(Object.entries(routeConfigs))
  );

  const updateSettings = useCallback((newSettings: Partial<TransitionSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // Persist settings to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('transitionSettings', JSON.stringify(updated));
      }
      
      return updated;
    });
  }, []);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('transitionSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Failed to parse saved transition settings:', error);
        }
      }
    }
  }, []);

  const setRouteTransition = useCallback((path: string, config: RouteTransitionConfig) => {
    routeOverrides.set(path, config);
  }, [routeOverrides]);

  const removeRouteTransition = useCallback((path: string) => {
    routeOverrides.delete(path);
  }, [routeOverrides]);

  const getRouteTransition = useCallback((path: string): RouteTransitionConfig | undefined => {
    // Check exact match first
    if (routeOverrides.has(path)) {
      return routeOverrides.get(path);
    }

    // Check for pattern matches (e.g., /admin/* matches /admin/users)
    for (const [pattern, config] of routeOverrides.entries()) {
      if (pattern.endsWith('/*') && path.startsWith(pattern.slice(0, -2))) {
        return config;
      }
      // Check regex patterns
      if (pattern.startsWith('/^') && pattern.endsWith('$/')) {
        const regex = new RegExp(pattern.slice(2, -2));
        if (regex.test(path)) {
          return config;
        }
      }
    }

    return undefined;
  }, [routeOverrides]);

  const clearRouteTransitions = useCallback(() => {
    routeOverrides.clear();
  }, [routeOverrides]);

  const value = useMemo(() => ({
    settings,
    updateSettings,
    routeOverrides,
    setRouteTransition,
    removeRouteTransition,
    getRouteTransition,
    clearRouteTransitions,
  }), [
    settings,
    updateSettings,
    routeOverrides,
    setRouteTransition,
    removeRouteTransition,
    getRouteTransition,
    clearRouteTransitions,
  ]);

  return (
    <TransitionContext.Provider value={value}>
      {children}
    </TransitionContext.Provider>
  );
};

export const useTransitionProvider = () => {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransitionProvider must be used within TransitionProvider');
  }
  return context;
};

// Preset configurations for common route patterns
export const transitionPresets: Record<string, Record<string, RouteTransitionConfig>> = {
  dashboard: {
    '/dashboard': { mode: 'fade', duration: 0.2 },
    '/dashboard/*': { mode: 'fade', duration: 0.2 },
  },
  admin: {
    '/admin': { mode: 'scale', duration: 0.3 },
    '/admin/*': { mode: 'scale', duration: 0.3 },
  },
  recipes: {
    '/recipes': { mode: 'slide', duration: 0.4 },
    '/recipes/:id': { mode: 'slide', duration: 0.4 },
    '/recipes/new': { mode: 'scale', duration: 0.3 },
    '/recipes/:id/edit': { mode: 'scale', duration: 0.3 },
  },
  trips: {
    '/trips': { mode: 'slide', duration: 0.4 },
    '/trips/:id': { mode: 'slide', duration: 0.4 },
    '/trips/new': { mode: 'scale', duration: 0.3 },
    '/trips/:id/edit': { mode: 'scale', duration: 0.3 },
  },
  auth: {
    '/login': { mode: 'fade', duration: 0.3, preserveScroll: false },
    '/register': { mode: 'fade', duration: 0.3, preserveScroll: false },
    '/forgot-password': { mode: 'fade', duration: 0.3, preserveScroll: false },
    '/reset-password': { mode: 'fade', duration: 0.3, preserveScroll: false },
  },
  profile: {
    '/profile': { mode: 'slide', duration: 0.3 },
    '/profile/*': { mode: 'slide', duration: 0.3 },
    '/settings': { mode: 'slide', duration: 0.3 },
    '/settings/*': { mode: 'slide', duration: 0.3 },
  },
  modal: {
    '/modal/*': { mode: 'zoom', duration: 0.25, preserveScroll: true },
  },
  vertical: {
    '/blog': { mode: 'slideUp', duration: 0.4 },
    '/blog/*': { mode: 'slideUp', duration: 0.4 },
    '/news': { mode: 'slideDown', duration: 0.4 },
    '/news/*': { mode: 'slideDown', duration: 0.4 },
  },
};

// Helper to apply preset configurations
export const applyTransitionPreset = (
  preset: keyof typeof transitionPresets,
  provider: TransitionContextValue
) => {
  const configs = transitionPresets[preset];
  Object.entries(configs).forEach(([path, config]) => {
    provider.setRouteTransition(path, config);
  });
};

// Custom hook for managing transition settings
export const useTransitionSettings = () => {
  const { settings, updateSettings } = useTransitionProvider();

  const setEnabled = useCallback((enabled: boolean) => {
    updateSettings({ enabled });
  }, [updateSettings]);

  const setDefaultTransition = useCallback((mode: TransitionMode) => {
    updateSettings({ defaultTransition: mode });
  }, [updateSettings]);

  const setSpeedMultiplier = useCallback((multiplier: number) => {
    updateSettings({ speedMultiplier: Math.max(0.1, Math.min(10, multiplier)) });
  }, [updateSettings]);

  const setEnablePreload = useCallback((enable: boolean) => {
    updateSettings({ enablePreload: enable });
  }, [updateSettings]);

  const setPreserveScrollDefault = useCallback((preserve: boolean) => {
    updateSettings({ preserveScrollDefault: preserve });
  }, [updateSettings]);

  const setReducedMotion = useCallback((reduced: boolean) => {
    updateSettings({ reducedMotion: reduced });
  }, [updateSettings]);

  const setEnableSoundEffects = useCallback((enable: boolean) => {
    updateSettings({ enableSoundEffects: enable });
  }, [updateSettings]);

  const setTransitionQuality = useCallback((quality: 'low' | 'medium' | 'high') => {
    updateSettings({ transitionQuality: quality });
  }, [updateSettings]);

  const resetToDefaults = useCallback(() => {
    updateSettings(defaultSettings);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('transitionSettings');
    }
  }, [updateSettings]);

  return {
    settings,
    setEnabled,
    setDefaultTransition,
    setSpeedMultiplier,
    setEnablePreload,
    setPreserveScrollDefault,
    setReducedMotion,
    setEnableSoundEffects,
    setTransitionQuality,
    resetToDefaults,
  };
};