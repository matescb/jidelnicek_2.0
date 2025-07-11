import React, { useState, useEffect, useRef, memo } from 'react'
import { BrokenImage } from 'lucide-react'

interface LazyImageProps {
  src: string
  srcSet?: string
  sizes?: string
  alt: string
  width?: number | string
  height?: number | string
  className?: string
  style?: React.CSSProperties
  // Loading options
  loading?: 'lazy' | 'eager' | 'auto'
  threshold?: number
  rootMargin?: string
  // Enhancement options
  placeholder?: 'blur' | 'shimmer' | 'color' | 'none'
  placeholderSrc?: string
  placeholderColor?: string
  blurDataURL?: string
  // Formats
  formats?: string[]
  quality?: number
  // Behavior
  onLoad?: () => void
  onError?: (error: Error) => void
  onInView?: () => void
  retry?: boolean
  retryCount?: number
  retryDelay?: number
  // Optimization
  priority?: boolean
  decoding?: 'async' | 'sync' | 'auto'
  fetchPriority?: 'high' | 'low' | 'auto'
  // ARIA
  role?: string
  ariaLabel?: string
}

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

const LazyImageComponent: React.FC<LazyImageProps> = ({
  src,
  srcSet,
  sizes,
  alt,
  width,
  height,
  className = '',
  style,
  loading = 'lazy',
  threshold = 0.1,
  rootMargin = '50px',
  placeholder = 'shimmer',
  placeholderSrc,
  placeholderColor = '#f3f4f6',
  blurDataURL,
  formats = ['webp', 'jpeg'],
  quality = 75,
  onLoad,
  onError,
  onInView,
  retry = true,
  retryCount = 3,
  retryDelay = 1000,
  priority = false,
  decoding = 'async',
  fetchPriority = 'auto',
  role = 'img',
  ariaLabel,
}) => {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [currentSrc, setCurrentSrc] = useState<string>('')
  const [retries, setRetries] = useState(0)
  const imageRef = useRef<HTMLImageElement>(null)
  const pictureRef = useRef<HTMLPictureElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout>()

  // Check if browser supports Intersection Observer
  const hasIOSupport = typeof window !== 'undefined' && 'IntersectionObserver' in window

  // Check if native lazy loading is supported
  const hasNativeLazyLoading = typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype

  // Determine if we should use native lazy loading
  const useNativeLazy = loading === 'lazy' && hasNativeLazyLoading && !priority

  // Handle image load success
  const handleLoad = () => {
    setLoadingState('loaded')
    onLoad?.()
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
    }
  }

  // Handle image load error with retry logic
  const handleError = (error?: Event) => {
    if (retry && retries < retryCount) {
      loadTimeoutRef.current = setTimeout(() => {
        setRetries(prev => prev + 1)
        setLoadingState('loading')
        setCurrentSrc(`${src}?retry=${retries + 1}`)
      }, retryDelay * (retries + 1))
    } else {
      setLoadingState('error')
      onError?.(new Error(`Failed to load image: ${src}`))
    }
  }

  // Set up Intersection Observer
  useEffect(() => {
    if (useNativeLazy || priority || loading === 'eager') {
      setCurrentSrc(src)
      setLoadingState('loading')
      return
    }

    if (!hasIOSupport) {
      // Fallback for browsers without IO support
      setCurrentSrc(src)
      setLoadingState('loading')
      return
    }

    const element = pictureRef.current || imageRef.current
    if (!element) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setCurrentSrc(src)
            setLoadingState('loading')
            onInView?.()
            observerRef.current?.unobserve(element)
          }
        })
      },
      {
        threshold,
        rootMargin
      }
    )

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current && element) {
        observerRef.current.unobserve(element)
      }
    }
  }, [src, useNativeLazy, priority, loading, hasIOSupport, threshold, rootMargin, onInView])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  // Generate placeholder based on type
  const renderPlaceholder = () => {
    if (placeholder === 'none') return null

    const placeholderStyle: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      ...style
    }

    switch (placeholder) {
      case 'blur':
        if (blurDataURL || placeholderSrc) {
          return (
            <img
              src={blurDataURL || placeholderSrc}
              alt=""
              aria-hidden="true"
              style={{
                ...placeholderStyle,
                filter: 'blur(20px)',
                transform: 'scale(1.1)'
              }}
              className={className}
            />
          )
        }
        return null

      case 'shimmer':
        return (
          <div
            aria-hidden="true"
            className={`animate-pulse ${className}`}
            style={{
              ...placeholderStyle,
              background: `linear-gradient(90deg, ${placeholderColor} 25%, rgba(255,255,255,0.3) 50%, ${placeholderColor} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite'
            }}
          />
        )

      case 'color':
        return (
          <div
            aria-hidden="true"
            style={{
              ...placeholderStyle,
              backgroundColor: placeholderColor
            }}
            className={className}
          />
        )

      default:
        return null
    }
  }

  // Render error state
  const renderError = () => (
    <div
      className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ width, height, ...style }}
      role={role}
      aria-label={ariaLabel || alt}
    >
      <div className="text-center p-4">
        <BrokenImage className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {alt || 'Image failed to load'}
        </p>
        {retry && retries < retryCount && (
          <button
            onClick={() => {
              setRetries(0)
              setLoadingState('loading')
              setCurrentSrc(src)
            }}
            className="mt-2 text-xs text-blue-500 hover:text-blue-600 underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )

  // Generate sources for picture element
  const generateSources = () => {
    if (!formats || formats.length <= 1) return null

    return formats.slice(0, -1).map(format => {
      const formatSrc = src.includes('?') 
        ? `${src}&format=${format}&quality=${quality}`
        : `${src}?format=${format}&quality=${quality}`

      return (
        <source
          key={format}
          type={`image/${format}`}
          srcSet={currentSrc ? formatSrc : undefined}
          sizes={sizes}
        />
      )
    })
  }

  // Container styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    overflow: 'hidden',
    width,
    height,
    ...style
  }

  // Image styles
  const imageStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: loadingState === 'loaded' ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out'
  }

  if (loadingState === 'error') {
    return renderError()
  }

  return (
    <div style={containerStyle} className="lazy-image-container">
      {/* Placeholder */}
      {loadingState !== 'loaded' && renderPlaceholder()}

      {/* Picture element for multiple formats */}
      {formats.length > 1 ? (
        <picture ref={pictureRef}>
          {generateSources()}
          <img
            ref={imageRef}
            src={currentSrc}
            srcSet={srcSet}
            sizes={sizes}
            alt={alt}
            width={width}
            height={height}
            loading={useNativeLazy ? 'lazy' : undefined}
            decoding={decoding}
            fetchpriority={priority ? 'high' : fetchPriority}
            onLoad={handleLoad}
            onError={handleError}
            style={imageStyle}
            className={className}
            role={role}
            aria-label={ariaLabel || alt}
          />
        </picture>
      ) : (
        <img
          ref={imageRef}
          src={currentSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={useNativeLazy ? 'lazy' : undefined}
          decoding={decoding}
          fetchpriority={priority ? 'high' : fetchPriority}
          onLoad={handleLoad}
          onError={handleError}
          style={imageStyle}
          className={className}
          role={role}
          aria-label={ariaLabel || alt}
        />
      )}
    </div>
  )
}

export const LazyImage = memo(LazyImageComponent)

// Add shimmer animation styles
if (typeof document !== 'undefined' && !document.getElementById('lazy-image-styles')) {
  const style = document.createElement('style')
  style.id = 'lazy-image-styles'
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `
  document.head.appendChild(style)
}