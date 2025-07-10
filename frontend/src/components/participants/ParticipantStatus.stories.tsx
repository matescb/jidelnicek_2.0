import type { Meta, StoryObj } from '@storybook/react';
import { Box, Stack, Paper, Typography } from 'react';
import { StatusIndicator } from './StatusIndicator';
import { ActivityTimeline } from './ActivityTimeline';
import { NotificationBadge } from './NotificationBadge';
import { ParticipantCard } from './ParticipantCard';
import { TripParticipant } from '@/types';

const meta: Meta = {
  title: 'Components/Participants/Status & Activity',
  decorators: [
    (Story) => (
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Story />
      </Box>
    ),
  ],
};

export default meta;

// Status Indicator Stories
export const StatusIndicators: StoryObj = {
  render: () => (
    <Stack spacing={3}>
      <Typography variant="h5" gutterBottom>Status Indicators</Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Sizes</Typography>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" display="block" gutterBottom>Small</Typography>
            <StatusIndicator isOnline={true} size="small" />
          </Box>
          <Box>
            <Typography variant="caption" display="block" gutterBottom>Medium</Typography>
            <StatusIndicator isOnline={true} size="medium" />
          </Box>
          <Box>
            <Typography variant="caption" display="block" gutterBottom>Large</Typography>
            <StatusIndicator isOnline={true} size="large" />
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>States</Typography>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <StatusIndicator isOnline={true} showLabel />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <StatusIndicator isOnline={false} lastSeen={new Date(Date.now() - 1000 * 60 * 3)} showLabel />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <StatusIndicator isOnline={false} lastSeen={new Date(Date.now() - 1000 * 60 * 60)} showLabel />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <StatusIndicator isOnline={false} showLabel />
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>With Activity</Typography>
        <Stack spacing={2}>
          <StatusIndicator isOnline={true} currentActivity="Editing recipes" showLabel showActivity />
          <StatusIndicator isOnline={true} currentActivity="Viewing shopping list" showLabel showActivity />
          <StatusIndicator isOnline={true} currentActivity="Managing participants" showLabel showActivity />
        </Stack>
      </Paper>
    </Stack>
  ),
};

// Activity Timeline Stories
export const ActivityTimelineDemo: StoryObj = {
  render: () => {
    const activities = [
      {
        id: '1',
        type: 'joined' as const,
        participantId: '1',
        participantName: 'John Doe',
        participantAvatar: 'https://mui.com/static/images/avatar/1.jpg',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        isNew: true,
      },
      {
        id: '2',
        type: 'meal_assigned' as const,
        participantId: '2',
        participantName: 'Jane Smith',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        metadata: { mealName: 'Breakfast - Day 2' },
        isNew: true,
      },
      {
        id: '3',
        type: 'shopping_contributed' as const,
        participantId: '3',
        participantName: 'Bob Johnson',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        metadata: { itemCount: 5 },
        isNew: false,
      },
      {
        id: '4',
        type: 'role_changed' as const,
        participantId: '1',
        participantName: 'John Doe',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        metadata: { previousRole: 'participant', newRole: 'planner' },
        isNew: false,
      },
      {
        id: '5',
        type: 'recipe_added' as const,
        participantId: '2',
        participantName: 'Jane Smith',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        metadata: { recipeName: 'Spaghetti Carbonara' },
        isNew: false,
      },
      {
        id: '6',
        type: 'comment_added' as const,
        participantId: '3',
        participantName: 'Bob Johnson',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
        metadata: { comment: 'This looks great! Can we add a vegetarian option for day 3?' },
        isNew: false,
      },
    ];

    return (
      <Stack spacing={3}>
        <Typography variant="h5" gutterBottom>Activity Timeline</Typography>
        
        <Paper>
          <ActivityTimeline
            activities={activities}
            maxItems={10}
            showLoadMore={true}
            onLoadMore={() => console.log('Load more clicked')}
          />
        </Paper>

        <Paper>
          <Typography variant="h6" sx={{ p: 2 }}>Compact Mode</Typography>
          <ActivityTimeline
            activities={activities}
            maxItems={3}
            compact={true}
          />
        </Paper>
      </Stack>
    );
  },
};

// Notification Badge Stories
export const NotificationBadgeDemo: StoryObj = {
  render: () => {
    const activities = [
      {
        id: '1',
        type: 'joined' as const,
        participantId: '1',
        participantName: 'John Doe',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        isNew: true,
      },
      {
        id: '2',
        type: 'meal_assigned' as const,
        participantId: '2',
        participantName: 'Jane Smith',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        metadata: { mealName: 'Breakfast - Day 2' },
        isNew: true,
      },
      {
        id: '3',
        type: 'shopping_contributed' as const,
        participantId: '3',
        participantName: 'Bob Johnson',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        metadata: { itemCount: 3 },
        isNew: true,
      },
    ];

    return (
      <Stack spacing={3}>
        <Typography variant="h5" gutterBottom>Notification Badge</Typography>
        
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>With New Notifications</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <NotificationBadge
              activities={activities}
              onMarkAsRead={(id) => console.log('Mark as read:', id)}
              onMarkAllAsRead={() => console.log('Mark all as read')}
              onViewAll={() => console.log('View all')}
            />
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>No New Notifications</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <NotificationBadge
              activities={[]}
            />
          </Box>
        </Paper>
      </Stack>
    );
  },
};

// Participant Card with Status Stories
export const ParticipantCardWithStatus: StoryObj = {
  render: () => {
    const participant: TripParticipant = {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+1 234 567 890',
      role: 'planner',
      status: 'accepted',
      mealCoefficient: 1.0,
      snackCoefficient: 1.0,
      dietaryRestrictions: ['Vegetarian', 'Gluten-free'],
      notes: 'Prefers organic ingredients when possible',
    };

    return (
      <Stack spacing={3}>
        <Typography variant="h5" gutterBottom>Participant Cards with Status</Typography>
        
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <ParticipantCard
            participant={participant}
            isOnline={true}
            currentActivity="Editing recipes"
            onEdit={(p) => console.log('Edit:', p)}
            onDelete={(p) => console.log('Delete:', p)}
            onRoleChange={(p, role) => console.log('Change role:', p, role)}
          />
          
          <ParticipantCard
            participant={{ ...participant, id: '2', name: 'Jane Smith', role: 'participant' }}
            isOnline={false}
            lastSeen={new Date(Date.now() - 1000 * 60 * 15)}
            onEdit={(p) => console.log('Edit:', p)}
            onDelete={(p) => console.log('Delete:', p)}
            onRoleChange={(p, role) => console.log('Change role:', p, role)}
          />
          
          <ParticipantCard
            participant={{ ...participant, id: '3', name: 'Bob Johnson', status: 'pending' }}
            isOnline={false}
            lastSeen={new Date(Date.now() - 1000 * 60 * 60 * 24)}
            onEdit={(p) => console.log('Edit:', p)}
            onDelete={(p) => console.log('Delete:', p)}
            onRoleChange={(p, role) => console.log('Change role:', p, role)}
          />
        </Box>

        <Typography variant="h6" gutterBottom>Compact Mode</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <ParticipantCard
            participant={participant}
            isOnline={true}
            currentActivity="Online"
            compact={true}
            showActions={false}
          />
          
          <ParticipantCard
            participant={{ ...participant, id: '2', name: 'Jane Smith' }}
            isOnline={false}
            lastSeen={new Date(Date.now() - 1000 * 60 * 30)}
            compact={true}
            showActions={false}
          />
        </Box>
      </Stack>
    );
  },
};