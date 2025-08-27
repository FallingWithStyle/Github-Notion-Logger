const { Client } = require('@notionhq/client');
const timezoneConfig = require('./timezone-config');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

// Configuration for optimal performance
const CONFIG = {
  pageSize: 100,           // Notion API page size
  batchSize: 50,           // Batch size for deletions (increased from 10)
  maxConcurrent: 10,       // Concurrent deletion operations
  delayBetweenBatches: 100, // Delay between batches in ms
  progressSaveInterval: 100, // Save progress every N pages processed
  resumeFile: './dedup-progress.json', // Progress tracking file
  timeoutMs: 30000,        // Timeout for API calls
};

// Progress tracking
let progress = {
  totalPages: 0,
  processedPages: 0,
  duplicatesFound: 0,
  duplicatesRemoved: 0,
  errors: 0,
  startTime: null,
  lastSaveTime: null,
  currentBatch: 0,
  totalBatches: 0,
};

async function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.resumeFile)) {
      const data = fs.readFileSync(CONFIG.resumeFile, 'utf8');
      const saved = JSON.parse(data);
      console.log(`📋 Found progress file: ${saved.processedPages}/${saved.totalPages} pages processed`);
      return saved;
    }
  } catch (error) {
    console.warn('⚠️ Could not load progress file:', error.message);
  }
  return null;
}

