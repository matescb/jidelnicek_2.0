# Admin Dashboard Analytics

## Overview

The admin dashboard provides comprehensive analytics and insights into the Jidelnicek system. It includes real-time metrics, historical trends, and actionable insights to help administrators monitor and optimize the platform.

## Available Endpoints

### 1. Dashboard Overview
`GET /admin/dashboard/overview`

Returns a comprehensive overview including:
- User statistics (total, new, active, DAU/WAU/MAU)
- Content metrics (recipes, trips, ingredients)
- Activity data (logins, views, exports)
- System health metrics
- Popular content
- Usage trends

### 2. Detailed Statistics

#### User Statistics
`GET /admin/dashboard/users?start_date=2024-01-01&end_date=2024-01-31`

```json
{
  "total": 1500,
  "new": 150,
  "active": 750,
  "dau": 250,
  "wau": 500,
  "mau": 750,
  "by_role": {
    "user": 1480,
    "admin": 20
  },
  "growth_rate": 11.11,
  "retention_rate": 50.0
}
```

#### Content Statistics
`GET /admin/dashboard/content?start_date=2024-01-01&end_date=2024-01-31`

```json
{
  "recipes": {
    "total": 5000,
    "new": 500,
    "published": 2000,
    "average_per_user": 3.33,
    "total_forks": 250
  },
  "trips": {
    "total": 1000,
    "new": 100,
    "active": 50
  },
  "ingredients": {
    "total": 10000
  }
}
```

### 3. Trends and Analytics

#### Usage Trends
`GET /admin/dashboard/trends?start_date=2024-01-01&end_date=2024-01-31&granularity=daily`

Returns time-series data for:
- User registrations
- Recipe creations
- Login activity

#### Metric Comparison
`GET /admin/dashboard/comparison?metric=users&current_start=2024-01-15&current_end=2024-01-31`

Compares metrics between two periods:
```json
{
  "metric": "users",
  "current_period": {
    "start": "2024-01-15",
    "end": "2024-01-31",
    "value": 150
  },
  "previous_period": {
    "start": "2023-12-29",
    "end": "2024-01-14",
    "value": 100
  },
  "change": {
    "absolute": 50,
    "percent": 50.0
  }
}
```

### 4. Real-time Updates

#### WebSocket Connection
`WS /admin/dashboard/ws`

Provides real-time updates every 30 seconds:
```json
{
  "type": "update",
  "timestamp": "2024-01-31T15:30:00Z",
  "data": {
    "active_users": 250,
    "system_health": {
      "error_count": 5,
      "job_success_rate": 98.5
    }
  }
}
```

### 5. Dashboard Widgets

#### Available Widgets
`GET /admin/dashboard/widgets/{widget_name}`

- `user_growth`: User growth chart data
- `content_creation`: Content creation rate
- `activity_heatmap`: User activity heatmap
- `top_performers`: Top performing content
- `system_metrics`: System performance metrics

Example widget request:
```
GET /admin/dashboard/widgets/user_growth?start_date=2024-01-01&end_date=2024-01-31&options={"granularity":"weekly"}
```

## Dashboard Features

### 1. Performance Optimization
- All statistics queries are optimized with proper indexes
- Caching implemented for expensive queries (5-minute TTL)
- Parallel query execution for overview endpoint
- Real-time metrics cached for 1 minute

### 2. Date Range Filtering
All statistics endpoints support flexible date range filtering:
- Default: Last 30 days
- Custom ranges with start_date and end_date parameters
- Automatic previous period calculation for comparisons

### 3. Granularity Options
Trend data supports multiple time granularities:
- Daily (default)
- Weekly
- Monthly

### 4. Export Functionality
`GET /admin/dashboard/export?start_date=2024-01-01&end_date=2024-01-31&format=json`

Supported formats:
- JSON (implemented)
- CSV (planned)
- Excel (planned)

### 5. Health Monitoring
`GET /admin/dashboard/health-check`

Returns system health status with alerts:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-31T15:30:00Z",
  "metrics": {
    "error_count": 10,
    "job_success_rate": 95.0,
    "storage_usage_mb": 1024.5
  },
  "alerts": []
}
```

Alert thresholds:
- Error rate > 100/hour: Warning
- Job success rate < 90%: Warning
- Job success rate < 80%: Critical

## Implementation Details

### Database Query Optimization
1. **Indexes**: All timestamp and foreign key columns are indexed
2. **Aggregation**: Uses PostgreSQL aggregate functions
3. **Parallel Execution**: Uses asyncio.gather for concurrent queries
4. **Query Helpers**: Reusable query patterns for common operations

### Caching Strategy
1. **User Statistics**: 5-minute cache
2. **Content Statistics**: 5-minute cache
3. **Popular Content**: 10-minute cache
4. **System Statistics**: 1-minute cache (more volatile)

### Error Handling
- Graceful degradation for failed sub-queries
- Individual stat failures don't break the entire overview
- Detailed error messages in development mode

## Usage Examples

### Frontend Integration

```javascript
// Fetch dashboard overview
const response = await fetch('/admin/dashboard/overview', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
const data = await response.json();

// Display key metrics
document.getElementById('total-users').textContent = data.users.total;
document.getElementById('active-users').textContent = data.users.dau;
document.getElementById('total-recipes').textContent = data.content.recipes.total;
```

### Real-time Updates

```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('wss://api.jidelnicek.cz/admin/dashboard/ws');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'update') {
    updateDashboard(update.data);
  }
};
```

### Custom Date Ranges

```javascript
// Get statistics for custom date range
const startDate = '2024-01-01';
const endDate = '2024-01-31';

const stats = await fetch(
  `/admin/dashboard/users?start_date=${startDate}&end_date=${endDate}`,
  { headers: { 'Authorization': `Bearer ${adminToken}` } }
).then(r => r.json());
```

## Security Considerations

1. **Authentication**: All endpoints require admin role
2. **Rate Limiting**: Applied to prevent abuse
3. **Data Privacy**: No sensitive user data exposed
4. **Query Limits**: Result sets limited to prevent DoS
5. **Cache Headers**: Appropriate cache headers for CDN

## Future Enhancements

1. **Advanced Analytics**
   - Cohort analysis
   - User retention funnels
   - Recipe recommendation effectiveness

2. **Predictive Metrics**
   - User growth projections
   - Content trend predictions
   - System resource forecasting

3. **Custom Dashboards**
   - Configurable widget layouts
   - Saved dashboard templates
   - Role-based dashboard views

4. **Alerting System**
   - Configurable alert thresholds
   - Email/SMS notifications
   - Slack/Discord integrations

5. **Data Export**
   - Scheduled reports
   - CSV/Excel export
   - API for BI tools