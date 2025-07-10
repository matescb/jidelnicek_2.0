import React from 'react';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Avatar,
  useTheme,
  IconButton,
  Collapse,
  Button,
} from '@mui/material';
import {
  PersonAdd,
  PersonRemove,
  Edit,
  Assignment,
  ShoppingCart,
  AdminPanelSettings,
  Restaurant,
  ExpandMore,
  ExpandLess,
  Notifications,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';

export type ActivityType =
  | 'joined'
  | 'left'
  | 'role_changed'
  | 'profile_updated'
  | 'meal_assigned'
  | 'shopping_contributed'
  | 'recipe_added'
  | 'comment_added';

export interface Activity {
  id: string;
  type: ActivityType;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  timestamp: Date;
  metadata?: {
    previousRole?: string;
    newRole?: string;
    mealName?: string;
    itemCount?: number;
    recipeName?: string;
    comment?: string;
    [key: string]: any;
  };
  isNew?: boolean;
}

export interface ActivityTimelineProps {
  activities: Activity[];
  maxItems?: number;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  compact?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  maxItems = 10,
  showLoadMore = false,
  onLoadMore,
  compact = false,
}) => {
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());

  const toggleExpanded = (activityId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'joined':
        return <PersonAdd />;
      case 'left':
        return <PersonRemove />;
      case 'role_changed':
        return <AdminPanelSettings />;
      case 'profile_updated':
        return <Edit />;
      case 'meal_assigned':
        return <Assignment />;
      case 'shopping_contributed':
        return <ShoppingCart />;
      case 'recipe_added':
        return <Restaurant />;
      default:
        return <Edit />;
    }
  };

  const getActivityColor = (type: ActivityType): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' => {
    switch (type) {
      case 'joined':
        return 'success';
      case 'left':
        return 'error';
      case 'role_changed':
        return 'warning';
      case 'meal_assigned':
        return 'primary';
      case 'shopping_contributed':
        return 'info';
      case 'recipe_added':
        return 'secondary';
      default:
        return 'primary';
    }
  };

  const getActivityDescription = (activity: Activity): string => {
    const { type, participantName, metadata } = activity;
    
    switch (type) {
      case 'joined':
        return `${participantName} joined the trip`;
      case 'left':
        return `${participantName} left the trip`;
      case 'role_changed':
        return `${participantName} changed role from ${metadata?.previousRole} to ${metadata?.newRole}`;
      case 'profile_updated':
        return `${participantName} updated their profile`;
      case 'meal_assigned':
        return `${participantName} was assigned to prepare ${metadata?.mealName}`;
      case 'shopping_contributed':
        return `${participantName} added ${metadata?.itemCount} item${metadata?.itemCount !== 1 ? 's' : ''} to shopping list`;
      case 'recipe_added':
        return `${participantName} added recipe "${metadata?.recipeName}"`;
      case 'comment_added':
        return `${participantName} commented`;
      default:
        return `${participantName} performed an action`;
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <Box>
      <Timeline position={compact ? 'right' : 'alternate'}>
        {displayedActivities.map((activity) => {
          const isExpanded = expandedItems.has(activity.id);
          const hasExpandableContent = activity.type === 'comment_added' || 
                                       activity.type === 'profile_updated' ||
                                       (activity.metadata && Object.keys(activity.metadata).length > 3);

          return (
            <TimelineItem key={activity.id}>
              {!compact && (
                <TimelineOppositeContent sx={{ flex: 0.3 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {format(activity.timestamp, 'HH:mm')}
                  </Typography>
                </TimelineOppositeContent>
              )}
              <TimelineSeparator>
                <TimelineDot color={getActivityColor(activity.type)} variant={activity.isNew ? 'filled' : 'outlined'}>
                  {getActivityIcon(activity.type)}
                </TimelineDot>
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent>
                <Paper
                  elevation={compact ? 0 : 1}
                  sx={{
                    p: compact ? 1 : 2,
                    backgroundColor: activity.isNew ? theme.palette.action.hover : 'background.paper',
                    position: 'relative',
                  }}
                >
                  {activity.isNew && (
                    <Chip
                      icon={<Notifications />}
                      label="New"
                      size="small"
                      color="primary"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                      }}
                    />
                  )}
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar
                      src={activity.participantAvatar}
                      sx={{ width: 24, height: 24 }}
                    >
                      {activity.participantName[0]}
                    </Avatar>
                    <Typography variant="body2">
                      {getActivityDescription(activity)}
                    </Typography>
                    {hasExpandableContent && (
                      <IconButton
                        size="small"
                        onClick={() => toggleExpanded(activity.id)}
                        sx={{ ml: 'auto' }}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    )}
                  </Box>

                  {compact && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </Typography>
                  )}

                  <Collapse in={isExpanded}>
                    {activity.metadata && (
                      <Box sx={{ mt: 1, pl: 4 }}>
                        {activity.metadata.comment && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            "{activity.metadata.comment}"
                          </Typography>
                        )}
                        {Object.entries(activity.metadata)
                          .filter(([key]) => !['comment', 'previousRole', 'newRole', 'mealName', 'itemCount', 'recipeName'].includes(key))
                          .map(([key, value]) => (
                            <Typography key={key} variant="caption" color="text.secondary" display="block">
                              {key}: {String(value)}
                            </Typography>
                          ))}
                      </Box>
                    )}
                  </Collapse>
                </Paper>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>

      {showLoadMore && activities.length > maxItems && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button onClick={onLoadMore} variant="outlined" size="small">
            Load More ({activities.length - maxItems} more)
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ActivityTimeline;