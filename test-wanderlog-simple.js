#!/usr/bin/env node

// Simple test that doesn't require API keys
const { filterSignificantCommits } = require('./wanderlog-processor');

function testCommitFiltering() {
  console.log('🧪 Testing commit filtering logic...\n');
  
  const testCommits = [
    { message: "Add new feature for user authentication", repo: "test/repo1" },
    { message: "fix typo in readme", repo: "test/repo1" },
    { message: "Implement database migration", repo: "test/repo2" },
    { message: "typo", repo: "test/repo1" },
    { message: "Refactor authentication service", repo: "test/repo1" },
    { message: "Update README with new instructions", repo: "test/repo2" },
    { message: "Fix critical security vulnerability", repo: "test/repo1" },
    { message: "console.log('debug')", repo: "test/repo1" },
    { message: "Add comprehensive test suite", repo: "test/repo2" },
    { message: "Merge branch 'feature/auth'", repo: "test/repo1" }
  ];
  
  console.log(`📝 Testing with ${testCommits.length} sample commits:`);
  testCommits.forEach((commit, index) => {
    console.log(`   ${index + 1}. ${commit.message}`);
  });
  
  const significantCommits = filterSignificantCommits(testCommits);
  
  console.log(`\n✅ Filtered to ${significantCommits.length} significant commits:`);
  significantCommits.forEach((commit, index) => {
    console.log(`   ${index + 1}. ${commit.message}`);
  });
  
  const expectedSignificant = [
    "Add new feature for user authentication",
    "Implement database migration", 
    "Refactor authentication service",
    "Update README with new instructions",
    "Fix critical security vulnerability",
    "Add comprehensive test suite"
  ];
  
  const actualMessages = significantCommits.map(c => c.message);
  const allExpectedFound = expectedSignificant.every(expected => 
    actualMessages.includes(expected)
  );
  
  if (allExpectedFound && significantCommits.length === expectedSignificant.length) {
    console.log('\n🎉 Commit filtering test passed!');
    console.log('✅ Correctly filtered out typos, console.log, and merge commits');
    console.log('✅ Kept significant feature work and refactoring');
  } else {
    console.log('\n❌ Commit filtering test failed!');
    console.log('Expected:', expectedSignificant);
    console.log('Actual:', actualMessages);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testCommitFiltering();
}

module.exports = { testCommitFiltering };
