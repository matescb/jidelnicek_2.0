/**
 * Theme utility functions for smooth theme switching
 */

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Apply theme to the document and manage transition class
 * @param theme - The theme to apply
 * @param enableTransition - Whether to enable smooth transition
 */
export function applyTheme(theme: 'light' | 'dark', enableTransition = true) {
  const root = document.documentElement;
  
  // Add transitioning class to disable transitions temporarily
  if (!enableTransition) {
    root.classList.add('theme-transitioning');
  }
  
  // Apply theme
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Remove transitioning class after a small delay
  if (!enableTransition) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-transitioning');
      });
    });
  }
  
  // Store theme preference
  localStorage.setItem('theme', theme);
}

/**
 * Get the current theme preference
 * @returns The current theme mode
 */
export function getThemePreference(): ThemeMode {
  const stored = localStorage.getItem('theme') as ThemeMode | null;
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored;
  }
  return 'system';
}

/**
 * Get the resolved theme (considering system preference)
 * @param preference - The theme preference
 * @returns The resolved theme
 */
export function getResolvedTheme(preference: ThemeMode): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Initialize theme on app load
 * @param enableTransition - Whether to enable transition on initial load
 */
export function initializeTheme(enableTransition = false) {
  const preference = getThemePreference();
  const resolved = getResolvedTheme(preference);
  applyTheme(resolved, enableTransition);
  
  // Listen for system theme changes if preference is 'system'
  if (preference === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      applyTheme(e.matches ? 'dark' : 'light', true);
    });
  }
}

/**
 * Toggle between light and dark themes
 * @returns The new theme
 */
export function toggleTheme(): 'light' | 'dark' {
  const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme, true);
  return newTheme;
}

/**
 * Check if a color meets WCAG contrast requirements
 * @param foreground - Foreground color in hex format
 * @param background - Background color in hex format
 * @param level - WCAG level ('AA' or 'AAA')
 * @returns Whether the contrast ratio meets the specified level
 */
export function checkContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Get CSS variable value
 * @param varName - CSS variable name (with or without --)
 * @returns The computed value of the CSS variable
 */
export function getCSSVar(varName: string): string {
  if (!varName.startsWith('--')) {
    varName = `--${varName}`;
  }
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/**
 * Set CSS variable value
 * @param varName - CSS variable name (with or without --)
 * @param value - The value to set
 */
export function setCSSVar(varName: string, value: string): void {
  if (!varName.startsWith('--')) {
    varName = `--${varName}`;
  }
  document.documentElement.style.setProperty(varName, value);
}