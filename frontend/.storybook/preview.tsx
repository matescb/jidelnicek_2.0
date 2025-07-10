import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Dark mode decorator
const withDarkMode = (Story, context) => {
  const isDark = context.globals.darkMode === true;
  
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);
  
  return <Story />;
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
    withDarkMode,
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Story />
            <Toaster position="top-right" />
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    ),
  ],
  globalTypes: {
    darkMode: {
      name: 'Dark mode',
      description: 'Global dark mode for components',
      defaultValue: false,
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: false, icon: 'sun', title: 'Light' },
          { value: true, icon: 'moon', title: 'Dark' },
        ],
        showName: true,
      },
    },
  },
};

export default preview;