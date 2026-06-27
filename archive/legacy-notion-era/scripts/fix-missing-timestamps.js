const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

async function findCommitsWithoutTimestamps() {
  console.log('🔍 Finding commits without proper timestamps...');
  
  try {
    const allPages = [];
    let hasMore = true;
    let startCursor = undefined;
    let pageCount = 0;
    
    while (hasMore) {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}...`);
      
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
      
      console.log(`📄 Fetched ${response.results.length} pages on this request, total so far: ${allPages.length}`);
      
      // Add a small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`📊 Total pages found: ${allPages.length} across ${pageCount} requests`);
    
    // Find commits with missing or incomplete timestamps
    const commitsToFix = [];
    const sampleDates = []; // For debugging
    const midnightCommits = []; // Commits at exactly midnight
    
    for (const page of allPages) {
      const dateProperty = page.properties['Date']?.date?.start;
      const commitMessage = page.properties['Commits']?.rich_text?.[0]?.plain_text || '';
      const repoName = page.properties['Project Name']?.title?.[0]?.text?.content || '';
      
      // Collect sample dates for debugging
      if (sampleDates.length < 10) {
        sampleDates.push({
          repo: repoName,
          message: commitMessage.substring(0, 30),
          date: dateProperty,
          dateLength: dateProperty ? dateProperty.length : 'null',
          hasTime: dateProperty && dateProperty.includes('T'),
          isMidnight: dateProperty && dateProperty.includes('T00:00:00')
        });
      }
      
      if (!dateProperty) {
        // No date at all
        commitsToFix.push({
          pageId: page.id,
          commitMessage,
          repoName,
          currentDate: null,
          issue: 'Missing date property'
        });
      } else if (dateProperty && dateProperty.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateProperty)) {
        // Date-only format (YYYY-MM-DD) without time - use regex to be more precise
        commitsToFix.push({
          pageId: page.id,
          commitMessage,
          repoName,
          currentDate: dateProperty,
          issue: 'Date only, no time (YYYY-MM-DD format)'
        });
      } else if (dateProperty && dateProperty.includes('T00:00:00')) {
        // Timestamp at exactly midnight - likely missing real time
        commitsToFix.push({
          pageId: page.id,
          commitMessage,
          repoName,
          currentDate: dateProperty,
          issue: 'Timestamp at midnight (likely missing real time)'
        });
        midnightCommits.push({
          repo: repoName,
          message: commitMessage.substring(0, 50),
          date: dateProperty
        });
      }
    }
    
    // Show sample dates for debugging
    console.log('\n🔍 Sample date properties found:');
    sampleDates.forEach((sample, index) => {
      console.log(`  ${index + 1}. ${sample.repo}: "${sample.message}..."`);
      console.log(`     Date: ${sample.date}`);
      console.log(`     Length: ${sample.dateLength}, Has Time: ${sample.hasTime}, Is Midnight: ${sample.isMidnight}`);
    });
    
    // Show midnight commits specifically
    if (midnightCommits.length > 0) {
      console.log(`\n🕛 Found ${midnightCommits.length} commits at exactly midnight (suspicious):`);
      midnightCommits.forEach((commit, index) => {
        console.log(`  ${index + 1}. ${commit.repo}: ${commit.message}...`);
        console.log(`     Date: ${commit.date}`);
      });
    }
    
    console.log(`\n📝 Found ${commitsToFix.length} commits that need timestamp fixes:`);
    commitsToFix.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.repoName}: ${commit.commitMessage.substring(0, 50)}...`);
      console.log(`     Issue: ${commit.issue}`);
      if (commit.currentDate) {
        console.log(`     Current: ${commit.currentDate}`);
      }
    });
    
    return commitsToFix;
    
  } catch (error) {
    console.error('❌ Error finding commits:', error);
    throw error;
  }
}

