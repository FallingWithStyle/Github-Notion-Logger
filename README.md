# Github-Notion-Logger

A webhook-based service that logs GitHub commits to Notion database.

## Features

- **Webhook endpoint** to receive GitHub commit events in real-time
- **Automatic logging** of commits to Notion database
- **One-time backfill script** to import historical commits from the last 6 months
- **Duplicate detection** to prevent duplicate entries during backfill
- **Deduplication tool** to clean existing duplicate entries
- **Speed optimizations** with configurable batch processing
- **Progress tracking** with detailed statistics

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.template .env
   ```
   Then edit `.env` with your actual values:
   ```
   NOTION_API_KEY=your_notion_api_key
   NOTION_DATABASE_ID=your_notion_database_id
   GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_OWNER=your_github_username_or_org
   GITHUB_REPO=your_repository_name  # Optional - omit to process all repos
   ```

## Usage

### Webhook Mode (Real-time)
Start the server to receive webhook events:
```bash
npm start
```

### Backfill Mode (One-time import)
To import commits from the last 6 months (default) or a custom period:

**For a single repository:**
```bash
node backfill.js
```
(Set `GITHUB_REPO` in your `.env` file)

**For all your repositories:**
```bash
node backfill.js
```
(Leave `GITHUB_REPO` unset in your `.env` file)

**Custom time period:**
```bash
node backfill.js --months 12
# or
node backfill.js -m 12
```
(Valid range: 1-72 months)

This will:
- Fetch all commits from the specified repository(s) from the last 6 months (default) or custom period
- Transform them to match the webhook format
- Log them to your Notion database in batches of 50 commits
- Include progress logging and rate limiting to avoid API limits
- Skip forked repositories when processing all repos
- Continue processing other repos if one fails
- **Automatically detect and skip duplicates** to prevent duplicate entries
- Show detailed statistics (new vs skipped commits)

### Deduplication Mode (Clean existing database)
To remove duplicate entries from your existing database:

```bash
node deduplicate.js
```

This will:
- Fetch all pages from your Notion database
- Identify duplicates based on commit message + repository + date
- Archive duplicate entries (keeping the first occurrence)
- Provide detailed statistics on the cleanup process
- Process in batches to avoid API rate limits

## Functions Overview

### `server.js` - Webhook Server
- **Purpose**: Receives GitHub webhook events for real-time commit logging
- **Endpoint**: `POST /webhook`
- **Features**: 
  - GitHub signature verification
  - Automatic commit logging to Notion
  - Error handling and logging

### `backfill.js` - Historical Data Import
- **Purpose**: One-time import of commits from the last 6 months (default) or custom period
- **Modes**: Single repository or all repositories
- **Parameters**: Optional `--months` or `-m` flag (1-72 months, defaults to 6)
- **Features**:
  - Duplicate detection and skipping
  - Configurable batch processing (50 commits/batch)
  - Progress tracking with statistics
  - Rate limiting for API safety

### `deduplicate.js` - Database Cleanup
- **Purpose**: Remove duplicate entries from existing database
- **Features**:
  - Identifies duplicates by commit message + repository + date
  - Archives duplicates (keeps first occurrence)
  - Batch processing for efficiency
  - Detailed cleanup statistics

### `notion.js` - Notion Integration
- **Purpose**: Core Notion API integration functions
- **Features**:
  - Database property mapping
  - Duplicate detection queries
  - Batch commit logging
  - Error handling and retry logic
