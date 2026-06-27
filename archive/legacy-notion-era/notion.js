const { Client } = require('@notionhq/client');
require('dotenv').config();

// Validate required environment variables
if (!process.env.NOTION_API_KEY) {
  console.error('❌ NOTION_API_KEY environment variable not set');
  process.exit(1);
}

if (!process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID) {
  console.error('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set');
  process.exit(1);
}

// Import all Notion services
const notionServices = require('./services/notion');

// Re-export all services for backward compatibility
module.exports = {
  ...notionServices
};