async function updateCommitTimestamp(pageId, newTimestamp) {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Date": {
          date: { start: newTimestamp }
        }
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Error updating page ${pageId}:`, error.message);
    return false;
  }
}

async function fixMissingTimestamps(commitsToFix, dryRun = true) {
  console.log(`\n${dryRun ? '🔍 DRY RUN MODE' : '🔧 UPDATING COMMITS'}...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < commitsToFix.length; i++) {
    const commit = commitsToFix[i];
    
    // Generate a reasonable timestamp based on the current date
    // We'll use 12:00 PM (noon) as a default time to avoid timezone cutoff issues
    let newTimestamp;
    
    if (commit.currentDate) {
      // If we have a date, use noon of that date
      newTimestamp = `${commit.currentDate}T12:00:00.000Z`;
    } else {
      // If no date at all, use today at noon
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];
      newTimestamp = `${dateString}T12:00:00.000Z`;
    }
    
    console.log(`\n${i + 1}/${commitsToFix.length}: ${commit.repoName}`);
    console.log(`  Message: ${commit.commitMessage.substring(0, 60)}...`);
    console.log(`  Issue: ${commit.issue}`);
    console.log(`  New timestamp: ${newTimestamp}`);
    
    if (!dryRun) {
      const success = await updateCommitTimestamp(commit.pageId, newTimestamp);
      if (success) {
        successCount++;
        console.log(`  ✅ Updated successfully`);
      } else {
        errorCount++;
        console.log(`  ❌ Update failed`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN COMPLETE`);
    console.log(`Would update ${commitsToFix.length} commits`);
  } else {
    console.log(`\n🔧 UPDATE COMPLETE`);
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed to update: ${errorCount}`);
  }
  
  return { successCount, errorCount };
}

