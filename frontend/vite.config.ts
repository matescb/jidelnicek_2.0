import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import { VitePWA } from 'vite-plugin-pwa'
import { consoleLogPlugin } from './vite-console-plugin.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    
    // Console logging to terminal (development only)
    ...(mode === 'development' ? [consoleLogPlugin()] : []),
    
    // Bundle visualization
    visualizer({
      filename: './dist/stats.html',
      open: process.env.ANALYZE === 'true',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // 'sunburst' | 'treemap' | 'network'
    }),
    
    // Gzip compression
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    
    // Brotli compression
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    
    // PWA support for better caching
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Jidelnicek App',
        short_name: 'Jidelnicek',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@context': path.resolve(__dirname, './src/context'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
      '@router': path.resolve(__dirname, './src/router'),
    },
  },
  server: {
    port: 3000,
    host: true, // Listen on all addresses
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_BASE_URL || 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Optimize chunk size
    chunkSizeWarningLimit: 500, // Warn for chunks larger than 500kb
    
    // Target modern browsers for smaller bundles
    target: 'es2020',
    
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : [],
      },
    },
    
    rollupOptions: {
      output: {
        // Enhanced manual chunk strategy
        manualChunks: (id) => {
          // Node modules chunking
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            
            // UI libraries
            if (id.includes('@radix-ui') || id.includes('@headlessui')) {
              return 'ui-vendor'
            }
            
            // State management
            if (id.includes('zustand') || id.includes('immer')) {
              return 'state-vendor'
            }
            
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('zod')) {
              return 'form-vendor'
            }
            
            // Utility libraries
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('lodash')) {
              return 'utils-vendor'
            }
            
            // Icon libraries
            if (id.includes('react-icons') || id.includes('lucide-react') || id.includes('@heroicons')) {
              return 'icons-vendor'
            }
            
            // Animation libraries
            if (id.includes('framer-motion')) {
              return 'animation-vendor'
            }
            
            // Data fetching
            if (id.includes('@tanstack/react-query') || id.includes('axios')) {
              return 'data-vendor'
            }
            
            // i18n
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n-vendor'
            }
            
            // All other vendor chunks
            return 'vendor'
          }
          
          // Feature-based chunks for application code
          if (id.includes('src/components/auth') || id.includes('src/pages/auth')) {
            return 'auth'
          }
          if (id.includes('src/components/recipes') || id.includes('src/pages/recipes')) {
            return 'recipes'
          }
          if (id.includes('src/components/trips') || id.includes('src/pages/trips')) {
            return 'trips'
          }
          if (id.includes('src/components/admin') || id.includes('src/pages/admin')) {
            return 'admin'
          }
          if (id.includes('src/components/dashboard') || id.includes('src/pages/dashboard')) {
            return 'dashboard'
          }
        },
        
        // Optimize chunk names for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk'
          return `assets/js/${chunkInfo.name}-[hash].js`
        },
        
        // Asset file names
        assetFileNames: (assetInfo) => {
          const ext = path.extname(assetInfo.name)
          if (/\.(gif|jpe?g|png|svg|webp|avif)$/.test(ext)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/\.css$/.test(ext)) {
            return `assets/css/[name]-[hash][extname]`
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
        
        // Entry file names
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
      
      // External dependencies (if any)
      external: [],
    },
    
    // Enable source maps for better debugging
    sourcemap: mode === 'development' ? 'inline' : true,
    
    // Optimize assets
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Report compressed size
    reportCompressedSize: true,
    
    // Copy public dir
    copyPublicDir: true,
  },
  optimizeDeps: {
    // Pre-bundle heavy dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@tanstack/react-query',
      'zustand',
      'react-hook-form',
      'framer-motion',
      'date-fns',
    ],
    
    // Exclude from optimization
    exclude: [],
  },
  
  // Performance optimizations
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
  
  // Preview config
  preview: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  
  // Test configuration
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    deps: {
      optimizer: {
        web: {
          exclude: ['@testing-library/jest-dom'],
        },
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@context': path.resolve(__dirname, './src/context'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
      '@router': path.resolve(__dirname, './src/router'),
    },
    // Enhanced coverage reporting
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/**/*.stories.{js,jsx,ts,tsx}',
        'src/**/*.d.ts',
        'src/__tests__/utils/',
        'dist/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Specific thresholds for responsive and accessibility components
        'src/components/navigation/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'src/components/forms/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/hooks/responsive/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
    // Test timeout for slower responsive tests
    testTimeout: 10000,
    // Retry flaky tests
    retry: 2,
    // Reporter configuration
    reporters: [
      'default',
      ['junit', { outputFile: './coverage/junit.xml' }],
      ['json', { outputFile: './coverage/test-results.json' }],
    ],
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITE_API_URL: '/api/v1',
      VITE_USE_MOCK_AUTH: 'true',
    },
  },
}))