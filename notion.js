const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;

async function logCommitsToNotion(commits, repo) {
  for (const commit of commits) {
    // Extract just the repository name from the full path
    const repoName = repo.split('/').pop();
    
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Commits": {
          rich_text: [{ text: { content: commit.message.split('\n')[0] } }],
        },
        "Project Name": {
          title: [{ text: { content: repoName } }],
        },
        "Date": {
          date: { start: new Date(commit.timestamp).toISOString() },
        }
        // Removed "Estimated Time" since it's not useful for commit tracking
      }
    });
  }
}

module.exports = { logCommitsToNotion };
