import React from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';

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
  const theme = useTheme();

  const sizeMap = {
    small: 8,
    medium: 12,
    large: 16,
  };

  const dotSize = sizeMap[size];

  const getStatusColor = () => {
    if (isOnline) return theme.palette.success.main;
    if (lastSeen) {
      const minutesAgo = (Date.now() - lastSeen.getTime()) / 1000 / 60;
      if (minutesAgo < 5) return theme.palette.warning.main;
    }
    return theme.palette.text.disabled;
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
    <Tooltip title={statusText} placement="top">
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
        }}
        data-testid={isOnline ? 'status-indicator-online' : 'status-indicator-offline'}
      >
        <Box
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: statusColor,
            position: 'relative',
            '&::after': isOnline
              ? {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: '50%',
                  border: `2px solid ${statusColor}`,
                  animation: 'pulse 2s infinite',
                }
              : {},
            '@keyframes pulse': {
              '0%': {
                transform: 'scale(1)',
                opacity: 1,
              },
              '50%': {
                transform: 'scale(1.5)',
                opacity: 0.5,
              },
              '100%': {
                transform: 'scale(1)',
                opacity: 1,
              },
            },
          }}
        />
        {showLabel && (
          <Typography
            variant={size === 'small' ? 'caption' : 'body2'}
            color={isOnline ? 'text.primary' : 'text.secondary'}
          >
            {statusText}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default StatusIndicator;