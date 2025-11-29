# GitHub Notion Logger (GNL) API Reference

Complete API documentation for the GitHub Notion Logger service. This document provides comprehensive information about all available endpoints, request/response formats, authentication, and usage examples.

## Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [API Versions](#api-versions)
- [Endpoints](#endpoints)
  - [Commits](#commits)
  - [Webhooks](#webhooks)
  - [Projects](#projects)
  - [Project Progress](#project-progress)
  - [PRD Stories](#prd-stories)
  - [Weekly Planning](#weekly-planning)
  - [Color Palette](#color-palette)
  - [Timezone Configuration](#timezone-configuration)
  - [Wanderlog](#wanderlog)
  - [AI Services](#ai-services)
  - [Llama Hub](#llama-hub)
  - [Cache Management](#cache-management)
  - [Performance Monitoring](#performance-monitoring)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Data Models](#data-models)

## Base Information

### Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:8080/api
```

### Content Type

All requests and responses use `application/json` unless otherwise specified.

### CORS

CORS is enabled for all origins. The API supports:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key`

## Authentication

### API Key Authentication

Some endpoints require authentication via API key:

**Header Format:**
```
X-API-Key: your-api-key
```

**Alternative Format:**
```
Authorization: Bearer your-api-key
```

### Webhook Signature Verification

Webhook endpoints verify GitHub signatures using the `X-Hub-Signature-256` header.

## API Versions

This API does not use versioning. All endpoints are under the base `/api` path.

## Endpoints

### API Documentation

#### Get API Documentation

Get comprehensive API documentation in JSON format for programmatic access.

**Endpoint:** `GET /api/docs`

**Response:**
```json
{
  "success": true,
  "data": {
    "baseUrl": "http://localhost:8080/api",
    "documentation": {
      "markdown": "# GitHub Notion Logger (GNL) API Reference...",
      "url": "http://localhost:8080/docs/API_REFERENCE.md"
    },
    "endpoints": {
      "commits": { /* endpoint definitions */ },
      "projects": { /* endpoint definitions */ },
      "progress": { /* endpoint definitions */ },
      "ai": { /* endpoint definitions */ }
    },
    "authentication": {
      "apiKey": {
        "description": "Some endpoints require API key authentication",
        "header": "X-API-Key: your-api-key"
      }
    },
    "rateLimiting": {
      "backfill": {
        "perHour": 5,
        "perDay": 20,
        "cooldown": "5 minutes"
      }
    },
    "version": "1.0.0",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

This endpoint provides:
- Complete endpoint list with methods, paths, and descriptions
- Authentication requirements for each endpoint
- Query parameters and request body schemas
- Rate limiting information
- Link to full markdown documentation

### Commits

#### Log Commits

Log commits via API (alternative to webhook).

**Endpoint:** `POST /api/commits`

**Request Body:**
```json
{
  "commits": [
    {
      "id": "project-name-abc123-0",
      "hash": "abc123def456...",
      "message": "feat: add commit logging system",
      "author": "Patrick",
      "date": "2024-01-15T10:30:00Z",
      "projectId": "project-name",
      "filesChanged": ["src/lib/api.ts", "src/components/DevJournal.tsx"],
      "additions": 150,
      "deletions": 25
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Commits logged successfully",
  "results": [
    {
      "id": "project-name-abc123-0",
      "success": true,
      "processed": 1,
      "skipped": 0
    }
  ],
  "summary": {
    "total": 1,
    "success": 1,
    "errors": 0
  }
}
```

#### Get Commits for Date

Retrieve all commits for a specific date.

**Endpoint:** `GET /api/commits/:date`

**Path Parameters:**
- `date` (required): Date in `YYYY-MM-DD` format

**Query Parameters:**
- `backfill` (optional): Set to `true` to trigger backfill before fetching (requires API key)

**Response:**
```json
{
  "success": true,
  "date": "2024-01-15",
  "commits": {
    "project-name": 5,
    "another-project": 3
  },
  "totalCommits": 8,
  "message": "Found 8 commits for 2024-01-15"
}
```

#### Get Daily Summary

Get aggregated daily summary with project stats and themes.

**Endpoint:** `GET /api/commits/summary/:date`

**Path Parameters:**
- `date` (required): Date in `YYYY-MM-DD` format

**Query Parameters:**
- `backfill` (optional): Set to `true` to trigger backfill before generating summary (requires API key)

**Response:**
```json
{
  "success": true,
  "summary": {
    "date": "2024-01-15",
    "totalCommits": 8,
    "totalAdditions": 0,
    "totalDeletions": 0,
    "projects": [
      {
        "projectId": "project-name",
        "projectName": "Project Name",
        "commits": 5,
        "additions": 0,
        "deletions": 0
      }
    ],
    "themes": [
      "Feature Development",
      "Code Refactoring",
      "UI/UX Improvements"
    ],
    "summary": "Today had 8 commits across 2 projects. The main focus was on project-name. The work spanned 3 key areas: feature development, code refactoring, ui/ux improvements. Overall, this shows steady progress with focused, incremental improvements.",
    "topFiles": [
      {
        "file": "project-name",
        "changes": 5
      }
    ]
  }
}
```

#### Dedicated Backfill

Trigger backfill for a specific date and optional projects.

**Endpoint:** `POST /api/commits/backfill`

**Authentication Required:**
- `X-API-Key` header with valid backfill key

**Request Body:**
```json
{
  "date": "2024-01-15",
  "projects": ["project-name", "another-project"]
}
```

**Parameters:**
- `date` (required): Date in `YYYY-MM-DD` format
- `projects` (optional): Array of project names (max 10)

**Response:**
```json
{
  "success": true,
  "message": "Backfill completed for 2024-01-15",
  "date": "2024-01-15",
  "projects": "all",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Webhooks

#### GitHub Webhook

Receive and process GitHub commit webhooks.

**Endpoint:** `POST /api/webhook`

**Headers:**
- `X-Hub-Signature-256`: GitHub webhook signature (required)

**Request Body:**
GitHub webhook payload (standard GitHub push event format)

**Response:**
```json
{
  "accepted": true,
  "commits": 3,
  "repo": "owner/repository"
}
```

**Note:** This endpoint responds immediately with 202 Accepted and processes commits asynchronously.

### Projects

#### Get Projects

Get paginated project overview with health indicators and filtering.

**Endpoint:** `GET /api/projects`

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 100): Items per page
- `category` (optional): Filter by category
- `search` (optional): Search query
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "projects": [
    {
      "name": "Project Name",
      "repository": "project-repo",
      "status": "active",
      "category": "Web Development",
      "health": {
        "status": "excellent",
        "healthScore": 85,
        "lastActivity": "2024-01-15T10:30:00Z"
      },
      "progress": 75,
      "storiesTotal": 20,
      "storiesCompleted": 15,
      "tasksTotal": 50,
      "tasksCompleted": 40,
      "completionPercentage": 75,
      "lastActivity": "2024-01-15T10:30:00Z",
      "activityStatus": "recent",
      "totalCommits": 150,
      "color": "#667eea",
      "hasPrd": true,
      "hasTaskList": true,
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 50,
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

#### Get Projects

Get project overview with advanced filtering and health indicators.

**Endpoint:** `GET /api/projects`

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page
- `category` (optional): Filter by category
- `status` (optional): Filter by status
- `healthStatus` (optional): Filter by health status (`excellent`, `good`, `fair`, `poor`, `critical`)
- `activityStatus` (optional): Filter by activity status (`recent`, `moderate`, `stale`, `inactive`)
- `search` (optional): Search query
- `sortBy` (optional, default: `lastActivity`): Sort field

#### Get Project Health

Get detailed health status for a specific project.

**Endpoint:** `GET /api/projects/:projectName/health`

**Path Parameters:**
- `projectName` (required): Name of the project

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "healthScore": 85,
    "lastActivity": "2024-01-15T10:30:00Z",
    "prdStatus": "present",
    "taskListStatus": "present",
    "completionVelocity": 2.5,
    "riskFactors": [],
    "healthStatus": "excellent",
    "lastUpdated": "2024-01-15T10:30:00Z"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

#### Get Project Categories

Get available project categories with statistics.

**Endpoint:** `GET /api/projects/categories`

**Response:**
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

#### Search Projects

Search projects with filters.

**Endpoint:** `GET /api/projects/search`

**Query Parameters:**
- `q` (required): Search query (minimum 2 characters)
- `category` (optional): Filter by category
- `status` (optional): Filter by status
- `healthStatus` (optional): Filter by health status
- `activityStatus` (optional): Filter by activity status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Project Name",
      "repository": "project-repo",
      "status": "active",
      "category": "Web Development",
      "health": { /* ProjectHealthModel */ },
      "progress": 75
    }
  ],
  "metadata": {
    "query": "search term",
    "total": 5,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Project Progress

#### Get Project Progress

Get project progress data with optional story details.

**Endpoint:** `GET /api/project-progress`

**Query Parameters:**
- `repository` (optional): Filter by repository name
- `includeStories` (optional, default: `true`): Include story details

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "repository": "project-name",
      "progress": {
        "progressPercentage": 75,
        "storiesTotal": 20,
        "storiesCompleted": 15,
        "tasksTotal": 50,
        "tasksCompleted": 40
      },
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "cached": false,
  "timestamp": 1705315800000
}
```

#### Get Progress for Specific Repository

**Endpoint:** `GET /api/project-progress/:repository`

**Path Parameters:**
- `repository` (required): Repository name

**Query Parameters:**
- `includeStories` (optional, default: `true`): Include story details

**Response:** Same format as `/api/project-progress`

#### Clear Progress Cache

**Endpoint:** `POST /api/project-progress/clear-cache`

**Request Body:**
```json
{
  "repository": "project-name" // optional, omit to clear all
}
```

**Response:**
```json
{
  "success": true,
  "message": "Progress cache cleared for project-name",
  "repository": "project-name"
}
```

### PRD Stories

#### Get PRD Stories

Get all PRD stories with filtering.

**Endpoint:** `GET /api/prd-stories`

**Query Parameters:**
- `projectName` (optional): Filter by project name
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "story-id",
      "projectName": "Project Name",
      "storyTitle": "Story Title",
      "storyDescription": "Story description",
      "priority": "High",
      "status": "In Progress",
      "created": "2024-01-15T10:30:00Z",
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "filters": {
    "projectName": null,
    "status": null
  }
}
```

#### Get Repositories

Get list of repositories with PRD/task list status.

**Endpoint:** `GET /api/prd-stories/repositories`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "repository-name",
      "url": "https://github.com/owner/repository-name",
      "lastUpdated": "2024-01-15T10:30:00Z",
      "hasPrd": true,
      "hasTaskList": true,
      "status": "prd-and-tasks"
    }
  ],
  "count": 1
}
```

#### Process Repository

Process a specific repository for PRD and task-list files.

**Endpoint:** `POST /api/prd-stories/process-repo`

**Request Body:**
```json
{
  "repository": "repository-name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "repository-name",
    "status": "prd-and-tasks",
    "prdCount": 1,
    "taskCount": 25,
    "storyCount": 10,
    "progress": 75,
    "lastUpdated": "2024-01-15T10:30:00Z",
    "stories": [ /* story objects */ ],
    "tasks": [ /* task objects */ ],
    "progressDetails": { /* progress object */ }
  }
}
```

#### Ignore Repository

Add a repository to the ignored list.

**Endpoint:** `POST /api/prd-stories/ignore-repo`

**Request Body:**
```json
{
  "repository": "repository-name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Repository repository-name has been ignored",
  "ignoredRepos": ["repository-name"]
}
```

#### Get Ignored Repositories

**Endpoint:** `GET /api/prd-stories/ignored`

**Response:**
```json
{
  "success": true,
  "data": ["repository-name"],
  "count": 1
}
```

#### Unignore Repository

**Endpoint:** `POST /api/prd-stories/unignore-repo`

**Request Body:**
```json
{
  "repository": "repository-name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Repository repository-name has been unignored",
  "ignoredRepos": []
}
```

#### Create PRD Story

**Endpoint:** `POST /api/prd-stories`

**Request Body:**
```json
{
  "projectName": "Project Name",
  "storyTitle": "Story Title",
  "storyDescription": "Story description",
  "priority": "Medium",
  "status": "Not Started"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "story-id",
    "projectName": "Project Name",
    "storyTitle": "Story Title",
    "storyDescription": "Story description",
    "priority": "Medium",
    "status": "Not Started"
  }
}
```

#### Update PRD Story

**Endpoint:** `PUT /api/prd-stories/:id`

**Path Parameters:**
- `id` (required): Story ID

**Request Body:**
```json
{
  "status": "In Progress",
  "priority": "High"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "story-id",
    "projectName": "Project Name",
    "storyTitle": "Story Title",
    "status": "In Progress",
    "priority": "High"
  }
}
```

#### Clear PRD Stories Cache

**Endpoint:** `POST /api/prd-stories/clear-cache`

**Response:**
```json
{
  "success": true,
  "message": "PRD stories cache cleared"
}
```

### Weekly Planning

#### Create or Update Weekly Plan

**Endpoint:** `POST /api/weekly-plan`

**Request Body:**
```json
{
  "weekStartDate": "2024-01-15",
  "projects": [
    {
      "projectName": "Project Name",
      "focus": "Main focus for the week",
      "goals": ["Goal 1", "Goal 2"]
    }
  ],
  "focusAreas": ["Area 1", "Area 2"],
  "goals": ["Goal 1", "Goal 2"],
  "notes": "Additional notes",
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "plan-id",
    "weekStartDate": "2024-01-15",
    "projects": [ /* project objects */ ],
    "focusAreas": ["Area 1", "Area 2"],
    "goals": ["Goal 1", "Goal 2"],
    "notes": "Additional notes",
    "timezone": "America/New_York"
  },
  "isUpdate": false
}
```

#### Get Weekly Plans

**Endpoint:** `GET /api/weekly-plans`

**Query Parameters:**
- `limit` (optional, default: 50): Maximum number of plans to return
- `offset` (optional, default: 0): Number of plans to skip

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-id",
      "weekStartDate": "2024-01-15",
      "projects": [ /* project objects */ ],
      "focusAreas": ["Area 1", "Area 2"],
      "goals": ["Goal 1", "Goal 2"],
      "notes": "Additional notes",
      "timezone": "America/New_York"
    }
  ],
  "count": 1,
  "total": 10,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Sync Weekly Plan to Notion

**Endpoint:** `POST /api/weekly-plan/sync-notion`

**Request Body:** Same as `POST /api/weekly-plan`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "plan-id",
    "weekStartDate": "2024-01-15"
  },
  "message": "Weekly plan synced to Notion successfully"
}
```

#### Get Weekly Plan from Notion

**Endpoint:** `GET /api/weekly-plan/notion`

**Query Parameters:**
- `weekStartDate` (optional): Filter by week start date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-id",
      "weekStartDate": "2024-01-15",
      "projects": [ /* project objects */ ],
      "focusAreas": ["Area 1", "Area 2"],
      "goals": ["Goal 1", "Goal 2"],
      "notes": "Additional notes"
    }
  ],
  "count": 1
}
```

#### Get Weekly Data

Get comprehensive weekly data including Notion data, commit log, and color stats.

**Endpoint:** `GET /api/weekly-data`

**Query Parameters:**
- `weekStart` (optional): Filter by week start date

**Response:**
```json
{
  "success": true,
  "data": {
    "notion": [ /* weekly planning entries */ ],
    "commitLog": [ /* commit log entries */ ],
    "colorStats": { /* color statistics */ },
    "projectColors": { /* project color mappings */ }
  },
  "count": 1
}
```

#### Fetch Notion Data

**Endpoint:** `GET /api/fetch-notion-data`

**Query Parameters:**
- `weekStart` (optional): Filter by week start date

**Response:** Same as `/api/weekly-data`

### Color Palette

#### Get Color Palette Statistics

**Endpoint:** `GET /api/color-palette/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalProjects": 25,
    "categories": {
      "Web Development": {
        "count": 10,
        "colors": ["#667eea", "#764ba2"]
      }
    }
  }
}
```

#### Get Project Color

**Endpoint:** `GET /api/color-palette/project/:projectName`

**Path Parameters:**
- `projectName` (required): Project name

**Response:**
```json
{
  "success": true,
  "data": {
    "projectName": "Project Name",
    "color": "#667eea"
  }
}
```

#### Update Project Color

**Endpoint:** `PUT /api/color-palette/project/:projectName`

**Path Parameters:**
- `projectName` (required): Project name

**Request Body:**
```json
{
  "color": "#667eea"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "projectName": "Project Name",
    "color": "#667eea"
  }
}
```

#### Generate Color Palette

**Endpoint:** `POST /api/color-palette/generate`

**Request Body:**
```json
{
  "category": "Web Development",
  "hue": 260
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "category": "Web Development",
    "hue": 260,
    "palette": ["#667eea", "#764ba2", "#f093fb"]
  }
}
```

#### Migrate Projects to Color System

**Endpoint:** `POST /api/color-palette/migrate`

**Response:**
```json
{
  "success": true,
  "data": {
    "migrated": 25,
    "skipped": 5
  }
}
```

#### Get Category Colors

**Endpoint:** `GET /api/color-palette/category/:category`

**Path Parameters:**
- `category` (required): Category name

**Response:**
```json
{
  "success": true,
  "data": {
    "category": "Web Development",
    "colors": ["#667eea", "#764ba2"]
  }
}
```

#### Update Category Colors

**Endpoint:** `POST /api/color-palette/update-category-colors`

**Request Body:**
```json
{
  "category": "Web Development",
  "colors": ["#667eea", "#764ba2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "category": "Web Development",
    "colors": ["#667eea", "#764ba2"]
  }
}
```

#### Reset All Colors

**Endpoint:** `POST /api/color-palette/reset-colors`

**Response:**
```json
{
  "success": true,
  "data": {
    "reset": 25
  }
}
```

### Timezone Configuration

#### Get Timezone Configuration

**Endpoint:** `GET /api/timezone-config`

**Response:**
```json
{
  "success": true,
  "data": {
    "timezone": "America/New_York",
    "offset": -5
  }
}
```

#### Update Timezone Configuration

**Endpoint:** `POST /api/timezone-config`

**Request Body:**
```json
{
  "timezone": "America/New_York",
  "offset": -5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timezone": "America/New_York",
    "offset": -5
  },
  "message": "Timezone configuration updated successfully"
}
```

### Wanderlog

#### Process Wanderlog

**Endpoint:** `POST /api/wanderlog/process`

**Request Body:**
```json
{
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wanderlog processing completed successfully",
  "result": { /* processing result */ }
}
```

#### Get Wanderlog Data

**Endpoint:** `GET /api/wanderlog`

**Query Parameters:**
- `date` (optional): Filter by date

**Response:**
```json
{
  "success": true,
  "data": [ /* wanderlog entries */ ],
  "message": "Wanderlog data retrieved successfully"
}
```

#### Get Wanderlog Range

**Endpoint:** `GET /api/wanderlog/range`

**Query Parameters:**
- `startDate` (required): Start date in `YYYY-MM-DD` format
- `endDate` (required): End date in `YYYY-MM-DD` format

**Response:**
```json
{
  "success": true,
  "data": [ /* wanderlog entries */ ],
  "message": "Wanderlog range data retrieved successfully"
}
```

#### Get Wanderlog for Date

**Endpoint:** `GET /api/wanderlog/date/:date`

**Path Parameters:**
- `date` (required): Date in `YYYY-MM-DD` format

**Response:**
```json
{
  "success": true,
  "date": "2024-01-15",
  "data": [ /* wanderlog entries */ ],
  "message": "Wanderlog data for date retrieved successfully"
}
```

#### Get Wanderlog Statistics

**Endpoint:** `GET /api/wanderlog/stats`

**Response:**
```json
{
  "success": true,
  "stats": { /* statistics object */ },
  "message": "Wanderlog stats retrieved successfully"
}
```

### AI Services

#### AI Chat

**Endpoint:** `POST /api/ai/chat`

**Request Body:**
```json
{
  "message": "What are my focus areas this week?",
  "sessionId": "session-id",
  "contextType": "portfolio",
  "options": {
    "maxTokens": 1000,
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "Based on your project data...",
  "sessionId": "session-id",
  "context": {
    "type": "portfolio",
    "dataSize": 1024
  },
  "validation": { /* validation object */ }
}
```

#### AI Recommendations

**Endpoint:** `POST /api/ai/recommendations`

**Request Body:**
```json
{
  "message": "What are some quick wins?",
  "sessionId": "session-id",
  "contextType": "quickWins"
}
```

**Response:** Same format as `/api/ai/chat`

#### AI Analyze

**Endpoint:** `POST /api/ai/analyze`

**Request Body:**
```json
{
  "analysisType": "quickWins",
  "projectFilter": "project-name"
}
```

**Response:** Same format as `/api/ai/chat`

#### AI Health Check

**Endpoint:** `GET /api/ai/health`

**Response:**
```json
{
  "success": true,
  "gnlAssistant": { /* assistant health data */ },
  "proxy": {
    "status": "connected",
    "url": "http://localhost:4250"
  }
}
```

### Llama Hub

#### Health Check

**Endpoint:** `GET /api/llama/health`

**Response:**
```json
{
  "success": true,
  "health": { /* health status */ }
}
```

#### Get Available Models

**Endpoint:** `GET /api/llama/models`

**Response:**
```json
{
  "success": true,
  "models": ["llama3-7b", "llama3-8b", "llama3-70b"]
}
```

#### Chat Completion

**Endpoint:** `POST /api/llama/chat`

**Request Body:**
```json
{
  "message": "Hello, how are you?",
  "model": "llama3-7b"
}
```

**Response:**
```json
{
  "success": true,
  "response": "I'm doing well, thank you!"
}
```

#### Generate Text

**Endpoint:** `POST /api/llama/generate`

**Request Body:**
```json
{
  "prompt": "Write a commit message for...",
  "model": "llama3-7b"
}
```

**Response:**
```json
{
  "success": true,
  "response": "feat: add new feature..."
}
```

#### Analyze Project

**Endpoint:** `POST /api/llama/analyze-project`

**Request Body:**
```json
{
  "projectData": { /* project data object */ },
  "model": "llama3-7b"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": { /* analysis result */ }
}
```

#### Suggest Commit Message

**Endpoint:** `POST /api/llama/suggest-commit`

**Request Body:**
```json
{
  "changes": { /* git changes object */ },
  "model": "llama3-7b"
}
```

**Response:**
```json
{
  "success": true,
  "suggestion": "feat: add new feature..."
}
```

### Progress Tracking

#### Get Progress Analytics

**Endpoint:** `GET /api/progress/analytics`

**Query Parameters:**
- `projectName` (optional): Filter by project name
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page
- `minCompletion` (optional): Minimum completion percentage
- `maxCompletion` (optional): Maximum completion percentage
- `minVelocity` (optional): Minimum velocity

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
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
        "trend": "increasing",
        "blockedItems": [],
        "staleItems": [],
        "lastUpdated": "2024-01-15T10:30:00Z"
      }
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

#### Get Incomplete Work

**Endpoint:** `GET /api/progress/incomplete`

**Query Parameters:** Same as `/api/progress/analytics`

**Response:**
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

#### Get Velocity Trends

**Endpoint:** `GET /api/progress/velocity`

**Query Parameters:**
- `projectName` (optional): Specific project name

**Response:**
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

#### Get Blocked and Stale Items

**Endpoint:** `GET /api/progress/blocked`

**Query Parameters:** Same as `/api/progress/analytics`

**Response:**
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

### Cache Management

#### Clear Project Cache

**Endpoint:** `POST /api/cache/projects/clear`

**Response:**
```json
{
  "success": true,
  "message": "Project management cache cleared successfully"
}
```

#### Clear Progress Cache

**Endpoint:** `POST /api/cache/progress/clear`

**Response:**
```json
{
  "success": true,
  "message": "Progress tracking cache cleared successfully"
}
```

#### Get Cache Status

**Endpoint:** `GET /api/cache/status`

**Response:**
```json
{
  "success": true,
  "caches": {
    "projects": {
      "size": 25,
      "timeout": 300000,
      "entries": ["overview:{}", "health:project1"]
    },
    "progress": {
      "size": 15,
      "timeout": 300000,
      "entries": ["analytics:{}", "incomplete:{}"]
    }
  }
}
```

### Performance Monitoring

#### Get Performance Statistics

**Endpoint:** `GET /api/performance/stats`

**Response:**
```json
{
  "success": true,
  "performance": {
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

#### Clear Performance Caches

**Endpoint:** `POST /api/performance/clear`

**Response:**
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
  "details": "Additional error details",
  "metadata": {
    "errorType": "validation|server_error|data_consistency|network|rate_limit|authentication|not_found",
    "severity": "low|medium|high",
    "context": "operation_context",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common HTTP Status Codes

- `200` - Success
- `202` - Accepted (async processing)
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid API key)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

## Rate Limiting

### Backfill Operations

Rate limits for backfill operations (when using `?backfill=true` or dedicated backfill endpoints):

- **5 requests per hour** per API key
- **20 requests per day** per API key
- **5-minute cooldown** between attempts

### Date Restrictions

- **Maximum 30 days** in the past
- **No future dates** allowed
- **Default focus on last 24 hours**

### Rate Limit Response

```json
{
  "success": false,
  "error": "Hourly limit exceeded",
  "retryAfter": 3600
}
```

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

## Examples

### Basic Usage

```bash
# Get commits for today
curl "http://localhost:8080/api/commits/2024-01-15"

# Get daily summary
curl "http://localhost:8080/api/commits/summary/2024-01-15"

# Log new commits
curl -X POST "http://localhost:8080/api/commits" \
  -H "Content-Type: application/json" \
  -d '{"commits": [{"id": "test-123", "message": "test commit", "date": "2024-01-15T10:30:00Z", "projectId": "test-project"}]}'

# Get projects
curl "http://localhost:8080/api/projects?page=1&limit=20"

# Get project health
curl "http://localhost:8080/api/projects/my-project/health"
```

### With Authentication

```bash
# Get commits with backfill (requires API key)
curl -H "X-API-Key: your-key" "http://localhost:8080/api/commits/2024-01-15?backfill=true"

# Dedicated backfill
curl -X POST -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}' \
  "http://localhost:8080/api/commits/backfill"
```

### JavaScript/TypeScript Example

```javascript
const baseURL = 'http://localhost:8080/api';

// Get projects
async function getProjects() {
  const response = await fetch(`${baseURL}/projects?page=1&limit=20`);
  const data = await response.json();
  return data;
}

// Log commits
async function logCommits(commits) {
  const response = await fetch(`${baseURL}/commits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ commits }),
  });
  const data = await response.json();
  return data;
}

// Get project health
async function getProjectHealth(projectName) {
  const response = await fetch(`${baseURL}/v2/projects/${projectName}/health`);
  const data = await response.json();
  return data;
}
```

## Support

For issues, questions, or contributions, please refer to the project repository or contact the maintainers.

---

**Last Updated:** 2024-01-15  
**API Version:** 1.0.0 (no versioning)  
**Documentation Version:** 1.0.0

