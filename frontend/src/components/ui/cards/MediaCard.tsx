import React from 'react'
import { Card, CardContent, CardImage } from '../card'
import { Badge } from '../badge'
import { cn } from '@/lib/utils'
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface MediaCardProps {
  type: 'image' | 'video' | 'audio'
  src: string
  thumbnail?: string
  title?: string
  description?: string
  duration?: string
  author?: {
    name: string
    avatar?: string
  }
  tags?: string[]
  views?: number
  date?: string
  variant?: 'default' | 'horizontal' | 'overlay'
  size?: 'sm' | 'md' | 'lg'
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  onPlay?: () => void
  onDownload?: () => void
  onShare?: () => void
  onClick?: () => void
  loading?: boolean
  className?: string
}

export const MediaCard: React.FC<MediaCardProps> = ({
  type,
  src,
  thumbnail,
  title,
  description,
  duration,
  author,
  tags,
  views,
  date,
  variant = 'default',
  size = 'md',
  autoPlay = false,
  muted = true,
  controls = true,
  onPlay,
  onDownload,
  onShare,
  onClick,
  loading = false,
  className
}) => {
  const [isPlaying, setIsPlaying] = React.useState(autoPlay)
  const [isMuted, setIsMuted] = React.useState(muted)
  const [showControls, setShowControls] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  }

  const handlePlayPause = () => {
    if (type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
    onPlay?.()
  }

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const formatViews = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (variant === 'horizontal') {
    return (
      <Card
        interactive="hover"
        loading={loading}
        className={cn('flex', sizeClasses[size], className)}
        onClick={onClick}
      >
        <div className="relative w-1/3 aspect-video">
          {type === 'image' ? (
            <img src={src} alt={title} className="w-full h-full object-cover rounded-l-lg" />
          ) : (
            <div className="relative w-full h-full">
              <img src={thumbnail || src} alt={title} className="w-full h-full object-cover rounded-l-lg" />
              {duration && (
                <Badge className="absolute bottom-2 right-2 bg-black/70 text-white">
                  {duration}
                </Badge>
              )}
            </div>
          )}
        </div>
        <CardContent className="flex-1 p-4">
          <div className="space-y-2">
            {title && (
              <h3 className="font-semibold line-clamp-2">{title}</h3>
            )}
            {author && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {author.avatar && (
                  <img src={author.avatar} alt={author.name} className="h-6 w-6 rounded-full" />
                )}
                <span>{author.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {views && <span>{formatViews(views)} views</span>}
              {date && <span>• {date}</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'overlay') {
    return (
      <Card
        interactive="hover"
        loading={loading}
        elevation="flat"
        border="none"
        className={cn('relative group overflow-hidden', sizeClasses[size], className)}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <div className="relative aspect-video">
          {type === 'image' ? (
            <img src={src} alt={title} className="w-full h-full object-cover" />
          ) : type === 'video' ? (
            <video
              ref={videoRef}
              src={src}
              poster={thumbnail}
              className="w-full h-full object-cover"
              autoPlay={autoPlay}
              muted={muted}
              loop
            />
          ) : (
            <div className="relative w-full h-full bg-gray-900 flex items-center justify-center">
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              <Volume2 className="absolute h-16 w-16 text-white/50" />
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            {title && (
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
            )}
            {description && (
              <p className="text-sm opacity-90 line-clamp-2">{description}</p>
            )}
          </div>

          {/* Controls overlay */}
          <AnimatePresence>
            {showControls && controls && type !== 'image' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center"
              >
                <div className="flex items-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePlayPause}
                    className="p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6 text-white" />
                    ) : (
                      <Play className="h-6 w-6 text-white" />
                    )}
                  </motion.button>
                  {type === 'video' && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleMuteToggle}
                      className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4 text-white" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-white" />
                      )}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Duration badge */}
          {duration && (
            <Badge className="absolute top-2 right-2 bg-black/70 text-white">
              {duration}
            </Badge>
          )}
        </div>
      </Card>
    )
  }

  // Default variant
  return (
    <Card
      interactive="hover"
      loading={loading}
      className={cn(sizeClasses[size], className)}
    >
      <CardImage
        src={type === 'image' ? src : thumbnail || src}
        alt={title || 'Media'}
        height="h-48"
        overlay={type !== 'image'}
        overlayContent={
          type !== 'image' && (
            <div className="flex items-center justify-between w-full">
              <button
                onClick={handlePlayPause}
                className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
              >
                <Play className="h-4 w-4 text-white" />
              </button>
              {duration && (
                <Badge className="bg-black/70 text-white">
                  {duration}
                </Badge>
              )}
            </div>
          )
        }
      />
      
      <CardContent className="space-y-3">
        {title && (
          <h3 className="font-semibold line-clamp-2 cursor-pointer hover:text-primary-600" onClick={onClick}>
            {title}
          </h3>
        )}
        
        {author && (
          <div className="flex items-center gap-2">
            {author.avatar && (
              <img 
                src={author.avatar} 
                alt={author.name} 
                className="h-8 w-8 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{author.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {views && <span>{formatViews(views)} views</span>}
                {date && <span>• {date}</span>}
              </div>
            </div>
          </div>
        )}

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {onDownload && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDownload}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Download className="h-4 w-4" />
            </motion.button>
          )}
          {onShare && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShare}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Share2 className="h-4 w-4" />
            </motion.button>
          )}
          {onClick && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClick}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ml-auto"
            >
              <Maximize2 className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}