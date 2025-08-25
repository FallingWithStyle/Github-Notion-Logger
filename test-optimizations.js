const { backfillCommits } = require('./backfill');

async function testOptimizations() {
  console.log('🚀 Testing optimized backfill performance...\n');
  
  try {
    // Test with a small incremental backfill to measure performance
    console.log('📊 Running incremental backfill test...');
    const startTime = Date.now();
    
    await backfillCommits(6, true, false); // Use incremental mode, not all repos
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    console.log(`\n🎯 OPTIMIZATION TEST RESULTS:`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`📈 Expected Improvement: ~40-60% faster than previous ~1.5 minutes`);
    
    if (totalTime < 90) { // Less than 1.5 minutes
      console.log(`✅ SUCCESS: Performance target achieved! (${totalTime.toFixed(2)}s < 90s)`);
    } else {
      console.log(`⚠️  Performance improvement needed: ${totalTime.toFixed(2)}s (target: <90s)`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testOptimizations();
}

module.exports = { testOptimizations };
