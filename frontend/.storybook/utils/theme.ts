import { themes } from '../../src/config/theme';

/**
 * Get available theme options for Storybook
 */
export const getThemeOptions = () => {
  const themeNames = Object.keys(themes);
  const options = themeNames.map(name => ({
    value: name,
    title: name.charAt(0).toUpperCase() + name.slice(1) + ' Theme',
    icon: name === 'light' ? 'sun' : name === 'dark' ? 'moon' : 'paintbrush',
  }));
  
  // Add system option
  options.push({
    value: 'system',
    title: 'System Theme',
    icon: 'browser',
  });
  
  return options;
};

/**
 * Apply theme CSS variables to a specific element
 */
export const applyThemeToElement = (element: HTMLElement, themeName: string) => {
  const theme = themes[themeName] || themes.light;
  
  // Apply CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        element.style.setProperty(`--color-${key}-${subKey}`, subValue as string);
      });
    } else {
      element.style.setProperty(`--color-${key}`, value as string);
    }
  });
  
  // Apply semantic colors
  Object.entries(theme.semanticColors).forEach(([key, value]) => {
    element.style.setProperty(`--${key}`, value);
  });
  
  // Apply spacing, radii, etc.
  Object.entries(theme.spacing).forEach(([key, value]) => {
    element.style.setProperty(`--spacing-${key}`, value);
  });
  
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    element.style.setProperty(`--radius-${key}`, value);
  });
};