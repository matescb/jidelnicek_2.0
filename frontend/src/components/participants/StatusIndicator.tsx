import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface StatusIndicatorProps {
  isOnline: boolean;
  lastSeen?: Date;
  currentActivity?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showActivity?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isOnline,
  lastSeen,
  currentActivity,
  size = 'medium',
  showLabel = false,
  showActivity = false,
}) => {
  const sizeClasses = {
    small: 'w-2 h-2',
    medium: 'w-3 h-3',
    large: 'w-4 h-4',
  };

  const getStatusColor = () => {
    if (isOnline) return 'bg-green-500';
    if (lastSeen) {
      const minutesAgo = (Date.now() - lastSeen.getTime()) / 1000 / 60;
      if (minutesAgo < 5) return 'bg-yellow-500';
    }
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (isOnline) {
      if (currentActivity && showActivity) {
        return `Online - ${currentActivity}`;
      }
      return 'Online';
    }
    if (lastSeen) {
      return `Last seen ${formatDistanceToNow(lastSeen, { addSuffix: true })}`;
    }
    return 'Offline';
  };

  const statusColor = getStatusColor();
  const statusText = getStatusText();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center gap-2"
            data-testid={isOnline ? 'status-indicator-online' : 'status-indicator-offline'}
          >
            <div className="relative">
              <div
                className={cn(
                  'rounded-full',
                  sizeClasses[size],
                  statusColor
                )}
              />
              {isOnline && (
                <div
                  className={cn(
                    'absolute top-0 left-0 rounded-full border-2 border-white animate-pulse',
                    sizeClasses[size],
                    statusColor
                  )}
                />
              )}
            </div>
            {showLabel && (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {statusText}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};