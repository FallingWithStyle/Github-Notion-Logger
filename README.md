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

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- GitHub Personal Access Token
- Notion API Key
- Notion database for commit tracking

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
