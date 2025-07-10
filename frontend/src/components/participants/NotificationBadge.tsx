import React from 'react';
import { Box, Badge, IconButton, Popover, List, ListItem, ListItemText, Typography, Divider, Button, useTheme } from 'react';
import { Notifications, NotificationsActive, Check, Close } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from './ActivityTimeline';

export interface NotificationBadgeProps {
  activities: Activity[];
  maxNotifications?: number;
  onMarkAsRead?: (activityId: string) => void;
  onMarkAllAsRead?: () => void;
  onViewAll?: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  activities,
  maxNotifications = 5,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

  const newActivities = activities.filter(a => a.isNew);
  const displayedActivities = newActivities.slice(0, maxNotifications);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  const getActivityDescription = (activity: Activity): string => {
    const { type, participantName, metadata } = activity;
    
    switch (type) {
      case 'joined':
        return `${participantName} joined the trip`;
      case 'left':
        return `${participantName} left the trip`;
      case 'role_changed':
        return `${participantName} changed role`;
      case 'meal_assigned':
        return `${participantName} was assigned ${metadata?.mealName}`;
      case 'shopping_contributed':
        return `${participantName} added items to shopping list`;
      case 'recipe_added':
        return `${participantName} added a recipe`;
      default:
        return `${participantName} performed an action`;
    }
  };

  return (
    <>
      <IconButton
        aria-describedby={id}
        onClick={handleClick}
        color="inherit"
        sx={{ position: 'relative' }}
      >
        <Badge
          badgeContent={newActivities.length}
          color="error"
          invisible={newActivities.length === 0}
          sx={{
            '& .MuiBadge-badge': {
              right: -3,
              top: 3,
              border: `2px solid ${theme.palette.background.paper}`,
              padding: '0 4px',
            },
          }}
        >
          {newActivities.length > 0 ? (
            <NotificationsActive />
          ) : (
            <Notifications />
          )}
        </Badge>
      </IconButton>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 480,
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Notifications</Typography>
            {newActivities.length > 0 && (
              <Button
                size="small"
                onClick={() => {
                  onMarkAllAsRead?.();
                  handleClose();
                }}
              >
                Mark all as read
              </Button>
            )}
          </Box>
        </Box>

        <List sx={{ maxHeight: 360, overflow: 'auto' }}>
          {displayedActivities.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.secondary" align="center">
                    No new notifications
                  </Typography>
                }
              />
            </ListItem>
          ) : (
            displayedActivities.map((activity) => (
              <ListItem
                key={activity.id}
                divider
                sx={{
                  bgcolor: 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body2">
                      {getActivityDescription(activity)}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </Typography>
                  }
                />
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => onMarkAsRead?.(activity.id)}
                >
                  <Check fontSize="small" />
                </IconButton>
              </ListItem>
            ))
          )}
        </List>

        {newActivities.length > maxNotifications && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              fullWidth
              variant="text"
              onClick={() => {
                onViewAll?.();
                handleClose();
              }}
            >
              View all notifications ({newActivities.length - maxNotifications} more)
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationBadge;