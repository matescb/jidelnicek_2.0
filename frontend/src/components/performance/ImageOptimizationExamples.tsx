import React, { useEffect, useState } from 'react'
import { LazyImage } from './LazyImage'
import { ResponsivePicture, PicturePresets } from './ResponsivePicture'
import { 
  useImagePreloader, 
  useAdaptiveImage, 
  useProgressiveImage,
  useImageFormats 
} from '@/hooks/useLazyLoading'
import { configureCDN, preloadImages } from '@/utils/imageOptimization'

/**
 * Example usage of image optimization components and utilities
 */

// Configure CDN (do this once in your app initialization)
configureCDN({
  baseUrl: 'https://cdn.example.com',
  transformEndpoint: '/img',
  queryParams: {
    auto: 'format',
    cs: 'tinysrgb'
  }
})

export function BasicLazyImageExample() {
  return (
    <div className="space-y-4">
      <h3>Basic Lazy Loading</h3>
      
      {/* Simple lazy loading with shimmer placeholder */}
      <LazyImage
        src="/images/recipe-1.jpg"
        alt="Delicious recipe"
        width={400}
        height={300}
        placeholder="shimmer"
      />

      {/* Lazy loading with blur placeholder */}
      <LazyImage
        src="/images/recipe-2.jpg"
        alt="Another recipe"
        width={400}
        height={300}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
      />

      {/* Priority image (loads immediately) */}
      <LazyImage
        src="/images/hero-banner.jpg"
        alt="Hero banner"
        width="100%"
        height={400}
        priority={true}
        placeholder="color"
        placeholderColor="#e5e7eb"
      />
    </div>
  )
}

export function ResponsivePictureExample() {
  return (
    <div className="space-y-4">
      <h3>Responsive Picture Element</h3>
      
      {/* Basic responsive picture */}
      <ResponsivePicture
        src="/images/landscape.jpg"
        alt="Beautiful landscape"
        widths={[320, 640, 960, 1280, 1920]}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 720px"
        formats={['avif', 'webp', 'jpeg']}
      />

      {/* Art direction - different images for different viewports */}
      <ResponsivePicture
        src="/images/hero-desktop.jpg"
        alt="Hero image"
        sources={[
          {
            media: "(max-width: 640px)",
            srcSet: "/images/hero-mobile.jpg 1x, /images/hero-mobile@2x.jpg 2x"
          },
          {
            media: "(max-width: 1024px)",
            srcSet: "/images/hero-tablet.jpg 1x, /images/hero-tablet@2x.jpg 2x"
          }
        ]}
        priority={true}
      />

      {/* Using presets */}
      <ResponsivePicture {...PicturePresets.hero("/images/hero.jpg", "Hero image")} />
      <ResponsivePicture {...PicturePresets.thumbnail("/images/thumb.jpg", "Thumbnail")} />
      <ResponsivePicture {...PicturePresets.article("/images/article.jpg", "Article image")} />
    </div>
  )
}

export function PreloadingExample() {
  const { isLoading, progress, errors } = useImagePreloader({
    urls: [
      '/images/gallery-1.jpg',
      '/images/gallery-2.jpg',
      '/images/gallery-3.jpg',
      '/images/gallery-4.jpg'
    ],
    onProgress: (loaded, total) => {
      console.log(`Loaded ${loaded} of ${total} images`)
    },
    onComplete: () => {
      console.log('All images preloaded!')
    }
  })

  return (
    <div className="space-y-4">
      <h3>Image Preloading</h3>
      
      {isLoading && (
        <div className="space-y-2">
          <p>Loading images: {Math.round(progress * 100)}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="text-red-600">
          Failed to load {errors.length} images
        </div>
      )}

      {!isLoading && errors.length === 0 && (
        <div className="grid grid-cols-2 gap-4">
          <LazyImage src="/images/gallery-1.jpg" alt="Gallery 1" />
          <LazyImage src="/images/gallery-2.jpg" alt="Gallery 2" />
          <LazyImage src="/images/gallery-3.jpg" alt="Gallery 3" />
          <LazyImage src="/images/gallery-4.jpg" alt="Gallery 4" />
        </div>
      )}
    </div>
  )
}

