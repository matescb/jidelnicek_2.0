import React from 'react'
import { 
  Grid, 
  GridItem, 
  ResponsiveGrid, 
  FlexGrid, 
  FlexItem,
  GridTemplates 
} from './index'

/**
 * Grid System Examples and Documentation
 */

export const GridExamples: React.FC = () => {
  return (
    <div className="space-y-12 p-8">
      <h1 className="text-3xl font-bold mb-8">Grid System Examples</h1>

      {/* Basic Grid */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Basic Grid</h2>
        <Grid columns={3} gap={4} className="mb-4">
          <div className="bg-blue-100 p-4 rounded">Item 1</div>
          <div className="bg-blue-100 p-4 rounded">Item 2</div>
          <div className="bg-blue-100 p-4 rounded">Item 3</div>
          <div className="bg-blue-100 p-4 rounded">Item 4</div>
          <div className="bg-blue-100 p-4 rounded">Item 5</div>
          <div className="bg-blue-100 p-4 rounded">Item 6</div>
        </Grid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<Grid columns={3} gap={4}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  ...
</Grid>`}
        </pre>
      </section>

      {/* Responsive Grid */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Responsive Grid</h2>
        <Grid 
          columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
          gap={{ base: 2, md: 4 }}
          className="mb-4"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-green-100 p-4 rounded">
              Item {i}
            </div>
          ))}
        </Grid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<Grid 
  columns={{ base: 1, sm: 2, md: 3, lg: 4 }} 
  gap={{ base: 2, md: 4 }}
>
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</Grid>`}
        </pre>
      </section>

      {/* Grid with Spanning Items */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Grid with Spanning Items</h2>
        <Grid columns={4} gap={4} className="mb-4">
          <GridItem colSpan={2} className="bg-purple-100 p-4 rounded">
            Spans 2 columns
          </GridItem>
          <GridItem colSpan={2} rowSpan={2} className="bg-purple-200 p-4 rounded">
            Spans 2x2
          </GridItem>
          <GridItem className="bg-purple-100 p-4 rounded">Normal</GridItem>
          <GridItem className="bg-purple-100 p-4 rounded">Normal</GridItem>
          <GridItem colSpan="full" className="bg-purple-300 p-4 rounded">
            Full width
          </GridItem>
        </Grid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<Grid columns={4} gap={4}>
  <GridItem colSpan={2}>Spans 2 columns</GridItem>
  <GridItem colSpan={2} rowSpan={2}>Spans 2x2</GridItem>
  <GridItem>Normal</GridItem>
  <GridItem>Normal</GridItem>
  <GridItem colSpan="full">Full width</GridItem>
</Grid>`}
        </pre>
      </section>

      {/* Auto-Responsive Grid */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Auto-Responsive Grid</h2>
        <ResponsiveGrid minItemWidth="250px" gap={4} className="mb-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-yellow-100 p-8 rounded">
              Auto Item {i}
            </div>
          ))}
        </ResponsiveGrid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<ResponsiveGrid minItemWidth="250px" gap={4}>
  {items.map(item => <Card key={item.id} {...item} />)}
</ResponsiveGrid>`}
        </pre>
      </section>

      {/* Grid Areas Layout */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Grid Areas Layout</h2>
        <Grid
          areas={[
            'header header header',
            'sidebar content content',
            'footer footer footer'
          ]}
          columns="200px 1fr 1fr"
          rows="80px 300px 60px"
          gap={4}
          className="mb-4"
        >
          <GridItem area="header" className="bg-red-100 p-4 rounded">
            Header
          </GridItem>
          <GridItem area="sidebar" className="bg-red-200 p-4 rounded">
            Sidebar
          </GridItem>
          <GridItem area="content" className="bg-red-100 p-4 rounded">
            Main Content
          </GridItem>
          <GridItem area="footer" className="bg-red-300 p-4 rounded">
            Footer
          </GridItem>
        </Grid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<Grid
  areas={[
    'header header header',
    'sidebar content content',
    'footer footer footer'
  ]}
  columns="200px 1fr 1fr"
  rows="80px 300px 60px"
  gap={4}
>
  <GridItem area="header">Header</GridItem>
  <GridItem area="sidebar">Sidebar</GridItem>
  <GridItem area="content">Main Content</GridItem>
  <GridItem area="footer">Footer</GridItem>
</Grid>`}
        </pre>
      </section>

      {/* FlexGrid Examples */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">FlexGrid</h2>
        <FlexGrid 
          wrap="wrap" 
          gap={4} 
          alignItems="center" 
          justifyContent="between"
          className="mb-4"
        >
          <div className="bg-indigo-100 p-4 rounded">Flex Item 1</div>
          <div className="bg-indigo-100 p-6 rounded">Flex Item 2</div>
          <div className="bg-indigo-100 p-8 rounded">Flex Item 3</div>
          <div className="bg-indigo-100 p-4 rounded">Flex Item 4</div>
        </FlexGrid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<FlexGrid 
  wrap="wrap" 
  gap={4} 
  alignItems="center" 
  justifyContent="between"
>
  <div>Flex Item 1</div>
  <div>Flex Item 2</div>
  <div>Flex Item 3</div>
  <div>Flex Item 4</div>
</FlexGrid>`}
        </pre>
      </section>

      {/* Template Examples */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Grid Templates</h2>
        
        {/* Card Grid Template */}
        <div className="mb-8">
          <h3 className="text-xl font-medium mb-2">Card Grid</h3>
          <GridTemplates.CardGrid>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-100 p-6 rounded shadow">
                <h4 className="font-semibold mb-2">Card {i}</h4>
                <p className="text-gray-600">Card content goes here</p>
              </div>
            ))}
          </GridTemplates.CardGrid>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto mt-4">
{`<GridTemplates.CardGrid>
  {cards.map(card => <Card key={card.id} {...card} />)}
</GridTemplates.CardGrid>`}
          </pre>
        </div>

        {/* Dashboard Template */}
        <div className="mb-8">
          <h3 className="text-xl font-medium mb-2">Dashboard Layout</h3>
          <div className="h-96 relative">
            <GridTemplates.Dashboard sidebarWidth="200px">
              <div className="bg-gray-800 text-white p-4">Sidebar</div>
              <div className="bg-gray-100 p-4 border-b">Header</div>
              <div className="bg-white p-4">Main Content Area</div>
            </GridTemplates.Dashboard>
          </div>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto mt-4">
{`<GridTemplates.Dashboard sidebarWidth="200px">
  <Sidebar />
  <Header />
  <MainContent />
</GridTemplates.Dashboard>`}
          </pre>
        </div>
      </section>

      {/* Advanced Alignment */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Advanced Alignment</h2>
        <Grid 
          columns={3} 
          gap={4}
          alignItems="center"
          justifyItems="center"
          style={{ height: '200px', background: '#f3f4f6' }}
          className="mb-4 rounded"
        >
          <GridItem alignSelf="start" className="bg-orange-100 p-4 rounded w-full">
            Start
          </GridItem>
          <GridItem className="bg-orange-100 p-4 rounded">
            Center (default)
          </GridItem>
          <GridItem alignSelf="end" justifySelf="end" className="bg-orange-100 p-4 rounded">
            End
          </GridItem>
        </Grid>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`<Grid 
  columns={3} 
  gap={4}
  alignItems="center"
  justifyItems="center"
>
  <GridItem alignSelf="start">Start</GridItem>
  <GridItem>Center (default)</GridItem>
  <GridItem alignSelf="end" justifySelf="end">End</GridItem>
</Grid>`}
        </pre>
      </section>

      {/* Container Queries Example */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Container Queries (Modern Browsers)</h2>
        <div className="resize overflow-auto border-2 border-gray-300 p-4 rounded">
          <Grid 
            containerQueries
            containerName="grid-container"
            columns={{ base: 1, sm: 2, md: 3 }}
            gap={4}
          >
            <div className="bg-pink-100 p-4 rounded">Resize me!</div>
            <div className="bg-pink-100 p-4 rounded">Container Query</div>
            <div className="bg-pink-100 p-4 rounded">Responsive</div>
          </Grid>
        </div>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto mt-4">
{`<Grid 
  containerQueries
  containerName="grid-container"
  columns={{ base: 1, sm: 2, md: 3 }}
  gap={4}
>
  <div>Content responds to container size</div>
</Grid>`}
        </pre>
      </section>
    </div>
  )
}

export default GridExamples