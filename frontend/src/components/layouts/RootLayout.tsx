import React from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { AuthProvider } from '@context/AuthContext'
import { useTheme } from '@hooks/useTheme'

export const RootLayout: React.FC = () => {
  const { theme } = useTheme()

  return (
    <AuthProvider>
      <div className={`min-h-screen bg-background text-foreground ${theme}`}>
        <ScrollRestoration />
        <Outlet />
      </div>
    </AuthProvider>
  )
}