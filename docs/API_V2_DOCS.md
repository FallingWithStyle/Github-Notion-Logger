# GitHub Notion Logger API v2 Documentation

## Overview

API v2 provides enhanced project management and progress tracking capabilities for Epic 9. This version introduces new data models, improved error handling, performance optimizations, and comprehensive analytics.

## Base URL

```
http://localhost:8080/api/v2
```

## Authentication

Most endpoints require no authentication. Some administrative endpoints may require API keys in the future.

## Data Models

### Project Health Model
```json
{
  "status": "active|planning|paused|completed|unknown",
  "healthScore": 85,
  "lastActivity": "2024-01-15T10:30:00Z",
  "prdStatus": "present|missing|outdated",
  "taskListStatus": "present|missing|outdated",
  "completionVelocity": 2.5,
  "riskFactors": ["No recent activity", "Missing PRD"],
  "healthStatus": "excellent|good|fair|poor|critical",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Project Overview Model
```json
{
  "name": "Project Name",
  "repository": "project-repo",
  "status": "active",
  "category": "Web Development",
  "health": { /* ProjectHealthModel */ },
  "progress": 75,
  "storiesTotal": 20,
  "storiesCompleted": 15,
  "tasksTotal": 50,
  "tasksCompleted": 40,
  "completionPercentage": 75,
  "lastActivity": "2024-01-15T10:30:00Z",
  "activityStatus": "recent|moderate|stale|inactive",
  "totalCommits": 150,
  "color": "#667eea",
  "hasPrd": true,
  "hasTaskList": true,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Progress Analytics Model
```json
{
  "projectId": "project-name",
  "projectName": "Project Name",
  "totalStories": 20,
  "completedStories": 15,
  "totalTasks": 50,
  "completedTasks": 40,
  "incompleteStories": 5,
  "incompleteTasks": 10,
  "storyCompletionPercentage": 75,
  "taskCompletionPercentage": 80,
  "overallCompletionPercentage": 78,
  "velocity": 2.5,
  "trend": "increasing|decreasing|stable",
  "blockedItems": [],
  "staleItems": [],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## Project Overview Endpoints

### Get Project Overview
**GET** `/projects/overview`

Get paginated project overview with health indicators and filtering.

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `category` (string, optional): Filter by category
- `status` (string, optional): Filter by status
- `healthStatus` (string, optional): Filter by health status
- `activityStatus` (string, optional): Filter by activity status
- `search` (string, optional): Search query
- `sortBy` (string, optional): Sort field (default: 'lastActivity')

#### Response
```json
{
  "success": true,
  "data": [
    { /* ProjectOverviewModel */ }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false,
    "startIndex": 0,
    "endIndex": 20
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

### Get Project Health
**GET** `/projects/{projectName}/health`

Get detailed health status for a specific project.

#### Path Parameters
- `projectName` (string): Name of the project

#### Response
```json
{
  "success": true,
  "data": { /* ProjectHealthModel */ },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

### Get Project Categories
**GET** `/projects/categories`

Get available project categories with statistics.

#### Response
```json
{
  "success": true,
  "data": [
    {
      "name": "Web Development",
      "count": 15,
      "activeCount": 12,
      "averageHealth": 78
    }
  ],
  "metadata": {
    "total": 5,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Search Projects
**GET** `/projects/search`

Search projects with filters.

#### Query Parameters
- `q` (string, required): Search query (minimum 2 characters)
- `category` (string, optional): Filter by category
- `status` (string, optional): Filter by status
- `healthStatus` (string, optional): Filter by health status
- `activityStatus` (string, optional): Filter by activity status

#### Response
```json
{
  "success": true,
  "data": [
    { /* ProjectOverviewModel */ }
  ],
  "metadata": {
    "query": "search term",
    "total": 5,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Progress Tracking Endpoints

### Get Progress Analytics
**GET** `/progress/analytics`

Get detailed progress analytics for all projects.

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `projectName` (string, optional): Filter by project name
- `minCompletion` (number, optional): Minimum completion percentage
- `maxCompletion` (number, optional): Maximum completion percentage
- `minVelocity` (number, optional): Minimum velocity

#### Response
```json
{
  "success": true,
  "data": {
    "projects": [
      { /* ProgressAnalyticsModel */ }
    ],
    "aggregate": {
      "totalProjects": 25,
      "averageCompletion": 68,
      "totalStories": 500,
      "completedStories": 340,
      "totalTasks": 1200,
      "completedTasks": 800,
      "totalIncomplete": 560,
      "averageVelocity": 2.3,
      "projectsWithBlockedItems": 5,
      "projectsWithStaleItems": 8,
      "completionRate": 68
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

### Get Incomplete Work
**GET** `/progress/incomplete`

Get tracking of incomplete work items.

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `projectName` (string, optional): Filter by project name
- `minCompletion` (number, optional): Minimum completion percentage
- `maxCompletion` (number, optional): Maximum completion percentage
- `minVelocity` (number, optional): Minimum velocity

#### Response
```json
{
  "success": true,
  "data": [
    {
      "projectId": "project-name",
      "projectName": "Project Name",
      "incompleteStories": 5,
      "incompleteTasks": 10,
      "totalIncomplete": 15,
      "completionPercentage": 75,
      "velocity": 2.5,
      "blockedItems": [],
      "staleItems": [],
      "priority": 85
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

### Get Velocity Trends
**GET** `/progress/velocity`

Get velocity trends for projects.

#### Query Parameters
- `projectName` (string, optional): Specific project name

#### Response
```json
{
  "success": true,
  "data": {
    "overall": {
      "trend": "stable",
      "velocity": 2.3,
      "change": 0.1
    },
    "projects": [
      {
        "projectName": "Project Name",
        "velocity": 2.5,
        "trend": "increasing",
        "change": 0.3
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

### Get Blocked and Stale Items
**GET** `/progress/blocked`

Get blocked and stale work items.

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `projectName` (string, optional): Filter by project name
- `minCompletion` (number, optional): Minimum completion percentage
- `maxCompletion` (number, optional): Maximum completion percentage
- `minVelocity` (number, optional): Minimum velocity

#### Response
```json
{
  "success": true,
  "data": {
    "blockedItems": [
      {
        "id": "story-123",
        "title": "Blocked Story",
        "projectName": "Project Name",
        "projectId": "project-name",
        "lastActivity": "2024-01-10T10:30:00Z",
        "reason": "Waiting for dependency"
      }
    ],
    "staleItems": [
      {
        "id": "task-456",
        "title": "Stale Task",
        "projectName": "Project Name",
        "projectId": "project-name",
        "lastActivity": "2024-01-05T10:30:00Z",
        "daysSinceActivity": 10
      }
    ],
    "summary": {
      "totalBlocked": 3,
      "totalStale": 7,
      "projectsWithBlockedItems": 2,
      "projectsWithStaleItems": 4
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalBlocked": 3,
    "totalStale": 7,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

## Cache Management Endpoints

### Clear Project Cache
**POST** `/cache/projects/clear`

Clear project management cache.

#### Response
```json
{
  "success": true,
  "message": "Project management cache cleared successfully"
}
```

### Clear Progress Cache
**POST** `/cache/progress/clear`

Clear progress tracking cache.

#### Response
```json
{
  "success": true,
  "message": "Progress tracking cache cleared successfully"
}
```

### Get Cache Status
**GET** `/cache/status`

Get cache status and statistics.

#### Response
```json
{
  "success": true,
  "data": {
    "projects": {
      "size": 25,
      "timeout": 300000,
      "entries": ["overview:{}", "health:project1"]
    },
    "progress": {
      "size": 15,
      "timeout": 300000,
      "entries": ["analytics:{}", "incomplete:{}"]
    },
    "totalEntries": 40
  }
}
```

## Performance Endpoints

### Get Performance Statistics
**GET** `/performance/stats`

Get performance statistics and metrics.

#### Response
```json
{
  "success": true,
  "data": {
    "projects": {
      "totalOperations": 150,
      "averageDuration": 45,
      "averageThroughput": 12.5,
      "operations": {
        "dataAggregation": {
          "count": 50,
          "averageDuration": 30,
          "averageThroughput": 15.2
        }
      },
      "cacheStats": {
        "size": 25,
        "maxSize": 1000,
        "hitRate": 85.5
      }
    },
    "progress": {
      "totalOperations": 100,
      "averageDuration": 35,
      "averageThroughput": 18.3,
      "operations": {
        "sorting": {
          "count": 30,
          "averageDuration": 20,
          "averageThroughput": 25.0
        }
      },
      "cacheStats": {
        "size": 15,
        "maxSize": 1000,
        "hitRate": 78.2
      }
    },
    "combined": {
      "totalOperations": 250,
      "averageDuration": 40,
      "averageThroughput": 15.4
    }
  }
}
```

### Clear Performance Caches
**POST** `/performance/clear`

Clear all performance caches.

#### Response
```json
{
  "success": true,
  "message": "All performance caches cleared successfully"
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "metadata": {
    "errorType": "network|validation|server_error|data_consistency",
    "severity": "low|medium|high",
    "context": "operation_context",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Types
- `network`: Network connectivity issues
- `rate_limit`: API rate limiting
- `authentication`: Authentication failures
- `not_found`: Data not found
- `server_error`: Internal server errors
- `data_consistency`: Data consistency issues
- `validation`: Input validation errors

## Performance Considerations

- All endpoints support pagination to handle large datasets
- Caching is implemented with 5-minute timeouts
- Performance metrics are tracked for optimization
- Batch processing is used for large operations
- LRU cache eviction prevents memory issues

## Rate Limiting

- No explicit rate limiting is currently implemented
- Consider implementing rate limiting for production use
- Monitor performance statistics for optimization opportunities

## Versioning

- Current version: v2
- Backward compatibility with v1 endpoints maintained
- New features added to v2 endpoints only
