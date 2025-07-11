import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { 
  preloadImage, 
  preloadImages, 
  generateLQIP,
  detectSupportedFormats,
  buildImageUrl,
  ImageOptimizationOptions
} from '@/utils/imageOptimization'

/**
 * Intersection Observer hook for viewport detection
 */
export function useIntersectionObserver<T extends HTMLElement>(
  options?: IntersectionObserverInit,
  triggerOnce = true
): [React.RefObject<T>, boolean, IntersectionObserverEntry | undefined] {
  const targetRef = useRef<T>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry>()
  const observerRef = useRef<IntersectionObserver>()

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    // Check for IntersectionObserver support
    if (!('IntersectionObserver' in window)) {
      setIsIntersecting(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        setEntry(entry)
        setIsIntersecting(entry.isIntersecting)

        if (triggerOnce && entry.isIntersecting && observerRef.current) {
          observerRef.current.unobserve(target)
          observerRef.current.disconnect()
        }
      },
      options
    )

    observerRef.current = observer
    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [options?.threshold, options?.root, options?.rootMargin, triggerOnce])

  return [targetRef, isIntersecting, entry]
}

/**
 * Lazy image loading hook with progressive enhancement
 */
interface UseLazyImageOptions {
  src: string
  srcSet?: string
  sizes?: string
  placeholder?: string
  generatePlaceholder?: boolean
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
  onLoad?: () => void
  onError?: (error: Error) => void
}

interface UseLazyImageReturn {
  imgRef: React.RefObject<HTMLImageElement>
  imgSrc: string
  imgSrcSet?: string
  isLoaded: boolean
  isError: boolean
  isInView: boolean
  placeholder?: string
  retry: () => void
}

export function useLazyImage({
  src,
  srcSet,
  sizes,
  placeholder,
  generatePlaceholder = false,
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
  onLoad,
  onError
}: UseLazyImageOptions): UseLazyImageReturn {
  const [imgRef, isInView] = useIntersectionObserver<HTMLImageElement>(
    { threshold, rootMargin },
    triggerOnce
  )
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [imgSrc, setImgSrc] = useState('')
  const [imgSrcSet, setImgSrcSet] = useState<string>()
  const [placeholderUrl, setPlaceholderUrl] = useState(placeholder)
  const retryCountRef = useRef(0)

  // Generate placeholder if needed
  useEffect(() => {
    if (generatePlaceholder && !placeholder) {
      generateLQIP(src, 20, 20)
        .then(setPlaceholderUrl)
        .catch(() => {
          // Fallback to default placeholder
          setPlaceholderUrl('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20"%3E%3Crect width="20" height="20" fill="%23f3f4f6"/%3E%3C/svg%3E')
        })
    }
  }, [src, generatePlaceholder, placeholder])

  // Load image when in view
  useEffect(() => {
    if (!isInView || isLoaded || isError) return

    const img = new Image()
    
    img.onload = () => {
      setIsLoaded(true)
      setImgSrc(src)
      setImgSrcSet(srcSet)
      onLoad?.()
    }

    img.onerror = () => {
      setIsError(true)
      onError?.(new Error(`Failed to load image: ${src}`))
    }

    // Set sources
    img.src = src
    if (srcSet) {
      img.srcset = srcSet
    }
    if (sizes) {
      img.sizes = sizes
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [isInView, isLoaded, isError, src, srcSet, sizes, onLoad, onError])

  // Retry function
  const retry = useCallback(() => {
    retryCountRef.current += 1
    setIsError(false)
    setIsLoaded(false)
    // Force re-trigger by adding cache buster
    const cacheBuster = `?retry=${retryCountRef.current}&t=${Date.now()}`
    setImgSrc(src + cacheBuster)
  }, [src])

  return {
    imgRef,
    imgSrc: isLoaded ? imgSrc : '',
    imgSrcSet: isLoaded ? imgSrcSet : undefined,
    isLoaded,
    isError,
    isInView,
    placeholder: placeholderUrl,
    retry
  }
}

/**
 * Progressive image loading hook
 */
interface UseProgressiveImageOptions {
  lowQualitySrc: string
  highQualitySrc: string
  threshold?: number
  rootMargin?: string
}

export function useProgressiveImage({
  lowQualitySrc,
  highQualitySrc,
  threshold = 0.1,
  rootMargin = '50px'
}: UseProgressiveImageOptions): {
  src: string
  isLoading: boolean
  containerRef: React.RefObject<HTMLDivElement>
} {
  const [containerRef, isInView] = useIntersectionObserver<HTMLDivElement>(
    { threshold, rootMargin }
  )
  const [src, setSrc] = useState(lowQualitySrc)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isInView) return

    const img = new Image()
    
    img.onload = () => {
      setSrc(highQualitySrc)
      setIsLoading(false)
    }

    img.src = highQualitySrc

    return () => {
      img.onload = null
    }
  }, [isInView, highQualitySrc])

  return { src, isLoading, containerRef }
}

/**
 * Image preloader hook for critical images
 */
interface UseImagePreloaderOptions {
  urls: string[]
  sequential?: boolean
  onProgress?: (loaded: number, total: number) => void
  onComplete?: () => void
  onError?: (errors: Error[]) => void
}

