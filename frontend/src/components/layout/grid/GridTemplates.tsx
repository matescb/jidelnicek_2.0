import React from 'react'
import { Grid, GridProps } from './Grid'
import { GridItem } from './GridItem'
import { ResponsiveGrid } from './ResponsiveGrid'
import { FlexGrid } from './FlexGrid'

/**
 * Common grid layout templates for rapid development
 */

/**
 * Hero section with sidebar layout
 * 
 * @example
 * ```tsx
 * <GridTemplates.HeroWithSidebar>
 *   <div>Hero Content</div>
 *   <div>Sidebar</div>
 * </GridTemplates.HeroWithSidebar>
 * ```
 */
export const HeroWithSidebar: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, md: '2fr 1fr' }}
    gap={{ base: 4, md: 8 }}
    alignItems="center"
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Classic holy grail layout
 * 
 * @example
 * ```tsx
 * <GridTemplates.HolyGrail>
 *   <header>Header</header>
 *   <nav>Navigation</nav>
 *   <main>Content</main>
 *   <aside>Sidebar</aside>
 *   <footer>Footer</footer>
 * </GridTemplates.HolyGrail>
 * ```
 */
export const HolyGrail: React.FC<GridProps> = ({ children, ...props }) => {
  const [header, nav, main, aside, footer] = React.Children.toArray(children)
  
  return (
    <Grid
      areas={{
        base: [
          'header',
          'nav',
          'main',
          'aside',
          'footer'
        ],
        md: [
          'header header header',
          'nav main aside',
          'footer footer footer'
        ]
      }}
      columns={{ base: '1fr', md: '200px 1fr 200px' }}
      rows={{ base: 'auto', md: 'auto 1fr auto' }}
      gap={0}
      style={{ minHeight: '100vh' }}
      {...props}
    >
      <GridItem area="header">{header}</GridItem>
      <GridItem area="nav">{nav}</GridItem>
      <GridItem area="main">{main}</GridItem>
      <GridItem area="aside">{aside}</GridItem>
      <GridItem area="footer">{footer}</GridItem>
    </Grid>
  )
}

/**
 * Dashboard layout with collapsible sidebar
 * 
 * @example
 * ```tsx
 * <GridTemplates.Dashboard sidebarWidth="250px">
 *   <Sidebar />
 *   <Header />
 *   <MainContent />
 * </GridTemplates.Dashboard>
 * ```
 */
interface DashboardProps extends GridProps {
  sidebarWidth?: string
  sidebarCollapsed?: boolean
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  children, 
  sidebarWidth = '250px',
  sidebarCollapsed = false,
  ...props 
}) => {
  const [sidebar, header, main] = React.Children.toArray(children)
  const effectiveSidebarWidth = sidebarCollapsed ? '60px' : sidebarWidth
  
  return (
    <Grid
      areas={[
        'sidebar header',
        'sidebar main'
      ]}
      columns={`${effectiveSidebarWidth} 1fr`}
      rows="auto 1fr"
      style={{ minHeight: '100vh' }}
      {...props}
    >
      <GridItem area="sidebar">{sidebar}</GridItem>
      <GridItem area="header">{header}</GridItem>
      <GridItem area="main">{main}</GridItem>
    </Grid>
  )
}

/**
 * Card grid layout
 * 
 * @example
 * ```tsx
 * <GridTemplates.CardGrid>
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </GridTemplates.CardGrid>
 * ```
 */
export const CardGrid: React.FC<GridProps> = ({ children, ...props }) => (
  <ResponsiveGrid
    minItemWidth="300px"
    gap={{ base: 4, md: 6 }}
    {...props}
  >
    {children}
  </ResponsiveGrid>
)

/**
 * Blog/Article layout
 * 
 * @example
 * ```tsx
 * <GridTemplates.BlogLayout>
 *   <ArticleContent />
 *   <Sidebar />
 * </GridTemplates.BlogLayout>
 * ```
 */
export const BlogLayout: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, lg: '2fr 1fr' }}
    gap={{ base: 6, lg: 8 }}
    alignItems="start"
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Gallery grid with automatic image sizing
 * 
 * @example
 * ```tsx
 * <GridTemplates.Gallery>
 *   {images.map(img => <img key={img.id} src={img.url} alt={img.alt} />)}
 * </GridTemplates.Gallery>
 * ```
 */
