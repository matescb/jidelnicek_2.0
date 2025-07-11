import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import {
  TransitionProvider,
  PageTransitions,
  ScrollRestoration,
  PreloadManager,
  PreloadLink,
  ResourceHints,
  ScrollToTopButton,
  usePageTransition,
  useTransitionSettings,
  usePreloadRoute,
  useGestureTransition,
  useTransitionPerformance,
  transitionPresets,
  applyTransitionPreset,
} from './index';

// Example 1: Basic setup with enhanced transitions
export const BasicTransitionExample = () => {
  return (
    <BrowserRouter>
      <TransitionProvider
        initialSettings={{
          defaultTransition: 'slide',
          speedMultiplier: 1.2,
          enablePreload: true,
        }}
        routeConfigs={{
          '/home': { mode: 'fade', duration: 0.3 },
          '/about': { mode: 'scale', duration: 0.4 },
          '/contact': { mode: 'flip', duration: 0.5 },
          '/gallery': { mode: 'zoom', duration: 0.3 },
          '/blog/*': { mode: 'slideUp', duration: 0.4 },
        }}
      >
        <PreloadManager 
          maxPreloads={5}
          enableNetworkAwarePreload={true}
          onPreloadSuccess={(path) => console.log(`Preloaded: ${path}`)}
          onPreloadError={(path, error) => console.error(`Failed to preload ${path}:`, error)}
        >
          <ScrollRestoration 
            smooth={true}
            delay={100}
            excludePaths={['/modal/*']}
          >
            <PageTransitions
              showProgress={true}
              preserveScroll={true}
              onTransitionStart={() => console.log('Transition started')}
              onTransitionComplete={() => console.log('Transition completed')}
              onTransitionEnd={() => console.log('Animation ended')}
              easing={[0.4, 0, 0.2, 1]}
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/blog/*" element={<BlogPage />} />
              </Routes>
            </PageTransitions>
            <ScrollToTopButton 
              threshold={200}
              position="right"
              smooth={true}
            />
          </ScrollRestoration>
        </PreloadManager>
      </TransitionProvider>
    </BrowserRouter>
  );
};

// Example 2: Navigation with preloading
const Navigation = () => {
  const { preloadRoute } = usePreloadRoute();
  
  // Preload critical routes on mount
  React.useEffect(() => {
    preloadRoute({ path: '/about', priority: 'high' });
    preloadRoute({ path: '/gallery', priority: 'medium' });
  }, [preloadRoute]);
  
  return (
    <nav>
      <PreloadLink to="/" priority="high">
        Home
      </PreloadLink>
      <PreloadLink 
        to="/about" 
        priority="high"
        preloadDelay={100}
      >
        About
      </PreloadLink>
      <PreloadLink 
        to="/gallery" 
        priority="medium"
        resources={['/images/gallery-hero.jpg']}
      >
        Gallery
      </PreloadLink>
      <PreloadLink 
        to="/blog" 
        priority="low"
        preloadOnFocus={true}
      >
        Blog
      </PreloadLink>
    </nav>
  );
};

// Example 3: Transition controls component
const TransitionControls = () => {
  const {
    settings,
    setEnabled,
    setDefaultTransition,
    setSpeedMultiplier,
    setReducedMotion,
    setTransitionQuality,
    resetToDefaults,
  } = useTransitionSettings();
  
  const {
    setTransitionMode,
    setTransitionSpeed,
    disableTransitions,
    enableTransitions,
  } = usePageTransition();
  
  return (
    <div className="transition-controls">
      <h3>Transition Settings</h3>
      
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable Transitions
      </label>
      
      <label>
        Default Transition:
        <select 
          value={settings.defaultTransition}
          onChange={(e) => setDefaultTransition(e.target.value as any)}
        >
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
          <option value="scale">Scale</option>
          <option value="flip">Flip</option>
          <option value="slideUp">Slide Up</option>
          <option value="slideDown">Slide Down</option>
          <option value="zoom">Zoom</option>
          <option value="rotate">Rotate</option>
        </select>
      </label>
      
      <label>
        Speed Multiplier:
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          value={settings.speedMultiplier}
          onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
        />
        {settings.speedMultiplier}x
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => setReducedMotion(e.target.checked)}
        />
        Reduced Motion
      </label>
      
      <label>
        Quality:
        <select 
          value={settings.transitionQuality}
          onChange={(e) => setTransitionQuality(e.target.value as any)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      
      <button onClick={resetToDefaults}>Reset to Defaults</button>
    </div>
  );
};

// Example 4: Gesture-based navigation
const GestureNavigationExample = () => {
  const { dragX, isDragging, dragProps } = useGestureTransition();
  
  return (
    <div
      {...dragProps}
      style={{
        transform: `translateX(${dragX}px)`,
        opacity: isDragging ? 0.8 : 1,
        transition: isDragging ? 'none' : 'all 0.3s ease-out',
      }}
    >
      <h2>Swipe to navigate</h2>
      <p>Drag left or right to navigate between pages</p>
    </div>
  );
};

// Example 5: Performance monitoring
const TransitionPerformanceMonitor = () => {
  const { metrics, startMonitoring, stopMonitoring } = useTransitionPerformance();
  const [isMonitoring, setIsMonitoring] = React.useState(false);
  
  const toggleMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
    setIsMonitoring(!isMonitoring);
  };
  
  return (
    <div className="performance-monitor">
      <button onClick={toggleMonitoring}>
        {isMonitoring ? 'Stop' : 'Start'} Monitoring
      </button>
      
      {isMonitoring && (
        <div>
          <p>FPS: {metrics.fps}</p>
          <p>Dropped Frames: {metrics.dropped}</p>
          <p>Duration: {metrics.duration.toFixed(2)}ms</p>
        </div>
      )}
    </div>
  );
};

// Example 6: Advanced route configuration with presets
export const AdvancedTransitionSetup = () => {
  const providerRef = React.useRef<any>(null);
  
  React.useEffect(() => {
    if (providerRef.current) {
      // Apply multiple presets
      applyTransitionPreset('dashboard', providerRef.current);
      applyTransitionPreset('auth', providerRef.current);
      applyTransitionPreset('modal', providerRef.current);
    }
  }, []);
  
  return (
    <TransitionProvider ref={providerRef}>
      <ResourceHints
        prefetch={[
          '/api/data/preload',
          '/static/fonts/main.woff2',
        ]}
        preconnect={[
          'https://api.example.com',
          'https://cdn.example.com',
        ]}
        dns={[
          'https://analytics.example.com',
        ]}
      />
      {/* Rest of your app */}
    </TransitionProvider>
  );
};

