import React, { memo } from 'react'
import { LazyImage } from './LazyImage'
import { useResponsiveImage, useAdaptiveImage } from '@/hooks/useLazyLoading'
import { VIEWPORT_BREAKPOINTS } from '@/utils/imageOptimization'

interface ResponsivePictureProps {
  // Image sources
  src: string
  alt: string
  // Art direction - different images for different breakpoints
  sources?: Array<{
    media: string
    srcSet: string
    type?: string
    sizes?: string
  }>
  // Responsive sizing
  sizes?: string
  widths?: number[]
  // Formats
  formats?: string[]
  priority?: boolean
  // Layout
  width?: number | string
  height?: number | string
  aspectRatio?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
  className?: string
  style?: React.CSSProperties
  // Loading options
  loading?: 'lazy' | 'eager' | 'auto'
  placeholder?: 'blur' | 'shimmer' | 'color' | 'none'
  placeholderSrc?: string
  blurDataURL?: string
  // Behavior
  onLoad?: () => void
  onError?: (error: Error) => void
  // Optimization
  quality?: number
  adaptiveLoading?: boolean
  // Accessibility
  role?: string
  ariaLabel?: string
  // Additional attributes
  [key: string]: any
}

const ResponsivePictureComponent: React.FC<ResponsivePictureProps> = ({
  src,
  alt,
  sources: customSources,
  sizes,
  widths,
  formats = ['avif', 'webp', 'jpeg'],
  priority = false,
  width,
  height,
  aspectRatio,
  objectFit = 'cover',
  objectPosition = 'center',
  className,
  style,
  loading = 'lazy',
  placeholder = 'shimmer',
  placeholderSrc,
  blurDataURL,
  onLoad,
  onError,
  quality = 75,
  adaptiveLoading = true,
  role,
  ariaLabel,
  ...restProps
}) => {
  // Generate responsive image data
  const { sources: responsiveSources, imgSrcSet } = useResponsiveImage({
    src,
    widths,
    sizes,
    formats
  })

  // Use adaptive loading if enabled
  const { adaptiveSrc, connectionType } = useAdaptiveImage({
    src,
    lowQualitySrc: placeholderSrc,
    quality: {
      slow: 50,
      medium: quality,
      fast: 90
    }
  })

  // Determine final src based on adaptive loading
  const finalSrc = adaptiveLoading ? adaptiveSrc : src

  // Generate default sizes if not provided
  const defaultSizes = sizes || generateDefaultSizes()

  // Combine custom sources with responsive sources
  const allSources = [
    ...(customSources || []),
    ...responsiveSources.map(source => ({
      ...source,
      srcSet: source.srcSet,
      sizes: defaultSizes
    }))
  ]

  return (
    <picture className={`responsive-picture ${className || ''}`} style={style}>
      {/* Art direction sources */}
      {customSources?.map((source, index) => (
        <source
          key={`custom-${index}`}
          media={source.media}
          srcSet={source.srcSet}
          type={source.type}
          sizes={source.sizes || defaultSizes}
        />
      ))}

      {/* Format-specific sources */}
      {responsiveSources.map((source, index) => (
        <source
          key={`responsive-${index}`}
          type={source.type}
          srcSet={source.srcSet}
          sizes={defaultSizes}
        />
      ))}

      {/* Fallback image with lazy loading */}
      <LazyImage
        src={finalSrc}
        srcSet={imgSrcSet}
        sizes={defaultSizes}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={{
          objectFit,
          objectPosition,
          ...style
        }}
        loading={loading}
        priority={priority}
        placeholder={placeholder}
        placeholderSrc={placeholderSrc}
        blurDataURL={blurDataURL}
        quality={quality}
        onLoad={onLoad}
        onError={onError}
        role={role}
        ariaLabel={ariaLabel}
        {...restProps}
      />
    </picture>
  )
}

/**
 * Generate default sizes attribute based on common breakpoints
 */
function generateDefaultSizes(): string {
  return [
    `(max-width: ${VIEWPORT_BREAKPOINTS.mobile}px) 100vw`,
    `(max-width: ${VIEWPORT_BREAKPOINTS.tablet}px) 80vw`,
    `(max-width: ${VIEWPORT_BREAKPOINTS.desktop}px) 60vw`,
    `(max-width: ${VIEWPORT_BREAKPOINTS.wide}px) 50vw`,
    '40vw'
  ].join(', ')
}

export const ResponsivePicture = memo(ResponsivePictureComponent)

// Common responsive picture presets
export const PicturePresets = {
  // Hero image with art direction
  hero: (src: string, alt: string) => ({
    src,
    alt,
    sources: [
      {
        media: `(max-width: ${VIEWPORT_BREAKPOINTS.mobile}px)`,
        srcSet: `${src}?w=640&h=400&fit=cover 1x, ${src}?w=1280&h=800&fit=cover 2x`
      },
      {
        media: `(max-width: ${VIEWPORT_BREAKPOINTS.tablet}px)`,
        srcSet: `${src}?w=1024&h=576&fit=cover 1x, ${src}?w=2048&h=1152&fit=cover 2x`
      }
    ],
    widths: [1280, 1920, 2560, 3840],
    sizes: '100vw',
    priority: true,
    placeholder: 'blur' as const
  }),

  // Card thumbnail
  thumbnail: (src: string, alt: string) => ({
    src,
    alt,
    widths: [150, 300, 450, 600],
    sizes: [
      `(max-width: ${VIEWPORT_BREAKPOINTS.mobile}px) 50vw`,
      `(max-width: ${VIEWPORT_BREAKPOINTS.tablet}px) 33vw`,
      '25vw'
    ].join(', '),
    aspectRatio: '1:1',
    objectFit: 'cover' as const
  }),

  // Article image
  article: (src: string, alt: string) => ({
    src,
    alt,
    widths: [640, 960, 1280, 1920],
    sizes: [
      `(max-width: ${VIEWPORT_BREAKPOINTS.mobile}px) 100vw`,
      `(max-width: ${VIEWPORT_BREAKPOINTS.desktop}px) 80vw`,
      '720px'
    ].join(', '),
    placeholder: 'shimmer' as const
  }),

  // Gallery image
  gallery: (src: string, alt: string) => ({
    src,
    alt,
    widths: [320, 640, 960, 1280],
    sizes: [
      `(max-width: ${VIEWPORT_BREAKPOINTS.mobile}px) 100vw`,
      `(max-width: ${VIEWPORT_BREAKPOINTS.tablet}px) 50vw`,
      `(max-width: ${VIEWPORT_BREAKPOINTS.desktop}px) 33vw`,
      '25vw'
    ].join(', '),
    aspectRatio: '4:3',
    objectFit: 'cover' as const
  }),

  // Avatar
  avatar: (src: string, alt: string, size = 64) => ({
    src,
    alt,
    width: size,
    height: size,
    widths: [size, size * 1.5, size * 2, size * 3],
    sizes: `${size}px`,
    aspectRatio: '1:1',
    objectFit: 'cover' as const,
    className: 'rounded-full'
  }),

  // Background image
  background: (src: string, alt = '') => ({
    src,
    alt,
    widths: [640, 1280, 1920, 2560, 3840],
    sizes: '100vw',
    priority: true,
    placeholder: 'color' as const,
    className: 'absolute inset-0 w-full h-full',
    objectFit: 'cover' as const
  })
}

// Export a hook for using picture presets
export function usePicturePreset(
  preset: keyof typeof PicturePresets,
  src: string,
  alt: string,
  options?: any
) {
  return PicturePresets[preset](src, alt, options)
}