# GitHub Notion Logger API Documentation

## Overview

The GitHub Notion Logger API provides endpoints for commit logging and data retrieval, designed to work with Wanderjob and other external applications.

## Base URL

```
http://localhost:8080/api
```

## Authentication

Most endpoints require no authentication. Backfill operations require an API key:

- **Header**: `X-API-Key: your-backfill-key`
- **Alternative**: `Authorization: Bearer your-backfill-key`

## Endpoints

### 1. Log Commits

**POST** `/commits`

Log commits via API (alternative to webhook).

#### Request Body

```json
{
  "commits": [
    {
      "id": "wanderjob.com-abc123-0",
      "hash": "abc123def456...",
      "message": "feat: add commit logging system",
      "author": "Patrick",
      "date": "2024-01-15T10:30:00Z",
      "projectId": "wanderjob.com",
      "filesChanged": ["src/lib/api.ts", "src/components/DevJournal.tsx"],
      "additions": 150,
      "deletions": 25
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Commits logged successfully",
  "results": [
    {
      "id": "wanderjob.com-abc123-0",
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

---

### 2. Get Commits for Date

**GET** `/commits/{date}`

Retrieve all commits for a specific date.

#### Parameters

- `date` (path): Date in `YYYY-MM-DD` format
- `backfill` (query, optional): Set to `true` to trigger backfill before fetching

#### Example

```bash
GET /commits/2024-01-15
GET /commits/2024-01-15?backfill=true
```

#### Response

```json
{
  "success": true,
  "commits": [
    {
      "id": "wanderjob.com-abc123-0",
      "hash": "abc123def456...",
      "message": "feat: add commit logging system",
      "author": null,
      "date": "2024-01-15T10:30:00Z",
      "projectId": "wanderjob.com",
      "filesChanged": null,
      "additions": null,
      "deletions": null
    }
  ],
  "count": 1,
  "date": "2024-01-15"
}
```

---

### 3. Get Daily Summary

**GET** `/commits/summary/{date}`

Get aggregated daily summary with project stats and themes.

#### Parameters

- `date` (path): Date in `YYYY-MM-DD` format
- `backfill` (query, optional): Set to `true` to trigger backfill before generating summary

#### Example

```bash
GET /commits/summary/2024-01-15
GET /commits/summary/2024-01-15?backfill=true
```

#### Response

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
        "projectId": "wanderjob.com",
        "projectName": "Wanderjob.com",
        "commits": 5,
        "additions": 0,
        "deletions": 0
      },
      {
        "projectId": "avoros",
        "projectName": "Avoros",
        "commits": 3,
        "additions": 0,
        "deletions": 0
      }
    ],
    "themes": [
      "Feature Development",
      "Code Refactoring",
      "UI/UX Improvements"
    ],
    "summary": "Today had 8 commits across 2 projects. The main focus was on wanderjob.com. The work spanned 3 key areas: feature development, code refactoring, ui/ux improvements. Overall, this shows steady progress with focused, incremental improvements.",
    "topFiles": [
      {
        "file": "wanderjob.com",
        "changes": 5
      },
      {
        "file": "avoros",
        "changes": 3
      }
    ]
  }
}
```

---

### 4. Dedicated Backfill

**POST** `/commits/backfill`

Trigger backfill for a specific date and optional projects.

#### Authentication Required

- `X-API-Key` header with valid backfill key

#### Request Body

```json
{
  "date": "2024-01-15",
  "projects": ["wanderjob.com", "avoros"]
}
```

#### Parameters

- `date` (required): Date in `YYYY-MM-DD` format
- `projects` (optional): Array of project names (max 10)

#### Response

```json
{
  "success": true,
  "message": "Backfill completed for 2024-01-15",
  "date": "2024-01-15",
  "projects": "all",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Backfill Security

### Rate Limits

- **5 requests per hour** per API key
- **20 requests per day** per API key
- **5-minute cooldown** between attempts

### Date Restrictions

- **Maximum 30 days** in the past
- **No future dates** allowed
- **Default focus on last 24 hours**

### Error Responses

#### Rate Limit Exceeded

```json
{
  "success": false,
  "error": "Hourly limit exceeded",
  "retryAfter": 3600
}
```

#### Invalid Date Range

```json
{
  "success": false,
  "error": "Cannot backfill dates older than 30 days"
}
```

#### Authentication Required

```json
{
  "success": false,
  "error": "API key required"
}
```

---

## Data Format Notes

### Hybrid Format

The API uses a hybrid format that provides all requested fields but marks unavailable data as `null`:

- ✅ **Available**: `id`, `hash`, `message`, `date`, `projectId`
- ❌ **Not Available**: `author`, `filesChanged`, `additions`, `deletions` (returned as `null`)

### Timezone Handling

- All dates are processed using the configured timezone
- Date parameters should be in `YYYY-MM-DD` format
- Internal timestamps are stored in ISO format

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid API key)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

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
```

### With Backfill

```bash
# Get commits with backfill (requires API key)
curl -H "X-API-Key: your-key" "http://localhost:8080/api/commits/2024-01-15?backfill=true"

# Dedicated backfill
curl -X POST -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}' \
  "http://localhost:8080/api/commits/backfill"
```

---

## Integration with Wanderjob

These endpoints are designed to work seamlessly with Wanderjob:

1. **`POST /commits`** - For logging commits from Wanderjob
2. **`GET /commits/{date}`** - For retrieving commit data
3. **`GET /commits/summary/{date}`** - For getting daily summaries
4. **`POST /commits/backfill`** - For ensuring data completeness

The hybrid data format provides all necessary information for AI processing while clearly indicating what data is available vs. unavailable.
