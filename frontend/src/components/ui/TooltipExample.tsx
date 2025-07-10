import React, { useState } from 'react';
import { Tooltip } from './Tooltip';
import { Button } from './button';
import { Input } from './input';
import { Card } from './card';
import { HelpCircle, Info, AlertCircle, CheckCircle } from 'lucide-react';

export const TooltipExample: React.FC = () => {
  const [controlledOpen, setControlledOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Enhanced Tooltip Component</h1>

      {/* Basic Tooltips */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Basic Tooltips</h2>
        <div className="flex flex-wrap gap-4">
          <Tooltip content="This is a simple tooltip">
            <Button variant="outline">Hover me</Button>
          </Tooltip>
          
          <Tooltip content="Disabled tooltip" disabled>
            <Button variant="outline">Disabled tooltip</Button>
          </Tooltip>
          
          <Tooltip content="No delay tooltip" showDelay={0}>
            <Button variant="outline">No delay</Button>
          </Tooltip>
          
          <Tooltip content="Long delay tooltip" showDelay={1000}>
            <Button variant="outline">1s delay</Button>
          </Tooltip>
        </div>
      </section>

      {/* Placement Options */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Placement Options</h2>
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div />
          <Tooltip content="Top placement" placement="top">
            <Button variant="outline" className="w-full">Top</Button>
          </Tooltip>
          <div />
          
          <Tooltip content="Left placement" placement="left">
            <Button variant="outline" className="w-full">Left</Button>
          </Tooltip>
          
          <div className="flex justify-center">
            <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <span className="text-gray-500">Center</span>
              <Tooltip content="Top-start" placement="top-start">
                <button className="absolute top-0 left-0 w-4 h-4 bg-blue-500 rounded-full" />
              </Tooltip>
              <Tooltip content="Top-end" placement="top-end">
                <button className="absolute top-0 right-0 w-4 h-4 bg-blue-500 rounded-full" />
              </Tooltip>
              <Tooltip content="Bottom-start" placement="bottom-start">
                <button className="absolute bottom-0 left-0 w-4 h-4 bg-blue-500 rounded-full" />
              </Tooltip>
              <Tooltip content="Bottom-end" placement="bottom-end">
                <button className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-full" />
              </Tooltip>
            </div>
          </div>
          
          <Tooltip content="Right placement" placement="right">
            <Button variant="outline" className="w-full">Right</Button>
          </Tooltip>
          
          <div />
          <Tooltip content="Bottom placement" placement="bottom">
            <Button variant="outline" className="w-full">Bottom</Button>
          </Tooltip>
          <div />
        </div>
      </section>

      {/* Trigger Modes */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Trigger Modes</h2>
        <div className="flex flex-wrap gap-4">
          <Tooltip content="Hover trigger (default)" trigger="hover">
            <Button variant="outline">Hover</Button>
          </Tooltip>
          
          <Tooltip content="Click to toggle" trigger="click">
            <Button variant="outline">Click</Button>
          </Tooltip>
          
          <Tooltip content="Focus to show" trigger="focus">
            <Input placeholder="Focus me" className="w-32" />
          </Tooltip>
          
          <Tooltip content="Multiple triggers" trigger={['hover', 'focus']}>
            <Input placeholder="Hover or focus" className="w-40" />
          </Tooltip>
          
          <Tooltip 
            content="Manual control" 
            trigger="manual"
            open={manualOpen}
            onOpenChange={setManualOpen}
          >
            <Button 
              variant="outline"
              onClick={() => setManualOpen(!manualOpen)}
            >
              Manual ({manualOpen ? 'Open' : 'Closed'})
            </Button>
          </Tooltip>
        </div>
      </section>

      {/* Size and Variant Options */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Size and Variant Options</h2>
        <div className="flex flex-wrap gap-4">
          <Tooltip content="Small tooltip" size="sm">
            <Button variant="outline" size="sm">Small</Button>
          </Tooltip>
          
          <Tooltip content="Medium tooltip (default)" size="md">
            <Button variant="outline">Medium</Button>
          </Tooltip>
          
          <Tooltip content="Large tooltip with more content" size="lg">
            <Button variant="outline" size="lg">Large</Button>
          </Tooltip>
          
          <Tooltip content="Dark variant (default)" variant="dark">
            <Button variant="outline">Dark</Button>
          </Tooltip>
          
          <Tooltip content="Light variant" variant="light">
            <Button variant="outline">Light</Button>
          </Tooltip>
        </div>
      </section>

      {/* Advanced Features */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Advanced Features</h2>
        <div className="space-y-4">
          {/* Custom Content */}
          <div>
            <h3 className="text-lg font-medium mb-2">Custom Content</h3>
            <Tooltip 
              content={
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span className="font-semibold">Rich Content Tooltip</span>
                  </div>
                  <p className="text-xs">This tooltip contains custom JSX content including icons and formatted text.</p>
                  <div className="flex gap-1 mt-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  </div>
                </div>
              }
              size="lg"
              maxWidth={300}
            >
              <Button variant="outline">Custom Content</Button>
            </Tooltip>
          </div>

          {/* Interactive Tooltip */}
          <div>
            <h3 className="text-lg font-medium mb-2">Interactive Tooltip</h3>
            <Tooltip 
              content={
                <div className="space-y-2">
                  <p>This tooltip stays open when you hover over it.</p>
                  <Button size="sm" variant="ghost">Click me!</Button>
                </div>
              }
              interactive
              hideDelay={200}
            >
              <Button variant="outline">Interactive</Button>
            </Tooltip>
          </div>

          {/* No Arrow */}
          <div>
            <h3 className="text-lg font-medium mb-2">Without Arrow</h3>
            <Tooltip content="This tooltip has no arrow" arrow={false}>
              <Button variant="outline">No Arrow</Button>
            </Tooltip>
          </div>

          {/* Custom Offset */}
          <div>
            <h3 className="text-lg font-medium mb-2">Custom Offset</h3>
            <div className="flex gap-4">
              <Tooltip content="Default offset (8px)" offset={8}>
                <Button variant="outline">8px</Button>
              </Tooltip>
              <Tooltip content="Large offset" offset={20}>
                <Button variant="outline">20px</Button>
              </Tooltip>
              <Tooltip content="Small offset" offset={2}>
                <Button variant="outline">2px</Button>
              </Tooltip>
            </div>
          </div>

          {/* Auto-positioning */}
          <div>
            <h3 className="text-lg font-medium mb-2">Auto-positioning (scroll to test)</h3>
            <div className="h-32 overflow-auto border rounded p-4">
              <div className="h-64 relative">
                <Tooltip content="This tooltip will flip when near edges" placement="top">
                  <Button variant="outline" className="absolute top-2 left-2">
                    Top-left corner
                  </Button>
                </Tooltip>
                <Tooltip content="This tooltip will flip when near edges" placement="bottom">
                  <Button variant="outline" className="absolute bottom-2 right-2">
                    Bottom-right corner
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Controlled State */}
          <div>
            <h3 className="text-lg font-medium mb-2">Controlled State</h3>
            <div className="flex items-center gap-4">
              <Tooltip 
                content="This tooltip is controlled"
                open={controlledOpen}
                onOpenChange={setControlledOpen}
              >
                <Button variant="outline">Controlled Tooltip</Button>
              </Tooltip>
              <Button 
                onClick={() => setControlledOpen(!controlledOpen)}
                size="sm"
              >
                Toggle ({controlledOpen ? 'Open' : 'Closed'})
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Real-world Examples */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Real-world Examples</h2>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">Account Status</span>
                <Tooltip 
                  content="Your account is active and in good standing"
                  placement="right"
                >
                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>
              <span className="text-green-600 font-medium">Active</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <Tooltip
                content={
                  <div>
                    <p className="font-semibold mb-1">Form Validation</p>
                    <ul className="text-xs space-y-1">
                      <li>• Minimum 8 characters</li>
                      <li>• At least one uppercase letter</li>
                      <li>• At least one number</li>
                      <li>• At least one special character</li>
                    </ul>
                  </div>
                }
                placement="top"
                trigger={['hover', 'focus']}
                maxWidth={250}
              >
                <Input 
                  type="password" 
                  placeholder="Enter password"
                  className="max-w-xs"
                />
              </Tooltip>
              <Tooltip
                content="Password strength: Weak"
                placement="right"
                variant="light"
              >
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </Tooltip>
            </div>
          </Card>

          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <Tooltip content="Total views in the last 30 days">
                <div>
                  <div className="text-2xl font-bold">1,234</div>
                  <div className="text-sm text-gray-600">Views</div>
                </div>
              </Tooltip>
              <Tooltip content="Unique visitors in the last 30 days">
                <div>
                  <div className="text-2xl font-bold">567</div>
                  <div className="text-sm text-gray-600">Visitors</div>
                </div>
              </Tooltip>
              <Tooltip content="Average time spent on page">
                <div>
                  <div className="text-2xl font-bold">2:45</div>
                  <div className="text-sm text-gray-600">Avg. Time</div>
                </div>
              </Tooltip>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};