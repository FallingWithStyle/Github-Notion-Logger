#!/usr/bin/env node

/**
 * Script to backfill Wanderlog entries with improved prompts
 * Usage: node backfill-wanderlog.js --start 2025-08-28 --end 2025-09-08
 */

const { getCommitsForDate, filterSignificantCommits, generateCommitSummary, createWanderlogEntry, ensureWanderlogDatabase } = require('./wanderlog-processor');

async function backfillWanderlog(startDate, endDate) {
  console.log(`🔄 Starting improved Wanderlog backfill from ${startDate} through ${endDate}...\n`);
  
  try {
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    
    console.log(`📅 Date range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
    
    // Ensure database exists
    await ensureWanderlogDatabase();
    
    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0
    };
    
    // Process each day
    for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
      const dateStr = currentDate.toISOString().split('T')[0];
      console.log(`\n📅 Processing ${dateStr}...`);
      
      try {
        // Get commits for this specific date
        const allCommits = await getCommitsForDate(dateStr);
        
        if (allCommits.length === 0) {
          console.log(`⏭️  No commits found for ${dateStr}, skipping`);
          results.skipped++;
          continue;
        }
        
        // Filter significant commits
        const significantCommits = filterSignificantCommits(allCommits);
        console.log(`📊 Filtered to ${significantCommits.length} significant commits (from ${allCommits.length} total)`);
        
        if (significantCommits.length === 0) {
          console.log(`⏭️  No significant commits found for ${dateStr}, skipping`);
          results.skipped++;
          continue;
        }
        
        // Generate summary
        const summary = await generateCommitSummary(significantCommits);
        
        // Create Notion entry
        await createWanderlogEntry(summary, significantCommits);
        
        console.log(`✅ Created entry for ${dateStr}: ${summary.title}`);
        results.processed++;
        results.created++;
        
      } catch (error) {
        console.error(`❌ Error processing ${dateStr}:`, error.message);
        results.errors++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Improved backfill completed!');
    console.log(`📊 Summary:`);
    console.log(`   Days processed: ${results.processed}`);
    console.log(`   Entries created: ${results.created}`);
    console.log(`   Days skipped (no commits): ${results.skipped}`);
    console.log(`   Errors: ${results.errors}`);
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let startDate = null;
  let endDate = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && i + 1 < args.length) {
      startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end' && i + 1 < args.length) {
      endDate = args[i + 1];
      i++;
    }
  }
  
  if (!startDate || !endDate) {
    console.error('Usage: node backfill-wanderlog.js --start YYYY-MM-DD --end YYYY-MM-DD');
    console.error('Example: node backfill-wanderlog.js --start 2025-08-28 --end 2025-09-08');
    process.exit(1);
  }
  
  return { startDate, endDate };
}

// Run backfill if this file is executed directly
if (require.main === module) {
  const { startDate, endDate } = parseArgs();
  backfillWanderlog(startDate, endDate);
}

module.exports = { backfillWanderlog };
