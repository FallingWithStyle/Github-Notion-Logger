const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const commitFromGithubLogDatabaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

if (!commitFromGithubLogDatabaseId) {
  console.error('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set');
  process.exit(1);
}

if (!process.env.NOTION_API_KEY) {
  console.error('❌ NOTION_API_KEY environment variable not set');
  process.exit(1);
}

async function clearRecentEntries(days = 31, dryRun = true) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];
  
  console.log(`🗑️  ${dryRun ? 'DRY RUN: Would clear' : 'Clearing'} entries from the last ${days} days (since ${cutoffDateString})...`);
  console.log(`Database ID: ${commitFromGithubLogDatabaseId}`);
  
  let totalFound = 0;
  let totalDeleted = 0;
  let hasMore = true;
  let startCursor = undefined;
  let pageCount = 0;
  const maxPages = 50; // Safety limit
  
  try {
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      console.log(`\n📄 Processing page ${pageCount}...`);
      
      // Query for pages in batches, filtering by date
      const response = await notion.databases.query({
        database_id: commitFromGithubLogDatabaseId,
        page_size: 100,
        start_cursor: startCursor,
        filter: {
          property: "Date",
          date: {
            on_or_after: cutoffDateString
          }
        },
        sorts: [
          {
            property: "Date",
            direction: "descending"
          }
        ]
      });
      
      if (response.results.length === 0) {
        console.log('✅ No more pages to delete');
        break;
      }
      
      console.log(`Found ${response.results.length} pages from the last ${days} days...`);
      totalFound += response.results.length;
      
      if (!dryRun) {
        // Delete pages in parallel batches (Notion allows up to 3 concurrent requests)
        const batchSize = 3;
        for (let i = 0; i < response.results.length; i += batchSize) {
          const batch = response.results.slice(i, i + batchSize);
          
          const deletePromises = batch.map(async (page) => {
            try {
              const commitDate = page.properties['Date']?.date?.start;
              const projectName = page.properties['Project Name']?.title?.[0]?.plain_text || 'Unknown';
              const commitMessage = page.properties['Commits']?.rich_text?.[0]?.plain_text || 'No message';
              
              await notion.pages.update({
                page_id: page.id,
                archived: true // Archive instead of hard delete (safer)
              });
              
              console.log(`  ✅ Archived: ${projectName} - ${commitMessage.substring(0, 50)}... (${commitDate})`);
              return { success: true, id: page.id };
            } catch (error) {
              console.error(`  ❌ Failed to archive page ${page.id}:`, error.message);
              return { success: false, id: page.id, error: error.message };
            }
          });
          
          const results = await Promise.allSettled(deletePromises);
          
          // Count successful deletions
          results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.success) {
              totalDeleted++;
            }
          });
          
          console.log(`  Processed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} pages`);
          
          // Small delay to be respectful to Notion API
          if (i + batchSize < response.results.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        // Dry run - just show what would be deleted
        response.results.forEach((page, index) => {
          const commitDate = page.properties['Date']?.date?.start;
          const projectName = page.properties['Project Name']?.title?.[0]?.plain_text || 'Unknown';
          const commitMessage = page.properties['Commits']?.rich_text?.[0]?.plain_text || 'No message';
          console.log(`  🔍 Would archive: ${projectName} - ${commitMessage.substring(0, 50)}... (${commitDate})`);
        });
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      console.log(`Progress: ${totalFound} pages found so far`);
      
      // Small delay between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    if (dryRun) {
      console.log(`\n🔍 DRY RUN COMPLETE`);
      console.log(`Found ${totalFound} pages from the last ${days} days that would be archived`);
      console.log(`\nTo actually delete these entries, run:`);
      console.log(`node clear-recent-notion.js --days ${days} --execute`);
    } else {
      console.log(`\n🎉 Database clear completed!`);
      console.log(`Total pages found: ${totalFound}`);
      console.log(`Total pages archived: ${totalDeleted}`);
    }
    
    if (pageCount >= maxPages) {
      console.log(`⚠️  Reached maximum page limit (${maxPages}). You may need to run this script again.`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let days = 31; // default to 31 days
let dryRun = true; // default to dry run for safety

// Check for --days or -d argument
const daysIndex = args.findIndex(arg => arg === '--days' || arg === '-d');
if (daysIndex !== -1 && daysIndex + 1 < args.length) {
  const daysValue = parseInt(args[daysIndex + 1]);
  if (!isNaN(daysValue) && daysValue > 0) {
    days = daysValue;
  } else {
    console.error('Invalid days value. Must be a positive number.');
    process.exit(1);
  }
}

// Check for --execute flag
if (args.includes('--execute') || args.includes('-e')) {
  dryRun = false;
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Clear Recent Notion Entries

Usage: node clear-recent-notion.js [options]

Options:
  -d, --days <number>    Number of days to clear (default: 31)
  -e, --execute          Actually delete entries (default is dry run)
  -h, --help             Show this help message

Examples:
  node clear-recent-notion.js                    # Dry run: show what would be deleted (last 31 days)
  node clear-recent-notion.js --days 7           # Dry run: show what would be deleted (last 7 days)
  node clear-recent-notion.js --days 31 --execute # Actually delete last 31 days
  node clear-recent-notion.js -d 14 -e           # Actually delete last 14 days

Note: This script archives entries (doesn't permanently delete them).
      You can restore archived entries from the Notion interface if needed.
`);
  process.exit(0);
}

// Run the clear operation
clearRecentEntries(days, dryRun);

