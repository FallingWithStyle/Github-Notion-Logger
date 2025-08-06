# Github-Notion-Logger

A webhook-based service that logs GitHub commits to Notion database.

## Features

- Webhook endpoint to receive GitHub commit events
- Automatic logging of commits to Notion database
- One-time backfill script to import historical commits

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
To import commits from the last 6 months:

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

This will:
- Fetch all commits from the specified repository(s) from the last 6 months
- Transform them to match the webhook format
- Log them to your Notion database in batches
- Include progress logging and rate limiting to avoid API limits
- Skip forked repositories when processing all repos
- Continue processing other repos if one fails
