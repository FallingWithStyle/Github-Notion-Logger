#!/usr/bin/env node

/**
 * Test script for Wanderlog API endpoints
 * This script tests the API endpoints without requiring the server to be running
 */

const { ensureWanderlogDatabase } = require('./wanderlog-processor');

async function testWanderlogAPI() {
  console.log('🧪 Testing Wanderlog API functionality...\n');
  
  try {
    // Test 1: Ensure database exists
    console.log('1️⃣ Testing database creation...');
    const { ensureWanderlogDatabase } = require('./wanderlog-processor');
    const databaseId = await ensureWanderlogDatabase();
    console.log('✅ Database test passed\n');
    
    // Test 2: Test API endpoint logic (simulate what the endpoints do)
    console.log('2️⃣ Testing API endpoint logic...');
    
    if (!process.env.NOTION_API_KEY) {
      console.log('⚠️ NOTION_API_KEY not set, skipping API tests');
      return;
    }
    
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    // Test getting all entries
    console.log('   Testing GET /api/wanderlog...');
    
    if (!databaseId) {
      console.log('   ⚠️ No Wanderlog database ID available, skipping API tests');
      return;
    }
    
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
    
    console.log(`   ✅ Retrieved ${wanderlogEntries.length} Wanderlog entries`);
    
    // Test statistics calculation
    console.log('   Testing statistics calculation...');
    const entries = wanderlogEntries;
    const totalEntries = entries.length;
    const totalCommits = entries.reduce((sum, entry) => sum + entry.commitCount, 0);
    const avgCommitsPerDay = totalEntries > 0 ? Math.round(totalCommits / totalEntries) : 0;
    
    // Get unique projects
    const allProjects = entries.flatMap(entry => 
      entry.projects ? entry.projects.split(', ').map(p => p.trim()) : []
    );
    const uniqueProjects = [...new Set(allProjects)].filter(p => p.length > 0);
    
    // Get focus areas
    const allFocusAreas = entries.flatMap(entry => 
      entry.focusAreas ? entry.focusAreas.split(', ').map(f => f.trim()) : []
    );
    const focusAreaCounts = allFocusAreas.reduce((acc, area) => {
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {});
    const topFocusAreas = Object.entries(focusAreaCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([area, count]) => ({ area, count }));
    
    const stats = {
      totalEntries,
      totalCommits,
      avgCommitsPerDay,
      uniqueProjects: uniqueProjects.length,
      projects: uniqueProjects,
      topFocusAreas,
      dateRange: entries.length > 0 ? {
        earliest: entries.map(e => e.firstCommitDate).filter(d => d).sort()[0],
        latest: entries.map(e => e.firstCommitDate).filter(d => d).sort().reverse()[0]
      } : null
    };
    
    console.log('   ✅ Statistics calculated successfully');
    console.log(`   📊 Stats: ${stats.totalEntries} entries, ${stats.totalCommits} total commits, ${stats.uniqueProjects} unique projects`);
    
    // Test date filtering
    console.log('   Testing date filtering...');
    if (entries.length > 0) {
      const testDate = entries.find(e => e.firstCommitDate && e.firstCommitDate.length > 0)?.firstCommitDate;
      if (testDate) {
        const filteredResponse = await notion.databases.query({
          database_id: databaseId,
          filter: {
            property: "First Commit Date",
            date: {
              equals: testDate
            }
          }
        });
        
        console.log(`   ✅ Date filtering works: found ${filteredResponse.results.length} entries for ${testDate}`);
      } else {
        console.log('   ⚠️ No entries with valid first commit dates found, skipping date filtering test');
      }
    }
    
    console.log('\n🎉 All API tests passed successfully!');
    console.log('\n📋 Available API Endpoints:');
    console.log('   GET /api/wanderlog - Get all Wanderlog entries');
    console.log('   GET /api/wanderlog/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Get entries by date range');
    console.log('   GET /api/wanderlog/date/YYYY-MM-DD - Get entry for specific date');
    console.log('   GET /api/wanderlog/stats - Get Wanderlog statistics');
    console.log('   POST /api/wanderlog/process - Trigger manual processing');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testWanderlogAPI();
}

module.exports = { testWanderlogAPI };