export function useImagePreloader({
  urls,
  sequential = false,
  onProgress,
  onComplete,
  onError
}: UseImagePreloaderOptions): {
  isLoading: boolean
  progress: number
  errors: Error[]
  retry: () => void
} {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState<Error[]>([])

  const preload = useCallback(async () => {
    setIsLoading(true)
    setProgress(0)
    setErrors([])

    const errorList: Error[] = []
    let loaded = 0

    const handleProgress = () => {
      loaded++
      const progressValue = loaded / urls.length
      setProgress(progressValue)
      onProgress?.(loaded, urls.length)
    }

    try {
      if (sequential) {
        // Load images one by one
        for (const url of urls) {
          try {
            await preloadImage(url)
            handleProgress()
          } catch (error) {
            errorList.push(error as Error)
            handleProgress()
          }
        }
      } else {
        // Load images in parallel
        await preloadImages(urls, (loaded, total) => {
          const progressValue = loaded / total
          setProgress(progressValue)
          onProgress?.(loaded, total)
        }).catch((error) => {
          errorList.push(error)
        })
      }

      if (errorList.length > 0) {
        setErrors(errorList)
        onError?.(errorList)
      } else {
        onComplete?.()
      }
    } finally {
      setIsLoading(false)
    }
  }, [urls, sequential, onProgress, onComplete, onError])

  useEffect(() => {
    if (urls.length > 0) {
      preload()
    }
  }, []) // Only run on mount

  return {
    isLoading,
    progress,
    errors,
    retry: preload
  }
}

/**
 * Adaptive image loading based on connection speed
 */
interface UseAdaptiveImageOptions {
  src: string
  lowQualitySrc?: string
  sizes?: Record<string, number>
  quality?: Record<'slow' | 'medium' | 'fast', number>
}

export function useAdaptiveImage({
  src,
  lowQualitySrc,
  sizes = { mobile: 640, tablet: 1024, desktop: 1920 },
  quality = { slow: 50, medium: 70, fast: 85 }
}: UseAdaptiveImageOptions): {
  adaptiveSrc: string
  connectionType: 'slow' | 'medium' | 'fast'
  isOnline: boolean
} {
  const [connectionType, setConnectionType] = useState<'slow' | 'medium' | 'fast'>('medium')
  const [isOnline, setIsOnline] = useState(true)
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  // Monitor connection
  useEffect(() => {
    const updateConnection = () => {
      setIsOnline(navigator.onLine)

      // Check Network Information API
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection

      if (connection) {
        const effectiveType = connection.effectiveType
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          setConnectionType('slow')
        } else if (effectiveType === '3g') {
          setConnectionType('medium')
        } else {
          setConnectionType('fast')
        }
      }
    }

    updateConnection()

    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)

    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', updateConnection)
    }

    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      if ((navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', updateConnection)
      }
    }
  }, [])

  // Monitor screen size
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate adaptive source
  const adaptiveSrc = useMemo(() => {
    if (!isOnline && lowQualitySrc) {
      return lowQualitySrc
    }

    // Determine size based on screen width
    let targetWidth = sizes.desktop
    if (screenWidth <= 640) {
      targetWidth = sizes.mobile
    } else if (screenWidth <= 1024) {
      targetWidth = sizes.tablet
    }

    // Build optimized URL
    const options: ImageOptimizationOptions = {
      width: targetWidth,
      quality: quality[connectionType]
    }

    return buildImageUrl(src, options)
  }, [src, lowQualitySrc, isOnline, screenWidth, connectionType, sizes, quality])

  return {
    adaptiveSrc,
    connectionType,
    isOnline
  }
}

/**
 * Image format detection hook
 */
export function useImageFormats(): {
  supportedFormats: string[]
  isLoading: boolean
  supportsWebP: boolean
  supportsAvif: boolean
} {
  const [supportedFormats, setSupportedFormats] = useState<string[]>(['jpeg', 'png'])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    detectSupportedFormats()
      .then(setSupportedFormats)
      .finally(() => setIsLoading(false))
  }, [])

  return {
    supportedFormats,
    isLoading,
    supportsWebP: supportedFormats.includes('webp'),
    supportsAvif: supportedFormats.includes('avif')
  }
}

/**
 * Responsive image hook with automatic srcset generation
 */
interface UseResponsiveImageOptions {
  src: string
  widths?: number[]
  sizes?: string
  formats?: string[]
}

export function useResponsiveImage({
  src,
  widths = [320, 640, 960, 1280, 1920],
  sizes = '100vw',
  formats = ['webp', 'jpeg']
}: UseResponsiveImageOptions): {
  sources: Array<{ type: string; srcSet: string }>
  imgSrc: string
  imgSrcSet: string
  sizes: string
} {
  const { supportedFormats } = useImageFormats()

  const sources = useMemo(() => {
    const validFormats = formats.filter(format => 
      supportedFormats.includes(format) && format !== 'jpeg' && format !== 'jpg'
    )

    return validFormats.map(format => ({
      type: `image/${format}`,
      srcSet: widths
        .map(width => {
          const url = buildImageUrl(src, { width, format: format as any })
          return `${url} ${width}w`
        })
        .join(', ')
    }))
  }, [src, widths, formats, supportedFormats])

  const imgSrcSet = useMemo(() => {
    return widths
      .map(width => {
        const url = buildImageUrl(src, { width })
        return `${url} ${width}w`
      })
      .join(', ')
  }, [src, widths])

  return {
    sources,
    imgSrc: src,
    imgSrcSet,
    sizes
  }
}