async function deleteBrokenCommits(commitsToFix, dryRun = true) {
  console.log(`\n${dryRun ? '🔍 DRY RUN MODE' : '🗑️  DELETING BROKEN COMMITS'}...`);
  
  if (!dryRun) {
    console.log('\n⚠️  WARNING: This will permanently delete the following commits from Notion:');
    commitsToFix.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.repoName}: ${commit.commitMessage.substring(0, 60)}...`);
    });
    
    console.log('\n❌ This action cannot be undone!');
    console.log('💡 Consider backing up your data first.');
    
    // Add a small delay to let user read the warning
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < commitsToFix.length; i++) {
    const commit = commitsToFix[i];
    
    console.log(`\n${i + 1}/${commitsToFix.length}: ${commit.repoName}`);
    console.log(`  Message: ${commit.commitMessage.substring(0, 60)}...`);
    console.log(`  Issue: ${commit.issue}`);
    
    if (!dryRun) {
      try {
        // Archive the page instead of hard delete (safer)
        await notion.pages.update({
          page_id: commit.pageId,
          archived: true
        });
        successCount++;
        console.log(`  ✅ Archived successfully`);
      } catch (error) {
        errorCount++;
        console.log(`  ❌ Archive failed: ${error.message}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      console.log(`  🔍 Would archive this commit`);
    }
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN COMPLETE`);
    console.log(`Would archive ${commitsToFix.length} commits`);
  } else {
    console.log(`\n🗑️  DELETE COMPLETE`);
    console.log(`✅ Successfully archived: ${successCount}`);
    console.log(`❌ Failed to archive: ${errorCount}`);
    console.log('\n💡 Note: Commits were archived (not hard deleted) and can be restored from Notion trash if needed.');
  }
  
  return { successCount, errorCount };
}

async function searchForSpecificCommit(searchMessage) {
  console.log(`🔍 Searching for commit: "${searchMessage}"...`);
  
  try {
    const allPages = [];
    let hasMore = true;
    let startCursor = undefined;
    let pageCount = 0;
    
    while (hasMore) {
      pageCount++;
      console.log(`📄 Searching page ${pageCount}...`);
      
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
        page_size: 100,
        sorts: [
          {
            property: 'Date',
            direction: 'descending'
          }
        ]
      });
      
      // Check each page for the specific commit
      for (const page of response.results) {
        const commitMessage = page.properties['Commits']?.rich_text?.[0]?.plain_text || '';
        if (commitMessage.includes(searchMessage)) {
          const dateProperty = page.properties['Date']?.date?.start;
          const repoName = page.properties['Project Name']?.title?.[0]?.text?.content || '';
          
          console.log(`\n🎯 FOUND THE COMMIT!`);
          console.log(`Repository: ${repoName}`);
          console.log(`Message: ${commitMessage}`);
          console.log(`Date Property: ${dateProperty}`);
          console.log(`Date Type: ${typeof dateProperty}`);
          console.log(`Date Length: ${dateProperty ? dateProperty.length : 'null'}`);
          console.log(`Has Time: ${dateProperty && dateProperty.includes('T')}`);
          console.log(`Is Midnight: ${dateProperty && dateProperty.includes('T00:00:00')}`);
          console.log(`Page ID: ${page.id}`);
          
          // Show all properties for debugging
          console.log(`\n🔍 All properties on this page:`);
          Object.keys(page.properties).forEach(key => {
            const prop = page.properties[key];
            console.log(`  ${key}: ${JSON.stringify(prop)}`);
          });
          
          return page;
        }
      }
      
      allPages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      // Add a small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Stop after a reasonable number of pages to avoid infinite search
      if (pageCount > 50) {
        console.log(`⚠️  Stopped searching after 50 pages to avoid infinite loop`);
        break;
      }
    }
    
    console.log(`❌ Commit not found in the first ${pageCount * 100} pages`);
    return null;
    
  } catch (error) {
    console.error('❌ Error searching for commit:', error);
    throw error;
  }
}

async function main() {
  try {
    // Check if required environment variables are set
    if (!process.env.NOTION_API_KEY) {
      console.error('❌ NOTION_API_KEY environment variable not set');
      process.exit(1);
    }
    
    if (!process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID) {
      console.error('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set');
      process.exit(1);
    }
    
    console.log('🚀 Starting timestamp fix utility...\n');
    
    // Check command line arguments
    const hasDeleteFlag = process.argv.includes('--delete-broken');
    const hasApplyFlag = process.argv.includes('--apply');
    const hasSearchFlag = process.argv.includes('--search');
    
    if (hasSearchFlag) {
      // Search for specific commit
      const searchMessage = "Add comprehensive debugging for status persistence issues";
      await searchForSpecificCommit(searchMessage);
      return;
    }
    
    // Find commits that need fixing
    const commitsToFix = await findCommitsWithoutTimestamps();
    
    if (commitsToFix.length === 0) {
      console.log('✅ All commits already have proper timestamps!');
      return;
    }
    
    if (hasDeleteFlag) {
      // Delete broken commits
      await deleteBrokenCommits(commitsToFix, false);
      
      console.log('\n🎯 Next steps:');
      console.log('1. Run backfill to restore commits with proper timestamps:');
      console.log('   node backfill.js');
      console.log('\n2. Or run the backfill script with specific parameters:');
      console.log('   node backfill.js --owner=yourusername --months=6');
      
    } else if (hasApplyFlag) {
      // Show what would be fixed
      await fixMissingTimestamps(commitsToFix, true);
      
      console.log('\n🔧 Applying fixes...');
      await fixMissingTimestamps(commitsToFix, false);
      
    } else {
      // Show what would be fixed
      await fixMissingTimestamps(commitsToFix, true);
      
      console.log('\n💡 Available options:');
      console.log('   node fix-missing-timestamps.js --search          # Search for specific commit');
      console.log('   node fix-missing-timestamps.js --apply          # Fix timestamps with estimates');
      console.log('   node fix-missing-timestamps.js --delete-broken  # Remove broken entries and re-backfill');
      console.log('\n⚠️  --delete-broken is recommended for clean data integrity');
      console.log('   --apply uses estimated timestamps (12:00 PM) which may not be accurate');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

module.exports = { 
  findCommitsWithoutTimestamps, 
  fixMissingTimestamps,
  deleteBrokenCommits
};
