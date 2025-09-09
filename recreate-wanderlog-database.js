#!/usr/bin/env node

/**
 * Script to completely recreate the Wanderlog database with the new schema
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

async function recreateWanderlogDatabase() {
  console.log('🔄 Recreating Wanderlog database with new schema...\n');
  
  if (!process.env.NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY environment variable not set');
    process.exit(1);
  }
  
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  
  try {
    // Find and delete the existing Wanderlog database
    console.log('🔍 Searching for existing Wanderlog database...');
    const searchResponse = await notion.search({
      query: "Wanderlog",
      filter: {
        property: "object",
        value: "database"
      }
    });
    
    if (searchResponse.results.length > 0) {
      const databaseId = searchResponse.results[0].id;
      console.log(`📊 Found existing Wanderlog database: ${databaseId}`);
      console.log('✅ Using existing database (assuming it was manually cleaned)');
      
      // Update the environment variable
      console.log('\n📝 Please update your .env file with:');
      console.log(`NOTION_WANDERLOG_DATABASE_ID=${databaseId}`);
      
      console.log('\n🎉 Using existing database!');
      console.log('\n📋 Expected schema:');
      console.log('   ✅ Title (title)');
      console.log('   ✅ Created (date) - When the Wanderlog entry was created');
      console.log('   ✅ First Commit Date (date) - Date of the earliest commit being summarized');
      console.log('   ✅ Commit Count (number)');
      console.log('   ✅ Projects (rich_text)');
      console.log('   ✅ Summary (rich_text)');
      console.log('   ✅ Insights (rich_text)');
      console.log('   ✅ Focus Areas (rich_text)');
      return;
    }
    
    // Create the new database with the correct schema
    console.log('➕ Creating new Wanderlog database...');
    
    const newDatabase = await notion.databases.create({
      parent: {
        type: "page_id",
        page_id: process.env.NOTION_PAGE_ID
      },
      title: [
        {
          type: "text",
          text: {
            content: "Wanderlog"
          }
        }
      ],
      properties: {
        "Title": {
          title: {}
        },
        "Created": {
          date: {}
        },
        "First Commit Date": {
          date: {}
        },
        "Commit Count": {
          number: {}
        },
        "Projects": {
          rich_text: {}
        },
        "Summary": {
          rich_text: {}
        },
        "Insights": {
          rich_text: {}
        },
        "Focus Areas": {
          rich_text: {}
        }
      }
    });
    
    console.log('✅ Created new Wanderlog database:', newDatabase.id);
    
    // Set the environment variable
    console.log('\n📝 Please update your .env file with:');
    console.log(`NOTION_WANDERLOG_DATABASE_ID=${newDatabase.id}`);
    
    console.log('\n🎉 Database recreation completed!');
    console.log('\n📋 New schema:');
    console.log('   ✅ Title (title)');
    console.log('   ✅ Created (date) - When the Wanderlog entry was created');
    console.log('   ✅ First Commit Date (date) - Date of the earliest commit being summarized');
    console.log('   ✅ Commit Count (number)');
    console.log('   ✅ Projects (rich_text)');
    console.log('   ✅ Summary (rich_text)');
    console.log('   ✅ Insights (rich_text)');
    console.log('   ✅ Focus Areas (rich_text)');
    
  } catch (error) {
    console.error('❌ Error recreating database:', error);
    process.exit(1);
  }
}

// Run recreation if this file is executed directly
if (require.main === module) {
  recreateWanderlogDatabase();
}

module.exports = { recreateWanderlogDatabase };