export function AdaptiveLoadingExample() {
  const { adaptiveSrc, connectionType, isOnline } = useAdaptiveImage({
    src: '/images/high-res.jpg',
    lowQualitySrc: '/images/low-res.jpg',
    sizes: { mobile: 640, tablet: 1024, desktop: 1920 },
    quality: { slow: 40, medium: 70, fast: 90 }
  })

  return (
    <div className="space-y-4">
      <h3>Adaptive Loading</h3>
      
      <div className="text-sm text-gray-600">
        <p>Connection: {connectionType} | Online: {isOnline ? 'Yes' : 'No'}</p>
      </div>

      <LazyImage
        src={adaptiveSrc}
        alt="Adaptive image"
        width="100%"
        height={400}
        placeholder="shimmer"
      />
    </div>
  )
}

export function ProgressiveImageExample() {
  const { src, isLoading, containerRef } = useProgressiveImage({
    lowQualitySrc: '/images/placeholder.jpg',
    highQualitySrc: '/images/full-quality.jpg'
  })

  return (
    <div ref={containerRef} className="relative">
      <h3>Progressive Image Loading</h3>
      
      <div className={`relative ${isLoading ? 'blur-sm' : ''} transition-all`}>
        <img
          src={src}
          alt="Progressive loading"
          className="w-full h-auto"
        />
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  )
}

export function FormatDetectionExample() {
  const { supportedFormats, supportsWebP, supportsAvif } = useImageFormats()

  return (
    <div className="space-y-4">
      <h3>Image Format Support</h3>
      
      <div className="space-y-2 text-sm">
        <p>Supported formats: {supportedFormats.join(', ')}</p>
        <p>WebP support: {supportsWebP ? '✅' : '❌'}</p>
        <p>AVIF support: {supportsAvif ? '✅' : '❌'}</p>
      </div>

      <ResponsivePicture
        src="/images/test.jpg"
        alt="Format test"
        formats={supportedFormats}
        width={400}
        height={300}
      />
    </div>
  )
}

export function RecipeCardWithLazyImage() {
  return (
    <div className="max-w-sm rounded-lg overflow-hidden shadow-lg">
      <LazyImage
        src="/api/images/recipes/pasta-carbonara.jpg"
        alt="Pasta Carbonara"
        width="100%"
        height={200}
        className="w-full h-48 object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
        placeholder="shimmer"
        quality={75}
        formats={['webp', 'jpeg']}
        onLoad={() => console.log('Recipe image loaded')}
        onError={(error) => console.error('Failed to load recipe image:', error)}
      />
      
      <div className="p-4">
        <h3 className="font-bold text-xl mb-2">Pasta Carbonara</h3>
        <p className="text-gray-700 text-base">
          Classic Italian pasta dish with eggs, cheese, and pancetta.
        </p>
      </div>
    </div>
  )
}

export function CriticalImagesExample() {
  useEffect(() => {
    // Preload critical images on component mount
    const criticalImages = [
      '/images/logo.png',
      '/images/hero-banner.jpg',
      '/images/featured-recipe.jpg'
    ]

    preloadImages(criticalImages).then(() => {
      console.log('Critical images preloaded')
    })
  }, [])

  return (
    <div className="space-y-4">
      <h3>Critical Images (Preloaded)</h3>
      
      {/* These images are already preloaded */}
      <LazyImage
        src="/images/logo.png"
        alt="Logo"
        width={200}
        height={60}
        priority={true}
      />
      
      <LazyImage
        src="/images/hero-banner.jpg"
        alt="Hero"
        width="100%"
        height={400}
        priority={true}
      />
    </div>
  )
}