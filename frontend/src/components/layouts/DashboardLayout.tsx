import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar, Sidebar, MobileMenu, Breadcrumbs } from '../navigation';
import { BreadcrumbProvider } from '../navigation/breadcrumbs/BreadcrumbProvider';
import { cn } from '../../lib/utils';

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Desktop Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        {/* Mobile Navigation Menu */}
        <MobileMenu 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        
        {/* Main Content Area */}
        <div className={cn(
          'transition-all duration-300',
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}>
          {/* Top Navigation Bar */}
          <Navbar 
            onMenuToggle={() => setIsMobileMenuOpen(true)}
            isMobileMenuOpen={isMobileMenuOpen}
          />
          
          <main className="p-4 sm:p-6 lg:p-8">
            <Breadcrumbs />
            <div className="mt-4">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
};