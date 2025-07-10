import React from 'react'
import { Container } from '@components/layout/Container'
import { Grid, GridItem } from '@components/layout/Grid'
import { Stack } from '@components/layout/Stack'
import { AspectRatio } from '@components/layout/AspectRatio'
import { ResponsiveWrapper } from '@components/layout/ResponsiveWrapper'
import { ResponsiveTable } from '@components/ui/ResponsiveTable'
import { TouchableArea } from '@components/ui/TouchableArea'
import { useBreakpoint, useIsMobile, useIsTablet, useIsDesktop } from '@hooks/useMediaQuery'

/**
 * Demo page showcasing responsive design components
 */
export const ResponsiveDemo: React.FC = () => {
  const breakpoint = useBreakpoint()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isDesktop = useIsDesktop()

  // Sample data for table
  const tableData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Editor' },
  ]

  const tableColumns = [
    { key: 'name', header: 'Name', accessor: (item: any) => item.name },
    { key: 'email', header: 'Email', accessor: (item: any) => item.email },
    { key: 'role', header: 'Role', accessor: (item: any) => item.role },
  ]

  return (
    <div className="py-8 space-y-12">
      {/* Breakpoint indicator */}
      <div className="fixed top-4 right-4 bg-gray-900 text-white px-3 py-1 rounded-md text-sm z-50">
        {breakpoint}
      </div>

      {/* Container Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Container Component</h2>
          <p className="mb-4">This content is wrapped in a responsive container with max-width constraints.</p>
          
          <div className="space-y-4">
            <Container maxWidth="sm" className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
              <p>Small container (max-width: sm)</p>
            </Container>
            
            <Container maxWidth="md" className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
              <p>Medium container (max-width: md)</p>
            </Container>
            
            <Container maxWidth="lg" className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
              <p>Large container (max-width: lg)</p>
            </Container>
          </div>
        </Container>
      </section>

      {/* Grid Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Responsive Grid</h2>
          <Grid
            cols={{ xs: 1, sm: 2, md: 3, lg: 4 }}
            gap={4}
            className="mb-8"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-primary-100 dark:bg-primary-900 p-4 rounded-lg text-center">
                <p className="font-semibold">Grid Item {i}</p>
              </div>
            ))}
          </Grid>

          <h3 className="text-lg font-semibold mb-4">Grid with custom spans</h3>
          <Grid cols={12} gap={4}>
            <GridItem span={{ xs: 12, md: 8 }} className="bg-gray-200 dark:bg-gray-700 p-4 rounded">
              <p>Main content (8 cols on desktop, full width on mobile)</p>
            </GridItem>
            <GridItem span={{ xs: 12, md: 4 }} className="bg-gray-200 dark:bg-gray-700 p-4 rounded">
              <p>Sidebar (4 cols on desktop, full width on mobile)</p>
            </GridItem>
          </Grid>
        </Container>
      </section>

      {/* Stack Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Stack Layout</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Vertical Stack</h3>
              <Stack spacing={4} className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
                <div className="bg-white dark:bg-gray-700 p-3 rounded">Item 1</div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded">Item 2</div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded">Item 3</div>
              </Stack>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Horizontal Stack (Responsive)</h3>
              <Stack 
                direction={{ xs: 'vertical', md: 'horizontal' }}
                spacing={4}
                align="center"
                className="bg-gray-100 dark:bg-gray-800 p-4 rounded"
              >
                <div className="bg-white dark:bg-gray-700 p-3 rounded">Item 1</div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded">Item 2</div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded">Item 3</div>
              </Stack>
            </div>
          </div>
        </Container>
      </section>

      {/* Aspect Ratio Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Aspect Ratio</h2>
          <Grid cols={{ xs: 1, sm: 2, lg: 3 }} gap={4}>
            <div>
              <h3 className="text-sm font-semibold mb-2">16:9 Video</h3>
              <AspectRatio ratio="video">
                <div className="bg-gray-300 dark:bg-gray-700 w-full h-full flex items-center justify-center">
                  <p>16:9</p>
                </div>
              </AspectRatio>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-2">Square</h3>
              <AspectRatio ratio="square">
                <div className="bg-gray-300 dark:bg-gray-700 w-full h-full flex items-center justify-center">
                  <p>1:1</p>
                </div>
              </AspectRatio>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-2">4:3 Photo</h3>
              <AspectRatio ratio="photo">
                <div className="bg-gray-300 dark:bg-gray-700 w-full h-full flex items-center justify-center">
                  <p>4:3</p>
                </div>
              </AspectRatio>
            </div>
          </Grid>
        </Container>
      </section>

      {/* Responsive Wrapper Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Responsive Content</h2>
          <ResponsiveWrapper
            mobile={
              <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded">
                <p className="text-lg font-semibold">Mobile Content</p>
                <p>This content is only shown on mobile devices</p>
              </div>
            }
            tablet={
              <div className="bg-green-100 dark:bg-green-900 p-4 rounded">
                <p className="text-lg font-semibold">Tablet Content</p>
                <p>This content is only shown on tablets</p>
              </div>
            }
            desktop={
              <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded">
                <p className="text-lg font-semibold">Desktop Content</p>
                <p>This content is only shown on desktop devices</p>
              </div>
            }
          />
        </Container>
      </section>

      {/* Responsive Table Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Responsive Table</h2>
          <p className="mb-4">This table transforms into cards on mobile devices.</p>
          <ResponsiveTable
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id}
          />
        </Container>
      </section>

      {/* Touch Targets Demo */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Touch-Friendly Targets</h2>
          <Stack direction="horizontal" spacing={4} wrap>
            <TouchableArea size="minimum" className="bg-gray-200 dark:bg-gray-700 rounded">
              <span>Min (44px)</span>
            </TouchableArea>
            
            <TouchableArea size="comfortable" className="bg-gray-200 dark:bg-gray-700 rounded">
              <span>Comfortable (48px)</span>
            </TouchableArea>
            
            <TouchableArea size="spacious" className="bg-gray-200 dark:bg-gray-700 rounded">
              <span>Spacious (56px)</span>
            </TouchableArea>
          </Stack>
        </Container>
      </section>

      {/* Media Query Status */}
      <section>
        <Container>
          <h2 className="text-2xl font-bold mb-4">Media Query Hooks</h2>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded space-y-2">
            <p>Current breakpoint: <span className="font-mono font-semibold">{breakpoint}</span></p>
            <p>Is Mobile: <span className="font-mono">{isMobile ? 'true' : 'false'}</span></p>
            <p>Is Tablet: <span className="font-mono">{isTablet ? 'true' : 'false'}</span></p>
            <p>Is Desktop: <span className="font-mono">{isDesktop ? 'true' : 'false'}</span></p>
          </div>
        </Container>
      </section>
    </div>
  )
}