/**
 * React hook for theme management
 */

import React, { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import {
  ThemeMode,
  applyTheme,
  getThemePreference,
  getResolvedTheme,
  toggleTheme as toggleThemeUtil,
  initializeTheme
} from '../utils/theme';

interface UseThemeReturn {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isSystemTheme: boolean;
}

export function useTheme(): UseThemeReturn {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemePreference());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getResolvedTheme(themeMode));

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme(false);
  }, []);

  // Update theme when mode changes
  useEffect(() => {
    const resolved = getResolvedTheme(themeMode);
    setTheme(resolved);
    applyTheme(resolved, true);

    // Handle system theme changes
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        applyTheme(newTheme, true);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('theme', mode);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = toggleThemeUtil();
    setTheme(newTheme);
    setThemeModeState(newTheme);
  }, []);

  return {
    theme,
    themeMode,
    setThemeMode,
    toggleTheme,
    isSystemTheme: themeMode === 'system'
  };
}

// Optional: Theme context provider
import { createContext, useContext, ReactNode } from 'react';

const ThemeContext = createContext<UseThemeReturn | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeValue = useTheme();
  
  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}