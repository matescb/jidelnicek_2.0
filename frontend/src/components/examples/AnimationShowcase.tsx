import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RotateCw, 
  Zap, 
  Layers, 
  Grid, 
  BarChart, 
  Activity,
  Star,
  Heart,
  Coffee,
  Moon
} from 'lucide-react';
import { 
  AnimatedList, 
  AnimatedListItem,
  AnimatedPage,
  AnimatedSection,
  AnimatedCard,
  AnimatedImageCard,
  ParallaxSection
} from '@/components/ui/animated';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Skeleton, SkeletonCard, SkeletonText, SkeletonAvatar } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  fadeIn, 
  slideIn, 
  scaleIn,
  staggerContainer,
  staggerItem,
  textReveal,
  notificationSlide,
  drawerAnimation,
  spin
} from '@/utils/animations';

const AnimationShowcase: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('basic');
  const [showNotification, setShowNotification] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Sample data for lists
  const listItems = [
    { id: 1, title: 'First Item', description: 'This animates first' },
    { id: 2, title: 'Second Item', description: 'This animates second' },
    { id: 3, title: 'Third Item', description: 'This animates third' },
    { id: 4, title: 'Fourth Item', description: 'This animates fourth' },
  ];

  const cardExamples = [
    { title: 'Hover Me', description: 'I scale on hover', icon: <Zap className="w-5 h-5" /> },
    { title: 'Tap Me', description: 'I respond to taps', icon: <Activity className="w-5 h-5" /> },
    { title: '3D Tilt', description: 'Move your mouse over me', icon: <Layers className="w-5 h-5" /> },
    { title: 'Flip Card', description: 'Click to flip me', icon: <RotateCw className="w-5 h-5" /> },
  ];

  return (
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <AnimatedSection animation="fade" className="text-center space-y-4">
          <motion.h1 
            className="text-4xl font-bold text-gray-900 dark:text-white"
            variants={textReveal}
            initial="initial"
            animate="animate"
          >
            Animation Showcase
          </motion.h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Demonstrating all animation patterns with Framer Motion
          </p>
        </AnimatedSection>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="lists">Lists</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Basic Animations */}
          <TabsContent value="basic" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatedSection animation="fade">
                <Card>
                  <CardHeader>
                    <CardTitle>Fade In</CardTitle>
                    <CardDescription>Simple opacity animation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-primary-500 rounded-lg" />
                  </CardContent>
                </Card>
              </AnimatedSection>

              <AnimatedSection animation="slide" direction="up">
                <Card>
                  <CardHeader>
                    <CardTitle>Slide Up</CardTitle>
                    <CardDescription>Slides from bottom</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-primary-500 rounded-lg" />
                  </CardContent>
                </Card>
              </AnimatedSection>

              <AnimatedSection animation="scale">
                <Card>
                  <CardHeader>
                    <CardTitle>Scale In</CardTitle>
                    <CardDescription>Scales from smaller size</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-primary-500 rounded-lg" />
                  </CardContent>
                </Card>
              </AnimatedSection>
            </div>

            {/* Button Animations */}
            <AnimatedSection animation="fade" delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle>Interactive Buttons</CardTitle>
                  <CardDescription>Buttons with hover, tap, and focus animations</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  <Button>Default Button</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button isLoading>Loading</Button>
                  <Button leftIcon={<Star className="w-4 h-4" />}>With Icon</Button>
                </CardContent>
              </Card>
            </AnimatedSection>
          </TabsContent>

          {/* List Animations */}
          <TabsContent value="lists" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Staggered List Animation</CardTitle>
                <CardDescription>Items animate one after another</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedList className="space-y-3">
                  {listItems.map((item) => (
                    <Card key={item.id} className="p-4">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.description}
                      </p>
                    </Card>
                  ))}
                </AnimatedList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Stagger Delay</CardTitle>
                <CardDescription>Slower stagger animation</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedList staggerDelay={0.15} className="space-y-3">
                  {['First', 'Second', 'Third', 'Fourth'].map((item, index) => (
                    <div key={index} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      {item} item with longer delay
                    </div>
                  ))}
                </AnimatedList>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Card Animations */}
          <TabsContent value="cards" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {cardExamples.map((card, index) => (
                <AnimatedSection 
                  key={index} 
                  animation="scale" 
                  delay={index * 0.1}
                >
                  {card.title === '3D Tilt' ? (
                    <AnimatedCard tiltEffect maxTilt={15} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        {card.icon}
                        <h3 className="text-lg font-semibold">{card.title}</h3>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">{card.description}</p>
                    </AnimatedCard>
                  ) : card.title === 'Flip Card' ? (
                    <AnimatedCard 
                      flipOnClick 
                      className="h-32"
                      backContent={
                        <div className="p-6 bg-primary-500 text-white rounded-lg h-full flex items-center justify-center">
                          <p>This is the back side!</p>
                        </div>
                      }
                    >
                      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full">
                        <div className="flex items-center gap-3 mb-2">
                          {card.icon}
                          <h3 className="text-lg font-semibold">{card.title}</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">{card.description}</p>
                      </div>
                    </AnimatedCard>
                  ) : (
                    <AnimatedCard className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        {card.icon}
                        <h3 className="text-lg font-semibold">{card.title}</h3>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">{card.description}</p>
                    </AnimatedCard>
                  )}
                </AnimatedSection>
              ))}
            </div>

            {/* Image Card Example */}
            <AnimatedSection animation="fade">
              <h3 className="text-lg font-semibold mb-4">Image Cards with Loading</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <AnimatedImageCard
                    key={i}
                    src={`https://picsum.photos/400/300?random=${i}`}
                    alt={`Example image ${i}`}
                    className="rounded-lg overflow-hidden shadow-lg"
                  >
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-white font-semibold">Image {i}</p>
                    </div>
                  </AnimatedImageCard>
                ))}
              </div>
            </AnimatedSection>
          </TabsContent>

          {/* Advanced Animations */}
          <TabsContent value="advanced" className="space-y-6">
            {/* Collapsible Sections */}
            <Card>
              <CardHeader>
                <CardTitle>Collapsible Sections</CardTitle>
                <CardDescription>Smooth height animations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <CollapsibleSection
                  title="Click to expand"
                  icon={<Coffee className="w-5 h-5" />}
                  badge={<Badge>New</Badge>}
                >
                  <p className="text-gray-600 dark:text-gray-400">
                    This content smoothly animates in and out when toggling the section.
                    The animation respects the prefers-reduced-motion setting.
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Another section"
                  icon={<Moon className="w-5 h-5" />}
                  defaultOpen
                >
                  <p className="text-gray-600 dark:text-gray-400">
                    This section is open by default. Click to collapse it.
                  </p>
                </CollapsibleSection>
              </CardContent>
            </Card>

            {/* Dialog Animation */}
            <Card>
              <CardHeader>
                <CardTitle>Modal Animations</CardTitle>
                <CardDescription>Animated dialog with backdrop</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>Open Animated Dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Animated Modal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>This modal animates in with a spring effect.</p>
                      <AnimatedList className="space-y-2">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Item 1</div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Item 2</div>
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Item 3</div>
                      </AnimatedList>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Loading States */}
            <Card>
              <CardHeader>
                <CardTitle>Loading Skeletons</CardTitle>
                <CardDescription>Animated loading states</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <SkeletonAvatar size="lg" />
                  <div className="space-y-2 flex-1">
                    <SkeletonText className="w-1/3" />
                    <SkeletonText className="w-2/3" />
                  </div>
                </div>
                <SkeletonCard />
              </CardContent>
            </Card>

            {/* Notification Animation */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Slide</CardTitle>
                <CardDescription>Slide-in notification example</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowNotification(!showNotification)}>
                  Toggle Notification
                </Button>
                
                {showNotification && (
                  <motion.div
                    className="fixed top-4 right-4 z-50"
                    variants={notificationSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <Card className="w-80 shadow-xl">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Notification</CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowNotification(false)}
                          >
                            ×
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">This notification slides in from the right!</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Spinning Animation */}
            <Card>
              <CardHeader>
                <CardTitle>Continuous Animations</CardTitle>
                <CardDescription>Infinite rotating animation</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <motion.div animate={spin} className="text-primary-500">
                  <RotateCw className="w-12 h-12" />
                </motion.div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AnimatedPage>
  );
};

export default AnimationShowcase;