// Example 7: Custom transition with callbacks
const CustomTransitionExample = () => {
  const [transitionData, setTransitionData] = React.useState<any>(null);
  
  return (
    <PageTransitions
      mode="slide"
      customTransition={{
        initial: { 
          x: '100%', 
          opacity: 0,
          scale: 0.8,
          rotateY: 45,
        },
        animate: { 
          x: 0, 
          opacity: 1,
          scale: 1,
          rotateY: 0,
        },
        exit: { 
          x: '-100%', 
          opacity: 0,
          scale: 1.2,
          rotateY: -45,
        },
      }}
      duration={0.6}
      stagger={0.1}
      onTransitionStart={() => {
        setTransitionData({ startTime: Date.now() });
      }}
      onTransitionComplete={() => {
        const duration = Date.now() - transitionData?.startTime || 0;
        console.log(`Transition took ${duration}ms`);
      }}
    >
      {/* Page content */}
    </PageTransitions>
  );
};

// Example pages
const HomePage = () => <div><h1>Home Page</h1></div>;
const AboutPage = () => <div><h1>About Page</h1></div>;
const ContactPage = () => <div><h1>Contact Page</h1></div>;
const GalleryPage = () => <div><h1>Gallery Page</h1></div>;
const BlogPage = () => <div><h1>Blog Page</h1></div>;

export default {
  BasicTransitionExample,
  Navigation,
  TransitionControls,
  GestureNavigationExample,
  TransitionPerformanceMonitor,
  AdvancedTransitionSetup,
  CustomTransitionExample,
};