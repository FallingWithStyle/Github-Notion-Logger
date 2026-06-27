#!/usr/bin/env node

const { 
  processDailyCommits, 
  getPreviousDayCommits, 
  filterSignificantCommits, 
  generateCommitSummary,
  ensureWanderlogDatabase 
} = require('./wanderlog-processor');

async function testWanderlog() {
  console.log('🧪 Testing Wanderlog processor...\n');
  
  try {
    // Test 1: Ensure database exists
    console.log('1️⃣ Testing database creation...');
    await ensureWanderlogDatabase();
    console.log('✅ Database test passed\n');
    
    // Test 2: Get previous day commits
    console.log('2️⃣ Testing commit fetching...');
    const commits = await getPreviousDayCommits();
    console.log(`✅ Found ${commits.length} commits from previous day\n`);
    
    if (commits.length > 0) {
      // Test 3: Filter significant commits
      console.log('3️⃣ Testing commit filtering...');
      const significantCommits = filterSignificantCommits(commits);
      console.log(`✅ Filtered to ${significantCommits.length} significant commits (from ${commits.length} total)\n`);
      
      if (significantCommits.length > 0) {
        // Test 4: Generate summary
        console.log('4️⃣ Testing summary generation...');
        const summary = await generateCommitSummary(significantCommits);
        console.log('✅ Summary generated:');
        console.log(`   Title: ${summary.title}`);
        console.log(`   Summary: ${summary.summary}`);
        console.log(`   Insights: ${summary.insights}`);
        console.log(`   Focus Areas: ${summary.focusAreas}\n`);
        
        // Test 5: Full processing
        console.log('5️⃣ Testing full processing...');
        await processDailyCommits();
        console.log('✅ Full processing test passed\n');
      } else {
        console.log('⚠️ No significant commits found, skipping summary test\n');
      }
    } else {
      console.log('⚠️ No commits found for previous day, skipping filter and summary tests\n');
    }
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testWanderlog();
}

module.exports = { testWanderlog };
