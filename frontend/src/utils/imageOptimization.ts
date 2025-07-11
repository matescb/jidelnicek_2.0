/**
 * Image optimization utilities for generating optimized URLs,
 * srcsets, and handling different image formats
 */

// Image size presets
export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320, height: 240 },
  medium: { width: 640, height: 480 },
  large: { width: 1024, height: 768 },
  xlarge: { width: 1920, height: 1080 },
  hero: { width: 2560, height: 1440 }
} as const

// Common aspect ratios
export const ASPECT_RATIOS = {
  square: '1:1',
  portrait: '3:4',
  landscape: '4:3',
  wide: '16:9',
  ultrawide: '21:9',
  golden: '1.618:1'
} as const

// Supported image formats
export const IMAGE_FORMATS = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml'
} as const

// Quality presets
export const QUALITY_PRESETS = {
  low: 60,
  medium: 75,
  high: 85,
  max: 95
} as const

// Device pixel ratio breakpoints
export const DPR_BREAKPOINTS = [1, 1.5, 2, 3]

// Viewport breakpoints (in pixels)
export const VIEWPORT_BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultrawide: 1536
} as const

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number
  format?: keyof typeof IMAGE_FORMATS
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
  dpr?: number
  progressive?: boolean
  sharpen?: boolean
  blur?: number
  grayscale?: boolean
  rotate?: number
  flip?: boolean
  flop?: boolean
}

export interface CDNConfig {
  baseUrl: string
  transformEndpoint?: string
  queryParams?: Record<string, string>
  signUrl?: (url: string) => string
}

// Default CDN configuration (can be overridden)
let cdnConfig: CDNConfig = {
  baseUrl: '',
  transformEndpoint: '/image',
  queryParams: {}
}

/**
 * Configure CDN settings
 */
export function configureCDN(config: Partial<CDNConfig>) {
  cdnConfig = { ...cdnConfig, ...config }
}

/**
 * Build optimized image URL with CDN transformations
 */
export function buildImageUrl(
  src: string,
  options: ImageOptimizationOptions = {}
): string {
  // If src is already a full URL, use it as is
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return addQueryParams(src, options)
  }

  // Build CDN URL
  const baseUrl = cdnConfig.baseUrl || ''
  const endpoint = cdnConfig.transformEndpoint || ''
  const url = `${baseUrl}${endpoint}/${src}`

  return addQueryParams(url, options)
}

/**
 * Add query parameters for image transformations
 */
function addQueryParams(url: string, options: ImageOptimizationOptions): string {
  const params = new URLSearchParams()

  // Add transformation parameters
  if (options.width) params.append('w', options.width.toString())
  if (options.height) params.append('h', options.height.toString())
  if (options.quality) params.append('q', options.quality.toString())
  if (options.format) params.append('fm', options.format)
  if (options.fit) params.append('fit', options.fit)
  if (options.dpr && options.dpr > 1) params.append('dpr', options.dpr.toString())
  if (options.progressive) params.append('progressive', 'true')
  if (options.sharpen) params.append('sharp', 'true')
  if (options.blur) params.append('blur', options.blur.toString())
  if (options.grayscale) params.append('gray', 'true')
  if (options.rotate) params.append('rot', options.rotate.toString())
  if (options.flip) params.append('flip', 'v')
  if (options.flop) params.append('flip', 'h')

  // Add custom CDN parameters
  Object.entries(cdnConfig.queryParams || {}).forEach(([key, value]) => {
    params.append(key, value)
  })

  // Combine with existing parameters
  const urlObj = new URL(url, window.location.origin)
  params.forEach((value, key) => {
    urlObj.searchParams.set(key, value)
  })

  const finalUrl = urlObj.href

  // Sign URL if configured
  return cdnConfig.signUrl ? cdnConfig.signUrl(finalUrl) : finalUrl
}

/**
 * Generate srcset string for responsive images
 */
export function generateSrcSet(
  src: string,
  widths: number[],
  options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
  return widths
    .map(width => {
      const url = buildImageUrl(src, { ...options, width })
      return `${url} ${width}w`
    })
    .join(', ')
}

/**
 * Generate srcset for different pixel densities
 */
