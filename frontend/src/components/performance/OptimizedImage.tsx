import React, { memo, useState, useEffect, useRef } from 'react'
import { useLazyLoad, useProgressiveEnhancement } from '@/hooks/useOptimization'

/**
 * Optimized image component with lazy loading, progressive enhancement,
 * and multiple format support
 */

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  className?: string
  priority?: boolean
  placeholder?: 'blur' | 'empty' | 'shimmer'
  blurDataURL?: string
  sizes?: string
  srcSet?: string
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
  onError?: () => void
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
  quality?: number
  formats?: Array<'webp' | 'avif' | 'jpeg' | 'png'>
  fadeIn?: boolean
  aspectRatio?: string
}

// Placeholder components
const ImagePlaceholder = memo(({ 
  type, 
  blurDataURL,
  aspectRatio 
}: { 
  type: 'blur' | 'empty' | 'shimmer'
  blurDataURL?: string
  aspectRatio?: string
}) => {
  const paddingBottom = aspectRatio 
    ? `${(1 / parseFloat(aspectRatio)) * 100}%` 
    : '56.25%' // 16:9 default
  
  if (type === 'blur' && blurDataURL) {
    return (
      <div className="relative overflow-hidden" style={{ paddingBottom }}>
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
        />
      </div>
    )
  }
  
  if (type === 'shimmer') {
    return (
      <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-700" style={{ paddingBottom }}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>
    )
  }
  
  return (
    <div className="relative bg-gray-200 dark:bg-gray-700" style={{ paddingBottom }} />
  )
})

// Error state component
const ImageError = memo(({ alt }: { alt: string }) => (
  <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 p-4 rounded">
    <svg
      className="w-12 h-12"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    <span className="ml-2 text-sm">{alt}</span>
  </div>
))

// Main optimized image component
const OptimizedImageComponent: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  srcSet,
  loading = 'lazy',
  onLoad,
  onError,
  objectFit = 'cover',
  objectPosition = 'center',
  quality = 75,
  formats = ['webp', 'jpeg'],
  fadeIn = true,
  aspectRatio
}) => {
  const [imageRef, isIntersecting] = useLazyLoad<HTMLImageElement>({
    rootMargin: '50px',
    threshold: 0.01
  })
  
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [currentSrc, setCurrentSrc] = useState<string>('')
  const isEnhanced = useProgressiveEnhancement(100)
  
  // Determine if we should load the image
  const shouldLoad = priority || isIntersecting || loading === 'eager'
  
  // Handle image load
  const handleLoad = () => {
    setLoadState('loaded')
    onLoad?.()
  }
  
  // Handle image error with fallback
  const handleError = () => {
    setLoadState('error')
    onError?.()
  }
  
  // Generate optimized URLs based on format support
  const getOptimizedSrc = () => {
    // In production, this would integrate with an image optimization service
    // For now, we'll use the original src
    return src
  }
  
  // Set current source when should load
  useEffect(() => {
    if (shouldLoad && !currentSrc) {
      setCurrentSrc(getOptimizedSrc())
    }
  }, [shouldLoad, currentSrc])
  
  // Picture element for multiple formats
  const renderPicture = () => {
    if (!isEnhanced || formats.length <= 1) {
      return (
        <img
          ref={imageRef}
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          srcSet={srcSet}
          loading={priority ? 'eager' : loading}
          onLoad={handleLoad}
          onError={handleError}
          className={`
            ${fadeIn && loadState === 'loading' ? 'opacity-0' : 'opacity-100'}
            ${fadeIn ? 'transition-opacity duration-300' : ''}
            ${className}
          `}
          style={{
            objectFit,
            objectPosition
          }}
        />
      )
    }
    
    return (
      <picture>
        {formats.slice(0, -1).map(format => (
          <source
            key={format}
            type={`image/${format}`}
            srcSet={`${src}?format=${format}&quality=${quality}`}
            sizes={sizes}
          />
        ))}
        <img
          ref={imageRef}
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          srcSet={srcSet}
          loading={priority ? 'eager' : loading}
          onLoad={handleLoad}
          onError={handleError}
          className={`
            ${fadeIn && loadState === 'loading' ? 'opacity-0' : 'opacity-100'}
            ${fadeIn ? 'transition-opacity duration-300' : ''}
            ${className}
          `}
          style={{
            objectFit,
            objectPosition
          }}
        />
      </picture>
    )
  }
  
  // Container styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width,
    height,
    ...(aspectRatio && !height ? { aspectRatio } : {})
  }
  
  return (
    <div style={containerStyle} className={`optimized-image-container ${className}`}>
      {/* Placeholder */}
      {loadState === 'loading' && placeholder !== 'empty' && (
        <div className="absolute inset-0">
          <ImagePlaceholder 
            type={placeholder} 
            blurDataURL={blurDataURL}
            aspectRatio={aspectRatio}
          />
        </div>
      )}
      
      {/* Error state */}
      {loadState === 'error' && <ImageError alt={alt} />}
      
      {/* Image */}
      {(shouldLoad || currentSrc) && loadState !== 'error' && renderPicture()}
    </div>
  )
}

// Export memoized component
export const OptimizedImage = memo(OptimizedImageComponent)

// Preload utility for critical images
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

// Hook for responsive images
export function useResponsiveImage(
  baseSrc: string,
  sizes: { [breakpoint: string]: number }
) {
  const [currentSrc, setCurrentSrc] = useState(baseSrc)
  
  useEffect(() => {
    const updateSrc = () => {
      const width = window.innerWidth
      let selectedSize = 0
      
      // Find the best size for current viewport
      Object.entries(sizes).forEach(([breakpoint, size]) => {
        const bp = parseInt(breakpoint)
        if (width >= bp && size > selectedSize) {
          selectedSize = size
        }
      })
      
      if (selectedSize > 0) {
        setCurrentSrc(`${baseSrc}?w=${selectedSize}`)
      }
    }
    
    updateSrc()
    window.addEventListener('resize', updateSrc)
    return () => window.removeEventListener('resize', updateSrc)
  }, [baseSrc, sizes])
  
  return currentSrc
}

// Add shimmer animation to global styles
const shimmerStyles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.innerHTML = shimmerStyles
  document.head.appendChild(styleElement)
}