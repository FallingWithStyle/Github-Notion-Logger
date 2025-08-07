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

### Getting Required API Keys and Tokens

#### GitHub Personal Access Token (GITHUB_TOKEN)
1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Notion Logger")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (if you need access to organization repositories)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again)
7. Add it to your `.env` file as `GITHUB_TOKEN=your_token_here`

#### Notion API Key (NOTION_API_KEY)
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Give it a name (e.g., "GitHub Logger")
4. Select the workspace where your database is located
5. Click "Submit"
6. Copy the "Internal Integration Token"
7. Add it to your `.env` file as `NOTION_API_KEY=your_token_here`

#### Notion Database ID (NOTION_DATABASE_ID)
1. Open your Notion database in the browser
2. Copy the URL - it will look like: `https://www.notion.so/workspace/Database-Name-1234567890abcdef1234567890abcdef`
3. Extract the database ID (the last part before the `?`): `1234567890abcdef1234567890abcdef`
4. Add it to your `.env` file as `NOTION_DATABASE_ID=your_database_id_here`
5. **Important**: Share your database with your integration by clicking "Share" in the database and adding your integration

#### GitHub Webhook Secret (GITHUB_WEBHOOK_SECRET) - For Webhook Mode
1. Generate a random secret (you can use a password generator or run `openssl rand -hex 32`)
2. Add it to your `.env` file as `GITHUB_WEBHOOK_SECRET=your_secret_here`
3. You'll also need to configure this in your GitHub repository webhook settings

#### GitHub Owner and Repository (GITHUB_OWNER, GITHUB_REPO)
- **GITHUB_OWNER**: Your GitHub username or organization name
- **GITHUB_REPO**: (Optional) Specific repository name. If omitted, the backfill will process all your repositories

## Deployment

### Deploy to Fly.io (Recommended)

This project includes a `fly.toml` configuration for easy deployment to Fly.io.

1. **Install Fly CLI** (if not already installed):
   ```bash
   # macOS
   brew install flyctl
   
   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   
   # Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**:
   ```bash
   fly auth login
   ```

3. **Set up your app** (replace `your-app-name` with your desired app name):
   ```bash
   fly apps create your-app-name
   ```

4. **Set environment variables**:
   ```bash
   fly secrets set NOTION_API_KEY=your_notion_api_key
   fly secrets set NOTION_DATABASE_ID=your_notion_database_id
   fly secrets set GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
   fly secrets set GITHUB_TOKEN=your_github_personal_access_token
   fly secrets set GITHUB_OWNER=your_github_username_or_org
   # Optional: fly secrets set GITHUB_REPO=your_repository_name
   ```

5. **Deploy the application**:
   ```bash
   fly deploy
   ```

6. **Get your webhook URL**:
   ```bash
   fly status
   ```
   Your webhook URL will be: `https://your-app-name.fly.dev/webhook`

7. **Configure GitHub webhook**:
   - Go to your GitHub repository → Settings → Webhooks
   - Click "Add webhook"
   - Set Payload URL to: `https://your-app-name.fly.dev/webhook`
   - Set Content type to: `application/json`
   - Set Secret to match your `GITHUB_WEBHOOK_SECRET`
   - Select events: "Just the push event"
   - Click "Add webhook"

### Alternative Deployment Options

- **Local development**: Run `npm start` for local testing
- **Other cloud platforms**: The application can be deployed to any Node.js hosting platform (Heroku, Railway, etc.)

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
