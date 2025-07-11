import React from 'react'
import { 
  LanguageSwitcher, 
  LanguageSwitcherCompact,
  LanguageSwitcherDesktop
} from './LanguageSwitcher'
import {
  LanguageSwitcherMobile,
  LanguageSwitcherBottomSheet,
  LanguageSwitcherFullScreen
} from './LanguageSwitcherMobile'
import { Globe, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LanguageSwitcherExamples() {
  const [showFullScreen, setShowFullScreen] = React.useState(false)
  
  const handleLanguageChange = (lang: string) => {
    console.log('Language changed to:', lang)
  }
  
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Language Switcher Components</h1>
        <p className="text-muted-foreground">
          Comprehensive language switching components with multiple display modes and mobile variants.
        </p>
      </div>
      
      {/* Desktop Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Desktop Variants</CardTitle>
          <CardDescription>Different display modes for desktop interfaces</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dropdown Mode */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Dropdown Mode (Default)</h3>
            <div className="flex items-center gap-4">
              <LanguageSwitcher mode="dropdown" size="sm" />
              <LanguageSwitcher mode="dropdown" size="default" />
              <LanguageSwitcher mode="dropdown" size="lg" />
              <LanguageSwitcher mode="dropdown" variant="ghost" />
              <LanguageSwitcher mode="dropdown" showName={false} />
            </div>
          </div>
          
          {/* Select Mode */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Select Mode (Native-like)</h3>
            <div className="flex items-center gap-4">
              <LanguageSwitcher mode="select" />
              <div className="w-48">
                <LanguageSwitcher mode="select" className="w-full" />
              </div>
            </div>
          </div>
          
          {/* Inline Button Mode */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Inline Button Mode</h3>
            <div className="space-y-3">
              <LanguageSwitcher mode="inline" size="sm" />
              <LanguageSwitcher mode="inline" size="default" />
              <LanguageSwitcher mode="inline" showFlag={false} />
            </div>
          </div>
          
          {/* Icon Only Mode */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Icon Only Mode</h3>
            <div className="flex items-center gap-4">
              <LanguageSwitcher mode="icon-only" />
              <LanguageSwitcher mode="icon-only" variant="ghost" />
              <LanguageSwitcher mode="icon-only" customIcon={<Globe className="h-4 w-4" />} showFlag={false} />
              <LanguageSwitcherCompact />
            </div>
          </div>
          
          {/* Expanded List Mode */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Expanded List Mode</h3>
            <div className="max-w-xs">
              <LanguageSwitcher mode="expanded" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Mobile Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Mobile Variants</CardTitle>
          <CardDescription>Optimized components for mobile interfaces</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sheet Triggers */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Bottom Sheet Triggers</h3>
            <div className="flex items-center gap-4">
              <LanguageSwitcherMobile triggerVariant="icon" />
              <LanguageSwitcherMobile triggerVariant="button" />
              <LanguageSwitcherMobile triggerVariant="text" />
              <LanguageSwitcherBottomSheet 
                customTrigger={
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Language Settings
                  </Button>
                }
              />
            </div>
          </div>
          
          {/* Different Sheet Sides */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Sheet Positions</h3>
            <div className="flex items-center gap-4">
              <LanguageSwitcherMobile side="bottom" triggerClassName="bg-primary-100" />
              <LanguageSwitcherMobile side="right" triggerClassName="bg-secondary-100" />
              <LanguageSwitcherMobile side="left" triggerClassName="bg-accent" />
            </div>
          </div>
          
          {/* Full Screen Mode */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Full Screen Mode</h3>
            <Button onClick={() => setShowFullScreen(true)}>
              Open Full Screen Language Selector
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
          <CardDescription>Common usage patterns in different contexts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Integration */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Header/Navbar Integration</h3>
            <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg border">
              <div className="flex items-center gap-4">
                <div className="font-semibold">Your App</div>
                <nav className="flex gap-4 text-sm">
                  <a href="#" className="hover:text-primary-600">Home</a>
                  <a href="#" className="hover:text-primary-600">About</a>
                  <a href="#" className="hover:text-primary-600">Contact</a>
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <LanguageSwitcherCompact variant="ghost" />
                <Button size="sm">Sign In</Button>
              </div>
            </div>
          </div>
          
          {/* Settings Page Integration */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Settings Page Integration</h3>
            <div className="max-w-md space-y-4 p-4 bg-surface-elevated rounded-lg border">
              <div className="space-y-2">
                <h4 className="font-medium">Preferences</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Language</span>
                    <LanguageSwitcher mode="dropdown" size="sm" showName={false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Theme</span>
                    <Button variant="outline" size="sm">Light</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile App Bar */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Mobile App Bar</h3>
            <div className="max-w-sm mx-auto">
              <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg border">
                <h2 className="font-semibold">Settings</h2>
                <LanguageSwitcherMobile triggerVariant="icon" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Accessibility Features */}
      <Card>
        <CardHeader>
          <CardTitle>Accessibility Features</CardTitle>
          <CardDescription>Built-in accessibility support</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Full keyboard navigation support</li>
            <li>ARIA labels and roles for screen readers</li>
            <li>Focus indicators and keyboard shortcuts</li>
            <li>Proper semantic HTML structure</li>
            <li>Support for RTL languages (when configured)</li>
            <li>High contrast mode compatibility</li>
            <li>Smooth animations with reduced motion support</li>
          </ul>
        </CardContent>
      </Card>
      
      {/* Full Screen Language Selector */}
      {showFullScreen && (
        <LanguageSwitcherFullScreen
          onClose={() => setShowFullScreen(false)}
          onLanguageChange={handleLanguageChange}
        />
      )}
    </div>
  )
}