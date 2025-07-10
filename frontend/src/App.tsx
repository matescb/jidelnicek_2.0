import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@context/AuthContext'
import { ThemeProvider } from '@context/ThemeContext'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { router } from '@/router'
import { LoadingScreen } from '@components/common/LoadingScreen'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <ToastProvider>
            <Suspense fallback={<LoadingScreen />}>
              <RouterProvider router={router} />
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

export default App