export const Gallery: React.FC<GridProps> = ({ children, ...props }) => (
  <ResponsiveGrid
    minItemWidth="200px"
    gap={{ base: 2, md: 4 }}
    {...props}
  >
    {children}
  </ResponsiveGrid>
)

/**
 * Feature grid for landing pages
 * 
 * @example
 * ```tsx
 * <GridTemplates.Features>
 *   <FeatureCard icon="star" title="Feature 1" description="..." />
 *   <FeatureCard icon="heart" title="Feature 2" description="..." />
 *   <FeatureCard icon="zap" title="Feature 3" description="..." />
 * </GridTemplates.Features>
 * ```
 */
export const Features: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, sm: 2, lg: 3 }}
    gap={{ base: 6, md: 8 }}
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Pricing table layout
 * 
 * @example
 * ```tsx
 * <GridTemplates.PricingTable>
 *   <PricingCard plan="Basic" price="$9" />
 *   <PricingCard plan="Pro" price="$29" featured />
 *   <PricingCard plan="Enterprise" price="$99" />
 * </GridTemplates.PricingTable>
 * ```
 */
export const PricingTable: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, md: 3 }}
    gap={{ base: 4, md: 6 }}
    alignItems="stretch"
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Stats/Metrics grid
 * 
 * @example
 * ```tsx
 * <GridTemplates.StatsGrid>
 *   <StatCard label="Total Users" value="1,234" />
 *   <StatCard label="Revenue" value="$45,678" />
 *   <StatCard label="Growth" value="+12.5%" />
 *   <StatCard label="Active Now" value="89" />
 * </GridTemplates.StatsGrid>
 * ```
 */
export const StatsGrid: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, sm: 2, lg: 4 }}
    gap={{ base: 4, md: 6 }}
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Two-column layout with sticky sidebar
 * 
 * @example
 * ```tsx
 * <GridTemplates.StickyLayout>
 *   <div style={{ position: 'sticky', top: '1rem' }}>
 *     Sticky Sidebar Content
 *   </div>
 *   <div>
 *     Main scrollable content
 *   </div>
 * </GridTemplates.StickyLayout>
 * ```
 */
export const StickyLayout: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, lg: '300px 1fr' }}
    gap={{ base: 6, lg: 8 }}
    alignItems="start"
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Masonry-style gallery
 * 
 * @example
 * ```tsx
 * <GridTemplates.MasonryGallery>
 *   {images.map(img => <img key={img.id} src={img.url} alt={img.alt} />)}
 * </GridTemplates.MasonryGallery>
 * ```
 */
export const MasonryGallery: React.FC<GridProps> = ({ children, ...props }) => (
  <ResponsiveGrid
    minItemWidth="250px"
    masonry
    masonryGap="1rem"
    gap={4}
    {...props}
  >
    {children}
  </ResponsiveGrid>
)

/**
 * Form layout with labels and inputs
 * 
 * @example
 * ```tsx
 * <GridTemplates.FormLayout>
 *   <label>Name</label>
 *   <input type="text" />
 *   <label>Email</label>
 *   <input type="email" />
 *   <label>Message</label>
 *   <textarea />
 * </GridTemplates.FormLayout>
 * ```
 */
export const FormLayout: React.FC<GridProps> = ({ children, ...props }) => (
  <Grid
    columns={{ base: 1, sm: 'auto 1fr' }}
    gap={{ base: 2, sm: 4 }}
    alignItems={{ base: 'start', sm: 'center' }}
    {...props}
  >
    {children}
  </Grid>
)

/**
 * Centered content layout
 * 
 * @example
 * ```tsx
 * <GridTemplates.CenteredLayout>
 *   <Logo />
 *   <Heading />
 *   <Description />
 *   <CallToAction />
 * </GridTemplates.CenteredLayout>
 * ```
 */
export const CenteredLayout: React.FC<GridProps> = ({ children, ...props }) => (
  <FlexGrid
    direction="column"
    alignItems="center"
    justifyContent="center"
    gap={{ base: 4, md: 6 }}
    style={{ minHeight: '100vh', textAlign: 'center' }}
    {...props}
  >
    {children}
  </FlexGrid>
)

/**
 * Export all templates as a namespace
 */
export const GridTemplates = {
  HeroWithSidebar,
  HolyGrail,
  Dashboard,
  CardGrid,
  BlogLayout,
  Gallery,
  Features,
  PricingTable,
  StatsGrid,
  StickyLayout,
  MasonryGallery,
  FormLayout,
  CenteredLayout
}