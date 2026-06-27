#!/usr/bin/env node

/**
 * Example usage of Wanderlog specific date testing
 * 
 * This script demonstrates how to use the Wanderlog system
 * to process commits from specific dates.
 */

const { testSpecificDate } = require('./test-wanderlog-specific-date');

async function runExamples() {
  console.log('📚 Wanderlog Specific Date Testing Examples\n');
  
  // Example 1: Test with a specific date (dry run)
  console.log('1️⃣ Example: Testing with specific date (dry run)');
  console.log('   Command: node test-wanderlog-specific-date.js --date 2024-01-15');
  console.log('   This will fetch commits from January 15, 2024 and show the summary without creating a Notion entry\n');
  
  // Example 2: Test with yesterday's commits and create Notion entry
  console.log('2️⃣ Example: Testing with yesterday\'s commits and creating Notion entry');
  console.log('   Command: node test-wanderlog-specific-date.js --date yesterday --create');
  console.log('   This will fetch yesterday\'s commits, generate a summary, and create a Notion entry\n');
  
  // Example 3: Test with today's commits
  console.log('3️⃣ Example: Testing with today\'s commits');
  console.log('   Command: node test-wanderlog-specific-date.js --date today');
  console.log('   This will fetch today\'s commits and show the summary\n');
  
  // Example 4: Test with a specific date and create Notion entry
  console.log('4️⃣ Example: Testing with specific date and creating Notion entry');
  console.log('   Command: node test-wanderlog-specific-date.js --date 2024-12-01 --create');
  console.log('   This will fetch commits from December 1, 2024, generate a summary, and create a Notion entry\n');
  
  console.log('💡 Tips:');
  console.log('   - Use --create flag only when you want to create actual Notion entries');
  console.log('   - Use "yesterday" or "today" for relative dates');
  console.log('   - Use YYYY-MM-DD format for specific dates');
  console.log('   - Make sure your environment variables are set (OPENAI_API_KEY, GITHUB_TOKEN, NOTION_API_KEY)');
  
  console.log('\n🔧 Environment Variables Required:');
  console.log('   OPENAI_API_KEY=your_openai_api_key');
  console.log('   GITHUB_TOKEN=your_github_token');
  console.log('   NOTION_API_KEY=your_notion_api_key');
  
  console.log('\n📖 For more information, run:');
  console.log('   node test-wanderlog-specific-date.js --help');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

module.exports = { runExamples };
