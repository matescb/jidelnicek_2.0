import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@components/navigation/Sidebar'
import { Header } from '@components/navigation/Header'
import { Breadcrumbs } from '@components/navigation/Breadcrumbs'
import { MobileNavigation } from '@components/navigation/MobileNavigation'

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      {/* Mobile Navigation */}
      <MobileNavigation 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        
        <main className="p-4 sm:p-6 lg:p-8">
          <Breadcrumbs />
          <div className="mt-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}