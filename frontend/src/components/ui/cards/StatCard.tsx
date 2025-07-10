import React from 'react'
import { Card, CardContent } from '../card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
  }
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  className?: string
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  size = 'md',
  loading = false,
  className,
  onClick
}) => {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  const iconSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }

  const valueSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  }

  const trendColor = trend ? (
    trend.value > 0 ? 'text-green-600 dark:text-green-400' :
    trend.value < 0 ? 'text-red-600 dark:text-red-400' :
    'text-gray-600 dark:text-gray-400'
  ) : ''

  const trendIcon = trend ? (
    trend.value > 0 ? '↑' :
    trend.value < 0 ? '↓' :
    '→'
  ) : ''

  return (
    <Card
      variant={variant}
      interactive={onClick ? 'clickable' : 'static'}
      loading={loading}
      className={className}
      onClick={onClick}
    >
      <CardContent className={cn(sizeClasses[size], 'space-y-2')}>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <motion.p 
                className={cn('font-bold', valueSizeClasses[size])}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {value}
              </motion.p>
              {trend && (
                <motion.span 
                  className={cn('text-sm font-medium flex items-center gap-1', trendColor)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <span>{trendIcon}</span>
                  <span>{Math.abs(trend.value)}%</span>
                  {trend.label && <span className="text-xs">({trend.label})</span>}
                </motion.span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              'rounded-lg p-3',
              variant === 'default' && 'bg-gray-100 dark:bg-gray-800',
              variant === 'primary' && 'bg-primary-100 dark:bg-primary-900',
              variant === 'secondary' && 'bg-secondary-100 dark:bg-secondary-900',
              variant === 'success' && 'bg-green-100 dark:bg-green-900',
              variant === 'warning' && 'bg-yellow-100 dark:bg-yellow-900',
              variant === 'error' && 'bg-red-100 dark:bg-red-900'
            )}>
              <Icon className={cn(
                iconSizeClasses[size],
                variant === 'default' && 'text-gray-600 dark:text-gray-400',
                variant === 'primary' && 'text-primary-600 dark:text-primary-400',
                variant === 'secondary' && 'text-secondary-600 dark:text-secondary-400',
                variant === 'success' && 'text-green-600 dark:text-green-400',
                variant === 'warning' && 'text-yellow-600 dark:text-yellow-400',
                variant === 'error' && 'text-red-600 dark:text-red-400'
              )} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}