import * as fs from 'fs'
import * as path from 'path'
import { gzip } from 'zlib'
import { promisify } from 'util'
import { calculateBundleSize } from './utils'

const gzipAsync = promisify(gzip)

// Bundle size thresholds (in KB)
const BUNDLE_SIZE_LIMITS = {
  main: {
    raw: 500,    // 500KB raw
    gzipped: 150 // 150KB gzipped
  },
  vendor: {
    raw: 800,    // 800KB raw
    gzipped: 250 // 250KB gzipped
  },
  runtime: {
    raw: 50,     // 50KB raw
    gzipped: 15  // 15KB gzipped
  },
  perRoute: {
    raw: 100,    // 100KB per route chunk
    gzipped: 30  // 30KB gzipped per route
  },
  css: {
    raw: 200,    // 200KB raw CSS
    gzipped: 50  // 50KB gzipped CSS
  },
  images: {
    total: 5000  // 5MB total images
  }
}

describe('Bundle Size Tests', () => {
  const distPath = path.join(process.cwd(), 'dist')
  const assetsPath = path.join(distPath, 'assets')

  beforeAll(() => {
    // Ensure dist directory exists
    if (!fs.existsSync(distPath)) {
      console.warn('Build directory not found. Run "npm run build" first.')
    }
  })

  describe('JavaScript Bundle Sizes', () => {
    it('should keep main bundle within size limits', async () => {
      const mainBundlePath = findBundle('index', '.js')
      if (!mainBundlePath) {
        console.warn('Main bundle not found. Skipping test.')
        return
      }

      const bundleContent = fs.readFileSync(mainBundlePath, 'utf8')
      const { raw, gzipped } = await getActualBundleSize(bundleContent)

      expect(raw).toBeLessThan(BUNDLE_SIZE_LIMITS.main.raw * 1024)
      expect(gzipped).toBeLessThan(BUNDLE_SIZE_LIMITS.main.gzipped * 1024)
    })

    it('should keep vendor bundle within size limits', async () => {
      const vendorBundlePath = findBundle('vendor', '.js')
      if (!vendorBundlePath) {
        console.warn('Vendor bundle not found. Skipping test.')
        return
      }

      const bundleContent = fs.readFileSync(vendorBundlePath, 'utf8')
      const { raw, gzipped } = await getActualBundleSize(bundleContent)

      expect(raw).toBeLessThan(BUNDLE_SIZE_LIMITS.vendor.raw * 1024)
      expect(gzipped).toBeLessThan(BUNDLE_SIZE_LIMITS.vendor.gzipped * 1024)
    })

    it('should keep runtime bundle small', async () => {
      const runtimeBundlePath = findBundle('runtime', '.js')
      if (!runtimeBundlePath) {
        // Runtime might be inlined
        return
      }

      const bundleContent = fs.readFileSync(runtimeBundlePath, 'utf8')
      const { raw, gzipped } = await getActualBundleSize(bundleContent)

      expect(raw).toBeLessThan(BUNDLE_SIZE_LIMITS.runtime.raw * 1024)
      expect(gzipped).toBeLessThan(BUNDLE_SIZE_LIMITS.runtime.gzipped * 1024)
    })

    it('should split routes into reasonable chunks', async () => {
      const routeChunks = findBundles(/^(?!index|vendor|runtime).*\.js$/)
      
      for (const chunk of routeChunks) {
        const bundleContent = fs.readFileSync(chunk, 'utf8')
        const { raw, gzipped } = await getActualBundleSize(bundleContent)

        expect(raw).toBeLessThan(BUNDLE_SIZE_LIMITS.perRoute.raw * 1024)
        expect(gzipped).toBeLessThan(BUNDLE_SIZE_LIMITS.perRoute.gzipped * 1024)
      }
    })
  })

  describe('CSS Bundle Sizes', () => {
    it('should keep CSS bundle within size limits', async () => {
      const cssBundlePath = findBundle('index', '.css')
      if (!cssBundlePath) {
        console.warn('CSS bundle not found. Skipping test.')
        return
      }

      const cssContent = fs.readFileSync(cssBundlePath, 'utf8')
      const { raw, gzipped } = await getActualBundleSize(cssContent)

      expect(raw).toBeLessThan(BUNDLE_SIZE_LIMITS.css.raw * 1024)
      expect(gzipped).toBeLessThan(BUNDLE_SIZE_LIMITS.css.gzipped * 1024)
    })

    it('should remove unused CSS (tree shaking)', () => {
      const cssBundlePath = findBundle('index', '.css')
      if (!cssBundlePath) {
        return
      }

      const cssContent = fs.readFileSync(cssBundlePath, 'utf8')
      
      // Check for common unused utility classes
      const unusedPatterns = [
        /\.bg-purple-\d{3}/,  // Unused color utilities
        /\.grid-cols-[7-9]/,  // Unused grid columns
        /\.text-\dxl/         // Very large text sizes
      ]

      for (const pattern of unusedPatterns) {
        expect(cssContent).not.toMatch(pattern)
      }
    })
  })

  describe('Code Splitting', () => {
    it('should create separate chunks for lazy-loaded routes', () => {
      const chunks = findBundles(/\.js$/)
      const chunkNames = chunks.map(chunk => path.basename(chunk))

      // Should have multiple chunks
      expect(chunks.length).toBeGreaterThan(3)

      // Check for expected route chunks
      const expectedRoutes = ['recipes', 'shopping', 'meal-plans', 'admin']
      for (const route of expectedRoutes) {
        const hasRouteChunk = chunkNames.some(name => 
          name.toLowerCase().includes(route)
        )
        expect(hasRouteChunk).toBe(true)
      }
    })

    it('should extract common dependencies into vendor chunk', () => {
      const vendorBundlePath = findBundle('vendor', '.js')
      if (!vendorBundlePath) {
        return
      }

      const vendorContent = fs.readFileSync(vendorBundlePath, 'utf8')
      
      // Check for common libraries
      const expectedLibraries = ['react', 'react-dom', '@mui/material']
      for (const lib of expectedLibraries) {
        expect(vendorContent).toContain(lib)
      }
    })

    it('should not duplicate code across chunks', async () => {
      const chunks = findBundles(/\.js$/)
      const moduleSignatures = new Map<string, string[]>()

      // Extract module signatures from each chunk
      for (const chunk of chunks) {
        const content = fs.readFileSync(chunk, 'utf8')
        const chunkName = path.basename(chunk)
        
        // Simple pattern to find module definitions
        const modulePattern = /define\(['"]([^'"]+)['"]/g
        let match
        
        while ((match = modulePattern.exec(content)) !== null) {
          const moduleName = match[1]
          if (!moduleSignatures.has(moduleName)) {
            moduleSignatures.set(moduleName, [])
          }
          moduleSignatures.get(moduleName)!.push(chunkName)
        }
      }

      // Check for duplicates
      const duplicates = Array.from(moduleSignatures.entries())
        .filter(([_, chunks]) => chunks.length > 1)
        .filter(([module]) => !module.includes('runtime')) // Runtime can be duplicated

      expect(duplicates.length).toBe(0)
    })
  })

  describe('Tree Shaking', () => {
    it('should remove unused exports', () => {
      const mainBundlePath = findBundle('index', '.js')
      if (!mainBundlePath) {
        return
      }

      const bundleContent = fs.readFileSync(mainBundlePath, 'utf8')
      
      // Check that test utilities are not included
      const testOnlyExports = [
        'testUtils',
        'mockData',
        '__test__',
        'TestProvider'
      ]

      for (const testExport of testOnlyExports) {
        expect(bundleContent).not.toContain(testExport)
      }
    })

    it('should remove development-only code', () => {
      const chunks = findBundles(/\.js$/)
      
      for (const chunk of chunks) {
        const content = fs.readFileSync(chunk, 'utf8')
        
        // Check for development-only patterns
        expect(content).not.toContain('console.log')
        expect(content).not.toContain('console.debug')
        expect(content).not.toContain('debugger')
        expect(content).not.toMatch(/process\.env\.NODE_ENV\s*===\s*['"]development['"]/)
      }
    })
  })

  describe('Asset Optimization', () => {
    it('should optimize image assets', () => {
      if (!fs.existsSync(assetsPath)) {
        return
      }

      const images = findAssets(/\.(png|jpg|jpeg|webp)$/)
      let totalImageSize = 0

      for (const image of images) {
        const stats = fs.statSync(image)
        totalImageSize += stats.size

        // Individual image should not be too large
        expect(stats.size).toBeLessThan(500 * 1024) // 500KB max per image
      }

      // Total image size should be reasonable
      expect(totalImageSize).toBeLessThan(BUNDLE_SIZE_LIMITS.images.total * 1024)
    })

    it('should generate source maps in production', () => {
      const sourceMaps = findBundles(/\.map$/)
      
      // Should have source maps for debugging
      expect(sourceMaps.length).toBeGreaterThan(0)

      // Source maps should be external files
      const jsChunks = findBundles(/\.js$/)
      for (const chunk of jsChunks) {
        const content = fs.readFileSync(chunk, 'utf8')
        expect(content).toMatch(/\/\/# sourceMappingURL=.*\.map$/)
      }
    })
  })

  describe('Bundle Analysis', () => {
    it('should track bundle size over time', async () => {
      const statsFile = path.join(distPath, 'bundle-stats.json')
      const chunks = findBundles(/\.js$/)
      
      const bundleStats: Record<string, any> = {}
      
      for (const chunk of chunks) {
        const chunkName = path.basename(chunk)
        const content = fs.readFileSync(chunk, 'utf8')
        const { raw, gzipped } = await getActualBundleSize(content)
        
        bundleStats[chunkName] = {
          raw,
          gzipped,
          rawKB: (raw / 1024).toFixed(2),
          gzippedKB: (gzipped / 1024).toFixed(2)
        }
      }

      // Save stats for tracking
      fs.writeFileSync(statsFile, JSON.stringify(bundleStats, null, 2))
      
      // Log summary
      console.log('\nBundle Size Summary:')
      console.log('===================')
      Object.entries(bundleStats).forEach(([name, stats]) => {
        console.log(`${name}: ${stats.rawKB}KB (${stats.gzippedKB}KB gzipped)`)
      })
    })

    it('should not exceed total bundle size budget', async () => {
      const chunks = findBundles(/\.(js|css)$/)
      let totalRaw = 0
      let totalGzipped = 0

      for (const chunk of chunks) {
        const content = fs.readFileSync(chunk, 'utf8')
        const { raw, gzipped } = await getActualBundleSize(content)
        totalRaw += raw
        totalGzipped += gzipped
      }

      // Total budget: 2MB raw, 600KB gzipped
      expect(totalRaw).toBeLessThan(2 * 1024 * 1024)
      expect(totalGzipped).toBeLessThan(600 * 1024)
    })
  })

  // Helper functions
  function findBundle(pattern: string, extension: string): string | null {
    if (!fs.existsSync(assetsPath)) {
      return null
    }

    const files = fs.readdirSync(assetsPath)
    const bundle = files.find(file => 
      file.includes(pattern) && file.endsWith(extension)
    )

    return bundle ? path.join(assetsPath, bundle) : null
  }

  function findBundles(pattern: RegExp): string[] {
    if (!fs.existsSync(assetsPath)) {
      return []
    }

    const files = fs.readdirSync(assetsPath)
    return files
      .filter(file => pattern.test(file))
      .map(file => path.join(assetsPath, file))
  }

  function findAssets(pattern: RegExp): string[] {
    if (!fs.existsSync(assetsPath)) {
      return []
    }

    const assets: string[] = []
    
    function walk(dir: string) {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        
        if (stat.isDirectory()) {
          walk(filePath)
        } else if (pattern.test(file)) {
          assets.push(filePath)
        }
      }
    }

    walk(assetsPath)
    return assets
  }

  async function getActualBundleSize(content: string): Promise<{
    raw: number
    gzipped: number
  }> {
    const raw = Buffer.byteLength(content, 'utf8')
    const compressed = await gzipAsync(content)
    const gzipped = compressed.length

    return { raw, gzipped }
  }
})