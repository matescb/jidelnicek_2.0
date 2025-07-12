import React from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { AuthProvider } from '@context/AuthContext'
import { useTheme } from '@hooks/useTheme'
import { BreadcrumbProvider } from '../navigation/breadcrumbs/BreadcrumbProvider'

export const RootLayout: React.FC = () => {
  const { theme } = useTheme()

  return (
    <AuthProvider>
      <BreadcrumbProvider>
        <div className={`min-h-screen bg-background text-foreground ${theme}`}>
          <ScrollRestoration />
          <Outlet />
        </div>
      </BreadcrumbProvider>
    </AuthProvider>
  )
}