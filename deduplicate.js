const { Client } = require('@notionhq/client');
const timezoneConfig = require('./timezone-config');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

async function deduplicateDatabase() {
  console.log('Starting database deduplication...');
  
  try {
    // Get all pages from the database
    console.log('Fetching all pages from database...');
    const allPages = [];
    let hasMore = true;
    let startCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
        page_size: 100,
        sorts: [
          {
            property: 'Date',
            direction: 'ascending'
          }
        ]
      });
      
      allPages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      console.log(`Fetched ${allPages.length} pages so far...`);
    }
    
    console.log(`Total pages found: ${allPages.length}`);
    
    // Group pages by unique commit (message + repository + date)
    const groupedPages = {};
    const duplicates = [];
    
    for (const page of allPages) {
      const commitMessage = page.properties['Commits']?.rich_text?.[0]?.plain_text || '';
      const repoName = page.properties['Project Name']?.title?.[0]?.plain_text || '';
      // Parse the date and use timezone-aware approach
      const rawDate = page.properties['Date']?.date?.start;
      const date = rawDate ? timezoneConfig.getEffectiveDate(rawDate) : '';
      
      const key = `${commitMessage}|${repoName}|${date}`;
      
      if (!groupedPages[key]) {
        groupedPages[key] = page;
      } else {
        // This is a duplicate - keep the first one, mark this for deletion
        duplicates.push(page);
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate pages to remove`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Database is clean.');
      return;
    }
    
    // Delete duplicates in batches
    const batchSize = 10;
    let deletedCount = 0;
    
    for (let i = 0; i < duplicates.length; i += batchSize) {
      const batch = duplicates.slice(i, i + batchSize);
      
      // Delete each page in the batch
      for (const page of batch) {
        try {
          await notion.pages.update({
            page_id: page.id,
            archived: true // Archive instead of hard delete
          });
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete page ${page.id}:`, error.message);
        }
      }
      
      console.log(`Deleted ${Math.min(i + batchSize, duplicates.length)} of ${duplicates.length} duplicates`);
      
      // Small delay to avoid rate limits
      if (i + batchSize < duplicates.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`✅ Deduplication complete!`);
    console.log(`- Original pages: ${allPages.length}`);
    console.log(`- Unique pages: ${allPages.length - duplicates.length}`);
    console.log(`- Duplicates removed: ${deletedCount}`);
    
  } catch (error) {
    console.error('❌ Deduplication failed:', error);
    process.exit(1);
  }
}

// Run the deduplication if this script is executed directly
if (require.main === module) {
  deduplicateDatabase();
}

module.exports = { deduplicateDatabase }; 