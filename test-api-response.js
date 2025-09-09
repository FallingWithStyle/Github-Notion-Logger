#!/usr/bin/env node

/**
 * Test script to verify API response format with new date fields
 */

const { ensureWanderlogDatabase } = require('./wanderlog-processor');

async function testAPIResponse() {
  console.log('🧪 Testing API response format...\n');
  
  try {
    const { ensureWanderlogDatabase } = require('./wanderlog-processor');
    const databaseId = await ensureWanderlogDatabase();
    
    if (!process.env.NOTION_API_KEY) {
      console.log('⚠️ NOTION_API_KEY not set, skipping test');
      return;
    }
    
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    // Test getting all entries
    console.log('📊 Fetching Wanderlog entries...');
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        { property: "First Commit Date", direction: "descending" }
      ]
    });
    
    const wanderlogEntries = response.results.map(page => ({
      id: page.id,
      title: page.properties["Title"]?.title?.[0]?.text?.content || "",
      created: page.properties["Created"]?.date?.start || "",
      firstCommitDate: page.properties["First Commit Date"]?.date?.start || "",
      commitCount: page.properties["Commit Count"]?.number || 0,
      projects: page.properties["Projects"]?.rich_text?.[0]?.text?.content || "",
      summary: page.properties["Summary"]?.rich_text?.[0]?.text?.content || "",
      insights: page.properties["Insights"]?.rich_text?.[0]?.text?.content || "",
      focusAreas: page.properties["Focus Areas"]?.rich_text?.[0]?.text?.content || ""
    }));
    
    console.log(`✅ Retrieved ${wanderlogEntries.length} Wanderlog entries\n`);
    
    if (wanderlogEntries.length > 0) {
      const entry = wanderlogEntries[0];
      console.log('📋 Sample API Response:');
      console.log(JSON.stringify({
        success: true,
        count: wanderlogEntries.length,
        entries: [entry]
      }, null, 2));
      
      console.log('\n📅 Date Fields:');
      console.log(`   Created: ${entry.created}`);
      console.log(`   First Commit Date: ${entry.firstCommitDate}`);
      
      // Verify the date fields are properly populated
      if (entry.created && entry.firstCommitDate) {
        console.log('\n✅ Both date fields are properly populated!');
      } else {
        console.log('\n❌ Some date fields are missing:');
        if (!entry.created) console.log('   - Created field is empty');
        if (!entry.firstCommitDate) console.log('   - First Commit Date field is empty');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testAPIResponse();
}

module.exports = { testAPIResponse };
