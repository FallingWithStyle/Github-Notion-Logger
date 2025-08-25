# Github-Notion-Logger

A webhook-based service that logs GitHub commits to Notion database with a visual commit activity tracker.

## Features

- **Webhook endpoint** to receive GitHub commit events in real-time
- **Automatic logging** of commits to Notion database
- **Visual commit activity tracker** - view your coding activity across projects over time
- **Weekly project planning** - review 28-day activity and create actionable weekly plans
- **One-time backfill script** to import historical commits from the last 6 months
- **Duplicate detection** to prevent duplicate entries during backfill
- **Deduplication tool** to clean existing duplicate entries
- **Speed optimizations** with configurable batch processing
- **Progress tracking** with detailed statistics

## Weekly Project Planning

The app now includes a weekly planning feature at `/week` that helps you:

- **Review Activity**: See your commit activity across all projects from the last 28 days
- **Categorize Projects**: Organize projects into categories for better planning
- **Reflect & Plan**: Answer three key questions for each project:
  - What's working well?
  - What should be improved or stopped?
  - What should be started or added next?
- **Generate Plans**: Create actionable weekly plans grouped by category
- **Save & Review**: Store plans for later review and track progress over time

### Using Weekly Planning

1. Navigate to `/week` in your browser
2. Review your project activity from the last 28 days
3. Assign categories to projects (or create new ones)
4. Assign a status to each project:
   - **💡 Idea** - Just a spark or rough concept
   - **🅿️ Parking Lot** - Not in current cycle of attention
   - **📝 Planning** - Actively shaping into something concrete
   - **🚀 Active** - Currently being worked on
   - **⏸️ Paused** - Work stopped, likely to resume later
   - **🌍 Released** - Publicly launched in some form
   - **✅ Done/Retired** - Completed or abandoned

5. Rate each project on two dimensions:
   - **🧠 Head** (1-5) - How logical it is to proceed now (timing, external factors, other people)
   - **❤️ Heart** (1-5) - How excited you are about this project right now
6. Generate your weekly plan
7. Save the plan locally and/or sync to Notion

### Notion Integration

The weekly planning data can be automatically synced to a dedicated Notion database:

- **Automatic Database Creation**: Creates a "Weekly Project Planning" database if it doesn't exist
- **Structured Data**: Stores ratings, categories, and timestamps for each project
- **Historical Tracking**: Maintains weekly planning history for trend analysis
- **Easy Access**: View your planning data directly in Notion alongside commit logs

The Notion database includes:
- Project Name, Week Start Date, Category
- Status (7 lifecycle stages from Idea to Done)
- Head Rating (1-5) - Logical factors for proceeding
- Heart Rating (1-5) - Excitement and motivation level
- Notes and timestamps

## API Endpoints

- `POST /webhook` - GitHub webhook endpoint for real-time commit logging
- `GET /api/fetch-notion-data` - Fetch and sync data from Notion database
- `GET /api/weekly-data` - Get 28-day project activity data for weekly planning
- `POST /api/weekly-plan` - Save a weekly plan locally
- `GET /api/weekly-plans` - Retrieve all saved weekly plans
- `POST /api/weekly-plan/sync-notion` - Sync weekly plan data to Notion database
- `GET /api/weekly-plan/notion` - Retrieve weekly planning data from Notion
- `GET /` - Main activity visualizer page
- `GET /week` - Weekly project planning page

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
   NOTION_PARENT_PAGE_ID=your_notion_parent_page_id  # Optional - for weekly planning database
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

#### Notion Parent Page ID (NOTION_PARENT_PAGE_ID) - For Weekly Planning Database
1. Open your Notion workspace in the browser
2. Navigate to the "Weekly Planning" page
3. Copy the page ID from the URL - it will look like: `https://www.notion.so/workspace/Weekly-Planning-1234567890abcdef1234567890abcdef`
4. Extract the page ID (the last part before the `?`): `1234567890abcdef1234567890abcdef`
5. Add it to your `.env` file as `NOTION_PARENT_PAGE_ID=your_parent_page_id_here`

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
   fly secrets set NOTION_PARENT_PAGE_ID=your_notion_parent_page_id
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

