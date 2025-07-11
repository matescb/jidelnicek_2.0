/**
 * Theme initialization script
 * This should be inlined in the <head> to prevent flash of incorrect theme
 * 
 * Usage in Next.js _document.tsx or similar:
 * <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 */

(function() {
  // Get theme from localStorage or default to system
  function getTheme() {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      if (stored === 'system' || !stored) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (e) {
      // Handle localStorage errors
    }
    return 'light';
  }

  // Apply theme immediately
  const theme = getTheme();
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
  
  // Add theme-transitioning class to prevent initial transition
  document.documentElement.classList.add('theme-transitioning');
  
  // Remove transitioning class after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          document.documentElement.classList.remove('theme-transitioning');
        });
      });
    });
  } else {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        document.documentElement.classList.remove('theme-transitioning');
      });
    });
  }
})();

// Export for build tools
if (typeof module !== 'undefined' && module.exports) {
  module.exports = '(' + arguments.callee.toString() + ')();';
}