export function generateDprSrcSet(
  src: string,
  baseWidth: number,
  dprs = DPR_BREAKPOINTS,
  options: Omit<ImageOptimizationOptions, 'width' | 'dpr'> = {}
): string {
  return dprs
    .map(dpr => {
      const url = buildImageUrl(src, {
        ...options,
        width: baseWidth * dpr,
        dpr
      })
      return `${url} ${dpr}x`
    })
    .join(', ')
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(
  breakpoints: { maxWidth?: number; size: string }[]
): string {
  return breakpoints
    .map(({ maxWidth, size }) => {
      if (maxWidth) {
        return `(max-width: ${maxWidth}px) ${size}`
      }
      return size
    })
    .join(', ')
}

/**
 * Detect supported image formats
 */
export function detectSupportedFormats(): Promise<string[]> {
  const formats = ['webp', 'avif']
  const supported: string[] = []

  const checks = formats.map(format => {
    return new Promise<void>(resolve => {
      const img = new Image()
      img.onload = () => {
        supported.push(format)
        resolve()
      }
      img.onerror = () => resolve()

      // Test images for format support
      const testImages: Record<string, string> = {
        webp: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
        avif: 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAPBtZXRhAAAAAAAAAChoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAbGliYXZpZgAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAEUAAAAJgAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABoaXBycAAAAElpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAOcGl4aQAAAAABCAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI='
      }

      img.src = testImages[format] || ''
    })
  })

  await Promise.all(checks)
  
  // Always support JPEG/PNG as fallback
  supported.push('jpeg', 'png')
  
  return supported
}

/**
 * Generate placeholder data URL for blur effect
 */
export function generatePlaceholder(
  width = 10,
  height = 10,
  color = '#f3f4f6'
): string {
  if (typeof window === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)

  return canvas.toDataURL('image/jpeg', 0.5)
}

/**
 * Generate low quality image placeholder (LQIP)
 */
export async function generateLQIP(
  src: string,
  width = 20,
  height = 20
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Draw scaled down image
      ctx.drawImage(img, 0, 0, width, height)

      // Apply slight blur
      ctx.filter = 'blur(2px)'
      ctx.drawImage(canvas, 0, 0)

      resolve(canvas.toDataURL('image/jpeg', 0.4))
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * Calculate optimal image dimensions based on container and aspect ratio
 */
export function calculateImageDimensions(
  containerWidth: number,
  containerHeight: number,
  imageAspectRatio: number,
  fit: 'contain' | 'cover' = 'cover'
): { width: number; height: number } {
  const containerAspectRatio = containerWidth / containerHeight

  if (fit === 'cover') {
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider, fit by height
      return {
        width: Math.round(containerHeight * imageAspectRatio),
        height: containerHeight
      }
    } else {
      // Image is taller, fit by width
      return {
        width: containerWidth,
        height: Math.round(containerWidth / imageAspectRatio)
      }
    }
  } else {
    // contain
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider, fit by width
      return {
        width: containerWidth,
        height: Math.round(containerWidth / imageAspectRatio)
      }
    } else {
      // Image is taller, fit by height
      return {
        width: Math.round(containerHeight * imageAspectRatio),
        height: containerHeight
      }
    }
  }
}

/**
 * Preload image with progress tracking
 */
export function preloadImage(
  src: string,
  onProgress?: (progress: number) => void
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    if (onProgress && 'onprogress' in new XMLHttpRequest()) {
      // Use XHR for progress tracking
      const xhr = new XMLHttpRequest()
      xhr.open('GET', src, true)
      xhr.responseType = 'blob'

      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total)
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response
          const url = URL.createObjectURL(blob)
          img.onload = () => {
            URL.revokeObjectURL(url)
            resolve(img)
          }
          img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Failed to load image'))
          }
          img.src = url
        } else {
          reject(new Error(`HTTP ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send()
    } else {
      // Simple image loading
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = src
    }
  })
}

/**
 * Batch preload multiple images
 */
export async function preloadImages(
  urls: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<HTMLImageElement[]> {
  let loaded = 0
  const total = urls.length

  const promises = urls.map(async (url) => {
    const img = await preloadImage(url)
    loaded++
    onProgress?.(loaded, total)
    return img
  })

  return Promise.all(promises)
}

/**
 * Get optimal image format based on browser support
 */
export async function getOptimalFormat(
  preferredFormats = ['avif', 'webp', 'jpeg']
): Promise<string> {
  const supported = await detectSupportedFormats()
  
  for (const format of preferredFormats) {
    if (supported.includes(format)) {
      return format
    }
  }

  return 'jpeg' // Fallback
}