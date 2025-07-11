import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { NavigationProvider, ResponsiveNavigation } from './ResponsiveNav';
import { megaMenuConfig } from './MegaMenu';

// Example: Basic Responsive Navigation Setup
export const BasicResponsiveNavExample = () => {
  return (
    <BrowserRouter>
      <NavigationProvider>
        <ResponsiveNavigation>
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Responsive Navigation Example</h1>
            <p className="text-gray-600 dark:text-gray-400">
              This example demonstrates the responsive navigation system that automatically
              adapts to different screen sizes:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Desktop: Full sidebar with collapsible sections</li>
              <li>• Tablet: Mini sidebar with icon navigation</li>
              <li>• Mobile: Bottom navigation bar with hamburger menu</li>
            </ul>
          </div>
        </ResponsiveNavigation>
      </NavigationProvider>
    </BrowserRouter>
  );
};

// Example: Using Navigation Hooks
import { useNavigation, useScreenSize, useScrollState } from './NavigationContext';

export const NavigationHooksExample = () => {
  const navigation = useNavigation();
  const { screenSize, isMobile, isTablet, isDesktop } = useScreenSize();
  const isScrolled = useScrollState();

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Navigation State</h2>
      
      <div className="space-y-2">
        <p>Screen Size: <span className="font-mono">{screenSize}</span></p>
        <p>Is Mobile: <span className="font-mono">{isMobile ? 'true' : 'false'}</span></p>
        <p>Is Tablet: <span className="font-mono">{isTablet ? 'true' : 'false'}</span></p>
        <p>Is Desktop: <span className="font-mono">{isDesktop ? 'true' : 'false'}</span></p>
        <p>Is Scrolled: <span className="font-mono">{isScrolled ? 'true' : 'false'}</span></p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Navigation States:</h3>
        <p>Sidebar Open: <span className="font-mono">{navigation.isSidebarOpen ? 'true' : 'false'}</span></p>
        <p>Mobile Menu Open: <span className="font-mono">{navigation.isMobileMenuOpen ? 'true' : 'false'}</span></p>
        <p>Search Open: <span className="font-mono">{navigation.isSearchOpen ? 'true' : 'false'}</span></p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={navigation.toggleSidebar}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Toggle Sidebar
        </button>
        <button
          onClick={navigation.toggleSearch}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Toggle Search
        </button>
      </div>
    </div>
  );
};

// Example: Mega Menu Configuration
export const MegaMenuExample = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Mega Menu Configuration</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        The mega menu provides rich dropdown navigation with multiple columns,
        featured content, and image previews.
      </p>
      
      <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto text-sm">
        <code>{JSON.stringify(megaMenuConfig, null, 2)}</code>
      </pre>
    </div>
  );
};

// Example: Mobile Bottom Navigation
export const MobileBottomNavExample = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Mobile Bottom Navigation</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        The mobile bottom navigation provides quick access to main sections
        with the following features:
      </p>
      
      <ul className="space-y-2 text-sm">
        <li>• Fixed position at bottom of screen</li>
        <li>• Active route indicator with animation</li>
        <li>• Touch-optimized tap targets</li>
        <li>• Optional notification badges</li>
        <li>• Swipe gesture support (optional)</li>
        <li>• Safe area support for devices with notches</li>
      </ul>

      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Note: The bottom navigation is only visible on mobile devices.
          Resize your browser window to see it in action.
        </p>
      </div>
    </div>
  );
};

// Example: Search Modal Features
export const SearchModalExample = () => {
  const { toggleSearch } = useNavigation();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Search Modal</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        The search modal provides a powerful search experience with:
      </p>
      
      <ul className="space-y-2 text-sm mb-6">
        <li>• Full-screen mode on mobile devices</li>
        <li>• Modal overlay on desktop</li>
        <li>• Recent search history</li>
        <li>• Trending searches</li>
        <li>• Voice search support (where available)</li>
        <li>• Keyboard navigation (↑↓ to navigate, Enter to select)</li>
        <li>• Keyboard shortcut (Cmd/Ctrl + K)</li>
      </ul>

      <button
        onClick={toggleSearch}
        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
      >
        <span>Open Search</span>
        <kbd className="px-2 py-1 bg-primary-700 rounded text-xs">⌘K</kbd>
      </button>
    </div>
  );
};

// Example: Responsive Breakpoints
export const ResponsiveBreakpointsExample = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Responsive Breakpoints</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        The navigation system uses the following breakpoints:
      </p>
      
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h3 className="font-semibold text-sm mb-2">Mobile: &lt; 640px</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Bottom navigation bar</li>
            <li>• Full-screen mobile menu</li>
            <li>• Full-screen search</li>
            <li>• Swipe gestures enabled</li>
          </ul>
        </div>

        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h3 className="font-semibold text-sm mb-2">Tablet: 640px - 1024px</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Mini sidebar (icons only)</li>
            <li>• Hover tooltips for navigation</li>
            <li>• Modal search</li>
            <li>• No bottom navigation</li>
          </ul>
        </div>

        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h3 className="font-semibold text-sm mb-2">Desktop: &gt; 1024px</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Full sidebar with labels</li>
            <li>• Collapsible sections</li>
            <li>• Mega menu dropdowns</li>
            <li>• Resizable sidebar (drag edge)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Export all examples
export default {
  BasicResponsiveNavExample,
  NavigationHooksExample,
  MegaMenuExample,
  MobileBottomNavExample,
  SearchModalExample,
  ResponsiveBreakpointsExample,
};