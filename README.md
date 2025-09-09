# GitHub Notion Logger

A webhook-based service that logs GitHub commits to Notion database with a visual commit activity tracker.

## Overview

GitHub Notion Logger is an automated system that monitors GitHub repositories, extracts commit information, and creates/updates Notion pages with structured data. It provides real-time synchronization, visual commit tracking, and weekly project planning features.

## Features

- **Real-time Webhook Integration**: Receive GitHub commit events in real-time
- **Automatic Notion Logging**: Log commits to Notion database automatically
- **Visual Commit Tracker**: View coding activity across projects over time
- **Weekly Project Planning**: Review 28-day activity and create actionable plans
- **Historical Data Import**: Backfill script for last 6 months of commits
- **Duplicate Prevention**: Smart duplicate detection and cleanup
- **Performance Optimization**: Configurable batch processing and caching
- **Multi-Repository Support**: Monitor multiple repositories simultaneously
- **Wanderlog Daily Summaries**: AI-powered daily commit summaries with GPT-4o-mini
- **Intelligent Commit Filtering**: Automatically filters out insignificant commits (typos, etc.)
- **Automated Scheduling**: Daily processing at 6am EST with cron scheduling

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- GitHub Personal Access Token
- Notion API Key
- Notion database for commit tracking
- OpenAI API Key (for Wanderlog summaries)

### Installation

```bash
git clone https://github.com/your-org/github-notion-logger.git
cd github-notion-logger
npm install
```

### Configuration

Create an `.env` file with your configuration:

```bash
NOTION_API_KEY=your_notion_api_key
NOTION_COMMIT_FROM_GITHUB_LOG_ID=your_notion_commit_database_id
NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID=your_notion_weekly_planning_parent_page_id
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name
OPENAI_API_KEY=your_openai_api_key
```

### Development

```bash
npm start
```

The application will be available at [http://localhost:8080](http://localhost:8080)

## Usage

### Real-time Webhook Mode

Start the server to receive webhook events:
```bash
npm start
```

### Historical Data Import

Import commits from the last 6 months:
```bash
node backfill.js
```

### Weekly Project Planning

Navigate to `/week` to access the weekly planning feature:
- Review 28-day project activity
- Categorize and rate projects
- Generate actionable weekly plans
- Sync plans to Notion database

### Visual Commit Tracker

View your commit activity at the root URL (`/`):
- Daily commit grid visualization
- Color-coded project representation
- Interactive hover effects
- Responsive design for all devices

### Wanderlog Daily Summaries

The Wanderlog feature provides AI-powered daily summaries of your development work:

- **Automatic Processing**: Runs daily at 6am EST via cron scheduling
- **Smart Filtering**: Automatically filters out insignificant commits (typos, formatting, etc.)
- **AI Summaries**: Uses GPT-4o-mini to create engaging, story-like summaries
- **Notion Integration**: Creates entries in a dedicated Wanderlog database
- **Manual Trigger**: Test the feature with `POST /api/wanderlog/process`

#### Testing Wanderlog

```bash
# Test commit filtering logic (no API keys required)
node test-wanderlog-simple.js

# Test with specific date (requires API keys)
node test-wanderlog-specific-date.js --date 2024-01-15
node test-wanderlog-specific-date.js --date yesterday --create

# Full integration test (requires API keys)
node test-wanderlog.js

# Or trigger manually via API
curl -X POST http://localhost:3000/api/wanderlog/process
```

#### Specific Date Testing

The `test-wanderlog-specific-date.js` script allows you to test the Wanderlog system with commits from any specific date:

```bash
# Test with a specific date (dry run)
node test-wanderlog-specific-date.js --date 2024-01-15

# Test with a specific date and create Notion entry
node test-wanderlog-specific-date.js --date 2024-01-15 --create

# Test with yesterday's commits
node test-wanderlog-specific-date.js --date yesterday

# Test with today's commits
node test-wanderlog-specific-date.js --date today
```

This is particularly useful for:
- Testing the system with historical data
- Creating Wanderlog entries for missed days
- Debugging specific commit processing issues

#### Wanderlog Database Schema

The system automatically creates a "Wanderlog" database with:
- **Title**: Engaging daily summary title
- **Date**: The date being summarized
- **Commit Count**: Number of significant commits
- **Projects**: List of projects worked on
- **Summary**: AI-generated story of the day's work
- **Insights**: Key insights about focus and patterns
- **Focus Areas**: Main themes and areas of focus

## Project Structure

```
/github-notion-logger
  ├── src/                    # Source code
  │   ├── server.js          # Webhook server
  │   ├── backfill.js        # Historical data import
  │   ├── deduplicate.js     # Database cleanup
  │   └── notion.js          # Notion API integration
  ├── data/                  # Data files
  │   ├── commit-log.json    # Commit activity data
  │   ├── color-palettes.json # Color assignment data
  │   └── weekly-plans.json  # Weekly planning data
  ├── public/                # Static files
  │   ├── index.html         # Main activity visualizer
  │   ├── prd.html           # PRD viewer
  │   └── week.html          # Weekly planning interface
  ├── README.md              # Project overview (this file)
  ├── prd.md                 # Product Requirements Document
  └── task-list.md           # Task list and progress tracking
```

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

MIT License

## Acknowledgements

- GitHub API for commit data access
- Notion API for database integration
- Fly.io for deployment platform
- Node.js and Express communities for excellent tooling
