import React from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { useTheme } from '@hooks/useTheme'

export const RootLayout: React.FC = () => {
  const { theme } = useTheme()

  return (
    <div className={`min-h-screen bg-background text-foreground ${theme}`}>
      <ScrollRestoration />
      <Outlet />
    </div>
  )
}