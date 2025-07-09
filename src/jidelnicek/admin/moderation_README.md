# Content Moderation System

This module provides a comprehensive content moderation system for managing user-generated content in Jidelnicek 2.0.

## Features

### 1. Content Reporting
- Users can report content (recipes, comments, reviews, profiles, images)
- Reports are prioritized based on severity and reporter reputation
- Duplicate report prevention
- Automatic queuing of high-priority reports

### 2. Moderation Queue
- Priority-based queue system
- Auto-assignment to moderators
- Support for specialized routing by content type
- Bulk moderation capabilities

### 3. Moderation Actions
- Multiple action types: approve, reject, delete, hide, flag, escalate
- Response templates for common scenarios
- Bulk actions with templates
- Full audit trail of all actions

### 4. User Sanctions
- Warning system with automatic escalation
- Temporary and permanent bans
- Content restrictions and rate limiting
- Sanction history tracking

### 5. Appeal System
- Users can appeal sanctions and moderation decisions
- 30-day appeal window
- Structured review process
- Automatic sanction lifting on successful appeal

### 6. Content Filtering
- Keyword-based filtering
- Regular expression support
- Planned ML model integration
- Auto-reporting and auto-moderation options
- Effectiveness scoring

### 7. Analytics & Reporting
- Moderation statistics by date range
- Moderator performance tracking
- Report resolution metrics
- Sanction analytics

## API Endpoints

### Reports
- `POST /api/v1/admin/moderation/reports` - Submit a report
- `GET /api/v1/admin/moderation/reports/pending` - Get pending reports
- `GET /api/v1/admin/moderation/reports/{id}` - Get report details

### Moderation Actions
- `POST /api/v1/admin/moderation/reports/{id}/moderate` - Take action on report
- `POST /api/v1/admin/moderation/reports/bulk-moderate` - Bulk moderation

### Templates
- `GET /api/v1/admin/moderation/templates` - List response templates
- `POST /api/v1/admin/moderation/templates` - Create template

### Sanctions
- `POST /api/v1/admin/moderation/sanctions` - Issue sanction
- `PUT /api/v1/admin/moderation/sanctions/{id}/lift` - Lift sanction
- `GET /api/v1/admin/moderation/users/{id}/sanctions` - Get user sanctions

### Appeals
- `POST /api/v1/admin/moderation/appeals` - Create appeal
- `GET /api/v1/admin/moderation/appeals/pending` - Get pending appeals
- `PUT /api/v1/admin/moderation/appeals/{id}/review` - Review appeal

### Filters
- `POST /api/v1/admin/moderation/filters` - Create filter
- `GET /api/v1/admin/moderation/filters` - List filters
- `POST /api/v1/admin/moderation/content/check` - Test content against filters

### Queue
- `GET /api/v1/admin/moderation/queue` - Get moderation queue
- `PUT /api/v1/admin/moderation/queue/{id}/assign` - Assign queue item

### Analytics
- `GET /api/v1/admin/moderation/stats` - Get moderation statistics
- `GET /api/v1/admin/moderation/stats/moderators` - Get moderator performance

## Database Models

### ContentReport
- Tracks user-submitted reports
- Includes priority scoring
- Links to moderation actions

### ModerationActionLog
- Audit trail of all moderation actions
- Links to templates used
- Includes metadata for context

### UserSanction
- Records of sanctions issued
- Supports temporary and permanent sanctions
- Tracks lifting and appeals

### UserAppeal
- Appeal requests from users
- Review decisions and timeline
- Links to original sanctions

### ModerationTemplate
- Reusable response templates
- Usage tracking
- Category organization

### ContentFilter
- Automated filtering rules
- Multiple filter types
- Effectiveness tracking

### ModerationQueue
- Priority queue for content review
- Assignment tracking
- Auto-flagging support

## Permissions Required

- `moderate_content` - Basic moderation access
- `admin_access` - Administrative functions (sanctions, filters, etc.)

## Integration Points

1. **Content Services** - The moderation system needs to integrate with:
   - Recipe service
   - Comment service
   - Review service
   - User profile service
   - Image service

2. **Notification System** - Send notifications for:
   - Report confirmations
   - Moderation decisions
   - Sanction notifications
   - Appeal updates

3. **Email Service** - Send emails for:
   - Sanction notifications
   - Appeal confirmations
   - Decision notifications

## Configuration

Key configuration options:
- Report priority thresholds
- Auto-moderation rules
- Sanction escalation policies
- Appeal time limits
- Filter effectiveness thresholds

## Security Considerations

1. **Permission Checks** - All endpoints require appropriate permissions
2. **Rate Limiting** - Prevent report spam
3. **Audit Logging** - All actions are logged
4. **Data Sanitization** - User input is sanitized
5. **Access Control** - Users can only appeal their own sanctions

## Future Enhancements

1. **Machine Learning Integration**
   - Content classification models
   - Toxicity detection
   - Image content analysis

2. **Advanced Analytics**
   - Trend analysis
   - Predictive moderation
   - User behavior patterns

3. **Integration Features**
   - Slack/Discord notifications
   - External moderation services
   - Automated responses

4. **UI Components**
   - Moderation dashboard
   - Real-time queue updates
   - Analytics visualizations