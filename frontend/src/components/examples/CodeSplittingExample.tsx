import React, { useState, Suspense } from 'react'
import { lazyLoad } from '@utils/lazyLoad'
import { PreloadLink, usePreloadNavigate } from '@hooks/useRoutePreloader'
import { Button } from '@components/ui/button'

// Example of lazy loading a heavy component
const HeavyChartComponent = lazyLoad(
  () => import('@components/charts/HeavyChart'), // Assuming this exists
  'HeavyChartComponent',
  {
    onLoadStart: () => console.log('Loading chart...'),
    onLoadSuccess: () => console.log('Chart loaded!'),
    onLoadError: (name, error, retryCount) => {
      console.error(`Failed to load ${name} (attempt ${retryCount + 1}):`, error)
    }
  }
)

// Loading skeleton for the chart
const ChartSkeleton = () => (
  <div className="w-full h-64 animate-pulse">
    <div className="bg-gray-200 dark:bg-gray-700 rounded h-full"></div>
  </div>
)

// Example component demonstrating various code splitting patterns
export function CodeSplittingExample() {
  const [showChart, setShowChart] = useState(false)
  const preloadNavigate = usePreloadNavigate()

  // Preload chart on button hover
  const handleMouseEnter = () => {
    if ('preload' in HeavyChartComponent) {
      (HeavyChartComponent as any).preload()
    }
  }

  // Navigate with preloading
  const handleNavigate = () => {
    preloadNavigate('/dashboard/recipes')
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Code Splitting Example</h2>
      
      {/* Example 1: Lazy load on demand */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">1. Load on Demand</h3>
        <Button
          onClick={() => setShowChart(!showChart)}
          onMouseEnter={handleMouseEnter}
        >
          {showChart ? 'Hide' : 'Show'} Heavy Chart
        </Button>
        
        {showChart && (
          <Suspense fallback={<ChartSkeleton />}>
            <HeavyChartComponent />
          </Suspense>
        )}
      </section>

      {/* Example 2: Preload on hover */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">2. Preload on Hover</h3>
        <div className="flex gap-4">
          <PreloadLink 
            to="/dashboard/recipes" 
            className="text-blue-600 hover:underline"
          >
            Recipes (preloads on hover)
          </PreloadLink>
          
          <PreloadLink 
            to="/dashboard/trips" 
            preloadOn="visible"
            className="text-blue-600 hover:underline"
          >
            Trips (preloads when visible)
          </PreloadLink>
        </div>
      </section>

      {/* Example 3: Programmatic navigation with preloading */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">3. Navigate with Preloading</h3>
        <Button onClick={handleNavigate}>
          Go to Recipes (with preload)
        </Button>
      </section>

      {/* Example 4: Conditional loading */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">4. Conditional Loading</h3>
        <ConditionalLoadingExample />
      </section>
    </div>
  )
}

// Example of conditional loading based on user interaction or state
function ConditionalLoadingExample() {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'settings'>('overview')

  // Lazy load tab content
  const TabContent = {
    overview: lazyLoad(() => import('./tabs/OverviewTab'), 'OverviewTab'),
    details: lazyLoad(() => import('./tabs/DetailsTab'), 'DetailsTab'),
    settings: lazyLoad(() => import('./tabs/SettingsTab'), 'SettingsTab'),
  }

  const ActiveTabComponent = TabContent[activeTab]

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {Object.keys(TabContent).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            onMouseEnter={() => {
              // Preload on hover
              const Component = TabContent[tab as keyof typeof TabContent]
              if ('preload' in Component) {
                (Component as any).preload()
              }
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>
      
      <Suspense fallback={<TabSkeleton />}>
        <ActiveTabComponent />
      </Suspense>
    </div>
  )
}

// Loading skeleton for tabs
const TabSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
  </div>
)

// Mock tab components (these would normally be in separate files)
const mockTabComponent = (name: string) => () => (
  <div className="p-4 border rounded">
    <h4 className="font-semibold">{name} Tab Content</h4>
    <p className="text-gray-600">This is the {name.toLowerCase()} tab content.</p>
  </div>
)

// Export mock components for the example
export const OverviewTab = mockTabComponent('Overview')
export const DetailsTab = mockTabComponent('Details')
export const SettingsTab = mockTabComponent('Settings')