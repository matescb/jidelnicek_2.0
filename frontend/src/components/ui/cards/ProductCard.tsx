import React from 'react'
import { Card, CardContent, CardImage, CardActions } from '../card'
import { Badge } from '../badge'
import { Button } from '../button'
import { cn } from '@/lib/utils'
import { ShoppingCart, Heart, Star, Clock, Users } from 'lucide-react'
import { motion } from 'framer-motion'

export interface ProductCardProps {
  name: string
  description?: string
  image: string
  price?: {
    amount: number
    currency?: string
    originalAmount?: number
  }
  rating?: {
    value: number
    count?: number
  }
  category?: string
  tags?: string[]
  inStock?: boolean
  featured?: boolean
  isNew?: boolean
  onSale?: boolean
  // Recipe-specific props
  prepTime?: string
  servings?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  // Actions
  onAddToCart?: () => void
  onToggleFavorite?: () => void
  isFavorite?: boolean
  onClick?: () => void
  variant?: 'default' | 'compact' | 'detailed'
  loading?: boolean
  className?: string
}

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  description,
  image,
  price,
  rating,
  category,
  tags,
  inStock = true,
  featured = false,
  isNew = false,
  onSale = false,
  prepTime,
  servings,
  difficulty,
  onAddToCart,
  onToggleFavorite,
  isFavorite = false,
  onClick,
  variant = 'default',
  loading = false,
  className
}) => {
  const discount = price?.originalAmount 
    ? Math.round(((price.originalAmount - price.amount) / price.originalAmount) * 100)
    : 0

  const difficultyColors = {
    easy: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    hard: 'text-red-600 dark:text-red-400'
  }

  const ribbonProps = featured ? { text: 'Featured', color: 'primary' as const } :
                      isNew ? { text: 'New', color: 'success' as const } :
                      onSale && discount > 0 ? { text: `-${discount}%`, color: 'error' as const } :
                      undefined

  if (variant === 'compact') {
    return (
      <Card
        interactive="hover"
        loading={loading}
        ribbon={ribbonProps}
        className={cn('group cursor-pointer', className)}
        onClick={onClick}
      >
        <div className="aspect-square relative overflow-hidden">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          {onToggleFavorite && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite()
              }}
              className="absolute top-2 right-2 p-2 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
            >
              <Heart 
                className={cn(
                  'h-4 w-4',
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-400'
                )} 
              />
            </motion.button>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold truncate">{name}</h3>
          {price && (
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold">
                {price.currency || '$'}{price.amount}
              </span>
              {price.originalAmount && (
                <span className="text-sm text-muted-foreground line-through">
                  {price.currency || '$'}{price.originalAmount}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      interactive="hover"
      loading={loading}
      ribbon={ribbonProps}
      className={cn('group', className)}
    >
      <CardImage
        src={image}
        alt={name}
        height="h-64"
        overlay={!inStock}
        overlayContent={!inStock && (
          <div className="text-center">
            <Badge variant="secondary" className="bg-black/50 text-white">
              Out of Stock
            </Badge>
          </div>
        )}
      />
      
      <CardContent className="space-y-3">
        <div>
          {category && (
            <Badge variant="secondary" size="sm" className="mb-2">
              {category}
            </Badge>
          )}
          <h3 
            className="font-semibold text-lg cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
            onClick={onClick}
          >
            {name}
          </h3>
          {description && variant === 'detailed' && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* Recipe metadata */}
        {(prepTime || servings || difficulty) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {prepTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{prepTime}</span>
              </div>
            )}
            {servings && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{servings}</span>
              </div>
            )}
            {difficulty && (
              <span className={cn('font-medium capitalize', difficultyColors[difficulty])}>
                {difficulty}
              </span>
            )}
          </div>
        )}

        {/* Rating */}
        {rating && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < Math.floor(rating.value)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
                  )}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {rating.value} {rating.count && `(${rating.count})`}
            </span>
          </div>
        )}

        {/* Price */}
        {price && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {price.currency || '$'}{price.amount}
            </span>
            {price.originalAmount && (
              <span className="text-sm text-muted-foreground line-through">
                {price.currency || '$'}{price.originalAmount}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && variant === 'detailed' && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge key={index} variant="outline" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardActions align="between">
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            className="hover:text-red-500"
          >
            <Heart 
              className={cn(
                'h-4 w-4',
                isFavorite && 'fill-current text-red-500'
              )} 
            />
          </Button>
        )}
        {onAddToCart && (
          <Button
            variant="default"
            size="sm"
            onClick={onAddToCart}
            disabled={!inStock}
            className="flex-1 ml-2"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        )}
      </CardActions>
    </Card>
  )
}