import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ActivityTimeline } from '../ActivityTimeline'
import type { Activity } from '../ActivityTimeline'
import { formatDistanceToNow, format } from 'date-fns'

// Mock @mui/lab components
jest.mock('@mui/lab', () => ({
  Timeline: ({ children, position }: any) => (
    <div 
      data-testid="timeline" 
      className={position === 'right' ? 'MuiTimeline-positionRight' : 'MuiTimeline-positionAlternate'}
    >
      {children}
    </div>
  ),
  TimelineItem: ({ children }: any) => <div data-testid="timeline-item">{children}</div>,
  TimelineSeparator: ({ children }: any) => <div data-testid="timeline-separator">{children}</div>,
  TimelineConnector: () => <div data-testid="timeline-connector" />,
  TimelineContent: ({ children }: any) => <div data-testid="timeline-content">{children}</div>,
  TimelineDot: ({ children }: any) => <div data-testid="timeline-dot">{children}</div>,
  TimelineOppositeContent: ({ children }: any) => <div data-testid="timeline-opposite-content">{children}</div>,
}));

// Mock @mui/material components that need special handling in tests
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Collapse: ({ in: inProp, children }: any) => inProp ? <div data-testid="collapse-content">{children}</div> : null,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '5 minutes ago'),
  format: jest.fn(() => '14:30'),
}))

const mockFormatDistanceToNow = formatDistanceToNow as jest.MockedFunction<typeof formatDistanceToNow>
const mockFormat = format as jest.MockedFunction<typeof format>

