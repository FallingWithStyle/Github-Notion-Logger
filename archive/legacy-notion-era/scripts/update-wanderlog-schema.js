#!/usr/bin/env node

/**
 * Script to update the Wanderlog database schema to use the new date fields
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

async function updateWanderlogSchema() {
  console.log('🔄 Updating Wanderlog database schema...\n');
  
  if (!process.env.NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY environment variable not set');
    process.exit(1);
  }
  
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  
  try {
    // Find the Wanderlog database
    console.log('🔍 Searching for Wanderlog database...');
    const searchResponse = await notion.search({
      query: "Wanderlog",
      filter: {
        property: "object",
        value: "database"
      }
    });
    
    if (searchResponse.results.length === 0) {
      console.log('❌ No Wanderlog database found');
      return;
    }
    
    const databaseId = searchResponse.results[0].id;
    console.log(`📊 Found Wanderlog database: ${databaseId}`);
    
    // Get current database properties
    console.log('🔍 Getting current database properties...');
    const database = await notion.databases.retrieve({ database_id: databaseId });
    const currentProperties = Object.keys(database.properties);
    console.log('📋 Current properties:', currentProperties);
    
    // Check if we need to add the new field
    if (currentProperties.includes('First Commit Date')) {
      console.log('✅ "First Commit Date" field already exists');
    } else {
      console.log('➕ Adding "First Commit Date" field...');
      
      // Add the new field
      await notion.databases.update({
        database_id: databaseId,
        properties: {
          "First Commit Date": { date: {} }
        }
      });
      
      console.log('✅ Added "First Commit Date" field');
    }
    
    // Check if we need to remove old fields
    const fieldsToRemove = ['Date', 'Last Updated'];
    for (const fieldName of fieldsToRemove) {
      if (currentProperties.includes(fieldName)) {
        console.log(`🗑️ Removing old "${fieldName}" field...`);
        
        // Note: Notion doesn't allow removing properties via API
        // This would need to be done manually in the Notion interface
        console.log(`⚠️ Please manually remove the "${fieldName}" field from the database in Notion`);
      }
    }
    
    console.log('\n🎉 Database schema update completed!');
    console.log('\n📋 Updated schema:');
    console.log('   ✅ Title (title)');
    console.log('   ✅ Created (date)');
    console.log('   ✅ First Commit Date (date)');
    console.log('   ✅ Commit Count (number)');
    console.log('   ✅ Projects (rich_text)');
    console.log('   ✅ Summary (rich_text)');
    console.log('   ✅ Insights (rich_text)');
    console.log('   ✅ Focus Areas (rich_text)');
    
    console.log('\n⚠️ Manual steps required:');
    console.log('   1. Remove the old "Date" field from the database in Notion');
    console.log('   2. Remove the old "Last Updated" field from the database in Notion');
    
  } catch (error) {
    console.error('❌ Error updating database schema:', error);
    process.exit(1);
  }
}

// Run update if this file is executed directly
if (require.main === module) {
  updateWanderlogSchema();
}

module.exports = { updateWanderlogSchema };
