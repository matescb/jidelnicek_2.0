# Enhanced Theme System Documentation

## Overview

The enhanced theme system now includes automatic system preference detection, smooth theme transitions, and a flexible mode system that allows users to either follow their OS theme preference or manually select a theme.

## Key Features

### 1. System Preference Detection
- Automatically detects the user's OS theme preference (light/dark)
- Responds to system theme changes in real-time
- Provides a "system" mode that follows OS preferences

### 2. Theme Modes
- **System Mode**: Automatically follows OS preference
- **Manual Mode**: User explicitly selects light, dark, or custom themes
- **Hybrid Approach**: Can switch between system and manual modes

### 3. Smooth Transitions
- Respects user's motion preferences
- Smooth color transitions when switching themes
- No jarring visual changes

### 4. Backwards Compatibility
- Existing theme functionality remains unchanged
- New features are additive, not breaking
- localStorage persistence maintained

## Usage

### Basic Usage

```tsx
import { useTheme } from '../hooks/useTheme'

function MyComponent() {
  const { theme, toggleTheme, setThemeMode } = useTheme()

  return (
    <div>
      <p>Current theme: {theme}</p>
      
      {/* Quick toggle */}
      <button onClick={toggleTheme}>Toggle Theme</button>
      
      {/* Use system preference */}
      <button onClick={() => setThemeMode('system')}>
        Follow System
      </button>
    </div>
  )
}
```

### Advanced Usage

```tsx
import { useTheme } from '../hooks/useTheme'

function ThemeSettings() {
  const {
    theme,
    themeMode,
    setThemeMode,
    systemTheme,
    isSystemMode,
    prefersReducedMotion,
    availableThemes
  } = useTheme()

  return (
    <div>
      {/* Theme mode selector */}
      <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
        <option value="system">System ({systemTheme})</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        {availableThemes
          .filter(t => t !== 'light' && t !== 'dark')
          .map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
      </select>

      {/* Status display */}
      {isSystemMode && (
        <p>Following system preference: {systemTheme}</p>
      )}
      
      {/* Motion preference info */}
      {prefersReducedMotion && (
        <p>Animations reduced for accessibility</p>
      )}
    </div>
  )
}
```

### System Theme Hook

```tsx
import { useSystemThemePreference } from '../hooks/useSystemThemePreference'

function SystemInfo() {
  const { systemTheme, isSystemDark } = useSystemThemePreference()

  return (
    <div>
      <p>System prefers: {systemTheme}</p>
      <p>Is dark mode: {isSystemDark ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

## API Reference

### ThemeContext Properties

| Property | Type | Description |
|----------|------|-------------|
| `theme` | `string` | Current active theme |
| `themeMode` | `'system' \| 'light' \| 'dark' \| string` | Current theme mode |
| `themeConfig` | `ThemeConfig` | Configuration for current theme |
| `systemTheme` | `'light' \| 'dark'` | OS theme preference |
| `isSystemMode` | `boolean` | Whether following system preference |
| `prefersReducedMotion` | `boolean` | User's motion preference |
| `availableThemes` | `string[]` | List of registered themes |

### ThemeContext Methods

| Method | Description |
|--------|-------------|
| `toggleTheme()` | Toggle between themes (exits system mode if active) |
| `setTheme(theme)` | Set specific theme (exits system mode) |
| `setThemeMode(mode)` | Set theme mode (system/light/dark/etc) |
| `registerCustomTheme(name, config)` | Register a custom theme |

### Hooks

#### `useTheme()`
Main hook for accessing theme context. Must be used within ThemeProvider.

#### `useSystemThemePreference()`
Standalone hook for detecting system theme preference.

Returns:
- `systemTheme`: 'light' | 'dark'
- `isSystemDark`: boolean
- `mediaQuery`: MediaQueryList | null

#### `usePrefersReducedMotion()`
Hook for detecting reduced motion preference.

Returns: `boolean`

## Theme Modes Explained

### System Mode
- Automatically follows OS theme preference
- Updates when user changes OS theme
- Default mode for new users
- Stored as `themeMode: 'system'` in localStorage

### Manual Mode
- User explicitly selects a theme
- Ignores OS preference changes
- Activated by calling `setTheme()` or selecting non-system mode
- Stored as `themeMode: '<theme-name>'` in localStorage

### Mode Transitions
- System → Manual: When user calls `setTheme()` or toggles theme
- Manual → System: When user calls `setThemeMode('system')`
- Smooth transitions with motion preference support

## localStorage Schema

```javascript
{
  "themeMode": "system" | "light" | "dark" | "<custom-theme>",
  "theme": "light" | "dark" | "<custom-theme>" // Only saved in manual mode
}
```

## Browser Compatibility

- Modern browsers with `matchMedia` support
- Fallback for older browsers using `addListener`/`removeListener`
- SSR-safe (checks for window object)

## Best Practices

1. **Default to System Mode**: Let users' OS preference be the default
2. **Provide Clear UI**: Show current mode and active theme
3. **Respect Motion Preferences**: Use `prefersReducedMotion` for animations
4. **Test All Modes**: Test system mode, manual mode, and transitions
5. **Handle Edge Cases**: System preference changes, localStorage clearing, etc.

## Migration Guide

For existing implementations:

1. No breaking changes - existing code continues to work
2. To add system mode support:
   ```tsx
   // Old
   <button onClick={toggleTheme}>Toggle</button>
   
   // New (with system mode option)
   <button onClick={() => setThemeMode('system')}>Auto</button>
   <button onClick={toggleTheme}>Toggle</button>
   ```

3. Update theme selectors to show system option:
   ```tsx
   <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
     <option value="system">System</option>
     <option value="light">Light</option>
     <option value="dark">Dark</option>
   </select>
   ```

## Testing

The enhanced theme system includes comprehensive tests for:
- System preference detection
- Mode transitions
- localStorage persistence
- Theme toggling
- Custom theme registration
- Reduced motion support

Run tests with: `npm test ThemeContext.test.tsx`