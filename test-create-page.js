const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function testCreatePage() {
  console.log('Testing page creation...');
  
  try {
    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID },
      properties: {
        "Commits": {
          rich_text: [{ text: { content: "Test commit message" } }],
        },
        "Project Name": {
          title: [{ text: { content: "repo" } }],
        },
        "Date": {
          date: { start: new Date().toISOString() },
        }
        // Removed "Estimated Time" since it's not useful for commit tracking
      }
    });
    
    console.log('✅ Successfully created test page!');
    console.log('Page ID:', response.id);
    
  } catch (error) {
    console.error('❌ Page creation failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }
}

testCreatePage(); 