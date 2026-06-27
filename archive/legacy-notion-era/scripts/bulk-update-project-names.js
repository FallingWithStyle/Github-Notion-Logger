#!/usr/bin/env node

/**
 * Bulk Update Project Names Script
 * 
 * This script removes the "FallingWithStyle/" prefix from all project names in the Notion database.
 * It normalizes project names to remove owner prefixes for consistency.
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

// Configuration
const BATCH_SIZE = 3; // Notion API allows up to 3 concurrent requests
const DELAY_BETWEEN_BATCHES = 100; // ms

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

if (!databaseId) {
  console.error('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set');
  process.exit(1);
}

/**
 * Normalize project name by removing owner prefix
 * @param {string} projectName - The project name to normalize
 * @returns {string} - Normalized project name without owner prefix
 */
function normalizeProjectName(projectName) {
  // Remove any owner prefix (e.g., "FallingWithStyle/Project-Name" -> "Project-Name")
  return projectName.replace(/^[^\/]+\//, '');
}

/**
 * Check if a project name needs normalization
 * @param {string} projectName - The project name to check
 * @returns {boolean} - True if the name contains a prefix that should be removed
 */
function needsNormalization(projectName) {
  return projectName.includes('/') && projectName.split('/').length === 2;
}

/**
 * Bulk update project names in Notion database
 * @param {boolean} dryRun - If true, only show what would be updated without making changes
 */
async function bulkUpdateProjectNames(dryRun = true) {
  console.log(`🔄 ${dryRun ? 'DRY RUN: ' : ''}Bulk updating project names to remove "FallingWithStyle/" prefix...\n`);
  
  try {
    // Get all pages from the database
    console.log('📖 Fetching all pages from database...');
    const allPages = [];
    let hasMore = true;
    let startCursor = undefined;
    let pageCount = 0;
    
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
      pageCount++;
      
      console.log(`  📄 Fetched ${allPages.length} pages so far...`);
      
      // Small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`✅ Total pages found: ${allPages.length}\n`);
    
    // Find pages that need updating
    const pagesToUpdate = [];
    
    for (const page of allPages) {
      const projectName = page.properties['Project Name']?.title?.[0]?.plain_text || '';
      
      if (projectName && needsNormalization(projectName)) {
        const normalizedName = normalizeProjectName(projectName);
        pagesToUpdate.push({
          page,
          originalName: projectName,
          normalizedName: normalizedName
        });
      }
    }
    
    console.log(`🔍 Found ${pagesToUpdate.length} pages that need project name updates:\n`);
    
    if (pagesToUpdate.length === 0) {
      console.log('✅ No project names need updating. All names are already normalized!');
      return;
    }
    
    // Show what will be updated
    pagesToUpdate.forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.originalName}" → "${item.normalizedName}"`);
    });
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN COMPLETE - No changes were made');
      console.log('💡 To apply these changes, run: node scripts/bulk-update-project-names.js --execute');
      return;
    }
    
    // Confirm before proceeding
    console.log('\n⚠️  WARNING: This will update project names in your Notion database!');
    console.log('❌ This action cannot be undone!');
    console.log('💡 Consider backing up your data first.');
    
    // Add a small delay to let user read the warning
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Process updates in batches
    console.log(`\n🔄 Updating ${pagesToUpdate.length} project names...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < pagesToUpdate.length; i += BATCH_SIZE) {
      const batch = pagesToUpdate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pagesToUpdate.length / BATCH_SIZE);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} updates)`);
      
      const updatePromises = batch.map(async (item) => {
        try {
          await notion.pages.update({
            page_id: item.page.id,
            properties: {
              'Project Name': {
                title: [
                  {
                    text: {
                      content: item.normalizedName
                    }
                  }
                ]
              }
            }
          });
          
          console.log(`  ✅ Updated: "${item.originalName}" → "${item.normalizedName}"`);
          return { success: true, originalName: item.originalName, normalizedName: item.normalizedName };
        } catch (error) {
          console.error(`  ❌ Failed to update "${item.originalName}": ${error.message}`);
          return { success: false, originalName: item.originalName, error: error.message };
        }
      });
      
      const results = await Promise.allSettled(updatePromises);
      
      // Count successes and failures
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      });
      
      // Small delay between batches to be respectful to Notion API
      if (i + BATCH_SIZE < pagesToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Final summary
    console.log('\n📊 Update Summary:');
    console.log(`  ✅ Successfully updated: ${successCount} project names`);
    console.log(`  ❌ Failed updates: ${errorCount} project names`);
    console.log(`  📈 Total processed: ${successCount + errorCount} project names`);
    
    if (successCount > 0) {
      console.log('\n🎉 Project name normalization completed successfully!');
      console.log('💡 Your project names are now consistent without owner prefixes.');
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some updates failed. Check the error messages above.');
    }
    
  } catch (error) {
    console.error('❌ Error during bulk update:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const execute = args.includes('--execute') || args.includes('-e');

// Run the script
if (require.main === module) {
  bulkUpdateProjectNames(!execute);
}