async function saveProgress() {
  try {
    progress.lastSaveTime = Date.now();
    fs.writeFileSync(CONFIG.resumeFile, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.warn('⚠️ Could not save progress:', error.message);
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatProgress() {
  const elapsed = Date.now() - progress.startTime;
  const rate = progress.processedPages / (elapsed / 1000);
  const eta = progress.totalPages > 0 ? (progress.totalPages - progress.processedPages) / rate : 0;
  
  return {
    processed: progress.processedPages.toLocaleString(),
    total: progress.totalPages.toLocaleString(),
    percentage: progress.totalPages > 0 ? ((progress.processedPages / progress.totalPages) * 100).toFixed(1) : '0',
    duplicates: progress.duplicatesFound.toLocaleString(),
    removed: progress.duplicatesRemoved.toLocaleString(),
    errors: progress.errors.toLocaleString(),
    rate: rate.toFixed(1),
    elapsed: formatDuration(elapsed),
    eta: formatDuration(eta * 1000),
  };
}

async function fetchPagesWithProgress() {
  console.log('🔄 Fetching all pages from database...');
  
  const allPages = [];
  let hasMore = true;
  let startCursor = undefined;
  let pageCount = 0;
  
  // Add timeout for the entire fetch operation - much longer for very large databases
  const fetchTimeout = setTimeout(() => {
    console.log('⚠️ Fetch timeout - using partial data');
    throw new Error('Fetch timeout');
  }, 900000); // 15 minute timeout for very large databases
  
  try {
    while (hasMore) {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}...`);
      
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
        page_size: CONFIG.pageSize,
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
      
      // Update progress
      progress.totalPages = allPages.length;
      progress.processedPages = allPages.length;
      
      // Save progress periodically
      if (pageCount % CONFIG.progressSaveInterval === 0) {
        await saveProgress();
        console.log(`📊 Fetched ${allPages.length.toLocaleString()} pages so far...`);
      }
      
      // Small delay to be respectful to Notion API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    clearTimeout(fetchTimeout);
    console.log(`✅ Fetched ${allPages.length.toLocaleString()} total pages`);
    return allPages;
    
  } catch (error) {
    clearTimeout(fetchTimeout);
    throw error;
  }
}

async function findDuplicates(pages) {
  console.log('🔍 Analyzing pages for duplicates...');
  
  // Use Map for better performance than plain object
  const groupedPages = new Map();
  const duplicates = [];
  const shaGroups = new Map(); // SHA-based grouping for more reliable deduplication
  
  let processed = 0;
  
  for (const page of pages) {
    processed++;
    
    // Extract properties
    const commitMessage = page.properties['Commits']?.rich_text?.[0]?.plain_text || '';
    const repoName = page.properties['Project Name']?.title?.[0]?.plain_text || '';
    const rawDate = page.properties['Date']?.date?.start;
    const date = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';
    const sha = page.properties['SHA']?.rich_text?.[0]?.plain_text || '';
    
    // Create multiple keys for different deduplication strategies
    const messageKey = `${commitMessage}|${repoName}|${date}`;
    const shaKey = sha ? `sha:${sha}` : null;
    
    // SHA-based deduplication (most reliable)
    if (shaKey) {
      if (shaGroups.has(shaKey)) {
        duplicates.push(page);
        progress.duplicatesFound++;
      } else {
        shaGroups.set(shaKey, page);
      }
    }
    // Fallback to message-based deduplication
    else if (groupedPages.has(messageKey)) {
      duplicates.push(page);
      progress.duplicatesFound++;
    } else {
      groupedPages.set(messageKey, page);
    }
    
    // Update progress
    progress.processedPages = processed;
    
    // Save progress periodically
    if (processed % CONFIG.progressSaveInterval === 0) {
      await saveProgress();
      const stats = formatProgress();
      console.log(`🔍 Analyzed: ${stats.processed}/${stats.total} pages, found ${stats.duplicates} duplicates`);
    }
  }
  
  console.log(`✅ Analysis complete: ${duplicates.length.toLocaleString()} duplicates found`);
  return duplicates;
}

async function removeDuplicates(duplicates) {
  if (duplicates.length === 0) {
    console.log('✅ No duplicates to remove');
    return;
  }
  
  console.log(`🗑️ Removing ${duplicates.length.toLocaleString()} duplicates...`);
  
  // Process in larger batches with concurrent operations
  const batches = [];
  for (let i = 0; i < duplicates.length; i += CONFIG.batchSize) {
    batches.push(duplicates.slice(i, i + CONFIG.batchSize));
  }
  
  progress.totalBatches = batches.length;
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    progress.currentBatch = batchIndex + 1;
    
    console.log(`📦 Processing batch ${progress.currentBatch}/${progress.totalBatches} (${batch.length} duplicates)`);
    
    // Process batch with controlled concurrency
    const batchPromises = [];
    for (let i = 0; i < batch.length; i += CONFIG.maxConcurrent) {
      const concurrentBatch = batch.slice(i, i + CONFIG.maxConcurrent);
      const promises = concurrentBatch.map(async (page) => {
        try {
          await notion.pages.update({
            page_id: page.id,
            archived: true
          });
          progress.duplicatesRemoved++;
          return { success: true, id: page.id };
        } catch (error) {
          progress.errors++;
          console.error(`❌ Failed to archive page ${page.id}:`, error.message);
          return { success: false, id: page.id, error: error.message };
        }
      });
      
      batchPromises.push(...promises);
      
      // Small delay between concurrent sub-batches
      if (i + CONFIG.maxConcurrent < batch.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Wait for all operations in this batch to complete
    const results = await Promise.allSettled(batchPromises);
    
    // Count successes and failures
    const batchResults = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' });
    const batchSuccesses = batchResults.filter(r => r.success).length;
    const batchErrors = batchResults.filter(r => !r.success).length;
    
    console.log(`✅ Batch ${progress.currentBatch} complete: ${batchSuccesses} archived, ${batchErrors} errors`);
    
    // Save progress after each batch
    await saveProgress();
    
    // Delay between batches to avoid rate limits
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
    }
  }
}

async function deduplicateDatabaseOptimized() {
  console.log('🚀 Starting optimized database deduplication...');
  console.log(`⚙️ Configuration: batch size ${CONFIG.batchSize}, max concurrent ${CONFIG.maxConcurrent}`);
  
  try {
    // Load progress if available
    const savedProgress = await loadProgress();
    if (savedProgress) {
      progress = { ...progress, ...savedProgress };
      console.log(`📋 Resuming from previous run: ${progress.processedPages}/${progress.totalPages} pages processed`);
    }
    
    progress.startTime = Date.now();
    
    // Fetch all pages
    const allPages = await fetchPagesWithProgress();
    
    // Find duplicates
    const duplicates = await findDuplicates(allPages);
    
    // Remove duplicates
    await removeDuplicates(duplicates);
    
    // Final summary
    const finalStats = formatProgress();
    const totalTime = Date.now() - progress.startTime;
    
    console.log('\n🎉 Deduplication completed successfully!');
    console.log('📊 FINAL STATISTICS:');
    console.log(`   📄 Total pages processed: ${finalStats.total}`);
    console.log(`   🔍 Duplicates found: ${finalStats.duplicates}`);
    console.log(`   ✅ Duplicates removed: ${finalStats.removed}`);
    console.log(`   ❌ Errors encountered: ${finalStats.errors}`);
    console.log(`   ⏱️ Total time: ${finalStats.elapsed}`);
    console.log(`   📈 Processing rate: ${finalStats.rate} pages/second`);
    
    // Clean up progress file
    try {
      if (fs.existsSync(CONFIG.resumeFile)) {
        fs.unlinkSync(CONFIG.resumeFile);
        console.log('🧹 Progress file cleaned up');
      }
    } catch (error) {
      console.warn('⚠️ Could not clean up progress file:', error.message);
    }
    
    return {
      totalPages: progress.totalPages,
      duplicatesFound: progress.duplicatesFound,
      duplicatesRemoved: progress.duplicatesRemoved,
      errors: progress.errors,
      totalTime
    };
    
  } catch (error) {
    console.error('❌ Deduplication failed:', error);
    
    // Save progress on failure for potential resume
    await saveProgress();
    console.log(`💾 Progress saved to ${CONFIG.resumeFile} - you can resume later`);
    
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Optimized Notion Database Deduplicator

Usage: node deduplicate-optimized.js [options]

Options:
  --batch-size <num>     Batch size for deletions (default: ${CONFIG.batchSize})
  --concurrent <num>     Max concurrent operations (default: ${CONFIG.maxConcurrent})
  --resume               Resume from previous run
  --clean-progress       Clean up progress file and start fresh
  -h, --help            Show this help message

Examples:
  node deduplicate-optimized.js                    # Run with default settings
  node deduplicate-optimized.js --batch-size 100   # Larger batches
  node deduplicate-optimized.js --concurrent 20    # More concurrent operations
  node deduplicate-optimized.js --resume           # Resume from previous run
  node deduplicate-optimized.js --clean-progress   # Start fresh
`);
    process.exit(0);
  }
  
  // Parse command line arguments
  if (args.includes('--batch-size')) {
    const index = args.indexOf('--batch-size');
    if (index + 1 < args.length) {
      const value = parseInt(args[index + 1]);
      if (!isNaN(value) && value > 0) {
        CONFIG.batchSize = value;
        console.log(`⚙️ Batch size set to ${CONFIG.batchSize}`);
      }
    }
  }
  
  if (args.includes('--concurrent')) {
    const index = args.indexOf('--concurrent');
    if (index + 1 < args.length) {
      const value = parseInt(args[index + 1]);
      if (!isNaN(value) && value > 0) {
        CONFIG.maxConcurrent = value;
        console.log(`⚙️ Max concurrent operations set to ${CONFIG.maxConcurrent}`);
      }
    }
  }
  
  if (args.includes('--clean-progress')) {
    try {
      if (fs.existsSync(CONFIG.resumeFile)) {
        fs.unlinkSync(CONFIG.resumeFile);
        console.log('🧹 Progress file cleaned up');
      }
    } catch (error) {
      console.warn('⚠️ Could not clean up progress file:', error.message);
    }
  }
  
  // Run deduplication
  deduplicateDatabaseOptimized()
    .then(() => {
      console.log('✅ Deduplication completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deduplication failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deduplicateDatabaseOptimized };