### Web Interface - Commit Activity Visualizer

The application now includes a visual commit activity tracker accessible at the root URL (`/`). This provides:

- **Daily commit grid** showing your activity across multiple projects
- **Color-coded squares** representing commits to different projects
- **Interactive hover effects** showing project name and commit details
- **Project legend** mapping colors to project names
- **Responsive design** that works on desktop and mobile

**To view your commit activity:**
1. Start the server: `npm start`
2. Open your browser to `http://localhost:8080`
3. The visualizer will load commit data from `public/commit-log.json`

**To update with real data:**
```bash
# Generate sample data
node generate-commit-log.js

# Or fetch real data from Notion (requires environment variables)
node generate-commit-log.js --notion
node generate-commit-log.js --notion --since=2025-01-01
```

**Notion Integration:**
The visualizer can automatically fetch data from your Notion database:
- **Web Interface**: Click "Fetch from Notion" button to load latest data
- **Auto-refresh**: Enable auto-refresh to update every 30 seconds
- **Real-time Updates**: New commits from webhooks automatically update the visualizer
- **Environment Variables**: Uses `NOTION_API_KEY` and `NOTION_DATABASE_ID` from your `.env` file

**Proportional Representation:**
Each day shows up to 10 squares representing your work distribution:
- **Proportional Squares**: Squares represent the percentage of time spent on each project
- **Maximum 10 Squares**: Each day is limited to 10 squares for consistent visualization
- **Smart Rounding**: Rounds to nearest proportional representation (e.g., 50% = 5 squares)
- **Compact Layout**: Reduced spacing between rows for better visual density

**Color Assignment:**
The visualizer automatically assigns colors to new projects using a smart algorithm that:
- Uses 15 different emoji colors (🟩🟥🟪🟦🟨🟧🟫⬛⬜🟣🟢🔴🔵🟡🟠)
- Assigns the least-used color to new projects for optimal distribution
- Ensures no default/fallback colors are used
- Shows color assignment info when generating data

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

**Since last commit (incremental backfill):**
```bash
node backfill.js --last
# or
node backfill.js -l
```
This will:
- Find the most recent commit date for each repository in your Notion database
- Fetch only commits made since that date
- Perfect for regular incremental updates without re-processing old data
- Falls back to last 7 days if no commits are found in Notion

**Performance optimization for large repositories:**
```bash
node backfill.js --sha-only
# or
node backfill.js -s
```
This will:
- Use SHA-only deduplication for faster processing
- Automatically enabled for batches >100 commits
- Prevents timeouts on repositories with many existing commits
- Can be combined with other options: `-l -s` for incremental + SHA-only

This will:
- Fetch all commits from the specified repository(s) from the last 6 months (default) or custom period
- Transform them to match the webhook format
- Log them to your Notion database in batches of 50 commits
- Include progress logging and rate limiting to avoid API limits
- Skip forked repositories when processing all repos
- Continue processing other repos if one fails
- **Automatically detect and skip duplicates** to prevent duplicate entries
- Show detailed statistics (new vs skipped commits)
- **Provide comprehensive metrics** including execution time, API calls, and performance insights

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
- **Parameters**: 
  - Optional `--months` or `-m` flag (1-72 months, defaults to 6)
  - Optional `--last` or `-l` flag for incremental backfill since most recent commit
  - Optional `--sha-only` or `-s` flag for SHA-only deduplication (faster for large repos)
- **Features**:
  - Duplicate detection and skipping
  - Configurable batch processing (50 commits/batch)
  - Progress tracking with statistics
  - Rate limiting for API safety
  - Smart incremental updates using `-l` flag
  - **Comprehensive metrics and performance insights**

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
