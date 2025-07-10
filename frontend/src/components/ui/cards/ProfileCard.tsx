import React from 'react'
import { Card, CardContent, CardHeader, CardActions } from '../card'
import { Avatar } from '../avatar'
import { Badge } from '../badge'
import { Button } from '../button'
import { cn } from '@/lib/utils'
import { Mail, Phone, MapPin, Link as LinkIcon } from 'lucide-react'

export interface ProfileCardProps {
  name: string
  role?: string
  avatar?: string
  email?: string
  phone?: string
  location?: string
  website?: string
  bio?: string
  tags?: string[]
  status?: 'online' | 'offline' | 'away' | 'busy'
  variant?: 'default' | 'compact' | 'detailed'
  actions?: {
    primary?: {
      label: string
      onClick: () => void
    }
    secondary?: {
      label: string
      onClick: () => void
    }
  }
  loading?: boolean
  className?: string
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  role,
  avatar,
  email,
  phone,
  location,
  website,
  bio,
  tags,
  status,
  variant = 'default',
  actions,
  loading = false,
  className
}) => {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500'
  }

  if (variant === 'compact') {
    return (
      <Card 
        interactive="hover" 
        loading={loading} 
        className={cn('max-w-sm', className)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={avatar}
                alt={name}
                fallback={name.charAt(0)}
                size="lg"
              />
              {status && (
                <span className={cn(
                  'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900',
                  statusColors[status]
                )} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{name}</h3>
              {role && (
                <p className="text-sm text-muted-foreground truncate">{role}</p>
              )}
              {email && (
                <p className="text-xs text-muted-foreground truncate mt-1">{email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      interactive="hover" 
      loading={loading}
      className={cn('max-w-md', className)}
    >
      <CardHeader className="text-center pb-2">
        <div className="relative inline-block">
          <Avatar
            src={avatar}
            alt={name}
            fallback={name.charAt(0)}
            size="xl"
            className="mx-auto"
          />
          {status && (
            <span className={cn(
              'absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900',
              statusColors[status]
            )} />
          )}
        </div>
        <h3 className="font-semibold text-xl mt-4">{name}</h3>
        {role && (
          <p className="text-sm text-muted-foreground">{role}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {bio && variant === 'detailed' && (
          <p className="text-sm text-center">{bio}</p>
        )}

        <div className="space-y-2">
          {email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{phone}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{location}</span>
            </div>
          )}
          {website && (
            <div className="flex items-center gap-2 text-sm">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline truncate"
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {actions && (actions.primary || actions.secondary) && (
        <CardActions align="center" className="pt-0">
          {actions.secondary && (
            <Button
              variant="outline"
              size="sm"
              onClick={actions.secondary.onClick}
              className="flex-1"
            >
              {actions.secondary.label}
            </Button>
          )}
          {actions.primary && (
            <Button
              variant="default"
              size="sm"
              onClick={actions.primary.onClick}
              className="flex-1"
            >
              {actions.primary.label}
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  )
}