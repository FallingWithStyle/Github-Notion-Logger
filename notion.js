const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;

async function logCommitsToNotion(commits, repo) {
  for (const commit of commits) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: commit.message.split('\n')[0] } }],
        },
        Repository: {
          rich_text: [{ text: { content: repo } }],
        },
        URL: {
          url: commit.url,
        },
        Author: {
          rich_text: [{ text: { content: commit.author.name } }],
        },
        Timestamp: {
          date: { start: new Date(commit.timestamp).toISOString() },
        },
        "Estimated Time": {
          time: null, // Leave blank for now
        }
      }
    });
  }
}

module.exports = { logCommitsToNotion };
