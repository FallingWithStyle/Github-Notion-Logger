const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function testNotionConnection() {
  console.log('Testing Notion connection...');
  console.log('API Key starts with:', process.env.NOTION_API_KEY?.substring(0, 10) + '...');
  console.log('Database ID:', process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID);
  
  try {
    // Try to retrieve the database
    const response = await notion.databases.retrieve({
      database_id: process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID
    });
    
    console.log('✅ Successfully connected to Notion!');
    console.log('Database title:', response.title?.[0]?.plain_text || 'Untitled');
    console.log('Database properties:', Object.keys(response.properties));
    
  } catch (error) {
    console.error('❌ Notion connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }
}

testNotionConnection(); 