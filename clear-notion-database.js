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

async function clearDatabase() {
  console.log('🗑️  Starting database clear operation...');
  console.log(`Database ID: ${commitFromGithubLogDatabaseId}`);
  
  let totalDeleted = 0;
  let hasMore = true;
  let startCursor = undefined;
  let pageCount = 0;
  const maxPages = 100; // Safety limit
  
  try {
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      console.log(`\n📄 Processing page ${pageCount}...`);
      
      // Query for pages in batches
      const response = await notion.databases.query({
        database_id: commitFromGithubLogDatabaseId,
        page_size: 100,
        start_cursor: startCursor,
        sorts: [
          {
            property: "Date",
            direction: "ascending"
          }
        ]
      });
      
      if (response.results.length === 0) {
        console.log('✅ No more pages to delete');
        break;
      }
      
      console.log(`Found ${response.results.length} pages to delete...`);
      
      // Delete pages in parallel batches (Notion allows up to 3 concurrent requests)
      const batchSize = 3;
      for (let i = 0; i < response.results.length; i += batchSize) {
        const batch = response.results.slice(i, i + batchSize);
        
        const deletePromises = batch.map(async (page) => {
          try {
            await notion.pages.update({
              page_id: page.id,
              archived: true // Archive instead of hard delete (safer)
            });
            return { success: true, id: page.id };
          } catch (error) {
            console.error(`❌ Failed to delete page ${page.id}:`, error.message);
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
        
        console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} pages`);
        
        // Small delay to be respectful to Notion API
        if (i + batchSize < response.results.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      console.log(`Progress: ${totalDeleted} pages deleted so far`);
      
      // Small delay between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`\n🎉 Database clear completed!`);
    console.log(`Total pages deleted: ${totalDeleted}`);
    console.log(`Pages processed: ${pageCount}`);
    
    if (pageCount >= maxPages) {
      console.log(`⚠️  Reached maximum page limit (${maxPages}). You may need to run this script again.`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    console.log(`\n📊 Partial results:`);
    console.log(`Pages deleted: ${totalDeleted}`);
    console.log(`Pages processed: ${pageCount}`);
    process.exit(1);
  }
}

// Add confirmation prompt
async function confirmClear() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`\n⚠️  WARNING: This will delete ALL entries from your Notion database!\n` +
                `Database ID: ${commitFromGithubLogDatabaseId}\n\n` +
                `Are you sure you want to continue? (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Run the script
async function main() {
  console.log('🗑️  Notion Database Clear Tool');
  console.log('================================\n');
  
  const confirmed = await confirmClear();
  
  if (!confirmed) {
    console.log('❌ Operation cancelled');
    process.exit(0);
  }
  
  await clearDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { clearDatabase };
