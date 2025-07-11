import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../src/context/ThemeContext';
import { useTheme } from '../src/hooks/useTheme';
import { withThemeComparison } from './decorators/withThemeComparison';
import { syncThemeWithStorybook, getStoredTheme } from './utils/themeUtils';
import '../src/styles/globals.css';
import './styles/storybook.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Theme wrapper component that responds to Storybook globals
const ThemeWrapper = ({ children, theme }: { children: React.ReactNode; theme: string }) => {
  const { setTheme, setThemeMode } = useTheme();
  
  useEffect(() => {
    // Handle theme changes from Storybook toolbar
    if (theme === 'system') {
      setThemeMode('system');
    } else {
      setThemeMode(theme as 'light' | 'dark');
      setTheme(theme);
    }
    
    // Sync theme with utilities for persistence
    syncThemeWithStorybook(theme);
  }, [theme, setTheme, setThemeMode]);
  
  return <>{children}</>;
};

// Theme decorator that wraps stories with ThemeProvider
const withTheme = (Story, context) => {
  const theme = context.globals.theme || 'light';
  
  return (
    <ThemeProvider>
      <ThemeWrapper theme={theme}>
        <Story />
      </ThemeWrapper>
    </ThemeProvider>
  );
};

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1a1a1a',
        },
        {
          name: 'gray',
          value: '#f5f5f5',
        },
      ],
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    docs: {
      toc: true,
    },
  },
  decorators: [
    // Theme comparison decorator must be last to wrap everything
    withThemeComparison,
    // Theme provider decorator
    withTheme,
    // Base providers and layout
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Story />
            <Toaster 
              position="top-right" 
              toastOptions={{
                className: '',
                style: {
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                },
              }}
            />
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    ),
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Theme switching for components',
      defaultValue: getStoredTheme(),
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', icon: 'sun', title: 'Light Theme' },
          { value: 'dark', icon: 'moon', title: 'Dark Theme' },
          { value: 'system', icon: 'browser', title: 'System Theme' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    themeComparison: {
      name: 'Theme Comparison',
      description: 'Show components side-by-side in both themes',
      defaultValue: false,
      toolbar: {
        icon: 'sidebyside',
        items: [
          { value: false, title: 'Single Theme' },
          { value: true, title: 'Compare Themes' },
        ],
        showName: true,
      },
    },
  },
};

export default preview;