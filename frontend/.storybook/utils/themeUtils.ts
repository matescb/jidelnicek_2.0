/**
 * Storybook theme utilities for persistent theme selection
 */

const STORYBOOK_THEME_KEY = 'storybook-theme-preference';

export const getStoredTheme = (): string => {
  try {
    return localStorage.getItem(STORYBOOK_THEME_KEY) || 'light';
  } catch {
    return 'light';
  }
};

export const setStoredTheme = (theme: string): void => {
  try {
    localStorage.setItem(STORYBOOK_THEME_KEY, theme);
  } catch {
    // Fail silently if localStorage is not available
  }
};

export const syncThemeWithStorybook = (theme: string): void => {
  const root = document.documentElement;
  
  // Remove all theme classes
  root.classList.remove('light', 'dark', 'system');
  
  // Add the current theme class
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'dark' : 'light');
  } else {
    root.classList.add(theme);
  }
  
  // Store the preference
  setStoredTheme(theme);
};

export const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};