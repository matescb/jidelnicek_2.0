import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigation, useScreenSize } from './NavigationContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileMenu } from './MobileMenu';
import { MobileBottomNav } from './MobileBottomNav';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import { SearchModal } from './SearchModal';
import { cn } from '../../lib/utils';

interface ResponsiveNavProps {
  children: React.ReactNode;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({ children }) => {
  const location = useLocation();
  const navigation = useNavigation();
  const { isMobile, isTablet, isDesktop } = useScreenSize();

  // Close mobile menu on route change
  useEffect(() => {
    navigation.closeMobileMenu();
    navigation.closeMegaMenu();
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (navigation.isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [navigation.isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Desktop Sidebar */}
      {isDesktop && (
        <CollapsibleSidebar
          isOpen={navigation.isSidebarOpen}
          onToggle={navigation.toggleSidebar}
        />
      )}

      {/* Tablet Sidebar (mini mode) */}
      {isTablet && (
        <CollapsibleSidebar
          isOpen={navigation.isSidebarOpen}
          onToggle={navigation.toggleSidebar}
          miniMode
        />
      )}

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobile && navigation.isMobileMenuOpen && (
          <MobileMenu
            isOpen={navigation.isMobileMenuOpen}
            onClose={navigation.closeMobileMenu}
          />
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {navigation.isSearchOpen && (
          <SearchModal
            isOpen={navigation.isSearchOpen}
            onClose={navigation.closeSearch}
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main
        className={cn(
          'transition-all duration-300',
          'pt-16', // Account for fixed navbar
          isDesktop && navigation.isSidebarOpen && 'lg:ml-64',
          isDesktop && !navigation.isSidebarOpen && 'lg:ml-20',
          isTablet && 'md:ml-20',
          isMobile && 'pb-16' // Account for bottom nav
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};

// Wrapper component that includes the provider
export const ResponsiveNavigation: React.FC<ResponsiveNavProps> = ({ children }) => {
  return (
    <ResponsiveNav>{children}</ResponsiveNav>
  );
};