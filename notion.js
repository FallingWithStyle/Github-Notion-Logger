const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;

async function logCommitsToNotion(commits, repo) {
  let processed = 0;
  let skipped = 0;
  
  for (const commit of commits) {
    // Extract just the repository name from the full path
    const repoName = repo.split('/').pop();
    
    // Check if this commit already exists
    const existingPages = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: "Commits",
            rich_text: {
              equals: commit.message.split('\n')[0]
            }
          },
          {
            property: "Project Name",
            title: {
              equals: repoName
            }
          },
          {
            property: "Date",
            date: {
              equals: new Date(commit.timestamp).toISOString().split('T')[0]
            }
          }
        ]
      }
    });
    
    // Only create if no matching commit exists
    if (existingPages.results.length === 0) {
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
      processed++;
    } else {
      console.log(`Skipping duplicate: ${commit.message.split('\n')[0]} (${repoName})`);
      skipped++;
    }
  }
  
  return { processed, skipped };
}

module.exports = { logCommitsToNotion };
