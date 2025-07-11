import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface NavigationState {
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  isSearchOpen: boolean;
  isMegaMenuOpen: boolean;
  activeSection: string | null;
  isScrolled: boolean;
  screenSize: 'mobile' | 'tablet' | 'desktop';
}

interface NavigationContextValue extends NavigationState {
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  toggleSearch: () => void;
  toggleMegaMenu: () => void;
  setActiveSection: (section: string | null) => void;
  closeMobileMenu: () => void;
  closeSearch: () => void;
  closeMegaMenu: () => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [state, setState] = useState<NavigationState>({
    isSidebarOpen: true,
    isMobileMenuOpen: false,
    isSearchOpen: false,
    isMegaMenuOpen: false,
    activeSection: null,
    isScrolled: false,
    screenSize: 'desktop',
  });

  // Detect screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let screenSize: 'mobile' | 'tablet' | 'desktop';
      
      if (width < 640) {
        screenSize = 'mobile';
      } else if (width < 1024) {
        screenSize = 'tablet';
      } else {
        screenSize = 'desktop';
      }

      setState(prev => ({
        ...prev,
        screenSize,
        // Auto-adjust sidebar based on screen size
        isSidebarOpen: screenSize === 'desktop' ? prev.isSidebarOpen : false,
      }));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      setState(prev => ({ ...prev, isScrolled: scrolled }));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on desktop
  useEffect(() => {
    if (state.screenSize === 'desktop' && state.isMobileMenuOpen) {
      setState(prev => ({ ...prev, isMobileMenuOpen: false }));
    }
  }, [state.screenSize, state.isMobileMenuOpen]);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isSidebarOpen: !prev.isSidebarOpen }));
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setState(prev => ({ ...prev, isMobileMenuOpen: !prev.isMobileMenuOpen }));
  }, []);

  const toggleSearch = useCallback(() => {
    setState(prev => ({ ...prev, isSearchOpen: !prev.isSearchOpen }));
  }, []);

  const toggleMegaMenu = useCallback(() => {
    setState(prev => ({ ...prev, isMegaMenuOpen: !prev.isMegaMenuOpen }));
  }, []);

  const setActiveSection = useCallback((section: string | null) => {
    setState(prev => ({ ...prev, activeSection: section }));
  }, []);

  const closeMobileMenu = useCallback(() => {
    setState(prev => ({ ...prev, isMobileMenuOpen: false }));
  }, []);

  const closeSearch = useCallback(() => {
    setState(prev => ({ ...prev, isSearchOpen: false }));
  }, []);

  const closeMegaMenu = useCallback(() => {
    setState(prev => ({ ...prev, isMegaMenuOpen: false }));
  }, []);

  const value: NavigationContextValue = {
    ...state,
    toggleSidebar,
    toggleMobileMenu,
    toggleSearch,
    toggleMegaMenu,
    setActiveSection,
    closeMobileMenu,
    closeSearch,
    closeMegaMenu,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

// Custom hooks for specific navigation features
export const useScreenSize = () => {
  const { screenSize } = useNavigation();
  return {
    screenSize,
    isMobile: screenSize === 'mobile',
    isTablet: screenSize === 'tablet',
    isDesktop: screenSize === 'desktop',
  };
};

export const useScrollState = () => {
  const { isScrolled } = useNavigation();
  return isScrolled;
};