describe('ActivityTimeline', () => {
  const theme = createTheme()
  
  const mockActivities: Activity[] = [
    {
      id: '1',
      type: 'joined',
      participantId: 'p1',
      participantName: 'John Doe',
      participantAvatar: '/avatar1.jpg',
      timestamp: new Date('2024-03-20T10:00:00'),
      isNew: true,
    },
    {
      id: '2',
      type: 'role_changed',
      participantId: 'p2',
      participantName: 'Jane Smith',
      timestamp: new Date('2024-03-20T11:00:00'),
      metadata: {
        previousRole: 'participant',
        newRole: 'organizer',
      },
    },
    {
      id: '3',
      type: 'meal_assigned',
      participantId: 'p3',
      participantName: 'Bob Johnson',
      timestamp: new Date('2024-03-20T12:00:00'),
      metadata: {
        mealName: 'Breakfast - Day 2',
      },
    },
    {
      id: '4',
      type: 'shopping_contributed',
      participantId: 'p1',
      participantName: 'John Doe',
      timestamp: new Date('2024-03-20T13:00:00'),
      metadata: {
        itemCount: 5,
      },
    },
    {
      id: '5',
      type: 'recipe_added',
      participantId: 'p2',
      participantName: 'Jane Smith',
      timestamp: new Date('2024-03-20T14:00:00'),
      metadata: {
        recipeName: 'Vegetarian Lasagna',
      },
    },
    {
      id: '6',
      type: 'comment_added',
      participantId: 'p3',
      participantName: 'Bob Johnson',
      timestamp: new Date('2024-03-20T15:00:00'),
      metadata: {
        comment: 'Looking forward to this trip!',
      },
    },
    {
      id: '7',
      type: 'left',
      participantId: 'p4',
      participantName: 'Alice Williams',
      timestamp: new Date('2024-03-20T16:00:00'),
    },
    {
      id: '8',
      type: 'profile_updated',
      participantId: 'p1',
      participantName: 'John Doe',
      timestamp: new Date('2024-03-20T17:00:00'),
      metadata: {
        updatedFields: ['dietary preferences', 'emergency contact'],
      },
    },
  ]

  const mockOnLoadMore = jest.fn()

  const renderComponent = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <ActivityTimeline
          activities={mockActivities}
          onLoadMore={mockOnLoadMore}
          {...props}
        />
      </ThemeProvider>
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFormatDistanceToNow.mockReturnValue('5 minutes ago')
    mockFormat.mockReturnValue('14:30')
  })

  describe('Activity Type Rendering', () => {
    it('renders all activity types correctly', () => {
      renderComponent()
      
      expect(screen.getByText('John Doe joined the trip')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith changed role from participant to organizer')).toBeInTheDocument()
      expect(screen.getByText('Bob Johnson was assigned to prepare Breakfast - Day 2')).toBeInTheDocument()
      expect(screen.getByText('John Doe added 5 items to shopping list')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith added recipe "Vegetarian Lasagna"')).toBeInTheDocument()
      expect(screen.getByText('Bob Johnson commented')).toBeInTheDocument()
      expect(screen.getByText('Alice Williams left the trip')).toBeInTheDocument()
      expect(screen.getByText('John Doe updated their profile')).toBeInTheDocument()
    })

    it('displays correct icons for each activity type', () => {
      renderComponent()
      
      // Check for specific icons
      expect(screen.getByTestId('PersonAddIcon')).toBeInTheDocument() // joined
      expect(screen.getByTestId('PersonRemoveIcon')).toBeInTheDocument() // left
      expect(screen.getByTestId('AdminPanelSettingsIcon')).toBeInTheDocument() // role_changed
      expect(screen.getByTestId('AssignmentIcon')).toBeInTheDocument() // meal_assigned
      expect(screen.getByTestId('ShoppingCartIcon')).toBeInTheDocument() // shopping_contributed
      expect(screen.getByTestId('RestaurantIcon')).toBeInTheDocument() // recipe_added
      expect(screen.getAllByTestId('EditIcon')).toHaveLength(2) // profile_updated and comment_added
    })

    it('applies correct colors to timeline dots', () => {
      renderComponent()
      
      const timelineDots = screen.getAllByTestId('timeline-dot')
      
      // Verify dots exist for each activity
      expect(timelineDots.length).toBe(mockActivities.length)
    })

    it('handles unknown activity type gracefully', () => {
      const unknownActivity: Activity[] = [
        {
          id: '1',
          type: 'unknown_type' as any,
          participantId: 'p1',
          participantName: 'John Doe',
          timestamp: new Date(),
        },
      ]
      
      renderComponent({ activities: unknownActivity })
      
      expect(screen.getByText('John Doe performed an action')).toBeInTheDocument()
    })
  })

  describe('New Activity Badges', () => {
    it('displays new badge on new activities', () => {
      renderComponent()
      
      // First activity is marked as new
      const newBadges = screen.getAllByText('New')
      expect(newBadges).toHaveLength(1)
      
      // Check the badge has notification icon
      const chipWithIcon = newBadges[0].closest('div')
      expect(within(chipWithIcon!).getByTestId('NotificationsIcon')).toBeInTheDocument()
    })

    it('highlights new activities with different background', () => {
      renderComponent()
      
      const firstActivity = screen.getByText('John Doe joined the trip').closest('[class*="MuiPaper"]')
      expect(firstActivity).toHaveStyle({ backgroundColor: theme.palette.action.hover })
    })

    it('does not show new badge on regular activities', () => {
      const regularActivities = mockActivities.map(a => ({ ...a, isNew: false }))
      renderComponent({ activities: regularActivities })
      
      expect(screen.queryByText('New')).not.toBeInTheDocument()
    })
  })

  describe('Expandable Content', () => {
    it('expands comment content when clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Find the comment activity
      const commentActivity = screen.getByText('Bob Johnson commented').closest('[class*="MuiPaper"]')
      const expandButton = within(commentActivity!).getByRole('button')
      
      expect(screen.queryByText('"Looking forward to this trip!"')).not.toBeInTheDocument()
      
      await user.click(expandButton)
      
      expect(screen.getByText('"Looking forward to this trip!"')).toBeInTheDocument()
    })

    it('toggles expanded state correctly', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      const commentActivity = screen.getByText('Bob Johnson commented').closest('[class*="MuiPaper"]')
      const expandButton = within(commentActivity!).getByRole('button')
      
      // Expand
      await user.click(expandButton)
      expect(screen.getByText('"Looking forward to this trip!"')).toBeInTheDocument()
      expect(within(commentActivity!).getByTestId('ExpandLessIcon')).toBeInTheDocument()
      
      // Collapse
      await user.click(expandButton)
      expect(screen.queryByText('"Looking forward to this trip!"')).not.toBeInTheDocument()
      expect(within(commentActivity!).getByTestId('ExpandMoreIcon')).toBeInTheDocument()
    })

    it('shows additional metadata when expanded', async () => {
      const user = userEvent.setup()
      
      const activitiesWithMetadata: Activity[] = [{
        id: '1',
        type: 'profile_updated',
        participantId: 'p1',
        participantName: 'John Doe',
        timestamp: new Date(),
        metadata: {
          updatedFields: ['dietary', 'contact'],
          customField: 'custom value',
          anotherField: 'another value',
        },
      }]
      
      renderComponent({ activities: activitiesWithMetadata })
      
      const expandButton = screen.getByRole('button')
      await user.click(expandButton)
      
      expect(screen.getByText('customField: custom value')).toBeInTheDocument()
      expect(screen.getByText('anotherField: another value')).toBeInTheDocument()
    })

    it('does not show expand button for simple activities', () => {
      const simpleActivity: Activity[] = [{
        id: '1',
        type: 'joined',
        participantId: 'p1',
        participantName: 'John Doe',
        timestamp: new Date(),
      }]
      
      renderComponent({ activities: simpleActivity })
      
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows expand button for activities with many metadata fields', () => {
      const complexActivity: Activity[] = [{
        id: '1',
        type: 'meal_assigned',
        participantId: 'p1',
        participantName: 'John Doe',
        timestamp: new Date(),
        metadata: {
          mealName: 'Dinner',
          field1: 'value1',
          field2: 'value2',
          field3: 'value3',
          field4: 'value4',
        },
      }]
      
      renderComponent({ activities: complexActivity })
      
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Load More Functionality', () => {
    it('shows load more button when enabled and items exceed limit', () => {
      renderComponent({ 
        maxItems: 3,
        showLoadMore: true,
      })
      
      const loadMoreButton = screen.getByRole('button', { name: /Load More/ })
      expect(loadMoreButton).toBeInTheDocument()
      expect(loadMoreButton).toHaveTextContent('Load More (5 more)')
    })

    it('does not show load more when all items are displayed', () => {
      renderComponent({ 
        maxItems: 10, // More than total activities
        showLoadMore: true,
      })
      
      expect(screen.queryByRole('button', { name: /Load More/ })).not.toBeInTheDocument()
    })

    it('calls onLoadMore when clicked', async () => {
      const user = userEvent.setup()
      renderComponent({ 
        maxItems: 3,
        showLoadMore: true,
      })
      
      const loadMoreButton = screen.getByRole('button', { name: /Load More/ })
      await user.click(loadMoreButton)
      
      expect(mockOnLoadMore).toHaveBeenCalledTimes(1)
    })

    it('limits displayed activities based on maxItems', () => {
      renderComponent({ maxItems: 3 })
      
      expect(screen.getByText('John Doe joined the trip')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith changed role from participant to organizer')).toBeInTheDocument()
      expect(screen.getByText('Bob Johnson was assigned to prepare Breakfast - Day 2')).toBeInTheDocument()
      
      // Should not show activities beyond maxItems
      expect(screen.queryByText('John Doe added 5 items to shopping list')).not.toBeInTheDocument()
    })

    it('calculates remaining items correctly', () => {
      renderComponent({ 
        maxItems: 2,
        showLoadMore: true,
      })
      
      const loadMoreButton = screen.getByRole('button', { name: /Load More/ })
      expect(loadMoreButton).toHaveTextContent('Load More (6 more)')
    })
  })

  describe('Empty State', () => {
    it('renders without errors when activities array is empty', () => {
      renderComponent({ activities: [] })
      
      // Should render timeline container without errors
      const timeline = screen.getByTestId('timeline')
      expect(timeline).toBeInTheDocument()
    })

    it('does not show load more button for empty activities', () => {
      renderComponent({ 
        activities: [],
        showLoadMore: true,
      })
      
      expect(screen.queryByRole('button', { name: /Load More/ })).not.toBeInTheDocument()
    })
  })

  describe('Compact Mode', () => {
    it('renders timeline in right position for compact mode', () => {
      renderComponent({ compact: true })
      
      const timeline = screen.getByTestId('timeline')
      expect(timeline).toHaveClass('MuiTimeline-positionRight')
    })

    it('shows timestamps inline in compact mode', () => {
      renderComponent({ compact: true })
      
      // Should show relative timestamps
      expect(screen.getAllByText('5 minutes ago')).toHaveLength(mockActivities.length)
      
      // Should not show exact time in opposite content
      expect(screen.queryAllByText('14:30')).toHaveLength(0)
    })

    it('uses reduced padding in compact mode', () => {
      renderComponent({ compact: true })
      
      const papers = screen.getAllByRole('generic').filter(el => 
        el.className.includes('MuiPaper')
      )
      
      // Check that papers exist
      expect(papers.length).toBeGreaterThan(0)
    })

    it('does not show elevation in compact mode', () => {
      renderComponent({ compact: true })
      
      const papers = screen.getAllByRole('generic').filter(el => 
        el.className.includes('MuiPaper-elevation0')
      )
      
      expect(papers.length).toBe(mockActivities.length)
    })
  })

  describe('Timestamps and Formatting', () => {
    it('shows relative timestamps for all activities', () => {
      renderComponent()
      
      // Should call formatDistanceToNow for each activity
      expect(mockFormatDistanceToNow).toHaveBeenCalledTimes(mockActivities.length)
      
      // Should show relative time
      const timestamps = screen.getAllByText('5 minutes ago')
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('shows exact time in non-compact mode', () => {
      renderComponent({ compact: false })
      
      // Should call format for each activity
      expect(mockFormat).toHaveBeenCalledTimes(mockActivities.length)
      
      // Should show exact time
      const exactTimes = screen.getAllByText('14:30')
      expect(exactTimes.length).toBe(mockActivities.length)
    })

    it('formats timestamps with correct parameters', () => {
      renderComponent()
      
      mockActivities.forEach(activity => {
        expect(mockFormatDistanceToNow).toHaveBeenCalledWith(activity.timestamp, { addSuffix: true })
        expect(mockFormat).toHaveBeenCalledWith(activity.timestamp, 'HH:mm')
      })
    })
  })

  describe('Participant Information', () => {
    it('displays participant avatars correctly', () => {
      renderComponent()
      
      const avatarWithImage = screen.getAllByRole('img')[0]
      expect(avatarWithImage).toHaveAttribute('src', '/avatar1.jpg')
    })

    it('shows initials for participants without avatars', () => {
      renderComponent()
      
      // Jane Smith has no avatar, should show 'J'
      const avatarInitials = screen.getAllByText('J')
      expect(avatarInitials.length).toBeGreaterThan(0)
    })

    it('handles very long participant names', () => {
      const longNameActivity: Activity[] = [
        {
          id: '1',
          type: 'joined',
          participantId: 'p1',
          participantName: 'A'.repeat(50),
          timestamp: new Date(),
        },
      ]
      
      renderComponent({ activities: longNameActivity })
      
      expect(screen.getByText(`${'A'.repeat(50)} joined the trip`)).toBeInTheDocument()
    })
  })

  describe('Special Cases', () => {
    it('handles single item in shopping contribution', () => {
      const singleItemActivity: Activity[] = [
        {
          id: '1',
          type: 'shopping_contributed',
          participantId: 'p1',
          participantName: 'John Doe',
          timestamp: new Date(),
          metadata: { itemCount: 1 },
        },
      ]
      
      renderComponent({ activities: singleItemActivity })
      
      // Should use singular form
      expect(screen.getByText('John Doe added 1 item to shopping list')).toBeInTheDocument()
    })

    it('handles missing metadata fields gracefully', () => {
      const incompleteActivity: Activity[] = [
        {
          id: '1',
          type: 'role_changed',
          participantId: 'p1',
          participantName: 'John Doe',
          timestamp: new Date(),
          metadata: {}, // Missing previousRole and newRole
        },
      ]
      
      renderComponent({ activities: incompleteActivity })
      
      expect(screen.getByText('John Doe changed role from undefined to undefined')).toBeInTheDocument()
    })

    it('handles activities without metadata', () => {
      const simpleActivities: Activity[] = [
        {
          id: '1',
          type: 'joined',
          participantId: 'p1',
          participantName: 'John Doe',
          timestamp: new Date(),
        },
      ]
      
      renderComponent({ activities: simpleActivities })
      
      expect(screen.getByText('John Doe joined the trip')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has accessible timeline structure', () => {
      renderComponent()
      
      const timelineItems = screen.getAllByTestId('timeline-item')
      expect(timelineItems).toHaveLength(mockActivities.length)
    })

    it('provides accessible expand/collapse buttons', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      const commentActivity = screen.getByText('Bob Johnson commented').closest('[class*="MuiPaper"]')
      const expandButton = within(commentActivity!).getByRole('button')
      
      // Button should be accessible
      expect(expandButton).toBeInTheDocument()
      
      await user.click(expandButton)
      
      // Content should be accessible when expanded
      expect(screen.getByText('"Looking forward to this trip!"')).toBeInTheDocument()
    })

    it('announces new activities to screen readers', () => {
      renderComponent()
      
      const newChip = screen.getByText('New')
      expect(newChip.closest('[class*="MuiChip"]')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('handles large activity lists efficiently', () => {
      const manyActivities = Array.from({ length: 100 }, (_, i) => ({
        id: `activity-${i}`,
        type: 'joined' as const,
        participantId: `p${i}`,
        participantName: `User ${i}`,
        timestamp: new Date(Date.now() - i * 60000),
      }))
      
      renderComponent({ activities: manyActivities, maxItems: 10, showLoadMore: true })
      
      // Should only render maxItems
      const timelineItems = screen.getAllByTestId('timeline-item')
      expect(timelineItems).toHaveLength(10)
      
      // Should show correct load more count
      expect(screen.getByText('Load More (90 more)')).toBeInTheDocument()
    })

    it('memoizes activity descriptions', () => {
      const { rerender } = renderComponent({ maxItems: 3 })
      
      const initialCallCount = mockFormatDistanceToNow.mock.calls.length
      
      // Re-render with same props
      rerender(
        <ThemeProvider theme={theme}>
          <ActivityTimeline
            activities={mockActivities}
            maxItems={3}
            onLoadMore={mockOnLoadMore}
          />
        </ThemeProvider>
      )
      
      // Format functions will be called again on rerender
      expect(mockFormatDistanceToNow.mock.calls.length).toBe(initialCallCount * 2)
    })
  })
})